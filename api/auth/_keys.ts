/**
 * JWT signing key management for OA OAuth server.
 *
 * The RS256 private key is stored as a PEM in the OA_JWT_PRIVATE_KEY env var.
 * The key ID (kid) is derived from the public key thumbprint for stability.
 *
 * To generate a key pair:
 *   node -e "const { generateKeyPair, exportPKCS8, exportSPKI } = require('jose');
 *     generateKeyPair('RS256').then(async ({publicKey, privateKey}) => {
 *       console.log(await exportPKCS8(privateKey));
 *       console.log(await exportSPKI(publicKey));
 *     })"
 *
 * Or use the generate-keys script: npx tsx api/auth/_generate-keys.ts
 */

import {
  importPKCS8,
  importSPKI,
  exportJWK,
  calculateJwkThumbprint,
  type JWK,
} from 'jose';

type KeyLike = Awaited<ReturnType<typeof importPKCS8>>;

let _privateKey: KeyLike | null = null;
let _publicJwk: JWK | null = null;
let _kid: string | null = null;

/**
 * Load the signing key pair from environment variables.
 * Caches after first load (keys don't change during a function lifecycle).
 */
async function ensureKeys(): Promise<void> {
  if (_privateKey && _publicJwk && _kid) return;

  const privatePem = process.env.OA_JWT_PRIVATE_KEY?.trim();
  const publicPem = process.env.OA_JWT_PUBLIC_KEY?.trim();

  if (!privatePem || !publicPem) {
    throw new Error(
      'OA_JWT_PRIVATE_KEY and OA_JWT_PUBLIC_KEY environment variables are required. ' +
      'Generate with: npx tsx api/auth/_generate-keys.ts'
    );
  }

  _privateKey = await importPKCS8(privatePem, 'RS256');
  const publicKey = await importSPKI(publicPem, 'RS256');
  _publicJwk = await exportJWK(publicKey);
  _publicJwk.alg = 'RS256';
  _publicJwk.use = 'sig';

  // Derive kid from public key thumbprint — stable across restarts
  _kid = await calculateJwkThumbprint(_publicJwk, 'sha256');
  _publicJwk.kid = _kid;
}

/** Get the private signing key. */
export async function getPrivateKey(): Promise<KeyLike> {
  await ensureKeys();
  return _privateKey!;
}

/** Get the key ID (thumbprint-derived). */
export async function getKid(): Promise<string> {
  await ensureKeys();
  return _kid!;
}

/** Get the JWKS response (array of public keys). */
export async function getJwks(): Promise<{ keys: JWK[] }> {
  await ensureKeys();
  return { keys: [_publicJwk!] };
}
