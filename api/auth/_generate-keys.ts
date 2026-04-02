#!/usr/bin/env npx tsx
/**
 * Generate RS256 key pair for OA OAuth server.
 * Run: npx tsx api/auth/_generate-keys.ts
 *
 * Output: PEM-encoded private and public keys.
 * Add to environment as OA_JWT_PRIVATE_KEY and OA_JWT_PUBLIC_KEY.
 */

import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose';

async function main() {
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    modulusLength: 2048,
  });

  const privatePem = await exportPKCS8(privateKey);
  const publicPem = await exportSPKI(publicKey);

  console.log('=== OA_JWT_PRIVATE_KEY ===');
  console.log(privatePem);
  console.log('=== OA_JWT_PUBLIC_KEY ===');
  console.log(publicPem);
  console.log('\nAdd both to your .env or Vercel environment variables.');
  console.log('The kid (Key ID) is auto-derived from the public key thumbprint at runtime.');
}

main().catch(console.error);
