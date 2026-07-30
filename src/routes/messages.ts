import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

// GET /api/v1/messages/:applicantId - Get all messages for an applicant
router.get('/:applicantId', async (req: Request, res: Response) => {
  const { applicantId } = req.params;

  // TODO: Query messages for applicant
  res.json({
    success: true,
    data: [],
  });
});

// POST /api/v1/messages - Send a message
router.post('/', async (req: Request, res: Response) => {
  const { applicantId, content } = req.body;

  if (!applicantId || !content) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: applicantId, content',
    });
    return;
  }

  // TODO: Create message in database
  // TODO: Send email via company's submission email address
  res.status(201).json({
    success: true,
    message: 'Message sent',
    data: {
      id: randomUUID(),
      applicantId,
      content,
      senderType: 'interviewer',
      createdAt: new Date().toISOString(),
    },
  });
});

export default router;
