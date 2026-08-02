import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';
import { getOne, run } from '../db/index.js';
import { rustGenerateKey } from './transit.js';

// ============================================================================
// Encryption Utilities (§6) — Per-Interviewer Key Hierarchy
// ============================================================================
//
// Design decisions (locked):
// - Each interviewer gets a randomly generated 32-byte encryption key.
// - The key is generated randomly — admins can reset it, never define/choose it.
// - Results are encrypted with the assigned interviewer's key.
// - A company master key exists so admins can always recover/access data.
// - The interviewer's raw key is stored encrypted with the company master key.
// - The interviewer receives their raw key via the soft-lock artifact.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

/**
 * Company master key passphrase — derived from a strong env var.
 * Used to encrypt/decrypt per-interviewer keys.
 * In production, this MUST be a strong, randomly generated value stored securely.
 */
const COMPANY_MASTER_PASSPHRASE = process.env.COMPANY_MASTER_KEY || 'apar-company-master-key-change-in-production';

// --- Low-level encrypt/decrypt (passphrase-based) ---

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32) as Buffer;
}

/**
 * Encrypt a string value using AES-256-GCM.
 * Returns base64: salt + iv + authTag + ciphertext.
 */
function encryptRaw(data: string, passphrase: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(passphrase, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 */
function decryptRaw(encryptedData: string, passphrase: string): string {
  const buf = Buffer.from(encryptedData, 'base64');
  const salt = buf.subarray(0, SALT_LENGTH);
  const iv = buf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = buf.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
}

// --- Company Master Key ---

/**
 * Derive a company master key from a company ID.
 * Each company gets a deterministic-but-unique master key derivation.
 */
function getCompanyMasterKey(companyId: string): string {
  return scryptSync(COMPANY_MASTER_PASSPHRASE, Buffer.from(`apar-master-${companyId}`), 32).toString('hex');
}

/**
 * Encrypt data with a company master key.
 */
function encryptWithMasterKey(data: string, companyId: string): string {
  return encryptRaw(data, getCompanyMasterKey(companyId));
}

/**
 * Decrypt data with a company master key.
 */
function decryptWithMasterKey(encryptedData: string, companyId: string): string {
  return decryptRaw(encryptedData, getCompanyMasterKey(companyId));
}

// --- Per-Interviewer Key Management ---

/**
 * Generate a new random encryption key for an interviewer.
 * Uses Rust binary if available, falls back to Node.js crypto.
 */
export async function generateInterviewerKey(): Promise<string> {
  try {
    const result = await rustGenerateKey();
    return result.key;
  } catch {
    // Fallback to Node.js crypto
    return randomBytes(32).toString('hex');
  }
}

/**
 * Store an interviewer's encryption key, encrypted with the company master key.
 * Called during provisioning and when an admin resets a key.
 */
export function storeInterviewerKey(interviewerId: string, companyId: string, rawKey: string): void {
  const encryptedKey = encryptWithMasterKey(rawKey, companyId);
  run(
    `UPDATE interviewers SET encryption_key = @encryption_key, updated_at = datetime('now') WHERE id = @id`,
    { encryption_key: encryptedKey, id: interviewerId },
  );
}

/**
 * Retrieve an interviewer's raw encryption key.
 * Decrypts it from the company master key on the fly.
 * Returns null if the key doesn't exist or can't be decrypted.
 */
export function getInterviewerKey(interviewerId: string, companyId: string): string | null {
  const row = getOne<{ encryption_key: string }>(
    'SELECT encryption_key FROM interviewers WHERE id = @id AND company_id = @companyId',
    { id: interviewerId, companyId },
  );
  if (!row || !row.encryption_key) return null;
  try {
    return decryptWithMasterKey(row.encryption_key, companyId);
  } catch {
    console.error(`Failed to decrypt interviewer key for ${interviewerId}`);
    return null;
  }
}

/**
 * Reset an interviewer's encryption key (admin action).
 * Generates a new random key and stores it. The old key is lost.
 */
export async function resetInterviewerKey(interviewerId: string, companyId: string): Promise<string> {
  const newKey = await generateInterviewerKey();
  storeInterviewerKey(interviewerId, companyId, newKey);
  return newKey;
}

// --- Result Encryption (per-interviewer) ---

/**
 * Encrypt a result object before storage (§4 step 7, processor #2).
 * Uses the assigned interviewer's encryption key.
 * Falls back to the company master key if interviewer key is unavailable.
 */
export function encryptResult<T>(data: T, interviewerId: string, companyId: string): string {
  const serialized = JSON.stringify(data);
  const key = getInterviewerKey(interviewerId, companyId);
  if (key) {
    return encryptRaw(serialized, key);
  }
  // Fallback: encrypt with company master key
  console.warn(`No encryption key for interviewer ${interviewerId}, using company master key`);
  return encryptWithMasterKey(serialized, companyId);
}

/**
 * Decrypt a stored result back to its original object.
 * Tries the interviewer's key first, then falls back to the company master key.
 */
export function decryptResult<T>(encryptedData: string, interviewerId: string, companyId: string): T | null {
  // Try interviewer key first
  const interviewerKey = getInterviewerKey(interviewerId, companyId);
  if (interviewerKey) {
    try {
      const decrypted = decryptRaw(encryptedData, interviewerKey);
      return JSON.parse(decrypted) as T;
    } catch {
      // Interviewer key didn't work, try master key
    }
  }
  // Fallback: company master key
  try {
    const decrypted = decryptWithMasterKey(encryptedData, companyId);
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error('Failed to decrypt result with any key:', error);
    return null;
  }
}

/**
 * Decrypt a result using ONLY the company master key (admin recovery).
 * Used when the interviewer's key is no longer available.
 */
export function decryptResultAsAdmin<T>(encryptedData: string, companyId: string): T | null {
  try {
    const decrypted = decryptWithMasterKey(encryptedData, companyId);
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error('Admin decryption failed:', error);
    return null;
  }
}

// --- Legacy compatibility (for development/testing) ---

/**
 * Generate a random encryption key for a new interviewer (legacy).
 */
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const privateKey = randomBytes(32).toString('hex');
  const publicKey = createHash('sha256').update(privateKey).digest('hex');
  return { publicKey, privateKey };
}

// --- API Key Encryption at Rest (#8) ---

/**
 * Encrypt an API key using the company's master key for storage at rest.
 * Used for OpenRouter keys and any other sensitive provider credentials.
 */
export function encryptApiKey(apiKey: string, companyId: string): string {
  return encryptWithMasterKey(apiKey, companyId);
}

/**
 * Decrypt an API key using the company's master key.
 * Used when reading provider configs for pipeline execution.
 */
export function decryptApiKey(encryptedApiKey: string, companyId: string): string | null {
  try {
    return decryptWithMasterKey(encryptedApiKey, companyId);
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return null;
  }
}
