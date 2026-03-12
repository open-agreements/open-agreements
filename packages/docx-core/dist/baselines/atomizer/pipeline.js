/**
 * Atomizer Pipeline
 *
 * Main orchestration for the atomizer-based document comparison.
 * Integrates atomization, LCS comparison, move detection, format detection,
 * and document reconstruction.
 */
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { DocxArchive } from '../../shared/docx/DocxArchive.js';
import { DEFAULT_MOVE_DETECTION_SETTINGS, DEFAULT_FORMAT_DETECTION_SETTINGS, CorrelationStatus, } from '../../core-types.js';
import { atomizeTree, assignParagraphIndices } from '../../atomizer.js';
import { detectMovesInAtomList } from '../../move-detection.js';
import { detectFormatChangesInAtomList } from '../../format-detection.js';
import { parseDocumentXml, findBody, backfillParentReferences, } from './xmlToWmlElement.js';
import { findAllByTagName, getLeafText } from '../../primitives/index.js';
import { createMergedAtomList, assignUnifiedParagraphIndices, } from './atomLcs.js';
import { hierarchicalCompare, markHierarchicalCorrelationStatus, } from './hierarchicalLcs.js';
import { reconstructDocument, computeReconstructionStats, } from './documentReconstructor.js';
import { modifyRevisedDocument } from './inPlaceModifier.js';
import { acceptAllChanges, rejectAllChanges, extractTextWithParagraphs, compareTexts, } from './trackChangesAcceptorAst.js';
import { virtualizeNumberingLabels, DEFAULT_NUMBERING_OPTIONS, } from './numberingIntegration.js';
import { premergeAdjacentRuns } from './premergeRuns.js';
function arraysEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
function collectReferencedBookmarkNames(root) {
    const refs = new Set();
    const refRegex = /\b(?:PAGEREF|REF)\s+([^\s\\]+)/g;
    for (const node of findAllByTagName(root, 'w:instrText')) {
        const instr = getLeafText(node) ?? '';
        for (const match of instr.matchAll(refRegex)) {
            const name = match[1]?.trim();
            if (name)
                refs.add(name);
        }
    }
    return Array.from(refs).sort();
}
function collectBookmarkDiagnostics(documentXml) {
    const root = parseDocumentXml(documentXml);
    const startSet = new Set();
    const endSet = new Set();
    const startNameSet = new Set();
    const duplicateStartSet = new Set();
    const duplicateEndSet = new Set();
    const duplicateStartNameSet = new Set();
    for (const node of findAllByTagName(root, 'w:bookmarkStart')) {
        const id = node.getAttribute('w:id');
        if (!id)
            continue;
        if (startSet.has(id))
            duplicateStartSet.add(id);
        else
            startSet.add(id);
        const name = node.getAttribute('w:name');
        if (name) {
            if (startNameSet.has(name))
                duplicateStartNameSet.add(name);
            else
                startNameSet.add(name);
        }
    }
    for (const node of findAllByTagName(root, 'w:bookmarkEnd')) {
        const id = node.getAttribute('w:id');
        if (!id)
            continue;
        if (endSet.has(id))
            duplicateEndSet.add(id);
        else
            endSet.add(id);
    }
    const startIds = Array.from(startSet).sort();
    const endIds = Array.from(endSet).sort();
    const startNames = Array.from(startNameSet).sort();
    const referencedBookmarkNames = collectReferencedBookmarkNames(root);
    const unresolvedReferenceNames = referencedBookmarkNames
        .filter((name) => !startNameSet.has(name))
        .sort();
    const unmatchedStartIds = startIds.filter((id) => !endSet.has(id));
    const unmatchedEndIds = endIds.filter((id) => !startSet.has(id));
    return {
        startIds,
        endIds,
        startNames,
        duplicateStartNames: Array.from(duplicateStartNameSet).sort(),
        referencedBookmarkNames,
        unresolvedReferenceNames,
        duplicateStartIds: Array.from(duplicateStartSet).sort(),
        duplicateEndIds: Array.from(duplicateEndSet).sort(),
        unmatchedStartIds,
        unmatchedEndIds,
    };
}
/**
 * Bookmark round-trip safety is semantic, not byte/ID exact:
 * - Bookmark IDs may be renumbered by reconstruction/Word and still be valid.
 * - Bookmark names and field-reference targets must stay intact.
 * - Structural integrity (balanced, no duplicates) must remain intact.
 */
function bookmarkDiagnosticsSemanticallyEqual(expected, actual) {
    return (arraysEqual(expected.startNames, actual.startNames) &&
        arraysEqual(expected.duplicateStartNames, actual.duplicateStartNames) &&
        arraysEqual(expected.referencedBookmarkNames, actual.referencedBookmarkNames) &&
        arraysEqual(expected.unresolvedReferenceNames, actual.unresolvedReferenceNames) &&
        arraysEqual(expected.duplicateStartIds, actual.duplicateStartIds) &&
        arraysEqual(expected.duplicateEndIds, actual.duplicateEndIds) &&
        arraysEqual(expected.unmatchedStartIds, actual.unmatchedStartIds) &&
        arraysEqual(expected.unmatchedEndIds, actual.unmatchedEndIds));
}
function diffIds(expected, actual) {
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    const missing = expected.filter((id) => !actualSet.has(id));
    const unexpected = actual.filter((id) => !expectedSet.has(id));
    return { missing, unexpected };
}
function buildTextMismatchDetails(expectedText, actualText) {
    const comparison = compareTexts(expectedText, actualText);
    const expectedParas = expectedText.split('\n');
    const actualParas = actualText.split('\n');
    const maxLen = Math.max(expectedParas.length, actualParas.length);
    let firstDifferingParagraphIndex = -1;
    for (let i = 0; i < maxLen; i++) {
        if ((expectedParas[i] ?? '') !== (actualParas[i] ?? '')) {
            firstDifferingParagraphIndex = i;
            break;
        }
    }
    return {
        expectedLength: comparison.expectedLength,
        actualLength: comparison.actualLength,
        firstDifferingParagraphIndex,
        expectedParagraph: firstDifferingParagraphIndex >= 0 ? (expectedParas[firstDifferingParagraphIndex] ?? '') : '',
        actualParagraph: firstDifferingParagraphIndex >= 0 ? (actualParas[firstDifferingParagraphIndex] ?? '') : '',
        differenceSample: comparison.differences.slice(0, 3),
    };
}
function buildBookmarkMismatchDetails(expected, actual) {
    return {
        startNames: diffIds(expected.startNames, actual.startNames),
        referencedBookmarkNames: diffIds(expected.referencedBookmarkNames, actual.referencedBookmarkNames),
        unresolvedReferenceNames: diffIds(expected.unresolvedReferenceNames, actual.unresolvedReferenceNames),
        startIds: diffIds(expected.startIds, actual.startIds),
        endIds: diffIds(expected.endIds, actual.endIds),
        expectedDuplicateStartNames: expected.duplicateStartNames,
        actualDuplicateStartNames: actual.duplicateStartNames,
        expectedDuplicateStartIds: expected.duplicateStartIds,
        actualDuplicateStartIds: actual.duplicateStartIds,
        expectedDuplicateEndIds: expected.duplicateEndIds,
        actualDuplicateEndIds: actual.duplicateEndIds,
        expectedUnmatchedStartIds: expected.unmatchedStartIds,
        actualUnmatchedStartIds: actual.unmatchedStartIds,
        expectedUnmatchedEndIds: expected.unmatchedEndIds,
        actualUnmatchedEndIds: actual.unmatchedEndIds,
    };
}
function summarizeIdDelta(delta) {
    return {
        missingCount: delta.missing.length,
        unexpectedCount: delta.unexpected.length,
        firstMissing: delta.missing[0],
        firstUnexpected: delta.unexpected[0],
    };
}
function truncateForSummary(value, maxLength = 160) {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength)}...`;
}
function summarizeTextMismatch(details) {
    return {
        firstDifferingParagraphIndex: details.firstDifferingParagraphIndex,
        expectedParagraph: truncateForSummary(details.expectedParagraph),
        actualParagraph: truncateForSummary(details.actualParagraph),
        firstDifference: details.differenceSample[0] ?? 'No diff sample',
    };
}
function summarizeBookmarkMismatch(details) {
    return {
        startNames: summarizeIdDelta(details.startNames),
        referencedBookmarkNames: summarizeIdDelta(details.referencedBookmarkNames),
        unresolvedReferenceNames: summarizeIdDelta(details.unresolvedReferenceNames),
        startIds: summarizeIdDelta(details.startIds),
        endIds: summarizeIdDelta(details.endIds),
        unmatchedStartCount: details.actualUnmatchedStartIds.length,
        unmatchedEndCount: details.actualUnmatchedEndIds.length,
        firstUnmatchedStartId: details.actualUnmatchedStartIds[0],
        firstUnmatchedEndId: details.actualUnmatchedEndIds[0],
    };
}
function buildFailureSummary(failureDetails) {
    if (!failureDetails) {
        return undefined;
    }
    const summary = {};
    if (failureDetails.acceptText) {
        summary.acceptText = summarizeTextMismatch(failureDetails.acceptText);
    }
    if (failureDetails.rejectText) {
        summary.rejectText = summarizeTextMismatch(failureDetails.rejectText);
    }
    if (failureDetails.acceptBookmarks) {
        summary.acceptBookmarks = summarizeBookmarkMismatch(failureDetails.acceptBookmarks);
    }
    if (failureDetails.rejectBookmarks) {
        summary.rejectBookmarks = summarizeBookmarkMismatch(failureDetails.rejectBookmarks);
    }
    return Object.keys(summary).length > 0 ? summary : undefined;
}
/**
 * Validate field structure integrity in document XML.
 *
 * Checks that fldChar begin/end are balanced and that w:instrText only
 * appears inside a proper field sequence (between begin and separate).
 * Orphaned instrText elements render as visible text in Word.
 */
function validateFieldStructure(documentXml) {
    const root = parseDocumentXml(documentXml);
    // Walk the document in order, tracking field nesting
    const allFldChars = findAllByTagName(root, 'w:fldChar');
    const allInstrTexts = findAllByTagName(root, 'w:instrText');
    // Quick balance check
    let begins = 0;
    let ends = 0;
    for (const fc of allFldChars) {
        const type = fc.getAttribute('w:fldCharType');
        if (type === 'begin')
            begins++;
        else if (type === 'end')
            ends++;
    }
    if (begins !== ends)
        return false;
    // Check that instrText elements are inside a field (between begin and separate).
    // Walk all elements in document order using a recursive scan.
    if (allInstrTexts.length === 0)
        return true; // No instrText, nothing to validate
    // Depth-first scan to check instrText placement
    let depth = 0;
    const pastSeparatorAtDepth = []; // track separator state per depth
    function scan(node) {
        for (let child = node.firstChild; child; child = child.nextSibling) {
            if (child.nodeType !== 1)
                continue; // skip non-elements
            const el = child;
            if (el.tagName === 'w:fldChar') {
                const type = el.getAttribute('w:fldCharType');
                if (type === 'begin') {
                    depth++;
                    pastSeparatorAtDepth[depth] = 0;
                }
                else if (type === 'separate') {
                    if (depth > 0)
                        pastSeparatorAtDepth[depth] = 1;
                }
                else if (type === 'end') {
                    if (depth > 0)
                        depth--;
                }
            }
            else if (el.tagName === 'w:instrText') {
                // instrText must be inside a field (depth > 0) and before the separator
                if (depth === 0 || pastSeparatorAtDepth[depth])
                    return false;
            }
            if (!scan(el))
                return false;
        }
        return true;
    }
    return scan(root);
}
function evaluateSafetyChecks(originalTextForRoundTrip, revisedTextForRoundTrip, originalBookmarkDiagnostics, revisedBookmarkDiagnostics, candidateXml) {
    const acceptedXml = acceptAllChanges(candidateXml);
    const rejectedXml = rejectAllChanges(candidateXml);
    const acceptedText = extractTextWithParagraphs(acceptedXml);
    const rejectedText = extractTextWithParagraphs(rejectedXml);
    const acceptedBookmarkDiagnostics = collectBookmarkDiagnostics(acceptedXml);
    const rejectedBookmarkDiagnostics = collectBookmarkDiagnostics(rejectedXml);
    const acceptTextComparison = compareTexts(revisedTextForRoundTrip, acceptedText);
    const rejectTextComparison = compareTexts(originalTextForRoundTrip, rejectedText);
    const acceptBookmarksOk = bookmarkDiagnosticsSemanticallyEqual(revisedBookmarkDiagnostics, acceptedBookmarkDiagnostics);
    const rejectBookmarksOk = bookmarkDiagnosticsSemanticallyEqual(originalBookmarkDiagnostics, rejectedBookmarkDiagnostics);
    // Validate field structure: after accept-all and reject-all, every
    // w:instrText must be inside a proper field sequence (between fldChar
    // begin and fldChar separate). Orphaned instrText renders as visible
    // text in Word.
    const fieldStructureOk = validateFieldStructure(acceptedXml) && validateFieldStructure(rejectedXml);
    const checks = {
        acceptText: acceptTextComparison.normalizedIdentical,
        rejectText: rejectTextComparison.normalizedIdentical,
        // Bookmark checks are soft: consumer compatibility pass legitimately alters
        // bookmarks (deduplication, orphan repair, hoisting out of revision wrappers).
        // Log mismatches in diagnostics but don't trigger fallback to rebuild.
        acceptBookmarks: true,
        rejectBookmarks: true,
        fieldStructure: fieldStructureOk,
    };
    const failedChecks = Object.entries(checks)
        .filter(([, ok]) => !ok)
        .map(([name]) => name);
    const failureDetails = {};
    if (!checks.acceptText) {
        failureDetails.acceptText = buildTextMismatchDetails(revisedTextForRoundTrip, acceptedText);
    }
    if (!checks.rejectText) {
        failureDetails.rejectText = buildTextMismatchDetails(originalTextForRoundTrip, rejectedText);
    }
    // Bookmark mismatches are always collected for diagnostics even though the
    // check itself is soft (doesn't trigger fallback).
    if (!acceptBookmarksOk) {
        failureDetails.acceptBookmarks = buildBookmarkMismatchDetails(revisedBookmarkDiagnostics, acceptedBookmarkDiagnostics);
    }
    if (!rejectBookmarksOk) {
        failureDetails.rejectBookmarks = buildBookmarkMismatchDetails(originalBookmarkDiagnostics, rejectedBookmarkDiagnostics);
    }
    return {
        safe: failedChecks.length === 0,
        checks,
        failedChecks,
        failureDetails: failedChecks.length > 0 ? failureDetails : undefined,
        failureSummary: failedChecks.length > 0 ? buildFailureSummary(failureDetails) : undefined,
    };
}
/**
 * Compare two DOCX documents using the atomizer-based approach.
 *
 * Pipeline steps:
 * 1. Load DOCX archives
 * 2. Extract document.xml
 * 3. Parse to WmlElement trees
 * 4. Atomize both documents
 * 5. (Optional) Apply numbering virtualization
 * 6. Run LCS on atom hashes
 * 7. Mark correlation status
 * 8. Run move detection
 * 9. Run format detection
 * 10. Reconstruct document with track changes
 * 11. Save and return result
 *
 * @param original - Original document as Buffer
 * @param revised - Revised document as Buffer
 * @param options - Pipeline options
 * @returns Comparison result with track changes document
 */
export async function compareDocumentsAtomizer(original, revised, options = {}) {
    const { author = 'Comparison', date = new Date(), moveDetection = {}, formatDetection = {}, numbering = {}, premergeRuns = true, reconstructionMode = 'rebuild', } = options;
    // Merge settings with defaults
    const moveSettings = {
        ...DEFAULT_MOVE_DETECTION_SETTINGS,
        ...moveDetection,
    };
    const formatSettings = {
        ...DEFAULT_FORMAT_DETECTION_SETTINGS,
        ...formatDetection,
    };
    const numberingSettings = {
        ...DEFAULT_NUMBERING_OPTIONS,
        ...numbering,
    };
    // Step 1: Load DOCX archives
    const originalArchive = await DocxArchive.load(original);
    const revisedArchive = await DocxArchive.load(revised);
    // Step 2: Extract document.xml
    const originalXml = await originalArchive.getDocumentXml();
    const revisedXml = await revisedArchive.getDocumentXml();
    // Extract numbering.xml if available
    const originalNumberingXml = await originalArchive.getNumberingXml() ?? undefined;
    const revisedNumberingXml = await revisedArchive.getNumberingXml() ?? undefined;
    const originalPart = {
        uri: 'word/document.xml',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    };
    const revisedPart = {
        uri: 'word/document.xml',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    };
    const originalTextForRoundTrip = extractTextWithParagraphs(originalXml);
    const revisedTextForRoundTrip = extractTextWithParagraphs(revisedXml);
    const originalBookmarkDiagnostics = collectBookmarkDiagnostics(originalXml);
    const revisedBookmarkDiagnostics = collectBookmarkDiagnostics(revisedXml);
    const runComparisonPass = (atomizeOptions, outputMode) => {
        // Parse fresh trees for each pass because inplace reconstruction mutates revised AST.
        const originalTree = parseDocumentXml(originalXml);
        const revisedTree = parseDocumentXml(revisedXml);
        backfillParentReferences(originalTree);
        backfillParentReferences(revisedTree);
        const originalBody = findBody(originalTree);
        const revisedBody = findBody(revisedTree);
        if (!originalBody || !revisedBody) {
            throw new Error('Could not find w:body in one or both documents');
        }
        if (premergeRuns) {
            premergeAdjacentRuns(originalBody);
            premergeAdjacentRuns(revisedBody);
        }
        const { atoms: originalAtoms } = atomizeTree(originalBody, [], originalPart, atomizeOptions);
        const { atoms: revisedAtoms } = atomizeTree(revisedBody, [], revisedPart, atomizeOptions);
        // Assign paragraph indices for proper grouping during reconstruction
        assignParagraphIndices(originalAtoms);
        assignParagraphIndices(revisedAtoms);
        // Step 5: Apply numbering virtualization (optional)
        if (numberingSettings.enabled) {
            virtualizeNumberingLabels(originalAtoms, originalNumberingXml, numberingSettings);
            virtualizeNumberingLabels(revisedAtoms, revisedNumberingXml, numberingSettings);
        }
        // Step 6: Run hierarchical LCS (paragraph-level first, then atom-level within)
        const lcsResult = hierarchicalCompare(originalAtoms, revisedAtoms);
        // Step 7: Mark correlation status using hierarchical result
        markHierarchicalCorrelationStatus(originalAtoms, revisedAtoms, lcsResult);
        // Step 8: Run move detection
        if (moveSettings.detectMoves) {
            // Create a combined list for move detection
            // Move detection looks at the revised atoms with Inserted status
            // and original atoms with Deleted status
            const allAtoms = [...originalAtoms, ...revisedAtoms];
            detectMovesInAtomList(allAtoms, moveSettings);
        }
        // Step 9: Run format detection
        if (formatSettings.detectFormatChanges) {
            // Format detection operates on the revised atoms that are Equal
            detectFormatChangesInAtomList(revisedAtoms, formatSettings);
        }
        // Step 10: Create merged atom list for reconstruction
        const mergedAtoms = createMergedAtomList(originalAtoms, revisedAtoms, lcsResult);
        // Step 10b: Assign unified paragraph indices to handle atoms from different trees
        assignUnifiedParagraphIndices(originalAtoms, revisedAtoms, mergedAtoms, lcsResult);
        // Step 11: Reconstruct document with track changes
        let newDocumentXml;
        if (outputMode === 'inplace') {
            // In-place mode: modify the revised AST directly, producing revised-based output.
            newDocumentXml = modifyRevisedDocument(revisedTree, originalAtoms, revisedAtoms, mergedAtoms, { author, date });
        }
        else {
            // Rebuild mode: reconstruct from atoms using original as the structural base.
            newDocumentXml = reconstructDocument(mergedAtoms, originalXml, { author, date });
        }
        return { mergedAtoms, newDocumentXml, outputMode };
    };
    const evaluateRoundTripSafety = (candidateXml) => evaluateSafetyChecks(originalTextForRoundTrip, revisedTextForRoundTrip, originalBookmarkDiagnostics, revisedBookmarkDiagnostics, candidateXml);
    let comparisonResult;
    let fallbackReason;
    let fallbackDiagnostics;
    if (reconstructionMode === 'inplace') {
        // Adaptive strategy:
        // 1) Try no-cross-run passes first (higher run anchoring fidelity).
        // 2) If safety fails, retry with cross-run merging to handle run-fragmented docs.
        // 3) If still unsafe, reuse rebuild reconstruction as a hard safety fallback.
        const inplacePasses = [
            {
                pass: 'inplace_word_split',
                atomizeOptions: {
                    cloneLeafNodes: true,
                    mergeAcrossRuns: false,
                    mergePunctuationAcrossRuns: false,
                    splitTextIntoWords: true,
                },
            },
            {
                pass: 'inplace_run_level',
                atomizeOptions: {
                    cloneLeafNodes: true,
                    mergeAcrossRuns: false,
                    mergePunctuationAcrossRuns: false,
                    splitTextIntoWords: false,
                },
            },
            {
                pass: 'inplace_word_split_cross_run',
                atomizeOptions: {
                    cloneLeafNodes: true,
                    mergeAcrossRuns: true,
                    mergePunctuationAcrossRuns: true,
                    splitTextIntoWords: true,
                },
            },
            {
                pass: 'inplace_run_level_cross_run',
                atomizeOptions: {
                    cloneLeafNodes: true,
                    mergeAcrossRuns: true,
                    mergePunctuationAcrossRuns: true,
                    splitTextIntoWords: false,
                },
            },
        ];
        const failedAttempts = [];
        let selected;
        for (const { pass, atomizeOptions } of inplacePasses) {
            const candidate = runComparisonPass(atomizeOptions, 'inplace');
            const safety = evaluateRoundTripSafety(candidate.newDocumentXml);
            if (safety.safe) {
                selected = candidate;
                break;
            }
            failedAttempts.push({
                pass,
                checks: safety.checks,
                failedChecks: safety.failedChecks,
                failureDetails: safety.failureDetails,
                firstDiffSummary: safety.failureSummary,
            });
        }
        if (selected) {
            comparisonResult = selected;
        }
        else {
            comparisonResult = runComparisonPass(undefined, 'rebuild');
            fallbackReason = 'round_trip_safety_check_failed';
            fallbackDiagnostics = {
                attempts: failedAttempts,
            };
        }
    }
    else {
        comparisonResult = runComparisonPass(undefined, 'rebuild');
    }
    const { mergedAtoms, newDocumentXml } = comparisonResult;
    // Step 12: Clone appropriate archive and update document.xml.
    // Use the revised archive only for true inplace output.
    const baseArchive = comparisonResult.outputMode === 'inplace' ? revisedArchive : originalArchive;
    const resultArchive = await baseArchive.clone();
    resultArchive.setDocumentXml(newDocumentXml);
    // Step 12b: For inplace mode, merge auxiliary part definitions (footnotes,
    // endnotes, comments) from the original document. Inplace reconstruction
    // inserts deleted content that may reference definitions not present in the
    // revised archive.
    if (comparisonResult.outputMode === 'inplace') {
        const mergeResults = new Map();
        for (const descriptor of AUXILIARY_PARTS) {
            const result = await mergeAuxiliaryPartDefinitions(originalArchive, resultArchive, newDocumentXml, descriptor);
            if (result.mergedIds.size > 0) {
                mergeResults.set(descriptor.label, result);
            }
        }
        // Post-merge hook for comment ancillary parts
        if (mergeResults.has('comment')) {
            await mergeCommentAncillaryParts(originalArchive, resultArchive, mergeResults.get('comment'));
        }
    }
    // Step 13: Save result and compute stats
    const resultBuffer = await resultArchive.save();
    const stats = computeStats(mergedAtoms);
    return {
        document: resultBuffer,
        stats,
        engine: 'atomizer',
        reconstructionModeRequested: reconstructionMode,
        reconstructionModeUsed: comparisonResult.outputMode,
        fallbackReason,
        fallbackDiagnostics,
    };
}
const AUXILIARY_PARTS = [
    {
        label: 'footnote',
        partPath: 'word/footnotes.xml',
        referenceTag: 'w:footnoteReference',
        entryTag: 'w:footnote',
        rootTag: 'w:footnotes',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml',
        relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes',
    },
    {
        label: 'endnote',
        partPath: 'word/endnotes.xml',
        referenceTag: 'w:endnoteReference',
        entryTag: 'w:endnote',
        rootTag: 'w:endnotes',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml',
        relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes',
    },
    {
        label: 'comment',
        partPath: 'word/comments.xml',
        referenceTag: 'w:commentReference',
        entryTag: 'w:comment',
        rootTag: 'w:comments',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml',
        relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
    },
];
/**
 * Collect reference IDs from document.xml using DOM parsing.
 */
function collectReferenceIds(documentXml, referenceTag) {
    const ids = new Set();
    const doc = new DOMParser().parseFromString(documentXml, 'application/xml');
    const refs = doc.getElementsByTagName(referenceTag);
    for (let i = 0; i < refs.length; i++) {
        const id = refs[i].getAttribute('w:id');
        if (id)
            ids.add(id);
    }
    return ids;
}
/**
 * Parse an auxiliary part and extract entry elements by ID.
 */
function parseEntries(xml, entryTag) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const entries = new Map();
    const elements = doc.getElementsByTagName(entryTag);
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const id = el.getAttribute('w:id');
        if (id)
            entries.set(id, el);
    }
    return { doc, entries };
}
const serializer = new XMLSerializer();
/**
 * Merge auxiliary part definitions (footnotes, endnotes, comments) from the
 * original archive into the result archive. When inplace mode inserts deleted
 * content, the corresponding definitions must exist in the auxiliary part.
 */
async function mergeAuxiliaryPartDefinitions(originalArchive, resultArchive, documentXml, descriptor) {
    const result = { mergedIds: new Set(), createdPart: false };
    const referencedIds = collectReferenceIds(documentXml, descriptor.referenceTag);
    if (referencedIds.size === 0)
        return result;
    const originalPartXml = await originalArchive.getFile(descriptor.partPath);
    if (!originalPartXml)
        return result;
    const resultPartXml = await resultArchive.getFile(descriptor.partPath);
    const originalParsed = parseEntries(originalPartXml, descriptor.entryTag);
    const resultParsed = resultPartXml ? parseEntries(resultPartXml, descriptor.entryTag) : null;
    // Find missing entries: referenced in document.xml but not in result
    const missingElements = [];
    for (const id of referencedIds) {
        if (!(resultParsed?.entries.has(id)) && originalParsed.entries.has(id)) {
            missingElements.push(originalParsed.entries.get(id));
            result.mergedIds.add(id);
        }
    }
    if (missingElements.length === 0)
        return result;
    if (resultPartXml && resultParsed) {
        // Insert missing entries into existing result part
        const rootEl = resultParsed.doc.getElementsByTagName(descriptor.rootTag)[0];
        if (rootEl) {
            for (const el of missingElements) {
                const imported = resultParsed.doc.importNode(el, true);
                rootEl.appendChild(imported);
            }
            resultArchive.setFile(descriptor.partPath, serializer.serializeToString(resultParsed.doc));
        }
    }
    else {
        // Create part from scratch: clone root from original, insert missing entries
        const newDoc = new DOMParser().parseFromString(originalPartXml, 'application/xml');
        const rootEl = newDoc.getElementsByTagName(descriptor.rootTag)[0];
        if (rootEl) {
            // Remove all existing entries — we only want the missing ones
            const existingEntries = rootEl.getElementsByTagName(descriptor.entryTag);
            const toRemove = [];
            for (let i = 0; i < existingEntries.length; i++) {
                toRemove.push(existingEntries[i]);
            }
            for (const el of toRemove) {
                rootEl.removeChild(el);
            }
            // Add back only the missing entries
            for (const el of missingElements) {
                const imported = newDoc.importNode(el, true);
                rootEl.appendChild(imported);
            }
            resultArchive.setFile(descriptor.partPath, serializer.serializeToString(newDoc));
            result.createdPart = true;
            // Bootstrap OPC metadata for the newly created part
            await ensureOpcMetadata(resultArchive, descriptor);
        }
    }
    return result;
}
// =============================================================================
// OPC Metadata Bootstrapping
// =============================================================================
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
/**
 * Ensure [Content_Types].xml and document.xml.rels have entries for a
 * newly-created auxiliary part.
 */
async function ensureOpcMetadata(archive, descriptor) {
    // 1. Update [Content_Types].xml
    const ctXml = await archive.getFile('[Content_Types].xml');
    if (ctXml) {
        const ctDoc = new DOMParser().parseFromString(ctXml, 'application/xml');
        const typesEl = ctDoc.documentElement;
        const overrides = typesEl.getElementsByTagNameNS(CT_NS, 'Override');
        const partName = `/${descriptor.partPath}`;
        let found = false;
        for (let i = 0; i < overrides.length; i++) {
            if (overrides[i].getAttribute('PartName') === partName) {
                found = true;
                break;
            }
        }
        if (!found) {
            const override = ctDoc.createElementNS(CT_NS, 'Override');
            override.setAttribute('PartName', partName);
            override.setAttribute('ContentType', descriptor.contentType);
            typesEl.appendChild(override);
            archive.setFile('[Content_Types].xml', serializer.serializeToString(ctDoc));
        }
    }
    // 2. Update word/_rels/document.xml.rels
    const relsPath = 'word/_rels/document.xml.rels';
    const relsXml = await archive.getFile(relsPath);
    if (relsXml) {
        const relsDoc = new DOMParser().parseFromString(relsXml, 'application/xml');
        const relsEl = relsDoc.documentElement;
        const existingRels = relsEl.getElementsByTagNameNS(REL_NS, 'Relationship');
        let found = false;
        let maxId = 0;
        for (let i = 0; i < existingRels.length; i++) {
            const rel = existingRels[i];
            if (rel.getAttribute('Type') === descriptor.relationshipType) {
                found = true;
            }
            const id = rel.getAttribute('Id') ?? '';
            const idMatch = /^rId(\d+)$/.exec(id);
            if (idMatch)
                maxId = Math.max(maxId, parseInt(idMatch[1], 10));
        }
        if (!found) {
            maxId++;
            const rel = relsDoc.createElementNS(REL_NS, 'Relationship');
            rel.setAttribute('Id', `rId${maxId}`);
            rel.setAttribute('Type', descriptor.relationshipType);
            rel.setAttribute('Target', descriptor.partPath.replace('word/', ''));
            relsEl.appendChild(rel);
            archive.setFile(relsPath, serializer.serializeToString(relsDoc));
        }
    }
}
// =============================================================================
// Comment Ancillary Parts Merging
// =============================================================================
/**
 * After merging comment definitions, copy related entries from
 * commentsExtended.xml and people.xml for author fidelity and reply threading.
 */
async function mergeCommentAncillaryParts(originalArchive, resultArchive, commentMergeResult) {
    // Collect authors and paraIds from the merged comment entries
    const originalCommentsXml = await originalArchive.getFile('word/comments.xml');
    if (!originalCommentsXml)
        return;
    const origDoc = new DOMParser().parseFromString(originalCommentsXml, 'application/xml');
    const mergedAuthors = new Set();
    const mergedParaIds = new Set();
    const commentEls = origDoc.getElementsByTagName('w:comment');
    for (let i = 0; i < commentEls.length; i++) {
        const el = commentEls[i];
        const id = el.getAttribute('w:id');
        if (!id || !commentMergeResult.mergedIds.has(id))
            continue;
        const author = el.getAttribute('w:author');
        if (author)
            mergedAuthors.add(author);
        // Collect paraIds from <w:p> children inside the comment
        const paras = el.getElementsByTagName('w:p');
        for (let j = 0; j < paras.length; j++) {
            const p = paras[j];
            const paraId = p.getAttribute('w14:paraId');
            if (paraId)
                mergedParaIds.add(paraId);
        }
    }
    // Merge commentsExtended.xml entries matching merged paraIds
    await mergeCommentsExtended(originalArchive, resultArchive, mergedParaIds);
    // Merge people.xml entries matching merged authors
    await mergePeople(originalArchive, resultArchive, mergedAuthors);
}
async function mergeCommentsExtended(originalArchive, resultArchive, mergedParaIds) {
    if (mergedParaIds.size === 0)
        return;
    const originalXml = await originalArchive.getFile('word/commentsExtended.xml');
    if (!originalXml)
        return;
    const origDoc = new DOMParser().parseFromString(originalXml, 'application/xml');
    const origEntries = origDoc.getElementsByTagName('w15:commentEx');
    // Collect entries whose paraId matches a merged comment's paragraph
    const entriesToMerge = [];
    for (let i = 0; i < origEntries.length; i++) {
        const el = origEntries[i];
        const paraId = el.getAttribute('w15:paraId');
        if (paraId && mergedParaIds.has(paraId)) {
            entriesToMerge.push(el);
        }
    }
    if (entriesToMerge.length === 0)
        return;
    let resultXml = await resultArchive.getFile('word/commentsExtended.xml');
    if (resultXml) {
        const resultDoc = new DOMParser().parseFromString(resultXml, 'application/xml');
        const rootEl = resultDoc.documentElement;
        // Check existing paraIds to avoid duplicates
        const existingParaIds = new Set();
        const existing = rootEl.getElementsByTagName('w15:commentEx');
        for (let i = 0; i < existing.length; i++) {
            const pid = existing[i].getAttribute('w15:paraId');
            if (pid)
                existingParaIds.add(pid);
        }
        for (const el of entriesToMerge) {
            const pid = el.getAttribute('w15:paraId');
            if (pid && !existingParaIds.has(pid)) {
                rootEl.appendChild(resultDoc.importNode(el, true));
            }
        }
        resultArchive.setFile('word/commentsExtended.xml', serializer.serializeToString(resultDoc));
    }
    // If commentsExtended.xml doesn't exist in result, we don't create it —
    // the file is optional and its absence won't cause crashes.
}
async function mergePeople(originalArchive, resultArchive, mergedAuthors) {
    if (mergedAuthors.size === 0)
        return;
    const originalXml = await originalArchive.getFile('word/people.xml');
    if (!originalXml)
        return;
    const origDoc = new DOMParser().parseFromString(originalXml, 'application/xml');
    const origPersons = origDoc.getElementsByTagName('w15:person');
    const personsToMerge = [];
    for (let i = 0; i < origPersons.length; i++) {
        const el = origPersons[i];
        const author = el.getAttribute('w15:author');
        if (author && mergedAuthors.has(author)) {
            personsToMerge.push(el);
        }
    }
    if (personsToMerge.length === 0)
        return;
    let resultXml = await resultArchive.getFile('word/people.xml');
    if (resultXml) {
        const resultDoc = new DOMParser().parseFromString(resultXml, 'application/xml');
        const rootEl = resultDoc.documentElement;
        // Check existing authors to avoid duplicates
        const existingAuthors = new Set();
        const existing = rootEl.getElementsByTagName('w15:person');
        for (let i = 0; i < existing.length; i++) {
            const a = existing[i].getAttribute('w15:author');
            if (a)
                existingAuthors.add(a);
        }
        for (const el of personsToMerge) {
            const a = el.getAttribute('w15:author');
            if (a && !existingAuthors.has(a)) {
                rootEl.appendChild(resultDoc.importNode(el, true));
            }
        }
        resultArchive.setFile('word/people.xml', serializer.serializeToString(resultDoc));
    }
    // If people.xml doesn't exist in result, we don't create it —
    // the file is optional and its absence won't cause crashes.
}
/**
 * Compute comparison statistics from merged atoms.
 */
function computeStats(mergedAtoms) {
    const reconstructionStats = computeReconstructionStats(mergedAtoms);
    // Count unique paragraphs for modifications
    // A modification is when we have both deleted and inserted atoms in the same paragraph
    const modifiedParagraphs = new Set();
    let currentParagraph = '';
    let hasDeleted = false;
    let hasInserted = false;
    for (const atom of mergedAtoms) {
        // Detect paragraph boundaries
        const pAncestor = atom.ancestorElements.find((a) => a.tagName === 'w:p');
        const paragraphId = pAncestor
            ? `${atom.part.uri}:${atom.ancestorElements.indexOf(pAncestor)}`
            : '';
        if (paragraphId !== currentParagraph) {
            // Check previous paragraph
            if (currentParagraph && hasDeleted && hasInserted) {
                modifiedParagraphs.add(currentParagraph);
            }
            currentParagraph = paragraphId;
            hasDeleted = false;
            hasInserted = false;
        }
        if (atom.correlationStatus === CorrelationStatus.Deleted) {
            hasDeleted = true;
        }
        else if (atom.correlationStatus === CorrelationStatus.Inserted) {
            hasInserted = true;
        }
    }
    // Check last paragraph
    if (currentParagraph && hasDeleted && hasInserted) {
        modifiedParagraphs.add(currentParagraph);
    }
    return {
        insertions: reconstructionStats.insertions,
        deletions: reconstructionStats.deletions,
        modifications: modifiedParagraphs.size + reconstructionStats.formatChanges,
    };
}
//# sourceMappingURL=pipeline.js.map