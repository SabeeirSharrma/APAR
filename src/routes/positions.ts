import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getOne, getMany, run } from '../db/index.js';

const router = Router();

// GET /api/v1/positions - List all positions for a company
router.get('/', async (req: Request, res: Response) => {
  const { companyId } = req.query;

  if (!companyId) {
    res.status(400).json({ success: false, error: 'Missing required query param: companyId' });
    return;
  }

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

// GET /api/v1/positions/:id - Get position details with interviewers
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

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
    'SELECT * FROM positions WHERE id = ?',
    { id },
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

// POST /api/v1/positions - Create a new position
router.post('/', async (req: Request, res: Response) => {
  const { companyId, name, description, criteria } = req.body;

  if (!companyId || !name || !criteria) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: companyId, name, criteria',
    });
    return;
  }

  // Verify company exists
  const company = getOne<{ id: string }>('SELECT id FROM companies WHERE id = ?', { companyId });
  if (!company) {
    res.status(404).json({ success: false, error: 'Company not found' });
    return;
  }

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

// PATCH /api/v1/positions/:id - Update position
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, criteria } = req.body;

  const existing = getOne<{ id: string }>('SELECT id FROM positions WHERE id = ?', { id });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Position not found' });
    return;
  }

  const updates: string[] = [];
  const params: Record<string, unknown> = { id };

  if (name !== undefined) { updates.push('name = @name'); params.name = name; }
  if (description !== undefined) { updates.push('description = @description'); params.description = description; }
  if (criteria !== undefined) { updates.push('criteria = @criteria'); params.criteria = criteria; }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    run(`UPDATE positions SET ${updates.join(', ')} WHERE id = @id`, params);
  }

  res.json({ success: true, message: 'Position updated', data: { id, ...(name && { name }), ...(criteria && { criteria }) } });
});

// DELETE /api/v1/positions/:id - Delete position
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = getOne<{ id: string }>('SELECT id FROM positions WHERE id = ?', { id });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Position not found' });
    return;
  }

  run('DELETE FROM positions WHERE id = ?', { id });
  res.json({ success: true, message: 'Position deleted' });
});

// POST /api/v1/positions/:id/interviewers - Assign interviewer to position
router.post('/:id/interviewers', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { interviewerId } = req.body;

  if (!interviewerId) {
    res.status(400).json({ success: false, error: 'Missing required field: interviewerId' });
    return;
  }

  const position = getOne<{ id: string }>('SELECT id FROM positions WHERE id = ?', { id });
  if (!position) {
    res.status(404).json({ success: false, error: 'Position not found' });
    return;
  }

  const interviewer = getOne<{ id: string }>('SELECT id FROM interviewers WHERE id = ?', { interviewerId });
  if (!interviewer) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  run(
    'INSERT OR IGNORE INTO interviewer_positions (interviewer_id, position_id) VALUES (?, ?)',
    { interviewerId, positionId: id },
  );

  res.json({ success: true, message: 'Interviewer assigned to position', data: { positionId: id, interviewerId } });
});

// DELETE /api/v1/positions/:id/interviewers/:interviewerId - Remove interviewer from position
router.delete('/:id/interviewers/:interviewerId', async (req: Request, res: Response) => {
  const { id, interviewerId } = req.params;

  run(
    'DELETE FROM interviewer_positions WHERE position_id = ? AND interviewer_id = ?',
    { positionId: id, interviewerId },
  );

  res.json({ success: true, message: 'Interviewer removed from position' });
});

export default router;
