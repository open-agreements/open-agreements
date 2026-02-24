/**
 * Baseline A: WmlComparer via dotnet CLI.
 *
 * Shells out to Docxodus's redline tool to perform document comparison.
 * Requires .NET 8+ and Docxodus to be available.
 */
import type { CompareResult } from '../../index.js';
export interface DotnetCliOptions {
    /** Author name for revisions. Default: "Comparison" */
    author?: string;
    /** Path to the redline executable or project. Default: uses global 'dotnet run' */
    redlinePath?: string;
    /** Path to Docxodus repository if using 'dotnet run'. */
    docxodusPath?: string;
    /** Path to dotnet executable. Default: 'dotnet' */
    dotnetPath?: string;
    /** Timeout in milliseconds. Default: 60000 (1 minute) */
    timeout?: number;
}
/**
 * Check if dotnet CLI is available.
 */
export declare function isDotnetAvailable(dotnetPath?: string): Promise<boolean>;
/**
 * Compare two DOCX documents using the dotnet CLI.
 *
 * @param original - Original document as Buffer
 * @param revised - Revised document as Buffer
 * @param options - CLI options
 * @returns Comparison result with track changes
 */
export declare function compareWithDotnet(original: Buffer, revised: Buffer, options?: DotnetCliOptions): Promise<CompareResult>;
/**
 * Check if Docxodus redline tool is available.
 *
 * @param docxodusPath - Path to Docxodus repository
 * @param dotnetPath - Path to dotnet executable
 */
export declare function isRedlineAvailable(docxodusPath?: string, dotnetPath?: string): Promise<boolean>;
//# sourceMappingURL=DotnetCli.d.ts.map