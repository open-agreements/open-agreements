/**
 * extract_revisions — walk tracked-change markup in a document body and
 * return structured per-paragraph revision records with before/after text.
 *
 * Algorithm:
 * 1. Clone DOM twice → acceptChanges() on one, rejectChanges() on the other
 * 2. Walk all w:p in the *original* tracked DOM (including inside w:tc table cells)
 * 3. For each paragraph with revision wrappers, look up before_text (rejected clone)
 *    and after_text (accepted clone) by _bk_* bookmark ID
 * 4. Collect individual revision entries with type, text, author
 * 5. Join comments by anchoredParagraphId
 * 6. Apply offset/limit pagination
 */
import { OOXML } from './namespaces.js';
import { acceptChanges } from './accept_changes.js';
import { rejectChanges } from './reject_changes.js';
import { getParagraphText } from './text.js';
import { getParagraphBookmarkId, findParagraphByBookmarkId } from './bookmarks.js';
const W_NS = OOXML.W_NS;
// ── Internal helpers ────────────────────────────────────────────────
function isW(node, localName) {
    return (node.nodeType === 1 &&
        node.namespaceURI === W_NS &&
        node.localName === localName);
}
// Revision wrapper local names
const REVISION_WRAPPER_LOCALS = new Set(['ins', 'del', 'moveFrom', 'moveTo']);
// Property change local names
const PR_CHANGE_LOCALS = new Set([
    'rPrChange', 'pPrChange', 'sectPrChange',
    'tblPrChange', 'trPrChange', 'tcPrChange',
]);
/**
 * Check if a paragraph is entirely inserted (all content is inside w:ins).
 * Such paragraphs have no "before" state — they didn't exist before the edit.
 */
function paragraphIsEntirelyInserted(p) {
    // Check for paragraph-level insertion marker: w:pPr > w:rPr > w:ins
    for (let i = 0; i < p.childNodes.length; i++) {
        const child = p.childNodes[i];
        if (!isW(child, 'pPr'))
            continue;
        for (let j = 0; j < child.childNodes.length; j++) {
            if (!isW(child.childNodes[j], 'rPr'))
                continue;
            for (let k = 0; k < child.childNodes[j].childNodes.length; k++) {
                if (isW(child.childNodes[j].childNodes[k], 'ins'))
                    return true;
            }
        }
    }
    // Check if all content-bearing children are inside w:ins
    let hasContent = false;
    for (let i = 0; i < p.childNodes.length; i++) {
        const child = p.childNodes[i];
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (el.namespaceURI !== W_NS)
            continue;
        const local = el.localName;
        if (local === 'pPr' || local === 'bookmarkStart' || local === 'bookmarkEnd')
            continue;
        if (local === 'ins' || local === 'moveTo') {
            hasContent = true;
            continue;
        }
        // Any content outside ins/moveTo means not entirely inserted
        if (local === 'r' || local === 'del' || local === 'moveFrom')
            return false;
    }
    return hasContent;
}
/**
 * Check if a paragraph is entirely deleted (all content is inside w:del).
 * Such paragraphs have no "after" state — they were fully removed.
 */
function paragraphIsEntirelyDeleted(p) {
    // Check for paragraph-level deletion marker: w:pPr > w:rPr > w:del
    for (let i = 0; i < p.childNodes.length; i++) {
        const child = p.childNodes[i];
        if (!isW(child, 'pPr'))
            continue;
        for (let j = 0; j < child.childNodes.length; j++) {
            if (!isW(child.childNodes[j], 'rPr'))
                continue;
            for (let k = 0; k < child.childNodes[j].childNodes.length; k++) {
                if (isW(child.childNodes[j].childNodes[k], 'del'))
                    return true;
            }
        }
    }
    // Check if all content-bearing children are inside w:del
    let hasContent = false;
    for (let i = 0; i < p.childNodes.length; i++) {
        const child = p.childNodes[i];
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (el.namespaceURI !== W_NS)
            continue;
        const local = el.localName;
        if (local === 'pPr' || local === 'bookmarkStart' || local === 'bookmarkEnd')
            continue;
        if (local === 'del' || local === 'moveFrom') {
            hasContent = true;
            continue;
        }
        // Any content outside del/moveFrom means not entirely deleted
        if (local === 'r' || local === 'ins' || local === 'moveTo')
            return false;
    }
    return hasContent;
}
/**
 * Check if a paragraph contains any revision wrappers or property change records.
 */
function paragraphHasRevisions(p) {
    // Check for revision wrappers (w:ins, w:del, w:moveFrom, w:moveTo)
    for (const local of REVISION_WRAPPER_LOCALS) {
        if (p.getElementsByTagNameNS(W_NS, local).length > 0)
            return true;
    }
    // Check for property change records
    for (const local of PR_CHANGE_LOCALS) {
        if (p.getElementsByTagNameNS(W_NS, local).length > 0)
            return true;
    }
    return false;
}
/**
 * Extract text content from an element's w:t and w:delText children (recursive through runs).
 */
function getRevisionText(el) {
    const parts = [];
    const ts = el.getElementsByTagNameNS(W_NS, 't');
    for (let i = 0; i < ts.length; i++) {
        parts.push(ts[i].textContent ?? '');
    }
    const delTs = el.getElementsByTagNameNS(W_NS, 'delText');
    for (let i = 0; i < delTs.length; i++) {
        parts.push(delTs[i].textContent ?? '');
    }
    return parts.join('');
}
function getAttr(el, localName) {
    return el.getAttributeNS(W_NS, localName) ?? el.getAttribute(`w:${localName}`) ?? '';
}
/**
 * Collect individual revision entries from a paragraph's revision wrappers.
 */
function collectRevisionEntries(p) {
    const entries = [];
    // Collect from w:ins wrappers
    const insEls = p.getElementsByTagNameNS(W_NS, 'ins');
    for (let i = 0; i < insEls.length; i++) {
        const ins = insEls[i];
        // Skip paragraph-level markers (inside pPr/rPr)
        if (isInsidePPrOrRPr(ins, p))
            continue;
        entries.push({
            type: 'INSERTION',
            text: getRevisionText(ins),
            author: getAttr(ins, 'author'),
        });
    }
    // Collect from w:del wrappers
    const delEls = p.getElementsByTagNameNS(W_NS, 'del');
    for (let i = 0; i < delEls.length; i++) {
        const del = delEls[i];
        if (isInsidePPrOrRPr(del, p))
            continue;
        entries.push({
            type: 'DELETION',
            text: getRevisionText(del),
            author: getAttr(del, 'author'),
        });
    }
    // Collect from w:moveFrom wrappers
    const moveFromEls = p.getElementsByTagNameNS(W_NS, 'moveFrom');
    for (let i = 0; i < moveFromEls.length; i++) {
        const mf = moveFromEls[i];
        entries.push({
            type: 'MOVE_FROM',
            text: getRevisionText(mf),
            author: getAttr(mf, 'author'),
        });
    }
    // Collect from w:moveTo wrappers
    const moveToEls = p.getElementsByTagNameNS(W_NS, 'moveTo');
    for (let i = 0; i < moveToEls.length; i++) {
        const mt = moveToEls[i];
        entries.push({
            type: 'MOVE_TO',
            text: getRevisionText(mt),
            author: getAttr(mt, 'author'),
        });
    }
    // Collect FORMAT_CHANGE from *PrChange records
    for (const localName of PR_CHANGE_LOCALS) {
        const changes = p.getElementsByTagNameNS(W_NS, localName);
        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];
            entries.push({
                type: 'FORMAT_CHANGE',
                text: '',
                author: getAttr(change, 'author'),
            });
        }
    }
    return entries;
}
/**
 * Check if an element is nested inside w:pPr or w:rPr within the given paragraph.
 * These are paragraph-level revision markers, not content revisions.
 */
function isInsidePPrOrRPr(el, paragraph) {
    let cur = el.parentNode;
    while (cur && cur !== paragraph) {
        if (cur.nodeType === 1) {
            const cel = cur;
            if (cel.namespaceURI === W_NS && cel.localName === 'pPr')
                return true;
            const parent = cel.parentNode;
            if (cel.namespaceURI === W_NS && cel.localName === 'rPr' &&
                parent && parent.namespaceURI === W_NS && parent.localName === 'pPr') {
                return true;
            }
        }
        cur = cur.parentNode;
    }
    return false;
}
/**
 * Convert a Comment (from getComments()) to a RevisionComment.
 */
function commentToRevisionComment(c) {
    const rc = {
        author: c.author,
        text: c.text,
        date: c.date || null,
    };
    if (c.replies.length > 0) {
        rc.replies = c.replies.map(commentToRevisionComment);
    }
    return rc;
}
// ── Public API ──────────────────────────────────────────────────────
/**
 * Extract structured revision data from a document with tracked changes.
 *
 * @param doc - The original document DOM with tracked changes
 * @param comments - Comments from getComments() (with anchoredParagraphId resolved)
 * @param opts - Pagination options: offset (0-based) and limit
 */
export function extractRevisions(doc, comments, opts) {
    const body = doc.getElementsByTagNameNS(W_NS, 'body').item(0);
    if (!body) {
        return { changes: [], total_changes: 0, has_more: false };
    }
    // Clone DOM twice and apply accept/reject
    const acceptedDoc = doc.cloneNode(true);
    const rejectedDoc = doc.cloneNode(true);
    acceptChanges(acceptedDoc);
    rejectChanges(rejectedDoc);
    // Build comment lookup by anchoredParagraphId
    const commentsByParaId = new Map();
    for (const c of comments) {
        if (c.anchoredParagraphId) {
            const existing = commentsByParaId.get(c.anchoredParagraphId);
            if (existing) {
                existing.push(c);
            }
            else {
                commentsByParaId.set(c.anchoredParagraphId, [c]);
            }
        }
    }
    // Walk all paragraphs in the original tracked DOM
    const allParagraphs = Array.from(body.getElementsByTagNameNS(W_NS, 'p'));
    const changedParagraphs = [];
    for (const p of allParagraphs) {
        if (!paragraphHasRevisions(p))
            continue;
        const paraId = getParagraphBookmarkId(p);
        if (!paraId)
            continue; // All paragraphs should have bookmarks from session resolution
        // Detect entirely-inserted/deleted paragraphs to avoid stale bookmark lookups.
        // When rejectChanges() removes an inserted paragraph, it relocates bookmarks
        // to adjacent paragraphs, which would give the wrong before_text.
        const isFullyInserted = paragraphIsEntirelyInserted(p);
        const isFullyDeleted = paragraphIsEntirelyDeleted(p);
        // Look up before_text in rejected clone by bookmark
        let beforeText;
        if (isFullyInserted) {
            beforeText = ''; // Didn't exist before
        }
        else {
            const rejectedP = findParagraphByBookmarkId(rejectedDoc, paraId);
            beforeText = rejectedP ? getParagraphText(rejectedP) : '';
        }
        // Look up after_text in accepted clone by bookmark
        let afterText;
        if (isFullyDeleted) {
            afterText = ''; // Doesn't exist after
        }
        else {
            const acceptedP = findParagraphByBookmarkId(acceptedDoc, paraId);
            afterText = acceptedP ? getParagraphText(acceptedP) : '';
        }
        // Collect revision entries
        const revisions = collectRevisionEntries(p);
        // Skip structurally-empty paragraphs with only paragraph-level markers
        // (e.g. empty inserted paragraphs from comparison engines with pPr/rPr/ins only)
        if (revisions.length === 0 && beforeText === '' && afterText === '')
            continue;
        // Associate comments
        const paraComments = commentsByParaId.get(paraId) ?? [];
        const revisionComments = paraComments.map(commentToRevisionComment);
        changedParagraphs.push({
            para_id: paraId,
            before_text: beforeText,
            after_text: afterText,
            revisions,
            comments: revisionComments,
        });
    }
    // Apply pagination
    const totalChanges = changedParagraphs.length;
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? totalChanges;
    const page = changedParagraphs.slice(offset, offset + limit);
    const hasMore = offset + limit < totalChanges;
    return {
        changes: page,
        total_changes: totalChanges,
        has_more: hasMore,
    };
}
//# sourceMappingURL=extract_revisions.js.map