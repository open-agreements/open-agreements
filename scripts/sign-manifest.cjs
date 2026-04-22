#!/usr/bin/env node
// Signs _site/.well-known/ai/index.json with the shared Ed25519 ARP key
// and writes a detached signature to _site/.well-known/arp/index.sig.
// Mirrors dev-website's sign-manifest but origin-aware — reads the
// manifest URL from the ARP_MANIFEST_URL env var (or derives a relative
// path) so the envelope doesn't hardcode usejunior.com.
//
// Activation requires: ARP_PRIVATE_KEY_BASE64 env var set to the PKCS#8
// DER base64 of the Ed25519 private key (same key as usejunior.com, pulled
// from Azure Key Vault foam-arp-signing-key-private). If the env var is
// absent, the script skips signing and exits 0.
//
// Named `.cjs` because open-agreements is an ESM project.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const canonicalize = require('canonicalize');

const repoRoot = path.join(__dirname, '..');
const siteRoot = path.join(repoRoot, '_site');
const indexPath = path.join(siteRoot, '.well-known', 'ai', 'index.json');
const pubkeyPath = path.join(siteRoot, '.well-known', 'arp', 'pubkey.json');
const sigPath = path.join(siteRoot, '.well-known', 'arp', 'index.sig');

const privB64 = process.env.ARP_PRIVATE_KEY_BASE64;
if (!privB64) {
  console.log('[arp-sign] ARP_PRIVATE_KEY_BASE64 not set; skipping manifest signing.');
  process.exit(0);
}

if (!fs.existsSync(indexPath)) {
  console.error(`[arp-sign] manifest not found at ${indexPath}`);
  process.exit(1);
}
if (!fs.existsSync(pubkeyPath)) {
  console.error(`[arp-sign] pubkey.json not found at ${pubkeyPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const pubkey = JSON.parse(fs.readFileSync(pubkeyPath, 'utf8'));

if (pubkey.status === 'not-yet-provisioned') {
  console.error('[arp-sign] pubkey.json is a placeholder; cannot sign');
  process.exit(1);
}
if (!pubkey.p) {
  console.error('[arp-sign] pubkey.json is missing the `p` field (raw 32-byte pubkey base64)');
  process.exit(1);
}

const canonicalBytes = Buffer.from(canonicalize(manifest), 'utf8');

const privateKey = crypto.createPrivateKey({
  key: Buffer.from(privB64, 'base64'),
  format: 'der',
  type: 'pkcs8',
});

const signature = crypto.sign(null, canonicalBytes, privateKey);

const signedAtUnix = Math.floor(Date.now() / 1000);
const signedAtIso = new Date(signedAtUnix * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const expiresAtUnix = Number(pubkey.x) || signedAtUnix + 90 * 24 * 60 * 60;
const expiresAtIso = new Date(expiresAtUnix * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');

// Envelope is origin-agnostic. Verifiers derive the canonical manifest path
// from their fetch URL; the `manifest` field here carries a relative pointer
// rather than a hardcoded absolute URL so the same signature serves
// openagreements.org and openagreements.ai identically.
const sigEnvelope = {
  algo: 'ed25519',
  kid: pubkey.kid,
  canonicalization: 'RFC 8785 JCS',
  manifest: process.env.ARP_MANIFEST_URL || '/.well-known/ai/index.json',
  signedAt: signedAtIso,
  signedAtUnix,
  expiresAt: expiresAtIso,
  expiresAtUnix,
  signature: signature.toString('base64'),
};

fs.mkdirSync(path.dirname(sigPath), { recursive: true });
fs.writeFileSync(sigPath, JSON.stringify(sigEnvelope, null, 2) + '\n');
console.log(
  `[arp-sign] manifest signed (kid=${pubkey.kid}, ${canonicalBytes.length} bytes canonicalized, expires ${expiresAtIso})`
);
