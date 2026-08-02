import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getOne, run, transaction } from '../db/index.js';
import { hashPassword, verifyPassword, generateToken, type TokenPayload } from '../lib/auth.js';
import { registerSchema, loginSchema } from '../lib/validation.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

// POST /api/v1/auth/register — Register a new company (Step 1 of setup)
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { name, adminEmail, adminName, password, submissionEmail } = result.data;

  // Check if admin email already exists
  const existing = getOne<{ id: string }>(
    'SELECT id FROM company_admins WHERE email = @email',
    { email: adminEmail },
  );
  if (existing) {
    res.status(409).json({
      success: false,
      error: 'An account with this email already exists',
    });
    return;
  }

  const companyId = randomUUID();
  const adminId = randomUUID();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Hash password BEFORE the transaction (async, can't be inside sync callback)
  const passwordHash = await hashPassword(password);

  // Create company + admin + setup state in a transaction
  transaction(() => {
    run(
      `INSERT INTO companies (id, name, slug, submission_email) VALUES (@id, @name, @slug, @submissionEmail)`,
      { id: companyId, name, slug, submissionEmail },
    );

    run(
      `INSERT INTO company_admins (id, company_id, email, name, password_hash) VALUES (@id, @companyId, @email, @name, @password_hash)`,
      { id: adminId, companyId, email: adminEmail, name: adminName, password_hash: passwordHash },
    );

    run(
      `INSERT INTO setup_state (id, company_id) VALUES (@id, @companyId)`,
      { id: randomUUID(), companyId },
    );
  });

  // Generate token
  const tokenPayload: TokenPayload = {
    userId: adminId,
    companyId,
    role: 'company_admin',
    email: adminEmail,
  };
  const { token, expiresAt } = generateToken(tokenPayload);

  res.status(201).json({
    success: true,
    message: 'Company registered successfully',
    data: {
      companyId,
      adminId,
      name,
      adminEmail,
      token,
      expiresAt,
    },
  });
});

// POST /api/v1/auth/login — Login as admin or interviewer
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { email, password } = result.data;

  // Try admin login first
  const admin = getOne<{
    id: string;
    company_id: string;
    email: string;
    name: string;
    password_hash: string;
  }>(
    'SELECT id, company_id, email, name, password_hash FROM company_admins WHERE email = @email',
    { email },
  );

  if (admin) {
    const bcrypt = await import('bcryptjs');
    const valid = bcrypt.compareSync(password, admin.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const { token, expiresAt } = generateToken({
      userId: admin.id,
      companyId: admin.company_id,
      role: 'company_admin',
      email: admin.email,
    });

    res.json({
      success: true,
      data: {
        userId: admin.id,
        companyId: admin.company_id,
        role: 'company_admin',
        name: admin.name,
        email: admin.email,
        token,
        expiresAt,
      },
    });
    return;
  }

  // Try interviewer login (interviewers use a PIN/password set during provisioning)
  const interviewer = getOne<{
    id: string;
    company_id: string;
    email: string;
    name: string;
    password_hash: string;
  }>(
    'SELECT id, company_id, email, name, password_hash FROM interviewers WHERE email = @email',
    { email },
  );

  if (interviewer) {
    const bcrypt = await import('bcryptjs');
    const valid = bcrypt.compareSync(password, interviewer.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const { token, expiresAt } = generateToken({
      userId: interviewer.id,
      companyId: interviewer.company_id,
      role: 'interviewer',
      email: interviewer.email,
    });

    res.json({
      success: true,
      data: {
        userId: interviewer.id,
        companyId: interviewer.company_id,
        role: 'interviewer',
        name: interviewer.name,
        email: interviewer.email,
        token,
        expiresAt,
      },
    });
    return;
  }

  res.status(401).json({ success: false, error: 'Invalid credentials' });
});

// GET /api/v1/auth/me — Get current user info
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const { verifyToken } = await import('../lib/auth.js');
  const payload = verifyToken(authHeader.slice(7));
  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  res.json({
    success: true,
    data: {
      userId: payload.userId,
      companyId: payload.companyId,
      role: payload.role,
      email: payload.email,
    },
  });
});

export default router;
