import { type CompareOptions } from '../index.js';
export interface ParsedCompareCliArgs {
    originalPath: string;
    revisedPath: string;
    outputPath?: string;
    options: {
        engine: NonNullable<CompareOptions['engine']>;
        reconstructionMode: 'inplace' | 'rebuild';
        author: string;
        premergeRuns: boolean;
    };
}
export interface CompareCliHelpResult {
    help: true;
    text: string;
}
export interface CompareCliRunResult {
    help?: false;
    output: string;
    engine: string;
    mode: 'inplace' | 'rebuild';
    bytes: number;
    stats: unknown;
}
export type CompareCliResult = CompareCliHelpResult | CompareCliRunResult;
export declare function parseCompareCliArgs(argv: string[]): ParsedCompareCliArgs;
export declare function runCompareCli(argv?: string[]): Promise<CompareCliResult>;
//# sourceMappingURL=compare-two.d.ts.map