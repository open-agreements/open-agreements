const DOUBLE_QUOTE_EQUIVALENTS = new Set([
    '"',
    '\u201c',
    '\u201d',
    '\u00ab',
    '\u00bb',
    '\u2039',
    '\u203a',
]);
const SINGLE_QUOTE_EQUIVALENTS = new Set([
    "'",
    '\u2018',
    '\u2019',
]);
function isQuoteChar(ch) {
    return DOUBLE_QUOTE_EQUIVALENTS.has(ch) || SINGLE_QUOTE_EQUIVALENTS.has(ch);
}
function normalizeQuoteChar(ch) {
    if (DOUBLE_QUOTE_EQUIVALENTS.has(ch))
        return '"';
    if (SINGLE_QUOTE_EQUIVALENTS.has(ch))
        return "'";
    return ch;
}
function isWhitespaceChar(ch) {
    return /\s/u.test(ch);
}
function toMappedText(text) {
    const spans = [];
    for (let i = 0; i < text.length; i++)
        spans.push({ start: i, end: i + 1 });
    return { text, spans };
}
function applyTransforms(base, transforms) {
    let out = base;
    for (const transform of transforms)
        out = transform(out);
    return out;
}
function normalizeQuotes(input) {
    if (!input.text)
        return input;
    let out = '';
    for (let i = 0; i < input.text.length; i++)
        out += normalizeQuoteChar(input.text[i]);
    return { text: out, spans: input.spans.slice() };
}
function collapseWhitespace(input) {
    if (!input.text)
        return input;
    const outChars = [];
    const outSpans = [];
    let i = 0;
    while (i < input.text.length) {
        const ch = input.text[i];
        if (!isWhitespaceChar(ch)) {
            outChars.push(ch);
            outSpans.push(input.spans[i]);
            i += 1;
            continue;
        }
        const spanStart = input.spans[i].start;
        let spanEnd = input.spans[i].end;
        i += 1;
        while (i < input.text.length && isWhitespaceChar(input.text[i])) {
            spanEnd = input.spans[i].end;
            i += 1;
        }
        outChars.push(' ');
        outSpans.push({ start: spanStart, end: spanEnd });
    }
    return { text: outChars.join(''), spans: outSpans };
}
function removeQuotes(input) {
    if (!input.text)
        return input;
    const outChars = [];
    const outSpans = [];
    for (let i = 0; i < input.text.length; i++) {
        const ch = input.text[i];
        if (isQuoteChar(ch))
            continue;
        outChars.push(ch);
        outSpans.push(input.spans[i]);
    }
    return { text: outChars.join(''), spans: outSpans };
}
function stripAllTags(input) {
    if (!input.text)
        return input;
    const tags = [
        /<\/?[biu]>/g,
        /<a\s+href="[^"]*">/g,
        /<\/a>/g,
        /<highlight>/g,
        /<\/highlight>/g,
        /<highlighting>/g,
        /<\/highlighting>/g,
    ];
    let text = input.text;
    const spans = input.spans.slice();
    for (const tag of tags) {
        let match;
        tag.lastIndex = 0;
        while ((match = tag.exec(text)) !== null) {
            const len = match[0].length;
            const idx = match.index;
            text = text.slice(0, idx) + text.slice(idx + len);
            spans.splice(idx, len);
            tag.lastIndex = idx;
        }
    }
    return { text, spans };
}
function findAllMatchIndices(haystack, needle) {
    if (!needle)
        return [];
    const hits = [];
    let from = 0;
    while (from <= haystack.length - needle.length) {
        const idx = haystack.indexOf(needle, from);
        if (idx === -1)
            break;
        hits.push(idx);
        from = idx + 1;
    }
    return hits;
}
/**
 * Transfer the document's smart-quote style to a target string.
 *
 * Scans `documentText` for the first left/right double and single smart-quote
 * variants, then replaces straight quotes in `targetText` with those variants.
 * Uses positional context (after whitespace/punctuation/start → opening, else closing)
 * to choose the correct direction.
 *
 * Returns `targetText` unchanged when `documentText` contains no smart quotes.
 * Angle quotes (« » ‹ ›) are explicitly non-goal for v1.
 */
export function applyDocumentQuoteStyle(documentText, targetText) {
    // Detect which smart-quote variants the document uses.
    let leftDouble = null;
    let rightDouble = null;
    let leftSingle = null;
    let rightSingle = null;
    // Angle quotes are excluded from transfer (v1 non-goal).
    const ANGLE_QUOTES = new Set(['\u00ab', '\u00bb', '\u2039', '\u203a']);
    for (const ch of documentText) {
        if (ANGLE_QUOTES.has(ch))
            continue;
        if (ch === '\u201c' && !leftDouble)
            leftDouble = ch;
        if (ch === '\u201d' && !rightDouble)
            rightDouble = ch;
        if (ch === '\u2018' && !leftSingle)
            leftSingle = ch;
        if (ch === '\u2019' && !rightSingle)
            rightSingle = ch;
    }
    // No smart quotes in document → return unchanged.
    if (!leftDouble && !rightDouble && !leftSingle && !rightSingle)
        return targetText;
    let result = '';
    for (let i = 0; i < targetText.length; i++) {
        const ch = targetText[i];
        if (ch === '"' && (leftDouble || rightDouble)) {
            // Determine opening vs closing by looking at the preceding character.
            const prev = i > 0 ? targetText[i - 1] : '';
            const isOpening = i === 0 || /[\s(\[{]/.test(prev);
            result += isOpening ? (leftDouble ?? rightDouble) : (rightDouble ?? leftDouble);
            continue;
        }
        if (ch === "'" && (leftSingle || rightSingle)) {
            const prev = i > 0 ? targetText[i - 1] : '';
            const isOpening = i === 0 || /[\s(\[{]/.test(prev);
            result += isOpening ? (leftSingle ?? rightSingle) : (rightSingle ?? leftSingle);
            continue;
        }
        result += ch;
    }
    return result;
}
export function findUniqueSubstringMatch(haystack, needle, options = {}) {
    if (!needle)
        return { status: 'not_found' };
    const hayBase = toMappedText(haystack);
    const needleBase = toMappedText(needle);
    const stages = [
        { mode: 'exact', transforms: [] },
        { mode: 'clean', transforms: [stripAllTags] },
        { mode: 'quote_normalized', transforms: [stripAllTags, normalizeQuotes] },
        { mode: 'flexible_whitespace', transforms: [stripAllTags, normalizeQuotes, collapseWhitespace] },
        { mode: 'quote_optional', transforms: [stripAllTags, normalizeQuotes, collapseWhitespace, removeQuotes] },
    ];
    const targetMode = options.mode === 'default' ? undefined : options.mode;
    for (const stage of stages) {
        if (targetMode !== undefined && stage.mode !== targetMode)
            continue;
        const h = applyTransforms(hayBase, stage.transforms);
        const n = applyTransforms(needleBase, stage.transforms);
        if (!n.text)
            continue;
        const hits = findAllMatchIndices(h.text, n.text);
        if (hits.length === 0)
            continue;
        if (hits.length > 1) {
            return { status: 'multiple', mode: stage.mode, matchCount: hits.length };
        }
        const hit = hits[0];
        const startSpan = h.spans[hit];
        const endSpan = h.spans[hit + n.text.length - 1];
        return {
            status: 'unique',
            mode: stage.mode,
            matchCount: 1,
            start: startSpan.start,
            end: endSpan.end,
            matchedText: haystack.slice(startSpan.start, endSpan.end),
        };
    }
    return { status: 'not_found' };
}
//# sourceMappingURL=matching.js.map