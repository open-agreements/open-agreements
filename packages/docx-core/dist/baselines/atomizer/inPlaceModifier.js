/**
 * In-Place AST Modifier
 *
 * Modifies the revised document's AST in-place to add track changes markup.
 * This replaces the reconstruction-based approach with direct tree manipulation.
 *
 * Key operations:
 * - wrapAsInserted: Wrap run elements with <w:ins> for inserted content
 * - insertDeletedContent: Clone and insert deleted content with <w:del> wrapper
 * - wrapAsMoveFrom/wrapAsMoveTo: Add move tracking with range markers
 * - addFormatChange: Add <w:rPrChange> for formatting differences
 */
import { CorrelationStatus } from '../../core-types.js';
import { EMPTY_PARAGRAPH_TAG } from '../../atomizer.js';
import { getLeafText, childElements, findChildByTagName, insertAfterElement, wrapElement, unwrapElement, splitRunAtVisibleOffset, visibleLengthForEl, getDirectContentElements, } from '../../primitives/index.js';
import { areRunPropertiesEqual } from '../../format-detection.js';
import { enforceConsumerCompatibility } from './consumerCompatibility.js';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { warn } from './debug.js';
const SYNTHETIC_DOC = new DOMParser().parseFromString('<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>', 'application/xml');
const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
/**
 * Create a namespaced OOXML element with optional attributes.
 * Uses SYNTHETIC_DOC so elements can be adopted by any document tree.
 */
function createEl(tag, attrs) {
    const el = SYNTHETIC_DOC.createElementNS(W_NS, tag);
    if (attrs)
        for (const [k, v] of Object.entries(attrs))
            el.setAttribute(k, v);
    return el;
}
function findAncestorByTag(atom, tagName) {
    for (let i = atom.ancestorElements.length - 1; i >= 0; i--) {
        const el = atom.ancestorElements[i];
        if (el.tagName === tagName)
            return el;
    }
    return undefined;
}
function attachSourceElementPointers(atoms) {
    for (const atom of atoms) {
        atom.sourceRunElement = findAncestorByTag(atom, 'w:r');
        atom.sourceParagraphElement = findAncestorByTag(atom, 'w:p');
    }
}
/**
 * Determine whether an atom is "whitespace-only" for paragraph-level classification.
 *
 * We treat pure whitespace runs/tabs/breaks as ignorable noise, because LCS alignment
 * can mark them Equal even when a whole paragraph was inserted/deleted. If we don't
 * ignore them, Word can end up with a stub paragraph after Accept/Reject All.
 */
function isWhitespaceAtom(atom) {
    const el = atom.contentElement;
    if (el.tagName === EMPTY_PARAGRAPH_TAG)
        return true;
    if (el.tagName === 'w:t')
        return ((getLeafText(el) ?? '').trim() === '');
    return el.tagName === 'w:tab' || el.tagName === 'w:br' || el.tagName === 'w:cr';
}
/**
 * Returns true if every non-empty atom in this paragraph is of the specified status,
 * ignoring whitespace-only atoms.
 *
 * Mirrors the rebuild reconstructor's whole-paragraph classification so that inplace
 * output behaves the same under Word's Accept/Reject All.
 */
function isEntireParagraphAtomsWithStatus(atoms, status) {
    let sawAnyContent = false;
    let sawTargetStatus = false;
    for (const atom of atoms) {
        const el = atom.contentElement;
        if (el.tagName === EMPTY_PARAGRAPH_TAG)
            continue;
        sawAnyContent = true;
        if (atom.correlationStatus === status) {
            sawTargetStatus = true;
            continue;
        }
        if (isWhitespaceAtom(atom))
            continue;
        return false;
    }
    return sawAnyContent && sawTargetStatus;
}
/**
 * Create initial revision ID state.
 */
function createRevisionIdState() {
    return {
        nextId: 1,
        moveRangeIds: new Map(),
        wrappedRuns: new Set(),
        emittedSourceBookmarkMarkers: new Set(),
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
 * Format date for OOXML (ISO 8601 without milliseconds).
 */
function formatDate(date) {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
/**
 * Convert w:t elements to w:delText within an element tree.
 *
 * @param element - The element to process
 */
function convertToDelText(element) {
    if (element.tagName === 'w:t' || element.tagName === 'w:instrText') {
        const newTag = element.tagName === 'w:t' ? 'w:delText' : 'w:delInstrText';
        const newEl = createEl(newTag);
        // Copy text content
        while (element.firstChild)
            newEl.appendChild(element.firstChild);
        // Copy attributes
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            newEl.setAttribute(attr.name, attr.value);
        }
        element.parentNode?.replaceChild(newEl, element);
        return;
    }
    for (const child of childElements(element)) {
        convertToDelText(child);
    }
}
/**
 * Build the content elements that should be inserted for an atom.
 *
 * Collapsed field atoms use a synthetic w:t as their top-level contentElement,
 * but retain the original field sequence in collapsedFieldAtoms. For insertion,
 * we must replay the original sequence rather than the synthetic text.
 *
 * @param filterRun - When provided, only return content elements whose
 *   collapsed field atom belongs to this specific source run. Used by
 *   insertDeletedRun/insertMoveFromRun to emit one cloned run per original
 *   source run, preserving multi-run field structure.
 */
function getInsertableAtomContentElements(atom, filterRun) {
    if (atom.collapsedFieldAtoms && atom.collapsedFieldAtoms.length > 0) {
        if (filterRun) {
            return atom.collapsedFieldAtoms
                .filter((fieldAtom) => {
                const run = fieldAtom.sourceRunElement ?? findAncestorByTag(fieldAtom, 'w:r');
                return run === filterRun;
            })
                .map((fieldAtom) => fieldAtom.contentElement);
        }
        return atom.collapsedFieldAtoms.map((fieldAtom) => fieldAtom.contentElement);
    }
    return [atom.contentElement];
}
/**
 * Clone a source run and replace its non-rPr children with atom content.
 *
 * This keeps run-level formatting while allowing atom-level fragment insertion.
 *
 * @param filterRun - When provided, only include content elements belonging
 *   to this source run (for multi-run collapsed field replay).
 */
function cloneRunWithAtomContent(sourceRun, atom, filterRun) {
    const clonedRun = sourceRun.cloneNode(true);
    const retainedChildren = [];
    for (const child of childElements(clonedRun)) {
        if (child.tagName === 'w:rPr') {
            retainedChildren.push(child);
        }
    }
    // Remove all current children from clonedRun
    while (clonedRun.firstChild)
        clonedRun.removeChild(clonedRun.firstChild);
    // Re-append retained rPr children
    for (const child of retainedChildren) {
        clonedRun.appendChild(child);
    }
    for (const contentElement of getInsertableAtomContentElements(atom, filterRun)) {
        const fragment = contentElement.cloneNode(true);
        clonedRun.appendChild(fragment);
    }
    return clonedRun;
}
function cloneParagraphBoundaryBookmarkMarkers(sourceParagraph) {
    const kids = sourceParagraph ? childElements(sourceParagraph) : [];
    if (!sourceParagraph || kids.length === 0) {
        return { leading: [], trailing: [], sourceLeading: [], sourceTrailing: [] };
    }
    const children = kids;
    let firstRunIdx = -1;
    let lastRunIdx = -1;
    for (let i = 0; i < children.length; i++) {
        if (children[i]?.tagName === 'w:r') {
            if (firstRunIdx < 0)
                firstRunIdx = i;
            lastRunIdx = i;
        }
    }
    const leading = [];
    const trailing = [];
    const sourceLeading = [];
    const sourceTrailing = [];
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === 'w:bookmarkStart') {
            if (firstRunIdx < 0 || i < firstRunIdx) {
                const cloned = child.cloneNode(true);
                leading.push(cloned);
                sourceLeading.push(child);
            }
            continue;
        }
        if (child.tagName === 'w:bookmarkEnd') {
            if (lastRunIdx < 0 || i > lastRunIdx) {
                const cloned = child.cloneNode(true);
                trailing.push(cloned);
                sourceTrailing.push(child);
            }
        }
    }
    return { leading, trailing, sourceLeading, sourceTrailing };
}
function insertLeadingMarkers(paragraph, markers) {
    if (markers.length === 0)
        return null;
    const pPr = findChildByTagName(paragraph, 'w:pPr');
    if (pPr) {
        let anchor = pPr;
        for (const marker of markers) {
            insertAfterElement(anchor, marker);
            anchor = marker;
        }
        return anchor;
    }
    for (let i = markers.length - 1; i >= 0; i--) {
        paragraph.insertBefore(markers[i], paragraph.firstChild);
    }
    return markers[markers.length - 1] ?? null;
}
function isBookmarkMarkerTag(tagName) {
    return tagName === 'w:bookmarkStart' || tagName === 'w:bookmarkEnd';
}
/**
 * Collect direct paragraph bookmark markers adjacent to a source run.
 *
 * Markers between runs (or at paragraph boundaries) are represented as siblings
 * of w:r under w:p. We clone nearby markers so reconstructed deleted/moveFrom
 * fragments preserve bookmark names/IDs needed for Reject All parity.
 */
function collectAdjacentSourceBookmarkMarkers(sourceRun) {
    const paragraph = sourceRun.parentNode;
    if (!paragraph || paragraph.tagName !== 'w:p') {
        return [];
    }
    const children = childElements(paragraph);
    const runIndex = children.indexOf(sourceRun);
    if (runIndex < 0) {
        return [];
    }
    const before = [];
    for (let i = runIndex - 1; i >= 0; i--) {
        const child = children[i];
        if (!child)
            break;
        if (child.tagName === 'w:r')
            break;
        if (isBookmarkMarkerTag(child.tagName)) {
            before.unshift(child);
        }
    }
    const after = [];
    for (let i = runIndex + 1; i < children.length; i++) {
        const child = children[i];
        if (!child)
            break;
        if (child.tagName === 'w:r')
            break;
        if (isBookmarkMarkerTag(child.tagName)) {
            after.push(child);
        }
    }
    return [...before, ...after];
}
function parentElement(node) {
    const p = node.parentNode;
    return p && p.nodeType === 1 ? p : null;
}
function findTreeRoot(node) {
    let current = node;
    let parent = parentElement(current);
    while (parent) {
        current = parent;
        parent = parentElement(current);
    }
    return current;
}
function findAncestor(node, tagName) {
    let current = node ?? null;
    while (current) {
        if (current.tagName === tagName)
            return current;
        current = parentElement(current);
    }
    return undefined;
}
function hasAncestorTag(node, tagNames) {
    let current = node ? parentElement(node) : null;
    while (current) {
        if (tagNames.has(current.tagName)) {
            return true;
        }
        current = parentElement(current);
    }
    return false;
}
function paragraphHasParaInsMarker(paragraph) {
    if (!paragraph || paragraph.tagName !== 'w:p') {
        return false;
    }
    const pPr = findChildByTagName(paragraph, 'w:pPr');
    if (!pPr) {
        return false;
    }
    return Array.from(pPr.getElementsByTagName('w:ins')).length > 0;
}
function markerSurvivesReject(marker, context) {
    // Markers nested in inserted/move-to content are removed by Reject All.
    if (hasAncestorTag(marker, new Set(['w:ins', 'w:moveTo']))) {
        return false;
    }
    // Paragraph-level insertion markers remove whole paragraphs on Reject All.
    const paragraph = findAncestor(marker, 'w:p');
    if (paragraph && context?.isParagraphRemovedOnReject?.(paragraph)) {
        return false;
    }
    if (paragraphHasParaInsMarker(paragraph)) {
        return false;
    }
    return true;
}
function targetTreeHasEquivalentBookmarkMarker(targetParagraph, marker, context) {
    const treeRoot = findTreeRoot(targetParagraph);
    if (marker.tagName === 'w:bookmarkStart') {
        const markerId = marker.getAttribute('w:id');
        const markerName = marker.getAttribute('w:name');
        for (const existing of Array.from(treeRoot.getElementsByTagName('w:bookmarkStart'))) {
            if (!markerSurvivesReject(existing, context)) {
                continue;
            }
            const existingName = existing.getAttribute('w:name');
            const existingId = existing.getAttribute('w:id');
            if (markerName && existingName === markerName)
                return true;
            if (!markerName && markerId && existingId === markerId)
                return true;
        }
        return false;
    }
    if (marker.tagName === 'w:bookmarkEnd') {
        const markerId = marker.getAttribute('w:id');
        if (!markerId)
            return false;
        for (const existing of Array.from(treeRoot.getElementsByTagName('w:bookmarkEnd'))) {
            if (!markerSurvivesReject(existing, context)) {
                continue;
            }
            if (existing.getAttribute('w:id') === markerId)
                return true;
        }
    }
    return false;
}
function cloneUnemittedSourceBookmarkMarkers(sourceRun, targetParagraph, state, context) {
    const markers = collectAdjacentSourceBookmarkMarkers(sourceRun);
    const clones = [];
    for (const marker of markers) {
        if (state.emittedSourceBookmarkMarkers.has(marker)) {
            continue;
        }
        if (targetTreeHasEquivalentBookmarkMarker(targetParagraph, marker, context)) {
            state.emittedSourceBookmarkMarkers.add(marker);
            continue;
        }
        state.emittedSourceBookmarkMarkers.add(marker);
        const cloned = marker.cloneNode(true);
        clones.push(cloned);
    }
    return clones;
}
function insertMarkersBeforeWrapper(wrapper, markers) {
    const parent = wrapper.parentNode;
    if (!parent)
        return;
    for (const marker of markers) {
        if (!marker)
            continue;
        parent.insertBefore(marker, wrapper);
    }
}
function filterEquivalentBookmarkMarkers(markers, targetNode, context) {
    return markers.filter((marker) => !targetTreeHasEquivalentBookmarkMarker(targetNode, marker, context));
}
const TRACK_CHANGE_WRAPPERS = new Set([
    'w:ins',
    'w:del',
    'w:moveFrom',
    'w:moveTo',
]);
/**
 * Resolve the run associated with an atom boundary.
 *
 * For collapsed field atoms, sourceRunElement points at the first run in the
 * field sequence. For insertion-point tracking we often need the trailing run,
 * otherwise deleted/moved fragments can be inserted inside the field sequence.
 */
function getAtomRunAtBoundary(atom, boundary) {
    if (atom.collapsedFieldAtoms && atom.collapsedFieldAtoms.length > 0) {
        const fieldAtoms = boundary === 'start'
            ? atom.collapsedFieldAtoms
            : [...atom.collapsedFieldAtoms].reverse();
        for (const fieldAtom of fieldAtoms) {
            const run = fieldAtom.sourceRunElement ?? findAncestorByTag(fieldAtom, 'w:r');
            if (run)
                return run;
        }
    }
    return atom.sourceRunElement ?? findAncestorByTag(atom, 'w:r');
}
/**
 * Resolve all run elements represented by an atom.
 *
 * For collapsed-field atoms, we must treat the entire field run sequence as a
 * single logical unit. Wrapping only the first run leaves trailing field-code
 * runs untracked, which can leak revised field text after Reject All.
 */
function getAtomRuns(atom) {
    if (!atom.collapsedFieldAtoms || atom.collapsedFieldAtoms.length === 0) {
        const run = atom.sourceRunElement ?? findAncestorByTag(atom, 'w:r');
        return run ? [run] : [];
    }
    const runs = [];
    const seen = new Set();
    for (const fieldAtom of atom.collapsedFieldAtoms) {
        const run = fieldAtom.sourceRunElement ?? findAncestorByTag(fieldAtom, 'w:r');
        if (!run || seen.has(run))
            continue;
        seen.add(run);
        runs.push(run);
    }
    return runs;
}
/**
 * Convert a run node to the correct insertion anchor.
 *
 * If the run is wrapped in a track-change container, the insertion anchor
 * must be the wrapper (a paragraph child), not the nested run.
 */
function getRunInsertionAnchor(run) {
    const parent = parentElement(run);
    if (parent && TRACK_CHANGE_WRAPPERS.has(parent.tagName)) {
        return parent;
    }
    return run;
}
/**
 * Wrap a run element with track change markup.
 *
 * This is the shared implementation for wrapAsInserted, wrapAsDeleted,
 * and the inner wrapping logic of move operations.
 *
 * @param options - Wrapping options
 * @returns true if wrapped, false if run was already wrapped or has no parent
 */
function wrapRunWithTrackChange(options) {
    const { run, tagName, author, dateStr, state, convertTextToDelText: convertText = false } = options;
    // Skip if already wrapped
    if (state.wrappedRuns.has(run)) {
        return false;
    }
    // Skip if the run has no parent in the tree
    if (!run.parentNode) {
        return false;
    }
    // Convert w:t to w:delText if requested (for deleted content)
    if (convertText) {
        convertToDelText(run);
    }
    const id = allocateRevisionId(state);
    const wrapper = createEl(tagName, {
        'w:id': String(id),
        'w:author': author,
        'w:date': dateStr,
    });
    wrapElement(run, wrapper);
    state.wrappedRuns.add(run);
    return true;
}
/**
 * Ensure w:pPr/w:rPr exists and add a paragraph-mark revision marker (w:ins/w:del)
 * in the paragraph properties.
 *
 * This is the critical piece for whole-paragraph insert/delete idempotency:
 * - Reject All should remove inserted paragraphs entirely (no stub breaks)
 * - Accept All should remove deleted paragraphs entirely
 */
function addParagraphMarkRevisionMarker(paragraph, markerTag, author, dateStr, state) {
    // Find or create pPr.
    let pPr = findChildByTagName(paragraph, 'w:pPr');
    if (!pPr) {
        pPr = createEl('w:pPr');
        // pPr should be the first child in a paragraph.
        paragraph.insertBefore(pPr, paragraph.firstChild);
    }
    // Find or create rPr within pPr (paragraph mark properties).
    let rPr = findChildByTagName(pPr, 'w:rPr');
    if (!rPr) {
        rPr = createEl('w:rPr');
        // CT_PPr ordering: ... base props ..., w:rPr, w:sectPr?, w:pPrChange?
        // Insert rPr in schema-correct position (before sectPr/pPrChange).
        const sectPr = findChildByTagName(pPr, 'w:sectPr');
        const pPrChange = findChildByTagName(pPr, 'w:pPrChange');
        const insertBefore = sectPr ?? pPrChange ?? null;
        if (insertBefore) {
            pPr.insertBefore(rPr, insertBefore);
        }
        else {
            pPr.appendChild(rPr);
        }
    }
    // Avoid duplicating markers.
    if (findChildByTagName(rPr, markerTag))
        return;
    const id = allocateRevisionId(state);
    const marker = createEl(markerTag, {
        'w:id': String(id),
        'w:author': author,
        'w:date': dateStr,
    });
    // Insert marker at the start of rPr for consistency with Aspose/Word patterns.
    rPr.insertBefore(marker, rPr.firstChild);
}
/**
 * Wrap a run element with <w:ins> to mark it as inserted.
 *
 * @param run - The w:r element to wrap
 * @param author - Author name for track changes
 * @param dateStr - Formatted date string
 * @param state - Revision ID state
 * @returns true if wrapped, false if run was already wrapped or has no parent
 */
export function wrapAsInserted(run, author, dateStr, state) {
    return wrapRunWithTrackChange({
        run,
        tagName: 'w:ins',
        author,
        dateStr,
        state,
    });
}
/**
 * Wrap a run element with <w:del> to mark it as deleted.
 * Also converts w:t to w:delText within the run.
 *
 * @param run - The w:r element to wrap
 * @param author - Author name for track changes
 * @param dateStr - Formatted date string
 * @param state - Revision ID state
 * @returns true if wrapped, false if run was already wrapped or has no parent
 */
export function wrapAsDeleted(run, author, dateStr, state) {
    return wrapRunWithTrackChange({
        run,
        tagName: 'w:del',
        author,
        dateStr,
        state,
        convertTextToDelText: true,
    });
}
/**
 * Clone a deleted run from the original document and insert it into the revised document.
 *
 * @param deletedAtom - Atom with the deleted content
 * @param insertAfterRun - The run to insert after (null to insert at beginning of paragraph)
 * @param targetParagraph - The paragraph to insert into
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 * @returns The inserted del element, or null if insertion failed
 */
export function insertDeletedRun(deletedAtom, insertAfterRun, targetParagraph, author, dateStr, state, context) {
    // Get the source run element from the deleted atom
    const sourceRun = deletedAtom.sourceRunElement;
    if (!sourceRun) {
        return null;
    }
    // Create w:del wrapper
    const id = allocateRevisionId(state);
    const del = createEl('w:del', {
        'w:id': String(id),
        'w:author': author,
        'w:date': dateStr,
    });
    // For collapsed field atoms, replay one cloned run per original source run
    // to preserve multi-run field structure. Without this, all field elements
    // get packed into a single run, breaking Word's field parsing.
    const runs = getAtomRuns(deletedAtom);
    if (runs.length > 1) {
        for (const run of runs) {
            const clonedRun = cloneRunWithAtomContent(run, deletedAtom, run);
            convertToDelText(clonedRun);
            del.appendChild(clonedRun);
        }
    }
    else {
        const clonedRun = cloneRunWithAtomContent(sourceRun, deletedAtom);
        convertToDelText(clonedRun);
        del.appendChild(clonedRun);
    }
    // Insert at correct position
    if (insertAfterRun) {
        insertAfterElement(insertAfterRun, del);
    }
    else {
        // Insert at the beginning of the paragraph (after pPr if present)
        const pPr = findChildByTagName(targetParagraph, 'w:pPr');
        if (pPr) {
            insertAfterElement(pPr, del);
        }
        else {
            targetParagraph.insertBefore(del, targetParagraph.firstChild);
        }
    }
    const sourceMarkers = cloneUnemittedSourceBookmarkMarkers(sourceRun, targetParagraph, state, context);
    if (sourceMarkers.length > 0)
        insertMarkersBeforeWrapper(del, sourceMarkers);
    return del;
}
/**
 * Clone a moved-from run from the original document and insert it into the revised document.
 *
 * MovedSource atoms have their sourceRunElement in the ORIGINAL tree, but we need to
 * insert the content into the REVISED tree. This function clones the run, wraps it with
 * <w:moveFrom> and range markers, and inserts at the correct position.
 *
 * @param atom - Atom with the moved-from content
 * @param moveName - Name for linking source and destination
 * @param insertAfterRun - The run to insert after (null to insert at beginning of paragraph)
 * @param targetParagraph - The paragraph to insert into
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 * @returns The inserted moveFrom element, or null if insertion failed
 */
export function insertMoveFromRun(atom, moveName, insertAfterRun, targetParagraph, author, dateStr, state, context) {
    // Get the source run element from the atom (in original tree)
    const sourceRun = atom.sourceRunElement;
    if (!sourceRun) {
        return null;
    }
    // For collapsed field atoms, replay one cloned run per original source run.
    const runs = getAtomRuns(atom);
    const clonedRuns = [];
    if (runs.length > 1) {
        for (const run of runs) {
            const clonedRun = cloneRunWithAtomContent(run, atom, run);
            convertToDelText(clonedRun);
            clonedRuns.push(clonedRun);
        }
    }
    else {
        const clonedRun = cloneRunWithAtomContent(sourceRun, atom);
        convertToDelText(clonedRun);
        clonedRuns.push(clonedRun);
    }
    // Get or allocate move range IDs
    const ids = getMoveRangeIds(state, moveName);
    const moveId = allocateRevisionId(state);
    // Create range start marker
    const rangeStart = createEl('w:moveFromRangeStart', {
        'w:id': String(ids.sourceRangeId),
        'w:name': moveName,
        'w:author': author,
        'w:date': dateStr,
    });
    // Create moveFrom wrapper
    const moveFrom = createEl('w:moveFrom', {
        'w:id': String(moveId),
        'w:author': author,
        'w:date': dateStr,
    });
    // Create range end marker
    const rangeEnd = createEl('w:moveFromRangeEnd', {
        'w:id': String(ids.sourceRangeId),
    });
    // Add cloned run(s) as children of moveFrom
    for (const clonedRun of clonedRuns) {
        moveFrom.appendChild(clonedRun);
    }
    // Insert at correct position: rangeStart -> moveFrom(run) -> rangeEnd
    if (insertAfterRun) {
        insertAfterElement(insertAfterRun, rangeStart);
        insertAfterElement(rangeStart, moveFrom);
        insertAfterElement(moveFrom, rangeEnd);
    }
    else {
        // Insert at the beginning of the paragraph (after pPr if present)
        const pPr = findChildByTagName(targetParagraph, 'w:pPr');
        if (pPr) {
            insertAfterElement(pPr, rangeStart);
            insertAfterElement(rangeStart, moveFrom);
            insertAfterElement(moveFrom, rangeEnd);
        }
        else {
            targetParagraph.insertBefore(rangeEnd, targetParagraph.firstChild);
            targetParagraph.insertBefore(moveFrom, rangeEnd);
            targetParagraph.insertBefore(rangeStart, moveFrom);
        }
    }
    const sourceMarkers = cloneUnemittedSourceBookmarkMarkers(sourceRun, targetParagraph, state, context);
    if (sourceMarkers.length > 0)
        insertMarkersBeforeWrapper(moveFrom, sourceMarkers);
    return moveFrom;
}
/**
 * Clone a deleted paragraph from the original document and insert it.
 *
 * @param deletedAtom - Atom representing the deleted paragraph
 * @param insertAfterParagraph - Paragraph to insert after (null to insert at body start)
 * @param targetBody - The body element to insert into
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 * @returns The inserted paragraph, or null if insertion failed
 */
export function insertDeletedParagraph(deletedAtom, insertAfterParagraph, targetBody, author, dateStr, state) {
    // Get the source paragraph from the deleted atom
    const sourceParagraph = deletedAtom.sourceParagraphElement;
    if (!sourceParagraph) {
        return null;
    }
    // Clone the paragraph
    const clonedParagraph = sourceParagraph.cloneNode(true);
    // Wrap runs with w:del (wrapAsDeleted handles w:t -> w:delText conversion internally)
    const runs = Array.from(clonedParagraph.getElementsByTagName('w:r'));
    for (const run of runs) {
        wrapAsDeleted(run, author, dateStr, state);
    }
    // Insert at correct position
    if (insertAfterParagraph) {
        insertAfterElement(insertAfterParagraph, clonedParagraph);
    }
    else {
        targetBody.insertBefore(clonedParagraph, targetBody.firstChild);
    }
    return clonedParagraph;
}
const MOVE_CONFIG = {
    from: {
        wrapperTag: 'w:moveFrom',
        rangeStartTag: 'w:moveFromRangeStart',
        rangeEndTag: 'w:moveFromRangeEnd',
        rangeIdKey: 'sourceRangeId',
        convertTextToDelText: true, // Moved-from content appears as deleted
    },
    to: {
        wrapperTag: 'w:moveTo',
        rangeStartTag: 'w:moveToRangeStart',
        rangeEndTag: 'w:moveToRangeEnd',
        rangeIdKey: 'destRangeId',
        convertTextToDelText: false, // Moved-to content keeps w:t
    },
};
/**
 * Wrap a run element with move tracking (shared implementation for moveFrom/moveTo).
 *
 * @param run - The w:r element to wrap
 * @param moveName - Name for linking source and destination
 * @param direction - 'from' for moveFrom, 'to' for moveTo
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 * @returns true if wrapped
 */
function wrapAsMove(run, moveName, direction, author, dateStr, state) {
    if (state.wrappedRuns.has(run)) {
        return false;
    }
    const parent = parentElement(run);
    if (!parent) {
        return false;
    }
    const config = MOVE_CONFIG[direction];
    const ids = getMoveRangeIds(state, moveName);
    const moveId = allocateRevisionId(state);
    const rangeId = ids[config.rangeIdKey];
    // Convert w:t to w:delText if needed (for moveFrom content)
    if (config.convertTextToDelText) {
        convertToDelText(run);
    }
    // Create range start marker
    const rangeStart = createEl(config.rangeStartTag, {
        'w:id': String(rangeId),
        'w:name': moveName,
        'w:author': author,
        'w:date': dateStr,
    });
    // Create move wrapper
    const moveWrapper = createEl(config.wrapperTag, {
        'w:id': String(moveId),
        'w:author': author,
        'w:date': dateStr,
    });
    // Create range end marker
    const rangeEnd = createEl(config.rangeEndTag, {
        'w:id': String(rangeId),
    });
    // Insert: rangeStart -> moveWrapper(run) -> rangeEnd
    run.parentNode.insertBefore(rangeStart, run);
    wrapElement(run, moveWrapper);
    insertAfterElement(moveWrapper, rangeEnd);
    state.wrappedRuns.add(run);
    return true;
}
/**
 * Wrap a run element with <w:moveFrom> for moved-from content.
 *
 * @param run - The w:r element to wrap
 * @param moveName - Name for linking source and destination
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 * @returns true if wrapped
 */
export function wrapAsMoveFrom(run, moveName, author, dateStr, state) {
    return wrapAsMove(run, moveName, 'from', author, dateStr, state);
}
/**
 * Wrap a run element with <w:moveTo> for moved-to content.
 *
 * @param run - The w:r element to wrap
 * @param moveName - Name for linking source and destination
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 * @returns true if wrapped
 */
export function wrapAsMoveTo(run, moveName, author, dateStr, state) {
    return wrapAsMove(run, moveName, 'to', author, dateStr, state);
}
/**
 * Add format change tracking to a run's properties.
 *
 * @param run - The w:r element with changed formatting
 * @param oldRunProperties - The original run properties (w:rPr)
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 */
export function addFormatChange(run, oldRunProperties, author, dateStr, state) {
    // Find or create w:rPr
    let rPr = findChildByTagName(run, 'w:rPr');
    if (!rPr) {
        rPr = createEl('w:rPr');
        // Insert rPr at the beginning of run's children
        run.insertBefore(rPr, run.firstChild);
    }
    // Create rPrChange
    const id = allocateRevisionId(state);
    const rPrChange = createEl('w:rPrChange', {
        'w:id': String(id),
        'w:author': author,
        'w:date': dateStr,
    });
    // Clone old properties into a w:rPr wrapper inside rPrChange (OOXML spec requires
    // rPrChange to contain a single w:rPr child holding the previous formatting).
    if (oldRunProperties) {
        const oldRPr = createEl('w:rPr');
        for (const child of childElements(oldRunProperties)) {
            const cloned = child.cloneNode(true);
            oldRPr.appendChild(cloned);
        }
        rPrChange.appendChild(oldRPr);
    }
    // Add rPrChange to rPr
    rPr.appendChild(rPrChange);
}
/**
 * Add a paragraph property change element (w:pPrChange) to record the "before"
 * state of paragraph properties.  This is needed for Google Docs to display
 * inserted paragraphs as tracked changes.
 *
 * The child `<w:pPr>` inside `w:pPrChange` must conform to CT_PPrBase — it
 * MUST NOT contain w:rPr, w:sectPr, or w:pPrChange.
 *
 * @param paragraph - The w:p element
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 */
export function addParagraphPropertyChange(paragraph, author, dateStr, state) {
    let pPr = findChildByTagName(paragraph, 'w:pPr');
    if (!pPr) {
        pPr = createEl('w:pPr');
        paragraph.insertBefore(pPr, paragraph.firstChild);
    }
    // Idempotent — don't add a second pPrChange.
    if (findChildByTagName(pPr, 'w:pPrChange'))
        return;
    const id = allocateRevisionId(state);
    const pPrChange = createEl('w:pPrChange', {
        'w:id': String(id),
        'w:author': author,
        'w:date': dateStr,
    });
    // Clone current pPr content as "before" snapshot.
    // pPrChange child pPr must be CT_PPrBase — exclude rPr, rPrChange, sectPr, pPrChange.
    const EXCLUDED = new Set(['w:rPr', 'w:rPrChange', 'w:pPrChange', 'w:sectPr']);
    const oldPPr = createEl('w:pPr');
    for (const child of childElements(pPr)) {
        if (!EXCLUDED.has(child.tagName))
            oldPPr.appendChild(child.cloneNode(true));
    }
    pPrChange.appendChild(oldPPr);
    pPr.appendChild(pPrChange); // pPrChange goes last in pPr per schema
}
/**
 * Tag names that represent visible content inside a w:r element.
 * A run containing at least one of these is considered substantive (non-empty).
 */
const RUN_VISIBLE_CONTENT_TAGS = new Set([
    'w:t', 'w:tab', 'w:br', 'w:cr', 'w:drawing', 'w:object', 'w:pict',
    'w:sym', 'w:fldChar', 'w:instrText',
]);
/**
 * Returns true if a w:r element contains at least one visible content child.
 * Empty runs (containing only w:rPr or nothing) return false.
 */
export function runHasVisibleContent(run) {
    for (let i = 0; i < run.childNodes.length; i++) {
        const child = run.childNodes[i];
        if (child.nodeType === 1 && RUN_VISIBLE_CONTENT_TAGS.has(child.tagName)) {
            return true;
        }
    }
    return false;
}
/**
 * Wrap an inserted empty paragraph with <w:ins>.
 *
 * For empty paragraphs (no content, only pPr), we wrap the entire paragraph.
 *
 * @param paragraph - The w:p element
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 */
export function wrapParagraphAsInserted(paragraph, author, dateStr, state) {
    // For paragraphs with substantive run content: skip the paragraph-mark marker.
    // Google Docs ignores (or actively hides) w:ins-wrapped runs when they
    // coexist with PPR-INS markers. Since individual runs are already wrapped
    // with <w:ins>, the paragraph-level marker is redundant for non-empty
    // paragraphs and omitting it maximises cross-application compatibility.
    //
    // For empty paragraphs (no runs, or only empty w:r shells): we MUST add
    // the PPR-INS marker so that Reject All removes the paragraph. Without it,
    // the empty paragraph shell survives reject, causing round-trip safety failures.
    //
    // Important: empty <w:r> elements (no w:t, w:tab, w:br, etc.) should NOT
    // count as substantive content. They are empty shells that don't produce
    // visible output and should not prevent PPR-INS from being added.
    let hasSubstantiveContent = false;
    for (const child of childElements(paragraph)) {
        if (child.tagName === 'w:ins') {
            // Check if the w:ins wrapper contains runs with visible content
            for (let i = 0; i < child.childNodes.length; i++) {
                const insChild = child.childNodes[i];
                if (insChild.nodeType === 1 && insChild.tagName === 'w:r' &&
                    runHasVisibleContent(insChild)) {
                    hasSubstantiveContent = true;
                    break;
                }
            }
            if (hasSubstantiveContent)
                break;
        }
        else if (child.tagName === 'w:r' && runHasVisibleContent(child)) {
            hasSubstantiveContent = true;
            break;
        }
    }
    if (hasSubstantiveContent) {
        return true;
    }
    addParagraphMarkRevisionMarker(paragraph, 'w:ins', author, dateStr, state);
    return true;
}
/**
 * Wrap a deleted empty paragraph with <w:del>.
 *
 * @param paragraph - The w:p element
 * @param author - Author name
 * @param dateStr - Formatted date
 * @param state - Revision ID state
 */
export function wrapParagraphAsDeleted(paragraph, author, dateStr, state) {
    // See wrapParagraphAsInserted: represent paragraph deletion via a paragraph-mark
    // revision marker in w:pPr/w:rPr so Accept/Reject All behaves correctly.
    addParagraphMarkRevisionMarker(paragraph, 'w:del', author, dateStr, state);
    return true;
}
// Field-character tag names that should not be split.
const FIELD_CHAR_TAG_NAMES = new Set([
    'w:fldChar', 'w:instrText', 'w:delInstrText',
]);
/**
 * Visible text length for an atom's contentElement.
 *
 * Atom contentElements created by the word-split atomizer use prefixed tagNames
 * (e.g. `"w:t"`) without namespace URIs, so we match on `tagName` rather than
 * `localName`/`namespaceURI` (which is what the DOM-level `visibleLengthForEl` does).
 */
function atomContentVisibleLength(el) {
    const tag = el.tagName;
    if (tag === 'w:t')
        return (el.textContent ?? '').length;
    if (tag === 'w:tab' || tag === 'w:br')
        return 1;
    // w:cr is treated as zero-length (consistent with visibleLengthForEl which also returns 0).
    return 0;
}
/**
 * Pre-split revised-tree runs that contain atoms with mixed correlation statuses.
 *
 * Without this, `handleInserted` wraps the entire run with `<w:ins>`, destroying
 * Equal content in the same run. After splitting, each fragment is a separate
 * `<w:r>` and existing per-status handlers work without modification.
 *
 * Safety: wrapped in try/catch per run group. If any DOM operation fails, the
 * run is skipped and the existing fallback-to-rebuild architecture handles it.
 */
export function preSplitMixedStatusRuns(mergedAtoms) {
    // Group atoms by their sourceRunElement (revised-tree runs only).
    const runGroups = new Map();
    for (const atom of mergedAtoms) {
        if (!atom.sourceRunElement)
            continue;
        // Skip original-tree atoms — Deleted/MovedSource runs are cloned, not wrapped.
        if (atom.correlationStatus === CorrelationStatus.Deleted ||
            atom.correlationStatus === CorrelationStatus.MovedSource)
            continue;
        // Skip collapsed field atoms (multi-run field sequences).
        if (atom.collapsedFieldAtoms && atom.collapsedFieldAtoms.length > 0)
            continue;
        // Skip field character elements — semantically fragile.
        if (FIELD_CHAR_TAG_NAMES.has(atom.contentElement.tagName))
            continue;
        const group = runGroups.get(atom.sourceRunElement);
        if (group) {
            group.push(atom);
        }
        else {
            runGroups.set(atom.sourceRunElement, [atom]);
        }
    }
    for (const [run, atoms] of runGroups) {
        // Early check: skip single-status runs before any DOM work.
        const statuses = new Set(atoms.map((a) => a.correlationStatus));
        if (statuses.size <= 1)
            continue;
        // Guard: skip runs already detached from the tree.
        if (!run.parentNode)
            continue;
        try {
            // Compute the run's actual visible length via DOM traversal.
            const contentEls = getDirectContentElements(run);
            let runVisibleLength = 0;
            for (const cel of contentEls) {
                runVisibleLength += visibleLengthForEl(cel);
            }
            // Cross-run safety: if sum of atom lengths exceeds run visible length,
            // this group contains a cross-run merged atom (passes 3/4). Skip it.
            let sumAtomLengths = 0;
            for (const atom of atoms) {
                sumAtomLengths += atomContentVisibleLength(atom.contentElement);
            }
            if (sumAtomLengths > runVisibleLength)
                continue;
            const spans = [];
            let offset = 0;
            for (const atom of atoms) {
                const len = atomContentVisibleLength(atom.contentElement);
                const lastSpan = spans[spans.length - 1];
                if (lastSpan && lastSpan.status === atom.correlationStatus) {
                    lastSpan.length += len;
                    lastSpan.atoms.push(atom);
                }
                else {
                    spans.push({
                        status: atom.correlationStatus,
                        startOffset: offset,
                        length: len,
                        atoms: [atom],
                    });
                }
                offset += len;
            }
            // If only one span after grouping, no split needed.
            if (spans.length <= 1)
                continue;
            // Collect split points: startOffset of each span after the first.
            const splitPoints = [];
            for (let i = 1; i < spans.length; i++) {
                const pt = spans[i].startOffset;
                // Filter out degenerate split points at boundaries.
                if (pt > 0 && pt < runVisibleLength) {
                    splitPoints.push(pt);
                }
            }
            if (splitPoints.length === 0)
                continue;
            // Split DOM run right-to-left to keep earlier offsets valid.
            const rightFragments = [];
            for (let i = splitPoints.length - 1; i >= 0; i--) {
                const { right } = splitRunAtVisibleOffset(run, splitPoints[i]);
                rightFragments.push(right);
            }
            // Map fragments: [originalRun (leftmost), ...reverse(rightFragments)]
            // After R-to-L splits, rightFragments are in reverse document order.
            const fragments = [run, ...rightFragments.reverse()];
            // Update atom sourceRunElement pointers to the correct fragment.
            // Each span maps to one fragment in order.
            for (let i = 0; i < spans.length; i++) {
                const fragment = fragments[i];
                if (!fragment)
                    continue;
                for (const atom of spans[i].atoms) {
                    atom.sourceRunElement = fragment;
                }
            }
        }
        catch (_err) {
            // DOM operation failed — skip this run. The existing fallback-to-rebuild
            // architecture will handle it if the overall safety check fails.
            warn('preSplitMixedStatusRuns', `Skipping run split due to error: ${_err}`);
        }
    }
}
/**
 * Pre-split revised-tree runs where word-split Equal atoms from the same run
 * are interleaved with Deleted/MovedSource atoms in the merged atom list.
 *
 * `preSplitMixedStatusRuns` handles the case where a single run contains atoms
 * with DIFFERENT statuses (e.g., some Equal and some Inserted). But it cannot
 * handle the case where ALL atoms from a run are Equal yet Deleted atoms (from
 * the original tree) are interspersed between them in the merged list.
 *
 * Without this split, `handleEqual` sees all Equal atoms pointing to the same
 * run and skips position advancement (the `lastRevisedRunAnchor` optimization).
 * Subsequent `handleDeleted` calls then insert deleted content at the wrong
 * position because the cursor never advanced past the shared run.
 *
 * This function detects interleaved sequences and splits the DOM run so each
 * contiguous group of Equal atoms gets its own run fragment. The handlers then
 * advance the cursor correctly across fragments.
 */
export function preSplitInterleavedWordRuns(mergedAtoms) {
    const runToGroups = new Map();
    // Track cumulative offset per run (sums visible lengths of atoms seen so far)
    const runToOffset = new Map();
    let lastRevisedRun = null;
    for (const atom of mergedAtoms) {
        // Skip atoms from the original tree (Deleted/MovedSource have runs in the
        // original tree, not the revised tree).
        if (atom.correlationStatus === CorrelationStatus.Deleted ||
            atom.correlationStatus === CorrelationStatus.MovedSource) {
            // A Deleted/MovedSource atom between Equal atoms from the same run
            // creates an interleaving gap. Mark this by clearing lastRevisedRun
            // so the next Equal atom from the same run starts a new group.
            lastRevisedRun = null;
            continue;
        }
        const run = atom.sourceRunElement;
        if (!run)
            continue;
        // Skip collapsed field atoms — multi-run field sequences.
        if (atom.collapsedFieldAtoms && atom.collapsedFieldAtoms.length > 0)
            continue;
        // Skip field character elements — semantically fragile.
        if (FIELD_CHAR_TAG_NAMES.has(atom.contentElement.tagName))
            continue;
        const atomLen = atomContentVisibleLength(atom.contentElement);
        const currentOffset = runToOffset.get(run) ?? 0;
        runToOffset.set(run, currentOffset + atomLen);
        const groups = runToGroups.get(run);
        if (!groups) {
            // First time seeing this run — create initial group.
            runToGroups.set(run, [{
                    startOffset: currentOffset,
                    length: atomLen,
                    atoms: [atom],
                }]);
            lastRevisedRun = run;
            continue;
        }
        if (lastRevisedRun === run) {
            // Contiguous with the previous atom from the same run — extend group.
            const lastGroup = groups[groups.length - 1];
            lastGroup.length += atomLen;
            lastGroup.atoms.push(atom);
        }
        else {
            // Gap detected (a Deleted/MovedSource atom intervened). Start new group.
            groups.push({
                startOffset: currentOffset,
                length: atomLen,
                atoms: [atom],
            });
        }
        lastRevisedRun = run;
    }
    // Now split runs that have more than one group.
    for (const [run, groups] of runToGroups) {
        if (groups.length <= 1)
            continue;
        // Guard: skip runs already detached from the tree.
        if (!run.parentNode)
            continue;
        try {
            // Compute actual visible length of the DOM run.
            const contentEls = getDirectContentElements(run);
            let runVisibleLength = 0;
            for (const cel of contentEls) {
                runVisibleLength += visibleLengthForEl(cel);
            }
            // Safety: if the sum of atom lengths exceeds run visible length,
            // something is off (cross-run atoms, etc.). Skip.
            let sumAtomLengths = 0;
            for (const group of groups) {
                sumAtomLengths += group.length;
            }
            if (sumAtomLengths > runVisibleLength)
                continue;
            // Collect split points: the startOffset of each group after the first.
            const splitPoints = [];
            for (let i = 1; i < groups.length; i++) {
                const pt = groups[i].startOffset;
                if (pt > 0 && pt < runVisibleLength) {
                    splitPoints.push(pt);
                }
            }
            if (splitPoints.length === 0)
                continue;
            // Split DOM run right-to-left to keep earlier offsets valid.
            const rightFragments = [];
            for (let i = splitPoints.length - 1; i >= 0; i--) {
                const { right } = splitRunAtVisibleOffset(run, splitPoints[i]);
                rightFragments.push(right);
            }
            // Map fragments: [originalRun (leftmost), ...reverse(rightFragments)]
            const fragments = [run, ...rightFragments.reverse()];
            // Update atom sourceRunElement pointers to the correct fragment.
            for (let i = 0; i < groups.length; i++) {
                const fragment = fragments[i];
                if (!fragment)
                    continue;
                for (const atom of groups[i].atoms) {
                    atom.sourceRunElement = fragment;
                }
            }
        }
        catch (_err) {
            warn('preSplitInterleavedWordRuns', `Skipping run split due to error: ${_err}`);
        }
    }
}
/**
 * Modify the revised document's AST in-place based on comparison results.
 *
 * @param revisedRoot - Root element of the revised document
 * @param mergedAtoms - Atoms with correlation status from comparison
 * @param options - Modification options
 * @returns The modified XML string
 */
export function modifyRevisedDocument(revisedRoot, originalAtoms, revisedAtoms, mergedAtoms, options) {
    const { author, date } = options;
    const dateStr = formatDate(date);
    const state = createRevisionIdState();
    // In-place mode needs concrete AST node pointers for run/paragraph edits.
    // Populate these once up-front so handlers don't have to rescan ancestor chains.
    attachSourceElementPointers(originalAtoms);
    attachSourceElementPointers(revisedAtoms);
    preSplitMixedStatusRuns(mergedAtoms);
    preSplitInterleavedWordRuns(mergedAtoms);
    // Process atoms and apply track changes to the revised tree
    // Group atoms by paragraph for efficient processing
    const ctx = processAtoms(mergedAtoms, originalAtoms, revisedAtoms, author, dateStr, state, revisedRoot);
    // Add paragraph-mark revision markers for whole-paragraph insert/delete cases.
    // This is required for idempotency in Word:
    // - Reject All should remove inserted paragraphs entirely
    // - Accept All should remove deleted paragraphs entirely
    applyWholeParagraphRevisionMarkers(mergedAtoms, ctx);
    // Suppress field-adjacent no-op del/ins pairs (issue #42, Bug 1).
    // Must run BEFORE merge — after merge, pairwise comparison is impossible.
    suppressNoOpChangePairs(ctx.body);
    // Merge adjacent <w:ins>/<w:del> siblings to reduce revision fragmentation.
    mergeAdjacentTrackChangeSiblings(ctx.body);
    // Coalesce del/ins pair chains across whitespace (issue #42, Bug 2b).
    // Merges [del:A][ins:X][ws][del:B][ins:Y] → [del:A ws B][ins:X ws Y]
    coalesceDelInsPairChains(ctx.body);
    // Merge whitespace-bridged track change siblings (issue #42, Bug 2).
    // Runs AFTER coalesce — handles ins+ws+ins and moveTo+ws+moveTo bridging.
    mergeWhitespaceBridgedTrackChanges(ctx.body);
    // Apply strict post-render consumer compatibility pass
    enforceConsumerCompatibility(revisedRoot, () => allocateRevisionId(state));
    // Serialize the modified tree
    return new XMLSerializer().serializeToString(revisedRoot.ownerDocument || revisedRoot);
}
function isParagraphRemovedOnRejectInContext(paragraph, ctx) {
    if (paragraphHasParaInsMarker(paragraph)) {
        return true;
    }
    const unifiedIndex = ctx.revisedParagraphToUnifiedIndex.get(paragraph);
    return unifiedIndex !== undefined && ctx.fullyInsertedParagraphIndices.has(unifiedIndex);
}
/**
 * Handle Inserted atoms - wrap the run with <w:ins>.
 * Inserted atoms have sourceRunElement in the REVISED tree.
 */
function handleInserted(atom, ctx) {
    const runs = getAtomRuns(atom);
    if (runs.length > 0) {
        for (const run of runs) {
            wrapAsInserted(run, ctx.author, ctx.dateStr, ctx.state);
        }
        const endRun = getAtomRunAtBoundary(atom, 'end') ?? runs[runs.length - 1];
        const insertionPoint = getRunInsertionAnchor(endRun);
        if (insertionPoint === ctx.lastRevisedRunAnchor) {
            return {
                newLastParagraph: atom.sourceParagraphElement ?? ctx.lastProcessedParagraph,
                newLastParagraphIndex: atom.paragraphIndex,
            };
        }
        return {
            newLastRun: insertionPoint,
            newLastRevisedRunAnchor: insertionPoint,
            newLastParagraph: atom.sourceParagraphElement ?? ctx.lastProcessedParagraph,
            newLastParagraphIndex: atom.paragraphIndex,
        };
    }
    else if (atom.isEmptyParagraph && atom.sourceParagraphElement) {
        // Empty inserted paragraph: mark paragraph properties instead of wrapping <w:p>.
        wrapParagraphAsInserted(atom.sourceParagraphElement, ctx.author, ctx.dateStr, ctx.state);
        return {
            newLastParagraph: atom.sourceParagraphElement,
            newLastParagraphIndex: atom.paragraphIndex,
        };
    }
    return {};
}
/**
 * Handle Deleted atoms - clone from original and insert with <w:del>.
 * Deleted atoms have sourceRunElement in the ORIGINAL tree.
 * We need to clone and insert into the REVISED tree.
 *
 * Paragraph placement logic:
 * 1. If the atom's unified paragraph exists in the revised document, insert there
 * 2. If we've already created a paragraph for this unified index, use it
 * 3. Otherwise, create a new paragraph and insert it at the correct position
 */
function handleDeleted(atom, ctx) {
    const bookmarkSurvivalContext = {
        isParagraphRemovedOnReject: (paragraph) => isParagraphRemovedOnRejectInContext(paragraph, ctx),
    };
    // Handle empty deleted paragraphs specially
    if (atom.isEmptyParagraph && atom.sourceParagraphElement) {
        const createdPara = insertDeletedParagraph(atom, ctx.lastProcessedParagraph, ctx.body, ctx.author, ctx.dateStr, ctx.state);
        if (createdPara && atom.paragraphIndex !== undefined) {
            ctx.createdParagraphs.set(atom.paragraphIndex, createdPara);
        }
        if (createdPara) {
            wrapParagraphAsDeleted(createdPara, ctx.author, ctx.dateStr, ctx.state);
        }
        return {
            newLastParagraph: createdPara ?? ctx.lastProcessedParagraph,
            newLastParagraphIndex: atom.paragraphIndex,
        };
    }
    if (atom.sourceRunElement) {
        const unifiedPara = atom.paragraphIndex;
        let targetParagraph;
        let insertAfterRun = null;
        // Determine target paragraph and insertion point
        if (unifiedPara !== undefined) {
            // Check if this unified paragraph exists in the revised document
            const revisedPara = ctx.unifiedParaToElement.get(unifiedPara);
            const revisedParagraphRemovedOnReject = revisedPara !== undefined &&
                (ctx.fullyInsertedParagraphIndices.has(unifiedPara) || paragraphHasParaInsMarker(revisedPara));
            if (revisedPara && !revisedParagraphRemovedOnReject) {
                // Paragraph exists in revised and survives Reject All - insert into it.
                targetParagraph = revisedPara;
                // If this is the same paragraph we last processed, use lastProcessedRun
                if (ctx.lastParagraphIndex === unifiedPara) {
                    insertAfterRun = ctx.lastProcessedRun;
                }
                // Otherwise, insert at the beginning of the paragraph (insertAfterRun = null)
            }
            else {
                // Paragraph is absent in revised OR will be removed on Reject All.
                // Route deleted content into a created paragraph so reject output keeps
                // original-order text and bookmark markers.
                const createdPara = ctx.createdParagraphs.get(unifiedPara);
                if (createdPara) {
                    targetParagraph = createdPara;
                    insertAfterRun = ctx.createdParagraphLastRun.get(unifiedPara) ?? null;
                }
                else {
                    // Need to create a new paragraph for this deleted content
                    const newPara = createEl('w:p');
                    const boundaryMarkers = cloneParagraphBoundaryBookmarkMarkers(atom.sourceParagraphElement);
                    for (const marker of [...boundaryMarkers.sourceLeading, ...boundaryMarkers.sourceTrailing]) {
                        ctx.state.emittedSourceBookmarkMarkers.add(marker);
                    }
                    const leadingMarkers = filterEquivalentBookmarkMarkers(boundaryMarkers.leading, ctx.body, bookmarkSurvivalContext);
                    const trailingMarkers = filterEquivalentBookmarkMarkers(boundaryMarkers.trailing, ctx.body, bookmarkSurvivalContext);
                    // Preserve paragraph properties from the original paragraph for fidelity.
                    const srcP = atom.sourceParagraphElement;
                    const srcPPr = srcP ? findChildByTagName(srcP, 'w:pPr') : null;
                    if (srcPPr) {
                        const clonedPPr = srcPPr.cloneNode(true);
                        newPara.appendChild(clonedPPr);
                    }
                    if (ctx.lastProcessedParagraph) {
                        insertAfterElement(ctx.lastProcessedParagraph, newPara);
                    }
                    else {
                        ctx.body.insertBefore(newPara, ctx.body.firstChild);
                    }
                    ctx.createdParagraphs.set(unifiedPara, newPara);
                    const leadingTail = insertLeadingMarkers(newPara, leadingMarkers);
                    if (leadingTail) {
                        ctx.createdParagraphLastRun.set(unifiedPara, leadingTail);
                    }
                    if (trailingMarkers.length > 0) {
                        ctx.createdParagraphTrailingBookmarks.set(unifiedPara, trailingMarkers);
                    }
                    targetParagraph = newPara;
                    insertAfterRun = leadingTail;
                }
            }
        }
        // Fall back to last processed paragraph if we couldn't determine target
        if (!targetParagraph) {
            targetParagraph = ctx.lastProcessedParagraph ??
                childElements(ctx.body).find(c => c.tagName === 'w:p');
        }
        if (!targetParagraph) {
            warn('inPlaceModifier', 'Cannot insert deleted content: no target paragraph found', {
                atomText: atom.contentElement?.textContent,
            });
            return {};
        }
        const del = insertDeletedRun(atom, insertAfterRun, targetParagraph, ctx.author, ctx.dateStr, ctx.state, bookmarkSurvivalContext);
        if (del) {
            // Track last run in created paragraphs
            if (unifiedPara !== undefined && ctx.createdParagraphs.has(unifiedPara)) {
                ctx.createdParagraphLastRun.set(unifiedPara, del);
            }
            return {
                newLastRun: del,
                newLastParagraph: targetParagraph,
                newLastParagraphIndex: atom.paragraphIndex,
            };
        }
    }
    return {};
}
/**
 * Handle MovedSource atoms - clone from original and insert with <w:moveFrom>.
 *
 * MovedSource atoms have sourceRunElement pointing to the ORIGINAL tree.
 * We need to clone the content and insert it into the REVISED tree.
 *
 * Paragraph placement logic (same as handleDeleted):
 * 1. If the atom's unified paragraph exists in the revised document, insert there
 * 2. If we've already created a paragraph for this unified index, use it
 * 3. Otherwise, create a new paragraph and insert it at the correct position
 */
function handleMovedSource(atom, ctx) {
    const bookmarkSurvivalContext = {
        isParagraphRemovedOnReject: (paragraph) => isParagraphRemovedOnRejectInContext(paragraph, ctx),
    };
    if (atom.sourceRunElement) {
        const unifiedPara = atom.paragraphIndex;
        let targetParagraph;
        let insertAfterRun = null;
        // Determine target paragraph and insertion point
        if (unifiedPara !== undefined) {
            // Check if this unified paragraph exists in the revised document
            const revisedPara = ctx.unifiedParaToElement.get(unifiedPara);
            const revisedParagraphRemovedOnReject = revisedPara !== undefined &&
                (ctx.fullyInsertedParagraphIndices.has(unifiedPara) || paragraphHasParaInsMarker(revisedPara));
            if (revisedPara && !revisedParagraphRemovedOnReject) {
                // Paragraph exists in revised and survives Reject All - insert into it.
                targetParagraph = revisedPara;
                // If this is the same paragraph we last processed, use lastProcessedRun
                if (ctx.lastParagraphIndex === unifiedPara) {
                    insertAfterRun = ctx.lastProcessedRun;
                }
                // Otherwise, insert at the beginning of the paragraph (insertAfterRun = null)
            }
            else {
                // Paragraph is absent in revised OR will be removed on Reject All.
                // Route moved-from content into a created paragraph for reject fidelity.
                const createdPara = ctx.createdParagraphs.get(unifiedPara);
                if (createdPara) {
                    targetParagraph = createdPara;
                    insertAfterRun = ctx.createdParagraphLastRun.get(unifiedPara) ?? null;
                }
                else {
                    // Need to create a new paragraph for this moved-from content
                    const newPara = createEl('w:p');
                    const boundaryMarkers = cloneParagraphBoundaryBookmarkMarkers(atom.sourceParagraphElement);
                    for (const marker of [...boundaryMarkers.sourceLeading, ...boundaryMarkers.sourceTrailing]) {
                        ctx.state.emittedSourceBookmarkMarkers.add(marker);
                    }
                    const leadingMarkers = filterEquivalentBookmarkMarkers(boundaryMarkers.leading, ctx.body, bookmarkSurvivalContext);
                    const trailingMarkers = filterEquivalentBookmarkMarkers(boundaryMarkers.trailing, ctx.body, bookmarkSurvivalContext);
                    // Preserve paragraph properties from the original paragraph for fidelity.
                    const srcP = atom.sourceParagraphElement;
                    const srcPPr = srcP ? findChildByTagName(srcP, 'w:pPr') : null;
                    if (srcPPr) {
                        const clonedPPr = srcPPr.cloneNode(true);
                        newPara.appendChild(clonedPPr);
                    }
                    if (ctx.lastProcessedParagraph) {
                        insertAfterElement(ctx.lastProcessedParagraph, newPara);
                    }
                    else {
                        ctx.body.insertBefore(newPara, ctx.body.firstChild);
                    }
                    ctx.createdParagraphs.set(unifiedPara, newPara);
                    const leadingTail = insertLeadingMarkers(newPara, leadingMarkers);
                    if (leadingTail) {
                        ctx.createdParagraphLastRun.set(unifiedPara, leadingTail);
                    }
                    if (trailingMarkers.length > 0) {
                        ctx.createdParagraphTrailingBookmarks.set(unifiedPara, trailingMarkers);
                    }
                    targetParagraph = newPara;
                    insertAfterRun = leadingTail;
                }
            }
        }
        // Fall back to last processed paragraph if we couldn't determine target
        if (!targetParagraph) {
            targetParagraph = ctx.lastProcessedParagraph ??
                childElements(ctx.body).find(c => c.tagName === 'w:p');
        }
        if (!targetParagraph) {
            warn('inPlaceModifier', 'Cannot insert moved-from content: no target paragraph found', {
                atomText: atom.contentElement?.textContent,
            });
            return {};
        }
        const moveFrom = insertMoveFromRun(atom, atom.moveName || 'move1', insertAfterRun, targetParagraph, ctx.author, ctx.dateStr, ctx.state, bookmarkSurvivalContext);
        if (moveFrom) {
            // Track last run in created paragraphs
            if (unifiedPara !== undefined && ctx.createdParagraphs.has(unifiedPara)) {
                ctx.createdParagraphLastRun.set(unifiedPara, moveFrom);
            }
            return {
                newLastRun: moveFrom,
                newLastParagraph: targetParagraph,
                newLastParagraphIndex: atom.paragraphIndex,
            };
        }
    }
    return {};
}
/**
 * Handle MovedDestination atoms - wrap with <w:moveTo>.
 * MovedDestination atoms have sourceRunElement in the REVISED tree.
 */
function handleMovedDestination(atom, ctx) {
    const runs = getAtomRuns(atom);
    if (runs.length > 0) {
        for (const run of runs) {
            wrapAsMoveTo(run, atom.moveName || 'move1', ctx.author, ctx.dateStr, ctx.state);
        }
        const endRun = getAtomRunAtBoundary(atom, 'end') ?? runs[runs.length - 1];
        const insertionPoint = getRunInsertionAnchor(endRun);
        if (insertionPoint === ctx.lastRevisedRunAnchor) {
            return {
                newLastParagraph: atom.sourceParagraphElement ?? ctx.lastProcessedParagraph,
                newLastParagraphIndex: atom.paragraphIndex,
            };
        }
        return {
            newLastRun: insertionPoint,
            newLastRevisedRunAnchor: insertionPoint,
            newLastParagraph: atom.sourceParagraphElement ?? ctx.lastProcessedParagraph,
            newLastParagraphIndex: atom.paragraphIndex,
        };
    }
    return {};
}
/**
 * Handle FormatChanged atoms - add <w:rPrChange>.
 * FormatChanged atoms have sourceRunElement in the REVISED tree.
 */
function handleFormatChanged(atom, ctx) {
    const run = getAtomRunAtBoundary(atom, 'start');
    if (run && atom.formatChange?.oldRunProperties) {
        addFormatChange(run, atom.formatChange.oldRunProperties, ctx.author, ctx.dateStr, ctx.state);
        const endRun = getAtomRunAtBoundary(atom, 'end') ?? run;
        const insertionPoint = getRunInsertionAnchor(endRun);
        if (insertionPoint === ctx.lastRevisedRunAnchor) {
            return {
                newLastParagraph: atom.sourceParagraphElement ?? ctx.lastProcessedParagraph,
                newLastParagraphIndex: atom.paragraphIndex,
            };
        }
        return {
            newLastRun: insertionPoint,
            newLastRevisedRunAnchor: insertionPoint,
            newLastParagraph: atom.sourceParagraphElement ?? ctx.lastProcessedParagraph,
            newLastParagraphIndex: atom.paragraphIndex,
        };
    }
    return {};
}
/**
 * Handle Equal/Unknown atoms - just track position.
 *
 * IMPORTANT: For inplace mode, we must track positions in the REVISED tree.
 * - Non-empty Equal atoms come from the revised tree (sourceRunElement/sourceParagraphElement point to revised)
 * - Empty paragraph Equal atoms come from the ORIGINAL tree (see createMergedAtomList)
 *
 * For empty paragraphs, we need to look up the corresponding revised paragraph
 * from unifiedParaToElement, not use the atom's sourceParagraphElement (which is from original tree).
 *
 * CRITICAL: When the paragraph index changes, we MUST reset newLastRun to null.
 * This ensures that subsequent content is not incorrectly inserted after a run
 * from a previous paragraph. See the "Gross Asset Value" bug fix.
 */
function handleEqual(atom, ctx) {
    // For non-empty atoms, sourceRunElement points to revised tree - safe to use directly
    const run = getAtomRunAtBoundary(atom, 'end');
    if (run) {
        const insertionPoint = getRunInsertionAnchor(run);
        // BUG FIX: Don't move the insertion point backwards if we are still in the same run.
        // This prevents Deleted atoms inserted between words of the same run from being reversed.
        if (insertionPoint === ctx.lastRevisedRunAnchor) {
            return {
                newLastParagraph: atom.sourceParagraphElement ?? ctx.lastProcessedParagraph,
                newLastParagraphIndex: atom.paragraphIndex,
            };
        }
        return {
            newLastRun: insertionPoint,
            newLastRevisedRunAnchor: insertionPoint,
            newLastParagraph: atom.sourceParagraphElement ?? ctx.lastProcessedParagraph,
            newLastParagraphIndex: atom.paragraphIndex,
        };
    }
    // For empty paragraphs (no sourceRunElement), the atom comes from the ORIGINAL tree!
    // We must NOT use atom.sourceParagraphElement for position tracking in inplace mode.
    // Instead, look up the corresponding REVISED paragraph from unifiedParaToElement.
    if (atom.paragraphIndex !== undefined) {
        // Look up the revised paragraph for this unified paragraph index
        const revisedParagraph = ctx.unifiedParaToElement.get(atom.paragraphIndex);
        // IMPORTANT: When we move to a new paragraph (empty or not), we MUST reset
        // lastProcessedRun to null. Otherwise, subsequent inserts might use a stale
        // run from a previous paragraph, causing content to be inserted in the wrong place.
        // Setting newLastRun to null explicitly resets it.
        return {
            newLastRun: null, // Reset - we're in a new paragraph with no runs yet
            newLastRevisedRunAnchor: null,
            // Use the revised paragraph (not the original's sourceParagraphElement!)
            newLastParagraph: revisedParagraph ?? ctx.lastProcessedParagraph,
            newLastParagraphIndex: atom.paragraphIndex,
        };
    }
    return {};
}
/**
 * Strategy map for handling atoms by correlation status.
 * This pattern makes it easy to add new status types without modifying processAtoms.
 */
const ATOM_HANDLERS = {
    [CorrelationStatus.Inserted]: handleInserted,
    [CorrelationStatus.Deleted]: handleDeleted,
    [CorrelationStatus.MovedSource]: handleMovedSource,
    [CorrelationStatus.MovedDestination]: handleMovedDestination,
    [CorrelationStatus.FormatChanged]: handleFormatChanged,
    [CorrelationStatus.Equal]: handleEqual,
    [CorrelationStatus.Unknown]: handleEqual,
};
const DELETION_LIKE_STATUSES = new Set([
    CorrelationStatus.Deleted,
    CorrelationStatus.MovedSource,
]);
const INSERTION_LIKE_STATUSES = new Set([
    CorrelationStatus.Inserted,
    CorrelationStatus.MovedDestination,
]);
/**
 * Reorder merged atoms so that within each contiguous block of non-equal atoms,
 * all deletion-like atoms come before all insertion-like atoms.
 *
 * This produces grouped tracked changes ("<del>old words</del><ins>new words</ins>")
 * instead of alternating word-by-word pairs ("<del>old1</del><ins>new1</ins><del>old2</del>...").
 */
export function groupDeletionsBeforeInsertions(atoms) {
    const result = [];
    let i = 0;
    while (i < atoms.length) {
        const atom = atoms[i];
        const status = atom.correlationStatus;
        // Pass through equal/format-changed/unknown atoms unchanged
        if (!DELETION_LIKE_STATUSES.has(status) && !INSERTION_LIKE_STATUSES.has(status)) {
            result.push(atom);
            i++;
            continue;
        }
        // Collect a contiguous block of change atoms (deletions + insertions)
        const deletions = [];
        const insertions = [];
        while (i < atoms.length) {
            const s = atoms[i].correlationStatus;
            if (DELETION_LIKE_STATUSES.has(s)) {
                deletions.push(atoms[i]);
            }
            else if (INSERTION_LIKE_STATUSES.has(s)) {
                insertions.push(atoms[i]);
            }
            else {
                break;
            }
            i++;
        }
        // Emit all deletions first, then all insertions
        result.push(...deletions, ...insertions);
    }
    return result;
}
/**
 * Process atoms and apply track changes to the revised AST.
 *
 * Uses a strategy pattern with registered handlers for each correlation status,
 * making it easy to add new status types without modifying this function.
 */
function processAtoms(mergedAtoms, _originalAtoms, revisedAtoms, author, dateStr, state, revisedRoot) {
    const bodyElements = Array.from(revisedRoot.getElementsByTagName('w:body'));
    const body = bodyElements[0];
    if (!body) {
        warn('inPlaceModifier', 'Cannot process atoms: no w:body element found');
        // Return a minimal context to avoid callers having to handle undefined.
        return {
            author,
            dateStr,
            state,
            body: revisedRoot,
            lastProcessedRun: null,
            lastRevisedRunAnchor: null,
            lastProcessedParagraph: null,
            lastParagraphIndex: undefined,
            unifiedParaToElement: new Map(),
            revisedParagraphToUnifiedIndex: new Map(),
            fullyInsertedParagraphIndices: new Set(),
            createdParagraphs: new Map(),
            createdParagraphLastRun: new Map(),
            createdParagraphTrailingBookmarks: new Map(),
        };
    }
    // Build map from unified paragraph index to revised paragraph element.
    // This tells us which paragraphs exist in the revised document.
    // Revised atoms have their paragraphIndex already set to unified indices
    // after assignUnifiedParagraphIndices was called.
    const unifiedParaToElement = new Map();
    const revisedParagraphToUnifiedIndex = new Map();
    for (const atom of revisedAtoms) {
        if (atom.paragraphIndex !== undefined && atom.sourceParagraphElement) {
            if (!unifiedParaToElement.has(atom.paragraphIndex)) {
                unifiedParaToElement.set(atom.paragraphIndex, atom.sourceParagraphElement);
            }
            if (!revisedParagraphToUnifiedIndex.has(atom.sourceParagraphElement)) {
                revisedParagraphToUnifiedIndex.set(atom.sourceParagraphElement, atom.paragraphIndex);
            }
        }
    }
    const atomsByPara = new Map();
    for (const atom of mergedAtoms) {
        if (atom.paragraphIndex === undefined)
            continue;
        const existing = atomsByPara.get(atom.paragraphIndex) ?? [];
        existing.push(atom);
        atomsByPara.set(atom.paragraphIndex, existing);
    }
    const fullyInsertedParagraphIndices = new Set();
    for (const [paraIdx, atoms] of atomsByPara.entries()) {
        if (isEntireParagraphAtomsWithStatus(atoms, CorrelationStatus.Inserted)) {
            fullyInsertedParagraphIndices.add(paraIdx);
        }
    }
    // Initialize processing context with position tracking
    const ctx = {
        author,
        dateStr,
        state,
        body,
        lastProcessedRun: null,
        lastRevisedRunAnchor: null,
        lastProcessedParagraph: null,
        lastParagraphIndex: undefined,
        unifiedParaToElement,
        revisedParagraphToUnifiedIndex,
        fullyInsertedParagraphIndices,
        createdParagraphs: new Map(),
        createdParagraphLastRun: new Map(),
        createdParagraphTrailingBookmarks: new Map(),
    };
    // Reorder atoms so consecutive deletions precede consecutive insertions.
    // This produces grouped tracked changes (all <w:del> then all <w:ins>)
    // instead of alternating word-by-word del/ins pairs.
    const reorderedAtoms = groupDeletionsBeforeInsertions(mergedAtoms);
    for (const atom of reorderedAtoms) {
        const handler = ATOM_HANDLERS[atom.correlationStatus];
        const result = handler(atom, ctx);
        // Update position tracking based on handler result
        if (result.newLastRun !== undefined) {
            ctx.lastProcessedRun = result.newLastRun;
        }
        if (result.newLastRevisedRunAnchor !== undefined) {
            ctx.lastRevisedRunAnchor = result.newLastRevisedRunAnchor;
        }
        if (result.newLastParagraph !== undefined) {
            ctx.lastProcessedParagraph = result.newLastParagraph;
        }
        if (result.newLastParagraphIndex !== undefined) {
            ctx.lastParagraphIndex = result.newLastParagraphIndex;
        }
    }
    finalizeCreatedParagraphTrailingBookmarks(ctx);
    return ctx;
}
function finalizeCreatedParagraphTrailingBookmarks(ctx) {
    for (const [paraIdx, markers] of ctx.createdParagraphTrailingBookmarks.entries()) {
        if (markers.length === 0)
            continue;
        const paragraph = ctx.createdParagraphs.get(paraIdx);
        if (!paragraph)
            continue;
        let anchor = ctx.createdParagraphLastRun.get(paraIdx) ?? null;
        if (!anchor) {
            const pPr = findChildByTagName(paragraph, 'w:pPr');
            const kids = childElements(paragraph);
            const leadingBookmark = [...kids]
                .reverse()
                .find((c) => c.tagName === 'w:bookmarkStart') ?? null;
            anchor = leadingBookmark ?? pPr;
        }
        if (!anchor) {
            for (const marker of markers) {
                paragraph.appendChild(marker);
            }
            continue;
        }
        let current = anchor;
        for (const marker of markers) {
            insertAfterElement(current, marker);
            current = marker;
        }
        ctx.createdParagraphLastRun.set(paraIdx, current);
    }
}
/**
 * Apply whole-paragraph revision markers (w:pPr/w:rPr) based on merged atoms.
 *
 * This intentionally runs as a post-pass so the inplace algorithm can keep its
 * fine-grained run edits while still enforcing Word/Aspose paragraph invariants.
 */
function applyWholeParagraphRevisionMarkers(mergedAtoms, ctx) {
    const atomsByPara = new Map();
    for (const atom of mergedAtoms) {
        if (atom.paragraphIndex === undefined)
            continue;
        const list = atomsByPara.get(atom.paragraphIndex) ?? [];
        list.push(atom);
        atomsByPara.set(atom.paragraphIndex, list);
    }
    for (const [paraIdx, atoms] of atomsByPara.entries()) {
        if (isEntireParagraphAtomsWithStatus(atoms, CorrelationStatus.Inserted)) {
            const para = ctx.unifiedParaToElement.get(paraIdx);
            if (para) {
                wrapParagraphAsInserted(para, ctx.author, ctx.dateStr, ctx.state);
            }
            continue;
        }
        if (isEntireParagraphAtomsWithStatus(atoms, CorrelationStatus.Deleted)) {
            const para = ctx.createdParagraphs.get(paraIdx) ?? ctx.unifiedParaToElement.get(paraIdx);
            if (para) {
                wrapParagraphAsDeleted(para, ctx.author, ctx.dateStr, ctx.state);
            }
        }
    }
}
/**
 * Merge adjacent sibling track-change wrappers (<w:ins>/<w:del>) to reduce
 * Word UI fragmentation (one accept/reject per word/run).
 *
 * We only merge wrappers that share the same author+date to avoid conflating
 * distinct revisions.
 */
function mergeAdjacentTrackChangeSiblings(root) {
    function traverse(node) {
        const children = childElements(node);
        if (children.length < 2) {
            // Still recurse into children
            for (const child of childElements(node))
                traverse(child);
            return;
        }
        for (let i = 0; i < children.length - 1;) {
            const a = children[i];
            const b = children[i + 1];
            if (a.tagName === b.tagName && TRACK_CHANGE_WRAPPERS.has(a.tagName) &&
                a.getAttribute('w:author') === b.getAttribute('w:author') &&
                a.getAttribute('w:date') === b.getAttribute('w:date')) {
                // Absorb b's children into a
                while (b.firstChild)
                    a.appendChild(b.firstChild);
                node.removeChild(b);
                // Remove b from our local children snapshot and don't increment i —
                // recheck a with its new next sibling.
                children.splice(i + 1, 1);
                continue;
            }
            i++;
        }
        // Recurse into current children (re-query after mutations)
        for (const child of childElements(node)) {
            traverse(child);
        }
    }
    traverse(root);
}
// =============================================================================
// Bug 1: Suppress field-adjacent false no-op del/ins pairs (issue #42)
// =============================================================================
/**
 * Build a normalized content signature for a run's non-rPr children.
 * On the del side, maps w:delText → w:t and w:delInstrText → w:instrText
 * so that content from del wrappers can be compared to ins wrappers.
 */
function normalizeRunContentSignature(run, isDelSide) {
    const parts = [];
    for (let i = 0; i < run.childNodes.length; i++) {
        const child = run.childNodes[i];
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (el.tagName === 'w:rPr')
            continue;
        let tag = el.tagName;
        if (isDelSide) {
            if (tag === 'w:delText')
                tag = 'w:t';
            else if (tag === 'w:delInstrText')
                tag = 'w:instrText';
        }
        const text = el.textContent ?? '';
        parts.push(`<${tag}>${text}</${tag}>`);
    }
    return parts.join('');
}
/**
 * Check if an adjacent w:del + w:ins pair is a no-op (identical text and formatting).
 * Both wrappers must contain the same number of runs with matching rPr and content.
 */
export function isNoOpPair(del, ins) {
    const delRuns = childElements(del).filter(c => c.tagName === 'w:r');
    const insRuns = childElements(ins).filter(c => c.tagName === 'w:r');
    if (delRuns.length !== insRuns.length)
        return false;
    if (delRuns.length === 0)
        return false;
    for (let i = 0; i < delRuns.length; i++) {
        const delRun = delRuns[i];
        const insRun = insRuns[i];
        // Compare formatting via canonical rPr comparison
        const delRPr = findChildByTagName(delRun, 'w:rPr');
        const insRPr = findChildByTagName(insRun, 'w:rPr');
        if (!areRunPropertiesEqual(delRPr ?? null, insRPr ?? null))
            return false;
        // Compare content structure (text, tabs, breaks, field chars, etc.)
        const delSig = normalizeRunContentSignature(delRun, true);
        const insSig = normalizeRunContentSignature(insRun, false);
        if (delSig !== insSig)
            return false;
    }
    return true;
}
/**
 * Suppress no-op del/ins pairs — adjacent w:del + w:ins wrappers where the
 * content and formatting are identical. These arise from field-adjacent atoms
 * that are false-positive changes.
 *
 * When a no-op is detected, both wrappers are unwrapped, leaving the ins-side
 * runs as plain (non-tracked) children. The del-side runs are removed.
 */
export function suppressNoOpChangePairs(root) {
    function traverse(node) {
        const children = childElements(node);
        for (let i = 0; i < children.length - 1;) {
            const a = children[i];
            const b = children[i + 1];
            if (a.tagName === 'w:del' && b.tagName === 'w:ins' && isNoOpPair(a, b)) {
                // Remove the del wrapper and its content entirely
                node.removeChild(a);
                // Unwrap the ins wrapper — promote its children to the parent
                unwrapElement(b);
                // Re-snapshot children after mutation
                children.splice(i, 2, ...childElements(node).slice(i));
                // Don't increment — recheck from same position
                continue;
            }
            i++;
        }
        // Recurse into current children (re-query after mutations)
        for (const child of childElements(node)) {
            traverse(child);
        }
    }
    traverse(root);
}
// =============================================================================
// Bug 2: Merge whitespace-bridged track change siblings (issue #42)
// =============================================================================
/**
 * Narrow whitespace predicate for bridging: returns true only if a w:r element's
 * visible children are exclusively w:t elements with whitespace-only text content.
 * Excludes w:tab, w:br, w:cr which have layout significance.
 */
function isInlineWhitespaceOnlyRun(run) {
    if (run.tagName !== 'w:r')
        return false;
    let hasVisibleChild = false;
    for (let i = 0; i < run.childNodes.length; i++) {
        const child = run.childNodes[i];
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (el.tagName === 'w:rPr')
            continue;
        // Only w:t with whitespace-only text is allowed
        if (el.tagName === 'w:t') {
            const text = el.textContent ?? '';
            if (text.length === 0 || !/^\s+$/.test(text))
                return false;
            hasVisibleChild = true;
            continue;
        }
        // Any other visible element (w:tab, w:br, w:cr, w:fldChar, etc.) disqualifies
        return false;
    }
    return hasVisibleChild;
}
/**
 * Merge track-change wrappers (w:del or w:ins) that are separated by a
 * whitespace-only run. This groups "word-by-word" tracked changes into
 * contiguous blocks for cleaner presentation.
 *
 * For w:del: clones the whitespace run, converts w:t→w:delText, and absorbs
 * both the whitespace and the second wrapper's children into the first wrapper.
 *
 * For w:ins: moves the whitespace run into the first wrapper, then absorbs
 * the second wrapper's children.
 *
 * Both projections (Accept All, Reject All) remain correct because each
 * wrapper independently contains the whitespace it needs.
 */
export function mergeWhitespaceBridgedTrackChanges(root) {
    function traverse(node) {
        const children = childElements(node);
        for (let i = 0; i < children.length - 2;) {
            const a = children[i];
            const mid = children[i + 1];
            const b = children[i + 2];
            // Check: same track-change tag, same author/date, with whitespace-only run between.
            // Only bridge w:ins and w:moveTo — bridging w:del is unsafe because the
            // intervening whitespace is Equal content needed by the accept projection.
            const bridgeableTags = new Set(['w:ins', 'w:moveTo']);
            if (a.tagName === b.tagName &&
                bridgeableTags.has(a.tagName) &&
                a.getAttribute('w:author') === b.getAttribute('w:author') &&
                a.getAttribute('w:date') === b.getAttribute('w:date') &&
                isInlineWhitespaceOnlyRun(mid)) {
                // Move the whitespace run into the first wrapper, then absorb second's children
                a.appendChild(mid);
                while (b.firstChild)
                    a.appendChild(b.firstChild);
                node.removeChild(b);
                // mid was moved into a, b removed from parent — splice both from snapshot
                children.splice(i + 1, 2);
                // Don't increment — recheck a with new next sibling
                continue;
            }
            i++;
        }
        // Recurse into current children (re-query after mutations)
        for (const child of childElements(node)) {
            traverse(child);
        }
    }
    traverse(root);
}
// =============================================================================
// Bug 2b: Coalesce del/ins pair chains across whitespace (issue #42)
// =============================================================================
/**
 * Convert w:t → w:delText and w:instrText → w:delInstrText within a run,
 * preserving xml:space attributes. Used for cloning whitespace runs into
 * w:del wrappers during pair-chain coalescing.
 */
function convertRunTextToDelText(run) {
    for (let i = 0; i < run.childNodes.length; i++) {
        const child = run.childNodes[i];
        if (child.nodeType !== 1)
            continue;
        const el = child;
        if (el.tagName === 'w:t' || el.tagName === 'w:instrText') {
            const newTag = el.tagName === 'w:t' ? 'w:delText' : 'w:delInstrText';
            const newEl = createEl(newTag);
            // Copy text content
            while (el.firstChild)
                newEl.appendChild(el.firstChild);
            // Copy attributes (including xml:space="preserve")
            for (let j = 0; j < el.attributes.length; j++) {
                const attr = el.attributes[j];
                newEl.setAttribute(attr.name, attr.value);
            }
            run.replaceChild(newEl, el);
        }
    }
}
/**
 * Coalesce alternating del/ins pair chains separated by whitespace-only runs
 * into single grouped del + ins wrappers.
 *
 * Pattern: [w:del, w:ins, ws-segment..., w:del, w:ins, ws-segment..., w:del, w:ins]
 *
 * For each whitespace segment between consecutive [del, ins] pairs:
 * 1. Clone each ws-run → convert to delText → append to first del
 * 2. Clone each ws-run → keep as w:t → append to first ins
 * 3. Move nextDel's children into first del
 * 4. Move nextIns's children into first ins
 * 5. Remove original ws-runs, empty nextDel, empty nextIns from parent
 *
 * Safety invariants:
 * - Only bridges when both del AND ins absorb the whitespace (both projections correct)
 * - Incomplete tail [del, ins, ws, del] (no trailing ins) → stop chain, don't bridge
 * - All wrappers in chain must share same w:author and w:date
 */
export function coalesceDelInsPairChains(root) {
    function traverse(node) {
        const children = childElements(node);
        for (let i = 0; i < children.length - 1;) {
            const firstDel = children[i];
            const firstIns = children[i + 1];
            // Must start with a [del, ins] pair
            if (firstDel.tagName !== 'w:del' || firstIns.tagName !== 'w:ins') {
                i++;
                continue;
            }
            const author = firstDel.getAttribute('w:author');
            const date = firstDel.getAttribute('w:date');
            // All four must match author/date
            if (firstIns.getAttribute('w:author') !== author ||
                firstIns.getAttribute('w:date') !== date) {
                i++;
                continue;
            }
            // Try to extend the chain by absorbing subsequent [ws..., del, ins] triples
            let cursor = i + 2; // position after firstIns
            let chainExtended = false;
            while (cursor < children.length) {
                // Collect whitespace segment (1..N consecutive whitespace-only runs)
                const wsStart = cursor;
                while (cursor < children.length && isInlineWhitespaceOnlyRun(children[cursor])) {
                    cursor++;
                }
                const wsEnd = cursor;
                const wsCount = wsEnd - wsStart;
                if (wsCount === 0)
                    break; // No whitespace → end of chain
                // Must have a complete [del, ins] pair after the whitespace
                if (cursor + 1 >= children.length)
                    break; // Not enough elements
                const nextDel = children[cursor];
                const nextIns = children[cursor + 1];
                if (nextDel.tagName !== 'w:del' || nextIns.tagName !== 'w:ins')
                    break;
                // Author/date must match
                if (nextDel.getAttribute('w:author') !== author ||
                    nextDel.getAttribute('w:date') !== date ||
                    nextIns.getAttribute('w:author') !== author ||
                    nextIns.getAttribute('w:date') !== date)
                    break;
                // All conditions met — absorb this [ws..., del, ins] into the first pair
                // 1. Clone whitespace runs into del (as delText) and ins (as w:t)
                for (let w = wsStart; w < wsEnd; w++) {
                    const wsRun = children[w];
                    const delClone = wsRun.cloneNode(true);
                    convertRunTextToDelText(delClone);
                    firstDel.appendChild(delClone);
                    const insClone = wsRun.cloneNode(true);
                    firstIns.appendChild(insClone);
                }
                // 2. Move nextDel's children into firstDel
                while (nextDel.firstChild)
                    firstDel.appendChild(nextDel.firstChild);
                // 3. Move nextIns's children into firstIns
                while (nextIns.firstChild)
                    firstIns.appendChild(nextIns.firstChild);
                // 4. Remove ws-runs, nextDel, nextIns from parent
                for (let w = wsStart; w < wsEnd; w++) {
                    node.removeChild(children[w]);
                }
                node.removeChild(nextDel);
                node.removeChild(nextIns);
                // 5. Splice removed elements from children snapshot
                // Remove wsCount + 2 elements starting at wsStart
                children.splice(wsStart, wsCount + 2);
                // Reset cursor to continue checking after firstIns
                cursor = wsStart;
                chainExtended = true;
            }
            // Advance past the (possibly extended) [del, ins] pair
            i += chainExtended ? 2 : 1;
            // If no chain was formed, we only skip the del (i++ already happened above
            // for the non-chain case), but if it was a chain we skip both del+ins.
            // Actually: if chain wasn't extended, we need to check if firstDel+firstIns
            // alone should advance by 2 or by 1. Since they ARE a del+ins pair but
            // no chain formed, skip both.
            if (!chainExtended) {
                i++; // skip the ins too (total i += 2 from the earlier i++)
            }
        }
        // Recurse into current children (re-query after mutations)
        for (const child of childElements(node)) {
            traverse(child);
        }
    }
    traverse(root);
}
// Re-export for convenience
export { createRevisionIdState };
//# sourceMappingURL=inPlaceModifier.js.map