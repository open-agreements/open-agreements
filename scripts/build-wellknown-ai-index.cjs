#!/usr/bin/env node
// Generates _site/.well-known/ai/index.json with a fresh generatedAt
// timestamp and SHA-256 integrity hashes for the published .well-known
// artifacts on openagreements.{ai,org}. Mirrors dev-website's script but
// host-neutral — the same signed bytes serve from both origins.
//
// Runs after eleventy passthroughs _site/.well-known/ into _site/, so
// hashes cover the final served bytes.
//
// Named `.cjs` because open-agreements is an ESM project
// (`"type": "module"` in package.json).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const siteRoot = path.join(repoRoot, '_site');
const indexPath = path.join(siteRoot, '.well-known', 'ai', 'index.json');
const entityPath = path.join(siteRoot, '.well-known', 'ai', 'entity.json');
const pubkeyPath = path.join(siteRoot, '.well-known', 'arp', 'pubkey.json');

if (!fs.existsSync(entityPath)) {
  console.error(`[arp-index] entity.json not found at ${entityPath} — did eleventy passthrough run?`);
  process.exit(1);
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');
}

const integrity = {
  entity: sha256File(entityPath),
};

if (fs.existsSync(pubkeyPath)) {
  integrity.pubkey = sha256File(pubkeyPath);
}

// Include other .well-known/ AI-facing artifacts if present.
const optionalTargets = [
  { key: 'agentCard',      rel: '.well-known/agent-card.json' },
  { key: 'apiCatalog',     rel: '.well-known/api-catalog/index.json' },
  { key: 'mcpServerCard',  rel: '.well-known/mcp-server-card/index.json' },
];
for (const t of optionalTargets) {
  const p = path.join(siteRoot, t.rel);
  if (fs.existsSync(p)) {
    integrity[t.key] = sha256File(p);
  }
}

const now = new Date();
const index = {
  version: '1.0',
  generatedAt: now.toISOString().slice(0, 10),
  lastUpdated: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  description: 'ARP manifest for openagreements.org / openagreements.ai. Canonical entity at https://usejunior.com/.well-known/ai/entity.json. Same key-holder (kid 8e508d1976566d46) operates all three origins.',
  entity: '/.well-known/ai/entity.json',
  pubkey: '/.well-known/arp/pubkey.json',
  integrity,
};

fs.mkdirSync(path.dirname(indexPath), { recursive: true });
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`[arp-index] _site/.well-known/ai/index.json written (${Object.keys(integrity).length} integrity hashes)`);
