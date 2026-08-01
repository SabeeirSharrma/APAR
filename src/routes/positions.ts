import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getOne, getMany, run } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createPositionSchema, updatePositionSchema } from '../lib/validation.js';

const router = Router();

// All position routes require auth
router.use(requireAuth);

// GET /api/v1/positions — List all positions for a company
router.get('/', async (req: Request, res: Response) => {
  const { companyId } = req.auth!;

  interface PositionRow {
    id: string;
    name: string;
    description: string | null;
    criteria: string;
    created_at: string;
    applicant_count: number;
  }

  const positions = getMany<PositionRow>(
    `SELECT p.*,
       (SELECT COUNT(*) FROM applications a WHERE a.position_id = p.id) as applicant_count
     FROM positions p
     WHERE p.company_id = ?
     ORDER BY p.created_at DESC`,
    { companyId },
  );

  res.json({ success: true, data: positions });
});

// GET /api/v1/positions/:id — Get position details with interviewers
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.auth!;

  interface PositionDetailRow {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    criteria: string;
    created_at: string;
    updated_at: string;
  }

  const position = getOne<PositionDetailRow>(
    'SELECT * FROM positions WHERE id = ? AND company_id = ?',
    { id, companyId },
  );

  if (!position) {
    res.status(404).json({ success: false, error: 'Position not found' });
    return;
  }

  // Get assigned interviewers
  const interviewers = getMany<{ id: string; email: string; name: string }>(
    `SELECT i.id, i.email, i.name
     FROM interviewers i
     JOIN interviewer_positions ip ON i.id = ip.interviewer_id
     WHERE ip.position_id = ?`,
    { positionId: id },
  );

  // Get applicant count
  const countRow = getOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM applications WHERE position_id = ?',
    { positionId: id },
  );

  res.json({
    success: true,
    data: { ...position, interviewers, applicantCount: countRow?.count ?? 0 },
  });
});

// POST /api/v1/positions — Create a new position
router.post('/', requireRole('company_admin'), async (req: Request, res: Response) => {
  const result = createPositionSchema.safeParse({ ...req.body, companyId: req.auth!.companyId });
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { name, description, criteria } = result.data;
  const companyId = req.auth!.companyId;

  const id = randomUUID();
  run(
    `INSERT INTO positions (id, company_id, name, description, criteria)
     VALUES (?, ?, ?, ?, ?)`,
    { id, companyId, name, description: description || null, criteria },
  );

  res.status(201).json({
    success: true,
    message: 'Position created',
    data: { id, companyId, name, description, criteria, createdAt: new Date().toISOString() },
  });
});

// PATCH /api/v1/positions/:id — Update position
router.patch('/:id', requireRole('company_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.auth!;

  const result = updatePositionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const existing = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM positions WHERE id = ?',
    { id },
  );
  if (!existing || existing.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Position not found' });
    return;
  }

  const { name, description, criteria } = result.data;
  const updates: string[] = [];
  const params: Record<string, unknown> = { id };

  if (name !== undefined) { updates.push('name = @name'); params.name = name; }
  if (description !== undefined) { updates.push('description = @description'); params.description = description; }
  if (criteria !== undefined) { updates.push('criteria = @criteria'); params.criteria = criteria; }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    run(`UPDATE positions SET ${updates.join(', ')} WHERE id = @id`, params);
  }

  res.json({ success: true, message: 'Position updated', data: { id } });
});

// DELETE /api/v1/positions/:id — Delete position
router.delete('/:id', requireRole('company_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.auth!;

  const existing = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM positions WHERE id = ?',
    { id },
  );
  if (!existing || existing.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Position not found' });
    return;
  }

  run('DELETE FROM positions WHERE id = ?', { id });
  res.json({ success: true, message: 'Position deleted' });
});

// POST /api/v1/positions/:id/interviewers — Assign interviewer to position
router.post('/:id/interviewers', requireRole('company_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.auth!;
  const { interviewerId } = req.body;

  if (!interviewerId) {
    res.status(400).json({ success: false, error: 'Missing required field: interviewerId' });
    return;
  }

  const position = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM positions WHERE id = ?',
    { id },
  );
  if (!position || position.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Position not found' });
    return;
  }

  const interviewer = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM interviewers WHERE id = ?',
    { interviewerId },
  );
  if (!interviewer || interviewer.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  run(
    'INSERT OR IGNORE INTO interviewer_positions (interviewer_id, position_id) VALUES (?, ?)',
    { interviewerId, positionId: id },
  );

  res.json({ success: true, message: 'Interviewer assigned to position', data: { positionId: id, interviewerId } });
});

// DELETE /api/v1/positions/:id/interviewers/:interviewerId — Remove interviewer from position
router.delete('/:id/interviewers/:interviewerId', requireRole('company_admin'), async (req: Request, res: Response) => {
  const { id, interviewerId } = req.params;

  run(
    'DELETE FROM interviewer_positions WHERE position_id = ? AND interviewer_id = ?',
    { positionId: id, interviewerId },
  );

  res.json({ success: true, message: 'Interviewer removed from position' });
});

export default router;
