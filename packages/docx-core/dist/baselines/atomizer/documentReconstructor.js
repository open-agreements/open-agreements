/**
 * Document Reconstructor
 *
 * Rebuilds document.xml from marked atoms with track changes.
 * Generates w:ins, w:del, w:moveFrom, w:moveTo elements as appropriate.
 */
import { CorrelationStatus } from '../../core-types.js';
import { getLeafText, childElements } from '../../primitives/index.js';
import { serializeToXml, cloneElement } from './xmlToWmlElement.js';
import { EMPTY_PARAGRAPH_TAG } from '../../atomizer.js';
import { debug } from './debug.js';
/**
 * Create initial revision ID state.
 */
function createRevisionIdState() {
    return {
        nextId: 1,
        moveRangeIds: new Map(),
    };
}
/**
 * Allocate a new revision ID.
 */
function allocateRevisionId(state) {
    return state.nextId++;
}
/**
 * Get or allocate move range IDs for a move name.
 */
function getMoveRangeIds(state, moveName) {
    let ids = state.moveRangeIds.get(moveName);
    if (!ids) {
        ids = {
            sourceRangeId: allocateRevisionId(state),
            destRangeId: allocateRevisionId(state),
        };
        state.moveRangeIds.set(moveName, ids);
    }
    return ids;
}
/**
 * Format date for OOXML (ISO 8601).
 */
function formatDate(date) {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
/**
 * Reconstruct document.xml from merged atoms with track changes.
 *
 * @param mergedAtoms - Atoms with correlation status set
 * @param originalXml - Original document.xml for structure preservation
 * @param options - Reconstruction options
 * @returns New document.xml with track changes
 */
export function reconstructDocument(mergedAtoms, originalXml, options) {
    const { author, date } = options;
    const dateStr = formatDate(date);
    const revState = createRevisionIdState();
    // Group atoms by paragraph
    const rawParagraphGroups = groupAtomsByParagraph(mergedAtoms);
    // Consolidate adjacent same-status changes for better readability
    const paragraphGroups = consolidateAdjacentChanges(rawParagraphGroups);
    // Reset debug counters
    resetDebugCounters();
    resetEmptyParagraphCounters();
    debug('reconstructor', `${mergedAtoms.length} atoms -> ${paragraphGroups.length} paragraphs`);
    // Build track changes XML for each paragraph
    const paragraphXmls = [];
    for (const group of paragraphGroups) {
        const paragraphXml = buildParagraphXml(group, author, dateStr, revState);
        paragraphXmls.push(paragraphXml);
    }
    const counters = getDebugCounters();
    debug('reconstructor', `buildRunContent processed: ${counters.atoms} atoms, ${counters.wt} w:t elements`);
    const emptyCounters = getEmptyParagraphCounters();
    debug('reconstructor', `Empty paragraphs: inserted=${emptyCounters.inserted}, deleted=${emptyCounters.deleted}, equal=${emptyCounters.equal}, other=${emptyCounters.other}`);
    // Reconstruct the document
    return buildDocument(originalXml, paragraphXmls);
}
/**
 * Group atoms by paragraph based on their ancestor chain.
 *
 * First sorts atoms by paragraphIndex to ensure all atoms belonging to the same
 * paragraph are contiguous, then groups them sequentially.
 */
function groupAtomsByParagraph(atoms) {
    const groups = [];
    let currentGroup = null;
    let currentRunGroup = null;
    const uniqueIndices = new Set(atoms.map(a => a.paragraphIndex));
    debug('reconstructor', `groupAtomsByParagraph: ${atoms.length} atoms, ${uniqueIndices.size} unique paragraphIndices`);
    // Sort atoms by paragraphIndex to ensure all atoms with the same index are contiguous.
    // Use stable sort to preserve relative order within the same paragraph (deleted before inserted).
    const sortedAtoms = [...atoms].sort((a, b) => {
        const aIdx = a.paragraphIndex ?? Number.MAX_SAFE_INTEGER;
        const bIdx = b.paragraphIndex ?? Number.MAX_SAFE_INTEGER;
        return aIdx - bIdx;
    });
    for (const atom of sortedAtoms) {
        // Find paragraph ancestor
        const pAncestor = findAncestorByTag(atom, 'w:p');
        const rAncestor = findAncestorByTag(atom, 'w:r');
        // Check if we need a new paragraph
        const pPr = pAncestor ? findChildByTag(pAncestor, 'w:pPr') : null;
        // Pass currentRunGroup and current atom to check if we should start a new paragraph
        // Uses paragraphIndex for comparison instead of object references
        if (!currentGroup || shouldStartNewParagraph(currentGroup, currentRunGroup, atom)) {
            if (currentRunGroup && currentGroup) {
                currentGroup.runGroups.push(currentRunGroup);
            }
            currentRunGroup = null;
            currentGroup = {
                pPr: pPr ? cloneElement(pPr) : null,
                runGroups: [],
            };
            groups.push(currentGroup);
        }
        // Check if we need a new run group
        // Each atom's ancestorElements already comes from its own source tree
        // (original atoms carry original formatting, revised atoms carry revised formatting),
        // so we always use the rPr from the atom's run ancestor — no cross-contamination possible.
        const rPr = rAncestor ? findChildByTag(rAncestor, 'w:rPr') : null;
        if (!currentRunGroup || shouldStartNewRunGroup(currentRunGroup, atom)) {
            if (currentRunGroup) {
                currentGroup.runGroups.push(currentRunGroup);
            }
            currentRunGroup = {
                status: atom.correlationStatus,
                atoms: [atom],
                rPr: rPr ? cloneElement(rPr) : null,
                moveName: atom.moveName,
            };
        }
        else {
            currentRunGroup.atoms.push(atom);
        }
    }
    // Don't forget the last groups
    if (currentRunGroup && currentGroup) {
        currentGroup.runGroups.push(currentRunGroup);
    }
    return groups;
}
/**
 * Check if a RunGroup contains only whitespace.
 */
function isWhitespaceOnlyGroup(group) {
    return group.atoms.every(atom => {
        const text = getLeafText(atom.contentElement) ?? '';
        return text.trim() === '';
    });
}
/**
 * Reorder atoms within change blocks.
 *
 * Identifies "change blocks" (contiguous regions with Del/Ins) and reorders
 * to put all deletions first, then all insertions.
 * Whitespace between changes is duplicated into both groups to preserve it
 * regardless of accept/reject.
 */
function reorderChangeBlocks(groups) {
    for (const paraGroup of groups) {
        const runGroups = paraGroup.runGroups;
        const result = [];
        let i = 0;
        while (i < runGroups.length) {
            const current = runGroups[i];
            // Check if we're entering a change block
            const isChange = current.status === CorrelationStatus.Deleted ||
                current.status === CorrelationStatus.Inserted;
            if (!isChange) {
                result.push(current);
                i++;
                continue;
            }
            // Collect the entire change block
            const deletions = [];
            const insertions = [];
            let delRPr = null;
            let insRPr = null;
            while (i < runGroups.length) {
                const group = runGroups[i];
                if (group.status === CorrelationStatus.Deleted) {
                    deletions.push(...group.atoms);
                    if (!delRPr)
                        delRPr = group.rPr;
                    i++;
                }
                else if (group.status === CorrelationStatus.Inserted) {
                    insertions.push(...group.atoms);
                    if (!insRPr)
                        insRPr = group.rPr;
                    i++;
                }
                else if (group.status === CorrelationStatus.Equal && isWhitespaceOnlyGroup(group)) {
                    // Duplicate whitespace into both deletions and insertions
                    // so it's preserved regardless of accept/reject
                    for (const atom of group.atoms) {
                        // Clone for deletions (mark as deleted)
                        const delAtom = {
                            ...atom,
                            correlationStatus: CorrelationStatus.Deleted,
                        };
                        deletions.push(delAtom);
                        // Clone for insertions (mark as inserted)
                        const insAtom = {
                            ...atom,
                            correlationStatus: CorrelationStatus.Inserted,
                        };
                        insertions.push(insAtom);
                    }
                    i++;
                }
                else {
                    // Non-whitespace Equal or other status - end of block
                    break;
                }
            }
            // Output reordered: all deletions first, then all insertions
            if (deletions.length > 0) {
                result.push({
                    status: CorrelationStatus.Deleted,
                    atoms: deletions,
                    rPr: delRPr,
                });
            }
            if (insertions.length > 0) {
                result.push({
                    status: CorrelationStatus.Inserted,
                    atoms: insertions,
                    rPr: insRPr,
                });
            }
        }
        paraGroup.runGroups = result;
    }
    return groups;
}
/**
 * Consolidate adjacent RunGroups with the same status within each paragraph.
 *
 * This makes change tracking more readable by grouping consecutive deletions
 * together and consecutive insertions together, rather than interleaving them
 * at the word level.
 *
 * For example, instead of:
 *   <del>word1</del><ins>word2</ins> <del>word3</del><ins>word4</ins>
 *
 * We get:
 *   <del>word1 word3</del><ins>word2 word4</ins>
 */
function consolidateAdjacentChanges(groups) {
    return reorderChangeBlocks(groups);
}
/**
 * Find an ancestor element by tag name.
 */
function findAncestorByTag(atom, tagName) {
    for (let i = atom.ancestorElements.length - 1; i >= 0; i--) {
        if (atom.ancestorElements[i].tagName === tagName) {
            return atom.ancestorElements[i];
        }
    }
    return null;
}
/**
 * Find a child element by tag name.
 */
function findChildByTag(element, tagName) {
    for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes[i];
        if (child.nodeType === 1 && child.tagName === tagName) {
            return child;
        }
    }
    return null;
}
/**
 * Determine if we should start a new paragraph.
 *
 * Uses paragraphIndex for comparison instead of object references, because
 * atoms from original and revised documents have different tree objects.
 *
 * @param currentGroup - The current paragraph group being built
 * @param currentRunGroup - The current run group (may not be pushed to currentGroup yet)
 * @param currentAtom - The current atom being processed
 */
function shouldStartNewParagraph(currentGroup, currentRunGroup, currentAtom) {
    const currentParagraphIndex = currentAtom.paragraphIndex;
    // If no paragraph index, fall back to false (stay in current paragraph)
    if (currentParagraphIndex === undefined)
        return false;
    // First check currentRunGroup (which may not be pushed to runGroups yet)
    if (currentRunGroup && currentRunGroup.atoms.length > 0) {
        const lastAtom = currentRunGroup.atoms[currentRunGroup.atoms.length - 1];
        const lastParagraphIndex = lastAtom.paragraphIndex;
        // Same paragraph index means same paragraph, even if from different trees
        if (lastParagraphIndex !== undefined) {
            return currentParagraphIndex !== lastParagraphIndex;
        }
    }
    // Fall back to checking runGroups
    if (currentGroup.runGroups.length === 0) {
        return false;
    }
    // Check last atom's paragraph index
    const lastRunGroup = currentGroup.runGroups[currentGroup.runGroups.length - 1];
    if (!lastRunGroup || lastRunGroup.atoms.length === 0) {
        return false;
    }
    const lastAtom = lastRunGroup.atoms[lastRunGroup.atoms.length - 1];
    const lastParagraphIndex = lastAtom.paragraphIndex;
    if (lastParagraphIndex !== undefined) {
        return currentParagraphIndex !== lastParagraphIndex;
    }
    // No paragraph indices available, stay in current paragraph
    return false;
}
/**
 * Determine if we should start a new run group.
 */
function shouldStartNewRunGroup(currentGroup, atom) {
    // Different status = new group
    if (currentGroup.status !== atom.correlationStatus) {
        return true;
    }
    // Different move name = new group
    if (currentGroup.moveName !== atom.moveName) {
        return true;
    }
    return false;
}
/**
 * Check if a paragraph group represents an empty paragraph with a specific status.
 *
 * @param group - The paragraph group to check
 * @param status - The correlation status to check for
 * @returns True if all atoms are empty paragraph markers with the given status
 */
function isEmptyParagraphWithStatus(group, status) {
    // Check if all run groups contain only empty paragraph atoms with the given status
    for (const runGroup of group.runGroups) {
        // If any atom is not an empty paragraph marker, this is not an empty paragraph
        const hasNonEmptyAtom = runGroup.atoms.some((atom) => atom.contentElement.tagName !== EMPTY_PARAGRAPH_TAG);
        if (hasNonEmptyAtom) {
            return false;
        }
        // If any atom doesn't have the expected status, return false
        const hasWrongStatus = runGroup.atoms.some((atom) => atom.correlationStatus !== status);
        if (hasWrongStatus) {
            return false;
        }
    }
    // All atoms are empty paragraph markers with the expected status
    return group.runGroups.length > 0;
}
// Debug counters for empty paragraphs
let debugEmptyParaInserted = 0;
let debugEmptyParaDeleted = 0;
let debugEmptyParaEqual = 0;
let debugEmptyParaOther = 0;
/**
 * Reset empty paragraph debug counters.
 */
export function resetEmptyParagraphCounters() {
    debugEmptyParaInserted = 0;
    debugEmptyParaDeleted = 0;
    debugEmptyParaEqual = 0;
    debugEmptyParaOther = 0;
}
/**
 * Get empty paragraph debug counters.
 */
export function getEmptyParagraphCounters() {
    return {
        inserted: debugEmptyParaInserted,
        deleted: debugEmptyParaDeleted,
        equal: debugEmptyParaEqual,
        other: debugEmptyParaOther,
    };
}
/**
 * Check if a paragraph group contains only empty paragraph atoms.
 */
function isEmptyParagraphGroup(group) {
    for (const runGroup of group.runGroups) {
        const hasNonEmptyAtom = runGroup.atoms.some((atom) => atom.contentElement.tagName !== EMPTY_PARAGRAPH_TAG);
        if (hasNonEmptyAtom) {
            return false;
        }
    }
    return group.runGroups.length > 0;
}
/**
 * Build XML for a single paragraph with track changes.
 */
function buildParagraphXml(group, author, dateStr, revState) {
    // Track empty paragraph statuses for debugging
    if (isEmptyParagraphGroup(group)) {
        const status = group.runGroups[0]?.atoms[0]?.correlationStatus;
        if (status === CorrelationStatus.Inserted) {
            debugEmptyParaInserted++;
        }
        else if (status === CorrelationStatus.Deleted) {
            debugEmptyParaDeleted++;
        }
        else if (status === CorrelationStatus.Equal) {
            debugEmptyParaEqual++;
        }
        else {
            debugEmptyParaOther++;
        }
        // Debug: log the first few empty paragraphs for investigation
        const debugLimit = 5;
        const totalEmpty = debugEmptyParaInserted + debugEmptyParaDeleted + debugEmptyParaEqual + debugEmptyParaOther;
        if (totalEmpty <= debugLimit) {
            const atoms = group.runGroups.flatMap(rg => rg.atoms);
            const statuses = atoms.map(a => a.correlationStatus).join(', ');
            debug('reconstructor', `Empty paragraph #${totalEmpty}: status=${status}, atomCount=${atoms.length}, atomStatuses=[${statuses}]`);
        }
    }
    // Whole-paragraph insert/delete encoding must match Word/Aspose behavior.
    //
    // IMPORTANT: <w:ins> is not a container for <w:p> in WordprocessingML.
    // Aspose encodes a paragraph insertion like:
    //   <w:p>
    //     <w:pPr><w:rPr><w:ins .../></w:rPr></w:pPr>
    //     <w:ins ...><w:r>...</w:r></w:ins>
    //   </w:p>
    //
    // That structure both renders in Word and allows Reject All to remove the paragraph
    // entirely (instead of leaving behind a stub <w:p> break).
    if (isEntireParagraphWithStatus(group, CorrelationStatus.Inserted)) {
        const paraId = allocateRevisionId(revState);
        const runId = allocateRevisionId(revState);
        const parts = [];
        parts.push('<w:p>');
        parts.push(serializePPrWithParaRevisionMarker(group.pPr, `<w:ins w:id="${paraId}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}" />`));
        parts.push(`<w:ins w:id="${runId}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}">`);
        for (const runGroup of group.runGroups) {
            parts.push(buildRunContentAsPlainRun(runGroup));
        }
        parts.push('</w:ins>');
        parts.push('</w:p>');
        return parts.join('');
    }
    if (isEntireParagraphWithStatus(group, CorrelationStatus.Deleted)) {
        const paraId = allocateRevisionId(revState);
        const runId = allocateRevisionId(revState);
        const parts = [];
        parts.push('<w:p>');
        parts.push(serializePPrWithParaRevisionMarker(group.pPr, `<w:del w:id="${paraId}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}" />`));
        parts.push(`<w:del w:id="${runId}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}">`);
        for (const runGroup of group.runGroups) {
            const plainRun = buildRunContentAsPlainRun(runGroup);
            parts.push(plainRun.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, '<w:delText$1>$2</w:delText>'));
        }
        parts.push('</w:del>');
        parts.push('</w:p>');
        return parts.join('');
    }
    // Check for inserted empty paragraphs - wrap entire paragraph in w:ins
    if (isEmptyParagraphWithStatus(group, CorrelationStatus.Inserted)) {
        const id = allocateRevisionId(revState);
        const parts = [];
        parts.push(`<w:ins w:id="${id}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}">`);
        parts.push('<w:p>');
        if (group.pPr) {
            parts.push(serializeToXml(group.pPr));
        }
        parts.push('</w:p>');
        parts.push('</w:ins>');
        return parts.join('');
    }
    // Check for deleted empty paragraphs - wrap entire paragraph in w:del
    if (isEmptyParagraphWithStatus(group, CorrelationStatus.Deleted)) {
        const id = allocateRevisionId(revState);
        const parts = [];
        parts.push(`<w:del w:id="${id}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}">`);
        parts.push('<w:p>');
        if (group.pPr) {
            parts.push(serializeToXml(group.pPr));
        }
        parts.push('</w:p>');
        parts.push('</w:del>');
        return parts.join('');
    }
    const parts = [];
    parts.push('<w:p>');
    // Add paragraph properties
    if (group.pPr) {
        parts.push(serializeToXml(group.pPr));
    }
    // Add run groups with track changes
    for (const runGroup of group.runGroups) {
        const runXml = buildRunGroupXml(runGroup, author, dateStr, revState);
        parts.push(runXml);
    }
    parts.push('</w:p>');
    return parts.join('');
}
/**
 * Serialize paragraph properties and ensure a paragraph-level revision marker exists.
 *
 * If pPr is missing, synthesize one with rPr containing the marker.
 */
function serializePPrWithParaRevisionMarker(pPr, markerXml) {
    // Common case: no paragraph properties. Create minimal pPr/rPr.
    if (!pPr) {
        return `<w:pPr><w:rPr>${markerXml}</w:rPr></w:pPr>`;
    }
    let xml = serializeToXml(pPr);
    // Handle self-closing <w:pPr/> form.
    if (/<w:pPr\b[^>]*\/>/.test(xml)) {
        return xml.replace(/<w:pPr\b([^>]*)\/>/, `<w:pPr$1><w:rPr>${markerXml}</w:rPr></w:pPr>`);
    }
    // If there's an rPr, inject the marker at the start of it.
    if (xml.includes('<w:rPr')) {
        return xml.replace(/<w:rPr(\b[^>]*)>/, `<w:rPr$1>${markerXml}`);
    }
    // Otherwise, add a new rPr with the marker before closing pPr.
    return xml.replace(/<\/w:pPr>/, `<w:rPr>${markerXml}</w:rPr></w:pPr>`);
}
/**
 * Returns true if every atom in the paragraph is of the specified status
 * (ignoring EMPTY_PARAGRAPH_TAG markers).
 */
function isEntireParagraphWithStatus(group, status) {
    let sawAnyContent = false;
    let sawTargetStatus = false;
    for (const runGroup of group.runGroups) {
        for (const atom of runGroup.atoms) {
            const el = atom.contentElement;
            if (el.tagName === EMPTY_PARAGRAPH_TAG)
                continue;
            sawAnyContent = true;
            // A whole-paragraph wrap should still apply even if there are "noise" atoms
            // (pure whitespace runs, tabs, breaks) marked Equal due to normalization or
            // LCS alignment. Those atoms would otherwise prevent wrapping and Word would
            // leave an empty <w:p> stub on Reject All.
            const isWhitespaceOnlyText = el.tagName === 'w:t' && ((getLeafText(el) ?? '').trim() === '');
            const isWhitespaceAtom = isWhitespaceOnlyText || el.tagName === 'w:tab' || el.tagName === 'w:br' || el.tagName === 'w:cr';
            if (atom.correlationStatus === status) {
                sawTargetStatus = true;
                continue;
            }
            if (isWhitespaceAtom) {
                continue; // ignore for whole-paragraph classification
            }
            return false;
        }
    }
    // If there's no content at all, let the empty-paragraph handlers deal with it.
    // Also require at least one atom with the target status so we don't wrap equal-only paragraphs.
    return sawAnyContent && sawTargetStatus;
}
/**
 * Build a <w:r> without track-change wrappers. Used when the whole paragraph is already
 * wrapped (paragraph-level <w:ins>/<w:del>).
 */
function buildRunContentAsPlainRun(group) {
    // Reuse the existing run serializer logic, but do not apply wrapper tags.
    const contentAtoms = group.atoms.filter((atom) => atom.contentElement.tagName !== EMPTY_PARAGRAPH_TAG);
    if (contentAtoms.length === 0)
        return '';
    const parts = [];
    parts.push('<w:r>');
    if (group.rPr)
        parts.push(serializeToXml(group.rPr));
    // Coalesce adjacent w:t atoms into a single <w:t> to reduce fragmentation.
    // This keeps Word's UI from presenting overly granular sub-selections and
    // tends to match how Word serializes "typed" text.
    let pendingText = '';
    const flushPendingText = () => {
        if (!pendingText)
            return;
        const escaped = escapeXmlText(pendingText);
        const needsPreserve = pendingText.startsWith(' ') ||
            pendingText.endsWith(' ') ||
            pendingText.includes('  ');
        parts.push(needsPreserve
            ? `<w:t xml:space="preserve">${escaped}</w:t>`
            : `<w:t>${escaped}</w:t>`);
        pendingText = '';
    };
    for (const atom of contentAtoms) {
        debugAtomCounter++;
        if (atom.collapsedFieldAtoms && atom.collapsedFieldAtoms.length > 0) {
            flushPendingText();
            for (const fieldAtom of atom.collapsedFieldAtoms) {
                parts.push(serializeAtomElement(fieldAtom.contentElement));
            }
            continue;
        }
        const el = atom.contentElement;
        if (el.tagName === 'w:t') {
            pendingText += getLeafText(el) ?? '';
            continue;
        }
        flushPendingText();
        parts.push(serializeAtomElement(el));
    }
    flushPendingText();
    parts.push('</w:r>');
    return parts.join('');
}
/**
 * Build XML for a run group with appropriate track changes wrapper.
 */
function buildRunGroupXml(group, author, dateStr, revState) {
    const runContent = buildRunContent(group);
    // If run content is empty (e.g., only empty paragraph atoms), return empty string
    // This avoids generating empty track changes wrappers
    if (!runContent) {
        return '';
    }
    switch (group.status) {
        case CorrelationStatus.Equal:
        case CorrelationStatus.Unknown:
            return runContent;
        case CorrelationStatus.Inserted:
            return wrapWithIns(runContent, author, dateStr, revState);
        case CorrelationStatus.Deleted:
            return wrapWithDel(runContent, author, dateStr, revState);
        case CorrelationStatus.MovedSource:
            return wrapWithMoveFrom(runContent, author, dateStr, group.moveName || 'move1', revState);
        case CorrelationStatus.MovedDestination:
            return wrapWithMoveTo(runContent, author, dateStr, group.moveName || 'move1', revState);
        case CorrelationStatus.FormatChanged:
            // For format changes, we include the run with rPrChange
            return buildFormatChangeRun(group, author, dateStr, revState);
        default:
            return runContent;
    }
}
// Debug counter for atoms processed
let debugAtomCounter = 0;
let debugWtCounter = 0;
/**
 * Reset debug counters (for testing).
 */
export function resetDebugCounters() {
    debugAtomCounter = 0;
    debugWtCounter = 0;
}
/**
 * Get debug counters (for testing).
 */
export function getDebugCounters() {
    return { atoms: debugAtomCounter, wt: debugWtCounter };
}
/**
 * Serialize an atom's content element to XML string.
 */
function serializeAtomElement(element) {
    if (element.tagName === 'w:t') {
        debugWtCounter++;
        // Text element - preserve xml:space if needed
        const text = escapeXmlText(getLeafText(element) ?? '');
        if (text.startsWith(' ') || text.endsWith(' ') || text.includes('  ')) {
            return `<w:t xml:space="preserve">${text}</w:t>`;
        }
        else {
            return `<w:t>${text}</w:t>`;
        }
    }
    else if (element.tagName === 'w:br') {
        return '<w:br/>';
    }
    else if (element.tagName === 'w:tab') {
        return '<w:tab/>';
    }
    else if (element.tagName === 'w:cr') {
        return '<w:cr/>';
    }
    else {
        // Other elements (including field chars, instrText) - serialize as-is
        return serializeToXml(element);
    }
}
/**
 * Build the content of a run from atoms.
 *
 * Returns empty string if all atoms are empty paragraph markers,
 * which ensures no empty <w:r> elements are generated.
 */
function buildRunContent(group) {
    // Check if this run group contains only empty paragraph atoms
    const contentAtoms = group.atoms.filter((atom) => atom.contentElement.tagName !== EMPTY_PARAGRAPH_TAG);
    // If no content atoms, return empty string (don't generate empty run)
    if (contentAtoms.length === 0) {
        return '';
    }
    const parts = [];
    parts.push('<w:r>');
    // Add run properties
    if (group.rPr) {
        parts.push(serializeToXml(group.rPr));
    }
    // Add atom content (skipping empty paragraph atoms)
    // Coalesce adjacent w:t atoms into a single <w:t> to reduce fragmentation.
    let pendingText = '';
    const flushPendingText = () => {
        if (!pendingText)
            return;
        const escaped = escapeXmlText(pendingText);
        const needsPreserve = pendingText.startsWith(' ') ||
            pendingText.endsWith(' ') ||
            pendingText.includes('  ');
        parts.push(needsPreserve
            ? `<w:t xml:space="preserve">${escaped}</w:t>`
            : `<w:t>${escaped}</w:t>`);
        pendingText = '';
    };
    for (const atom of contentAtoms) {
        debugAtomCounter++;
        // Check if this is a collapsed field - if so, expand back to original atoms
        if (atom.collapsedFieldAtoms && atom.collapsedFieldAtoms.length > 0) {
            flushPendingText();
            for (const fieldAtom of atom.collapsedFieldAtoms) {
                parts.push(serializeAtomElement(fieldAtom.contentElement));
            }
            continue;
        }
        const element = atom.contentElement;
        if (element.tagName === 'w:t') {
            pendingText += getLeafText(element) ?? '';
            continue;
        }
        flushPendingText();
        parts.push(serializeAtomElement(element));
    }
    flushPendingText();
    parts.push('</w:r>');
    return parts.join('');
}
/**
 * Wrap content with w:ins element.
 */
function wrapWithIns(content, author, dateStr, revState) {
    const id = allocateRevisionId(revState);
    return `<w:ins w:id="${id}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}">${content}</w:ins>`;
}
/**
 * Wrap content with w:del element.
 */
function wrapWithDel(content, author, dateStr, revState) {
    const id = allocateRevisionId(revState);
    // For deletions, we need to convert w:t to w:delText
    const delContent = content.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, '<w:delText$1>$2</w:delText>');
    return `<w:del w:id="${id}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}">${delContent}</w:del>`;
}
/**
 * Wrap content with w:moveFrom elements.
 */
function wrapWithMoveFrom(content, author, dateStr, moveName, revState) {
    const ids = getMoveRangeIds(revState, moveName);
    const moveId = allocateRevisionId(revState);
    // Convert w:t to w:delText for moved-from content
    const delContent = content.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, '<w:delText$1>$2</w:delText>');
    return (`<w:moveFromRangeStart w:id="${ids.sourceRangeId}" w:name="${moveName}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}"/>` +
        `<w:moveFrom w:id="${moveId}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}">${delContent}</w:moveFrom>` +
        `<w:moveFromRangeEnd w:id="${ids.sourceRangeId}"/>`);
}
/**
 * Wrap content with w:moveTo elements.
 */
function wrapWithMoveTo(content, author, dateStr, moveName, revState) {
    const ids = getMoveRangeIds(revState, moveName);
    const moveId = allocateRevisionId(revState);
    return (`<w:moveToRangeStart w:id="${ids.destRangeId}" w:name="${moveName}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}"/>` +
        `<w:moveTo w:id="${moveId}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}">${content}</w:moveTo>` +
        `<w:moveToRangeEnd w:id="${ids.destRangeId}"/>`);
}
/**
 * Build run with format change tracking (w:rPrChange).
 */
function buildFormatChangeRun(group, author, dateStr, revState) {
    const parts = [];
    parts.push('<w:r>');
    // Build rPr with rPrChange
    if (group.rPr || group.atoms[0]?.formatChange) {
        parts.push('<w:rPr>');
        // Current properties
        if (group.rPr) {
            for (const child of childElements(group.rPr)) {
                if (child.tagName !== 'w:rPrChange') {
                    parts.push(serializeToXml(child));
                }
            }
        }
        // Add rPrChange with old properties
        const formatChange = group.atoms[0]?.formatChange;
        if (formatChange?.oldRunProperties) {
            const id = allocateRevisionId(revState);
            parts.push(`<w:rPrChange w:id="${id}" w:author="${escapeXmlAttr(author)}" w:date="${dateStr}">`);
            for (const child of childElements(formatChange.oldRunProperties)) {
                parts.push(serializeToXml(child));
            }
            parts.push('</w:rPrChange>');
        }
        parts.push('</w:rPr>');
    }
    // Add atom content
    for (const atom of group.atoms) {
        const element = atom.contentElement;
        if (element.tagName === 'w:t') {
            const text = escapeXmlText(getLeafText(element) ?? '');
            if (text.startsWith(' ') || text.endsWith(' ') || text.includes('  ')) {
                parts.push(`<w:t xml:space="preserve">${text}</w:t>`);
            }
            else {
                parts.push(`<w:t>${text}</w:t>`);
            }
        }
        else {
            parts.push(serializeToXml(element));
        }
    }
    parts.push('</w:r>');
    return parts.join('');
}
/**
 * Build the final document by replacing body content.
 *
 * Note: sectPr elements are NOT extracted and appended separately because:
 * 1. Section properties inside pPr elements are already preserved in the reconstructed paragraphs
 * 2. The regex to extract "final sectPr" was incorrectly matching sectPr inside pPr elements
 *    and capturing large amounts of body content, causing duplicate text.
 */
function buildDocument(originalXml, paragraphXmls) {
    // Extract document structure
    const bodyMatch = originalXml.match(/(<w:body[^>]*>)([\s\S]*?)(<\/w:body>)/);
    if (!bodyMatch) {
        throw new Error('Could not find w:body in document');
    }
    const beforeBody = originalXml.slice(0, originalXml.indexOf(bodyMatch[0]));
    const bodyOpenTag = bodyMatch[1];
    const bodyCloseTag = bodyMatch[3];
    const afterBody = originalXml.slice(originalXml.indexOf(bodyMatch[0]) + bodyMatch[0].length);
    // Build new body (no separate sectPr extraction - it's in the paragraphs' pPr)
    const newBodyContent = paragraphXmls.join('\n');
    return beforeBody + bodyOpenTag + '\n' + newBodyContent + '\n' + bodyCloseTag + afterBody;
}
/**
 * Escape XML text content.
 */
function escapeXmlText(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
/**
 * Escape XML attribute value.
 */
function escapeXmlAttr(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
/**
 * Count statistics from merged atoms.
 */
export function computeReconstructionStats(mergedAtoms) {
    let insertions = 0;
    let deletions = 0;
    let moves = 0;
    let formatChanges = 0;
    const paragraphs = new Set();
    for (const atom of mergedAtoms) {
        // Count paragraph
        const pAncestor = findAncestorByTag(atom, 'w:p');
        if (pAncestor) {
            paragraphs.add(pAncestor);
        }
        // Count by status
        switch (atom.correlationStatus) {
            case CorrelationStatus.Inserted:
                insertions++;
                break;
            case CorrelationStatus.Deleted:
                deletions++;
                break;
            case CorrelationStatus.MovedSource:
            case CorrelationStatus.MovedDestination:
                moves++;
                break;
            case CorrelationStatus.FormatChanged:
                formatChanges++;
                break;
        }
    }
    return {
        paragraphs: paragraphs.size,
        insertions,
        deletions,
        moves: Math.floor(moves / 2), // Source and destination counted separately
        formatChanges,
    };
}
//# sourceMappingURL=documentReconstructor.js.map