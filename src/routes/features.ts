import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getOne, getMany, run } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { featureToggleSchema } from '../lib/validation.js';
import { getFeatureToggles, type FeatureType } from '../middleware/featureToggle.js';

const router = Router();

// All feature toggle routes require admin auth
router.use(requireAuth);
router.use(requireRole('company_admin'));

// GET /api/v1/features — List all feature toggles for the company
router.get('/', async (req: Request, res: Response) => {
  const { companyId } = req.auth!;
  const toggles = getFeatureToggles(companyId);
  res.json({ success: true, data: toggles });
});

// PATCH /api/v1/features — Update a feature toggle
router.patch('/', async (req: Request, res: Response) => {
  const { companyId } = req.auth!;

  const result = featureToggleSchema.safeParse({ ...req.body, companyId });
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { feature, isEnabled } = result.data;

  // Check if toggle already exists
  const existing = getOne<{ id: string }>(
    'SELECT id FROM feature_toggles WHERE company_id = @companyId AND feature = @feature',
    { companyId, feature },
  );

  if (existing) {
    run(
      `UPDATE feature_toggles SET is_enabled = @isEnabled, updated_at = datetime('now') WHERE company_id = @companyId AND feature = @feature`,
      { isEnabled: isEnabled ? 1 : 0, companyId, feature },
    );
  } else {
    run(
      `INSERT INTO feature_toggles (id, company_id, feature, is_enabled) VALUES (@id, @companyId, @feature, @isEnabled)`,
      { id: randomUUID(), companyId, feature, isEnabled: isEnabled ? 1 : 0 },
    );
  }

  const toggles = getFeatureToggles(companyId);
  res.json({
    success: true,
    message: `Feature ${feature} ${isEnabled ? 'enabled' : 'disabled'}`,
    data: toggles,
  });
});

export default router;
