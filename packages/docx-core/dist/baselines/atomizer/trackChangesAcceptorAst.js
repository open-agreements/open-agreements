/**
 * Track Changes Acceptor/Rejector (AST-based)
 *
 * AST-based utilities to accept or reject all track changes in a document.
 * Replaces the regex-based implementation for better reliability with nested structures.
 */
import { parseDocumentXml, serializeToXml } from './xmlToWmlElement.js';
import { removeAllByTagName, unwrapAllByTagName, findAllByTagName, renameElement, insertChildAt, childElements, getLeafText, NODE_TYPE, } from '../../primitives/index.js';
/** xmldom does not implement parentElement; use parentNode with an Element guard. */
function parentElement(node) {
    const p = node.parentNode;
    return p && p.nodeType === NODE_TYPE.ELEMENT ? p : undefined;
}
function getParagraphPPr(p) {
    return childElements(p).find((c) => c.tagName === 'w:pPr');
}
function paragraphHasParaMarker(p, tagName) {
    const pPr = getParagraphPPr(p);
    if (!pPr)
        return false;
    return findAllByTagName(pPr, tagName).length > 0;
}
function removeParaMarkers(root) {
    // Remove paragraph-level revision markers (<w:ins/> / <w:del/>) that live under <w:pPr>.
    for (const p of findAllByTagName(root, 'w:p')) {
        const pPr = getParagraphPPr(p);
        if (!pPr)
            continue;
        const markers = [
            ...findAllByTagName(pPr, 'w:ins'),
            ...findAllByTagName(pPr, 'w:del'),
        ];
        for (const m of markers) {
            if (m.parentNode)
                m.parentNode.removeChild(m);
        }
    }
}
function findContainingParagraph(node) {
    let current = node;
    while (current) {
        if (current.tagName === 'w:p') {
            return current;
        }
        current = parentElement(current);
    }
    return undefined;
}
function findNeighborParagraphOutsideRemoval(paragraph, paragraphsToRemove, direction) {
    const parent = parentElement(paragraph);
    if (!parent) {
        return undefined;
    }
    const siblings = childElements(parent);
    const paragraphIndex = siblings.indexOf(paragraph);
    if (paragraphIndex < 0) {
        return undefined;
    }
    const step = direction === 'previous' ? -1 : 1;
    for (let i = paragraphIndex + step; i >= 0 && i < siblings.length; i += step) {
        const sibling = siblings[i];
        if (sibling?.tagName !== 'w:p') {
            continue;
        }
        if (paragraphsToRemove.has(sibling)) {
            continue;
        }
        return sibling;
    }
    return undefined;
}
function paragraphContentStartIndex(paragraph) {
    const children = childElements(paragraph);
    let idx = 0;
    while (idx < children.length && children[idx]?.tagName === 'w:pPr') {
        idx++;
    }
    return idx;
}
function moveBookmarkMarker(marker, targetParagraph, position) {
    if (marker.tagName === 'w:bookmarkStart') {
        const markerId = marker.getAttribute('w:id');
        const markerName = marker.getAttribute('w:name');
        for (const existing of findAllByTagName(targetParagraph, 'w:bookmarkStart')) {
            if (markerId && existing.getAttribute('w:id') === markerId) {
                if (marker.parentNode)
                    marker.parentNode.removeChild(marker);
                return;
            }
            if (markerName && existing.getAttribute('w:name') === markerName) {
                if (marker.parentNode)
                    marker.parentNode.removeChild(marker);
                return;
            }
        }
    }
    if (marker.tagName === 'w:bookmarkEnd') {
        const markerId = marker.getAttribute('w:id');
        if (markerId) {
            for (const existing of findAllByTagName(targetParagraph, 'w:bookmarkEnd')) {
                if (existing.getAttribute('w:id') === markerId) {
                    if (marker.parentNode)
                        marker.parentNode.removeChild(marker);
                    return;
                }
            }
        }
    }
    if (marker.parentNode) {
        marker.parentNode.removeChild(marker);
    }
    if (position === 'start') {
        insertChildAt(targetParagraph, marker, paragraphContentStartIndex(targetParagraph));
        return;
    }
    targetParagraph.appendChild(marker);
}
function collectBookmarksById(nodes) {
    const byId = new Map();
    for (const node of nodes) {
        const id = node.getAttribute('w:id');
        if (!id) {
            continue;
        }
        const existing = byId.get(id);
        if (existing) {
            existing.push(node);
        }
        else {
            byId.set(id, [node]);
        }
    }
    return byId;
}
function hasCounterpartOutsideRemovedParagraphs(counterpartNodes, paragraphsToRemove, sourceParagraph) {
    if (!counterpartNodes || counterpartNodes.length === 0) {
        return false;
    }
    for (const node of counterpartNodes) {
        if (!node.parentNode) {
            continue;
        }
        const nodeParagraph = findContainingParagraph(node);
        if (!nodeParagraph || nodeParagraph === sourceParagraph) {
            continue;
        }
        if (!paragraphsToRemove.has(nodeParagraph)) {
            return true;
        }
    }
    return false;
}
function collectReferencedBookmarkNamesOutsideRemovedParagraphs(root, paragraphsToRemove) {
    const names = new Set();
    const refRegex = /\b(?:PAGEREF|REF)\s+([^\s\\]+)/g;
    for (const instrText of findAllByTagName(root, 'w:instrText')) {
        const paragraph = findContainingParagraph(instrText);
        if (paragraph && paragraphsToRemove.has(paragraph)) {
            continue;
        }
        const text = getLeafText(instrText) ?? '';
        for (const match of text.matchAll(refRegex)) {
            const name = match[1]?.trim();
            if (name) {
                names.add(name);
            }
        }
    }
    return names;
}
function getBookmarkNameForId(startsById, id) {
    const starts = startsById.get(id);
    if (!starts)
        return undefined;
    for (const start of starts) {
        const name = start.getAttribute('w:name');
        if (name)
            return name;
    }
    return undefined;
}
/**
 * Preserve bookmark markers that span outside paragraphs being removed during Reject All.
 *
 * Inserted paragraphs are removed wholesale. If they contain a bookmark boundary whose
 * counterpart sits in a kept paragraph, dropping that boundary corrupts bookmark pairing.
 * Move those boundary markers into adjacent kept paragraphs before removal.
 */
function preserveCrossParagraphBookmarksForReject(root, paragraphsToRemove) {
    if (paragraphsToRemove.size === 0) {
        return;
    }
    const startsById = collectBookmarksById(findAllByTagName(root, 'w:bookmarkStart'));
    const endsById = collectBookmarksById(findAllByTagName(root, 'w:bookmarkEnd'));
    const referencedNamesOutsideRemoved = collectReferencedBookmarkNamesOutsideRemovedParagraphs(root, paragraphsToRemove);
    for (const paragraph of paragraphsToRemove) {
        const startTarget = findNeighborParagraphOutsideRemoval(paragraph, paragraphsToRemove, 'next') ??
            findNeighborParagraphOutsideRemoval(paragraph, paragraphsToRemove, 'previous');
        const endTarget = findNeighborParagraphOutsideRemoval(paragraph, paragraphsToRemove, 'previous') ??
            findNeighborParagraphOutsideRemoval(paragraph, paragraphsToRemove, 'next');
        if (!startTarget && !endTarget) {
            continue;
        }
        for (const start of findAllByTagName(paragraph, 'w:bookmarkStart')) {
            if (!start.parentNode || !startTarget) {
                continue;
            }
            const id = start.getAttribute('w:id');
            if (!id) {
                continue;
            }
            const startName = start.getAttribute('w:name');
            const hasDuplicateStartOutside = hasCounterpartOutsideRemovedParagraphs(startsById.get(id), paragraphsToRemove, paragraph);
            if (hasDuplicateStartOutside) {
                // A surviving start marker with this ID already exists outside removed
                // paragraphs. Moving this marker would create duplicate starts after
                // Reject All.
                continue;
            }
            const hasCounterpartOutside = hasCounterpartOutsideRemovedParagraphs(endsById.get(id), paragraphsToRemove, paragraph);
            const referencedOutside = startName ? referencedNamesOutsideRemoved.has(startName) : false;
            if (!hasCounterpartOutside && !referencedOutside) {
                continue;
            }
            moveBookmarkMarker(start, startTarget, 'start');
        }
        for (const end of findAllByTagName(paragraph, 'w:bookmarkEnd')) {
            if (!end.parentNode || !endTarget) {
                continue;
            }
            const id = end.getAttribute('w:id');
            if (!id) {
                continue;
            }
            const hasDuplicateEndOutside = hasCounterpartOutsideRemovedParagraphs(endsById.get(id), paragraphsToRemove, paragraph);
            if (hasDuplicateEndOutside) {
                // A surviving end marker with this ID already exists outside removed
                // paragraphs. Moving this marker would create duplicate ends after
                // Reject All.
                continue;
            }
            const hasCounterpartOutside = hasCounterpartOutsideRemovedParagraphs(startsById.get(id), paragraphsToRemove, paragraph);
            const pairedName = getBookmarkNameForId(startsById, id);
            const referencedOutside = pairedName ? referencedNamesOutsideRemoved.has(pairedName) : false;
            if (!hasCounterpartOutside && !referencedOutside) {
                continue;
            }
            moveBookmarkMarker(end, endTarget, 'end');
        }
    }
}
/**
 * Accept all track changes in document XML (AST-based).
 *
 * - Removes w:del elements entirely (deleted content disappears)
 * - Unwraps w:ins elements (inserted content becomes normal)
 * - Handles w:moveFrom (remove) and w:moveTo (unwrap)
 * - Removes format change tracking elements
 *
 * @param documentXml - The document.xml content with track changes
 * @returns Document XML with all changes accepted
 */
export function acceptAllChanges(documentXml) {
    const root = parseDocumentXml(documentXml);
    // First, find paragraphs that ONLY contain w:del or w:moveFrom content (no w:ins, no regular w:r)
    // These paragraphs should be removed entirely when accepting
    const paragraphsToRemove = new Set();
    // Paragraph-level deletion markers (Aspose/Word encode deleted paragraphs via <w:pPr><w:rPr><w:del .../></w:rPr>)
    // should remove the paragraph on Accept All.
    for (const p of findAllByTagName(root, 'w:p')) {
        if (paragraphHasParaMarker(p, 'w:del')) {
            paragraphsToRemove.add(p);
        }
    }
    // Check w:del elements
    for (const del of findAllByTagName(root, 'w:del')) {
        // Walk up to find containing w:p
        let p;
        let current = parentElement(del);
        while (current) {
            if (current.tagName === 'w:p') {
                p = current;
                break;
            }
            current = parentElement(current);
        }
        if (p) {
            // Check if this paragraph has any w:ins elements (should keep those)
            const insElements = findAllByTagName(p, 'w:ins');
            if (insElements.length > 0) {
                continue; // Paragraph has inserted content, don't remove it
            }
            // Check if this paragraph has any w:r elements outside of w:del
            // If the only content is inside w:del, we can remove the paragraph
            let hasContentOutsideDel = false;
            for (const child of childElements(p)) {
                if (child.tagName === 'w:r') {
                    hasContentOutsideDel = true;
                    break;
                }
                if (child.tagName !== 'w:del' && child.tagName !== 'w:pPr' &&
                    child.tagName !== 'w:moveFromRangeStart' && child.tagName !== 'w:moveFromRangeEnd') {
                    // Check if this non-del child has w:r descendants
                    const runsInChild = findAllByTagName(child, 'w:r');
                    if (runsInChild.length > 0) {
                        hasContentOutsideDel = true;
                        break;
                    }
                }
            }
            if (!hasContentOutsideDel) {
                paragraphsToRemove.add(p);
            }
        }
    }
    // Also check w:moveFrom elements (moved-away content, also removed when accepting)
    for (const moveFrom of findAllByTagName(root, 'w:moveFrom')) {
        // Walk up to find containing w:p
        let p;
        let current = parentElement(moveFrom);
        while (current) {
            if (current.tagName === 'w:p') {
                p = current;
                break;
            }
            current = parentElement(current);
        }
        if (p && !paragraphsToRemove.has(p)) {
            // Check if this paragraph has any w:ins or w:moveTo elements (should keep those)
            const insElements = findAllByTagName(p, 'w:ins');
            const moveToElements = findAllByTagName(p, 'w:moveTo');
            if (insElements.length > 0 || moveToElements.length > 0) {
                continue;
            }
            // Check if this paragraph has any w:r elements outside of w:del/w:moveFrom
            let hasContentOutsideRemoved = false;
            for (const child of childElements(p)) {
                if (child.tagName === 'w:r') {
                    hasContentOutsideRemoved = true;
                    break;
                }
                if (child.tagName !== 'w:del' && child.tagName !== 'w:moveFrom' &&
                    child.tagName !== 'w:pPr' &&
                    child.tagName !== 'w:moveFromRangeStart' && child.tagName !== 'w:moveFromRangeEnd') {
                    const runsInChild = findAllByTagName(child, 'w:r');
                    if (runsInChild.length > 0) {
                        hasContentOutsideRemoved = true;
                        break;
                    }
                }
            }
            if (!hasContentOutsideRemoved) {
                paragraphsToRemove.add(p);
            }
        }
    }
    // Remove w:del elements entirely (deleted content disappears)
    removeAllByTagName(root, 'w:del');
    // Remove w:moveFrom elements entirely
    removeAllByTagName(root, 'w:moveFrom');
    // Remove move range markers
    removeAllByTagName(root, 'w:moveFromRangeStart');
    removeAllByTagName(root, 'w:moveFromRangeEnd');
    removeAllByTagName(root, 'w:moveToRangeStart');
    removeAllByTagName(root, 'w:moveToRangeEnd');
    // Unwrap w:ins elements (keep content, remove wrapper)
    unwrapAllByTagName(root, 'w:ins');
    // Unwrap w:moveTo elements
    unwrapAllByTagName(root, 'w:moveTo');
    // Remove format change tracking
    removeAllByTagName(root, 'w:rPrChange');
    removeAllByTagName(root, 'w:pPrChange');
    // Strip paragraph-level markers now that changes are accepted.
    removeParaMarkers(root);
    // Remove paragraphs that ONLY had w:del content (now empty after removal)
    for (const p of paragraphsToRemove) {
        if (p.parentNode) {
            p.parentNode.removeChild(p);
        }
    }
    return serializeToXml(root);
}
/**
 * Reject all track changes in document XML (AST-based).
 *
 * - Removes w:ins elements entirely (inserted content disappears)
 * - Unwraps w:del elements and converts w:delText to w:t
 * - Handles w:moveFrom (unwrap) and w:moveTo (remove)
 * - Removes format change tracking elements
 *
 * @param documentXml - The document.xml content with track changes
 * @returns Document XML with all changes rejected
 */
export function rejectAllChanges(documentXml) {
    const root = parseDocumentXml(documentXml);
    // Step 1: Find paragraphs where w:ins is the ONLY substantive content
    // (no w:del, no w:r outside track changes)
    const paragraphsToRemove = new Set();
    // Paragraph-level insertion markers (Aspose/Word encode inserted paragraphs via <w:pPr><w:rPr><w:ins .../></w:rPr>)
    // should remove the paragraph on Reject All.
    for (const p of findAllByTagName(root, 'w:p')) {
        if (paragraphHasParaMarker(p, 'w:ins')) {
            paragraphsToRemove.add(p);
        }
    }
    // Also check w:moveTo elements (moved-to content, also removed when rejecting)
    for (const moveTo of findAllByTagName(root, 'w:moveTo')) {
        // Walk up to find containing w:p
        let p;
        let current = parentElement(moveTo);
        while (current) {
            if (current.tagName === 'w:p') {
                p = current;
                break;
            }
            current = parentElement(current);
        }
        if (p && !paragraphsToRemove.has(p)) {
            // Check if this paragraph has any w:del or w:moveFrom elements (should keep those)
            const dels = findAllByTagName(p, 'w:del');
            const moveFroms = findAllByTagName(p, 'w:moveFrom');
            if (dels.length > 0 || moveFroms.length > 0) {
                continue;
            }
            // Check if this paragraph has any w:r elements outside of w:ins/w:moveTo
            let hasContentOutsideRemoved = false;
            for (const child of childElements(p)) {
                if (child.tagName === 'w:r') {
                    hasContentOutsideRemoved = true;
                    break;
                }
                if (child.tagName !== 'w:ins' && child.tagName !== 'w:moveTo' &&
                    child.tagName !== 'w:pPr' &&
                    child.tagName !== 'w:moveToRangeStart' && child.tagName !== 'w:moveToRangeEnd') {
                    const runsInChild = findAllByTagName(child, 'w:r');
                    if (runsInChild.length > 0) {
                        hasContentOutsideRemoved = true;
                        break;
                    }
                }
            }
            if (!hasContentOutsideRemoved) {
                paragraphsToRemove.add(p);
            }
        }
    }
    preserveCrossParagraphBookmarksForReject(root, paragraphsToRemove);
    // Step 2: Remove w:ins elements entirely (inserted content disappears)
    removeAllByTagName(root, 'w:ins');
    // Step 3: Remove paragraphs that ONLY had w:ins content
    for (const p of paragraphsToRemove) {
        if (p.parentNode) {
            p.parentNode.removeChild(p);
        }
    }
    // Remove w:moveTo elements entirely
    removeAllByTagName(root, 'w:moveTo');
    // Remove move range markers
    removeAllByTagName(root, 'w:moveFromRangeStart');
    removeAllByTagName(root, 'w:moveFromRangeEnd');
    removeAllByTagName(root, 'w:moveToRangeStart');
    removeAllByTagName(root, 'w:moveToRangeEnd');
    // Unwrap w:del elements (keep content, remove wrapper)
    unwrapAllByTagName(root, 'w:del');
    // Unwrap w:moveFrom elements
    unwrapAllByTagName(root, 'w:moveFrom');
    // Convert w:delText to w:t
    for (const delText of findAllByTagName(root, 'w:delText')) {
        renameElement(delText, 'w:t');
    }
    // Remove format change tracking
    removeAllByTagName(root, 'w:rPrChange');
    removeAllByTagName(root, 'w:pPrChange');
    // Strip paragraph-level markers now that changes are rejected.
    removeParaMarkers(root);
    return serializeToXml(root);
}
/**
 * Extract plain text content from document XML (AST-based).
 *
 * @param documentXml - The document.xml content
 * @returns Plain text content
 */
export function extractTextContent(documentXml) {
    const root = parseDocumentXml(documentXml);
    const texts = [];
    // Extract text from w:t elements
    for (const t of findAllByTagName(root, 'w:t')) {
        const text = getLeafText(t) ?? '';
        if (text) {
            texts.push(text);
        }
    }
    // Also extract from w:delText (for rejected changes before conversion)
    for (const delText of findAllByTagName(root, 'w:delText')) {
        const text = getLeafText(delText) ?? '';
        if (text) {
            texts.push(text);
        }
    }
    return texts.join('');
}
/**
 * Extract text in document order, respecting paragraph breaks (AST-based).
 */
export function extractTextWithParagraphs(documentXml) {
    const root = parseDocumentXml(documentXml);
    const paragraphs = [];
    // Find all paragraphs
    for (const p of findAllByTagName(root, 'w:p')) {
        const texts = [];
        // Extract text from w:t elements within this paragraph
        for (const t of findAllByTagName(p, 'w:t')) {
            const text = getLeafText(t) ?? '';
            if (text) {
                texts.push(text);
            }
        }
        // Also check w:delText
        for (const delText of findAllByTagName(p, 'w:delText')) {
            const text = getLeafText(delText) ?? '';
            if (text) {
                texts.push(text);
            }
        }
        paragraphs.push(texts.join(''));
    }
    return paragraphs.join('\n');
}
/**
 * Normalize text for comparison (handles whitespace differences).
 *
 * Performs the following normalization:
 * - Convert CRLF and CR to LF
 * - Convert tabs to spaces
 * - Collapse multiple spaces to single space
 * - Strip trailing spaces from each line
 * - Collapse multiple newlines to single newline
 * - Trim leading/trailing whitespace
 */
export function normalizeText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/ +/g, ' ')
        .replace(/ \n/g, '\n') // Strip trailing spaces from lines
        .replace(/\n /g, '\n') // Strip leading spaces from lines
        .replace(/\n+/g, '\n')
        .trim();
}
/**
 * Compare two texts and return detailed differences.
 */
export function compareTexts(expected, actual) {
    const normalizedExpected = normalizeText(expected);
    const normalizedActual = normalizeText(actual);
    const differences = [];
    if (expected !== actual) {
        // Find first difference
        let firstDiff = 0;
        while (firstDiff < expected.length && firstDiff < actual.length) {
            if (expected[firstDiff] !== actual[firstDiff]) {
                break;
            }
            firstDiff++;
        }
        if (firstDiff < expected.length || firstDiff < actual.length) {
            const context = 50;
            const start = Math.max(0, firstDiff - context);
            const expectedSnippet = expected.slice(start, firstDiff + context);
            const actualSnippet = actual.slice(start, firstDiff + context);
            differences.push(`First difference at position ${firstDiff}:`);
            differences.push(`  Expected: "...${expectedSnippet}..."`);
            differences.push(`  Actual:   "...${actualSnippet}..."`);
        }
    }
    return {
        identical: expected === actual,
        normalizedIdentical: normalizedExpected === normalizedActual,
        expectedLength: expected.length,
        actualLength: actual.length,
        differences,
    };
}
//# sourceMappingURL=trackChangesAcceptorAst.js.map