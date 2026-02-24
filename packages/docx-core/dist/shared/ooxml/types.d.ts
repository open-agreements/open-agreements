/**
 * TypeScript types for OOXML document elements.
 *
 * These types represent the object model used during comparison operations.
 */
/**
 * Represents a revision (track change) in the document.
 */
export interface Revision {
    /** Unique ID for this revision */
    id: number;
    /** Author of the revision */
    author: string;
    /** Timestamp of the revision */
    date: Date;
    /** Type of revision */
    type: 'insertion' | 'deletion' | 'move' | 'format';
}
/**
 * Represents a text run with its properties.
 */
export interface RunInfo {
    /** The text content */
    text: string;
    /** Character offset within the paragraph */
    start: number;
    /** Character offset of end (exclusive) */
    end: number;
    /** Run properties (bold, italic, etc.) */
    properties?: RunProperties;
    /** If this run is part of a revision */
    revision?: Revision;
}
/**
 * Run formatting properties.
 */
export interface RunProperties {
    bold?: boolean;
    italic?: boolean;
    underline?: string;
    strikethrough?: boolean;
    highlight?: string;
    color?: string;
    fontSize?: number;
    fontFamily?: string;
}
/**
 * Represents a paragraph with its content.
 */
export interface ParagraphInfo {
    /** Unique identifier for correlation */
    id?: string;
    /** Plain text content (for comparison) */
    text: string;
    /** Individual runs in this paragraph */
    runs: RunInfo[];
    /** Paragraph style */
    style?: string;
    /** Numbering info if this is a list item */
    numbering?: NumberingInfo;
    /** SHA1 hash for correlation */
    hash?: string;
}
/**
 * Numbering (list) information.
 */
export interface NumberingInfo {
    /** Numbering definition ID */
    numId: number;
    /** Indentation level */
    ilvl: number;
    /** Rendered label text (e.g., "1.", "a)", "(i)") */
    label?: string;
}
/**
 * Represents a field (cross-reference, hyperlink, etc.)
 */
export interface FieldInfo {
    /** Field type (REF, HYPERLINK, etc.) */
    type: string;
    /** Field instruction code */
    instruction: string;
    /** Displayed result text */
    result: string;
    /** Character position in paragraph */
    start: number;
    end: number;
}
/**
 * Result of paragraph alignment (LCS-based).
 */
export interface AlignmentResult {
    /** Paragraphs that match between documents */
    matched: Array<{
        original: ParagraphInfo;
        revised: ParagraphInfo;
        similarity: number;
    }>;
    /** Paragraphs only in original (deleted) */
    deleted: ParagraphInfo[];
    /** Paragraphs only in revised (inserted) */
    inserted: ParagraphInfo[];
}
/**
 * Diff operation from diff-match-patch.
 */
export type DiffOp = [-1 | 0 | 1, string];
/**
 * Run-level diff result.
 */
export interface RunDiffResult {
    /** Original runs with deletion markers */
    originalRuns: RunInfo[];
    /** Revised runs with insertion markers */
    revisedRuns: RunInfo[];
    /** Combined runs with track changes */
    mergedRuns: RunInfo[];
}
/**
 * Statistics from a comparison operation.
 */
export interface ComparisonStats {
    /** Number of inserted runs/paragraphs */
    insertions: number;
    /** Number of deleted runs/paragraphs */
    deletions: number;
    /** Number of modified paragraphs */
    modifications: number;
    /** Average length of changed spans */
    avgSpanLength: number;
    /** Total paragraphs in original */
    originalParagraphs: number;
    /** Total paragraphs in revised */
    revisedParagraphs: number;
}
//# sourceMappingURL=types.d.ts.map