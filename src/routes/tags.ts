import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getOne, getMany, run } from '../db/index.js';

const router = Router();

// GET /api/v1/tags - List all tags (global + local for interviewer)
router.get('/', async (req: Request, res: Response) => {
  const { companyId, scope } = req.query;

  if (!companyId) {
    res.status(400).json({ success: false, error: 'Missing required query param: companyId' });
    return;
  }

  let where = 'company_id = @companyId';
  const params: Record<string, unknown> = { companyId };

  if (scope && ['global', 'local'].includes(scope as string)) {
    where += ' AND scope = @scope';
    params.scope = scope;
  }

  const tags = getMany<{ id: string; name: string; color: string; scope: string; is_approved: number; created_at: string }>(
    `SELECT id, name, color, scope, is_approved, created_at
     FROM tags
     WHERE ${where}
     ORDER BY created_at DESC`,
    params,
  );

  res.json({ success: true, data: tags });
});

// POST /api/v1/tags - Create a new tag
router.post('/', async (req: Request, res: Response) => {
  const { companyId, name, color, scope, createdByInterviewerId } = req.body;

  if (!companyId || !name || !color || !scope) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: companyId, name, color, scope',
    });
    return;
  }

  if (!['global', 'local'].includes(scope)) {
    res.status(400).json({ success: false, error: 'Scope must be "global" or "local"' });
    return;
  }

  const id = randomUUID();
  // Local tags are auto-approved; global tags require admin approval
  const isApproved = scope === 'local' ? 1 : 0;

  run(
    `INSERT INTO tags (id, company_id, name, color, scope, created_by_interviewer_id, is_approved)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    { id, companyId, name, color, scope, createdByInterviewerId: createdByInterviewerId || null, isApproved },
  );

  res.status(201).json({
    success: true,
    message: 'Tag created',
    data: { id, name, color, scope, isApproved: isApproved === 1, createdAt: new Date().toISOString() },
  });
});

// PATCH /api/v1/tags/:id - Update tag
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, color } = req.body;

  const existing = getOne<{ id: string }>('SELECT id FROM tags WHERE id = ?', { id });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Tag not found' });
    return;
  }

  const updates: string[] = [];
  const params: Record<string, unknown> = { id };

  if (name !== undefined) { updates.push('name = @name'); params.name = name; }
  if (color !== undefined) { updates.push('color = @color'); params.color = color; }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    run(`UPDATE tags SET ${updates.join(', ')} WHERE id = @id`, params);
  }

  res.json({ success: true, message: 'Tag updated', data: { id, ...(name && { name }), ...(color && { color }) } });
});

// DELETE /api/v1/tags/:id - Delete tag
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = getOne<{ id: string }>('SELECT id FROM tags WHERE id = ?', { id });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Tag not found' });
    return;
  }

  run('DELETE FROM tags WHERE id = ?', { id });
  res.json({ success: true, message: 'Tag deleted' });
});

// POST /api/v1/tags/:id/approve - Approve a global tag (admin only)
router.post('/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = getOne<{ id: string; scope: string }>('SELECT id, scope FROM tags WHERE id = ?', { id });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Tag not found' });
    return;
  }

  if (existing.scope !== 'global') {
    res.status(400).json({ success: false, error: 'Only global tags can be approved' });
    return;
  }

  run("UPDATE tags SET is_approved = 1, updated_at = datetime('now') WHERE id = ?", { id });
  res.json({ success: true, message: 'Tag approved', data: { tagId: id, isApproved: true } });
});

// POST /api/v1/tags/:id/decline - Decline/delete a global tag (admin only)
router.post('/:id/decline', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = getOne<{ id: string; scope: string }>('SELECT id, scope FROM tags WHERE id = ?', { id });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Tag not found' });
    return;
  }

  run('DELETE FROM tags WHERE id = ?', { id });
  res.json({ success: true, message: 'Tag declined and removed' });
});

export default router;
