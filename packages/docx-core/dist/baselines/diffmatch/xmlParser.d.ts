/**
 * XML Parser for extracting paragraphs and runs from DOCX document.xml.
 *
 * Uses fast-xml-parser to parse OOXML and extract ParagraphInfo objects
 * suitable for comparison.
 */
import type { ParagraphInfo, RunProperties } from '../../shared/ooxml/types.js';
/**
 * Extended ParagraphInfo with original XML for reconstruction.
 */
export interface ExtendedParagraphInfo extends ParagraphInfo {
    /** Original paragraph properties XML (w:pPr) for preservation */
    pPrXml?: string;
    /** Original paragraph index in document */
    originalIndex: number;
}
/**
 * Extract paragraphs from document.xml content.
 *
 * @param documentXml - The raw document.xml content
 * @returns Array of ParagraphInfo objects with runs and metadata
 */
export declare function extractParagraphs(documentXml: string): ExtendedParagraphInfo[];
/**
 * Extract run properties from a w:rPr element.
 */
export declare function extractRunProperties(rPrElement: unknown): RunProperties | undefined;
/**
 * Get the document body content (everything inside w:body).
 * Useful for document reconstruction.
 */
export declare function getBodyContent(documentXml: string): {
    beforeBody: string;
    bodyContent: string;
    afterBody: string;
};
/**
 * Extract sectPr (section properties) from body content if present.
 * sectPr must remain at the end of body.
 */
export declare function extractSectPr(bodyContent: string): {
    content: string;
    sectPr: string | null;
};
//# sourceMappingURL=xmlParser.d.ts.map