/**
 * reject_changes — reject all tracked changes in a OOXML document body.
 *
 * Produces the document as it was before tracked changes were made by:
 * - Removing w:ins elements AND their content (insertions undone)
 * - Unwrapping w:del elements and converting w:delText → w:t (deletions restored)
 * - Unwrapping w:moveFrom (keep at original position), removing w:moveTo and content
 * - Restoring original properties from *PrChange records
 * - Preserving cross-paragraph bookmark boundaries when removing inserted paragraphs
 * - Stripping paragraph-level revision markers and rsidDel attributes
 *
 * Operates on the W3C DOM (`@xmldom/xmldom`).
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
 * Pattern: w:p > w:pPr > w:rPr > w:ins (or w:del)
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
// Tags that are "inserted" content — removal candidates when rejecting
const INSERTED_LOCALS = new Set(['ins', 'moveTo']);
// Tags that are "kept" content when rejecting
const KEPT_LOCALS = new Set(['del', 'moveFrom']);
// Range marker tags to ignore
const RANGE_MARKER_LOCALS = new Set([
    'moveFromRangeStart', 'moveFromRangeEnd',
    'moveToRangeStart', 'moveToRangeEnd',
]);
/**
 * Determine if a paragraph's only content lives inside w:ins or w:moveTo
 * (no w:r outside those wrappers, and no w:del/w:moveFrom siblings).
 * These paragraphs should be removed when rejecting changes.
 */
function paragraphHasOnlyInsertedContent(p) {
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
        // Skip pPr, range markers, and inserted wrappers
        if (local === 'pPr' || RANGE_MARKER_LOCALS.has(local) || INSERTED_LOCALS.has(local))
            continue;
        // A bare w:r or any other element that contains runs means live content
        if (local === 'r' || containsRun(el))
            return false;
    }
    // We passed all children without finding live content — but there must be
    // at least one inserted wrapper for this to be an "inserted content" paragraph
    for (let i = 0; i < p.childNodes.length; i++) {
        const child = p.childNodes[i];
        if (child.nodeType === 1 && isWElement(child) && INSERTED_LOCALS.has(child.localName)) {
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
/**
 * Relocate orphaned bookmarks from a paragraph being removed to an
 * adjacent kept paragraph. This preserves cross-paragraph bookmark boundaries.
 */
function relocateBookmarks(p, paragraphsToRemove) {
    const parent = p.parentNode;
    if (!parent)
        return;
    // Find an adjacent kept paragraph (prefer next, fallback to previous)
    let target = null;
    let sibling = p.nextSibling;
    while (sibling) {
        if (sibling.nodeType === 1 && isW(sibling, 'p') && !paragraphsToRemove.has(sibling)) {
            target = sibling;
            break;
        }
        sibling = sibling.nextSibling;
    }
    if (!target) {
        sibling = p.previousSibling;
        while (sibling) {
            if (sibling.nodeType === 1 && isW(sibling, 'p') && !paragraphsToRemove.has(sibling)) {
                target = sibling;
                break;
            }
            sibling = sibling.previousSibling;
        }
    }
    if (!target)
        return;
    // Move bookmarkStart/bookmarkEnd elements that are direct children of the paragraph
    const toMove = [];
    for (let i = 0; i < p.childNodes.length; i++) {
        const child = p.childNodes[i];
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (isW(el, 'bookmarkStart') || isW(el, 'bookmarkEnd')) {
            toMove.push(el);
        }
    }
    // Also check sibling bookmarks (sibling-style: <bookmarkStart/><p/><bookmarkEnd/>)
    let prev = p.previousSibling;
    while (prev) {
        if (prev.nodeType === 1) {
            const el = prev;
            if (isW(el, 'bookmarkStart') || isW(el, 'bookmarkEnd')) {
                toMove.push(el);
                prev = prev.previousSibling;
                continue;
            }
            break;
        }
        prev = prev.previousSibling;
    }
    let next = p.nextSibling;
    while (next) {
        if (next.nodeType === 1) {
            const el = next;
            if (isW(el, 'bookmarkStart') || isW(el, 'bookmarkEnd')) {
                toMove.push(el);
                next = next.nextSibling;
                continue;
            }
            break;
        }
        next = next.nextSibling;
    }
    for (const bm of toMove) {
        // Insert at the beginning of the target paragraph (after pPr if present)
        const firstNonPPr = Array.from(target.childNodes).find((n) => !(n.nodeType === 1 && isW(n, 'pPr')));
        if (bm.parentNode)
            bm.parentNode.removeChild(bm);
        target.insertBefore(bm, firstNonPPr ?? null);
    }
}
// ── Public API ──────────────────────────────────────────────────────
/**
 * Reject all tracked changes in the document body, restoring the
 * document to its pre-edit state.
 *
 * Mutates the Document in place (same convention as acceptChanges).
 */
export function rejectChanges(doc) {
    const body = doc.getElementsByTagNameNS(W_NS, 'body').item(0);
    if (!body) {
        return { insertionsRemoved: 0, deletionsRestored: 0, movesReverted: 0, propertyChangesReverted: 0 };
    }
    // Phase A — Identify paragraphs to remove (entirely inserted paragraphs)
    const paragraphsToRemove = new Set();
    const allParagraphs = collectByLocalName(body, 'p');
    for (const p of allParagraphs) {
        // Paragraph-level insertion marker: w:p > w:pPr > w:rPr > w:ins
        if (paragraphHasParaMarker(p, 'ins')) {
            paragraphsToRemove.add(p);
            continue;
        }
        // Paragraphs whose only content is inside w:ins or w:moveTo
        if (paragraphHasOnlyInsertedContent(p)) {
            paragraphsToRemove.add(p);
        }
    }
    // Phase B — Preserve cross-paragraph bookmark boundaries
    for (const p of paragraphsToRemove) {
        relocateBookmarks(p, paragraphsToRemove);
    }
    // Phase C — Remove insertions and move destinations
    const insertionsRemoved = removeAllByLocalName(body, 'ins');
    const moveToRemoved = removeAllByLocalName(body, 'moveTo');
    removeAllByLocalName(body, 'moveToRangeStart');
    removeAllByLocalName(body, 'moveToRangeEnd');
    removeAllByLocalName(body, 'moveFromRangeStart');
    removeAllByLocalName(body, 'moveFromRangeEnd');
    // Phase D — Unwrap deletions and convert w:delText → w:t
    const deletionsRestored = unwrapAllByLocalName(body, 'del');
    // Rename all w:delText elements to w:t so getParagraphText() sees them
    const delTexts = collectByLocalName(body, 'delText');
    for (const dt of delTexts) {
        const parent = dt.parentNode;
        if (!parent)
            continue;
        const t = doc.createElementNS(W_NS, 'w:t');
        // Copy text content
        if (dt.textContent) {
            t.appendChild(doc.createTextNode(dt.textContent));
        }
        // Copy xml:space attribute if present
        const xmlSpace = dt.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'space')
            ?? dt.getAttribute('xml:space');
        if (xmlSpace) {
            t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', xmlSpace);
        }
        parent.replaceChild(t, dt);
    }
    // Phase E — Unwrap move sources (keep content at original position)
    const moveFromUnwrapped = unwrapAllByLocalName(body, 'moveFrom');
    // Phase F — Restore original properties from *PrChange records
    let propertyChangesReverted = 0;
    for (const localName of PR_CHANGE_LOCALS) {
        const changes = collectByLocalName(body, localName);
        // Sort deepest-first
        changes.sort((a, b) => getDepth(b) - getDepth(a));
        for (const change of changes) {
            const parentProp = change.parentNode;
            if (!parentProp)
                continue;
            const grandParent = parentProp.parentNode;
            if (!grandParent)
                continue;
            // The *PrChange element contains the original properties.
            // Extract the original property element (e.g. rPr inside rPrChange).
            // The expected mapping:
            //   rPrChange → child rPr = original run properties
            //   pPrChange → child pPr = original paragraph properties
            //   etc.
            const expectedChildLocal = localName.replace('Change', '');
            let originalProps = null;
            for (let i = 0; i < change.childNodes.length; i++) {
                const child = change.childNodes[i];
                if (child.nodeType === 1 && isW(child, expectedChildLocal)) {
                    originalProps = child;
                    break;
                }
            }
            if (originalProps) {
                // Replace the current property element with the original
                const restored = originalProps.cloneNode(true);
                grandParent.replaceChild(restored, parentProp);
            }
            else {
                // Original props were empty — remove the parent property element entirely
                grandParent.removeChild(parentProp);
            }
            propertyChangesReverted++;
        }
    }
    // Phase G — Cleanup
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
    // Remove paragraphs collected in Phase A
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
        if (el.hasAttribute('w:rsidDel')) {
            el.removeAttribute('w:rsidDel');
        }
    }
    return {
        insertionsRemoved,
        deletionsRestored,
        movesReverted: moveFromUnwrapped + moveToRemoved,
        propertyChangesReverted,
    };
}
//# sourceMappingURL=reject_changes.js.map