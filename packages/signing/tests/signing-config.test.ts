import { describe, expect } from 'vitest';
import { itAllure } from '../../../integration-tests/helpers/allure-test.ts';
import {
  SigningConfigSchema,
  getProviderAnchors,
  getSignatureTagFields,
} from '../src/signing-config.js';

const it = itAllure.epic('Agreement Signing');

// ── Valid signing config fixture ────────────────────────────────────────────

const validConfig = {
  signers: [
    {
      role: 'party_1',
      nameField: 'party_1_name',
      signatureField: 'sig_party_1',
      dateField: 'date_party_1',
      routingOrder: 1,
    },
    {
      role: 'party_2',
      nameField: 'party_2_name',
      signatureField: 'sig_party_2',
      dateField: 'date_party_2',
      routingOrder: 2,
    },
  ],
  providerAnchors: {
    docusign: {
      sig_party_1: '/sn1/',
      sig_party_2: '/sn2/',
      date_party_1: '/ds1/',
      date_party_2: '/ds2/',
    },
    dropboxsign: {
      sig_party_1: '[sig|req|signer1]',
      sig_party_2: '[sig|req|signer2]',
      date_party_1: '[date|req|signer1]',
      date_party_2: '[date|req|signer2]',
    },
    adobesign: {
      sig_party_1: '{{sig1_es_:signer1:signature}}',
      sig_party_2: '{{sig2_es_:signer2:signature}}',
      date_party_1: '{{date1_es_:signer1:date}}',
      date_party_2: '{{date2_es_:signer2:date}}',
    },
    pandadoc: {
      sig_party_1: '{{signature:party_1}}',
      sig_party_2: '{{signature:party_2}}',
      date_party_1: '{{date:party_1}}',
      date_party_2: '{{date:party_2}}',
    },
  },
  emailSubjectTemplate: '{{template_name}} — {{party_1_name}} / {{party_2_name}}',
};

// ── OA-SIG-001: signing.yaml parses valid signer roles and anchor mappings ─

describe('signing config parsing', () => {
  it.openspec('OA-SIG-001')('parses valid signer roles and anchor mappings', () => {
    const config = SigningConfigSchema.parse(validConfig);

    expect(config.signers).toHaveLength(2);
    expect(config.signers[0].role).toBe('party_1');
    expect(config.signers[0].signatureField).toBe('sig_party_1');
    expect(config.signers[1].routingOrder).toBe(2);
    expect(config.providerAnchors.docusign.sig_party_1).toBe('/sn1/');
    expect(config.providerAnchors.dropboxsign.sig_party_1).toBe('[sig|req|signer1]');
    expect(config.providerAnchors.adobesign.sig_party_1).toBe('{{sig1_es_:signer1:signature}}');
    expect(config.providerAnchors.pandadoc.sig_party_1).toBe('{{signature:party_1}}');
  });

  it.openspec('OA-SIG-002')('rejects config with no signers', () => {
    expect(() => SigningConfigSchema.parse({
      signers: [],
      providerAnchors: {},
    })).toThrow();
  });

  it.openspec('OA-SIG-001')('defaults routingOrder to 1', () => {
    const config = SigningConfigSchema.parse({
      signers: [{
        role: 'party_1',
        nameField: 'party_1_name',
        signatureField: 'sig_party_1',
      }],
      providerAnchors: { docusign: { sig_party_1: '/sn1/' } },
    });
    expect(config.signers[0].routingOrder).toBe(1);
  });
});

// ── OA-SIG-003: provider anchor lookup ──────────────────────────────────────

describe('provider anchor lookup', () => {
  const config = SigningConfigSchema.parse(validConfig);

  it.openspec('OA-SIG-003')('returns DocuSign anchors', () => {
    const anchors = getProviderAnchors(config, 'docusign');
    expect(anchors.sig_party_1).toBe('/sn1/');
    expect(anchors.sig_party_2).toBe('/sn2/');
    expect(anchors.date_party_1).toBe('/ds1/');
    expect(anchors.date_party_2).toBe('/ds2/');
  });

  it.openspec('OA-SIG-003')('returns Dropbox Sign anchors', () => {
    const anchors = getProviderAnchors(config, 'dropboxsign');
    expect(anchors.sig_party_1).toBe('[sig|req|signer1]');
  });

  it.openspec('OA-SIG-003')('returns Adobe Sign anchors', () => {
    const anchors = getProviderAnchors(config, 'adobesign');
    expect(anchors.sig_party_1).toBe('{{sig1_es_:signer1:signature}}');
  });

  it.openspec('OA-SIG-003')('returns PandaDoc anchors', () => {
    const anchors = getProviderAnchors(config, 'pandadoc');
    expect(anchors.sig_party_1).toBe('{{signature:party_1}}');
  });

  it.openspec('OA-SIG-003')('throws for unknown provider', () => {
    expect(() => getProviderAnchors(config, 'unknownprovider')).toThrow(
      'No anchor configuration for provider "unknownprovider"',
    );
  });
});

// ── Signature tag field extraction ──────────────────────────────────────────

describe('getSignatureTagFields', () => {
  const config = SigningConfigSchema.parse(validConfig);

  it('returns all signature and date tag fields', () => {
    const fields = getSignatureTagFields(config);
    expect(fields).toContain('sig_party_1');
    expect(fields).toContain('sig_party_2');
    expect(fields).toContain('date_party_1');
    expect(fields).toContain('date_party_2');
    expect(fields).toHaveLength(4);
  });

  it('omits date fields when not specified', () => {
    const minimal = SigningConfigSchema.parse({
      signers: [{
        role: 'party_1',
        nameField: 'party_1_name',
        signatureField: 'sig_party_1',
      }],
      providerAnchors: { docusign: { sig_party_1: '/sn1/' } },
    });
    const fields = getSignatureTagFields(minimal);
    expect(fields).toEqual(['sig_party_1']);
  });
});
