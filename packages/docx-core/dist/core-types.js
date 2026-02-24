/**
 * WmlComparer Core Data Structures
 *
 * TypeScript equivalents of WmlComparer's core C# data structures.
 * These types form the foundation for the atomization pipeline that
 * flattens OOXML into comparable units.
 *
 * @see https://github.com/OpenXmlDev/Open-Xml-PowerTools/blob/536ca1fb4bcdce1f4c920658bd66807b970393d7/OpenXmlPowerTools/WmlComparer.cs
 */
// =============================================================================
// Correlation Status Enum
// =============================================================================
/**
 * Correlation status for comparison units.
 *
 * Tracks the result of comparing atoms between two documents.
 *
 * @see WmlComparer.cs line 2264
 */
export var CorrelationStatus;
(function (CorrelationStatus) {
    /** Not yet processed by comparison algorithm */
    CorrelationStatus["Unknown"] = "Unknown";
    /** Content matches in both documents */
    CorrelationStatus["Equal"] = "Equal";
    /** Content only exists in original document (removed) */
    CorrelationStatus["Deleted"] = "Deleted";
    /** Content only exists in revised document (added) */
    CorrelationStatus["Inserted"] = "Inserted";
    /** Content was moved from this location (source of move) */
    CorrelationStatus["MovedSource"] = "MovedSource";
    /** Content was moved to this location (destination of move) */
    CorrelationStatus["MovedDestination"] = "MovedDestination";
    /** Text content matches but formatting differs */
    CorrelationStatus["FormatChanged"] = "FormatChanged";
})(CorrelationStatus || (CorrelationStatus = {}));
/**
 * Default settings for move detection.
 */
export const DEFAULT_MOVE_DETECTION_SETTINGS = {
    detectMoves: true,
    moveSimilarityThreshold: 0.8,
    moveMinimumWordCount: 5,
    caseInsensitiveMove: true,
};
/**
 * Default settings for format change detection.
 */
export const DEFAULT_FORMAT_DETECTION_SETTINGS = {
    detectFormatChanges: true,
};
/**
 * Mapping of OOXML run property tag names to friendly names.
 */
export const RUN_PROPERTY_FRIENDLY_NAMES = {
    'w:b': 'bold',
    'w:bCs': 'boldComplex',
    'w:i': 'italic',
    'w:iCs': 'italicComplex',
    'w:u': 'underline',
    'w:strike': 'strikethrough',
    'w:dstrike': 'doubleStrikethrough',
    'w:sz': 'fontSize',
    'w:szCs': 'fontSizeComplex',
    'w:rFonts': 'font',
    'w:color': 'color',
    'w:highlight': 'highlight',
    'w:shd': 'shading',
    'w:vertAlign': 'verticalAlign',
    'w:caps': 'allCaps',
    'w:smallCaps': 'smallCaps',
    'w:vanish': 'hidden',
    'w:emboss': 'emboss',
    'w:imprint': 'imprint',
    'w:outline': 'outline',
    'w:shadow': 'shadow',
    'w:spacing': 'spacing',
    'w:w': 'width',
    'w:kern': 'kerning',
    'w:position': 'position',
};
/**
 * Default comparison settings.
 */
export const DEFAULT_COMPARER_SETTINGS = {
    ...DEFAULT_MOVE_DETECTION_SETTINGS,
    ...DEFAULT_FORMAT_DETECTION_SETTINGS,
    author: 'Comparison',
    dateTime: new Date(),
};
// =============================================================================
// Footnote Numbering Types
// =============================================================================
/**
 * Reserved footnote/endnote IDs per ECMA-376.
 */
export const RESERVED_FOOTNOTE_IDS = {
    /** Separator footnote */
    SEPARATOR: '0',
    /** Continuation separator footnote */
    CONTINUATION_SEPARATOR: '1',
};
// =============================================================================
// Revision Reporting Types
// =============================================================================
/**
 * Types of revisions that can be detected.
 */
export var WmlComparerRevisionType;
(function (WmlComparerRevisionType) {
    /** Text was inserted */
    WmlComparerRevisionType["Insertion"] = "Insertion";
    /** Text was deleted */
    WmlComparerRevisionType["Deletion"] = "Deletion";
    /** Content was moved (source) */
    WmlComparerRevisionType["MoveFrom"] = "MoveFrom";
    /** Content was moved (destination) */
    WmlComparerRevisionType["MoveTo"] = "MoveTo";
    /** Formatting was changed */
    WmlComparerRevisionType["FormatChanged"] = "FormatChanged";
})(WmlComparerRevisionType || (WmlComparerRevisionType = {}));
//# sourceMappingURL=core-types.js.map