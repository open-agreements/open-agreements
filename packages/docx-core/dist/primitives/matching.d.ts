export type MatchMode = 'exact' | 'quote_normalized' | 'flexible_whitespace' | 'quote_optional';
export type UniqueSubstringMatchResult = {
    status: 'not_found';
} | {
    status: 'multiple';
    mode: MatchMode;
    matchCount: number;
} | {
    status: 'unique';
    mode: MatchMode;
    matchCount: 1;
    start: number;
    end: number;
    matchedText: string;
};
export declare function findUniqueSubstringMatch(haystack: string, needle: string): UniqueSubstringMatchResult;
//# sourceMappingURL=matching.d.ts.map