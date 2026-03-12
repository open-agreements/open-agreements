/**
 * Structural OOXML validators.
 *
 * General-purpose integrity checks for numbering, footnotes/endnotes,
 * and bookmarks. Used by both integration tests and the quality benchmark.
 */
export interface NumberingDiagnostics {
    missingNumIds: string[];
    missingAbstractNumIds: string[];
    invalidLevels: string[];
}
export interface NoteDiagnostics {
    missingFootnoteRefs: string[];
    missingEndnoteRefs: string[];
    duplicateFootnoteIds: string[];
    duplicateEndnoteIds: string[];
}
export interface BookmarkDiagnostics {
    unmatchedStartIds: string[];
    unmatchedEndIds: string[];
    duplicateStartIds: string[];
    duplicateEndIds: string[];
}
export declare function collectIds(root: Element, tagName: string, attributeName: string): {
    values: Set<string>;
    duplicates: string[];
};
export declare function validateNumberingIntegrity(documentXml: string, numberingXml: string | null): NumberingDiagnostics;
export declare function validateNoteIntegrity(documentXml: string, footnotesXml: string | null, endnotesXml: string | null): NoteDiagnostics;
export declare function validateBookmarkIntegrity(documentXml: string): BookmarkDiagnostics;
//# sourceMappingURL=structural.d.ts.map