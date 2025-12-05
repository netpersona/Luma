import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

// Cache the session secret to avoid repeated file reads
let cachedSecret: string | null = null;

/**
 * Get or generate the session secret.
 * Priority: 1) Environment variable, 2) Secrets file, 3) Auto-generate and save
 */
function getSessionSecret(): string {
  if (cachedSecret) {
    return cachedSecret;
  }

  // 1. Check environment variable
  if (process.env.SESSION_SECRET) {
    cachedSecret = process.env.SESSION_SECRET;
    return cachedSecret;
  }

  // 2. Check secrets file
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const secretsFile = path.join(dataDir, '.secrets.json');

  try {
    if (fs.existsSync(secretsFile)) {
      const data = JSON.parse(fs.readFileSync(secretsFile, 'utf-8'));
      if (data.sessionSecret) {
        cachedSecret = data.sessionSecret;
        return cachedSecret!;
      }
    }
  } catch (error) {
    console.error('Error reading secrets file:', error);
  }

  // 3. Auto-generate and save
  console.log('No SESSION_SECRET found, generating a new one...');
  const newSecret = crypto.randomBytes(32).toString('base64');
  
  try {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load existing secrets or create new object
    let secrets: Record<string, string> = {};
    if (fs.existsSync(secretsFile)) {
      try {
        secrets = JSON.parse(fs.readFileSync(secretsFile, 'utf-8'));
      } catch {
        // File exists but is invalid, start fresh
      }
    }

    // Save the new secret
    secrets.sessionSecret = newSecret;
    fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2), { mode: 0o600 });
    console.log('Session secret generated and saved to secrets file');
  } catch (error) {
    console.error('Warning: Could not save session secret to file:', error);
  }

  cachedSecret = newSecret;
  return cachedSecret;
}

function getKey(salt: Buffer): Buffer {
  const secret = getSessionSecret();
  return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha512');
}

/**
 * Encrypt a string value using AES-256-GCM
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getKey(salt);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  // Combine salt, iv, tag, and encrypted data
  const result = Buffer.concat([salt, iv, tag, encrypted]);
  return result.toString('base64');
}

/**
 * Decrypt a string value encrypted with encrypt()
 */
export function decrypt(encryptedText: string): string {
  const buffer = Buffer.from(encryptedText, 'base64');
  
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = buffer.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const encrypted = buffer.subarray(ENCRYPTED_POSITION);
  
  const key = getKey(salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Mask a secret value for safe display (show first 4 and last 4 characters)
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) {
    return '****';
  }
  return `${value.substring(0, 4)}${'*'.repeat(value.length - 8)}${value.substring(value.length - 4)}`;
}
