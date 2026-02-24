/**
 * Baseline A: WmlComparer via Docxodus WASM.
 *
 * Uses the Docxodus npm package's WASM-based comparison in Node.js.
 *
 * Note: WASM support in Node.js requires additional setup:
 * 1. WASM files must be served or loaded from the filesystem
 * 2. May need polyfills for browser APIs used by Blazor WASM
 *
 * This implementation is a placeholder - full WASM integration requires
 * building Docxodus and hosting the WASM files.
 */
import type { CompareResult } from '../../index.js';
export interface WasmOptions {
    /** Author name for revisions. Default: "Comparison" */
    author?: string;
    /** Detail threshold (0.0-1.0, lower = more detailed). Default: 0.15 */
    detailThreshold?: number;
    /** Case-insensitive comparison. Default: false */
    caseInsensitive?: boolean;
    /** Path to WASM files directory. */
    wasmPath?: string;
}
/**
 * Initialize the WASM runtime.
 *
 * Must be called before using compareWithWasm().
 *
 * @param wasmPath - Path to the directory containing WASM files
 */
export declare function initializeWasm(wasmPath: string): Promise<void>;
/**
 * Check if WASM runtime is initialized.
 */
export declare function isWasmInitialized(): boolean;
/**
 * Compare two DOCX documents using WASM.
 *
 * @param original - Original document as Buffer
 * @param revised - Revised document as Buffer
 * @param options - WASM options
 * @returns Comparison result with track changes
 */
export declare function compareWithWasm(original: Buffer, revised: Buffer, options?: WasmOptions): Promise<CompareResult>;
/**
 * Check if WASM is available and can be used in this environment.
 *
 * Note: WASM in Node.js has limitations compared to browser environments.
 */
export declare function isWasmAvailable(): Promise<boolean>;
//# sourceMappingURL=DocxodusWasm.d.ts.map