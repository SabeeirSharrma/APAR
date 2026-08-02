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

// Transit bridge — transit.java() scans Java source via tree-sitter to discover
// public methods in CryptoModule.java and TextAnalysisModule.java
const jv = transit.java(JAVA_SOURCE_PATH);

let transitReady = false;

/**
 * Initialize Transit connections to native modules.
 */
export async function initTransit(): Promise<void> {
  if (transitReady) return;
  transitReady = true;
  console.log('[transit] Java modules available via Transit bridge');
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
 * Bridge: jv.generateKey() -> CryptoModule.generateKey()
 */
export async function javaGenerateKey(): Promise<KeyGenResult> {
  const result = await jv.generateKey('{}');
  return JSON.parse(result as string);
}

/**
 * Encrypt data using Java.
 * Bridge: jv.encrypt() -> CryptoModule.encrypt()
 */
export async function javaEncrypt(key: string, plaintext: string): Promise<EncryptResult> {
  const result = await jv.encrypt(JSON.stringify({ key, plaintext }));
  return JSON.parse(result as string);
}

/**
 * Decrypt data using Java.
 * Bridge: jv.decrypt() -> CryptoModule.decrypt()
 */
export async function javaDecrypt(key: string, nonce: string, ciphertext: string): Promise<string> {
  const result = await jv.decrypt(JSON.stringify({ key, nonce, ciphertext }));
  const parsed = JSON.parse(result as string);
  if (parsed.error) throw new Error(parsed.error);
  return parsed.plaintext;
}

/**
 * Analyze text using Java.
 * Bridge: jv.analyzeText() -> TextAnalysisModule.analyzeText()
 */
export async function javaAnalyzeText(text: string): Promise<any> {
  const result = await jv.analyzeText(JSON.stringify({ text }));
  return JSON.parse(result as string);
}

/**
 * Tokenize text using Java.
 * Bridge: jv.tokenize() -> TextAnalysisModule.tokenize()
 */
export async function javaTokenize(text: string): Promise<any> {
  const result = await jv.tokenize(JSON.stringify({ text }));
  return JSON.parse(result as string);
}

/**
 * Find patterns in text using Java.
 * Bridge: jv.findPatterns() -> TextAnalysisModule.findPatterns()
 */
export async function javaFindPatterns(text: string, pattern: string): Promise<any> {
  const result = await jv.findPatterns(JSON.stringify({ text, pattern }));
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