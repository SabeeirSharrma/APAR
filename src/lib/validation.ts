import { z } from 'zod';

// ============================================================================
// Zod Validation Schemas (§21 priority #0)
// ============================================================================

// --- Auth ---

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200),
  adminEmail: z.string().email('Invalid email address'),
  adminName: z.string().min(1, 'Admin name is required').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  submissionEmail: z.string().email('Invalid submission email'),
});

// --- Upload ---

export const uploadSchema = z.object({
  positionId: z.string().uuid('Invalid position ID'),
  applicantEmail: z.string().email('Invalid email address'),
  applicantName: z.string().min(1, 'Applicant name is required').max(200),
  supplementaryInfo: z.string().max(5000).optional(),
});

// --- Positions ---

export const createPositionSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  name: z.string().min(1, 'Position name is required').max(200),
  description: z.string().max(5000).optional(),
  criteria: z.string().min(10, 'Criteria must be at least 10 characters').max(10000),
});

export const updatePositionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  criteria: z.string().min(10).max(10000).optional(),
});

// --- Interviewers ---

export const createInterviewerSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Interviewer name is required').max(200),
  positionIds: z.array(z.string().uuid()).min(1, 'At least one position is required'),
  roundIds: z.array(z.string().uuid()).optional(),
});

export const updateInterviewerSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(200).optional(),
});

// --- Rounds ---

export const createRoundSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  roundNumber: z.number().int().min(1, 'Round number must be at least 1'),
  name: z.string().min(1, 'Round name is required').max(200),
  description: z.string().max(2000).optional(),
  positionId: z.string().uuid().optional(),
});

export const updateRoundSchema = z.object({
  roundNumber: z.number().int().min(1).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});

// --- Tags ---

export const createTagSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  name: z.string().min(1, 'Tag name is required').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  scope: z.enum(['global', 'local'], { errorMap: () => ({ message: 'Scope must be "global" or "local"' }) }),
  createdByInterviewerId: z.string().uuid().optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
});

// --- Notes ---

export const createNoteSchema = z.object({
  applicantId: z.string().uuid('Invalid applicant ID'),
  interviewerId: z.string().uuid('Invalid interviewer ID'),
  content: z.string().min(1, 'Note content is required').max(10000),
});

export const updateNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(10000),
});

// --- Messages ---

export const sendMessageSchema = z.object({
  applicantId: z.string().uuid('Invalid applicant ID'),
  interviewerId: z.string().uuid('Invalid interviewer ID'),
  content: z.string().min(1, 'Message content is required').max(5000),
});

// --- Setup Wizard ---

export const databaseSetupSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  backend: z.enum(['sqlite (local)', 'postgresql', 'mysql', 'sqlserver', 'redis', 'supabase', 'firebase', 'mongodb', 'custom']),
  connectionString: z.string().max(2000).optional(),
  host: z.string().max(200).optional(),
  port: z.string().max(10).optional(),
  database: z.string().max(200).optional(),
  username: z.string().max(200).optional(),
  password: z.string().max(200).optional(),
});

export const brandingSetupSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  name: z.string().min(1, 'Company name is required').max(200),
  themeStyle: z.enum(['light', 'dark', 'custom']),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().optional(),
});

export const modelProviderSetupSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  role: z.enum(['main', 'verification']),
  provider: z.enum(['openrouter', 'openai-compatible']),
  endpointUrl: z.string().url().optional(),
  apiKey: z.string().max(500).optional(),
  modelName: z.string().min(1, 'Model name is required').max(200),
});

// --- Status Update ---

export const statusUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: 'Status must be "approved" or "rejected"' }),
  }),
});

// --- Pagination ---

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Common Params ---

export const uuidParam = z.object({
  id: z.string().uuid('Invalid ID format'),
});

// --- Feature Toggle ---

export const featureToggleSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  feature: z.enum(['recording', 'interviewer-chat', 'interviewer-analytics', 'background-checks']),
  isEnabled: z.boolean(),
});

// --- Helper: validate request body against a Zod schema ---

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (data: unknown): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
  };
}
