import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getOne, getMany, run } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { createNoteSchema, updateNoteSchema } from '../lib/validation.js';

const router = Router();

// All note routes require auth
router.use(requireAuth);

// GET /api/v1/notes/:applicantId — Get all notes for an applicant
router.get('/:applicantId', async (req: Request, res: Response) => {
  const applicantId = req.params.applicantId as string;
  const { companyId } = req.auth!;

  // Verify application belongs to the same company
  const app = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM applications WHERE id = @id',
    { id: applicantId },
  );
  if (!app || app.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Application not found' });
    return;
  }

  interface NoteRow {
    id: string;
    interviewer_id: string;
    interviewer_name: string;
    content: string;
    created_at: string;
    updated_at: string;
  }

  const notes = getMany<NoteRow>(
    `SELECT n.id, n.interviewer_id, i.name as interviewer_name, n.content, n.created_at, n.updated_at
     FROM notes n
     JOIN interviewers i ON n.interviewer_id = i.id
     WHERE n.application_id = @applicationId
     ORDER BY n.created_at DESC`,
    { applicationId: applicantId },
  );

  res.json({ success: true, data: notes });
});

// POST /api/v1/notes — Add a note to an applicant
router.post('/', async (req: Request, res: Response) => {
  const { companyId, userId } = req.auth!;

  const result = createNoteSchema.safeParse({ ...req.body, interviewerId: userId });
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { applicantId, interviewerId, content } = result.data;

  // Verify application belongs to company
  const app = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM applications WHERE id = @id',
    { id: applicantId },
  );
  if (!app || app.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Application not found' });
    return;
  }

  // Verify interviewer belongs to company
  const interviewer = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM interviewers WHERE id = @id',
    { id: interviewerId },
  );
  if (!interviewer || interviewer.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  const id = randomUUID();
  run(
    `INSERT INTO notes (id, application_id, interviewer_id, content)
     VALUES (@id, @applicationId, @interviewerId, @content)`,
    { id, applicationId: applicantId, interviewerId, content },
  );

  res.status(201).json({
    success: true,
    message: 'Note added',
    data: { id, applicantId, interviewerId, content, createdAt: new Date().toISOString() },
  });
});

// PATCH /api/v1/notes/:id — Update a note
router.patch('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyId } = req.auth!;

  const result = updateNoteSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, error: 'Validation failed', details: result.error.flatten().fieldErrors });
    return;
  }

  // Verify note belongs to company (via application)
  const existing = getOne<{ id: string; application_id: string }>('SELECT id, application_id FROM notes WHERE id = @id', { id });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Note not found' });
    return;
  }

  const app = getOne<{ company_id: string }>(
    'SELECT company_id FROM applications WHERE id = @id',
    { id: existing.application_id },
  );
  if (!app || app.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Note not found' });
    return;
  }

  const { content } = result.data;
  run("UPDATE notes SET content = @content, updated_at = datetime('now') WHERE id = @id", { content, id });

  res.json({ success: true, message: 'Note updated', data: { id, content, updatedAt: new Date().toISOString() } });
});

// DELETE /api/v1/notes/:id — Delete a note
router.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyId } = req.auth!;

  const existing = getOne<{ id: string; application_id: string }>('SELECT id, application_id FROM notes WHERE id = @id', { id });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Note not found' });
    return;
  }

  const app = getOne<{ company_id: string }>(
    'SELECT company_id FROM applications WHERE id = @id',
    { id: existing.application_id },
  );
  if (!app || app.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Note not found' });
    return;
  }

  run('DELETE FROM notes WHERE id = @id', { id });
  res.json({ success: true, message: 'Note deleted' });
});

export default router;
