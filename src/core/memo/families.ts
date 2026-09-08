/**
 * Memo family dispatch.
 *
 * `--memo` used to be gated on a hardcoded three-element set of template ids.
 * That set is why every state variant of the employment offer letter
 * (`openagreements-employment-offer-letter-new-york`, ...) was rejected as
 * "not an employment template" even though it is a pure projection of the
 * master offer letter that the set did contain (legal-explainer#2569), and why
 * every founder-separation template failed as employment-only
 * (legal-explainer#2572).
 *
 * The supported set is now DERIVED from the templates on disk rather than
 * transcribed, so a new state variant is supported the moment it ships. A
 * declared profile owns the family rules; a variant inherits the profile of the
 * base template it projects from. `integration-tests/memo-families.test.ts`
 * asserts that every id this module claims to support actually produces a memo,
 * so the derivation cannot advertise a capability the runtime does not have.
 */

import { listTemplateIds } from '../../utils/paths.js';

export type MemoFamily = 'employment' | 'founder-separation';

export interface MemoDispatch {
  /** Family whose generator handles this template. */
  family: MemoFamily;
  /** The template the user asked to fill. */
  templateId: string;
  /**
   * Template id whose family rules (clause signals, jurisdiction rules,
   * source dates) apply. For a state variant this is the base template it
   * projects from; otherwise it equals `templateId`.
   */
  profileId: string;
}

/**
 * Employment profiles. A template belongs to a profile when its id equals the
 * profile id or extends it with a jurisdiction suffix — the naming contract the
 * offer-letter and CIIAA state projections already follow.
 */
const EMPLOYMENT_VARIANT_PROFILE_IDS = [
  'openagreements-employment-offer-letter',
  'openagreements-confidentiality-invention-assignment-agreement',
] as const;

/**
 * Employment templates whose memo rules are jurisdiction-specific and therefore
 * must NOT be inherited by sibling state templates. The Wyoming restrictive
 * covenant memo cites Wyo. Stat. 1-23-108 and Hassler by name; applying it to
 * `openagreements-restrictive-covenant-texas` would emit Wyoming law as though
 * it governed a Texas draft. Those states get memo support only when their own
 * rules are authored.
 */
const EMPLOYMENT_EXACT_PROFILE_IDS = ['openagreements-restrictive-covenant-wyoming'] as const;

/** Every founder-separation template is its own profile: the nine documents in the family share no field set. */
const FOUNDER_PREFIX = 'openagreements-founder-';

/**
 * Ids that look like a family member by prefix but are not fillable published
 * templates. `-master` is a projection source, never published to OA.
 */
function isNonPublishableId(templateId: string): boolean {
  return templateId.endsWith('-master');
}

function matchesVariantProfile(templateId: string, profileId: string): boolean {
  return templateId === profileId || templateId.startsWith(`${profileId}-`);
}

export function resolveMemoDispatch(templateId: string): MemoDispatch | undefined {
  if (isNonPublishableId(templateId)) return undefined;

  for (const profileId of EMPLOYMENT_EXACT_PROFILE_IDS) {
    if (templateId === profileId) {
      return { family: 'employment', templateId, profileId };
    }
  }

  for (const profileId of EMPLOYMENT_VARIANT_PROFILE_IDS) {
    if (matchesVariantProfile(templateId, profileId)) {
      return { family: 'employment', templateId, profileId };
    }
  }

  if (templateId.startsWith(FOUNDER_PREFIX)) {
    return { family: 'founder-separation', templateId, profileId: templateId };
  }

  return undefined;
}

export function isMemoSupportedTemplateId(templateId: string): boolean {
  return resolveMemoDispatch(templateId) !== undefined;
}

export interface MemoFamilySupport {
  family: MemoFamily;
  label: string;
  templateIds: string[];
}

const FAMILY_LABELS: Record<MemoFamily, string> = {
  employment: 'employment (offer letters, CIIAA, Wyoming restrictive covenant)',
  'founder-separation': 'founder separation (resignation, repurchase, consents, records)',
};

/**
 * Every template on disk that `--memo` supports, grouped by family. Derived
 * from the installed templates directory, so this can never advertise a
 * template that is not present.
 */
export function listMemoSupportedTemplates(): MemoFamilySupport[] {
  const byFamily = new Map<MemoFamily, string[]>();

  for (const templateId of listTemplateIds()) {
    const dispatch = resolveMemoDispatch(templateId);
    if (!dispatch) continue;
    const bucket = byFamily.get(dispatch.family) ?? [];
    bucket.push(templateId);
    byFamily.set(dispatch.family, bucket);
  }

  const families: MemoFamily[] = ['employment', 'founder-separation'];
  return families
    .filter((family) => (byFamily.get(family)?.length ?? 0) > 0)
    .map((family) => ({
      family,
      label: FAMILY_LABELS[family],
      templateIds: [...(byFamily.get(family) ?? [])].sort((left, right) => left.localeCompare(right)),
    }));
}

/**
 * The actionable error a user gets when `--memo` is asked for on a template no
 * memo family covers. It names what IS supported rather than only what is not,
 * which is the whole point of legal-explainer#2572: a precise capability error
 * plus a route the user can actually take.
 */
export function buildUnsupportedMemoFamilyMessage(templateId: string): string {
  const supported = listMemoSupportedTemplates();
  const lines: string[] = [
    `Memo generation is not available for template "${templateId}".`,
    '',
    'Templates that support --memo:',
  ];

  for (const family of supported) {
    lines.push(`  ${family.family} — ${family.label}`);
    for (const id of family.templateIds) {
      lines.push(`    ${id}`);
    }
  }

  if (supported.length === 0) {
    lines.push('  (none installed)');
  }

  lines.push('');
  lines.push(
    `Alternative for "${templateId}": re-run without --memo to produce the filled document, then run`
  );
  lines.push(
    `  open-agreements template show ${templateId}`
  );
  lines.push(
    'to review that template\'s fields and cited sources. Filing a request for a memo family covering'
  );
  lines.push(
    'this template at https://github.com/open-agreements/open-agreements/issues records the gap.'
  );

  return lines.join('\n');
}
