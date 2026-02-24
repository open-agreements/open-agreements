/**
 * Document builder for reconstructing DOCX with track changes.
 *
 * Takes alignment results and produces a new document.xml with
 * insertions and deletions marked using OOXML track changes.
 */
import type { AlignmentResult } from '../../shared/ooxml/types.js';
import { type ExtendedParagraphInfo } from './xmlParser.js';
/**
 * Build options for document generation.
 */
export interface BuildOptions {
    author: string;
    date: Date;
}
/**
 * Represents a paragraph operation in the output document.
 */
export interface ParagraphOperation {
    /** Type of operation */
    type: 'unchanged' | 'modified' | 'deleted' | 'inserted';
    /** Generated XML for this paragraph */
    xml: string;
    /** Index in original document (for ordering) */
    originalIndex?: number;
    /** Index in revised document (for ordering) */
    revisedIndex?: number;
}
/**
 * Generate paragraph operations from alignment result.
 *
 * This converts the alignment result into a list of XML paragraph operations
 * that can be used to build the output document.
 */
export declare function generateParagraphOperations(alignment: AlignmentResult, originalParagraphs: ExtendedParagraphInfo[], revisedParagraphs: ExtendedParagraphInfo[], options: BuildOptions): ParagraphOperation[];
/**
 * Build a new document.xml with track changes applied.
 *
 * @param originalXml - The original document.xml content
 * @param operations - Ordered list of paragraph operations
 * @returns The new document.xml content
 */
export declare function buildDocumentWithTrackChanges(originalXml: string, operations: ParagraphOperation[]): string;
//# sourceMappingURL=documentBuilder.d.ts.map