/**
 * WmlComparer Core Data Structures
 *
 * TypeScript equivalents of WmlComparer's core C# data structures.
 * These types form the foundation for the atomization pipeline that
 * flattens OOXML into comparable units.
 *
 * @see https://github.com/OpenXmlDev/Open-Xml-PowerTools/blob/536ca1fb4bcdce1f4c920658bd66807b970393d7/OpenXmlPowerTools/WmlComparer.cs
 */
/**
 * Correlation status for comparison units.
 *
 * Tracks the result of comparing atoms between two documents.
 *
 * @see WmlComparer.cs line 2264
 */
export declare enum CorrelationStatus {
    /** Not yet processed by comparison algorithm */
    Unknown = "Unknown",
    /** Content matches in both documents */
    Equal = "Equal",
    /** Content only exists in original document (removed) */
    Deleted = "Deleted",
    /** Content only exists in revised document (added) */
    Inserted = "Inserted",
    /** Content was moved from this location (source of move) */
    MovedSource = "MovedSource",
    /** Content was moved to this location (destination of move) */
    MovedDestination = "MovedDestination",
    /** Text content matches but formatting differs */
    FormatChanged = "FormatChanged"
}
/**
 * Represents an Open Packaging Conventions (OPC) part.
 *
 * Minimal interface for tracking which file/part a node originated from.
 * Integrates with DocxArchive for ZIP extraction.
 *
 * @see OpenXmlPart in DocumentFormat.OpenXml.Packaging
 */
export interface OpcPart {
    /** Part URI within the package, e.g., "word/document.xml" */
    uri: string;
    /** Content type of the part, e.g., "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" */
    contentType: string;
}
/**
 * Transition alias: WmlElement is now the native DOM Element from @xmldom/xmldom.
 *
 * All attribute access uses `.getAttribute(name)`, children use DOM traversal,
 * and parent navigation uses `.parentNode` / `.parentElement`.
 *
 * This alias will be removed once all imports are updated to use `Element` directly.
 */
export type WmlElement = Element;
/**
 * Base interface for any comparison unit (atom or group).
 *
 * Represents a unit of content that can be compared between documents.
 *
 * @see ComparisonUnit abstract class in WmlComparer.cs lines 2230-2270
 */
export interface ComparisonUnit {
    /** SHA1 hash of the unit's content for quick equality check */
    sha1Hash: string;
    /** Current correlation status after comparison */
    correlationStatus: CorrelationStatus;
    /** Child comparison units (for groups) */
    contents?: ComparisonUnit[];
}
/**
 * Format change information for atoms where text matches but formatting differs.
 *
 * Stores the old and new run properties along with the specific property names
 * that changed (e.g., "bold", "italic").
 */
export interface FormatChangeInfo {
    /** Run properties from the original document (before changes) */
    oldRunProperties: WmlElement | null;
    /** Run properties from the modified document (after changes) */
    newRunProperties: WmlElement | null;
    /** List of property names that changed (e.g., "bold", "italic", "fontSize") */
    changedProperties: string[];
}
/**
 * Atomic leaf-node unit used in LCS comparison.
 *
 * Represents the smallest comparable unit of content. Created by atomizing
 * the document tree into individual text nodes, breaks, and other leaf elements.
 *
 * @see ComparisonUnitAtom class in WmlComparer.cs lines 2305-2350
 */
export interface ComparisonUnitAtom extends ComparisonUnit {
    /** The leaf element (w:t, w:br, w:cr, etc.) */
    contentElement: WmlElement;
    /**
     * Convenience references used by some reconstruction paths (e.g. in-place mode).
     * These are optional because they can be derived from `ancestorElements`.
     */
    sourceRunElement?: WmlElement;
    sourceParagraphElement?: WmlElement;
    /** Ancestor elements from root to parent of contentElement */
    ancestorElements: WmlElement[];
    /** Unique identifiers extracted from ancestors (w:Unid attributes) */
    ancestorUnids: string[];
    /** The OPC part this atom belongs to */
    part: OpcPart;
    /** Revision tracking element if this atom is inside w:ins or w:del */
    revTrackElement?: WmlElement;
    /** Sequential index of the paragraph this atom belongs to (0-indexed) */
    paragraphIndex?: number;
    /** Group ID for atoms that are part of a move operation */
    moveGroupId?: number;
    /** Move name for linking source and destination (e.g., "move1") */
    moveName?: string;
    /** Format change details when text is equal but formatting differs */
    formatChange?: FormatChangeInfo;
    /** Reference to the corresponding atom in the other document (for Equal atoms) */
    comparisonUnitAtomBefore?: ComparisonUnitAtom;
    /** True if this atom represents an empty paragraph (paragraph with only w:pPr, no content) */
    isEmptyParagraph?: boolean;
    /** Original atoms when this atom represents a collapsed field sequence */
    collapsedFieldAtoms?: ComparisonUnitAtom[];
    /** Reference to the parent atom when this atom was created by word-level splitting */
    splitFromAtom?: ComparisonUnitAtom;
    /** Which document this atom originated from (for correct formatting application) */
    sourceDocument?: 'original' | 'revised';
}
/**
 * Settings for move detection algorithm.
 *
 * @see WmlComparerSettings in WmlComparer.cs
 */
export interface MoveDetectionSettings {
    /** Enable move detection. Default: true */
    detectMoves: boolean;
    /** Minimum Jaccard similarity for a match to be considered a move. Default: 0.8 */
    moveSimilarityThreshold: number;
    /** Minimum word count for a block to be considered for move detection. Default: 5 */
    moveMinimumWordCount: number;
    /** Case insensitive comparison for move matching. Default: true */
    caseInsensitiveMove: boolean;
}
/**
 * Default settings for move detection.
 */
export declare const DEFAULT_MOVE_DETECTION_SETTINGS: MoveDetectionSettings;
/**
 * Block of consecutive atoms with the same status.
 *
 * Used during move detection to group atoms into comparable blocks.
 */
export interface AtomBlock {
    /** Status of all atoms in this block (Deleted or Inserted) */
    status: CorrelationStatus;
    /** The atoms in this block */
    atoms: ComparisonUnitAtom[];
    /** Joined text content from all atoms */
    text: string;
    /** Number of words in the text */
    wordCount: number;
}
/**
 * Settings for format change detection.
 */
export interface FormatDetectionSettings {
    /** Enable format change detection. Default: true */
    detectFormatChanges: boolean;
}
/**
 * Default settings for format change detection.
 */
export declare const DEFAULT_FORMAT_DETECTION_SETTINGS: FormatDetectionSettings;
/**
 * Mapping of OOXML run property tag names to friendly names.
 */
export declare const RUN_PROPERTY_FRIENDLY_NAMES: Record<string, string>;
/**
 * Combined settings for document comparison.
 */
export interface WmlComparerSettings extends MoveDetectionSettings, FormatDetectionSettings {
    /** Author name for revision tracking. Default: "Comparison" */
    author: string;
    /** Timestamp for revisions. Default: current time */
    dateTime: Date;
}
/**
 * Default comparison settings.
 */
export declare const DEFAULT_COMPARER_SETTINGS: WmlComparerSettings;
/**
 * Information about list continuation patterns.
 *
 * Used to detect "orphan" list items that should render at a different
 * effective level than their ilvl suggests.
 */
export interface ContinuationInfo {
    /** Whether this paragraph is a continuation pattern */
    isContinuation: boolean;
    /** The effective level for rendering (0 for continuations) */
    effectiveLevel: number;
}
/**
 * Numbering level properties.
 */
export interface ListLevelInfo {
    /** The indentation level (0-based) */
    ilvl: number;
    /** Starting number for this level */
    start: number;
    /** Number format (decimal, lowerLetter, upperRoman, etc.) */
    numFmt: string;
    /** Level text format string (e.g., "%1.", "%1.%2") */
    lvlText: string;
    /** Whether legal numbering is enabled */
    isLgl?: boolean;
}
/**
 * Numbering definition with all levels.
 */
export interface NumberingDefinition {
    /** Numbering definition ID */
    numId: number;
    /** Abstract numbering ID */
    abstractNumId: number;
    /** Level definitions */
    levels: ListLevelInfo[];
}
/**
 * Reserved footnote/endnote IDs per ECMA-376.
 */
export declare const RESERVED_FOOTNOTE_IDS: {
    /** Separator footnote */
    readonly SEPARATOR: "0";
    /** Continuation separator footnote */
    readonly CONTINUATION_SEPARATOR: "1";
};
/**
 * Footnote reference information.
 */
export interface FootnoteReference {
    /** XML ID from w:id attribute */
    xmlId: string;
    /** Whether this uses a custom mark (suppresses automatic numbering) */
    customMarkFollows: boolean;
    /** Display number (sequential order in document) */
    displayNumber?: number;
}
/**
 * Types of revisions that can be detected.
 */
export declare enum WmlComparerRevisionType {
    /** Text was inserted */
    Insertion = "Insertion",
    /** Text was deleted */
    Deletion = "Deletion",
    /** Content was moved (source) */
    MoveFrom = "MoveFrom",
    /** Content was moved (destination) */
    MoveTo = "MoveTo",
    /** Formatting was changed */
    FormatChanged = "FormatChanged"
}
/**
 * Details about a format change revision.
 */
export interface FormatChangeDetails {
    /** Properties that were added */
    addedProperties: string[];
    /** Properties that were removed */
    removedProperties: string[];
    /** Properties that were modified */
    changedProperties: string[];
}
/**
 * A detected revision in the comparison output.
 */
export interface WmlComparerRevision {
    /** Type of revision */
    type: WmlComparerRevisionType;
    /** Author of the revision */
    author: string;
    /** Timestamp of the revision */
    date: Date;
    /** Text content affected by the revision */
    text: string;
    /** Revision ID (w:id attribute) */
    revisionId: number;
    /** Move name if this is a move revision */
    moveName?: string;
    /** Format change details if this is a format change */
    formatChangeDetails?: FormatChangeDetails;
}
//# sourceMappingURL=core-types.d.ts.map