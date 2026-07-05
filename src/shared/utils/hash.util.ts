import * as crypto from 'crypto';

/**
 * Hashes a plaintext password using PBKDF2 with a unique random salt.
 * Returns the hash in the format: salt:hash
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored salted hash.
 */
export function comparePassword(password: string, storedHash: string): boolean {
  if (!storedHash) {
    return false;
  }
  // Support legacy SHA-256 fallback if stored hash does not contain a colon
  if (!storedHash.includes(':')) {
    const legacyHash = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
    return legacyHash === storedHash;
  }
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
    .toString('hex');
  return hash === originalHash;
}
