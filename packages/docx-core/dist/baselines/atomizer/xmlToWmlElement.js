/**
 * XML Parsing and Serialization
 *
 * Parses document.xml into a DOM tree using @xmldom/xmldom.
 * Replaces the former fast-xml-parser + WmlElement POJO approach.
 */
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
/**
 * Parse document.xml string into a DOM Element tree.
 *
 * @param xml - The raw document.xml content
 * @returns Root element (the Document's documentElement)
 */
export function parseDocumentXml(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return doc.documentElement;
}
/**
 * Find the w:body element in the document tree.
 *
 * @param root - The document root element
 * @returns The w:body element, or undefined if not found
 */
export function findBody(root) {
    const bodies = root.getElementsByTagName('w:body');
    return bodies.length > 0 ? bodies[0] : undefined;
}
/**
 * Find the w:document element in the document tree.
 *
 * @param root - The document root element
 * @returns The w:document element, or undefined if not found
 */
export function findDocument(root) {
    if (root.tagName === 'w:document')
        return root;
    const docs = root.getElementsByTagName('w:document');
    return docs.length > 0 ? docs[0] : undefined;
}
/**
 * Find an element by tag name in the tree.
 *
 * @param node - The node to search from
 * @param tagName - The tag name to find
 * @returns The found element, or undefined
 */
export function findElement(node, tagName) {
    if (node.tagName === tagName)
        return node;
    const results = node.getElementsByTagName(tagName);
    return results.length > 0 ? results[0] : undefined;
}
/**
 * Find all elements with a specific tag name.
 *
 * @param node - The node to search from
 * @param tagName - The tag name to find
 * @returns Array of matching elements
 */
export function findAllElements(node, tagName) {
    const nodeList = node.getElementsByTagName(tagName);
    const result = [];
    for (let i = 0; i < nodeList.length; i++) {
        result.push(nodeList[i]);
    }
    return result;
}
/**
 * Serialize a DOM Element back to XML string.
 *
 * @param element - The element to serialize
 * @returns XML string
 */
export function serializeToXml(element) {
    return new XMLSerializer().serializeToString(element);
}
/**
 * Clone a DOM Element tree (deep copy).
 *
 * @param element - The element to clone
 * @returns A deep copy of the element
 */
export function cloneElement(element) {
    return element.cloneNode(true);
}
/**
 * Backfill parent references — NO-OP for DOM Elements.
 *
 * DOM Elements have native parentNode/parentElement. This function exists
 * only to ease migration; callers should remove it over time.
 */
export function backfillParentReferences(_node, _parent) {
    // No-op: DOM Elements have native parentNode
}
//# sourceMappingURL=xmlToWmlElement.js.map