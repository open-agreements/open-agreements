import { describe, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { itAllure } from '../../../integration-tests/helpers/allure-test.ts';
import {
  encrypt,
  decrypt,
  createDocumentRef,
  createArtifactRef,
} from '../src/storage.js';

const it = itAllure.epic('Agreement Signing');

describe('AES-256-GCM encryption', () => {
  const key = randomBytes(32); // 256-bit key

  it.openspec('OA-SIG-008')('encrypts and decrypts a string round-trip', () => {
    const plaintext = 'ab0472fd-fec1-40d3-8ef5-abf50676e47b';
    const ciphertext = encrypt(plaintext, key);

    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext.length).toBeGreaterThan(plaintext.length);

    const decrypted = decrypt(ciphertext, key);
    expect(decrypted).toBe(plaintext);
  });

  it.openspec('OA-SIG-008')('produces different ciphertexts for same plaintext (random IV)', () => {
    const plaintext = 'same-value';
    const ct1 = encrypt(plaintext, key);
    const ct2 = encrypt(plaintext, key);

    expect(ct1).not.toBe(ct2); // Different IVs
    expect(decrypt(ct1, key)).toBe(plaintext);
    expect(decrypt(ct2, key)).toBe(plaintext);
  });

  it.openspec('OA-SIG-008')('fails to decrypt with wrong key', () => {
    const plaintext = 'secret-token';
    const ciphertext = encrypt(plaintext, key);
    const wrongKey = randomBytes(32);

    expect(() => decrypt(ciphertext, wrongKey)).toThrow();
  });

  it.openspec('OA-SIG-008')('fails to decrypt tampered ciphertext', () => {
    const plaintext = 'secret-token';
    const ciphertext = encrypt(plaintext, key);
    // Tamper by flipping bits in the encrypted payload (past IV + tag)
    const buf = Buffer.from(ciphertext, 'base64');
    buf[buf.length - 1] ^= 0xff; // flip all bits in last byte
    const tampered = buf.toString('base64');

    expect(() => decrypt(tampered, key)).toThrow();
  });
});

describe('createDocumentRef', () => {
  it.openspec('OA-SIG-008')('creates a ref with sha256 and correct metadata', () => {
    const buffer = Buffer.from('test document content');
    const ref = createDocumentRef(buffer, 'test-nda.docx', 'generated');

    expect(ref.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(ref.filename).toBe('test-nda.docx');
    expect(ref.source).toBe('generated');
    expect(ref.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(ref.id).toContain(ref.sha256.substring(0, 12));
  });

  it('produces different IDs for different content', () => {
    const ref1 = createDocumentRef(Buffer.from('content A'), 'a.docx', 'generated');
    const ref2 = createDocumentRef(Buffer.from('content B'), 'b.docx', 'uploaded');

    expect(ref1.sha256).not.toBe(ref2.sha256);
    expect(ref1.id).not.toBe(ref2.id);
  });
});

describe('createArtifactRef', () => {
  it.openspec('OA-SIG-013')('creates a ref with expiration', () => {
    const ref = createArtifactRef('https://storage.example.com/signed.pdf', 7200000);

    expect(ref.downloadUrl).toBe('https://storage.example.com/signed.pdf');
    expect(new Date(ref.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(ref.id).toContain('artifact-');
  });
});
