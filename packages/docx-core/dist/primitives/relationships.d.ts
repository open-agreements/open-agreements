export type RelsMap = Map<string, string>;
/**
 * Parse a document.xml.rels DOM and return a Map<rId, targetUrl> for external hyperlinks only.
 * Returns an empty map when the rels document is null (e.g. file missing from the DOCX archive).
 */
export declare function parseDocumentRels(relsDoc: Document | null): RelsMap;
//# sourceMappingURL=relationships.d.ts.map