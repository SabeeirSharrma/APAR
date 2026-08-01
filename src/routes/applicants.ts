import { Router, Request, Response } from 'express';
import { getOne, getMany, run } from '../db/index.js';
import { decryptResult } from '../lib/encryption.js';
import { requireAuth } from '../middleware/auth.js';
import { statusUpdateSchema } from '../lib/validation.js';
import { sendApprovalEmail, sendRejectionEmail } from '../lib/email.js';

const router = Router();

// All applicant routes require auth
router.use(requireAuth);

// GET /api/v1/applicants — List all applicants (for interviewer dashboard)
router.get('/', async (req: Request, res: Response) => {
  const { companyId } = req.auth!;
  const { positionId, status, tag, round, interviewerId, page = '1', pageSize = '20' } = req.query;

  const limit = Math.min(parseInt(pageSize as string) || 20, 100);
  const offset = ((parseInt(page as string) || 1) - 1) * limit;

  interface ApplicationRow {
    id: string;
    position_id: string;
    company_id: string;
    email: string;
    name: string;
    status: string;
    assigned_interviewer_id: string | null;
    current_round_id: string | null;
    created_at: string;
    updated_at: string;
    position_name: string;
  }

  let where = 'a.company_id = @companyId';
  const params: Record<string, unknown> = { companyId };

  if (positionId) {
    where += ' AND a.position_id = @positionId';
    params.positionId = positionId;
  }
  if (status) {
    where += ' AND a.status = @status';
    params.status = status;
  }
  if (interviewerId) {
    where += ' AND a.assigned_interviewer_id = @interviewerId';
    params.interviewerId = interviewerId;
  }
  if (round) {
    where += ' AND a.current_round_id = @roundId';
    params.roundId = round;
  }
  if (tag) {
    where += ` AND EXISTS (SELECT 1 FROM applicant_tags at2 JOIN tags t ON at2.tag_id = t.id WHERE at2.application_id = a.id AND t.name = @tagName)`;
    params.tagName = tag;
  }

  const countRow = getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications a WHERE ${where}`,
    params,
  );
  const total = countRow?.count ?? 0;

  const items = getMany<ApplicationRow>(
    `SELECT a.*, p.name as position_name
     FROM applications a
     JOIN positions p ON a.position_id = p.id
     WHERE ${where}
     ORDER BY a.created_at DESC
     LIMIT @limit OFFSET @offset`,
    { ...params, limit, offset },
  );

  res.json({
    success: true,
    data: {
      items,
      total,
      page: parseInt(page as string) || 1,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/v1/applicants/:id — Get applicant details with decrypted result
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.auth!;

  interface ApplicationDetailRow {
    id: string;
    position_id: string;
    company_id: string;
    email: string;
    name: string;
    resume_path: string;
    supplementary_info: string | null;
    status: string;
    assigned_interviewer_id: string | null;
    current_round_id: string | null;
    created_at: string;
    updated_at: string;
    position_name: string;
    criteria: string;
  }

  const app = getOne<ApplicationDetailRow>(
    `SELECT a.*, p.name as position_name, p.criteria
     FROM applications a
     JOIN positions p ON a.position_id = p.id
     WHERE a.id = ? AND a.company_id = ?`,
    { id, companyId },
  );

  if (!app) {
    res.status(404).json({ success: false, error: 'Application not found' });
    return;
  }

  // Get tags
  const tags = getMany<{ id: string; name: string; color: string; scope: string }>(
    `SELECT t.id, t.name, t.color, t.scope
     FROM tags t
     JOIN applicant_tags at ON t.id = at.tag_id
     WHERE at.application_id = ?`,
    { applicationId: id },
  );

  // Get notes
  const notes = getMany<{ id: string; interviewer_id: string; content: string; created_at: string }>(
    `SELECT id, interviewer_id, content, created_at
     FROM notes
     WHERE application_id = ?
     ORDER BY created_at DESC`,
    { applicationId: id },
  );

  // Decrypt result if available
  interface ResultRow {
    encrypted_data: string;
    low_confidence: number;
    verification_attempts: number;
    created_at: string;
  }
  const resultRow = getOne<ResultRow>(
    'SELECT encrypted_data, low_confidence, verification_attempts, created_at FROM results WHERE application_id = ?',
    { applicationId: id },
  );

  let result = null;
  if (resultRow) {
    result = decryptResult(resultRow.encrypted_data);
    if (result) {
      (result as Record<string, unknown>).lowConfidence = resultRow.low_confidence === 1;
      (result as Record<string, unknown>).verificationAttempts = resultRow.verification_attempts;
    }
  }

  res.json({
    success: true,
    data: {
      applicant: { ...app, tags, notes },
      result,
    },
  });
});

// PATCH /api/v1/applicants/:id/status — Approve or reject applicant
router.patch('/:id/status', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyId } = req.auth!;

  const result = statusUpdateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { status } = result.data;

  const existing = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM applications WHERE id = ?',
    { id },
  );
  if (!existing || existing.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Application not found' });
    return;
  }

  run(
    `UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    { status, id },
  );

  // Send email notification to applicant (§13)
  if (status === 'approved') {
    sendApprovalEmail(id).catch((err) => console.error('Failed to send approval email:', err));
  } else if (status === 'rejected') {
    sendRejectionEmail(id).catch((err) => console.error('Failed to send rejection email:', err));
  }

  res.json({
    success: true,
    message: `Applicant ${status}`,
    data: {
      applicantId: id,
      status,
      updatedAt: new Date().toISOString(),
    },
  });
});

// POST /api/v1/applicants/:id/tags — Add tag to applicant
router.post('/:id/tags', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.auth!;
  const { tagId } = req.body;

  if (!tagId) {
    res.status(400).json({ success: false, error: 'Missing required field: tagId' });
    return;
  }

  // Verify application belongs to company
  const app = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM applications WHERE id = ?',
    { id },
  );
  if (!app || app.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Application not found' });
    return;
  }

  // Verify tag belongs to company
  const tag = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM tags WHERE id = ?',
    { tagId },
  );
  if (!tag || tag.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Tag not found' });
    return;
  }

  run(
    `INSERT OR IGNORE INTO applicant_tags (application_id, tag_id) VALUES (?, ?)`,
    { applicationId: id, tagId },
  );

  res.json({ success: true, message: 'Tag added to applicant', data: { applicantId: id, tagId } });
});

// DELETE /api/v1/applicants/:id/tags/:tagId — Remove tag from applicant
router.delete('/:id/tags/:tagId', async (req: Request, res: Response) => {
  const { id, tagId } = req.params;

  run(
    `DELETE FROM applicant_tags WHERE application_id = ? AND tag_id = ?`,
    { applicationId: id, tagId },
  );

  res.json({ success: true, message: 'Tag removed from applicant', data: { applicantId: id, tagId } });
});

export default router;
