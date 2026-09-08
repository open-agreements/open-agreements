/**
 * Shared advice-language guard for every memo family.
 *
 * A memo is operational information about template fields and cited sources —
 * it is not legal advice. Every memo family reuses these rules so a new family
 * cannot ship with a weaker guard than the employment memo that established
 * them. `applyAdviceLanguageGuard` rewrites prescriptive phrasing; the memo
 * generators then assert with `hasProhibitedAdviceLanguage` that nothing
 * prescriptive survived into the emitted artifact.
 */

const ADVICE_REWRITE_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bwe recommend\b/gi, replacement: 'this memo flags' },
  { pattern: /\byou should\b/gi, replacement: 'consider' },
  { pattern: /\byou must\b/gi, replacement: 'consider whether it is necessary to' },
  { pattern: /\bbest strategy\b/gi, replacement: 'possible operational approach' },
  { pattern: /\bour advice\b/gi, replacement: 'this informational output' },
  { pattern: /\bi advise\b/gi, replacement: 'this output notes' },
  { pattern: /\bthe right strategy\b/gi, replacement: 'one operational option' },
];

const ADVICE_BLOCK_PATTERNS: RegExp[] = [
  /\bwe recommend\b/i,
  /\byou should\b/i,
  /\byou must\b/i,
  /\bbest strategy\b/i,
  /\bour advice\b/i,
  /\bi advise\b/i,
  /\bthe right strategy\b/i,
];

export function applyAdviceLanguageGuard(input: string): string {
  let output = input;
  for (const rule of ADVICE_REWRITE_RULES) {
    output = output.replace(rule.pattern, rule.replacement);
  }
  return output.trim();
}

export function hasProhibitedAdviceLanguage(input: string): boolean {
  return ADVICE_BLOCK_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Every string reachable in a finished memo artifact, including the ones the
 * fill supplied verbatim.
 *
 * Enumerating sections by hand is how prohibited language escaped once already:
 * a citation echoed back from a field value was emitted but never checked. This
 * walks the artifact instead, so a section added later is covered without anyone
 * remembering to add it to a list.
 */
export function collectEmittedStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectEmittedStrings(entry, out);
    return out;
  }
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectEmittedStrings(entry, out);
    }
  }
  return out;
}

/**
 * Throw if any emitted memo string carries prescriptive advice language.
 *
 * A value the fill supplied verbatim is REJECTED rather than rewritten: silently
 * editing a citation would misquote the record it names, which is worse than
 * refusing to emit it.
 */
export function assertNoProhibitedAdviceLanguage(texts: readonly string[]): void {
  for (const text of texts) {
    if (hasProhibitedAdviceLanguage(text)) {
      throw new Error(
        `Memo text contains prohibited advice-like language: "${text}". `
        + 'A memo carries operational information, not prescriptive wording. If this text came from a '
        + 'field value, revise the value; this tool will not rewrite a supplied value, because editing a '
        + 'citation would misquote the record it names.'
      );
    }
  }
}

/** Assert over every string reachable in the finished artifact. */
export function assertMemoArtifactHasNoProhibitedAdviceLanguage(memo: unknown): void {
  assertNoProhibitedAdviceLanguage(collectEmittedStrings(memo));
}
