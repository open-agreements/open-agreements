import { describe, expect } from 'vitest';
import { loadMetadata } from '../src/core/metadata.js';
import { findTemplateDir, listTemplateIds } from '../src/utils/paths.js';
import { itAllure } from './helpers/allure-test.js';
import {
  buildUnsupportedMemoFamilyMessage,
  isMemoSupportedTemplateId,
  listMemoSupportedTemplates,
  resolveMemoDispatch,
} from '../src/core/memo/families.js';
import { generateEmploymentMemo, isEmploymentTemplateId } from '../src/core/employment/memo.js';
import { founderTemplateIdsWithApprovalProfile, generateFounderMemo } from '../src/core/founder/memo.js';

const it = itAllure.epic('Compliance & Governance');

function memoFor(templateId: string): unknown {
  const templateDir = findTemplateDir(templateId);
  if (!templateDir) throw new Error(`Template not found in tests: ${templateId}`);
  const templateMetadata = loadMetadata(templateDir);
  const dispatch = resolveMemoDispatch(templateId);
  if (!dispatch) throw new Error(`No memo dispatch for ${templateId}`);

  // Deliberately EMPTY values: a memo must be producible from a bare fill, so
  // this exercises the blank/missing paths rather than a happy-path fixture.
  if (dispatch.family === 'founder-separation') {
    return generateFounderMemo({
      templateId,
      templateMetadata,
      values: {},
      generatedAt: '2026-09-08T00:00:00.000Z',
    });
  }
  return generateEmploymentMemo({
    templateId,
    templateMetadata,
    values: {},
    generatedAt: '2026-09-08T00:00:00.000Z',
  });
}

describe('memo family dispatch', () => {
  /**
   * The gate that keeps the derived support list honest. `--memo`'s supported
   * set is derived from the templates on disk, so this asserts that EVERY id
   * the runtime advertises actually produces a memo. An advertised template
   * that throws would be a capability the runtime does not have.
   */
  it('produces a memo for every template it advertises as memo-supported', () => {
    const families = listMemoSupportedTemplates();
    expect(families.length).toBeGreaterThan(0);

    const advertised = families.flatMap((family) => family.templateIds);
    expect(advertised.length).toBeGreaterThan(0);

    for (const templateId of advertised) {
      expect(() => memoFor(templateId), `advertised template ${templateId} must produce a memo`).not.toThrow();
    }
  });

  it('advertises exactly the installed templates that resolve to a family', () => {
    const advertised = new Set(listMemoSupportedTemplates().flatMap((family) => family.templateIds));
    const resolvable = listTemplateIds().filter((templateId) => isMemoSupportedTemplateId(templateId));

    expect([...advertised].sort()).toEqual([...resolvable].sort());
  });

  it('recognizes every installed state variant of the employment offer letter', () => {
    const variants = listTemplateIds().filter(
      (templateId) =>
        templateId.startsWith('openagreements-employment-offer-letter-')
        && !templateId.endsWith('-master')
    );

    // Derived, not hardcoded: the projection ships several state variants and
    // this must cover whichever ones are installed.
    expect(variants.length).toBeGreaterThan(0);

    for (const templateId of variants) {
      expect(isEmploymentTemplateId(templateId), templateId).toBe(true);
      expect(resolveMemoDispatch(templateId)?.profileId).toBe('openagreements-employment-offer-letter');
    }
  });

  it('routes every installed founder template to the founder-separation family', () => {
    const founderIds = listTemplateIds().filter((templateId) =>
      templateId.startsWith('openagreements-founder-')
    );
    expect(founderIds.length).toBeGreaterThan(0);

    for (const templateId of founderIds) {
      expect(resolveMemoDispatch(templateId)?.family, templateId).toBe('founder-separation');
    }
  });

  it('does not extend Wyoming restrictive-covenant memo rules to sibling states', () => {
    const wyomingSiblings = listTemplateIds().filter(
      (templateId) =>
        templateId.startsWith('openagreements-restrictive-covenant-')
        && templateId !== 'openagreements-restrictive-covenant-wyoming'
    );
    expect(wyomingSiblings.length).toBeGreaterThan(0);

    // Wyoming's clause signals cite Wyo. Stat. 1-23-108 and Hassler by name.
    // Inheriting them would emit Wyoming law over a Texas or Georgia draft.
    for (const templateId of wyomingSiblings) {
      expect(isMemoSupportedTemplateId(templateId), templateId).toBe(false);
    }
    expect(isMemoSupportedTemplateId('openagreements-restrictive-covenant-wyoming')).toBe(true);
  });

  /**
   * The prefix match sweeps in any future `openagreements-founder-*` template.
   * Producing a memo is not enough — a founder memo without an approval profile
   * is missing the section the family exists to provide. This fails when a new
   * founder template ships before its profile is authored.
   */
  it('has an authored approval profile for every installed founder template', () => {
    const installed = listTemplateIds()
      .filter((templateId) => templateId.startsWith('openagreements-founder-'))
      .sort();
    expect(installed.length).toBeGreaterThan(0);

    const profiled = founderTemplateIdsWithApprovalProfile();
    for (const templateId of installed) {
      expect(profiled, `${templateId} needs an approval profile in src/core/founder/memo.ts`).toContain(
        templateId,
      );
    }
  });

  it('never dispatches a projection-source master id', () => {
    expect(resolveMemoDispatch('openagreements-employment-offer-letter-master')).toBeUndefined();
  });

  it('unsupported-family error names what is supported and an alternative the user can take', () => {
    const message = buildUnsupportedMemoFamilyMessage('openagreements-privacy-policy');

    expect(message).toContain('openagreements-privacy-policy');
    expect(message).toContain('Templates that support --memo');
    expect(message).toContain('employment');
    expect(message).toContain('founder-separation');
    expect(message).toContain('template show openagreements-privacy-policy');

    // Every id the error names must be one the runtime can actually serve.
  for (const family of listMemoSupportedTemplates()) {
    for (const templateId of family.templateIds) {
      expect(message).toContain(templateId);
    }
  }
  });
});
