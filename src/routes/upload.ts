import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { run, getOne } from '../db/index.js';
import { runPipeline, getPipelineStatus } from '../lib/pipeline.js';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// File filter - only PDFs
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'));
  }
};

// Configure upload
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter,
});

// POST /api/v1/upload - Upload a resume and trigger pipeline
router.post('/', upload.single('resume'), async (req: Request, res: Response) => {
  try {
    const { positionId, applicantEmail, applicantName, supplementaryInfo } = req.body;

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

    // Verify position exists and get company_id
    interface PositionLookup {
      id: string;
      company_id: string;
    }
    const position = getOne<PositionLookup>(
      'SELECT id, company_id FROM positions WHERE id = ?',
      { positionId },
    );

    if (!position) {
      res.status(404).json({
        success: false,
        error: 'Position not found',
      });
      return;
    }

    // Create application record (§4 step 1-2)
    const applicationId = randomUUID();
    run(
      `INSERT INTO applications (id, position_id, company_id, email, name, resume_path, supplementary_info, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'queued')`,
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

    // Return immediate response with application ID
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
    res.status(500).json({
      success: false,
      error: 'Failed to upload resume',
    });
  }
});

// GET /api/v1/upload/status/:applicationId - Check pipeline status
router.get('/status/:applicationId', async (req: Request, res: Response) => {
  const { applicationId } = req.params;

  const status = getPipelineStatus(applicationId);

  if (!status) {
    res.status(404).json({
      success: false,
      error: 'Application not found',
    });
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
