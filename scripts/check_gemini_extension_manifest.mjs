#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve(process.cwd(), 'gemini-extension.json');
let manifest;
try {
  const raw = readFileSync(manifestPath, 'utf8');
  manifest = JSON.parse(raw);
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    console.log('SKIP gemini extension manifest contract: gemini-extension.json not present in this checkout.');
    process.exit(0);
  }
  throw error;
}

const requiredTopLevel = [
  'name',
  'version',
  'description',
  'contextFileName',
  'entrypoint',
  'mcpServers',
];

for (const field of requiredTopLevel) {
  if (!(field in manifest)) {
    throw new Error(`gemini-extension.json is missing required field: ${field}`);
  }
}

if (!manifest.mcpServers || typeof manifest.mcpServers !== 'object') {
  throw new Error('gemini-extension.json mcpServers must be an object.');
}

const expectedServers = {
  'contracts-workspace-mcp': '@open-agreements/contracts-workspace-mcp',
  'contract-templates-mcp': '@open-agreements/contract-templates-mcp',
};

for (const [name, packageName] of Object.entries(expectedServers)) {
  const server = manifest.mcpServers[name];
  if (!server || typeof server !== 'object') {
    throw new Error(`gemini-extension.json is missing mcpServers.${name}`);
  }
  if ('cwd' in server) {
    throw new Error(`gemini-extension.json mcpServers.${name} must not set cwd`);
  }
  if (server.command !== 'npx') {
    throw new Error(`gemini-extension.json mcpServers.${name}.command must be "npx"`);
  }
  if (!Array.isArray(server.args)) {
    throw new Error(`gemini-extension.json mcpServers.${name}.args must be an array`);
  }
  if (!server.args.includes(packageName)) {
    throw new Error(`gemini-extension.json mcpServers.${name}.args must include ${packageName}`);
  }
}

console.log('PASS gemini extension manifest contract.');
