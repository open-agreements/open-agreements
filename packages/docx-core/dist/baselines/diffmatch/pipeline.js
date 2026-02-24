/**
 * Baseline B: Pure TypeScript document comparison pipeline.
 *
 * Orchestrates the comparison flow:
 * 1. Load DOCX archives
 * 2. Extract paragraphs
 * 3. Align paragraphs (LCS + similarity)
 * 4. Diff runs within matched paragraphs
 * 5. Render track changes
 * 6. Build output document
 */
import { DocxArchive } from '../../shared/docx/DocxArchive.js';
import { extractParagraphs } from './xmlParser.js';
import { alignParagraphs, classifyAlignment } from './paragraphAlignment.js';
import { resetRevisionIds } from './trackChangesRenderer.js';
import { generateParagraphOperations, buildDocumentWithTrackChanges, } from './documentBuilder.js';
/**
 * Compare two DOCX documents using the Baseline B (pure TypeScript) approach.
 *
 * @param original - Original document as Buffer
 * @param revised - Revised document as Buffer
 * @param options - Comparison options
 * @returns Comparison result with track changes document
 */
export async function compareDocumentsBaselineB(original, revised, options = {}) {
    const { author = 'Comparison', date = new Date(), similarityThreshold = 0.5, } = options;
    // 1. Load archives
    const originalArchive = await DocxArchive.load(original);
    const revisedArchive = await DocxArchive.load(revised);
    // 2. Extract document XML
    const originalXml = await originalArchive.getDocumentXml();
    const revisedXml = await revisedArchive.getDocumentXml();
    // 3. Extract paragraphs from both documents
    const originalParagraphs = extractParagraphs(originalXml);
    const revisedParagraphs = extractParagraphs(revisedXml);
    // 4. Reset revision ID counter for this comparison
    resetRevisionIds();
    // 5. Align paragraphs between documents
    const alignment = alignParagraphs(originalParagraphs, revisedParagraphs, similarityThreshold);
    // 6. Generate paragraph operations with track changes
    const operations = generateParagraphOperations(alignment, originalParagraphs, revisedParagraphs, { author, date });
    // 7. Build new document.xml with track changes
    const newDocumentXml = buildDocumentWithTrackChanges(originalXml, operations);
    // 8. Clone original archive and update document.xml
    const resultArchive = await originalArchive.clone();
    resultArchive.setDocumentXml(newDocumentXml);
    // 9. Save result and compute stats
    const resultBuffer = await resultArchive.save();
    const stats = computeStats(alignment, operations);
    return {
        document: resultBuffer,
        stats,
        engine: 'diffmatch',
    };
}
/**
 * Compute comparison statistics from alignment and operations.
 */
function computeStats(alignment, operations) {
    // Count operations
    let insertions = 0;
    let deletions = 0;
    let modifications = 0;
    for (const op of operations) {
        if (op.type === 'inserted') {
            insertions++;
        }
        else if (op.type === 'deleted') {
            deletions++;
        }
        else if (op.type === 'modified') {
            modifications++;
        }
    }
    // Also count modifications from alignment for more accurate stats
    const classification = classifyAlignment(alignment);
    modifications = classification.modified.length;
    return {
        insertions,
        deletions,
        modifications,
    };
}
//# sourceMappingURL=pipeline.js.map