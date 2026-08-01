import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getOne, getMany, run, transaction } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  databaseSetupSchema,
  brandingSetupSchema,
  modelProviderSetupSchema,
  createInterviewerSchema,
} from '../lib/validation.js';
import { generateKeyPair, generateInterviewerKey, storeInterviewerKey, encryptApiKey } from '../lib/encryption.js';
import { hashPassword } from '../lib/auth.js';

const router = Router();

// All setup routes require admin auth
router.use(requireAuth);
router.use(requireRole('company_admin'));

// GET /api/v1/setup/status — Get setup wizard status
router.get('/status', async (req: Request, res: Response) => {
  const { companyId } = req.auth!;

  const setup = getOne<{
    step_database: number;
    step_branding: number;
    step_model_provider: number;
    step_interviewers: number;
    is_complete: number;
  }>(
    'SELECT step_database, step_branding, step_model_provider, step_interviewers, is_complete FROM setup_state WHERE company_id = @companyId',
    { companyId },
  );

  if (!setup) {
    res.status(404).json({ success: false, error: 'Setup state not found. Please register first.' });
    return;
  }

  // Check actual state to determine completion
  const hasDb = getOne<{ id: string }>('SELECT id FROM database_configs WHERE company_id = @companyId', { companyId });
  const hasModel = getOne<{ id: string }>('SELECT id FROM model_provider_configs WHERE company_id = @companyId', { companyId });
  const interviewerCount = getOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM interviewers WHERE company_id = @companyId',
    { companyId },
  );

  const steps = [
    { step: 1, name: 'Company Registration', isCompleted: true }, // Always completed if setup_state exists
    { step: 2, name: 'Database Setup', isCompleted: !!hasDb },
    { step: 3, name: 'Branding', isCompleted: true }, // Branding is set during registration
    { step: 4, name: 'Model Provider', isCompleted: !!hasModel },
    { step: 5, name: 'Interviewer Provisioning', isCompleted: (interviewerCount?.count ?? 0) > 0 },
  ];

  const isComplete = steps.every((s) => s.isCompleted);

  // Update completion status
  run(
    `UPDATE setup_state SET is_complete = @isComplete, updated_at = datetime('now') WHERE company_id = @companyId`,
    { isComplete: isComplete ? 1 : 0, companyId },
  );

  res.json({
    success: true,
    data: {
      isComplete,
      steps,
    },
  });
});

// POST /api/v1/setup/database — Configure database (Step 2)
router.post('/database', async (req: Request, res: Response) => {
  const result = databaseSetupSchema.safeParse({ ...req.body, companyId: req.auth!.companyId });
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { backend, connectionString } = result.data;
  const companyId = req.auth!.companyId;

  // Check if already configured
  const existing = getOne<{ id: string }>(
    'SELECT id FROM database_configs WHERE company_id = @companyId',
    { companyId },
  );

  if (existing) {
    // Update existing config
    run(
      `UPDATE database_configs SET backend = @backend, connection_string = @connectionString, updated_at = datetime('now') WHERE company_id = @companyId`,
      { backend, connectionString: connectionString || null, companyId },
    );
  } else {
    // Create new config
    run(
      `INSERT INTO database_configs (id, company_id, backend, connection_string) VALUES (@id, @companyId, @backend, @connectionString)`,
      { id: randomUUID(), companyId, backend, connectionString: connectionString || null },
    );
  }

  // Update setup state
  run(
    `UPDATE setup_state SET step_database = 1, updated_at = datetime('now') WHERE company_id = @companyId`,
    { companyId },
  );

  res.json({
    success: true,
    message: 'Database configured',
    data: { backend, configured: true },
  });
});

// POST /api/v1/setup/branding — Configure branding (Step 3)
router.post('/branding', async (req: Request, res: Response) => {
  const result = brandingSetupSchema.safeParse({ ...req.body, companyId: req.auth!.companyId });
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { name, themeStyle, primaryColor, logoUrl } = result.data;
  const companyId = req.auth!.companyId;

  run(
    `UPDATE companies
     SET name = @name, theme_style = @themeStyle, primary_color = @primaryColor, logo_url = @logoUrl, updated_at = datetime('now')
     WHERE id = @companyId`,
    { name, themeStyle, primaryColor: primaryColor || null, logoUrl: logoUrl || null, companyId },
  );

  // Update setup state
  run(
    `UPDATE setup_state SET step_branding = 1, updated_at = datetime('now') WHERE company_id = @companyId`,
    { companyId },
  );

  res.json({
    success: true,
    message: 'Branding configured',
    data: { name, themeStyle, primaryColor, logoUrl },
  });
});

// POST /api/v1/setup/model-provider — Configure model provider (Step 4)
router.post('/model-provider', async (req: Request, res: Response) => {
  const result = modelProviderSetupSchema.safeParse({ ...req.body, companyId: req.auth!.companyId });
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { role, provider, endpointUrl, apiKey, modelName } = result.data;
  const companyId = req.auth!.companyId;

  // Encrypt API key at rest (#8) — only for non-empty keys
  const encryptedApiKey = apiKey ? encryptApiKey(apiKey, companyId) : null;

  // Check if this role already has a config
  const existing = getOne<{ id: string }>(
    'SELECT id FROM model_provider_configs WHERE company_id = @companyId AND role = @role',
    { companyId, role },
  );

  if (existing) {
    run(
      `UPDATE model_provider_configs
       SET provider = @provider, endpoint_url = @endpointUrl, api_key = @apiKey, model_name = @modelName, updated_at = datetime('now')
       WHERE company_id = @companyId AND role = @role`,
      { provider, endpointUrl: endpointUrl || null, apiKey: encryptedApiKey, modelName, companyId, role },
    );
  } else {
    run(
      `INSERT INTO model_provider_configs (id, company_id, role, provider, endpoint_url, api_key, model_name)
       VALUES (@id, @companyId, @role, @provider, @endpointUrl, @apiKey, @modelName)`,
      { id: randomUUID(), companyId, role, provider, endpointUrl: endpointUrl || null, apiKey: encryptedApiKey, modelName },
    );
  }

  // Update setup state
  run(
    `UPDATE setup_state SET step_model_provider = 1, updated_at = datetime('now') WHERE company_id = @companyId`,
    { companyId },
  );

  res.json({
    success: true,
    message: 'Model provider configured',
    data: { role, provider, modelName, configured: true },
  });
});

// POST /api/v1/setup/interviewer — Provision an interviewer (Step 5)
router.post('/interviewer', async (req: Request, res: Response) => {
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
      error: 'An interviewer with this email already exists',
    });
    return;
  }

  const interviewerId = randomUUID();
  const tempPassword = randomUUID().slice(0, 12);
  const passwordHash = hashPassword(tempPassword);
  const { publicKey, privateKey } = generateKeyPair();

  transaction(() => {
    run(
      `INSERT INTO interviewers (id, company_id, email, name, password_hash, public_key)
       VALUES (@id, @companyId, @email, @name, @password_hash, @public_key)`,
      { id: interviewerId, companyId, email, name, password_hash: passwordHash, public_key: publicKey },
    );

    // Generate and store per-interviewer encryption key (§2: key hierarchy)
    const interviewerEncryptionKey = generateInterviewerKey();
    storeInterviewerKey(interviewerId, companyId, interviewerEncryptionKey);

    for (const positionId of positionIds) {
      run(
        'INSERT OR IGNORE INTO interviewer_positions (interviewer_id, position_id) VALUES (@interviewerId, @positionId)',
        { interviewerId, positionId },
      );
    }

    if (roundIds) {
      for (const roundId of roundIds) {
        run(
          'INSERT OR IGNORE INTO interviewer_rounds (interviewer_id, round_id) VALUES (@interviewerId, @roundId)',
          { interviewerId, roundId },
        );
      }
    }

    // Create soft-lock artifact
    const softLockConfig = {
      companyId,
      interviewerId,
      publicKey,
      privateKey,
      createdAt: new Date().toISOString(),
    };
    run(
      `INSERT INTO client_soft_lock_artifacts (id, interviewer_id, encrypted_config)
       VALUES (@id, @interviewerId, @encrypted_config)`,
      { id: randomUUID(), interviewerId, encrypted_config: JSON.stringify(softLockConfig) },
    );
  });

  // Update setup state
  run(
    `UPDATE setup_state SET step_interviewers = 1, updated_at = datetime('now') WHERE company_id = @companyId`,
    { companyId },
  );

  res.status(201).json({
    success: true,
    message: 'Interviewer provisioned',
    data: {
      interviewerId,
      email,
      name,
      tempPassword,
      positionIds,
      roundIds,
    },
  });
});

// POST /api/v1/setup/skip-interviewers — Skip interviewer provisioning step (#6)
router.post('/skip-interviewers', async (req: Request, res: Response) => {
  const companyId = req.auth!.companyId;

  run(
    `UPDATE setup_state SET step_interviewers = 1, updated_at = datetime('now') WHERE company_id = @companyId`,
    { companyId },
  );

  res.json({
    success: true,
    message: 'Interviewer provisioning skipped. You can add interviewers later from the admin dashboard.',
    data: { skipped: true },
  });
});

// GET /api/v1/setup/interviewer/download/:id — Download soft-locked client
router.get('/interviewer/download/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { companyId } = req.auth!;

  const artifact = getOne<{ id: string; encrypted_config: string }>(
    `SELECT id, encrypted_config FROM client_soft_lock_artifacts
     WHERE interviewer_id = @interviewerId`,
    { interviewerId: id },
  );

  if (!artifact) {
    res.status(404).json({ success: false, error: 'Client package not found' });
    return;
  }

  // Verify the interviewer belongs to this company
  const interviewer = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM interviewers WHERE id = @id',
    { id },
  );
  if (!interviewer || interviewer.company_id !== companyId) {
    res.status(404).json({ success: false, error: 'Client package not found' });
    return;
  }

  res.json({
    success: true,
    message: 'Client package ready',
    data: {
      downloadUrl: `/downloads/client-${id}.zip`,
      config: JSON.parse(artifact.encrypted_config),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

export default router;
