import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';

// ============================================================================
// Encryption Utilities (§6)
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

/**
 * Default encryption key from environment.
 * In production, this should be a strong key stored securely.
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'apar-default-dev-key-change-in-production';

/**
 * Derive a 32-byte key from a passphrase using scrypt.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32) as Buffer;
}

/**
 * Encrypt a string value using AES-256-GCM (authenticated encryption).
 * Returns base64-encoded string: salt + iv + authTag + ciphertext.
 */
export function encrypt(data: string, passphrase: string = ENCRYPTION_KEY): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(passphrase, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt an AES-256-GCM encrypted string back to plaintext.
 */
export function decrypt(encryptedData: string, passphrase: string = ENCRYPTION_KEY): string {
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

/**
 * Encrypt a result object (serialized to JSON) before storage.
 * This is processor #2 in the pipeline (§4 step 7).
 */
export function encryptResult<T>(data: T, passphrase: string = ENCRYPTION_KEY): string {
  const serialized = JSON.stringify(data);
  return encrypt(serialized, passphrase);
}

/**
 * Decrypt a stored result back to its original object shape.
 */
export function decryptResult<T>(encryptedData: string, passphrase: string = ENCRYPTION_KEY): T | null {
  try {
    const decrypted = decrypt(encryptedData, passphrase);
    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error('Failed to decrypt result:', error);
    return null;
  }
}

/**
 * Generate a random encryption key for a new interviewer.
 * Returns a keypair-like structure: the public key is stored server-side,
 * the private key is distributed to the client via the soft-lock artifact.
 */
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const privateKey = randomBytes(32).toString('hex');
  const publicKey = createHash('sha256').update(privateKey).digest('hex');
  return { publicKey, privateKey };
}

/**
 * Derive a company master key from a passphrase using scrypt + salt.
 * This could be used for the company admin recovery key hierarchy (§6).
 */
export function deriveCompanyMasterKey(passphrase: string, salt: string = 'apar-company-salt'): string {
  const saltBuffer = Buffer.from(salt, 'utf8');
  return scryptSync(passphrase, saltBuffer, 32).toString('hex');
}

/**
 * Encrypt data with a company master key for admin recovery.
 */
export function encryptWithMasterKey<T>(data: T, masterKey: string): string {
  return encryptResult(data, masterKey);
}

/**
 * Decrypt data with a company master key.
 */
export function decryptWithMasterKey<T>(encryptedData: string, masterKey: string): T | null {
  return decryptResult<T>(encryptedData, masterKey);
}
