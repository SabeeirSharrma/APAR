import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { getOne, getMany, run } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Base directory for custom UI storage
const CUSTOM_UI_DIR = join(process.cwd(), 'data', 'custom_uis');

// Supported platforms
const PLATFORMS = ['desktop', 'tablet', 'mobile', 'web_dash', 'applicant_form'] as const;
type Platform = typeof PLATFORMS[number];

// MIME types for serving files
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// Helper: compute checksum for file content
function computeChecksum(content: Buffer): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

// Helper: recursively list all files in a directory
function listFiles(dir: string, base: string = dir): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = join(base, full).replace(base, '').replace(/^[/\\]/, '');
    if (statSync(full).isDirectory()) {
      files.push(...listFiles(full, base));
    } else {
      files.push(rel);
    }
  }
  return files;
}

// Helper: get company ID from auth
function getCompanyId(req: Request): string {
  return req.auth!.companyId;
}

// ============================================================================
// GET /api/v1/custom-ui — List all custom UIs for the company
// ============================================================================
router.get('/', requireAuth, (req: Request, res: Response) => {
  const companyId = getCompanyId(req);

  const uis = getMany<{ id: string; platform: string; name: string; version: string; is_active: number; created_at: string; updated_at: string }>(
    'SELECT id, platform, name, version, is_active, created_at, updated_at FROM custom_uis WHERE company_id = @companyId ORDER BY platform, updated_at DESC',
    { companyId },
  );

  res.json({ success: true, data: uis });
});

// ============================================================================
// GET /api/v1/custom-ui/:platform — Get active custom UI for a platform
// ============================================================================
router.get('/:platform', requireAuth, (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  const platform = req.params.platform as string;

  if (!PLATFORMS.includes(platform as Platform)) {
    res.status(400).json({ success: false, error: `Invalid platform. Must be one of: ${PLATFORMS.join(', ')}` });
    return;
  }

  const ui = getOne<{ id: string; platform: string; name: string; version: string; manifest: string; is_active: number; created_at: string; updated_at: string }>(
    'SELECT id, platform, name, version, manifest, is_active, created_at, updated_at FROM custom_uis WHERE company_id = @companyId AND platform = @platform AND is_active = 1',
    { companyId, platform },
  );

  if (!ui) {
    res.json({ success: true, data: null });
    return;
  }

  res.json({
    success: true,
    data: {
      ...ui,
      manifest: JSON.parse(ui.manifest),
    },
  });
});

// ============================================================================
// POST /api/v1/custom-ui/:platform — Create or update custom UI for a platform
// Body: { name, version?, files: { [path]: content } }
// ============================================================================
router.post('/:platform', requireAuth, (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  const platform = req.params.platform as string;

  if (!PLATFORMS.includes(platform as Platform)) {
    res.status(400).json({ success: false, error: `Invalid platform. Must be one of: ${PLATFORMS.join(', ')}` });
    return;
  }

  const { name, version, files } = req.body;
  if (!name || !files || typeof files !== 'object') {
    res.status(400).json({ success: false, error: 'name and files (object mapping paths to content) are required' });
    return;
  }

  const uiId = randomUUID();
  const uiVersion = version || '1.0.0';

  // Create directory structure
  const uiDir = join(CUSTOM_UI_DIR, companyId, platform, uiId);
  mkdirSync(uiDir, { recursive: true });

  // Write files and build manifest
  const manifest: Record<string, { checksum: string; size: number }> = {};
  for (const [filePath, content] of Object.entries(files)) {
    if (typeof content !== 'string') continue;
    // Sanitize path — prevent directory traversal
    const safePath = filePath.replace(/\.\./g, '').replace(/^[/\\]+/, '');
    const fullPath = join(uiDir, safePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
    const buffer = Buffer.from(content, 'utf-8');
    manifest[safePath] = {
      checksum: computeChecksum(buffer),
      size: buffer.length,
    };
  }

  // Deactivate any existing active UI for this platform
  run(
    'UPDATE custom_uis SET is_active = 0 WHERE company_id = @companyId AND platform = @platform AND is_active = 1',
    { companyId, platform },
  );

  // Insert new UI record
  run(
    `INSERT INTO custom_uis (id, company_id, platform, name, version, manifest, is_active)
     VALUES (@id, @companyId, @platform, @name, @version, @manifest, 1)`,
    {
      id: uiId,
      companyId,
      platform,
      name,
      version: uiVersion,
      manifest: JSON.stringify(manifest),
    },
  );

  res.status(201).json({
    success: true,
    message: 'Custom UI created',
    data: {
      id: uiId,
      platform,
      name,
      version: uiVersion,
      fileCount: Object.keys(manifest).length,
    },
  });
});

// ============================================================================
// POST /api/v1/custom-ui/:platform/activate/:id — Activate a specific UI version
// ============================================================================
router.post('/:platform/activate/:id', requireAuth, (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  const platform = req.params.platform as string;
  const uiId = req.params.id as string;

  if (!PLATFORMS.includes(platform as Platform)) {
    res.status(400).json({ success: false, error: `Invalid platform. Must be one of: ${PLATFORMS.join(', ')}` });
    return;
  }

  // Verify the UI exists and belongs to this company
  const ui = getOne<{ id: string; company_id: string }>(
    'SELECT id, company_id FROM custom_uis WHERE id = @id AND company_id = @companyId AND platform = @platform',
    { id: uiId, companyId, platform },
  );

  if (!ui) {
    res.status(404).json({ success: false, error: 'Custom UI not found' });
    return;
  }

  // Deactivate all for this platform
  run(
    'UPDATE custom_uis SET is_active = 0 WHERE company_id = @companyId AND platform = @platform',
    { companyId, platform },
  );

  // Activate the selected one
  run(
    'UPDATE custom_uis SET is_active = 1, updated_at = datetime(\'now\') WHERE id = @id',
    { id: uiId },
  );

  res.json({ success: true, message: 'Custom UI activated' });
});

// ============================================================================
// DELETE /api/v1/custom-ui/:platform/:id — Delete a specific UI version
// ============================================================================
router.delete('/:platform/:id', requireAuth, (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  const platform = req.params.platform as string;
  const uiId = req.params.id as string;

  if (!PLATFORMS.includes(platform as Platform)) {
    res.status(400).json({ success: false, error: `Invalid platform. Must be one of: ${PLATFORMS.join(', ')}` });
    return;
  }

  const ui = getOne<{ id: string; is_active: number }>(
    'SELECT id, is_active FROM custom_uis WHERE id = @id AND company_id = @companyId AND platform = @platform',
    { id: uiId, companyId, platform },
  );

  if (!ui) {
    res.status(404).json({ success: false, error: 'Custom UI not found' });
    return;
  }

  if (ui.is_active) {
    res.status(400).json({ success: false, error: 'Cannot delete active UI. Activate another version first.' });
    return;
  }

  // Delete from DB
  run('DELETE FROM custom_uis WHERE id = @id', { id: uiId });

  // Delete files from disk
  const uiDir = join(CUSTOM_UI_DIR, companyId, platform, uiId);
  if (existsSync(uiDir)) {
    rmSync(uiDir, { recursive: true, force: true });
  }

  res.json({ success: true, message: 'Custom UI deleted' });
});

// ============================================================================
// GET /api/v1/custom-ui/:platform/check-update — Check for updates (for clients)
// Query: currentVersion — the version the client currently has
// ============================================================================
router.get('/:platform/check-update', requireAuth, (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  const platform = req.params.platform as string;
  const currentVersion = req.query.currentVersion as string;

  if (!PLATFORMS.includes(platform as Platform)) {
    res.status(400).json({ success: false, error: `Invalid platform. Must be one of: ${PLATFORMS.join(', ')}` });
    return;
  }

  const ui = getOne<{ id: string; version: string; manifest: string; updated_at: string }>(
    'SELECT id, version, manifest, updated_at FROM custom_uis WHERE company_id = @companyId AND platform = @platform AND is_active = 1',
    { companyId, platform },
  );

  if (!ui) {
    res.json({ success: true, data: { updateAvailable: false } });
    return;
  }

  // Simple version comparison (semver-ish)
  const hasUpdate = currentVersion !== ui.version;

  res.json({
    success: true,
    data: {
      updateAvailable: hasUpdate,
      currentVersion: currentVersion || null,
      latestVersion: ui.version,
      manifest: hasUpdate ? JSON.parse(ui.manifest) : undefined,
      updatedAt: ui.updated_at,
    },
  });
});

// ============================================================================
// GET /api/v1/custom-ui/:platform/files/* — Serve a specific file
// ============================================================================
router.get('/:platform/files/{*filePath}', requireAuth, (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  const platform = req.params.platform as string;
  const filePath = req.params.filePath as string;

  if (!PLATFORMS.includes(platform as Platform)) {
    res.status(400).json({ success: false, error: `Invalid platform` });
    return;
  }

  // Get active UI
  const ui = getOne<{ id: string }>(
    'SELECT id FROM custom_uis WHERE company_id = @companyId AND platform = @platform AND is_active = 1',
    { companyId, platform },
  );

  if (!ui) {
    res.status(404).json({ success: false, error: 'No active custom UI for this platform' });
    return;
  }

  const fullPath = join(CUSTOM_UI_DIR, companyId, platform, ui.id, filePath);

  // Prevent directory traversal
  if (!fullPath.startsWith(join(CUSTOM_UI_DIR, companyId, platform, ui.id))) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  if (!existsSync(fullPath)) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  const content = readFileSync(fullPath);
  const ext = extname(fullPath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(content);
});

// ============================================================================
// GET /api/v1/custom-ui/defaults — List available base templates
// ============================================================================
router.get('/defaults', requireAuth, (_req: Request, res: Response) => {
  const templatesDir = join(process.cwd(), 'data', 'ui-templates');
  if (!existsSync(templatesDir)) {
    res.json({ success: true, data: [] });
    return;
  }

  const templates = readdirSync(templatesDir)
    .filter(f => statSync(join(templatesDir, f)).isDirectory())
    .map(name => {
      const manifestPath = join(templatesDir, name, 'manifest.json');
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        return { name, ...manifest };
      }
      return { name };
    });

  res.json({ success: true, data: templates });
});

// ============================================================================
// POST /api/v1/custom-ui/defaults/:template/install — Install a base template
// ============================================================================
router.post('/defaults/:template/install', requireAuth, (req: Request, res: Response) => {
  const companyId = getCompanyId(req);
  const templateName = req.params.template as string;
  const { platform } = req.body;

  if (!platform || !PLATFORMS.includes(platform as Platform)) {
    res.status(400).json({ success: false, error: `platform is required and must be one of: ${PLATFORMS.join(', ')}` });
    return;
  }

  const templatesDir = join(process.cwd(), 'data', 'ui-templates');
  const templateDir = join(templatesDir, templateName);

  if (!existsSync(templateDir)) {
    res.status(404).json({ success: false, error: 'Template not found' });
    return;
  }

  // Read all files from template
  const templateFiles: Record<string, string> = {};
  const filePaths = listFiles(templateDir, templateDir);
  for (const relPath of filePaths) {
    if (relPath === 'manifest.json') continue;
    templateFiles[relPath] = readFileSync(join(templateDir, relPath), 'utf-8');
  }

  const manifestPath = join(templateDir, 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf-8')) : {};

  // Create custom UI from template
  const uiId = randomUUID();
  const uiDir = join(CUSTOM_UI_DIR, companyId, platform, uiId);
  mkdirSync(uiDir, { recursive: true });

  const uiManifest: Record<string, { checksum: string; size: number }> = {};
  for (const [filePath, content] of Object.entries(templateFiles)) {
    const safePath = filePath.replace(/\.\./g, '').replace(/^[/\\]+/, '');
    const fullPath = join(uiDir, safePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
    const buffer = Buffer.from(content, 'utf-8');
    uiManifest[safePath] = {
      checksum: computeChecksum(buffer),
      size: buffer.length,
    };
  }

  // Deactivate existing
  run(
    'UPDATE custom_uis SET is_active = 0 WHERE company_id = @companyId AND platform = @platform AND is_active = 1',
    { companyId, platform },
  );

  // Insert
  run(
    `INSERT INTO custom_uis (id, company_id, platform, name, version, manifest, is_active)
     VALUES (@id, @companyId, @platform, @name, @version, @manifest, 1)`,
    {
      id: uiId,
      companyId,
      platform,
      name: manifest.name || templateName,
      version: manifest.version || '1.0.0',
      manifest: JSON.stringify(uiManifest),
    },
  );

  res.status(201).json({
    success: true,
    message: `Template "${templateName}" installed as custom UI`,
    data: { id: uiId, platform, name: manifest.name || templateName },
  });
});

export default router;
