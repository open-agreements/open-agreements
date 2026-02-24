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
export declare const NODE_TYPE: {
    readonly ELEMENT: 1;
    readonly TEXT: 3;
    readonly PROCESSING_INSTRUCTION: 7;
    readonly COMMENT: 8;
    readonly DOCUMENT: 9;
};
/**
 * Get direct text child value (leaf-only). Returns undefined if no text child.
 *
 * Use this instead of el.textContent in hash/compare code — DOM textContent
 * is recursive and would silently break hashing on container elements.
 */
export declare function getLeafText(el: Element): string | undefined;
/**
 * Set the direct text content of a leaf element. Replaces or creates
 * the first text child node.
 */
export declare function setLeafText(el: Element, text: string): void;
/**
 * Get element-only children. Filters out text nodes, comments, PIs.
 */
export declare function childElements(el: Element | Node): Element[];
/**
 * Get direct child elements with a specific tag name (prefix-qualified).
 */
export declare function childElementsByTagName(el: Element, tagName: string): Element[];
/**
 * Find the first direct child element with a specific tag name.
 */
export declare function findChildByTagName(el: Element, tagName: string): Element | null;
/**
 * Insert newEl after refEl in parent.
 */
export declare function insertAfterElement(refEl: Node, newEl: Node): void;
/**
 * Wrap target in wrapper (replace target with wrapper, wrapper contains target).
 */
export declare function wrapElement(target: Node, wrapper: Element): void;
/**
 * Unwrap element — replace it with its children in parent.
 */
export declare function unwrapElement(el: Element): void;
/**
 * Remove all descendant elements matching a tag name.
 * Returns the number of elements removed.
 */
export declare function removeAllByTagName(root: Element, tagName: string): number;
/**
 * Unwrap all elements matching a tag name throughout the tree.
 * Returns the number of elements unwrapped.
 */
export declare function unwrapAllByTagName(root: Element, tagName: string): number;
/**
 * Find all descendant elements with a specific tag name.
 * Returns a static array (unlike the live NodeList from getElementsByTagName).
 */
export declare function findAllByTagName(root: Element, tagName: string): Element[];
/**
 * Rename an element by creating a new element with the target tag name,
 * copying all attributes and children, and replacing it in the parent.
 *
 * Returns the new element. Callers holding a reference to the old element
 * should update to use the returned value.
 */
export declare function renameElement(el: Element, newTagName: string): Element;
/**
 * Insert a child element at a specific index position.
 * If index >= child count, appends at the end.
 */
export declare function insertChildAt(parent: Element, child: Node, index: number): void;
/**
 * Create OOXML element with correct namespace. Never use plain createElement
 * for OOXML tags — it yields namespaceURI=null which breaks namespace-aware code.
 */
export declare function createWmlElement(doc: Document, localTag: string, attrs?: Record<string, string>): Element;
/**
 * Create a w:t text element with the given text content.
 * Automatically sets xml:space="preserve" to maintain whitespace fidelity.
 */
export declare function createWmlTextElement(doc: Document, text: string): Element;
//# sourceMappingURL=dom-helpers.d.ts.map