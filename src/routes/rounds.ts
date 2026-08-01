import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getOne, getMany, run, transaction } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createRoundSchema, updateRoundSchema } from '../lib/validation.js';

const router = Router();

// All round routes require auth
router.use(requireAuth);

// GET /api/v1/rounds — List all rounds for a company
router.get('/', async (req: Request, res: Response) => {
  const { companyId } = req.auth!;
  const { positionId } = req.query;

  let where = 'r.company_id = @companyId';
  const params: Record<string, unknown> = { companyId };

  if (positionId) {
    where += ' AND r.position_id = @positionId';
    params.positionId = positionId;
  }

  const rounds = getMany<{
    id: string;
    round_number: number;
    name: string;
    description: string | null;
    position_id: string | null;
    created_at: string;
  }>(
    `SELECT r.* FROM rounds r WHERE ${where} ORDER BY r.round_number ASC`,
    params,
  );

  // Enrich with interviewer count and applicant count per round
  const enriched = rounds.map((r) => {
    const interviewerCount = getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM interviewer_rounds WHERE round_id = ?',
      { id: r.id },
    );
    const applicantCount = getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM applications WHERE current_round_id = ?',
      { id: r.id },
    );
    return {
      ...r,
      interviewerCount: interviewerCount?.count ?? 0,
      applicantCount: applicantCount?.count ?? 0,
    };
  });

  res.json({ success: true, data: enriched });
});

// GET /api/v1/rounds/:id — Get round details with assigned interviewers
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.auth!;

  const round = getOne<{
    id: string;
    company_id: string;
    round_number: number;
    name: string;
    description: string | null;
    position_id: string | null;
    created_at: string;
    updated_at: string;
  }>(
    'SELECT * FROM rounds WHERE id = ? AND company_id = ?',
    { id, companyId },
  );

  if (!round) {
    res.status(404).json({ success: false, error: 'Round not found' });
    return;
  }

  // Get assigned interviewers
  const interviewers = getMany<{ id: string; email: string; name: string }>(
    `SELECT i.id, i.email, i.name
     FROM interviewers i
     JOIN interviewer_rounds ir ON i.id = ir.interviewer_id
     WHERE ir.round_id = ?`,
    { id },
  );

  // Get applicants in this round
  const applicants = getMany<{ id: string; name: string; status: string; email: string }>(
    `SELECT id, name, status, email FROM applications
     WHERE current_round_id = ?
     ORDER BY created_at DESC`,
    { id },
  );

  res.json({
    success: true,
    data: { ...round, interviewers, applicants },
  });
});

// POST /api/v1/rounds — Create a new round
router.post('/', requireRole('company_admin'), async (req: Request, res: Response) => {
  const result = createRoundSchema.safeParse({ ...req.body, companyId: req.auth!.companyId });
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { roundNumber, name, description, positionId } = result.data;
  const companyId = req.auth!.companyId;

  // Check for duplicate round number
  const existing = getOne<{ id: string }>(
    'SELECT id FROM rounds WHERE company_id = ? AND round_number = ?',
    { companyId, roundNumber },
  );
  if (existing) {
    res.status(409).json({
      success: false,
      error: `Round number ${roundNumber} already exists`,
    });
    return;
  }

  const id = randomUUID();
  run(
    `INSERT INTO rounds (id, company_id, position_id, round_number, name, description)
     VALUES (?, ?, ?, ?, ?, ?)`,
    { id, companyId, positionId: positionId || null, roundNumber, name, description: description || null },
  );

  // Update company's round count
  run(
    `UPDATE companies SET round_count = (SELECT MAX(round_number) FROM rounds WHERE company_id = ?), updated_at = datetime('now') WHERE id = ?`,
    { companyId, companyId2: companyId },
  );

  res.status(201).json({
    success: true,
    message: 'Round created',
    data: { id, roundNumber, name, description, positionId, createdAt: new Date().toISOString() },
  });
});

// PATCH /api/v1/rounds/:id — Update a round
router.patch('/:id', requireRole('company_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.auth!;

  const result = updateRoundSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const existing = getOne<{ id: string }>(
    'SELECT id FROM rounds WHERE id = ? AND company_id = ?',
    { id, companyId },
  );
  if (!existing) {
    res.status(404).json({ success: false, error: 'Round not found' });
    return;
  }

  const { roundNumber, name, description } = result.data;
  const updates: string[] = [];
  const params: Record<string, unknown> = { id };

  if (roundNumber !== undefined) {
    // Check for duplicate round number
    const dup = getOne<{ id: string }>(
      'SELECT id FROM rounds WHERE company_id = ? AND round_number = ? AND id != ?',
      { companyId, roundNumber, id },
    );
    if (dup) {
      res.status(409).json({ success: false, error: `Round number ${roundNumber} already exists` });
      return;
    }
    updates.push('round_number = @roundNumber');
    params.roundNumber = roundNumber;
  }
  if (name !== undefined) { updates.push('name = @name'); params.name = name; }
  if (description !== undefined) { updates.push('description = @description'); params.description = description; }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    run(`UPDATE rounds SET ${updates.join(', ')} WHERE id = @id`, params);
  }

  res.json({ success: true, message: 'Round updated', data: { id } });
});

// DELETE /api/v1/rounds/:id — Delete a round
router.delete('/:id', requireRole('company_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.auth!;

  const existing = getOne<{ id: string }>(
    'SELECT id FROM rounds WHERE id = ? AND company_id = ?',
    { id, companyId },
  );
  if (!existing) {
    res.status(404).json({ success: false, error: 'Round not found' });
    return;
  }

  transaction(() => {
    // Remove interviewer-round assignments
    run('DELETE FROM interviewer_rounds WHERE round_id = ?', { id });

    // Clear current_round_id from applications in this round
    run(
      `UPDATE applications SET current_round_id = NULL, updated_at = datetime('now') WHERE current_round_id = ?`,
      { id },
    );

    // Delete the round
    run('DELETE FROM rounds WHERE id = ?', { id });
  });

  res.json({ success: true, message: 'Round deleted' });
});

// POST /api/v1/rounds/:id/interviewers — Assign interviewer to round
router.post('/:id/interviewers', requireRole('company_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.auth!;
  const { interviewerId } = req.body;

  if (!interviewerId) {
    res.status(400).json({ success: false, error: 'Missing required field: interviewerId' });
    return;
  }

  const round = getOne<{ id: string }>(
    'SELECT id FROM rounds WHERE id = ? AND company_id = ?',
    { id, companyId },
  );
  if (!round) {
    res.status(404).json({ success: false, error: 'Round not found' });
    return;
  }

  const interviewer = getOne<{ id: string }>(
    'SELECT id FROM interviewers WHERE id = ? AND company_id = ?',
    { interviewerId, companyId },
  );
  if (!interviewer) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  run(
    'INSERT OR IGNORE INTO interviewer_rounds (interviewer_id, round_id) VALUES (?, ?)',
    { interviewerId, roundId: id },
  );

  res.json({ success: true, message: 'Interviewer assigned to round', data: { roundId: id, interviewerId } });
});

// DELETE /api/v1/rounds/:id/interviewers/:interviewerId — Remove interviewer from round
router.delete('/:id/interviewers/:interviewerId', requireRole('company_admin'), async (req: Request, res: Response) => {
  const { id, interviewerId } = req.params;

  run(
    'DELETE FROM interviewer_rounds WHERE round_id = ? AND interviewer_id = ?',
    { roundId: id, interviewerId },
  );

  res.json({ success: true, message: 'Interviewer removed from round' });
});

// POST /api/v1/rounds/:id/applicants/:applicantId/advance — Advance applicant to next round
router.post('/:id/applicants/:applicantId/advance', requireRole('company_admin'), async (req: Request, res: Response) => {
  const { id, applicantId } = req.params;
  const { companyId } = req.auth!;

  // Look up current round
  const currentRound = getOne<{ id: string; round_number: number; company_id: string }>(
    'SELECT id, round_number, company_id FROM rounds WHERE id = ? AND company_id = ?',
    { id, companyId },
  );
  if (!currentRound) {
    res.status(404).json({ success: false, error: 'Round not found' });
    return;
  }

  // Look up applicant
  const applicant = getOne<{ id: string; current_round_id: string | null; position_id: string }>(
    'SELECT id, current_round_id, position_id FROM applications WHERE id = ?',
    { applicantId },
  );
  if (!applicant) {
    res.status(404).json({ success: false, error: 'Applicant not found' });
    return;
  }

  if (applicant.current_round_id !== id) {
    res.status(400).json({ success: false, error: 'Applicant is not in this round' });
    return;
  }

  // Find next round
  const nextRound = getOne<{ id: string; round_number: number }>(
    `SELECT id, round_number FROM rounds
     WHERE company_id = ? AND round_number = ?
     ORDER BY round_number ASC LIMIT 1`,
    { companyId, roundNumber: currentRound.round_number + 1 },
  );

  if (!nextRound) {
    res.status(400).json({ success: false, error: 'No next round exists. This is the final round.' });
    return;
  }

  // Auto-assign to interviewer in next round's pool (load-balanced)
  const candidates = getMany<{ id: string }>(
    `SELECT i.id FROM interviewers i
     JOIN interviewer_rounds ir ON i.id = ir.interviewer_id
     WHERE ir.round_id = ?
     ORDER BY (
       SELECT COUNT(*) FROM applications a
       WHERE a.assigned_interviewer_id = i.id
         AND a.current_round_id = ?
         AND a.status NOT IN ('approved', 'rejected')
     ) ASC`,
    { roundId: nextRound.id },
  );

  transaction(() => {
    run(
      `UPDATE applications
       SET current_round_id = ?, status = 'queued', updated_at = datetime('now')
       WHERE id = ?`,
      { currentRoundId: nextRound.id, applicationId: applicantId },
    );

    if (candidates.length > 0) {
      run(
        `UPDATE applications SET assigned_interviewer_id = ?, updated_at = datetime('now') WHERE id = ?`,
        { interviewerId: candidates[0].id, applicationId: applicantId },
      );
    }
  });

  res.json({
    success: true,
    message: 'Applicant advanced to next round',
    data: {
      applicantId,
      previousRoundId: id,
      newRoundId: nextRound.id,
      newRoundNumber: nextRound.round_number,
      assignedInterviewerId: candidates[0]?.id || null,
    },
  });
});

export default router;
