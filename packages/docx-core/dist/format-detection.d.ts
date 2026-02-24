/**
 * Format Change Detection Module
 *
 * Detects formatting changes (bold, italic, font size, etc.) between
 * documents after LCS comparison. Runs on atoms marked as Equal to
 * identify text that matches but has different formatting.
 *
 * Pipeline position:
 * LCS() → FlattenToAtomList() → detectMovesInAtomList() → detectFormatChangesInAtomList() → CoalesceRecurse()
 *
 * @see design.md Decision 10: Format Change Detection as Post-LCS Phase
 */
import { ComparisonUnitAtom, FormatChangeInfo, FormatDetectionSettings } from './core-types.js';
/**
 * Extract run properties (w:rPr) from an atom's ancestor elements.
 *
 * Finds the w:r (run) element in ancestors and extracts its w:rPr child.
 *
 * @param atom - The atom to extract properties from
 * @returns The w:rPr element, or null if not found
 *
 * @example
 * // For an atom inside <w:r><w:rPr><w:b/></w:rPr><w:t>text</w:t></w:r>
 * // Returns the <w:rPr><w:b/></w:rPr> element
 */
export declare function getRunPropertiesFromAtom(atom: ComparisonUnitAtom): Element | null;
/**
 * Lightweight property descriptor for normalized comparison.
 * These are NOT DOM Elements — they're ephemeral comparison objects.
 */
interface NormalizedProperty {
    tagName: string;
    attrs: [string, string][];
    text?: string;
}
interface NormalizedRPr {
    children: NormalizedProperty[];
}
/**
 * Check if two run properties are equal after normalization.
 */
export declare function areRunPropertiesEqual(rPr1: Element | null, rPr2: Element | null): boolean;
export { areRunPropertiesEqual as areNormalizedRunPropertiesEqual };
/**
 * Get the list of property names that changed between two run properties.
 *
 * Returns friendly names (e.g., "bold", "italic") when available,
 * otherwise returns the OOXML tag name.
 *
 * @param oldRPr - Old run properties element (or null)
 * @param newRPr - New run properties element (or null)
 * @returns Array of changed property names
 */
export declare function getChangedPropertyNames(oldRPr: Element | null, newRPr: Element | null): string[];
/**
 * Categorize changed properties into added, removed, and modified.
 *
 * @param oldRPr - Old run properties element (or null)
 * @param newRPr - New run properties element (or null)
 * @returns Object with added, removed, and changed arrays
 */
export declare function categorizePropertyChanges(oldRPr: Element | null, newRPr: Element | null): {
    added: string[];
    removed: string[];
    changed: string[];
};
/**
 * Detect format changes in a flat list of atoms.
 *
 * Runs after LCS and move detection to identify Equal atoms where the text
 * matches but formatting differs. Updates atoms in place with format change status.
 *
 * @param atoms - The atom list to process (modified in place)
 * @param settings - Format detection settings (optional, uses defaults)
 */
export declare function detectFormatChangesInAtomList(atoms: ComparisonUnitAtom[], settings?: FormatDetectionSettings): void;
/**
 * Options for generating format change markup.
 */
export interface FormatChangeMarkupOptions {
    /** Author name for revision tracking */
    author: string;
    /** Timestamp for revisions */
    dateTime: Date;
    /** ID for the w:rPrChange element */
    id: number;
}
/**
 * Merge format change markup into a run's existing rPr element.
 *
 * Adds the w:rPrChange element as the last child of w:rPr.
 *
 * @param runElement - The w:r element to modify
 * @param rPrChange - The w:rPrChange element to insert
 */
export declare function mergeFormatChangeIntoRun(runElement: Element, rPrChange: Element): void;
/**
 * Extract paragraph properties (w:pPr) from an element.
 *
 * @param paragraphElement - The w:p element
 * @returns The w:pPr element, or null if not found
 */
export declare function getParagraphProperties(paragraphElement: Element): Element | null;
/**
 * Paragraph property friendly names.
 */
export declare const PARAGRAPH_PROPERTY_FRIENDLY_NAMES: Record<string, string>;
/**
 * @deprecated Use areRunPropertiesEqual directly with Element params
 */
export declare function normalizeRunProperties(rPr: Element | null): NormalizedRPr;
/**
 * @deprecated Use getParagraphProperties directly
 */
export declare function normalizeParagraphProperties(pPr: Element | null): NormalizedRPr;
/**
 * @deprecated Removed — use generateFormatChangeMarkup with DOM approach
 */
export declare function generateFormatChangeMarkup(formatChange: FormatChangeInfo, options: FormatChangeMarkupOptions): Element;
//# sourceMappingURL=format-detection.d.ts.map