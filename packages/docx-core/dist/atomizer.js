/**
 * Atomizer Module
 *
 * Provides factory functions for creating ComparisonUnitAtom instances.
 * Implements the core atomization logic from WmlComparer.
 *
 * @see WmlComparer.cs ComparisonUnitAtom constructor (lines 2314-2343)
 */
import { createHash } from 'crypto';
import { DOMParser } from '@xmldom/xmldom';
import { CorrelationStatus, } from './core-types.js';
import { getLeafText, setLeafText, childElements, findChildByTagName, } from './primitives/index.js';
// =============================================================================
// Shared synthetic document for creating virtual elements
// =============================================================================
/**
 * A shared document used to create synthetic/virtual DOM elements.
 * These elements are not part of any real parsed document.
 */
const SYNTHETIC_DOC = new DOMParser().parseFromString('<root/>', 'application/xml');
// =============================================================================
// SHA1 Hashing
// =============================================================================
/**
 * Calculate SHA1 hash of a string.
 *
 * Used for quick equality checking of comparison units.
 *
 * @param content - The string content to hash
 * @returns Hexadecimal SHA1 hash string
 */
export function sha1(content) {
    return createHash('sha1').update(content, 'utf8').digest('hex');
}
/**
 * Attributes that should be excluded from hashing for certain elements.
 *
 * - xml:space: A whitespace preservation hint that doesn't affect content.
 *   Documents may have this attribute present on some w:t elements and absent
 *   on others with identical text, causing spurious hash mismatches.
 */
const IGNORED_HASH_ATTRIBUTES = new Set(['xml:space']);
/**
 * Calculate SHA1 hash for a WmlElement.
 *
 * Includes tag name, attributes, and text content for uniqueness.
 * Excludes presentation-only attributes like xml:space that don't affect content.
 *
 * @param element - The element to hash
 * @returns Hexadecimal SHA1 hash string
 */
export function hashElement(element) {
    const parts = [element.tagName];
    // Sort attributes for deterministic hashing, excluding presentation-only attributes
    const attrs = [];
    for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attrs.push([attr.name, attr.value]);
    }
    const sortedAttrs = attrs
        .filter(([key]) => !IGNORED_HASH_ATTRIBUTES.has(key))
        .sort(([a], [b]) => a.localeCompare(b));
    for (const [key, value] of sortedAttrs) {
        parts.push(`${key}=${value}`);
    }
    const leafText = getLeafText(element);
    if (leafText !== undefined) {
        parts.push(leafText);
    }
    return sha1(parts.join('|'));
}
// =============================================================================
// Revision Tracking Detection
// =============================================================================
/**
 * Revision tracking element tag names.
 */
const REVISION_TRACKING_TAGS = new Set(['w:ins', 'w:del', 'w:moveFrom', 'w:moveTo']);
/**
 * Find a revision tracking element in the ancestor chain.
 *
 * Searches ancestors from nearest to root for w:ins, w:del, w:moveFrom, or w:moveTo.
 *
 * @param ancestors - Ancestor elements from root to parent
 * @returns The revision tracking element if found, undefined otherwise
 */
export function findRevisionTrackingElement(ancestors) {
    // Search from nearest ancestor to root
    for (let i = ancestors.length - 1; i >= 0; i--) {
        const ancestor = ancestors[i];
        if (ancestor && REVISION_TRACKING_TAGS.has(ancestor.tagName)) {
            return ancestor;
        }
    }
    return undefined;
}
/**
 * Determine initial correlation status from revision tracking element.
 *
 * @param revTrackElement - The revision tracking element (if any)
 * @returns Initial correlation status
 */
export function getStatusFromRevisionTracking(revTrackElement) {
    if (!revTrackElement) {
        return CorrelationStatus.Unknown;
    }
    switch (revTrackElement.tagName) {
        case 'w:ins':
            return CorrelationStatus.Inserted;
        case 'w:del':
            return CorrelationStatus.Deleted;
        case 'w:moveFrom':
            return CorrelationStatus.MovedSource;
        case 'w:moveTo':
            return CorrelationStatus.MovedDestination;
        default:
            return CorrelationStatus.Unknown;
    }
}
// =============================================================================
// Ancestor Unid Extraction
// =============================================================================
/**
 * Extract Unid attributes from ancestor elements.
 *
 * WmlComparer uses w:Unid attributes to correlate elements between documents.
 *
 * @param ancestors - Ancestor elements from root to parent
 * @returns Array of Unid values found in ancestors
 */
export function extractAncestorUnids(ancestors) {
    const unids = [];
    for (const ancestor of ancestors) {
        const unid = ancestor.getAttribute('w:Unid');
        if (unid) {
            unids.push(unid);
        }
    }
    return unids;
}
// =============================================================================
// Leaf Node Detection
// =============================================================================
/**
 * Tag names that represent leaf nodes in the atomization tree.
 */
const LEAF_NODE_TAGS = new Set([
    'w:t', // Text
    'w:br', // Break
    'w:cr', // Carriage return
    'w:tab', // Tab character
    'w:sym', // Symbol
    'w:softHyphen', // Soft hyphen
    'w:noBreakHyphen', // Non-breaking hyphen
    'w:fldChar', // Field character
    'w:instrText', // Field instruction text
    'w:delText', // Deleted text
    'w:dayShort', // Date field short day
    'w:dayLong', // Date field long day
    'w:monthShort', // Date field short month
    'w:monthLong', // Date field long month
    'w:yearShort', // Date field short year
    'w:yearLong', // Date field long year
    'w:annotationRef', // Annotation reference
    'w:footnoteRef', // Footnote reference marker
    'w:endnoteRef', // Endnote reference marker
    'w:footnoteReference', // Footnote reference
    'w:endnoteReference', // Endnote reference
    'w:separator', // Separator
    'w:continuationSeparator', // Continuation separator
    'w:pgNum', // Page number
    'w:drawing', // Drawing (treat as atomic)
    'w:pict', // Picture (VML)
    'w:object', // Embedded object
    'mc:AlternateContent', // Alternate content
]);
/**
 * Special tag name for empty paragraph boundary atoms.
 * These atoms are created for paragraphs that have no content (only w:pPr).
 */
export const EMPTY_PARAGRAPH_TAG = '__emptyParagraph__';
/**
 * Check if an element is a leaf node for atomization.
 *
 * Leaf nodes are the smallest units that can be compared.
 *
 * @param element - The element to check
 * @returns True if this is a leaf node
 */
export function isLeafNode(element) {
    return LEAF_NODE_TAGS.has(element.tagName);
}
/**
 * Create a ComparisonUnitAtom from a leaf element.
 *
 * Replicates the C# ComparisonUnitAtom constructor logic:
 * 1. Finds revision tracking elements in ancestors
 * 2. Sets initial correlation status based on revision type
 * 3. Extracts ancestor Unids for correlation
 * 4. Calculates SHA1 hash for equality checking
 *
 * @param options - Options containing element, ancestors, and part
 * @returns A new ComparisonUnitAtom
 *
 * @see WmlComparer.cs lines 2314-2343
 */
export function createComparisonUnitAtom(options) {
    const { contentElement, ancestors, part } = options;
    // Find revision tracking element in ancestors
    const revTrackElement = findRevisionTrackingElement(ancestors);
    // Determine initial correlation status
    const correlationStatus = getStatusFromRevisionTracking(revTrackElement);
    // Extract Unids from ancestors
    const ancestorUnids = extractAncestorUnids(ancestors);
    // Calculate SHA1 hash for the atom
    const sha1Hash = hashElement(contentElement);
    return {
        contentElement,
        ancestorElements: [...ancestors], // Copy to avoid mutation
        ancestorUnids,
        part,
        revTrackElement,
        sha1Hash,
        correlationStatus,
    };
}
// =============================================================================
// Tree Atomization
// =============================================================================
/**
 * Check if a paragraph element is empty (has no content, only properties).
 *
 * Empty paragraphs have only w:pPr children, no w:r (run) elements.
 */
function isEmptyParagraph(node) {
    if (node.tagName !== 'w:p')
        return false;
    const kids = childElements(node);
    if (kids.length === 0)
        return true;
    // Check if all children are w:pPr (no runs)
    for (const child of kids) {
        if (child.tagName !== 'w:pPr') {
            return false;
        }
    }
    return true;
}
/**
 * Create an empty paragraph boundary atom with context-aware hash.
 *
 * These atoms represent empty paragraphs that have no text content,
 * ensuring they are preserved during document reconstruction.
 *
 * The hash includes the previous content hash to ensure empty paragraphs
 * only match if they're at the same logical position in the document.
 *
 * @param paragraphElement - The w:p element
 * @param ancestors - Ancestor elements from root to parent
 * @param part - The OPC part
 * @param state - Atomization state with context information
 */
function createEmptyParagraphAtomWithContext(paragraphElement, ancestors, part, state) {
    // Create a virtual element to represent the empty paragraph
    const virtualElement = SYNTHETIC_DOC.createElement(EMPTY_PARAGRAPH_TAG);
    // Find revision tracking element in ancestors
    const revTrackElement = findRevisionTrackingElement(ancestors);
    // Determine initial correlation status
    const correlationStatus = getStatusFromRevisionTracking(revTrackElement);
    // Create a hash that uniquely identifies this empty paragraph
    // Include:
    // 1. pPr content for paragraph properties
    // 2. lastContentHash for context (what content precedes this empty paragraph)
    // 3. emptyParagraphCount for consecutive empty paragraphs with same context
    const pPr = findChildByTagName(paragraphElement, 'w:pPr');
    const pPrHash = pPr ? hashElement(pPr) : 'no-pPr';
    const contextHash = state.lastContentHash || 'document-start';
    const hashContent = `empty-paragraph:${contextHash}:${state.emptyParagraphCount}:${pPrHash}`;
    return {
        contentElement: virtualElement,
        ancestorElements: [...ancestors, paragraphElement],
        ancestorUnids: extractAncestorUnids(ancestors),
        part,
        revTrackElement,
        sha1Hash: sha1(hashContent),
        correlationStatus,
        isEmptyParagraph: true, // Mark this as an empty paragraph atom
    };
}
/**
 * Internal recursive atomization function with state tracking.
 */
function atomizeTreeInternal(node, ancestors, part, state, options) {
    const atoms = [];
    if (isLeafNode(node)) {
        const atom = createComparisonUnitAtom({
            contentElement: options.cloneLeafNodes ? node.cloneNode(true) : node,
            ancestors,
            part,
        });
        atoms.push(atom);
        // Update last content hash for context-aware empty paragraph matching
        state.lastContentHash = atom.sha1Hash;
    }
    else if (isEmptyParagraph(node)) {
        // Create empty paragraph atom with context-aware hash
        atoms.push(createEmptyParagraphAtomWithContext(node, ancestors, part, state));
        state.emptyParagraphCount++;
    }
    else {
        for (const child of childElements(node)) {
            atoms.push(...atomizeTreeInternal(child, [...ancestors, node], part, state, options));
        }
    }
    return atoms;
}
/**
 * Atomize a document tree into a flat list of ComparisonUnitAtoms.
 *
 * Recursively traverses the tree, creating atoms for each leaf node.
 * Also creates special atoms for empty paragraphs to preserve document structure.
 *
 * @param node - The current node in the tree
 * @param ancestors - Ancestor elements from root to parent of node
 * @param part - The OPC part this tree belongs to
 * @returns Array of ComparisonUnitAtoms from leaf nodes
 */
export function atomizeTree(node, ancestors, part, options = {}) {
    const normalizedOptions = {
        cloneLeafNodes: options.cloneLeafNodes ?? false,
        mergeAcrossRuns: options.mergeAcrossRuns ?? true,
        mergePunctuationAcrossRuns: options.mergePunctuationAcrossRuns ?? true,
        splitTextIntoWords: options.splitTextIntoWords ?? true,
    };
    const state = {
        emptyParagraphCount: 0,
        lastContentHash: '',
    };
    const rawAtoms = atomizeTreeInternal(node, ancestors, part, state, normalizedOptions);
    // Step 1: Collapse field sequences into single atoms based on visible text
    // This allows matching between hardcoded text and field references
    const fieldCollapsedAtoms = collapseFieldSequences(rawAtoms);
    // Step 2: Merge contiguous text atoms with same formatting
    // This normalizes different w:t split boundaries
    const mergedAtoms = mergeContiguousTextAtoms(fieldCollapsedAtoms, normalizedOptions);
    // Step 3: Split merged atoms at word boundaries for finer-grained comparison
    // This enables word-level diffing within paragraphs
    const wordSplitAtoms = normalizedOptions.splitTextIntoWords
        ? splitAtomsIntoWords(mergedAtoms)
        : mergedAtoms;
    // Step 4: Merge punctuation-only atoms with preceding text
    // This handles "Conduct" + "," vs "Conduct," split differences
    // Must run AFTER word split since that's when punctuation becomes separate atoms
    const atoms = mergePunctuationAtoms(wordSplitAtoms, normalizedOptions);
    console.log(`[DEBUG] atomizeTree: created ${rawAtoms.length} atoms, field-collapsed to ${fieldCollapsedAtoms.length}, merged to ${mergedAtoms.length}, word-split to ${wordSplitAtoms.length}, punct-merged to ${atoms.length}, ${state.emptyParagraphCount} empty paragraphs`);
    return { atoms, emptyParagraphCount: state.emptyParagraphCount };
}
/**
 * Get all ancestors of a node by following parent references.
 *
 * @param node - The node to get ancestors for
 * @returns Array of ancestors from root to immediate parent
 */
export function getAncestors(node) {
    const ancestors = [];
    let current = node.parentNode;
    while (current && current.nodeType === 1 /* ELEMENT_NODE */) {
        ancestors.unshift(current);
        current = current.parentNode;
    }
    return ancestors;
}
/**
 * Assign paragraph indices to atoms based on their w:p ancestors.
 *
 * This enables paragraph grouping in the document reconstructor when
 * merging atoms from different source trees (original vs revised).
 *
 * @param atoms - Array of atoms to assign indices to
 */
export function assignParagraphIndices(atoms) {
    const paragraphToIndex = new Map();
    let nextIndex = 0;
    for (const atom of atoms) {
        // Find the w:p ancestor
        const pAncestor = atom.ancestorElements.find((a) => a.tagName === 'w:p');
        if (pAncestor) {
            // Get or assign index for this paragraph
            let index = paragraphToIndex.get(pAncestor);
            if (index === undefined) {
                index = nextIndex++;
                paragraphToIndex.set(pAncestor, index);
            }
            atom.paragraphIndex = index;
        }
    }
}
// =============================================================================
// Field Sequence Collapsing
// =============================================================================
/**
 * Special tag name for collapsed field atoms.
 * These represent Word field codes (REF, PAGEREF, etc.) collapsed to their visible result.
 */
export const COLLAPSED_FIELD_TAG = '__collapsedField__';
/**
 * Check if an atom is a field begin marker.
 */
function isFieldBegin(atom) {
    return (atom.contentElement.tagName === 'w:fldChar' &&
        atom.contentElement.getAttribute('w:fldCharType') === 'begin');
}
/**
 * Check if an atom is a field separate marker.
 */
function isFieldSeparate(atom) {
    return (atom.contentElement.tagName === 'w:fldChar' &&
        atom.contentElement.getAttribute('w:fldCharType') === 'separate');
}
/**
 * Check if an atom is a field end marker.
 */
function isFieldEnd(atom) {
    return (atom.contentElement.tagName === 'w:fldChar' &&
        atom.contentElement.getAttribute('w:fldCharType') === 'end');
}
/**
 * Extract visible text from a sequence of atoms (field result portion).
 * Only includes w:t elements, ignoring field markers and instructions.
 */
function extractVisibleText(atoms) {
    return atoms
        .filter((a) => a.contentElement.tagName === 'w:t')
        .map((a) => getLeafText(a.contentElement) ?? '')
        .join('');
}
/**
 * Check if a field spans multiple paragraphs.
 * Multi-paragraph fields (like TOC) should not be collapsed.
 */
function fieldSpansMultipleParagraphs(fieldAtoms) {
    const paragraphs = new Set();
    for (const atom of fieldAtoms) {
        const para = atom.ancestorElements.find((e) => e.tagName === 'w:p');
        if (para) {
            paragraphs.add(para);
            if (paragraphs.size > 1) {
                return true;
            }
        }
    }
    return false;
}
/**
 * Collapse field sequences into single atoms based on visible text.
 *
 * Word fields consist of:
 * - w:fldChar[begin] - field start
 * - w:instrText - field instruction (e.g., "REF _Ref123 \h")
 * - w:fldChar[separate] - separates instruction from result
 * - w:t (one or more) - visible result text
 * - w:fldChar[end] - field end
 *
 * This function collapses each field sequence into a single atom whose hash
 * is based only on the visible text. This allows matching between:
 * - Hardcoded text: "2.6"
 * - Field reference: [REF field]2.6[/field]
 *
 * Both will produce atoms with the same hash if the visible text matches.
 *
 * NOTE: Multi-paragraph fields (like TOC, INDEX) are NOT collapsed because
 * they would lose paragraph structure information.
 *
 * @param atoms - Array of atoms from atomization
 * @returns Array with field sequences collapsed to single atoms
 */
export function collapseFieldSequences(atoms) {
    if (atoms.length === 0)
        return atoms;
    const result = [];
    let i = 0;
    while (i < atoms.length) {
        const atom = atoms[i];
        if (isFieldBegin(atom)) {
            // Found field start - collect until matching end
            const fieldAtoms = [atom];
            let depth = 1;
            let separatorIndex = -1;
            i++;
            while (i < atoms.length && depth > 0) {
                const current = atoms[i];
                fieldAtoms.push(current);
                if (isFieldBegin(current)) {
                    depth++;
                }
                else if (isFieldEnd(current)) {
                    depth--;
                }
                else if (isFieldSeparate(current) && depth === 1) {
                    // Track separator position for the outermost field
                    separatorIndex = fieldAtoms.length - 1;
                }
                i++;
            }
            // Check if field spans multiple paragraphs (like TOC, INDEX)
            // If so, don't collapse - preserve paragraph structure
            if (fieldSpansMultipleParagraphs(fieldAtoms)) {
                // Pass through all field atoms unchanged
                result.push(...fieldAtoms);
                continue;
            }
            // Extract visible text from the field result (after separator)
            let visibleText;
            if (separatorIndex >= 0) {
                // Get text between separator and end (exclusive of markers)
                const resultAtoms = fieldAtoms.slice(separatorIndex + 1, -1);
                visibleText = extractVisibleText(resultAtoms);
            }
            else {
                // No separator - might be a field with no result yet, use instruction
                visibleText = extractVisibleText(fieldAtoms);
            }
            // Create a collapsed field atom with the visible text
            const firstAtom = fieldAtoms[0];
            // Use w:t so it can merge with adjacent text
            const virtualElement = SYNTHETIC_DOC.createElement('w:t');
            setLeafText(virtualElement, visibleText);
            const collapsedAtom = {
                contentElement: virtualElement,
                ancestorElements: [...firstAtom.ancestorElements],
                ancestorUnids: firstAtom.ancestorUnids,
                part: firstAtom.part,
                revTrackElement: firstAtom.revTrackElement,
                sha1Hash: hashElement(virtualElement),
                correlationStatus: firstAtom.correlationStatus,
                // Store original atoms for document reconstruction
                collapsedFieldAtoms: fieldAtoms,
            };
            result.push(collapsedAtom);
        }
        else {
            // Not a field - pass through unchanged
            result.push(atom);
            i++;
        }
    }
    return result;
}
// =============================================================================
// Word-Level Splitting
// =============================================================================
/**
 * Split a w:t atom into word-level atoms.
 *
 * This enables finer-grained comparison when text is stored in single w:t elements.
 * For example, "Hello World" becomes ["Hello", " ", "World"].
 *
 * Preserves whitespace as separate atoms to maintain spacing.
 *
 * @param atom - A w:t atom to split
 * @returns Array of word-level atoms (or original atom if not w:t)
 */
function splitAtomIntoWords(atom) {
    // Only split w:t elements
    if (atom.contentElement.tagName !== 'w:t') {
        return [atom];
    }
    // Don't split collapsed fields - they should stay as-is
    if (atom.collapsedFieldAtoms) {
        return [atom];
    }
    const text = getLeafText(atom.contentElement) ?? '';
    // Don't split short text or single words
    if (text.length <= 1 || !text.includes(' ')) {
        return [atom];
    }
    // Split into words and whitespace, preserving both
    // Uses regex to split on word boundaries while keeping whitespace
    const parts = text.split(/(\s+)/);
    if (parts.length <= 1) {
        return [atom];
    }
    const result = [];
    for (const part of parts) {
        if (part === '')
            continue;
        // Create a new element for this word/whitespace
        const wordElement = SYNTHETIC_DOC.createElement('w:t');
        // Copy attributes from the original content element
        for (let i = 0; i < atom.contentElement.attributes.length; i++) {
            const attr = atom.contentElement.attributes[i];
            wordElement.setAttribute(attr.name, attr.value);
        }
        setLeafText(wordElement, part);
        // Create atom for this word
        const wordAtom = {
            contentElement: wordElement,
            ancestorElements: atom.ancestorElements,
            ancestorUnids: atom.ancestorUnids,
            part: atom.part,
            revTrackElement: atom.revTrackElement,
            sha1Hash: hashElement(wordElement),
            correlationStatus: atom.correlationStatus,
            paragraphIndex: atom.paragraphIndex,
            // Track that this came from a split atom for potential later merge
            splitFromAtom: atom,
        };
        result.push(wordAtom);
    }
    return result;
}
/**
 * Split all w:t atoms into word-level atoms.
 *
 * @param atoms - Array of atoms
 * @returns Array with w:t atoms split into words
 */
export function splitAtomsIntoWords(atoms) {
    const result = [];
    for (const atom of atoms) {
        result.push(...splitAtomIntoWords(atom));
    }
    return result;
}
// =============================================================================
// Atom Boundary Normalization
// =============================================================================
/**
 * Get the run properties (w:rPr) from an atom's run ancestor.
 */
function getRunProperties(atom) {
    const run = atom.ancestorElements.find((e) => e.tagName === 'w:r');
    if (!run)
        return undefined;
    return findChildByTagName(run, 'w:rPr') ?? undefined;
}
/**
 * Compute a deep hash of an element including its children.
 */
function hashElementDeep(element) {
    const parts = [element.tagName];
    // Sort attributes for deterministic hashing
    const attrs = [];
    for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attrs.push([attr.name, attr.value]);
    }
    const sortedAttrs = attrs.sort(([a], [b]) => a.localeCompare(b));
    for (const [key, value] of sortedAttrs) {
        parts.push(`${key}=${value}`);
    }
    const leafText = getLeafText(element);
    if (leafText !== undefined) {
        parts.push(leafText);
    }
    // Recursively hash children
    for (const child of childElements(element)) {
        parts.push(hashElementDeep(child));
    }
    return sha1(parts.join('|'));
}
/**
 * Compare two w:rPr elements for equivalence.
 * Returns true if they have the same formatting properties.
 */
function runPropertiesEqual(a, b) {
    // Both undefined = equal (no formatting)
    if (!a && !b)
        return true;
    // One undefined = not equal
    if (!a || !b)
        return false;
    // Compare by deep hashing (includes children for w:rPr properties)
    return hashElementDeep(a) === hashElementDeep(b);
}
/**
 * Check if two atoms can be merged into one.
 *
 * Atoms can be merged if they:
 * - Are both w:t (text) elements
 * - Neither is a collapsed field (fields should stay as separate atoms for finer diff)
 * - Are in the same paragraph
 * - Have the same run formatting (w:rPr) OR are in the same run
 * - Have the same revision tracking status
 *
 * @param a - First atom
 * @param b - Second atom (immediately following a)
 * @returns True if atoms can be merged
 */
function canMergeAtoms(a, b, options) {
    // Only merge w:t elements
    if (a.contentElement.tagName !== 'w:t')
        return false;
    if (b.contentElement.tagName !== 'w:t')
        return false;
    // Never merge collapsed fields - they should stay as separate atoms for finer-grained diff
    if (a.collapsedFieldAtoms || b.collapsedFieldAtoms)
        return false;
    // Must be in the same paragraph
    const aPara = a.ancestorElements.find((e) => e.tagName === 'w:p');
    const bPara = b.ancestorElements.find((e) => e.tagName === 'w:p');
    if (aPara !== bPara)
        return false;
    // Must have same revision tracking status
    const aRevTag = a.revTrackElement?.tagName;
    const bRevTag = b.revTrackElement?.tagName;
    if (aRevTag !== bRevTag)
        return false;
    // Check if same run (fast path)
    const aRun = a.ancestorElements.find((e) => e.tagName === 'w:r');
    const bRun = b.ancestorElements.find((e) => e.tagName === 'w:r');
    if (aRun === bRun)
        return true;
    // Different runs - allow cross-run merge only if enabled.
    // (In inplace mode we disable this so each atom stays anchored to a real run.)
    if (!options.mergeAcrossRuns)
        return false;
    // Different runs - check if they have equivalent formatting
    const aRPr = getRunProperties(a);
    const bRPr = getRunProperties(b);
    return runPropertiesEqual(aRPr, bRPr);
}
/**
 * Merge source atom's text content into target atom.
 *
 * Concatenates text content and recomputes the hash.
 *
 * @param target - Atom to merge into
 * @param source - Atom to merge from
 */
function mergeIntoAtom(target, source) {
    // Concatenate text content
    const newText = (getLeafText(target.contentElement) ?? '') +
        (getLeafText(source.contentElement) ?? '');
    setLeafText(target.contentElement, newText);
    // Recompute hash
    target.sha1Hash = hashElement(target.contentElement);
}
/**
 * Check if an atom contains only punctuation.
 */
function isPunctuationOnlyAtom(atom) {
    if (atom.contentElement.tagName !== 'w:t')
        return false;
    const text = getLeafText(atom.contentElement) ?? '';
    // Match common punctuation that should attach to adjacent words
    return /^[,.:;!?'")\]}>]+$/.test(text);
}
/**
 * Check if two atoms can be merged for punctuation normalization.
 *
 * More permissive than canMergeAtoms - allows merging punctuation with
 * preceding text even if they're in different runs, as long as they're
 * in the same paragraph and have the same revision tracking status.
 */
function canMergePunctuation(a, b, options) {
    // Only merge w:t elements
    if (a.contentElement.tagName !== 'w:t')
        return false;
    if (b.contentElement.tagName !== 'w:t')
        return false;
    // B must be punctuation-only
    if (!isPunctuationOnlyAtom(b))
        return false;
    // Never merge collapsed fields
    if (a.collapsedFieldAtoms || b.collapsedFieldAtoms)
        return false;
    // Must be in the same paragraph
    const aPara = a.ancestorElements.find((e) => e.tagName === 'w:p');
    const bPara = b.ancestorElements.find((e) => e.tagName === 'w:p');
    if (aPara !== bPara)
        return false;
    // Must have same revision tracking status
    const aRevTag = a.revTrackElement?.tagName;
    const bRevTag = b.revTrackElement?.tagName;
    if (aRevTag !== bRevTag)
        return false;
    // A must end with a word character (not whitespace or punctuation)
    const aText = getLeafText(a.contentElement) ?? '';
    if (!/\w$/.test(aText))
        return false;
    // If cross-run punctuation merge is disabled, require same run.
    if (!options.mergePunctuationAcrossRuns) {
        const aRun = a.ancestorElements.find((e) => e.tagName === 'w:r');
        const bRun = b.ancestorElements.find((e) => e.tagName === 'w:r');
        if (aRun !== bRun)
            return false;
    }
    return true;
}
/**
 * Merge punctuation-only atoms with preceding text.
 *
 * This handles cases where documents have different w:t boundaries around
 * punctuation (e.g., "Conduct" + "," vs "Conduct,"). Punctuation is merged
 * with the preceding word regardless of run formatting differences.
 *
 * @param atoms - Array of atoms
 * @returns Atoms with punctuation merged into preceding text
 */
export function mergePunctuationAtoms(atoms, options = { mergePunctuationAcrossRuns: true }) {
    if (atoms.length === 0)
        return atoms;
    const result = [];
    for (const atom of atoms) {
        const prev = result[result.length - 1];
        if (prev && canMergePunctuation(prev, atom, options)) {
            // Merge punctuation into previous atom
            mergeIntoAtom(prev, atom);
        }
        else {
            result.push(atom);
        }
    }
    return result;
}
/**
 * Merge contiguous w:t atoms within the same run into single atoms.
 *
 * This normalization ensures that identical text split differently across
 * w:t elements in original vs revised documents will produce matching hashes.
 *
 * Example:
 *   Before: ["Def", "initions"] (2 atoms)
 *   After:  ["Definitions"] (1 atom)
 *
 * @param atoms - Array of atoms from atomization
 * @returns Normalized array with contiguous text atoms merged
 */
export function mergeContiguousTextAtoms(atoms, options = { mergeAcrossRuns: true }) {
    if (atoms.length === 0)
        return atoms;
    const result = [];
    for (const atom of atoms) {
        const prev = result[result.length - 1];
        // Only merge w:t elements in the same run
        if (prev && canMergeAtoms(prev, atom, options)) {
            // Merge text content into previous atom
            mergeIntoAtom(prev, atom);
        }
        else {
            result.push(atom);
        }
    }
    return result;
}
//# sourceMappingURL=atomizer.js.map