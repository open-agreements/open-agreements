import { childElements, findChildByTagName } from '../../primitives/dom-helpers.js';
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function willSurviveAccept(node) {
    let curr = node;
    let paragraph = null;
    while (curr) {
        if (curr.tagName === 'w:del' || curr.tagName === 'w:moveFrom') {
            return false; // Inside a deleted inline wrapper
        }
        if (curr.tagName === 'w:p') {
            paragraph = curr;
        }
        curr = curr.parentNode;
    }
    if (paragraph) {
        const pPr = findChildByTagName(paragraph, 'w:pPr');
        if (pPr) {
            const rPr = findChildByTagName(pPr, 'w:rPr');
            if (rPr) {
                const dels = Array.from(rPr.getElementsByTagName('w:del'));
                if (dels.length > 0)
                    return false; // Paragraph-level deletion
            }
        }
    }
    return true;
}
function isParagraphInsertedOrDeleted(p) {
    const pPr = findChildByTagName(p, 'w:pPr');
    if (!pPr)
        return false;
    // Paragraph is inserted if there's a w:ins in pPr (not inside rPr)
    // or deleted if there's a w:del in pPr/rPr.
    // Actually, safe-docx marks them in rPr for deletion and pPr for insertion.
    const rPr = findChildByTagName(pPr, 'w:rPr');
    if (rPr && Array.from(rPr.getElementsByTagName('w:del')).length > 0)
        return true;
    if (Array.from(pPr.getElementsByTagName('w:ins')).length > 0)
        return true;
    return false;
}
export function enforceConsumerCompatibility(root, allocateRevisionId) {
    // 1. Hoist bookmark markers out of revision wrappers AND fully deleted/inserted paragraphs
    const wrappers = new Set(['w:ins', 'w:del', 'w:moveFrom', 'w:moveTo']);
    const markers = ['w:bookmarkStart', 'w:bookmarkEnd'];
    function hoistBookmarks(node) {
        if (wrappers.has(node.tagName) || (node.tagName === 'w:p' && isParagraphInsertedOrDeleted(node))) {
            for (const markerTag of markers) {
                // Only get immediate children if we're hoisting out of p, otherwise get all descendants
                // Actually, if it's a p, we want to hoist all markers out of it so they survive.
                const nestedMarkers = Array.from(node.getElementsByTagName(markerTag));
                for (const marker of nestedMarkers) {
                    // Move the marker to be a sibling BEFORE the wrapper/paragraph, if it has a parent
                    if (node.parentNode) {
                        node.parentNode.insertBefore(marker, node);
                    }
                }
            }
        }
        else {
            for (const child of childElements(node)) {
                hoistBookmarks(child);
            }
        }
    }
    hoistBookmarks(root);
    // 2. Remove empty w:t tags
    const textNodes = Array.from(root.getElementsByTagName('w:t'));
    for (const t of textNodes) {
        if (!t.textContent || t.textContent.length === 0) {
            if (t.parentNode) {
                t.parentNode.removeChild(t);
            }
        }
    }
    // 3. Balance markers and remove duplicates
    const starts = Array.from(root.getElementsByTagName('w:bookmarkStart'));
    const ends = Array.from(root.getElementsByTagName('w:bookmarkEnd'));
    // A. Deduplicate by Name (Word crashes/behaves badly if names duplicate)
    // Group starts by name
    const startsByName = new Map();
    for (const start of starts) {
        const name = start.getAttribute('w:name');
        if (!name) {
            start.parentNode?.removeChild(start);
            continue;
        }
        const group = startsByName.get(name) || [];
        group.push(start);
        startsByName.set(name, group);
    }
    const validStarts = [];
    for (const group of startsByName.values()) {
        // Prefer the first one that survives "Accept All"
        let bestStart = group[0];
        for (let i = 0; i < group.length; i++) {
            if (willSurviveAccept(group[i])) {
                bestStart = group[i];
                break;
            }
        }
        // Keep the best one, remove the rest
        for (const start of group) {
            if (start === bestStart) {
                validStarts.push(start);
            }
            else {
                start.parentNode?.removeChild(start);
            }
        }
    }
    // B. Deduplicate Ends by ID (only keep the first end for a given ID)
    // Also drop ends that don't have an ID.
    const seenEndIds = new Set();
    const validEnds = [];
    for (const end of ends) {
        const id = end.getAttribute('w:id');
        if (!id || seenEndIds.has(id)) {
            end.parentNode?.removeChild(end);
            continue;
        }
        seenEndIds.add(id);
        validEnds.push(end);
    }
    // C. Map valid ends by ID for fast lookup
    const endMap = new Map();
    for (const end of validEnds) {
        const id = end.getAttribute('w:id');
        if (id)
            endMap.set(id, end);
    }
    // D. Process valid starts: fix IDs to be globally unique, and ensure there's a matching end
    const seenIds = new Set();
    for (const start of validStarts) {
        const oldId = start.getAttribute('w:id');
        if (!oldId)
            continue;
        // We must ensure the ID is unique across the document
        let newId = oldId;
        if (seenIds.has(newId)) {
            newId = String(allocateRevisionId());
            start.setAttribute('w:id', newId);
        }
        seenIds.add(newId);
        // Now find the matching end and update its ID if necessary
        const end = endMap.get(oldId);
        if (end) {
            if (newId !== oldId) {
                end.setAttribute('w:id', newId);
            }
            // Remove it from the map so we know it's matched
            endMap.delete(oldId);
        }
        else {
            // Missing an end tag. Insert a fake one immediately after.
            const doc = root.ownerDocument;
            if (doc) {
                console.warn(`[Consumer Compatibility] Warning: Orphaned bookmarkStart name=${start.getAttribute('w:name')}. Inserting synthetic end.`);
                const newEnd = doc.createElementNS(W_NS, 'w:bookmarkEnd');
                newEnd.setAttribute('w:id', newId);
                if (start.nextSibling) {
                    start.parentNode?.insertBefore(newEnd, start.nextSibling);
                }
                else {
                    start.parentNode?.appendChild(newEnd);
                }
            }
        }
    }
    // E. Any ends left in endMap had no matching start. 
    for (const [oldId, end] of endMap.entries()) {
        const doc = root.ownerDocument;
        if (doc) {
            let newId = oldId;
            if (seenIds.has(newId)) {
                newId = String(allocateRevisionId());
                end.setAttribute('w:id', newId);
            }
            seenIds.add(newId);
            console.warn(`[Consumer Compatibility] Warning: Orphaned bookmarkEnd id=${oldId}. Inserting synthetic start.`);
            const newStart = doc.createElementNS(W_NS, 'w:bookmarkStart');
            newStart.setAttribute('w:id', newId);
            newStart.setAttribute('w:name', `_Recovered_${newId}`);
            end.parentNode?.insertBefore(newStart, end);
        }
    }
}
//# sourceMappingURL=consumerCompatibility.js.map