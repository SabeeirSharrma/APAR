import { Router, Request, Response } from 'express';
import { getOne } from '../db/index.js';

const router = Router();

/**
 * GET /api/v1/status/:applicationId — Public applicant status checkpoint (#5)
 * No authentication required. Applicants use their application ID to check status.
 */
router.get('/:applicationId', (req: Request, res: Response) => {
  const applicationId = req.params.applicationId as string;

  interface ApplicationStatusRow {
    id: string;
    status: string;
    created_at: string;
    updated_at: string;
    position_name: string;
    company_name: string;
    assigned_interviewer_name: string | null;
    current_round_name: string | null;
  }

  const app = getOne<ApplicationStatusRow>(
    `SELECT
       a.id,
       a.status,
       a.created_at,
       a.updated_at,
       p.name as position_name,
       c.name as company_name,
       i.name as assigned_interviewer_name,
       r.name as current_round_name
     FROM applications a
     JOIN positions p ON a.position_id = p.id
     JOIN companies c ON a.company_id = c.id
     LEFT JOIN interviewers i ON a.assigned_interviewer_id = i.id
     LEFT JOIN rounds r ON a.current_round_id = r.id
     WHERE a.id = @applicationId`,
    { applicationId },
  );

  if (!app) {
    res.status(404).json({
      success: false,
      error: 'Application not found. Please check your application ID.',
    });
    return;
  }

  // Map status to human-readable message
  const statusMessages: Record<string, string> = {
    queued: 'Your application is in the queue and will be processed shortly.',
    processing: 'Your application is currently being reviewed by our AI system.',
    verifying: 'Your application review is being verified for accuracy.',
    delivered: 'Your application review is complete and has been delivered to the team.',
    'pending-review': 'Your application is pending manual review by an interviewer.',
    approved: 'Your application has been approved! You may hear from us soon.',
    rejected: 'Your application has been reviewed. Please check your email for details.',
  };

  res.json({
    success: true,
    data: {
      applicationId: app.id,
      status: app.status,
      statusMessage: statusMessages[app.status] || 'Status unknown.',
      position: app.position_name,
      company: app.company_name,
      currentRound: app.current_round_name,
      submittedAt: app.created_at,
      lastUpdated: app.updated_at,
    },
  });
});

export default router;
