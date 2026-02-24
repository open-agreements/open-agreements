/**
 * Numbering Integration
 *
 * Applies numbering resolution to atoms before comparison.
 * This allows detection of list renumbering changes.
 *
 * Note: Full implementation would parse numbering.xml and inject
 * computed list labels as virtual tokens. For v1, this is a stub
 * that can be extended later.
 */
import type { ComparisonUnitAtom, ListLevelInfo } from '../../core-types.js';
/**
 * Options for numbering integration.
 */
export interface NumberingIntegrationOptions {
    /** Enable numbering virtualization. Default: true */
    enabled: boolean;
}
/**
 * Default options for numbering integration.
 */
export declare const DEFAULT_NUMBERING_OPTIONS: NumberingIntegrationOptions;
/**
 * Parsed numbering definitions from numbering.xml.
 */
interface NumberingDefinitions {
    /** Abstract numbering definitions keyed by abstractNumId */
    abstractNums: Map<string, ListLevelInfo[]>;
    /** Num definitions mapping numId to abstractNumId */
    numToAbstractNum: Map<string, string>;
}
/**
 * Parse numbering.xml to extract numbering definitions.
 *
 * @param numberingXml - Raw numbering.xml content
 * @returns Parsed numbering definitions
 */
export declare function parseNumberingXml(numberingXml: string): NumberingDefinitions;
/**
 * Apply numbering labels to atoms for comparison.
 *
 * This is a stub implementation. Full implementation would:
 * 1. Parse numbering.xml
 * 2. Walk through paragraphs tracking numbering state
 * 3. Compute the rendered list label for each numbered paragraph
 * 4. Inject the label as a virtual atom or modify the hash
 *
 * @param atoms - Atoms to process
 * @param numberingXml - Raw numbering.xml content (optional)
 * @param options - Numbering integration options
 */
export declare function virtualizeNumberingLabels(atoms: ComparisonUnitAtom[], numberingXml?: string, options?: NumberingIntegrationOptions): void;
/**
 * Check if an atom is the first atom in its paragraph.
 * Used to determine when to process numbering.
 */
export declare function isFirstAtomInParagraph(atom: ComparisonUnitAtom, previousAtom: ComparisonUnitAtom | null): boolean;
export {};
//# sourceMappingURL=numberingIntegration.d.ts.map