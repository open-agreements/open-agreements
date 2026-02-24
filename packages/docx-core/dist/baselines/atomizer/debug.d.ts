/**
 * Debug Logging Utility
 *
 * Provides controlled debug logging for the docx-comparison package.
 * Debug output is controlled by the DOCX_COMPARISON_DEBUG environment variable.
 *
 * Usage:
 *   import { debug, warn } from './debug.js';
 *   debug('inPlaceModifier', 'Processing atom', { status: atom.correlationStatus });
 *   warn('inPlaceModifier', 'Target paragraph is null');
 *
 * Enable debug output:
 *   DOCX_COMPARISON_DEBUG=1 npm test
 *   DOCX_COMPARISON_DEBUG=inPlaceModifier,atomizer npm test  // Enable specific modules
 */
/**
 * Log a debug message (only when DOCX_COMPARISON_DEBUG is enabled).
 *
 * @param module - The module name (e.g., 'inPlaceModifier', 'atomizer')
 * @param message - The message to log
 * @param data - Optional data to include
 */
export declare function debug(module: string, message: string, data?: unknown): void;
/**
 * Log a warning message (always shown, but respects log level).
 * These indicate potential issues that don't prevent operation but may affect results.
 *
 * @param module - The module name
 * @param message - The warning message
 * @param data - Optional data to include
 */
export declare function warn(module: string, message: string, data?: unknown): void;
/**
 * Log an error message (always shown).
 *
 * @param module - The module name
 * @param message - The error message
 * @param data - Optional data to include
 */
export declare function error(module: string, message: string, data?: unknown): void;
//# sourceMappingURL=debug.d.ts.map