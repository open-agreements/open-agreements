/**
 * accept_changes — accept all tracked changes in a OOXML document body.
 *
 * Produces a clean document with no revision markup by:
 * - Removing w:del elements and their content
 * - Unwrapping w:ins elements (promoting children)
 * - Removing w:moveFrom (source), unwrapping w:moveTo (destination)
 * - Removing all *PrChange property change records
 * - Stripping paragraph-level revision markers
 * - Cleaning up move range markers and rsidDel attributes
 *
 * Operates on the W3C DOM (`@xmldom/xmldom`) — the same API used
 * throughout docx-primitives-ts (contrast with docx-comparison's
 * custom WmlElement AST).
 */
import { OOXML } from './namespaces.js';
const W_NS = OOXML.W_NS;
// ── DOM helpers (internal) ──────────────────────────────────────────
function isW(node, localName) {
    return (node.nodeType === 1 &&
        node.namespaceURI === W_NS &&
        node.localName === localName);
}
function isWElement(node) {
    return node.nodeType === 1 && node.namespaceURI === W_NS;
}
function getDepth(node) {
    let depth = 0;
    let cur = node.parentNode;
    while (cur) {
        depth++;
        cur = cur.parentNode;
    }
    return depth;
}
function collectByLocalName(container, localName) {
    return Array.from(container.getElementsByTagNameNS(W_NS, localName));
}
function removeAllByLocalName(container, localName) {
    const elements = collectByLocalName(container, localName);
    let count = 0;
    for (const el of elements) {
        if (el.parentNode) {
            el.parentNode.removeChild(el);
            count++;
        }
    }
    return count;
}
function unwrapAllByLocalName(container, localName) {
    const elements = collectByLocalName(container, localName);
    // Sort deepest-first to handle nested wrappers correctly
    elements.sort((a, b) => getDepth(b) - getDepth(a));
    let count = 0;
    for (const el of elements) {
        const parent = el.parentNode;
        if (!parent)
            continue;
        // Promote all children to the parent
        while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
        count++;
    }
    return count;
}
/**
 * Check if a paragraph has a paragraph-level revision marker.
 * Pattern: w:p > w:pPr > w:rPr > w:del (or w:ins)
 */
function paragraphHasParaMarker(p, markerLocalName) {
    for (let i = 0; i < p.childNodes.length; i++) {
        const child = p.childNodes[i];
        if (!isW(child, 'pPr'))
            continue;
        for (let j = 0; j < child.childNodes.length; j++) {
            const pPrChild = child.childNodes[j];
            if (!isW(pPrChild, 'rPr'))
                continue;
            for (let k = 0; k < pPrChild.childNodes.length; k++) {
                const rPrChild = pPrChild.childNodes[k];
                if (isW(rPrChild, markerLocalName))
                    return true;
            }
        }
    }
    return false;
}
/**
 * Check if a node (or its descendants) contains any w:r elements.
 */
function containsRun(node) {
    if (isW(node, 'r'))
        return true;
    for (let i = 0; i < node.childNodes.length; i++) {
        if (containsRun(node.childNodes[i]))
            return true;
    }
    return false;
}
// Tags that are "removed" content — should not count as live content
const REMOVED_LOCALS = new Set(['del', 'moveFrom']);
// Tags that are "kept" content — their presence means the paragraph has live content
const KEPT_LOCALS = new Set(['ins', 'moveTo']);
// Range marker tags to ignore when scanning paragraph children
const RANGE_MARKER_LOCALS = new Set([
    'moveFromRangeStart', 'moveFromRangeEnd',
    'moveToRangeStart', 'moveToRangeEnd',
]);
/**
 * Determine if a paragraph's only content lives inside w:del or w:moveFrom
 * (no w:r outside those wrappers, and no w:ins/w:moveTo siblings).
 */
function paragraphHasOnlyRemovedContent(p) {
    for (let i = 0; i < p.childNodes.length; i++) {
        const child = p.childNodes[i];
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (el.namespaceURI !== W_NS)
            continue;
        const local = el.localName;
        // If the paragraph has kept content wrappers, it stays
        if (KEPT_LOCALS.has(local))
            return false;
        // Skip pPr, range markers, and removed wrappers — they don't contribute live content
        if (local === 'pPr' || RANGE_MARKER_LOCALS.has(local) || REMOVED_LOCALS.has(local))
            continue;
        // A bare w:r or any other element that contains runs means live content
        if (local === 'r' || containsRun(el))
            return false;
    }
    // We passed all children without finding live content — but there must be
    // at least one removed wrapper for this to be a "removed content" paragraph
    for (let i = 0; i < p.childNodes.length; i++) {
        const child = p.childNodes[i];
        if (child.nodeType === 1 && isWElement(child) && REMOVED_LOCALS.has(child.localName)) {
            return true;
        }
    }
    return false;
}
// Property change element local names (all 6 types)
const PR_CHANGE_LOCALS = [
    'rPrChange', 'pPrChange', 'sectPrChange',
    'tblPrChange', 'trPrChange', 'tcPrChange',
];
// ── Public API ──────────────────────────────────────────────────────
/**
 * Accept all tracked changes in the document body, producing a clean
 * document with no revision markup.
 *
 * Mutates the Document in place (same convention as simplifyRedlines
 * and mergeRuns).
 */
export function acceptChanges(doc) {
    const body = doc.getElementsByTagNameNS(W_NS, 'body').item(0);
    if (!body) {
        return { insertionsAccepted: 0, deletionsAccepted: 0, movesResolved: 0, propertyChangesResolved: 0 };
    }
    // Phase A — Identify paragraphs to remove
    const paragraphsToRemove = new Set();
    const allParagraphs = collectByLocalName(body, 'p');
    for (const p of allParagraphs) {
        // Paragraph-level deletion marker: w:p > w:pPr > w:rPr > w:del
        if (paragraphHasParaMarker(p, 'del')) {
            paragraphsToRemove.add(p);
            continue;
        }
        // Paragraphs whose only content is inside w:del or w:moveFrom
        if (paragraphHasOnlyRemovedContent(p)) {
            paragraphsToRemove.add(p);
        }
    }
    // Phase B — Remove deletions and move sources
    const deletionsAccepted = removeAllByLocalName(body, 'del');
    const moveFromRemoved = removeAllByLocalName(body, 'moveFrom');
    removeAllByLocalName(body, 'moveFromRangeStart');
    removeAllByLocalName(body, 'moveFromRangeEnd');
    removeAllByLocalName(body, 'moveToRangeStart');
    removeAllByLocalName(body, 'moveToRangeEnd');
    // Phase C — Unwrap insertions and move destinations (depth-sorted)
    const insertionsAccepted = unwrapAllByLocalName(body, 'ins');
    const moveToUnwrapped = unwrapAllByLocalName(body, 'moveTo');
    // Phase D — Remove property change records
    let propertyChangesResolved = 0;
    for (const localName of PR_CHANGE_LOCALS) {
        propertyChangesResolved += removeAllByLocalName(body, localName);
    }
    // Phase E — Cleanup
    // Strip paragraph-level revision markers from w:pPr/w:rPr
    for (const p of collectByLocalName(body, 'p')) {
        for (let i = 0; i < p.childNodes.length; i++) {
            const child = p.childNodes[i];
            if (!isW(child, 'pPr'))
                continue;
            for (let j = 0; j < child.childNodes.length; j++) {
                const pPrChild = child.childNodes[j];
                if (!isW(pPrChild, 'rPr'))
                    continue;
                // Remove w:ins and w:del marker elements inside pPr > rPr
                const toRemove = [];
                for (let k = 0; k < pPrChild.childNodes.length; k++) {
                    const rPrChild = pPrChild.childNodes[k];
                    if (isW(rPrChild, 'ins') || isW(rPrChild, 'del')) {
                        toRemove.push(rPrChild);
                    }
                }
                for (const el of toRemove) {
                    pPrChild.removeChild(el);
                }
            }
        }
    }
    // Remove paragraphs collected in Phase A (check parentNode still exists)
    for (const p of paragraphsToRemove) {
        if (p.parentNode) {
            p.parentNode.removeChild(p);
        }
    }
    // Strip w:rsidDel attributes on remaining elements
    const allElements = body.getElementsByTagNameNS(W_NS, '*');
    for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        if (el.hasAttributeNS(W_NS, 'rsidDel')) {
            el.removeAttributeNS(W_NS, 'rsidDel');
        }
        // Also check prefixed form
        if (el.hasAttribute('w:rsidDel')) {
            el.removeAttribute('w:rsidDel');
        }
    }
    return {
        insertionsAccepted,
        deletionsAccepted,
        movesResolved: moveFromRemoved + moveToUnwrapped,
        propertyChangesResolved,
    };
}
//# sourceMappingURL=accept_changes.js.map