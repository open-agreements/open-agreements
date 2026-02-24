/**
 * Legal Numbering Module
 *
 * Handles OOXML numbering corner cases for legal documents.
 * Implements continuation pattern detection for proper rendering of
 * "orphan" list items.
 *
 * @example
 * Word exhibits behavior where orphan list items render at level 0:
 * - Para 1: ilvl=0 → "1."
 * - Para 2: ilvl=0 → "2."
 * - Para 3: ilvl=0 → "3."
 * - Para 4: ilvl=1, start=4 → Word displays "4." (NOT "3.4")
 */
import { ContinuationInfo, ListLevelInfo, WmlElement } from './core-types.js';
/**
 * Detect if a paragraph is using a continuation pattern.
 *
 * A continuation pattern occurs when a list item at ilvl > 0 should render
 * at level 0 because its start value indicates it's continuing the parent
 * level's sequence rather than starting a nested list.
 *
 * @param ilvl - The indentation level of the paragraph
 * @param startValue - The start value for this level
 * @param levelNumbers - Current counter values for each level
 * @returns Continuation info with effective level
 *
 * @example
 * // Level numbers [3, 0] means level 0 is at "3", level 1 hasn't been used
 * detectContinuationPattern(1, 4, [3, 0])
 * // Returns: { isContinuation: true, effectiveLevel: 0 }
 * // Because start=4 equals levelNumbers[0]+1, this continues as "4."
 */
export declare function detectContinuationPattern(ilvl: number, startValue: number, levelNumbers: number[]): ContinuationInfo;
/**
 * Get the effective level for rendering, accounting for continuation patterns.
 *
 * @param ilvl - The declared indentation level
 * @param startValue - The start value for this level
 * @param levelNumbers - Current counter values for each level
 * @returns The effective level for rendering (0 for continuation patterns)
 */
export declare function getEffectiveLevel(ilvl: number, startValue: number, levelNumbers: number[]): number;
/**
 * State of numbering counters for a document.
 */
export interface NumberingState {
    /** Current counter values per numId and ilvl */
    counters: Map<string, number[]>;
    /** Track whether each level has been used in current sequence */
    levelUsed: Map<string, boolean[]>;
}
/**
 * Create initial numbering state.
 */
export declare function createNumberingState(): NumberingState;
/**
 * Get or initialize counter array for a numbering definition.
 *
 * @param state - The numbering state
 * @param numId - The numbering definition ID
 * @param maxLevels - Maximum number of levels (default 9)
 * @returns The counter array for this numbering definition
 */
export declare function getCounters(state: NumberingState, numId: number, maxLevels?: number): number[];
/**
 * Process a numbered paragraph and return its display number.
 *
 * Updates the numbering state and returns the appropriate number to display,
 * accounting for continuation patterns and level resets.
 *
 * @param state - The numbering state to update
 * @param numId - The numbering definition ID
 * @param ilvl - The indentation level
 * @param levelInfo - Level properties from the numbering definition
 * @returns The number to display at this level
 */
export declare function processNumberedParagraph(state: NumberingState, numId: number, ilvl: number, levelInfo: ListLevelInfo): number;
/**
 * Convert a number to the specified format.
 *
 * @param value - The numeric value
 * @param format - The number format (decimal, lowerLetter, upperLetter, lowerRoman, upperRoman, etc.)
 * @returns The formatted string
 */
export declare function formatNumber(value: number, format: string): string;
/**
 * Expand a level text format string with actual numbers.
 *
 * Level text uses placeholders like %1, %2, %3 for level values.
 *
 * @param lvlText - The level text format (e.g., "%1.", "%1.%2")
 * @param counters - Current counter values for each level
 * @param levels - Level definitions for format lookup
 * @returns The expanded text (e.g., "1.", "1.2")
 */
export declare function expandLevelText(lvlText: string, counters: number[], levels: ListLevelInfo[]): string;
/**
 * Check if legal numbering is active for a level.
 *
 * Legal numbering (w:isLgl) changes how nested levels display,
 * using decimal format regardless of the level's numFmt.
 *
 * @param levels - Level definitions
 * @param currentLevel - The current level index
 * @returns True if legal numbering is active
 */
export declare function isLegalNumberingActive(levels: ListLevelInfo[], currentLevel: number): boolean;
/**
 * Expand level text with legal numbering rules.
 *
 * When legal numbering is active, all level placeholders use decimal
 * format regardless of the level's defined numFmt.
 *
 * @param lvlText - The level text format
 * @param counters - Current counter values
 * @param levels - Level definitions
 * @param currentLevel - The current level index
 * @returns The expanded text with legal numbering applied
 */
export declare function expandLevelTextWithLegal(lvlText: string, counters: number[], levels: ListLevelInfo[], currentLevel: number): string;
/**
 * Extract list level info from a w:lvl element.
 *
 * @param lvlElement - The w:lvl XML element
 * @returns The extracted level info
 */
export declare function parseLevelElement(lvlElement: WmlElement): ListLevelInfo;
/**
 * Parse an abstract numbering definition.
 *
 * @param abstractNumElement - The w:abstractNum XML element
 * @returns Array of level info for all defined levels
 */
export declare function parseAbstractNumElement(abstractNumElement: WmlElement): ListLevelInfo[];
//# sourceMappingURL=numbering.d.ts.map