/**
 * merge_runs — merge adjacent format-identical runs within paragraphs.
 *
 * Safety barriers: never merge across fldChar/instrText, comment range,
 * bookmark, or tracked-change wrapper boundaries.
 */
import { XMLSerializer } from '@xmldom/xmldom';
import { OOXML, W } from './namespaces.js';
// ── Barrier element local names ────────────────────────────────────────
const BARRIER_LOCALS = new Set([
    W.fldChar,
    W.instrText,
    W.bookmarkStart,
    W.bookmarkEnd,
    'commentRangeStart',
    'commentRangeEnd',
]);
const TC_WRAPPER_LOCALS = new Set([
    'ins',
    'del',
    'moveFrom',
    'moveTo',
]);
// ── Helpers ────────────────────────────────────────────────────────────
const serializer = new XMLSerializer();
function isW(el, localName) {
    return el.namespaceURI === OOXML.W_NS && el.localName === localName;
}
function isWRun(node) {
    return (node.nodeType === 1 &&
        node.namespaceURI === OOXML.W_NS &&
        node.localName === W.r);
}
/** Strip all w:rsid* attributes from an element and its descendants. */
function stripRsidAttributes(el) {
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
        const name = attr.localName ?? attr.name;
        if (/^rsid/i.test(name)) {
            el.removeAttributeNode(attr);
        }
    }
    let child = el.firstChild;
    while (child) {
        if (child.nodeType === 1)
            stripRsidAttributes(child);
        child = child.nextSibling;
    }
}
/**
 * Canonical key for a run's direct formatting. Two runs with the same
 * key have identical formatting and can be merged (if no barriers).
 */
function runFormattingKey(run) {
    const rPr = run.getElementsByTagNameNS(OOXML.W_NS, W.rPr).item(0);
    if (!rPr)
        return '';
    const clone = rPr.cloneNode(true);
    stripRsidAttributes(clone);
    return serializer.serializeToString(clone);
}
/** Check whether a run contains barrier content (fldChar, instrText). */
function runContainsBarrierContent(run) {
    let child = run.firstChild;
    while (child) {
        if (child.nodeType === 1) {
            const el = child;
            if (el.namespaceURI === OOXML.W_NS && BARRIER_LOCALS.has(el.localName)) {
                return true;
            }
        }
        child = child.nextSibling;
    }
    return false;
}
/** Content children of a run (everything except w:rPr). */
function runContentChildren(run) {
    const out = [];
    let child = run.firstChild;
    while (child) {
        if (child.nodeType === 1 && isW(child, W.rPr)) {
            child = child.nextSibling;
            continue;
        }
        out.push(child);
        child = child.nextSibling;
    }
    return out;
}
/** Remove all `<w:proofErr>` elements from a paragraph. */
function removeProofErrors(paragraph) {
    const proofErrs = Array.from(paragraph.getElementsByTagNameNS(OOXML.W_NS, 'proofErr'));
    for (const el of proofErrs) {
        el.parentNode?.removeChild(el);
    }
    return proofErrs.length;
}
// ── Run group collection ───────────────────────────────────────────────
/**
 * Collect groups of adjacent w:r elements within the same parent, not
 * separated by barrier elements. Each group is a merge candidate.
 */
function collectMergeableRunGroups(paragraph) {
    const allGroups = [];
    const containers = [paragraph];
    // Also collect runs inside tracked-change wrappers
    for (const local of TC_WRAPPER_LOCALS) {
        const wrappers = Array.from(paragraph.getElementsByTagNameNS(OOXML.W_NS, local));
        containers.push(...wrappers);
    }
    for (const container of containers) {
        let currentGroup = [];
        let child = container.firstChild;
        while (child) {
            if (child.nodeType === 1) {
                const el = child;
                if (isWRun(el)) {
                    currentGroup.push(el);
                }
                else {
                    // Any non-run element breaks the group
                    if (currentGroup.length > 0) {
                        allGroups.push(currentGroup);
                        currentGroup = [];
                    }
                }
            }
            child = child.nextSibling;
        }
        if (currentGroup.length > 0) {
            allGroups.push(currentGroup);
        }
    }
    return allGroups;
}
/** Merge adjacent format-identical runs within a paragraph. */
function mergeParagraphRuns(paragraph) {
    let merged = 0;
    const groups = collectMergeableRunGroups(paragraph);
    for (const group of groups) {
        if (group.length < 2)
            continue;
        let i = 0;
        while (i < group.length - 1) {
            const current = group[i];
            const next = group[i + 1];
            if (!runContainsBarrierContent(current) &&
                !runContainsBarrierContent(next) &&
                runFormattingKey(current) === runFormattingKey(next)) {
                // Move all content children of `next` into `current`.
                for (const node of runContentChildren(next)) {
                    current.appendChild(node);
                }
                next.parentNode?.removeChild(next);
                group.splice(i + 1, 1);
                merged++;
            }
            else {
                i++;
            }
        }
    }
    return merged;
}
// ── Public API ─────────────────────────────────────────────────────────
/**
 * Merge adjacent format-identical runs across all paragraphs in the
 * document body. Removes `<w:proofErr>` elements and strips `rsid`
 * attributes from runs before comparison.
 *
 * Safety barriers prevent merges across:
 * - Field boundaries (fldChar, instrText)
 * - Comment range boundaries (commentRangeStart, commentRangeEnd)
 * - Bookmark boundaries (bookmarkStart, bookmarkEnd)
 * - Tracked-change wrapper boundaries (ins, del, moveFrom, moveTo)
 */
export function mergeRuns(doc) {
    const body = doc.getElementsByTagNameNS(OOXML.W_NS, W.body).item(0);
    if (!body)
        return { runsMerged: 0, proofErrRemoved: 0 };
    let totalMerged = 0;
    let totalProofErr = 0;
    const paragraphs = Array.from(body.getElementsByTagNameNS(OOXML.W_NS, W.p));
    for (const p of paragraphs) {
        totalProofErr += removeProofErrors(p);
        // Strip rsid attributes from all runs before comparing.
        const runs = Array.from(p.getElementsByTagNameNS(OOXML.W_NS, W.r));
        for (const r of runs) {
            stripRsidAttributes(r);
        }
        totalMerged += mergeParagraphRuns(p);
    }
    return { runsMerged: totalMerged, proofErrRemoved: totalProofErr };
}
//# sourceMappingURL=merge_runs.js.map