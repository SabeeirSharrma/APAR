import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

// GET /api/v1/setup/status - Get setup wizard status
router.get('/status', async (req: Request, res: Response) => {
  // TODO: Check setup completion status
  res.json({
    success: true,
    data: {
      isComplete: false,
      steps: [
        { step: 1, name: 'Company Registration', isCompleted: false },
        { step: 2, name: 'Database Setup', isCompleted: false },
        { step: 3, name: 'Branding', isCompleted: false },
        { step: 4, name: 'Model Provider', isCompleted: false },
        { step: 5, name: 'Interviewer Provisioning', isCompleted: false },
      ],
    },
  });
});

// POST /api/v1/setup/register - Register company (Step 1)
router.post('/register', async (req: Request, res: Response) => {
  const { name, adminEmail, adminName } = req.body;

  if (!name || !adminEmail || !adminName) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: name, adminEmail, adminName',
    });
    return;
  }

  // TODO: Create company and admin in database
  res.status(201).json({
    success: true,
    message: 'Company registered',
    data: {
      companyId: randomUUID(),
      name,
      adminEmail,
      adminName,
    },
  });
});

// POST /api/v1/setup/database - Configure database (Step 2)
router.post('/database', async (req: Request, res: Response) => {
  const { backend, connectionString } = req.body;

  if (!backend) {
    res.status(400).json({
      success: false,
      error: 'Missing required field: backend',
    });
    return;
  }

  const validBackends = ['sqlite', 'redis', 'supabase', 'firebase', 'mongodb', 'custom'];
  if (!validBackends.includes(backend)) {
    res.status(400).json({
      success: false,
      error: `Invalid backend. Must be one of: ${validBackends.join(', ')}`,
    });
    return;
  }

  // TODO: Store database configuration
  res.json({
    success: true,
    message: 'Database configured',
    data: {
      backend,
      configured: true,
    },
  });
});

// POST /api/v1/setup/branding - Configure branding (Step 3)
router.post('/branding', async (req: Request, res: Response) => {
  const { name, themeStyle, primaryColor, logoUrl } = req.body;

  if (!name || !themeStyle) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: name, themeStyle',
    });
    return;
  }

  // TODO: Store branding configuration
  res.json({
    success: true,
    message: 'Branding configured',
    data: {
      name,
      themeStyle,
      primaryColor,
      logoUrl,
    },
  });
});

// POST /api/v1/setup/model-provider - Configure model provider (Step 4)
router.post('/model-provider', async (req: Request, res: Response) => {
  const { role, provider, endpointUrl, apiKey, modelName } = req.body;

  if (!role || !provider || !modelName) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: role, provider, modelName',
    });
    return;
  }

  if (!['main', 'verification'].includes(role)) {
    res.status(400).json({
      success: false,
      error: 'Role must be "main" or "verification"',
    });
    return;
  }

  if (!['openrouter', 'openai-compatible'].includes(provider)) {
    res.status(400).json({
      success: false,
      error: 'Provider must be "openrouter" or "openai-compatible"',
    });
    return;
  }

  // TODO: Store model provider configuration
  // TODO: Validate API key or endpoint
  res.json({
    success: true,
    message: 'Model provider configured',
    data: {
      role,
      provider,
      modelName,
      configured: true,
    },
  });
});

// POST /api/v1/setup/interviewer - Provision an interviewer (Step 5)
router.post('/interviewer', async (req: Request, res: Response) => {
  const { email, name, positionIds, roundIds } = req.body;

  if (!email || !name || !positionIds?.length) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: email, name, positionIds',
    });
    return;
  }

  // TODO: Create interviewer account
  // TODO: Generate soft-lock artifact
  // TODO: Assign to positions and rounds
  res.status(201).json({
    success: true,
    message: 'Interviewer provisioned',
    data: {
      interviewerId: randomUUID(),
      email,
      name,
      positionIds,
      roundIds,
      clientDownloadUrl: '/api/v1/setup/interviewer/download',
    },
  });
});

// GET /api/v1/setup/interviewer/download/:id - Download client app
router.get('/interviewer/download/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Generate soft-locked client package
  // TODO: Return download link
  res.json({
    success: true,
    message: 'Client package ready',
    data: {
      downloadUrl: `/downloads/client-${id}.zip`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

export default router;
