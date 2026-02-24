/**
 * Document Comparison Engine
 *
 * Provides multiple comparison approaches:
 * - Baseline A: WmlComparer wrapper (Docxodus WASM or dotnet CLI)
 * - Baseline B: Pure TypeScript (diff-match-patch + OOXML renderer) - paragraph level
 * - Atomizer: Pure TypeScript with atom-level comparison, move detection, format detection
 */
import { compareDocumentsBaselineB } from './baselines/diffmatch/pipeline.js';
import { compareDocumentsAtomizer } from './baselines/atomizer/pipeline.js';
/**
 * Compare two DOCX documents and produce a document with track changes.
 *
 * @param original - The original document (Buffer)
 * @param revised - The revised document (Buffer)
 * @param options - Comparison options
 * @returns The comparison result with track changes markup
 */
export async function compareDocuments(original, revised, options = {}) {
    const { engine = 'auto', author, date, reconstructionMode, premergeRuns } = options;
    // Atomizer engine (recommended) - character-level with move detection
    if (engine === 'atomizer' || engine === 'auto') {
        return compareDocumentsAtomizer(original, revised, {
            author,
            date,
            reconstructionMode,
            premergeRuns,
        });
    }
    // Diffmatch engine - paragraph-level (fallback)
    if (engine === 'diffmatch') {
        return compareDocumentsBaselineB(original, revised, { author, date });
    }
    // WmlComparer engine requires --docxodus option at CLI level
    throw new Error('WmlComparer engine is only available through the benchmark CLI. ' +
        'Use engine: "diffmatch" or "atomizer" for programmatic access.');
}
// Re-export shared utilities
export * from './shared/ooxml/namespaces.js';
export * from './shared/ooxml/types.js';
// Re-export core WmlComparer types
export * from './core-types.js';
// Re-export atomizer functions
export * from './atomizer.js';
// Re-export move detection
export * from './move-detection.js';
// Re-export format detection
export * from './format-detection.js';
// Re-export numbering utilities
export * from './numbering.js';
// Re-export footnote utilities
export * from './footnotes.js';
// Re-export primitives (editing, DOM helpers, document operations)
export * from './primitives/index.js';
//# sourceMappingURL=index.js.map