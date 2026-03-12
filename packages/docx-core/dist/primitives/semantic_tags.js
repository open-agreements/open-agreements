// Semantic tag emission + stripping for Safe-Docx TS.
//
// Headers are represented via a dedicated column (not inline tags) in TOON output.
export const HIGHLIGHT_TAG = 'highlight';
// Formatting tag helpers ───────────────────────────────────────────
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
export function hasHighlightTags(text) {
    return (text.includes(`<${HIGHLIGHT_TAG}>`) ||
        text.includes(`</${HIGHLIGHT_TAG}>`) ||
        text.includes('<highlighting>') ||
        text.includes('</highlighting>'));
}
export function stripHighlightTags(text) {
    return text
        .replaceAll(new RegExp(`<${HIGHLIGHT_TAG}>`, 'g'), '')
        .replaceAll(new RegExp(`</${HIGHLIGHT_TAG}>`, 'g'), '')
        .replaceAll(/<highlighting>/g, '')
        .replaceAll(/<\/highlighting>/g, '');
}
// Font tag helpers ─────────────────────────────────────────────────
const FONT_OPEN_RE = /<font\b[^>]*>/g;
const FONT_CLOSE_RE = /<\/font>/g;
export function hasFontTags(text) {
    return text.includes('<font') || text.includes('</font>');
}
export function stripFontTags(text) {
    FONT_OPEN_RE.lastIndex = 0;
    return text.replace(FONT_OPEN_RE, '').replace(FONT_CLOSE_RE, '');
}
// General-purpose inline tag stripper ──────────────────────────────
const ALL_INLINE_TAGS_RE = /<\/?(?:b|i|u|highlight|highlighting|a|font|header|RunInHeader|definition)(?:\s[^>]*)?>|<a\s+href="[^"]*">/g;
/**
 * Strip ALL known inline tags from text. Handles `<b>`, `<i>`, `<u>`,
 * `<highlight>`, `<highlighting>`, `<a href="...">`, `</a>`, `<font ...>`,
 * `</font>`, `<header>`, `</header>`, `<RunInHeader>`, `</RunInHeader>`,
 * `<definition>`, `</definition>`.
 */
export function stripAllInlineTags(text) {
    ALL_INLINE_TAGS_RE.lastIndex = 0;
    return text.replace(ALL_INLINE_TAGS_RE, '');
}
//# sourceMappingURL=semantic_tags.js.map