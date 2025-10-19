/**
 * Cryptographic utility functions
 */

/**
 * Generate a secure random ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a secure random string for OAuth state
 */
export function generateSecureState(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

/**
 * Simple base64 encoding (for development)
 * In production, use proper encryption with AES-GCM
 */
export function simpleEncrypt(data: string, key: string): string {
  // This is a placeholder - in production, use Web Crypto API
  const combined = `${data}:${key}`;
  return btoa(combined);
}

/**
 * Simple base64 decoding (for development)
 * In production, use proper decryption with AES-GCM
 */
export function simpleDecrypt(encryptedData: string, key: string): string {
  // This is a placeholder - in production, use Web Crypto API
  try {
    const decoded = atob(encryptedData);
    const [data, originalKey] = decoded.split(':');
    if (originalKey !== key) {
      throw new Error('Invalid key');
    }
    return data;
  } catch (error) {
    throw new Error('Failed to decrypt data');
  }
}