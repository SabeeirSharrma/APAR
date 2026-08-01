import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { run, getOne } from '../db/index.js';
import { runPipeline, getPipelineStatus } from '../lib/pipeline.js';
import { sendUploadConfirmation } from '../lib/email.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// File filter — only PDFs
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'));
  }
};

// Configure upload
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

// POST /api/v1/upload — Upload a resume and trigger pipeline (public, no auth required for applicant-facing endpoint)
router.post('/', uploadLimiter, upload.single('resume'), async (req: Request, res: Response) => {
  try {
    const positionId = req.body.positionId as string;
    const applicantEmail = req.body.applicantEmail as string;
    const applicantName = req.body.applicantName as string;
    const supplementaryInfo = req.body.supplementaryInfo as string | undefined;

    if (!positionId || !applicantEmail || !applicantName) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: positionId, applicantEmail, applicantName',
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No resume file uploaded',
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(applicantEmail)) {
      res.status(400).json({ success: false, error: 'Invalid email address' });
      return;
    }

    // Verify position exists and get company_id
    interface PositionLookup {
      id: string;
      company_id: string;
    }
    const position = getOne<PositionLookup>(
      'SELECT id, company_id FROM positions WHERE id = @positionId',
      { positionId },
    );

    if (!position) {
      res.status(404).json({ success: false, error: 'Position not found' });
      return;
    }

    // Create application record (§4 step 1-2)
    const applicationId = randomUUID();
    run(
      `INSERT INTO applications (id, position_id, company_id, email, name, resume_path, supplementary_info, status)
       VALUES (@applicationId, @positionId, @companyId, @email, @name, @resumePath, @supplementaryInfo, 'queued')`,
      {
        applicationId,
        positionId: position.id,
        companyId: position.company_id,
        email: applicantEmail,
        name: applicantName,
        resumePath: req.file.path,
        supplementaryInfo: supplementaryInfo || null,
      },
    );

    // Return immediate response
    res.status(202).json({
      success: true,
      message: 'Resume uploaded, processing started',
      data: {
        applicationId,
        positionId,
        applicantEmail,
        applicantName,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        status: 'queued',
      },
    });

    // Send confirmation email to applicant (#5) — fire-and-forget
    sendUploadConfirmation(
      applicationId,
      position.company_id,
      positionId,
      applicantEmail,
      applicantName,
    ).catch((err) => console.error('Failed to send upload confirmation email:', err));

    // Run pipeline asynchronously (fire-and-forget)
    runPipeline({
      applicationId,
      companyId: position.company_id,
      positionId: position.id,
      resumePath: req.file.path,
      applicantEmail,
      applicantName,
      supplementaryInfo,
    }).catch((err) => {
      console.error(`Pipeline failed for ${applicationId}:`, err);
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload resume' });
  }
});

// GET /api/v1/upload/status/:applicationId — Check pipeline status
router.get('/status/:applicationId', async (req: Request, res: Response) => {
  const applicationId = req.params.applicationId as string;

  const status = getPipelineStatus(applicationId);

  if (!status) {
    res.status(404).json({ success: false, error: 'Application not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      applicationId,
      ...status,
    },
  });
});

export default router;
