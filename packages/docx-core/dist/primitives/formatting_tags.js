// Inline formatting tag emission for run-level formatting visibility in TOON output.
//
// Adds <b>, <i>, <u>, <highlighting>, <font>, and <a href="..."> tags around runs that
// deviate from baselines. BIU uses a document-wide char-weighted modal baseline.
// Font properties (color, size, face) use paragraph-local baselines.
// When >=60% of non-header body chars share the same tuple/value, that becomes the
// suppressed baseline and only deviating runs get tags.
import { HIGHLIGHT_TAG } from './semantic_tags.js';
// ── Baseline computation ─────────────────────────────────────────────
const SUPPRESSION_THRESHOLD = 0.60;
function fmtKey(bold, italic, underline) {
    return `${bold}|${italic}|${underline}`;
}
export function computeModalBaseline(runs, options) {
    const mode = options?.formattingMode ?? 'compact';
    // Only consider non-header body runs for baseline computation.
    const bodyRuns = runs.filter((r) => !r.isHeaderRun && r.charCount > 0);
    const totalChars = bodyRuns.reduce((sum, r) => sum + r.charCount, 0);
    if (totalChars === 0) {
        return { bold: false, italic: false, underline: false, suppressed: false };
    }
    const comboCounts = new Map();
    for (let i = 0; i < bodyRuns.length; i++) {
        const r = bodyRuns[i];
        const key = fmtKey(r.formatting.bold, r.formatting.italic, r.formatting.underline);
        const existing = comboCounts.get(key);
        if (existing) {
            existing.chars += r.charCount;
        }
        else {
            comboCounts.set(key, { chars: r.charCount, firstIdx: i });
        }
    }
    // Find modal combo. Tie-break by earliest run index.
    let bestKey = fmtKey(false, false, false);
    let bestChars = 0;
    let bestIdx = Number.MAX_SAFE_INTEGER;
    for (const [key, { chars, firstIdx }] of comboCounts) {
        if (chars > bestChars || (chars === bestChars && firstIdx < bestIdx)) {
            bestKey = key;
            bestChars = chars;
            bestIdx = firstIdx;
        }
    }
    const [boldStr, italicStr, underlineStr] = bestKey.split('|');
    const bold = boldStr === 'true';
    const italic = italicStr === 'true';
    const underline = underlineStr === 'true';
    const suppressed = mode === 'compact' && bestChars / totalChars >= SUPPRESSION_THRESHOLD;
    return { bold, italic, underline, suppressed };
}
// ── Paragraph-local font baseline ───────────────────────────────────
function computeModalString(runs, extract, mode = 'compact') {
    const bodyRuns = runs.filter((r) => !r.isHeaderRun && r.charCount > 0);
    const totalChars = bodyRuns.reduce((sum, r) => sum + r.charCount, 0);
    if (totalChars === 0)
        return { modal: null, suppressed: false };
    const counts = new Map();
    for (const r of bodyRuns) {
        const val = extract(r) ?? '';
        counts.set(val, (counts.get(val) ?? 0) + r.charCount);
    }
    let bestVal = '';
    let bestChars = 0;
    for (const [val, chars] of counts) {
        if (chars > bestChars) {
            bestVal = val;
            bestChars = chars;
        }
    }
    return {
        modal: bestVal || null,
        suppressed: mode === 'compact' && bestChars / totalChars >= SUPPRESSION_THRESHOLD,
    };
}
function computeModalNumber(runs, extract, mode = 'compact') {
    const bodyRuns = runs.filter((r) => !r.isHeaderRun && r.charCount > 0);
    const totalChars = bodyRuns.reduce((sum, r) => sum + r.charCount, 0);
    if (totalChars === 0)
        return { modal: 0, suppressed: false };
    const counts = new Map();
    for (const r of bodyRuns) {
        const val = extract(r);
        counts.set(val, (counts.get(val) ?? 0) + r.charCount);
    }
    let bestVal = 0;
    let bestChars = 0;
    for (const [val, chars] of counts) {
        if (chars > bestChars) {
            bestVal = val;
            bestChars = chars;
        }
    }
    return {
        modal: bestVal,
        suppressed: mode === 'compact' && bestChars / totalChars >= SUPPRESSION_THRESHOLD,
    };
}
export function computeParagraphFontBaseline(runs, options) {
    const mode = options?.formattingMode ?? 'compact';
    const color = computeModalString(runs, (r) => r.formatting.colorHex, mode);
    const fontSize = computeModalNumber(runs, (r) => r.formatting.fontSizePt, mode);
    const fontName = computeModalString(runs, (r) => r.formatting.fontName, mode);
    return {
        modalColor: color.modal,
        colorSuppressed: color.suppressed,
        modalFontSizePt: fontSize.modal,
        fontSizeSuppressed: fontSize.suppressed,
        modalFontName: fontName.modal ?? '',
        fontNameSuppressed: fontName.suppressed,
    };
}
function tagsEqual(a, b) {
    return (a.hyperlinkUrl === b.hyperlinkUrl &&
        a.bold === b.bold &&
        a.italic === b.italic &&
        a.underline === b.underline &&
        a.highlighting === b.highlighting &&
        a.color === b.color &&
        a.fontSize === b.fontSize &&
        a.fontName === b.fontName);
}
function fontTagString(tags) {
    const attrs = [];
    if (tags.color !== null)
        attrs.push(`color="${tags.color}"`);
    if (tags.fontSize !== null)
        attrs.push(`size="${tags.fontSize}"`);
    if (tags.fontName !== null)
        attrs.push(`face="${tags.fontName}"`);
    return attrs.length > 0 ? `<font ${attrs.join(' ')}>` : null;
}
function hasFontAttrs(tags) {
    return tags.color !== null || tags.fontSize !== null || tags.fontName !== null;
}
function closeTags(out, tags) {
    if (tags.highlighting)
        out.push(`</${HIGHLIGHT_TAG}>`);
    if (tags.underline)
        out.push('</u>');
    if (tags.italic)
        out.push('</i>');
    if (tags.bold)
        out.push('</b>');
    if (hasFontAttrs(tags))
        out.push('</font>');
    if (tags.hyperlinkUrl !== null)
        out.push('</a>');
}
function escapeHtmlAttribute(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}
function openTags(out, tags) {
    if (tags.hyperlinkUrl !== null) {
        out.push(`<a href="${escapeHtmlAttribute(tags.hyperlinkUrl)}">`);
    }
    const ft = fontTagString(tags);
    if (ft)
        out.push(ft);
    if (tags.bold)
        out.push('<b>');
    if (tags.italic)
        out.push('<i>');
    if (tags.underline)
        out.push('<u>');
    if (tags.highlighting)
        out.push(`<${HIGHLIGHT_TAG}>`);
}
function desiredTagsForRun(run, baseline, fontBaseline) {
    if (run.isHeaderRun) {
        return {
            hyperlinkUrl: null,
            bold: false, italic: false, underline: false, highlighting: false,
            color: null, fontSize: null, fontName: null,
        };
    }
    const highlighting = !!run.formatting.highlightVal;
    // BIU
    let bold;
    let italic;
    let underline;
    if (!baseline.suppressed) {
        bold = run.formatting.bold;
        italic = run.formatting.italic;
        underline = run.formatting.underline;
    }
    else {
        bold = run.formatting.bold !== baseline.bold ? run.formatting.bold : false;
        italic = run.formatting.italic !== baseline.italic ? run.formatting.italic : false;
        underline = run.formatting.underline !== baseline.underline ? run.formatting.underline : false;
    }
    // Font properties (paragraph-local baseline)
    let color = null;
    let fontSize = null;
    let fontName = null;
    if (fontBaseline) {
        // Color: emit only when suppressed and differs from modal, or not suppressed and has a value
        if (fontBaseline.colorSuppressed) {
            if (run.formatting.colorHex !== fontBaseline.modalColor) {
                color = run.formatting.colorHex;
            }
        }
        else if (run.formatting.colorHex) {
            color = run.formatting.colorHex;
        }
        // Font size: emit only when suppressed and differs from modal, or not suppressed and > 0
        if (fontBaseline.fontSizeSuppressed) {
            if (run.formatting.fontSizePt !== fontBaseline.modalFontSizePt) {
                fontSize = run.formatting.fontSizePt;
            }
        }
        else if (run.formatting.fontSizePt > 0) {
            fontSize = run.formatting.fontSizePt;
        }
        // Font name: emit only when suppressed and differs from modal, or not suppressed and has a value
        if (fontBaseline.fontNameSuppressed) {
            if (run.formatting.fontName !== fontBaseline.modalFontName) {
                fontName = run.formatting.fontName || null;
            }
        }
        else if (run.formatting.fontName) {
            fontName = run.formatting.fontName;
        }
    }
    return {
        hyperlinkUrl: run.hyperlinkUrl,
        bold, italic, underline, highlighting,
        color, fontSize, fontName,
    };
}
export function emitFormattingTags(params) {
    const { runs, baseline, fontBaseline } = params;
    if (runs.length === 0)
        return '';
    const out = [];
    let active = {
        hyperlinkUrl: null,
        bold: false, italic: false, underline: false, highlighting: false,
        color: null, fontSize: null, fontName: null,
    };
    for (const run of runs) {
        if (!run.text)
            continue;
        const desired = desiredTagsForRun(run, baseline, fontBaseline ?? null);
        if (!tagsEqual(active, desired)) {
            closeTags(out, active);
            openTags(out, desired);
            active = desired;
        }
        out.push(run.text);
    }
    closeTags(out, active);
    return out.join('');
}
// ── Adjacent tag merging ─────────────────────────────────────────────
// Build a pattern matching </font><font ...> with identical attributes.
const FONT_ADJACENT_RE = /<\/font>(<font [^>]*>)/g;
export function mergeAdjacentTags(tagged) {
    let result = tagged;
    let prev;
    do {
        prev = result;
        result = result
            .replace(/<\/b><b>/g, '')
            .replace(/<\/i><i>/g, '')
            .replace(/<\/u><u>/g, '')
            .replace(new RegExp(`</${HIGHLIGHT_TAG}><${HIGHLIGHT_TAG}>`, 'g'), '');
        // Collapse identical adjacent font tags: </font><font color="X" size="Y"> → remove if same
        FONT_ADJACENT_RE.lastIndex = 0;
        result = result.replace(FONT_ADJACENT_RE, (_match, nextOpen, offset) => {
            // Find the preceding <font ...> opening tag for this </font>
            const beforeClose = result.slice(0, offset);
            const lastOpenIdx = beforeClose.lastIndexOf('<font ');
            if (lastOpenIdx === -1)
                return _match;
            const lastOpenEnd = beforeClose.indexOf('>', lastOpenIdx);
            if (lastOpenEnd === -1)
                return _match;
            const prevOpen = beforeClose.slice(lastOpenIdx, lastOpenEnd + 1);
            if (prevOpen === nextOpen)
                return ''; // identical — merge
            return _match;
        });
    } while (result !== prev);
    return result;
}
//# sourceMappingURL=formatting_tags.js.map