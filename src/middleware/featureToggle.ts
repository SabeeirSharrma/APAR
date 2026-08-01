import { Request, Response, NextFunction } from 'express';
import { getOne, getMany } from '../db/index.js';

// ============================================================================
// Feature Toggle Middleware (§15)
// ============================================================================

export type FeatureType = 'recording' | 'interviewer-chat' | 'interviewer-analytics' | 'background-checks';

/**
 * Middleware that checks if a feature is enabled for the company.
 * If disabled, returns 404 (simulating "endpoint not hosted" per §15).
 * Must be used after requireAuth middleware.
 */
export function requireFeature(feature: FeatureType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { companyId } = req.auth;

    // Check if feature is enabled (default: disabled for opt-in features)
    const toggle = getOne<{ is_enabled: number }>(
      'SELECT is_enabled FROM feature_toggles WHERE company_id = ? AND feature = ?',
      { companyId, feature },
    );

    // Feature is enabled if explicitly set to enabled
    if (toggle && toggle.is_enabled === 1) {
      next();
      return;
    }

    // Feature not found or disabled — return 404 per §15
    // "If a feature is off, its backend endpoint(s) are not hosted at all"
    res.status(404).json({
      success: false,
      error: 'Feature not available',
      message: `This feature (${feature}) is not enabled for your organization.`,
    });
  };
}

/**
 * Check if a feature is enabled for a company (non-middleware version).
 */
export function isFeatureEnabled(companyId: string, feature: FeatureType): boolean {
  const toggle = getOne<{ is_enabled: number }>(
    'SELECT is_enabled FROM feature_toggles WHERE company_id = ? AND feature = ?',
    { companyId, feature },
  );
  return toggle?.is_enabled === 1;
}

/**
 * Get all feature toggles for a company.
 */
export function getFeatureToggles(companyId: string): Array<{ feature: FeatureType; isEnabled: boolean }> {
  const toggles = getMany<{ feature: string; is_enabled: number }>(
    'SELECT feature, is_enabled FROM feature_toggles WHERE company_id = ?',
    { companyId },
  );

  // Ensure all features are represented (default: disabled)
  const allFeatures: FeatureType[] = ['recording', 'interviewer-chat', 'interviewer-analytics', 'background-checks'];
  const toggleMap = new Map<string, boolean>(toggles.map((t) => [t.feature, t.is_enabled === 1]));

  return allFeatures.map((feature) => ({
    feature,
    isEnabled: toggleMap.get(feature) ?? false,
  }));
}
