// Inline formatting tag emission for run-level formatting visibility in TOON output.
//
// Adds <b>, <i>, <u>, <highlighting>, and <a href="..."> tags around runs that
// deviate from a char-weighted modal baseline. When >=60% of non-header body
// chars share the same (bold, italic, underline) tuple, that tuple becomes the
// suppressed baseline and only deviating runs get b/i/u tags. Below 60%, runs
// emit absolute b/i/u tags.
import { HIGHLIGHT_TAG } from './semantic_tags.js';
// ── Baseline computation ─────────────────────────────────────────────
const SUPPRESSION_THRESHOLD = 0.60;
function fmtKey(bold, italic, underline) {
    return `${bold}|${italic}|${underline}`;
}
export function computeModalBaseline(runs) {
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
    const suppressed = bestChars / totalChars >= SUPPRESSION_THRESHOLD;
    return { bold, italic, underline, suppressed };
}
function tagsEqual(a, b) {
    return (a.hyperlinkUrl === b.hyperlinkUrl &&
        a.bold === b.bold &&
        a.italic === b.italic &&
        a.underline === b.underline &&
        a.highlighting === b.highlighting);
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
    if (tags.bold)
        out.push('<b>');
    if (tags.italic)
        out.push('<i>');
    if (tags.underline)
        out.push('<u>');
    if (tags.highlighting)
        out.push(`<${HIGHLIGHT_TAG}>`);
}
function desiredTagsForRun(run, baseline) {
    if (run.isHeaderRun) {
        return { hyperlinkUrl: null, bold: false, italic: false, underline: false, highlighting: false };
    }
    const highlighting = !!run.formatting.highlightVal;
    if (!baseline.suppressed) {
        return {
            hyperlinkUrl: run.hyperlinkUrl,
            bold: run.formatting.bold,
            italic: run.formatting.italic,
            underline: run.formatting.underline,
            highlighting,
        };
    }
    return {
        hyperlinkUrl: run.hyperlinkUrl,
        bold: run.formatting.bold !== baseline.bold ? run.formatting.bold : false,
        italic: run.formatting.italic !== baseline.italic ? run.formatting.italic : false,
        underline: run.formatting.underline !== baseline.underline ? run.formatting.underline : false,
        highlighting,
    };
}
export function emitFormattingTags(params) {
    const { runs, baseline, definitionSpans } = params;
    if (runs.length === 0)
        return '';
    // When there are no definition spans, use the fast per-run path.
    if (!definitionSpans || definitionSpans.length === 0) {
        return emitFormattingTagsSimple(runs, baseline);
    }
    // Build skip/insert maps from definition spans.
    // For each definition: skip the open-quote char, emit <definition>, skip close-quote char, emit </definition>.
    // Offsets relative to the plain-text character stream.
    const skipChars = new Set(); // chars to omit (quote chars)
    const insertBefore = new Map(); // tags to insert before a char
    const insertAfter = new Map(); // tags to insert after a char
    for (const ds of definitionSpans) {
        skipChars.add(ds.start); // open quote
        skipChars.add(ds.end - 1); // close quote
        insertBefore.set(ds.start + 1, '<definition>'); // before first term char
        insertAfter.set(ds.end - 2, '</definition>'); // after last term char
    }
    const out = [];
    const noTags = () => ({
        hyperlinkUrl: null,
        bold: false,
        italic: false,
        underline: false,
        highlighting: false,
    });
    let active = noTags();
    let plainOffset = 0;
    for (const run of runs) {
        if (!run.text)
            continue;
        const desired = desiredTagsForRun(run, baseline);
        for (let ci = 0; ci < run.text.length; ci++) {
            const gOffset = plainOffset + ci;
            // At a definition boundary, close formatting tags before emitting
            // semantic tags so we never interleave crossing tag structures.
            const insertB = insertBefore.get(gOffset);
            if (insertB) {
                closeTags(out, active);
                active = noTags();
                out.push(insertB);
            }
            // Skip quote characters that are absorbed into definition tags.
            if (!skipChars.has(gOffset)) {
                if (!tagsEqual(active, desired)) {
                    closeTags(out, active);
                    openTags(out, desired);
                    active = desired;
                }
                out.push(run.text[ci]);
            }
            // Insert definition close tag after this char.
            const insertA = insertAfter.get(gOffset);
            if (insertA) {
                closeTags(out, active);
                active = noTags();
                out.push(insertA);
            }
        }
        plainOffset += run.text.length;
    }
    closeTags(out, active);
    return out.join('');
}
/** Fast path when no definition spans need interleaving. */
function emitFormattingTagsSimple(runs, baseline) {
    const out = [];
    let active = {
        hyperlinkUrl: null,
        bold: false,
        italic: false,
        underline: false,
        highlighting: false,
    };
    for (const run of runs) {
        if (!run.text)
            continue;
        const desired = desiredTagsForRun(run, baseline);
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
export function mergeAdjacentTags(tagged) {
    // Collapse </b><b>, </i><i>, </u><u>, </highlighting><highlighting>.
    let result = tagged;
    let prev;
    do {
        prev = result;
        result = result
            .replace(/<\/b><b>/g, '')
            .replace(/<\/i><i>/g, '')
            .replace(/<\/u><u>/g, '')
            .replace(new RegExp(`</${HIGHLIGHT_TAG}><${HIGHLIGHT_TAG}>`, 'g'), '');
    } while (result !== prev);
    return result;
}
//# sourceMappingURL=formatting_tags.js.map