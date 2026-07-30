import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

// GET /api/v1/rounds - List all rounds for a company
router.get('/', async (req: Request, res: Response) => {
  const { positionId } = req.query;

  // TODO: Query rounds from database
  res.json({
    success: true,
    data: [],
  });
});

// GET /api/v1/rounds/:id - Get round details with assigned interviewers
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Look up round with interviewers
  res.json({
    success: true,
    data: {
      id,
      roundNumber: 1,
      name: 'Initial Screening',
      interviewers: [],
    },
  });
});

// POST /api/v1/rounds - Create a new round
router.post('/', async (req: Request, res: Response) => {
  const { roundNumber, name, description, positionId } = req.body;

  if (!roundNumber || !name) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: roundNumber, name',
    });
    return;
  }

  // TODO: Create round in database
  res.status(201).json({
    success: true,
    message: 'Round created',
    data: {
      id: randomUUID(),
      roundNumber,
      name,
      description,
      positionId,
      createdAt: new Date().toISOString(),
    },
  });
});

// PATCH /api/v1/rounds/:id - Update a round
router.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { roundNumber, name, description } = req.body;

  // TODO: Update round in database
  res.json({
    success: true,
    message: 'Round updated',
    data: {
      id,
      ...(roundNumber && { roundNumber }),
      ...(name && { name }),
      ...(description && { description }),
      updatedAt: new Date().toISOString(),
    },
  });
});

// DELETE /api/v1/rounds/:id - Delete a round
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Delete round from database
  // TODO: Reassign interviewers to other rounds or remove assignments
  res.json({
    success: true,
    message: 'Round deleted',
  });
});

// POST /api/v1/rounds/:id/interviewers - Assign interviewer to round
router.post('/:id/interviewers', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { interviewerId } = req.body;

  if (!interviewerId) {
    res.status(400).json({
      success: false,
      error: 'Missing required field: interviewerId',
    });
    return;
  }

  // TODO: Add interviewer to round in database
  res.json({
    success: true,
    message: 'Interviewer assigned to round',
    data: {
      roundId: id,
      interviewerId,
    },
  });
});

// DELETE /api/v1/rounds/:id/interviewers/:interviewerId - Remove interviewer from round
router.delete('/:id/interviewers/:interviewerId', async (req: Request, res: Response) => {
  const { id, interviewerId } = req.params;

  // TODO: Remove interviewer from round in database
  res.json({
    success: true,
    message: 'Interviewer removed from round',
  });
});

// POST /api/v1/rounds/:id/applicants/:applicantId/advance - Advance applicant to next round
router.post('/:id/applicants/:applicantId/advance', async (req: Request, res: Response) => {
  const { id, applicantId } = req.params;

  // TODO: Look up current round number
  // TODO: Find next round (roundNumber + 1)
  // TODO: Update applicant's currentRound
  // TODO: Auto-assign to interviewer in new round's pool
  res.json({
    success: true,
    message: 'Applicant advanced to next round',
    data: {
      applicantId,
      previousRoundId: id,
      newRoundNumber: 2,
    },
  });
});

export default router;
