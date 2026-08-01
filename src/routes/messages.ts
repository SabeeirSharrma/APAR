import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getOne, getMany, run } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { sendMessageSchema } from '../lib/validation.js';
import { sendMessagNotificationEmail } from '../lib/email.js';

const router = Router();

// All message routes require auth
router.use(requireAuth);

// GET /api/v1/messages/:applicantId — Get all messages for an applicant
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

  interface MessageRow {
    id: string;
    sender_type: string;
    sender_id: string;
    content: string;
    created_at: string;
  }

  const messages = getMany<MessageRow>(
    `SELECT id, sender_type, sender_id, content, created_at
     FROM messages
     WHERE application_id = @applicationId
     ORDER BY created_at ASC`,
    { applicationId: applicantId },
  );

  // Enrich sender info — anonymize interviewer names for non-admins
  const isAdmin = req.auth!.role === 'company_admin';
  const enriched = messages.map((m) => {
    let senderName = 'Unknown';
    if (m.sender_type === 'interviewer') {
      if (isAdmin) {
        // Admin sees real interviewer name for accountability
        const interviewer = getOne<{ name: string }>(
          'SELECT name FROM interviewers WHERE id = @id',
          { id: m.sender_id },
        );
        senderName = interviewer?.name || 'Interviewer';
      } else {
        // Interviewer sees anonymized name
        senderName = 'Interviewer';
      }
    } else {
      // Applicant sender — use the application's name
      senderName = app ? getOne<{ name: string }>('SELECT name FROM applications WHERE id = @id', { id: applicantId })?.name || 'Applicant' : 'Applicant';
    }
    return { ...m, senderName };
  });

  res.json({ success: true, data: enriched });
});

// POST /api/v1/messages — Send a message (interviewer → applicant)
router.post('/', async (req: Request, res: Response) => {
  const result = sendMessageSchema.safeParse({
    ...req.body,
    interviewerId: req.auth!.userId,
  });
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { applicantId, interviewerId, content } = result.data;
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

  // Verify interviewer belongs to this company
  const interviewer = getOne<{ id: string }>(
    'SELECT id FROM interviewers WHERE id = @id AND company_id = @companyId',
    { id: interviewerId, companyId },
  );
  if (!interviewer) {
    res.status(404).json({ success: false, error: 'Interviewer not found' });
    return;
  }

  // Verify interviewer is assigned to this applicant
  const assignment = getOne<{ id: string }>(
    'SELECT id FROM applications WHERE id = @id AND assigned_interviewer_id = @interviewerId',
    { id: applicantId, interviewerId },
  );
  if (!assignment) {
    res.status(403).json({
      success: false,
      error: 'You can only message applicants assigned to you',
    });
    return;
  }

  const messageId = randomUUID();
  run(
    `INSERT INTO messages (id, application_id, sender_type, sender_id, content)
     VALUES (@id, @applicationId, 'interviewer', @senderId, @content)`,
    { id: messageId, applicationId: applicantId, senderId: interviewerId, content },
  );

  // Send email notification to applicant via company's submission email (§13)
  sendMessagNotificationEmail(applicantId, content.slice(0, 200)).catch(
    (err) => console.error('Failed to send message notification email:', err),
  );

  res.status(201).json({
    success: true,
    message: 'Message sent',
    data: {
      id: messageId,
      applicantId,
      senderType: 'interviewer',
      content,
      createdAt: new Date().toISOString(),
    },
  });
});

export default router;
