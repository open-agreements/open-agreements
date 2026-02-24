/**
 * Atomizer Pipeline
 *
 * Main orchestration for the atomizer-based document comparison.
 * Integrates atomization, LCS comparison, move detection, format detection,
 * and document reconstruction.
 */
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
function evaluateSafetyChecks(originalTextForRoundTrip, revisedTextForRoundTrip, originalBookmarkDiagnostics, revisedBookmarkDiagnostics, candidateXml) {
    const acceptedXml = acceptAllChanges(candidateXml);
    const rejectedXml = rejectAllChanges(candidateXml);
    const acceptedText = extractTextWithParagraphs(acceptedXml);
    const rejectedText = extractTextWithParagraphs(rejectedXml);
    const acceptedBookmarkDiagnostics = collectBookmarkDiagnostics(acceptedXml);
    const rejectedBookmarkDiagnostics = collectBookmarkDiagnostics(rejectedXml);
    const acceptTextComparison = compareTexts(revisedTextForRoundTrip, acceptedText);
    const rejectTextComparison = compareTexts(originalTextForRoundTrip, rejectedText);
    const checks = {
        acceptText: acceptTextComparison.normalizedIdentical,
        rejectText: rejectTextComparison.normalizedIdentical,
        acceptBookmarks: bookmarkDiagnosticsSemanticallyEqual(revisedBookmarkDiagnostics, acceptedBookmarkDiagnostics),
        rejectBookmarks: bookmarkDiagnosticsSemanticallyEqual(originalBookmarkDiagnostics, rejectedBookmarkDiagnostics),
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
    if (!checks.acceptBookmarks) {
        failureDetails.acceptBookmarks = buildBookmarkMismatchDetails(revisedBookmarkDiagnostics, acceptedBookmarkDiagnostics);
    }
    if (!checks.rejectBookmarks) {
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
    const { author = 'Comparison', date = new Date(), moveDetection = {}, formatDetection = {}, numbering = {}, premergeRuns = false, reconstructionMode = 'rebuild', } = options;
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
        // 1) Try finer word-level atomization for better redline precision.
        // 2) If safety fails, try conservative run-level atomization.
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