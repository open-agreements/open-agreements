/**
 * footnotes — OOXML footnote bootstrapping, CRUD, and display numbering.
 *
 * Creates footnote XML parts when missing, inserts footnote reference runs,
 * and supports reading, updating, and deleting footnotes.
 */
import { DocxZip } from './zip.js';
export type Footnote = {
    id: number;
    displayNumber: number;
    text: string;
    anchoredParagraphId: string | null;
};
export type AddFootnoteParams = {
    paragraphEl: Element;
    afterText?: string;
    text: string;
};
export type AddFootnoteResult = {
    noteId: number;
};
export type BootstrapFootnoteResult = {
    partsCreated: string[];
};
export declare function isReservedFootnote(footnoteEl: Element): boolean;
export declare function bootstrapFootnoteParts(zip: DocxZip): Promise<BootstrapFootnoteResult>;
export declare function getFootnotes(zip: DocxZip, documentXml: Document): Promise<Footnote[]>;
export declare function getFootnote(zip: DocxZip, documentXml: Document, noteId: number): Promise<Footnote | null>;
export declare function addFootnote(documentXml: Document, zip: DocxZip, params: AddFootnoteParams): Promise<AddFootnoteResult>;
export declare function updateFootnoteText(zip: DocxZip, params: {
    noteId: number;
    newText: string;
}): Promise<void>;
export declare function deleteFootnote(documentXml: Document, zip: DocxZip, params: {
    noteId: number;
}): Promise<void>;
//# sourceMappingURL=footnotes.d.ts.map