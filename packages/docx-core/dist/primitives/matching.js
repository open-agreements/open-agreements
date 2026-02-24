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
export function findUniqueSubstringMatch(haystack, needle) {
    if (!needle)
        return { status: 'not_found' };
    const hayBase = toMappedText(haystack);
    const needleBase = toMappedText(needle);
    const stages = [
        { mode: 'exact', transforms: [] },
        { mode: 'quote_normalized', transforms: [normalizeQuotes] },
        { mode: 'flexible_whitespace', transforms: [normalizeQuotes, collapseWhitespace] },
        { mode: 'quote_optional', transforms: [normalizeQuotes, collapseWhitespace, removeQuotes] },
    ];
    for (const stage of stages) {
        const h = applyTransforms(hayBase, stage.transforms);
        const n = applyTransforms(needleBase, stage.transforms);
        if (!n.text)
            continue;
        const hits = findAllMatchIndices(h.text, n.text);
        if (hits.length === 0)
            continue;
        if (hits.length > 1) {
            return {
                status: 'multiple',
                mode: stage.mode,
                matchCount: hits.length,
            };
        }
        const hit = hits[0];
        const startSpan = h.spans[hit];
        const endSpan = h.spans[hit + n.text.length - 1];
        const start = startSpan.start;
        const end = endSpan.end;
        return {
            status: 'unique',
            mode: stage.mode,
            matchCount: 1,
            start,
            end,
            matchedText: haystack.slice(start, end),
        };
    }
    return { status: 'not_found' };
}
//# sourceMappingURL=matching.js.map