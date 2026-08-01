import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getOne, getMany, run, transaction } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createInterviewerSchema, updateInterviewerSchema } from '../lib/validation.js';
import { generateKeyPair, generateInterviewerKey, storeInterviewerKey, resetInterviewerKey } from '../lib/encryption.js';
import { hashPassword } from '../lib/auth.js';

const router = Router();

// All interviewer routes require auth
router.use(requireAuth);

// GET /api/v1/interviewers — List all interviewers for a company
router.get('/', async (req: Request, res: Response) => {
  const { companyId } = req.auth!;
  const { positionId, roundId } = req.query;

  let sql = `
    SELECT DISTINCT i.id, i.email, i.name, i.created_at, i.updated_at
    FROM interviewers i
    WHERE i.company_id = @companyId
  `;
  const params: Record<string, unknown> = { companyId };

  if (positionId) {
    sql += ` AND EXISTS (SELECT 1 FROM interviewer_positions ip WHERE ip.interviewer_id = i.id AND ip.position_id = @positionId)`;
    params.positionId = positionId;
  }

  if (roundId) {
    sql += ` AND EXISTS (SELECT 1 FROM interviewer_rounds ir WHERE ir.interviewer_id = i.id AND ir.round_id = @roundId)`;
    params.roundId = roundId;
  }

  sql += ` ORDER BY i.name ASC`;

  const interviewers = getMany<{
    id: string;
    email: string;
    name: string;
    created_at: string;
    updated_at: string;
  }>(sql, params);

  // Enrich with position count and workload
  const enriched = interviewers.map((i) => {
    const posCount = getOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM interviewer_positions WHERE interviewer_id = @id',
      { id: i.id },
    );
    const workload = getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM applications
       WHERE assigned_interviewer_id = @id AND status NOT IN ('approved', 'rejected')`,
      { id: i.id },
    );
    return {
      ...i,
      positionCount: posCount?.count ?? 0,
      currentWorkload: workload?.count ?? 0,
    };
  });

  res.json({ success: true, data: enriched });
});

// GET /api/v1/interviewers/:id — Get interviewer details with workload
router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyId } = req.auth!;

  const interviewer = getOne<{
    id: string;
    email: string;
    name: string;
    public_key: string;
    created_at: string;
    updated_at: string;
  }>(
    'SELECT id, email, name, public_key, created_at, updated_at FROM interviewers WHERE id = @id AND company_id = @companyId',
    { id, companyId },
  );

  if (!interviewer) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  // Get assigned positions
  const positions = getMany<{ id: string; name: string }>(
    `SELECT p.id, p.name FROM positions p
     JOIN interviewer_positions ip ON p.id = ip.position_id
     WHERE ip.interviewer_id = @id`,
    { id },
  );

  // Get assigned rounds
  const rounds = getMany<{ id: string; name: string; round_number: number }>(
    `SELECT r.id, r.name, r.round_number FROM rounds r
     JOIN interviewer_rounds ir ON r.id = ir.round_id
     WHERE ir.interviewer_id = @id`,
    { id },
  );

  // Get workload per position
  const workload = getMany<{ position_id: string; position_name: string; count: number }>(
    `SELECT a.position_id, p.name as position_name, COUNT(*) as count
     FROM applications a
     JOIN positions p ON a.position_id = p.id
     WHERE a.assigned_interviewer_id = @id
        AND a.status NOT IN ('approved', 'rejected')
     GROUP BY a.position_id`,
    { id },
  );

  const totalWorkload = workload.reduce((sum, w) => sum + w.count, 0);

  res.json({
    success: true,
    data: {
      ...interviewer,
      positions,
      rounds,
      workload,
      totalWorkload,
    },
  });
});

// POST /api/v1/interviewers — Create/provision a new interviewer
router.post('/', requireRole('company_admin'), async (req: Request, res: Response) => {
  const result = createInterviewerSchema.safeParse({ ...req.body, companyId: req.auth!.companyId });
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, name, positionIds, roundIds } = result.data;
  const companyId = req.auth!.companyId;

  // Check for duplicate email
  const existing = getOne<{ id: string }>(
    'SELECT id FROM interviewers WHERE company_id = @companyId AND email = @email',
    { companyId, email },
  );
  if (existing) {
    res.status(409).json({
      success: false,
      error: 'An interviewer with this email already exists in this company',
    });
    return;
  }

  // Generate password for the interviewer (they'll use email + password to login)
  const tempPassword = randomUUID().slice(0, 12);
  const passwordHash = hashPassword(tempPassword);

  // Generate encryption keypair (§6)
  const { publicKey, privateKey } = generateKeyPair();

  const interviewerId = randomUUID();

  transaction(() => {
    // Create interviewer
    run(
      `INSERT INTO interviewers (id, company_id, email, name, password_hash, public_key)
       VALUES (@id, @companyId, @email, @name, @password_hash, @public_key)`,
      { id: interviewerId, companyId, email, name, password_hash: passwordHash, public_key: publicKey },
    );

    // Generate and store per-interviewer encryption key (§2: key hierarchy)
    const interviewerEncryptionKey = generateInterviewerKey();
    storeInterviewerKey(interviewerId, companyId, interviewerEncryptionKey);

    // Assign to positions
    for (const positionId of positionIds) {
      run(
        'INSERT OR IGNORE INTO interviewer_positions (interviewer_id, position_id) VALUES (@interviewerId, @positionId)',
        { interviewerId, positionId },
      );
    }

    // Assign to rounds if provided
    if (roundIds) {
      for (const roundId of roundIds) {
        run(
          'INSERT OR IGNORE INTO interviewer_rounds (interviewer_id, round_id) VALUES (@interviewerId, @roundId)',
          { interviewerId, roundId },
        );
      }
    }

    // Create soft-lock artifact (§9.1) — encrypted config
    const softLockConfig = {
      companyId,
      interviewerId,
      publicKey,
      privateKey, // This would be encrypted in production
      createdAt: new Date().toISOString(),
    };
    run(
      `INSERT INTO client_soft_lock_artifacts (id, interviewer_id, encrypted_config)
       VALUES (@id, @interviewerId, @encrypted_config)`,
      { id: randomUUID(), interviewerId, encrypted_config: JSON.stringify(softLockConfig) },
    );
  });

  res.status(201).json({
    success: true,
    message: 'Interviewer provisioned successfully',
    data: {
      interviewerId,
      email,
      name,
      tempPassword, // In production, this would be sent via email, not returned in response
      positionIds,
      roundIds,
      publicKey,
    },
  });
});

// PATCH /api/v1/interviewers/:id — Update interviewer details
router.patch('/:id', requireRole('company_admin'), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyId } = req.auth!;

  const result = updateInterviewerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const existing = getOne<{ id: string }>(
    'SELECT id FROM interviewers WHERE id = @id AND company_id = @companyId',
    { id, companyId },
  );
  if (!existing) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  const { email, name } = result.data;
  const updates: string[] = [];
  const params: Record<string, unknown> = { id };

  if (email !== undefined) {
    // Check for duplicate email
    const dup = getOne<{ id: string }>(
      'SELECT id FROM interviewers WHERE company_id = @companyId AND email = @email AND id != @id',
      { companyId, email, id },
    );
    if (dup) {
      res.status(409).json({ success: false, error: 'Email already in use by another interviewer' });
      return;
    }
    updates.push('email = @email');
    params.email = email;
  }
  if (name !== undefined) { updates.push('name = @name'); params.name = name; }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    run(`UPDATE interviewers SET ${updates.join(', ')} WHERE id = @id`, params);
  }

  res.json({ success: true, message: 'Interviewer updated', data: { id, ...(email && { email }), ...(name && { name }) } });
});

// DELETE /api/v1/interviewers/:id — Delete interviewer and reassign applicants
router.delete('/:id', requireRole('company_admin'), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyId } = req.auth!;

  const interviewer = getOne<{ id: string }>(
    'SELECT id FROM interviewers WHERE id = @id AND company_id = @companyId',
    { id, companyId },
  );
  if (!interviewer) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  // Find all active applicants assigned to this interviewer
  const activeApps = getMany<{ id: string; position_id: string }>(
    `SELECT id, position_id FROM applications
     WHERE assigned_interviewer_id = @id
        AND status NOT IN ('approved', 'rejected')`,
    { id },
  );

  transaction(() => {
    // Reassign each applicant using load-balanced auto-assignment (§4 step 3)
    for (const app of activeApps) {
      // Find available interviewers for this position, ordered by workload
      const candidates = getMany<{ id: string }>(
        `SELECT i.id FROM interviewers i
         JOIN interviewer_positions ip ON i.id = ip.interviewer_id
         WHERE ip.position_id = @positionId AND i.id != @excludeId
         ORDER BY (
           SELECT COUNT(*) FROM applications a
           WHERE a.assigned_interviewer_id = i.id
             AND a.position_id = @positionId
             AND a.status NOT IN ('approved', 'rejected')
         ) ASC`,
        { positionId: app.position_id, excludeId: id },
      );

      if (candidates.length > 0) {
        run(
          `UPDATE applications SET assigned_interviewer_id = @interviewerId, updated_at = datetime('now') WHERE id = @applicationId`,
          { interviewerId: candidates[0].id, applicationId: app.id },
        );
      }
      // If no candidates, applicant stays with null interviewer (held in queue)
    }

    // Remove interviewer from positions and rounds
    run('DELETE FROM interviewer_positions WHERE interviewer_id = @id', { id });
    run('DELETE FROM interviewer_rounds WHERE interviewer_id = @id', { id });

    // Delete the interviewer
    run('DELETE FROM interviewers WHERE id = @id', { id });
  });

  res.json({
    success: true,
    message: 'Interviewer deleted and applicants reassigned',
    data: { deletedId: id, reassignedCount: activeApps.length },
  });
});

// POST /api/v1/interviewers/:id/positions — Assign interviewer to position
router.post('/:id/positions', requireRole('company_admin'), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyId } = req.auth!;
  const { positionId } = req.body;

  if (!positionId) {
    res.status(400).json({ success: false, error: 'Missing required field: positionId' });
    return;
  }

  const interviewer = getOne<{ id: string }>(
    'SELECT id FROM interviewers WHERE id = @id AND company_id = @companyId',
    { id, companyId },
  );
  if (!interviewer) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  const position = getOne<{ id: string }>(
    'SELECT id FROM positions WHERE id = @positionId AND company_id = @companyId',
    { positionId, companyId },
  );
  if (!position) {
    res.status(404).json({ success: false, error: 'Position not found' });
    return;
  }

  run(
    'INSERT OR IGNORE INTO interviewer_positions (interviewer_id, position_id) VALUES (@interviewerId, @positionId)',
    { interviewerId: id, positionId },
  );

  res.json({ success: true, message: 'Interviewer assigned to position', data: { interviewerId: id, positionId } });
});

// DELETE /api/v1/interviewers/:id/positions/:positionId — Remove interviewer from position
router.delete('/:id/positions/:positionId', requireRole('company_admin'), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const positionId = req.params.positionId as string;
  const { companyId } = req.auth!;

  // Verify interviewer belongs to company
  const interviewer = getOne<{ id: string }>(
    'SELECT id FROM interviewers WHERE id = @id AND company_id = @companyId',
    { id, companyId },
  );
  if (!interviewer) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  run(
    'DELETE FROM interviewer_positions WHERE position_id = @positionId AND interviewer_id = @interviewerId',
    { positionId, interviewerId: id },
  );

  // Reassign applicants from this interviewer in this position to others
  const affectedApps = getMany<{ id: string }>(
    `SELECT id FROM applications
     WHERE assigned_interviewer_id = @interviewerId AND position_id = @positionId
        AND status NOT IN ('approved', 'rejected')`,
    { id, positionId },
  );

  for (const app of affectedApps) {
    const candidates = getMany<{ id: string }>(
      `SELECT i.id FROM interviewers i
       JOIN interviewer_positions ip ON i.id = ip.interviewer_id
       WHERE ip.position_id = @positionId AND i.id != @excludeId
       ORDER BY (
         SELECT COUNT(*) FROM applications a
         WHERE a.assigned_interviewer_id = i.id
           AND a.position_id = @positionId
           AND a.status NOT IN ('approved', 'rejected')
       ) ASC`,
      { positionId, excludeId: id },
    );

    if (candidates.length > 0) {
      run(
        `UPDATE applications SET assigned_interviewer_id = @interviewerId, updated_at = datetime('now') WHERE id = @applicationId`,
        { interviewerId: candidates[0].id, applicationId: app.id },
      );
    }
  }

  res.json({
    success: true,
    message: 'Interviewer removed from position',
    data: { reassignedCount: affectedApps.length },
  });
});

// GET /api/v1/interviewers/:id/workload — Get interviewer's current workload per position
router.get('/:id/workload', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyId } = req.auth!;

  const interviewer = getOne<{ id: string }>(
    'SELECT id FROM interviewers WHERE id = @id AND company_id = @companyId',
    { id, companyId },
  );
  if (!interviewer) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  const workload = getMany<{ position_id: string; position_name: string; assigned_count: number }>(
    `SELECT a.position_id, p.name as position_name, COUNT(*) as assigned_count
     FROM applications a
     JOIN positions p ON a.position_id = p.id
     WHERE a.assigned_interviewer_id = @id
        AND a.status NOT IN ('approved', 'rejected')
     GROUP BY a.position_id`,
    { id },
  );

  const totalAssigned = workload.reduce((sum, w) => sum + w.assigned_count, 0);

  res.json({
    success: true,
    data: {
      interviewerId: id,
      positions: workload,
      totalAssigned,
    },
  });
});

// GET /api/v1/interviewers/:id/assigned-applicants — List applicants assigned to this interviewer
router.get('/:id/assigned-applicants', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyId } = req.auth!;
  const { status, page = '1', pageSize = '20' } = req.query;

  const interviewer = getOne<{ id: string }>(
    'SELECT id FROM interviewers WHERE id = @id AND company_id = @companyId',
    { id, companyId },
  );
  if (!interviewer) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  const limit = Math.min(parseInt(pageSize as string) || 20, 100);
  const offset = ((parseInt(page as string) || 1) - 1) * limit;

  let where = 'a.assigned_interviewer_id = @interviewerId';
  const params: Record<string, unknown> = { interviewerId: id };

  if (status) {
    where += ' AND a.status = @status';
    params.status = status;
  }

  const countRow = getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications a WHERE ${where}`,
    params,
  );
  const total = countRow?.count ?? 0;

  const items = getMany<{
    id: string;
    email: string;
    name: string;
    status: string;
    position_name: string;
    created_at: string;
  }>(
    `SELECT a.id, a.email, a.name, a.status, p.name as position_name, a.created_at
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

// POST /api/v1/interviewers/:id/reset-key — Reset interviewer's encryption key (#2)
router.post('/:id/reset-key', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyId } = req.auth!;

  // Verify interviewer exists and belongs to this company
  const interviewer = getOne<{ id: string }>(
    'SELECT id FROM interviewers WHERE id = @id AND company_id = @companyId',
    { id, companyId },
  );
  if (!interviewer) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  // Reset the interviewer's encryption key (§2: admin recovery)
  const newKey = resetInterviewerKey(id, companyId);

  res.json({
    success: true,
    message: 'Interviewer encryption key has been reset. Old results remain encrypted with the previous key.',
    data: {
      interviewerId: id,
      newKeyPreview: `${newKey.slice(0, 4)}...${newKey.slice(-4)}`, // Show partial key for confirmation
    },
  });
});

export default router;
