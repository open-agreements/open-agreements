/**
 * simplify_redlines — merge adjacent same-author tracked-change wrappers.
 *
 * Consolidates consecutive `w:ins`, `w:del`, `w:moveFrom`, or `w:moveTo`
 * wrappers that share the same `w:author` attribute and local name.
 * Does not merge across different change types or non-whitespace separators.
 */
import { OOXML, W } from './namespaces.js';
// ── Tracked-change wrapper local names ────────────────────────────────
const TC_WRAPPER_LOCALS = new Set(['ins', 'del', 'moveFrom', 'moveTo']);
// ── Helpers ───────────────────────────────────────────────────────────
function isTcWrapper(node) {
    return (node.nodeType === 1 &&
        node.namespaceURI === OOXML.W_NS &&
        TC_WRAPPER_LOCALS.has(node.localName));
}
function getAuthor(el) {
    return (el.getAttributeNS(OOXML.W_NS, 'author') ?? el.getAttribute('w:author'));
}
/**
 * Check whether a node is ignorable whitespace between wrappers.
 * Only pure-whitespace text nodes are ignorable.
 */
function isIgnorableWhitespace(node) {
    return node.nodeType === 3 && /^\s*$/.test(node.textContent ?? '');
}
// ── Core logic ────────────────────────────────────────────────────────
/**
 * Within a single container element, find groups of adjacent same-type,
 * same-author tracked-change wrappers (possibly separated by whitespace
 * text nodes) and merge them.
 */
function simplifyContainer(container) {
    let consolidated = 0;
    let child = container.firstChild;
    while (child) {
        if (!isTcWrapper(child)) {
            child = child.nextSibling;
            continue;
        }
        // `child` is a tracked-change wrapper — start scanning for mergeable
        // siblings of the same type and author.
        const anchor = child;
        const anchorLocal = anchor.localName;
        const anchorAuthor = getAuthor(anchor);
        let scan = anchor.nextSibling;
        while (scan) {
            // Skip ignorable whitespace between wrappers
            if (isIgnorableWhitespace(scan)) {
                scan = scan.nextSibling;
                continue;
            }
            // If the next significant node is a matching wrapper, merge it.
            if (isTcWrapper(scan) &&
                scan.localName === anchorLocal &&
                getAuthor(scan) === anchorAuthor) {
                const toMerge = scan;
                scan = toMerge.nextSibling;
                // Move all children from `toMerge` into `anchor`.
                while (toMerge.firstChild) {
                    anchor.appendChild(toMerge.firstChild);
                }
                container.removeChild(toMerge);
                consolidated++;
                continue;
            }
            // Any other element or non-whitespace text node breaks the chain.
            break;
        }
        child = anchor.nextSibling;
    }
    return consolidated;
}
// ── Public API ────────────────────────────────────────────────────────
/**
 * Simplify tracked-change wrappers across all paragraphs in the document
 * body by merging adjacent same-type, same-author wrappers.
 *
 * This reduces visual clutter in redline documents without altering
 * semantics (every run's tracked-change attribution is preserved).
 */
export function simplifyRedlines(doc) {
    const body = doc.getElementsByTagNameNS(OOXML.W_NS, W.body).item(0);
    if (!body)
        return { wrappersConsolidated: 0 };
    let total = 0;
    // Process each paragraph as a container
    const paragraphs = Array.from(body.getElementsByTagNameNS(OOXML.W_NS, W.p));
    for (const p of paragraphs) {
        total += simplifyContainer(p);
    }
    return { wrappersConsolidated: total };
}
//# sourceMappingURL=simplify_redlines.js.map