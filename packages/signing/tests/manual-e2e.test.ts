/**
 * Manual end-to-end verification tests.
 * These test the full flow from signing.yaml → fill pipeline → anchor verification.
 * Run with: npx vitest run packages/signing/tests/manual-e2e.test.ts
 */

import { describe, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHmac, randomBytes } from 'node:crypto';
import AdmZip from 'adm-zip';
import { itAllure } from '../../../integration-tests/helpers/allure-test.ts';
import { loadSigningConfig, getProviderAnchors } from '../src/signing-config.js';
import { encrypt, decrypt } from '../src/storage.js';
import { DocuSignProvider } from '../src/docusign.js';

const it = itAllure.epic('Agreement Signing');
const TEMPLATE_DIR = 'content/templates/bonterms-mutual-nda';

describe('Manual E2E: signing config → fill → anchor verification', () => {

  it.openspec('OA-SIG-003')('loads signing.yaml and resolves all 4 provider anchor formats', () => {
    const config = loadSigningConfig(TEMPLATE_DIR);
    expect(config).not.toBeNull();
    expect(config!.signers).toHaveLength(2);

    for (const provider of ['docusign', 'dropboxsign', 'adobesign', 'pandadoc']) {
      const anchors = getProviderAnchors(config!, provider);
      expect(Object.keys(anchors).length).toBeGreaterThanOrEqual(2);
    }
  });

  it.openspec('OA-SIG-005')('fills Bonterms NDA without sig data (no error, blank signature fields)', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'manual-e2e-'));
    const outputPath = join(tempDir, 'no-sig.docx');

    writeFileSync(join(tempDir, 'data.json'), '{}');

    // This should NOT throw — signature tags default to empty
    execSync(
      `node bin/open-agreements.js fill bonterms-mutual-nda -d ${join(tempDir, 'data.json')} -o ${outputPath}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    // Verify no anchor strings in output
    const zip = new AdmZip(outputPath);
    const text = zip.readAsText('word/document.xml').replace(/<[^>]+>/g, ' ');
    expect(text).not.toContain('/sn1/');
    expect(text).not.toContain('/sn2/');
  });

  it.openspec('OA-SIG-004')('fills Bonterms NDA WITH DocuSign anchors — anchors appear in DOCX', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'manual-e2e-'));
    const outputPath = join(tempDir, 'with-sig.docx');

    const data = {
      party_1_name: 'Acme Corp',
      party_2_name: 'Globex Industries',
      effective_date: 'March 29, 2026',
      sig_party_1: '/sn1/',
      sig_party_2: '/sn2/',
      date_party_1: '/ds1/',
      date_party_2: '/ds2/',
    };
    writeFileSync(join(tempDir, 'data.json'), JSON.stringify(data));

    execSync(
      `node bin/open-agreements.js fill bonterms-mutual-nda -d ${join(tempDir, 'data.json')} -o ${outputPath}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const zip = new AdmZip(outputPath);
    const text = zip.readAsText('word/document.xml').replace(/<[^>]+>/g, ' ');

    // Anchors present
    expect(text).toContain('/sn1/');
    expect(text).toContain('/sn2/');
    expect(text).toContain('/ds1/');
    expect(text).toContain('/ds2/');

    // Business fields also present
    expect(text).toContain('Acme Corp');
    expect(text).toContain('Globex Industries');
    expect(text).toContain('March 29, 2026');
  });

  it.openspec('OA-SIG-008')('encryption round-trip preserves DocuSign secret key', () => {
    const key = randomBytes(32);
    const secret = 'ab0472fd-fec1-40d3-8ef5-abf50676e47b';

    const encrypted = encrypt(secret, key);
    expect(encrypted).not.toBe(secret);

    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(secret);
  });

  it.openspec('OA-SIG-007')('DocuSign OAuth URL uses real integration key and points to sandbox', () => {
    const provider = new DocuSignProvider({
      integrationKey: 'd2b5e34b-aa16-4459-95c5-3f7650df6ff8',
      secretKey: 'test',
      redirectUri: 'http://localhost:3000/api/auth/docusign/callback',
      sandbox: true,
      storeConnection: async () => {},
      getConnection: async () => null,
      removeConnection: async () => {},
      storeDocument: async () => '',
      getDocument: async () => Buffer.from(''),
      storeEnvelopeStatus: async () => {},
      auditLog: async () => {},
    });

    const { url, codeVerifier } = provider.getAuthUrl(
      'http://localhost:3000/api/auth/docusign/callback',
      'manual-test-state',
    );

    expect(url).toContain('account-d.docusign.com'); // sandbox
    expect(url).toContain('d2b5e34b'); // real integration key
    expect(url).toContain('code_challenge_method=S256'); // PKCE
    expect(url).toContain('signature'); // scope
    expect(url).not.toContain('code_verifier'); // never in URL
    expect(codeVerifier.length).toBeGreaterThan(0);
  });

  it.openspec('OA-SIG-014')('webhook HMAC accepts valid signature and rejects invalid', () => {
    const hmacSecret = 'manual-test-secret';
    const body = '{"envelopeId":"env-manual","status":"completed"}';

    const provider = new DocuSignProvider({
      integrationKey: 'test',
      secretKey: 'test',
      redirectUri: 'test',
      hmacSecret,
      sandbox: true,
      storeConnection: async () => {},
      getConnection: async () => null,
      removeConnection: async () => {},
      storeDocument: async () => '',
      getDocument: async () => Buffer.from(''),
      storeEnvelopeStatus: async () => {},
      auditLog: async () => {},
    });

    const validSig = createHmac('sha256', hmacSecret).update(body).digest('base64');

    expect(provider.verifyWebhook({ 'x-docusign-signature-1': validSig }, body)).toBe(true);
    expect(provider.verifyWebhook({ 'x-docusign-signature-1': 'wrong' }, body)).toBe(false);
    expect(provider.verifyWebhook({}, body)).toBe(false);
  });

  it.openspec('OA-SIG-006').skip('Needs template with mismatched signing.yaml tag reference', () => {
    // Fill pipeline should fail closed when signing.yaml references tags missing from DOCX
  });
});
