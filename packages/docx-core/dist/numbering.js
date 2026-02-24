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
import { childElements } from './primitives/index.js';
// =============================================================================
// Continuation Pattern Detection
// =============================================================================
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
export function detectContinuationPattern(ilvl, startValue, levelNumbers) {
    // Must be at a level > 0 to be a continuation
    if (ilvl <= 0) {
        return { isContinuation: false, effectiveLevel: ilvl };
    }
    // Check if start value equals parent level's counter + 1
    const parentLevel = ilvl - 1;
    const parentValue = levelNumbers[parentLevel] ?? 0;
    if (startValue === parentValue + 1) {
        return { isContinuation: true, effectiveLevel: 0 };
    }
    return { isContinuation: false, effectiveLevel: ilvl };
}
/**
 * Get the effective level for rendering, accounting for continuation patterns.
 *
 * @param ilvl - The declared indentation level
 * @param startValue - The start value for this level
 * @param levelNumbers - Current counter values for each level
 * @returns The effective level for rendering (0 for continuation patterns)
 */
export function getEffectiveLevel(ilvl, startValue, levelNumbers) {
    const info = detectContinuationPattern(ilvl, startValue, levelNumbers);
    return info.effectiveLevel;
}
/**
 * Create initial numbering state.
 */
export function createNumberingState() {
    return {
        counters: new Map(),
        levelUsed: new Map(),
    };
}
/**
 * Get the key for numbering state lookup.
 */
function getNumKey(numId) {
    return `num:${numId}`;
}
/**
 * Get or initialize counter array for a numbering definition.
 *
 * @param state - The numbering state
 * @param numId - The numbering definition ID
 * @param maxLevels - Maximum number of levels (default 9)
 * @returns The counter array for this numbering definition
 */
export function getCounters(state, numId, maxLevels = 9) {
    const key = getNumKey(numId);
    let counters = state.counters.get(key);
    if (!counters) {
        counters = new Array(maxLevels).fill(0);
        state.counters.set(key, counters);
    }
    return counters;
}
/**
 * Get or initialize level used tracking for a numbering definition.
 */
function getLevelUsed(state, numId, maxLevels = 9) {
    const key = getNumKey(numId);
    let used = state.levelUsed.get(key);
    if (!used) {
        used = new Array(maxLevels).fill(false);
        state.levelUsed.set(key, used);
    }
    return used;
}
/**
 * Track the last used level for each numbering definition.
 */
const lastUsedLevel = new Map();
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
export function processNumberedParagraph(state, numId, ilvl, levelInfo) {
    const counters = getCounters(state, numId);
    const levelUsed = getLevelUsed(state, numId);
    const key = `num:${numId}`;
    // Check for continuation pattern
    const continuation = detectContinuationPattern(ilvl, levelInfo.start, counters);
    if (continuation.isContinuation) {
        // Continuation pattern: use level 0's counter incremented
        const current = counters[0] ?? 0;
        counters[0] = current + 1;
        lastUsedLevel.set(key, 0);
        return counters[0] ?? 1;
    }
    // Check if we moved from a deeper level to a shallower level
    const prevLevel = lastUsedLevel.get(key) ?? -1;
    if (prevLevel > ilvl) {
        // Reset all deeper levels when moving to a shallower level
        for (let i = ilvl + 1; i < counters.length; i++) {
            counters[i] = 0;
            levelUsed[i] = false;
        }
    }
    // Check if this level has been used before
    if (!levelUsed[ilvl]) {
        // First use of this level: set to start value
        counters[ilvl] = levelInfo.start;
        levelUsed[ilvl] = true;
    }
    else {
        // Subsequent use: increment
        const current = counters[ilvl] ?? 0;
        counters[ilvl] = current + 1;
    }
    lastUsedLevel.set(key, ilvl);
    return counters[ilvl] ?? levelInfo.start;
}
// =============================================================================
// Number Format Rendering
// =============================================================================
/**
 * Convert a number to the specified format.
 *
 * @param value - The numeric value
 * @param format - The number format (decimal, lowerLetter, upperLetter, lowerRoman, upperRoman, etc.)
 * @returns The formatted string
 */
export function formatNumber(value, format) {
    switch (format) {
        case 'decimal':
        case 'decimalZero':
            return value.toString();
        case 'lowerLetter':
            return toLowerLetter(value);
        case 'upperLetter':
            return toUpperLetter(value);
        case 'lowerRoman':
            return toRoman(value).toLowerCase();
        case 'upperRoman':
            return toRoman(value);
        case 'ordinal':
            return toOrdinal(value);
        case 'cardinalText':
            return toCardinalText(value);
        case 'ordinalText':
            return toOrdinalText(value);
        case 'bullet':
            return '•';
        case 'none':
            return '';
        default:
            return value.toString();
    }
}
/**
 * Convert number to lowercase letter (a, b, c, ... z, aa, ab, ...).
 */
function toLowerLetter(value) {
    let result = '';
    let n = value;
    while (n > 0) {
        n--;
        result = String.fromCharCode(97 + (n % 26)) + result;
        n = Math.floor(n / 26);
    }
    return result;
}
/**
 * Convert number to uppercase letter (A, B, C, ... Z, AA, AB, ...).
 */
function toUpperLetter(value) {
    return toLowerLetter(value).toUpperCase();
}
/**
 * Convert number to Roman numeral.
 */
function toRoman(value) {
    const romanNumerals = [
        [1000, 'M'],
        [900, 'CM'],
        [500, 'D'],
        [400, 'CD'],
        [100, 'C'],
        [90, 'XC'],
        [50, 'L'],
        [40, 'XL'],
        [10, 'X'],
        [9, 'IX'],
        [5, 'V'],
        [4, 'IV'],
        [1, 'I'],
    ];
    let result = '';
    let remaining = value;
    for (const [num, roman] of romanNumerals) {
        while (remaining >= num) {
            result += roman;
            remaining -= num;
        }
    }
    return result;
}
/**
 * Convert number to ordinal (1st, 2nd, 3rd, 4th, ...).
 */
function toOrdinal(value) {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = value % 100;
    const suffix = suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0] ?? 'th';
    return value + suffix;
}
/**
 * Convert number to cardinal text (one, two, three, ...).
 */
function toCardinalText(value) {
    const ones = [
        '',
        'one',
        'two',
        'three',
        'four',
        'five',
        'six',
        'seven',
        'eight',
        'nine',
        'ten',
        'eleven',
        'twelve',
        'thirteen',
        'fourteen',
        'fifteen',
        'sixteen',
        'seventeen',
        'eighteen',
        'nineteen',
    ];
    const tens = [
        '',
        '',
        'twenty',
        'thirty',
        'forty',
        'fifty',
        'sixty',
        'seventy',
        'eighty',
        'ninety',
    ];
    if (value < 20) {
        return ones[value] || value.toString();
    }
    if (value < 100) {
        const ten = Math.floor(value / 10);
        const one = value % 10;
        return tens[ten] + (one > 0 ? '-' + ones[one] : '');
    }
    // For larger numbers, fall back to decimal
    return value.toString();
}
/**
 * Convert number to ordinal text (first, second, third, ...).
 */
function toOrdinalText(value) {
    const ordinals = {
        1: 'first',
        2: 'second',
        3: 'third',
        4: 'fourth',
        5: 'fifth',
        6: 'sixth',
        7: 'seventh',
        8: 'eighth',
        9: 'ninth',
        10: 'tenth',
        11: 'eleventh',
        12: 'twelfth',
    };
    return ordinals[value] || toOrdinal(value);
}
// =============================================================================
// Level Text Expansion
// =============================================================================
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
export function expandLevelText(lvlText, counters, levels) {
    let result = lvlText;
    // Replace %1 through %9 with corresponding level values
    for (let i = 0; i < 9; i++) {
        const placeholder = `%${i + 1}`;
        if (result.includes(placeholder)) {
            const value = counters[i] ?? 0;
            const level = levels[i];
            const formatted = level ? formatNumber(value, level.numFmt) : value.toString();
            result = result.replace(placeholder, formatted);
        }
    }
    return result;
}
// =============================================================================
// Legal Numbering (isLgl) Support
// =============================================================================
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
export function isLegalNumberingActive(levels, currentLevel) {
    // Legal numbering applies when any ancestor level has isLgl=true
    for (let i = 0; i <= currentLevel; i++) {
        if (levels[i]?.isLgl) {
            return true;
        }
    }
    return false;
}
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
export function expandLevelTextWithLegal(lvlText, counters, levels, currentLevel) {
    const useLegal = isLegalNumberingActive(levels, currentLevel);
    let result = lvlText;
    for (let i = 0; i < 9; i++) {
        const placeholder = `%${i + 1}`;
        if (result.includes(placeholder)) {
            const value = counters[i] ?? 0;
            const level = levels[i];
            const format = useLegal ? 'decimal' : level?.numFmt ?? 'decimal';
            const formatted = formatNumber(value, format);
            result = result.replace(placeholder, formatted);
        }
    }
    return result;
}
// =============================================================================
// Numbering Definition Parsing
// =============================================================================
/**
 * Extract list level info from a w:lvl element.
 *
 * @param lvlElement - The w:lvl XML element
 * @returns The extracted level info
 */
export function parseLevelElement(lvlElement) {
    const ilvl = parseInt(lvlElement.getAttribute('w:ilvl') || '0', 10);
    let start = 1;
    let numFmt = 'decimal';
    let lvlText = '';
    let isLgl = false;
    for (const child of childElements(lvlElement)) {
        switch (child.tagName) {
            case 'w:start':
                start = parseInt(child.getAttribute('w:val') || '1', 10);
                break;
            case 'w:numFmt':
                numFmt = child.getAttribute('w:val') || 'decimal';
                break;
            case 'w:lvlText':
                lvlText = child.getAttribute('w:val') ?? '';
                break;
            case 'w:isLgl':
                isLgl = child.getAttribute('w:val') !== 'false' && child.getAttribute('w:val') !== '0';
                break;
        }
    }
    return { ilvl, start, numFmt, lvlText, isLgl };
}
/**
 * Parse an abstract numbering definition.
 *
 * @param abstractNumElement - The w:abstractNum XML element
 * @returns Array of level info for all defined levels
 */
export function parseAbstractNumElement(abstractNumElement) {
    const levels = [];
    for (const child of childElements(abstractNumElement)) {
        if (child.tagName === 'w:lvl') {
            const levelInfo = parseLevelElement(child);
            levels[levelInfo.ilvl] = levelInfo;
        }
    }
    return levels;
}
//# sourceMappingURL=numbering.js.map