/**
 * validate_document — structural integrity checks for OOXML documents.
 *
 * Runs before download/pack to catch common issues that could produce
 * corrupt or unexpected output. Returns warnings (non-blocking) that are
 * surfaced in response metadata.
 */
export type ValidationWarning = {
    code: string;
    message: string;
    /** Optional element context (e.g. bookmark name, paragraph index). */
    context?: string;
};
export type ValidateDocumentResult = {
    warnings: ValidationWarning[];
    isValid: boolean;
};
/**
 * Validate structural integrity of the document body.
 * Returns warnings for issues that may cause problems during download/pack.
 * All checks are non-destructive and read-only.
 */
export declare function validateDocument(doc: Document): ValidateDocumentResult;
//# sourceMappingURL=validate_document.d.ts.map