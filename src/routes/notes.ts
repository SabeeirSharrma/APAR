import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getOne, getMany, run } from '../db/index.js';

const router = Router();

// GET /api/v1/notes/:applicantId - Get all notes for an applicant
router.get('/:applicantId', async (req: Request, res: Response) => {
  const { applicantId } = req.params;

  // Verify application exists
  const app = getOne<{ id: string }>('SELECT id FROM applications WHERE id = ?', { id: applicantId });
  if (!app) {
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
     WHERE n.application_id = ?
     ORDER BY n.created_at DESC`,
    { applicationId: applicantId },
  );

  res.json({ success: true, data: notes });
});

// POST /api/v1/notes - Add a note to an applicant
router.post('/', async (req: Request, res: Response) => {
  const { applicantId, interviewerId, content } = req.body;

  if (!applicantId || !interviewerId || !content) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: applicantId, interviewerId, content',
    });
    return;
  }

  // Verify both exist
  const app = getOne<{ id: string }>('SELECT id FROM applications WHERE id = ?', { id: applicantId });
  if (!app) {
    res.status(404).json({ success: false, error: 'Application not found' });
    return;
  }
  const interviewer = getOne<{ id: string }>('SELECT id FROM interviewers WHERE id = ?', { id: interviewerId });
  if (!interviewer) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  const id = randomUUID();
  run(
    `INSERT INTO notes (id, application_id, interviewer_id, content)
     VALUES (?, ?, ?, ?)`,
    { id, applicationId: applicantId, interviewerId, content },
  );

  res.status(201).json({
    success: true,
    message: 'Note added',
    data: { id, applicantId, interviewerId, content, createdAt: new Date().toISOString() },
  });
});

// PATCH /api/v1/notes/:id - Update a note
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content) {
    res.status(400).json({ success: false, error: 'Missing required field: content' });
    return;
  }

  const existing = getOne<{ id: string }>('SELECT id FROM notes WHERE id = ?', { id });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Note not found' });
    return;
  }

  run("UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ?", { content, id });

  res.json({ success: true, message: 'Note updated', data: { id, content, updatedAt: new Date().toISOString() } });
});

// DELETE /api/v1/notes/:id - Delete a note
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = getOne<{ id: string }>('SELECT id FROM notes WHERE id = ?', { id });
  if (!existing) {
    res.status(404).json({ success: false, error: 'Note not found' });
    return;
  }

  run('DELETE FROM notes WHERE id = ?', { id });
  res.json({ success: true, message: 'Note deleted' });
});

export default router;
