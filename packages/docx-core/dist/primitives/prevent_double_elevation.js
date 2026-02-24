import { OOXML, W } from './namespaces.js';
const DEFAULT_TARGET_STYLES = ['FootnoteReference', 'EndnoteReference'];
/**
 * Resolve a w: attribute from an element, checking both namespace-qualified
 * and prefixed forms (matches the getWAttr pattern in styles.ts).
 */
function getWAttr(el, localName) {
    return el.getAttributeNS(OOXML.W_NS, localName) ?? el.getAttribute(`w:${localName}`) ?? el.getAttribute(localName);
}
/**
 * Get the direct child rPr element (not descendant) of a w:style element.
 */
function getDirectChildRPr(styleEl) {
    let child = styleEl.firstChild;
    while (child) {
        if (child.nodeType === 1 &&
            child.namespaceURI === OOXML.W_NS &&
            child.localName === W.rPr) {
            return child;
        }
        child = child.nextSibling;
    }
    return null;
}
/**
 * Get the value of a specific w: child element within an rPr.
 * Returns the val attribute of the first matching direct child, or null.
 */
function getRPrChildVal(rPr, localName) {
    if (!rPr)
        return null;
    let child = rPr.firstChild;
    while (child) {
        if (child.nodeType === 1 &&
            child.namespaceURI === OOXML.W_NS &&
            child.localName === localName) {
            return getWAttr(child, W.val);
        }
        child = child.nextSibling;
    }
    return null;
}
/**
 * Check whether the given rPr has a direct child element with the given localName.
 */
function hasRPrChild(rPr, localName) {
    if (!rPr)
        return false;
    let child = rPr.firstChild;
    while (child) {
        if (child.nodeType === 1 &&
            child.namespaceURI === OOXML.W_NS &&
            child.localName === localName) {
            return true;
        }
        child = child.nextSibling;
    }
    return false;
}
/**
 * Prevent double elevation on footnote/endnote reference styles.
 *
 * When a style has both w:vertAlign="superscript" and w:position > 0,
 * non-Windows renderers (Mac Pages, LibreOffice) stack the effects,
 * pushing reference numerals too high. This function removes or neutralizes
 * the redundant w:position on allowlisted styles.
 *
 * Scope: Only affects styles in targetStyleIds (default: FootnoteReference,
 * EndnoteReference). Never mutates parent/ancestor styles.
 */
export function preventDoubleElevation(stylesDoc, options) {
    const targetIds = options?.targetStyleIds ?? DEFAULT_TARGET_STYLES;
    // Build style map: styleId → { el, rPr, basedOn }
    const styleMap = new Map();
    const styleEls = stylesDoc.getElementsByTagNameNS(OOXML.W_NS, W.style);
    for (let i = 0; i < styleEls.length; i++) {
        const el = styleEls.item(i);
        const styleId = getWAttr(el, 'styleId');
        if (!styleId)
            continue;
        const rPr = getDirectChildRPr(el);
        const basedOnEl = el.getElementsByTagNameNS(OOXML.W_NS, W.basedOn).item(0);
        const basedOn = basedOnEl ? (getWAttr(basedOnEl, W.val) ?? null) : null;
        styleMap.set(styleId, { el, rPr, basedOn });
    }
    /**
     * Walk the basedOn chain from a style, returning the nearest value of a
     * property (by localName) found in rPr. Cycle-safe via seen set.
     *
     * Returns { value, isLocal } where isLocal=true means found on the starting style.
     */
    function resolveNearest(startId, propLocalName) {
        let curId = startId;
        const seen = new Set();
        let first = true;
        while (curId) {
            if (seen.has(curId))
                break;
            seen.add(curId);
            const info = styleMap.get(curId);
            if (!info)
                break;
            const val = getRPrChildVal(info.rPr, propLocalName);
            if (val !== null) {
                return { value: val, isLocal: first };
            }
            first = false;
            curId = info.basedOn;
        }
        return { value: null, isLocal: false };
    }
    let count = 0;
    for (const targetId of targetIds) {
        const info = styleMap.get(targetId);
        if (!info)
            continue;
        // Resolve effective vertAlign (nearest-in-chain wins)
        const vertAlign = resolveNearest(targetId, W.vertAlign);
        if (vertAlign.value !== 'superscript')
            continue;
        // Resolve effective position
        const position = resolveNearest(targetId, W.position);
        if (position.value === null)
            continue;
        const posNum = parseInt(position.value, 10);
        if (isNaN(posNum) || posNum <= 0)
            continue;
        // Double elevation detected — fix it
        if (position.isLocal) {
            // Remove the local w:position element from the target style's rPr
            removeRPrChild(info.rPr, W.position);
        }
        else {
            // Inherited position — add local w:position="0" to neutralize
            const rPr = ensureRPr(stylesDoc, info.el);
            addPositionZero(stylesDoc, rPr);
        }
        count++;
    }
    return { doubleElevationsFixed: count };
}
/**
 * Remove a direct child element with the given localName from an rPr.
 */
function removeRPrChild(rPr, localName) {
    let child = rPr.firstChild;
    while (child) {
        const next = child.nextSibling;
        if (child.nodeType === 1 &&
            child.namespaceURI === OOXML.W_NS &&
            child.localName === localName) {
            rPr.removeChild(child);
        }
        child = next;
    }
}
/**
 * Ensure the style element has a direct child rPr, creating one if needed.
 */
function ensureRPr(doc, styleEl) {
    const existing = getDirectChildRPr(styleEl);
    if (existing)
        return existing;
    const rPr = doc.createElementNS(OOXML.W_NS, 'w:rPr');
    // Insert rPr as first child (after any w:name or w:basedOn per OOXML convention)
    styleEl.insertBefore(rPr, styleEl.firstChild);
    return rPr;
}
/**
 * Add w:position w:val="0" to an rPr element.
 */
function addPositionZero(doc, rPr) {
    // If there's already a w:position, update it rather than adding a duplicate
    if (hasRPrChild(rPr, W.position)) {
        let child = rPr.firstChild;
        while (child) {
            if (child.nodeType === 1 &&
                child.namespaceURI === OOXML.W_NS &&
                child.localName === W.position) {
                child.setAttributeNS(OOXML.W_NS, 'w:val', '0');
                return;
            }
            child = child.nextSibling;
        }
    }
    const posEl = doc.createElementNS(OOXML.W_NS, 'w:position');
    posEl.setAttributeNS(OOXML.W_NS, 'w:val', '0');
    rPr.appendChild(posEl);
}
//# sourceMappingURL=prevent_double_elevation.js.map