export type PreventDoubleElevationResult = {
    doubleElevationsFixed: number;
};
/**
 * Prevent double elevation on footnote/endnote reference styles.
 *
 * When a style has both w:vertAlign="superscript" and w:position > 0,
 * non-Windows renderers (Mac Pages, LibreOffice) stack the effects,
 * pushing reference numerals too high. This function removes or neutralizes
 * the redundant w:position on allowlisted styles.
 *
 * Scope: Only affects styles in targetStyleIds (default: FootnoteReference,
 * EndnoteReference). Never mutates parent/ancestor styles.
 */
export declare function preventDoubleElevation(stylesDoc: Document, options?: {
    targetStyleIds?: string[];
}): PreventDoubleElevationResult;
//# sourceMappingURL=prevent_double_elevation.d.ts.map