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
 * Check if debug logging is enabled for a given module.
 */
function isDebugEnabled(module) {
    const debugEnv = process.env.DOCX_COMPARISON_DEBUG;
    if (!debugEnv)
        return false;
    if (debugEnv === '1' || debugEnv === 'true' || debugEnv === '*')
        return true;
    return debugEnv.split(',').includes(module);
}
/**
 * Format a log message with timestamp and module.
 */
function formatMessage(level, module, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}`;
}
/**
 * Log a debug message (only when DOCX_COMPARISON_DEBUG is enabled).
 *
 * @param module - The module name (e.g., 'inPlaceModifier', 'atomizer')
 * @param message - The message to log
 * @param data - Optional data to include
 */
export function debug(module, message, data) {
    if (!isDebugEnabled(module))
        return;
    const formatted = formatMessage('debug', module, message);
    if (data !== undefined) {
        console.log(formatted, data);
    }
    else {
        console.log(formatted);
    }
}
/**
 * Log a warning message (always shown, but respects log level).
 * These indicate potential issues that don't prevent operation but may affect results.
 *
 * @param module - The module name
 * @param message - The warning message
 * @param data - Optional data to include
 */
export function warn(module, message, data) {
    const formatted = formatMessage('warn', module, message);
    if (data !== undefined) {
        console.warn(formatted, data);
    }
    else {
        console.warn(formatted);
    }
}
/**
 * Log an error message (always shown).
 *
 * @param module - The module name
 * @param message - The error message
 * @param data - Optional data to include
 */
export function error(module, message, data) {
    const formatted = formatMessage('error', module, message);
    if (data !== undefined) {
        console.error(formatted, data);
    }
    else {
        console.error(formatted);
    }
}
//# sourceMappingURL=debug.js.map