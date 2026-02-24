/**
 * XML Parsing and Serialization
 *
 * Parses document.xml into a DOM tree using @xmldom/xmldom.
 * Replaces the former fast-xml-parser + WmlElement POJO approach.
 */
/**
 * Parse document.xml string into a DOM Element tree.
 *
 * @param xml - The raw document.xml content
 * @returns Root element (the Document's documentElement)
 */
export declare function parseDocumentXml(xml: string): Element;
/**
 * Find the w:body element in the document tree.
 *
 * @param root - The document root element
 * @returns The w:body element, or undefined if not found
 */
export declare function findBody(root: Element): Element | undefined;
/**
 * Find the w:document element in the document tree.
 *
 * @param root - The document root element
 * @returns The w:document element, or undefined if not found
 */
export declare function findDocument(root: Element): Element | undefined;
/**
 * Find an element by tag name in the tree.
 *
 * @param node - The node to search from
 * @param tagName - The tag name to find
 * @returns The found element, or undefined
 */
export declare function findElement(node: Element, tagName: string): Element | undefined;
/**
 * Find all elements with a specific tag name.
 *
 * @param node - The node to search from
 * @param tagName - The tag name to find
 * @returns Array of matching elements
 */
export declare function findAllElements(node: Element, tagName: string): Element[];
/**
 * Serialize a DOM Element back to XML string.
 *
 * @param element - The element to serialize
 * @returns XML string
 */
export declare function serializeToXml(element: Element | Document): string;
/**
 * Clone a DOM Element tree (deep copy).
 *
 * @param element - The element to clone
 * @returns A deep copy of the element
 */
export declare function cloneElement(element: Element): Element;
/**
 * Backfill parent references — NO-OP for DOM Elements.
 *
 * DOM Elements have native parentNode/parentElement. This function exists
 * only to ease migration; callers should remove it over time.
 */
export declare function backfillParentReferences(_node: Element, _parent?: Element): void;
//# sourceMappingURL=xmlToWmlElement.d.ts.map