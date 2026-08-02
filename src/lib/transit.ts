/**
 * Transit native module integration for APAR.
 * 
 * Provides high-performance native implementations via:
 * - Rust binary (apar-keygen): key generation, encrypt/decrypt
 * - Java modules (transit): encrypt/decrypt, text analysis
 * 
 * Usage:
 *   import { initTransit, getNativeCrypto, getNativeTextAnalysis } from './transit.js';
 *   await initTransit();
 *   const crypto = getNativeCrypto();
 *   const result = await crypto.generateKey();
 */

import { transit } from '@sabeeirsharrma/transit';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Paths to native modules
const RUST_BINARY_PATH = resolve(__dirname, '../native/apar-keygen/target/release/apar-keygen');
const JAVA_SOURCE_PATH = resolve(__dirname, '../native/apar-java/src/main/java');

let javaModule: any = null;
let transitReady = false;

/**
 * Initialize Transit connections to native modules.
 */
export async function initTransit(): Promise<void> {
  if (transitReady) return;

  try {
    // Initialize Java Transit bridge
    javaModule = transit.java(JAVA_SOURCE_PATH);
    transitReady = true;
    console.log('[transit] Java modules loaded');
  } catch (err) {
    console.warn('[transit] Java modules not available:', err);
    // Continue without Java — will use Node.js fallbacks
  }
}

/**
 * Get Java Transit module (if available).
 */
export function getJavaModule(): any {
  return javaModule;
}

/**
 * Check if Transit is ready.
 */
export function isTransitReady(): boolean {
  return transitReady;
}

// ============================================================================
// Rust Binary Wrapper (apar-keygen)
// ============================================================================

export interface KeyGenResult {
  key: string;
  nonce: string;
}

export interface EncryptResult {
  ciphertext: string;
  nonce: string;
}

/**
 * Execute the Rust binary with arguments and optional stdin.
 */
function execRustBinary(args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(RUST_BINARY_PATH, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Rust binary exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.on('error', reject);

    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }
  });
}

/**
 * Generate a new AES-256-GCM key using the Rust binary.
 */
export async function rustGenerateKey(): Promise<KeyGenResult> {
  const stdout = await execRustBinary(['--generate']);
  return JSON.parse(stdout);
}

/**
 * Encrypt data using the Rust binary.
 */
export async function rustEncrypt(key: string, plaintext: string): Promise<EncryptResult> {
  const stdout = await execRustBinary(['--encrypt', '--key', key]);
  return JSON.parse(stdout);
}

/**
 * Decrypt data using the Rust binary.
 */
export async function rustDecrypt(key: string, nonce: string, ciphertext: string): Promise<string> {
  const input = JSON.stringify({ ciphertext });
  const stdout = await execRustBinary(['--decrypt', '--key', key, '--nonce', nonce], input);
  return stdout;
}

// ============================================================================
// Java Transit Wrappers
// ============================================================================

/**
 * Generate a new AES-256-GCM key using Java.
 */
export async function javaGenerateKey(): Promise<KeyGenResult> {
  if (!javaModule) throw new Error('Java module not initialized');
  const result = await javaModule.generateKey('{}');
  return JSON.parse(result as string);
}

/**
 * Encrypt data using Java.
 */
export async function javaEncrypt(key: string, plaintext: string): Promise<EncryptResult> {
  if (!javaModule) throw new Error('Java module not initialized');
  const result = await javaModule.encrypt(JSON.stringify({ key, plaintext }));
  return JSON.parse(result as string);
}

/**
 * Decrypt data using Java.
 */
export async function javaDecrypt(key: string, nonce: string, ciphertext: string): Promise<string> {
  if (!javaModule) throw new Error('Java module not initialized');
  const result = await javaModule.decrypt(JSON.stringify({ key, nonce, ciphertext }));
  const parsed = JSON.parse(result as string);
  if (parsed.error) throw new Error(parsed.error);
  return parsed.plaintext;
}

/**
 * Analyze text using Java.
 */
export async function javaAnalyzeText(text: string): Promise<any> {
  if (!javaModule) throw new Error('Java module not initialized');
  const result = await javaModule.analyzeText(JSON.stringify({ text }));
  return JSON.parse(result as string);
}

/**
 * Tokenize text using Java.
 */
export async function javaTokenize(text: string): Promise<any> {
  if (!javaModule) throw new Error('Java module not initialized');
  const result = await javaModule.tokenize(JSON.stringify({ text }));
  return JSON.parse(result as string);
}

/**
 * Find patterns in text using Java.
 */
export async function javaFindPatterns(text: string, pattern: string): Promise<any> {
  if (!javaModule) throw new Error('Java module not initialized');
  const result = await javaModule.findPatterns(JSON.stringify({ text, pattern }));
  return JSON.parse(result as string);
}

// ============================================================================
// Unified Crypto API (tries Rust first, falls back to Java, then Node.js)
// ============================================================================

/**
 * Generate key — tries Rust binary first, falls back to Java.
 */
export async function generateKey(): Promise<KeyGenResult> {
  try {
    return await rustGenerateKey();
  } catch {
    try {
      return await javaGenerateKey();
    } catch {
      // Fallback to Node.js crypto
      const { randomBytes } = await import('crypto');
      const key = randomBytes(32).toString('base64');
      return { key, nonce: '' };
    }
  }
}

/**
 * Encrypt — tries Rust binary first, falls back to Java.
 */
export async function encrypt(key: string, plaintext: string): Promise<EncryptResult> {
  try {
    return await rustEncrypt(key, plaintext);
  } catch {
    return await javaEncrypt(key, plaintext);
  }
}

/**
 * Decrypt — tries Rust binary first, falls back to Java.
 */
export async function decrypt(key: string, nonce: string, ciphertext: string): Promise<string> {
  try {
    return await rustDecrypt(key, nonce, ciphertext);
  } catch {
    return await javaDecrypt(key, nonce, ciphertext);
  }
}