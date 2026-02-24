/**
 * extract_revisions — walk tracked-change markup in a document body and
 * return structured per-paragraph revision records with before/after text.
 *
 * Algorithm:
 * 1. Clone DOM twice → acceptChanges() on one, rejectChanges() on the other
 * 2. Walk all w:p in the *original* tracked DOM (including inside w:tc table cells)
 * 3. For each paragraph with revision wrappers, look up before_text (rejected clone)
 *    and after_text (accepted clone) by _bk_* bookmark ID
 * 4. Collect individual revision entries with type, text, author
 * 5. Join comments by anchoredParagraphId
 * 6. Apply offset/limit pagination
 */
import type { Comment } from './comments.js';
export type RevisionType = 'INSERTION' | 'DELETION' | 'MOVE_FROM' | 'MOVE_TO' | 'FORMAT_CHANGE';
export type RevisionEntry = {
    type: RevisionType;
    text: string;
    author: string;
};
export type RevisionComment = {
    author: string;
    text: string;
    date: string | null;
    replies?: RevisionComment[];
};
export type ParagraphRevision = {
    para_id: string;
    before_text: string;
    after_text: string;
    revisions: RevisionEntry[];
    comments: RevisionComment[];
};
export type ExtractRevisionsResult = {
    changes: ParagraphRevision[];
    total_changes: number;
    has_more: boolean;
};
/**
 * Extract structured revision data from a document with tracked changes.
 *
 * @param doc - The original document DOM with tracked changes
 * @param comments - Comments from getComments() (with anchoredParagraphId resolved)
 * @param opts - Pagination options: offset (0-based) and limit
 */
export declare function extractRevisions(doc: Document, comments: Comment[], opts?: {
    offset?: number;
    limit?: number;
}): ExtractRevisionsResult;
//# sourceMappingURL=extract_revisions.d.ts.map