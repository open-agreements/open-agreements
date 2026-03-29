import { describe, it, expect } from 'vitest';
import { flattenConcertoInstance, flattenWithMapping } from './concerto-bridge.js';

describe('concerto-bridge', () => {
  const bondermsMutualNDA = {
    $class: 'org.openagreements.nda.bonterms@1.0.0.BontermsMutualNDA',
    party_1: {
      $class: 'org.openagreements.nda.bonterms@1.0.0.Party',
      name: 'UseJunior Inc.',
    },
    party_2: {
      $class: 'org.openagreements.nda.bonterms@1.0.0.Party',
      name: 'Acme Corp',
    },
    terms: {
      $class: 'org.openagreements.nda.bonterms@1.0.0.NDATerms',
      effective_date: '2026-03-25',
      purpose: 'Evaluating a potential business relationship',
      nda_term: '1 year',
      confidentiality_period: '1 year',
    },
    legal: {
      $class: 'org.openagreements.nda.bonterms@1.0.0.GoverningLaw',
      governing_law: 'California',
      courts: 'courts located in San Francisco, California',
    },
  };

  describe('flattenConcertoInstance', () => {
    it('flattens nested Concerto concepts to underscore-joined keys', () => {
      const flat = flattenConcertoInstance(bondermsMutualNDA);

      expect(flat).toEqual({
        party_1_name: 'UseJunior Inc.',
        party_2_name: 'Acme Corp',
        terms_effective_date: '2026-03-25',
        terms_purpose: 'Evaluating a potential business relationship',
        terms_nda_term: '1 year',
        terms_confidentiality_period: '1 year',
        legal_governing_law: 'California',
        legal_courts: 'courts located in San Francisco, California',
      });
    });

    it('strips all $class annotations', () => {
      const flat = flattenConcertoInstance(bondermsMutualNDA);
      const keys = Object.keys(flat);
      expect(keys.every(k => !k.includes('$class'))).toBe(true);
    });
  });

  describe('flattenWithMapping', () => {
    it('maps Concerto paths to fill pipeline field names', () => {
      // The Bonterms metadata.yaml uses flat names like "purpose",
      // "effective_date", "governing_law" — not "terms_purpose" etc.
      const mappings = [
        { from: 'terms.effective_date', to: 'effective_date' },
        { from: 'terms.purpose', to: 'purpose' },
        { from: 'terms.nda_term', to: 'nda_term' },
        { from: 'terms.confidentiality_period', to: 'confidentiality_period' },
        { from: 'legal.governing_law', to: 'governing_law' },
        { from: 'legal.courts', to: 'courts' },
      ];

      const flat = flattenWithMapping(bondermsMutualNDA, mappings);

      // These match the exact field names in bonterms-mutual-nda/metadata.yaml
      expect(flat).toEqual({
        party_1_name: 'UseJunior Inc.',
        party_2_name: 'Acme Corp',
        effective_date: '2026-03-25',
        purpose: 'Evaluating a potential business relationship',
        nda_term: '1 year',
        confidentiality_period: '1 year',
        governing_law: 'California',
        courts: 'courts located in San Francisco, California',
      });
    });

    it('falls back to underscore path for unmapped fields', () => {
      // Only map some fields — rest should use default underscore joining
      const flat = flattenWithMapping(bondermsMutualNDA, [
        { from: 'terms.purpose', to: 'purpose' },
      ]);

      expect(flat['purpose']).toBe('Evaluating a potential business relationship');
      // Unmapped field keeps underscore path
      expect(flat['terms_nda_term']).toBe('1 year');
    });
  });
});
