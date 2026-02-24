// Semantic tag emission + stripping for Safe-Docx TS.
//
// Parity goals (Python):
// - Emit <definition> tags for explicit definitions, absorbing quotes:
//     Input:  "Company" means ...
//     Output: <definition>Company</definition> means ...
//
// Headers are represented via a dedicated column (not inline tags) in TOON output.
export const DEFINITION_TAG = 'definition';
export const HIGHLIGHT_TAG = 'highlighting';
// Quote variants (subset of Python workflows/shared/regex/definitions.py).
// Includes ASCII and common smart quotes.
const QUOTES = `"'\u201c\u201d\u2018\u2019\u00ab\u00bb\u2039\u203a`;
const QUOTE_CHARS_CLASS = escapeForCharClass(QUOTES);
const QUOTE_CLASS = `[${QUOTE_CHARS_CLASS}]`;
// Port of DEFINITION_VERB_PATTERN (simplified but compatible with the Python export).
const DEF_VERB = '(?:' +
    '(?:shall\\s+)?means?|' +
    '(?:shall\\s+have|has|have)\\s+the\\s+meaning(?:\\s+(?:set\\s+forth|given|ascribed)\\s+in)?|' +
    '(?:is|are)\\s+defined\\s+as|' +
    'refers?\\s+to|' +
    '(?:shall\\s+)?mean\\s+and\\s+include' +
    ')';
const INLINE_DEFINITION_RE = new RegExp(`${QUOTE_CLASS}([^${QUOTE_CHARS_CLASS}]+)${QUOTE_CLASS}\\s+${DEF_VERB}`, 'gi');
const INLINE_DEFINITION_RE_ONE = new RegExp(`${QUOTE_CLASS}([^${QUOTE_CHARS_CLASS}]+)${QUOTE_CLASS}\\s+${DEF_VERB}`, 'i');
function escapeForCharClass(s) {
    // Escape characters that have meaning in a regex character class.
    return s.replace(/[-\\\]^]/g, '\\$&');
}
export function hasDefinitionTags(text) {
    return text.includes(`<${DEFINITION_TAG}>`) || text.includes(`</${DEFINITION_TAG}>`);
}
export function hasHighlightTags(text) {
    return text.includes(`<${HIGHLIGHT_TAG}>`) || text.includes(`</${HIGHLIGHT_TAG}>`);
}
export function emitDefinitionTagsFromString(text) {
    if (!text)
        return text;
    const matches = Array.from(text.matchAll(INLINE_DEFINITION_RE));
    if (matches.length === 0)
        return text;
    let tagged = text;
    // Replace from end to start to preserve offsets.
    for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        const term = m[1] ?? '';
        if (!term)
            continue;
        const matchStart = m.index ?? -1;
        if (matchStart < 0)
            continue;
        // Find the opening quote at matchStart, and the closing quote right after the term.
        // We want to replace the quoted term including both quotes.
        const openQuoteIdx = matchStart;
        const closeQuoteIdx = openQuoteIdx + 1 + term.length; // quote + term
        if (closeQuoteIdx >= tagged.length)
            continue;
        const before = tagged.slice(0, openQuoteIdx);
        const after = tagged.slice(closeQuoteIdx + 1); // +1 for closing quote
        tagged = `${before}<${DEFINITION_TAG}>${term}</${DEFINITION_TAG}>${after}`;
    }
    return tagged;
}
export function findInlineDefinitionSpan(text) {
    // Find the first explicit definition in text and return the defined-term span (excluding quotes).
    const m = INLINE_DEFINITION_RE_ONE.exec(text);
    if (!m || m.index == null)
        return null;
    const term = m[1] ?? '';
    if (!term)
        return null;
    const openQuoteIdx = m.index;
    const termStart = openQuoteIdx + 1;
    const termEnd = termStart + term.length;
    return { term, term_start: termStart, term_end: termEnd };
}
export function stripDefinitionTags(text) {
    // SINGLE SOURCE OF TRUTH for stripping: replace tags with quotes.
    return text
        .replaceAll(new RegExp(`<${DEFINITION_TAG}>`, 'g'), '"')
        .replaceAll(new RegExp(`</${DEFINITION_TAG}>`, 'g'), '"');
}
export function stripHighlightTags(text) {
    return text
        .replaceAll(new RegExp(`<${HIGHLIGHT_TAG}>`, 'g'), '')
        .replaceAll(new RegExp(`</${HIGHLIGHT_TAG}>`, 'g'), '');
}
// ── Formatting tag helpers ───────────────────────────────────────────
const FORMATTING_TAG_RE = /<\/?[biu]>/g;
const HYPERLINK_OPEN_RE = /<a\s+href="[^"]*">/g;
const HYPERLINK_CLOSE_RE = /<\/a>/g;
export function hasFormattingTags(text) {
    return FORMATTING_TAG_RE.test(text);
}
export function stripFormattingTags(text) {
    // Reset lastIndex since these are global regexes.
    FORMATTING_TAG_RE.lastIndex = 0;
    return text.replace(FORMATTING_TAG_RE, '');
}
export function hasHyperlinkTags(text) {
    return text.includes('<a ') || text.includes('</a>');
}
export function stripHyperlinkTags(text) {
    return text.replace(HYPERLINK_OPEN_RE, '').replace(HYPERLINK_CLOSE_RE, '');
}
/**
 * Detect definition spans on plain text, returning character offset ranges
 * and the defined term. Used by the formatting tag emitter to interleave
 * <definition> tags with formatting tags in a single consistent pass.
 *
 * Returns spans where:
 * - `start` = index of the opening quote character
 * - `end` = index one past the closing quote character
 * - `term` = the defined term text (excluding quotes)
 */
export function detectDefinitionSpans(text) {
    if (!text)
        return [];
    // Reset global regex state.
    INLINE_DEFINITION_RE.lastIndex = 0;
    const matches = Array.from(text.matchAll(INLINE_DEFINITION_RE));
    const spans = [];
    for (const m of matches) {
        const term = m[1] ?? '';
        if (!term)
            continue;
        const matchStart = m.index ?? -1;
        if (matchStart < 0)
            continue;
        const openQuoteIdx = matchStart;
        const termEnd = openQuoteIdx + 1 + term.length;
        // Verify close quote exists.
        if (termEnd < text.length) {
            spans.push({ start: openQuoteIdx, end: termEnd + 1, term });
        }
    }
    return spans;
}
//# sourceMappingURL=semantic_tags.js.map