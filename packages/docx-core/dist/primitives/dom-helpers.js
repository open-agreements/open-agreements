/**
 * DOM Helper Layer
 *
 * Thin helpers that bridge xmldom's missing APIs and enforce the text semantics
 * contract for OOXML processing. These helpers address:
 *
 * 1. Leaf text contract — getLeafText() returns direct text child value only,
 *    unlike DOM textContent which is recursive. Critical for hash/compare code.
 * 2. Child element access — xmldom has no .children property, only .childNodes.
 * 3. Tree manipulation — insertAfter, wrap, unwrap operations.
 * 4. Namespace-safe element creation — always use createElementNS for OOXML.
 */
import { OOXML } from './namespaces.js';
// ── DOM node type constants (avoid magic numbers) ──────────────────
export const NODE_TYPE = {
    ELEMENT: 1,
    TEXT: 3,
    PROCESSING_INSTRUCTION: 7,
    COMMENT: 8,
    DOCUMENT: 9,
};
// ── Leaf text contract ─────────────────────────────────────────────
/**
 * Get direct text child value (leaf-only). Returns undefined if no text child.
 *
 * Use this instead of el.textContent in hash/compare code — DOM textContent
 * is recursive and would silently break hashing on container elements.
 */
export function getLeafText(el) {
    for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (child.nodeType === NODE_TYPE.TEXT)
            return child.nodeValue ?? '';
    }
    return undefined;
}
/**
 * Set the direct text content of a leaf element. Replaces or creates
 * the first text child node.
 */
export function setLeafText(el, text) {
    for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (child.nodeType === NODE_TYPE.TEXT) {
            child.nodeValue = text;
            return;
        }
    }
    el.appendChild(el.ownerDocument.createTextNode(text));
}
// ── Child element access (xmldom has no .children property) ────────
/**
 * Get element-only children. Filters out text nodes, comments, PIs.
 */
export function childElements(el) {
    const result = [];
    for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (child.nodeType === NODE_TYPE.ELEMENT)
            result.push(child);
    }
    return result;
}
/**
 * Get direct child elements with a specific tag name (prefix-qualified).
 */
export function childElementsByTagName(el, tagName) {
    const result = [];
    for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (child.nodeType === NODE_TYPE.ELEMENT && child.tagName === tagName) {
            result.push(child);
        }
    }
    return result;
}
/**
 * Find the first direct child element with a specific tag name.
 */
export function findChildByTagName(el, tagName) {
    for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (child.nodeType === NODE_TYPE.ELEMENT && child.tagName === tagName) {
            return child;
        }
    }
    return null;
}
// ── Tree manipulation helpers ──────────────────────────────────────
/**
 * Insert newEl after refEl in parent.
 */
export function insertAfterElement(refEl, newEl) {
    refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
}
/**
 * Wrap target in wrapper (replace target with wrapper, wrapper contains target).
 */
export function wrapElement(target, wrapper) {
    target.parentNode.insertBefore(wrapper, target);
    wrapper.appendChild(target);
}
/**
 * Unwrap element — replace it with its children in parent.
 */
export function unwrapElement(el) {
    const parent = el.parentNode;
    while (el.firstChild)
        parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
}
/**
 * Remove all descendant elements matching a tag name.
 * Returns the number of elements removed.
 */
export function removeAllByTagName(root, tagName) {
    const elements = Array.from(root.getElementsByTagName(tagName));
    let count = 0;
    for (const el of elements) {
        if (el.parentNode) {
            el.parentNode.removeChild(el);
            count++;
        }
    }
    return count;
}
/**
 * Unwrap all elements matching a tag name throughout the tree.
 * Returns the number of elements unwrapped.
 */
export function unwrapAllByTagName(root, tagName) {
    // Collect deepest-first to handle nesting correctly
    const elements = Array.from(root.getElementsByTagName(tagName));
    elements.reverse();
    let count = 0;
    for (const el of elements) {
        if (el.parentNode) {
            unwrapElement(el);
            count++;
        }
    }
    return count;
}
/**
 * Find all descendant elements with a specific tag name.
 * Returns a static array (unlike the live NodeList from getElementsByTagName).
 */
export function findAllByTagName(root, tagName) {
    const nodeList = root.getElementsByTagName(tagName);
    const result = [];
    for (let i = 0; i < nodeList.length; i++) {
        result.push(nodeList[i]);
    }
    return result;
}
/**
 * Rename an element by creating a new element with the target tag name,
 * copying all attributes and children, and replacing it in the parent.
 *
 * Returns the new element. Callers holding a reference to the old element
 * should update to use the returned value.
 */
export function renameElement(el, newTagName) {
    const doc = el.ownerDocument;
    const ns = el.namespaceURI;
    const newEl = ns ? doc.createElementNS(ns, newTagName) : doc.createElement(newTagName);
    // Copy attributes
    for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        newEl.setAttribute(attr.name, attr.value);
    }
    // Move children
    while (el.firstChild) {
        newEl.appendChild(el.firstChild);
    }
    // Replace in parent
    if (el.parentNode) {
        el.parentNode.replaceChild(newEl, el);
    }
    return newEl;
}
/**
 * Insert a child element at a specific index position.
 * If index >= child count, appends at the end.
 */
export function insertChildAt(parent, child, index) {
    const children = childElements(parent);
    if (index >= children.length) {
        parent.appendChild(child);
    }
    else {
        parent.insertBefore(child, children[index]);
    }
}
// ── Namespace-safe OOXML element creation ──────────────────────────
/**
 * Create OOXML element with correct namespace. Never use plain createElement
 * for OOXML tags — it yields namespaceURI=null which breaks namespace-aware code.
 */
export function createWmlElement(doc, localTag, attrs) {
    const el = doc.createElementNS(OOXML.W_NS, `w:${localTag}`);
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
            el.setAttribute(k, v);
        }
    }
    return el;
}
/**
 * Create a w:t text element with the given text content.
 * Automatically sets xml:space="preserve" to maintain whitespace fidelity.
 */
export function createWmlTextElement(doc, text) {
    const el = doc.createElementNS(OOXML.W_NS, 'w:t');
    el.setAttribute('xml:space', 'preserve');
    el.appendChild(doc.createTextNode(text));
    return el;
}
//# sourceMappingURL=dom-helpers.js.map