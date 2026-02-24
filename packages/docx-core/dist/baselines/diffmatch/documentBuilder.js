/**
 * Document builder for reconstructing DOCX with track changes.
 *
 * Takes alignment results and produces a new document.xml with
 * insertions and deletions marked using OOXML track changes.
 */
import { diffRuns } from './runDiff.js';
import { renderTrackChanges, generateDeletedParagraph, generateInsertedParagraph, wrapInParagraph, } from './trackChangesRenderer.js';
import { extractSectPr } from './xmlParser.js';
/**
 * Generate paragraph operations from alignment result.
 *
 * This converts the alignment result into a list of XML paragraph operations
 * that can be used to build the output document.
 */
export function generateParagraphOperations(alignment, originalParagraphs, revisedParagraphs, options) {
    const operations = [];
    const { author, date } = options;
    // Build lookup maps for original paragraphs by index
    const originalByIndex = new Map();
    for (const p of originalParagraphs) {
        originalByIndex.set(p.originalIndex, p);
    }
    // Build lookup maps for revised paragraphs by index
    const revisedByIndex = new Map();
    for (const p of revisedParagraphs) {
        revisedByIndex.set(p.originalIndex, p);
    }
    // Track which original paragraphs have been matched
    const matchedOriginalIndices = new Set();
    const matchedRevisedIndices = new Set();
    // Build a map from revised index to the matching original paragraph
    const revisedToOriginal = new Map();
    for (const match of alignment.matched) {
        const origPara = match.original;
        const revPara = match.revised;
        matchedOriginalIndices.add(origPara.originalIndex);
        matchedRevisedIndices.add(revPara.originalIndex);
        revisedToOriginal.set(revPara.originalIndex, origPara);
    }
    // Build output in revised document order
    // For each position in the revised document, we output:
    // 1. Any deleted paragraphs that came before the matching original
    // 2. The matched/inserted paragraph
    let lastOriginalIndex = -1;
    for (let revIdx = 0; revIdx < revisedParagraphs.length; revIdx++) {
        const revPara = revisedParagraphs[revIdx];
        if (matchedRevisedIndices.has(revIdx)) {
            // This is a matched paragraph
            const origPara = revisedToOriginal.get(revIdx);
            // First, output any deleted paragraphs between last and this
            for (let i = lastOriginalIndex + 1; i < origPara.originalIndex; i++) {
                if (!matchedOriginalIndices.has(i)) {
                    const deletedPara = originalByIndex.get(i);
                    if (deletedPara) {
                        operations.push({
                            type: 'deleted',
                            xml: generateDeletedParagraph(deletedPara.runs, author, date, extractPPrContent(deletedPara.pPrXml)),
                            originalIndex: i,
                        });
                    }
                }
            }
            // Check if paragraphs are identical or modified
            const similarity = alignment.matched.find(m => m.revised.originalIndex === revIdx)?.similarity ?? 0;
            if (similarity >= 0.9999) {
                // Unchanged paragraph - use revised content as-is
                operations.push({
                    type: 'unchanged',
                    xml: generateParagraphXml(revPara),
                    originalIndex: origPara.originalIndex,
                    revisedIndex: revIdx,
                });
            }
            else {
                // Modified paragraph - diff the runs
                const diffResult = diffRuns(origPara.runs, revPara.runs);
                const trackChangesContent = renderTrackChanges(diffResult.mergedRuns, {
                    author,
                    date,
                });
                operations.push({
                    type: 'modified',
                    xml: wrapInParagraph(trackChangesContent, extractPPrContent(revPara.pPrXml)),
                    originalIndex: origPara.originalIndex,
                    revisedIndex: revIdx,
                });
            }
            lastOriginalIndex = origPara.originalIndex;
        }
        else {
            // This is an inserted paragraph
            operations.push({
                type: 'inserted',
                xml: generateInsertedParagraph(revPara.runs, author, date, extractPPrContent(revPara.pPrXml)),
                revisedIndex: revIdx,
            });
        }
    }
    // Output any remaining deleted paragraphs at the end
    for (let i = lastOriginalIndex + 1; i < originalParagraphs.length; i++) {
        if (!matchedOriginalIndices.has(i)) {
            const deletedPara = originalByIndex.get(i);
            if (deletedPara) {
                operations.push({
                    type: 'deleted',
                    xml: generateDeletedParagraph(deletedPara.runs, author, date, extractPPrContent(deletedPara.pPrXml)),
                    originalIndex: i,
                });
            }
        }
    }
    return operations;
}
/**
 * Build a new document.xml with track changes applied.
 *
 * @param originalXml - The original document.xml content
 * @param operations - Ordered list of paragraph operations
 * @returns The new document.xml content
 */
export function buildDocumentWithTrackChanges(originalXml, operations) {
    // Extract document structure
    const { beforeBody, bodyContent, afterBody } = getDocumentParts(originalXml);
    // Extract sectPr from body (must be preserved at end)
    const { sectPr } = extractSectPr(bodyContent);
    // Build new body content from operations
    const paragraphXmls = operations.map(op => op.xml);
    // Combine: paragraphs + sectPr (if present) + closing
    let newBodyContent = paragraphXmls.join('\n');
    if (sectPr) {
        newBodyContent += '\n' + sectPr;
    }
    // Reconstruct document
    return beforeBody + newBodyContent + afterBody;
}
/**
 * Extract document parts for reconstruction.
 */
function getDocumentParts(documentXml) {
    // Find w:body opening and closing
    const bodyOpenMatch = documentXml.match(/<w:body[^>]*>/);
    const bodyCloseMatch = documentXml.match(/<\/w:body>/);
    if (!bodyOpenMatch || !bodyCloseMatch) {
        return {
            beforeBody: documentXml,
            bodyContent: '',
            afterBody: '',
        };
    }
    const bodyOpenEnd = documentXml.indexOf(bodyOpenMatch[0]) + bodyOpenMatch[0].length;
    const bodyCloseStart = documentXml.lastIndexOf('</w:body>');
    return {
        beforeBody: documentXml.slice(0, bodyOpenEnd),
        bodyContent: documentXml.slice(bodyOpenEnd, bodyCloseStart),
        afterBody: documentXml.slice(bodyCloseStart),
    };
}
/**
 * Generate XML for an unchanged paragraph.
 */
function generateParagraphXml(para) {
    // Build paragraph from runs
    const runsXml = para.runs.map(run => generateRunXml(run)).join('');
    const pPr = para.pPrXml ? para.pPrXml : '';
    return `<w:p>${pPr}${runsXml}</w:p>`;
}
/**
 * Generate XML for a single run.
 */
function generateRunXml(run) {
    const rPr = generateRunPropertiesXml(run.properties);
    // Handle whitespace preservation
    const needsSpace = run.text.startsWith(' ') || run.text.endsWith(' ') || run.text.includes('  ');
    const spaceAttr = needsSpace ? ' xml:space="preserve"' : '';
    return `<w:r>${rPr}<w:t${spaceAttr}>${escapeXml(run.text)}</w:t></w:r>`;
}
/**
 * Generate run properties XML.
 */
function generateRunPropertiesXml(props) {
    if (!props)
        return '';
    const parts = [];
    if (props.bold)
        parts.push('<w:b/>');
    if (props.italic)
        parts.push('<w:i/>');
    if (props.underline)
        parts.push(`<w:u w:val="${escapeXml(props.underline)}"/>`);
    if (props.strikethrough)
        parts.push('<w:strike/>');
    if (props.highlight)
        parts.push(`<w:highlight w:val="${escapeXml(props.highlight)}"/>`);
    if (props.color)
        parts.push(`<w:color w:val="${escapeXml(props.color)}"/>`);
    if (props.fontSize !== undefined)
        parts.push(`<w:sz w:val="${props.fontSize}"/>`);
    if (props.fontFamily)
        parts.push(`<w:rFonts w:ascii="${escapeXml(props.fontFamily)}" w:hAnsi="${escapeXml(props.fontFamily)}"/>`);
    if (parts.length === 0)
        return '';
    return `<w:rPr>${parts.join('')}</w:rPr>`;
}
/**
 * Extract inner pPr content from full pPr XML.
 * Removes the outer <w:pPr> tags.
 */
function extractPPrContent(pPrXml) {
    if (!pPrXml)
        return undefined;
    // Remove outer tags
    const match = pPrXml.match(/<w:pPr[^>]*>([\s\S]*)<\/w:pPr>/);
    return match ? match[1] : undefined;
}
/**
 * Escape XML special characters.
 */
function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
//# sourceMappingURL=documentBuilder.js.map