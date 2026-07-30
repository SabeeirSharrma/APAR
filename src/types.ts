// APAR Types
// Based on the APAR specification

// ============================================================================
// Core Identity Types
// ============================================================================

export interface Company {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  branding: CompanyBranding;
  isRoundBased: boolean;
  roundCount: number;
  submissionEmail: string;
  databaseConfigId: string;
  modelProviderConfigId: string;
}

export interface CompanyBranding {
  name: string;
  themeStyle: 'light' | 'dark' | 'custom';
  primaryColor?: string;
  logoUrl?: string;
}

export interface CompanyAdmin {
  id: string;
  companyId: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Interviewer {
  id: string;
  companyId: string;
  email: string;
  name: string;
  publicKey: string;
  createdAt: Date;
  updatedAt: Date;
  positions: Position[];
  rounds?: Round[];
}

// ============================================================================
// Interview Flow Types
// ============================================================================

export interface Position {
  id: string;
  companyId: string;
  name: string;
  description: string;
  criteria: string; // Free-form prose criteria
  createdAt: Date;
  updatedAt: Date;
  interviewers: Interviewer[];
  applicantPool: Applicant[];
}

export type ApplicationStatus = 
  | 'queued'
  | 'processing'
  | 'verifying'
  | 'delivered'
  | 'approved'
  | 'rejected';

export interface Applicant {
  id: string;
  positionId: string;
  companyId: string;
  email: string;
  name: string;
  resumeUrl: string;
  resumeBase64: string;
  status: ApplicationStatus;
  currentRound?: number;
  assignedInterviewerId?: string;
  tags: Tag[];
  notes: Note[];
  recordings: Recording[];
  messages: Message[];
  result?: Result;
  createdAt: Date;
  updatedAt: Date;
}

export interface Result {
  id: string;
  applicantId: string;
  criteriaScores: CriterionScore[];
  overallVerdict: Verdict;
  overallGrade: ColorGrade;
  summary: string;
  recommendation: string;
  lowConfidence: boolean;
  verificationAttempts: number;
  encryptedData: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Verdict = 
  | 'Meets Criteria'
  | 'Partially Meets Criteria'
  | 'Does Not Meet Criteria';

export type ColorGrade = 
  | 'excellent'
  | 'good'
  | 'average'
  | 'below-average'
  | 'poor';

export interface CriterionScore {
  criterion: string;
  score: number; // 0-100
  justification: string;
  grade: ColorGrade;
}

export interface Round {
  id: string;
  companyId: string;
  positionId?: string;
  roundNumber: number;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  interviewers: Interviewer[];
}

// ============================================================================
// Tag System Types
// ============================================================================

export type TagScope = 'global' | 'local';

export interface Tag {
  id: string;
  companyId: string;
  name: string;
  color: string;
  scope: TagScope;
  createdByInterviewerId?: string;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Communication Types
// ============================================================================

export interface Note {
  id: string;
  applicantId: string;
  interviewerId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  applicantId: string;
  senderType: 'interviewer' | 'applicant';
  senderId: string;
  content: string;
  sentVia: string;
  createdAt: Date;
}

export interface Recording {
  id: string;
  applicantId: string;
  interviewerId: string;
  type: 'screen-video' | 'screen-audio' | 'mic';
  storageReference: string;
  duration?: number;
  createdAt: Date;
}

// ============================================================================
// Configuration Types
// ============================================================================

export type DatabaseBackend = 
  | 'sqlite'
  | 'redis'
  | 'supabase'
  | 'firebase'
  | 'mongodb'
  | 'custom';

export interface DatabaseConfig {
  id: string;
  companyId: string;
  backend: DatabaseBackend;
  connectionString?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ModelProvider = 'openrouter' | 'openai-compatible';

export interface ModelProviderConfig {
  id: string;
  companyId: string;
  role: 'main' | 'verification';
  provider: ModelProvider;
  endpointUrl?: string;
  apiKeyReference?: string;
  modelName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type FeatureType = 
  | 'recording'
  | 'interviewer-chat'
  | 'interviewer-analytics'
  | 'background-checks';

export interface FeatureToggle {
  id: string;
  companyId: string;
  feature: FeatureType;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// API Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface UploadResumeRequest {
  positionId: string;
  applicantEmail: string;
  applicantName: string;
  supplementaryInfo?: string;
}

export interface UploadResumeResponse {
  applicationId: string;
  status: ApplicationStatus;
  message: string;
}

export interface CreateTagRequest {
  name: string;
  color: string;
  scope: TagScope;
}

export interface UpdateTagRequest {
  tagId: string;
  name?: string;
  color?: string;
  isApproved?: boolean;
}

export interface CreateNoteRequest {
  applicantId: string;
  content: string;
}

export interface SendMessageRequest {
  applicantId: string;
  content: string;
}

// ============================================================================
// Setup Wizard Types
// ============================================================================

export interface SetupWizardStep {
  step: number;
  name: string;
  description: string;
  isCompleted: boolean;
  data?: Record<string, unknown>;
}

export interface CompanyRegistrationRequest {
  name: string;
  adminEmail: string;
  adminName: string;
}

export interface DatabaseRegistrationRequest {
  backend: DatabaseBackend;
  connectionString?: string;
}

export interface BrandingSetupRequest {
  name: string;
  themeStyle: 'light' | 'dark' | 'custom';
  primaryColor?: string;
  logoUrl?: string;
}

export interface ModelProviderSetupRequest {
  role: 'main' | 'verification';
  provider: ModelProvider;
  endpointUrl?: string;
  apiKey?: string;
  modelName: string;
}

export interface InterviewerProvisioningRequest {
  email: string;
  name: string;
  positionIds: string[];
  roundIds?: string[];
}
