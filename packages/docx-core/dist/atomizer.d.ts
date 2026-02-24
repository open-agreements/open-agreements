/**
 * Atomizer Module
 *
 * Provides factory functions for creating ComparisonUnitAtom instances.
 * Implements the core atomization logic from WmlComparer.
 *
 * @see WmlComparer.cs ComparisonUnitAtom constructor (lines 2314-2343)
 */
import { ComparisonUnitAtom, CorrelationStatus, OpcPart, WmlElement } from './core-types.js';
/**
 * Calculate SHA1 hash of a string.
 *
 * Used for quick equality checking of comparison units.
 *
 * @param content - The string content to hash
 * @returns Hexadecimal SHA1 hash string
 */
export declare function sha1(content: string): string;
/**
 * Calculate SHA1 hash for a WmlElement.
 *
 * Includes tag name, attributes, and text content for uniqueness.
 * Excludes presentation-only attributes like xml:space that don't affect content.
 *
 * @param element - The element to hash
 * @returns Hexadecimal SHA1 hash string
 */
export declare function hashElement(element: WmlElement): string;
/**
 * Find a revision tracking element in the ancestor chain.
 *
 * Searches ancestors from nearest to root for w:ins, w:del, w:moveFrom, or w:moveTo.
 *
 * @param ancestors - Ancestor elements from root to parent
 * @returns The revision tracking element if found, undefined otherwise
 */
export declare function findRevisionTrackingElement(ancestors: WmlElement[]): WmlElement | undefined;
/**
 * Determine initial correlation status from revision tracking element.
 *
 * @param revTrackElement - The revision tracking element (if any)
 * @returns Initial correlation status
 */
export declare function getStatusFromRevisionTracking(revTrackElement: WmlElement | undefined): CorrelationStatus;
/**
 * Extract Unid attributes from ancestor elements.
 *
 * WmlComparer uses w:Unid attributes to correlate elements between documents.
 *
 * @param ancestors - Ancestor elements from root to parent
 * @returns Array of Unid values found in ancestors
 */
export declare function extractAncestorUnids(ancestors: WmlElement[]): string[];
/**
 * Special tag name for empty paragraph boundary atoms.
 * These atoms are created for paragraphs that have no content (only w:pPr).
 */
export declare const EMPTY_PARAGRAPH_TAG = "__emptyParagraph__";
export interface AtomizeTreeOptions {
    /**
     * Clone leaf nodes into atom.contentElement instead of reusing the parsed AST nodes.
     *
     * This prevents boundary normalization (merge/split) from mutating the document AST,
     * which is required for safe `reconstructionMode: 'inplace'`.
     *
     * Default: false (preserve historical behavior/perf).
     */
    cloneLeafNodes?: boolean;
    /**
     * Allow normalization to merge atoms across run boundaries if formatting matches.
     *
     * For `reconstructionMode: 'inplace'`, this should usually be false so that atom
     * ancestry continues to point at the correct run for wrapping.
     *
     * Default: true.
     */
    mergeAcrossRuns?: boolean;
    /**
     * Allow punctuation normalization to merge across run boundaries.
     *
     * Default: true.
     */
    mergePunctuationAcrossRuns?: boolean;
    /**
     * Split text atoms on word boundaries for fine-grained diffs.
     *
     * Default: true.
     */
    splitTextIntoWords?: boolean;
}
/**
 * Check if an element is a leaf node for atomization.
 *
 * Leaf nodes are the smallest units that can be compared.
 *
 * @param element - The element to check
 * @returns True if this is a leaf node
 */
export declare function isLeafNode(element: WmlElement): boolean;
/**
 * Options for creating a ComparisonUnitAtom.
 */
export interface CreateAtomOptions {
    /** The leaf element (w:t, w:br, etc.) */
    contentElement: WmlElement;
    /** Ancestor elements from root to parent of contentElement */
    ancestors: WmlElement[];
    /** The OPC part this atom belongs to */
    part: OpcPart;
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
export declare function createComparisonUnitAtom(options: CreateAtomOptions): ComparisonUnitAtom;
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
export declare function atomizeTree(node: WmlElement, ancestors: WmlElement[], part: OpcPart, options?: AtomizeTreeOptions): {
    atoms: ComparisonUnitAtom[];
    emptyParagraphCount: number;
};
/**
 * Get all ancestors of a node by following parent references.
 *
 * @param node - The node to get ancestors for
 * @returns Array of ancestors from root to immediate parent
 */
export declare function getAncestors(node: WmlElement): WmlElement[];
/**
 * Assign paragraph indices to atoms based on their w:p ancestors.
 *
 * This enables paragraph grouping in the document reconstructor when
 * merging atoms from different source trees (original vs revised).
 *
 * @param atoms - Array of atoms to assign indices to
 */
export declare function assignParagraphIndices(atoms: ComparisonUnitAtom[]): void;
/**
 * Special tag name for collapsed field atoms.
 * These represent Word field codes (REF, PAGEREF, etc.) collapsed to their visible result.
 */
export declare const COLLAPSED_FIELD_TAG = "__collapsedField__";
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
export declare function collapseFieldSequences(atoms: ComparisonUnitAtom[]): ComparisonUnitAtom[];
/**
 * Split all w:t atoms into word-level atoms.
 *
 * @param atoms - Array of atoms
 * @returns Array with w:t atoms split into words
 */
export declare function splitAtomsIntoWords(atoms: ComparisonUnitAtom[]): ComparisonUnitAtom[];
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
export declare function mergePunctuationAtoms(atoms: ComparisonUnitAtom[], options?: Required<Pick<AtomizeTreeOptions, 'mergePunctuationAcrossRuns'>>): ComparisonUnitAtom[];
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
export declare function mergeContiguousTextAtoms(atoms: ComparisonUnitAtom[], options?: Required<Pick<AtomizeTreeOptions, 'mergeAcrossRuns'>>): ComparisonUnitAtom[];
//# sourceMappingURL=atomizer.d.ts.map