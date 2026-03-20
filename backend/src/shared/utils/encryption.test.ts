import { describe, it, expect } from '@jest/globals';
import { encrypt, decrypt, isEncrypted } from './encryption';

describe('Encryption', () => {
  it('should encrypt and decrypt a string', () => {
    const plaintext = '123-45-6789';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for same input', () => {
    const plaintext = 'test-value';
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2); // Different IVs
  });

  it('should detect encrypted values', () => {
    const encrypted = encrypt('test');
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it('should not detect plain text as encrypted', () => {
    expect(isEncrypted('plain-text')).toBe(false);
    expect(isEncrypted('123-45-6789')).toBe(false);
  });

  it('should handle empty strings', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('should handle special characters', () => {
    const plaintext = 'Bank Acct: 1234567890 @#$%^&*()';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });
});
