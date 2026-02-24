/**
 * comments — OOXML comment insertion, threaded replies, and part bootstrapping.
 *
 * Creates comment XML parts when missing, inserts comment range markers,
 * and supports threaded replies via commentsExtended.xml.
 */
import { DocxZip } from './zip.js';
export type BootstrapResult = {
    partsCreated: string[];
};
/**
 * Create missing comment XML parts when a DOCX has no comment infrastructure.
 * Idempotent — skips parts that already exist.
 */
export declare function bootstrapCommentParts(zip: DocxZip): Promise<BootstrapResult>;
export type AddCommentParams = {
    paragraphEl: Element;
    start: number;
    end: number;
    author: string;
    text: string;
    initials?: string;
};
export type AddCommentResult = {
    commentId: number;
};
/**
 * Insert a root comment anchored to a text range within a paragraph.
 *
 * - Allocates next comment ID from existing comments.xml
 * - Inserts commentRangeStart/commentRangeEnd markers in document body
 * - Inserts commentReference run after range end
 * - Adds comment entry to comments.xml
 * - Adds author to people.xml if not present
 */
export declare function addComment(documentXml: Document, zip: DocxZip, params: AddCommentParams): Promise<AddCommentResult>;
export type AddCommentReplyParams = {
    parentCommentId: number;
    author: string;
    text: string;
    initials?: string;
};
export type AddCommentReplyResult = {
    commentId: number;
    parentCommentId: number;
};
/**
 * Add a threaded reply to an existing comment.
 *
 * Replies don't have range markers in the document body.
 * Thread linkage is stored in commentsExtended.xml via paraIdParent.
 */
export declare function addCommentReply(_documentXml: Document, zip: DocxZip, params: AddCommentReplyParams): Promise<AddCommentReplyResult>;
export type Comment = {
    id: number;
    author: string;
    date: string;
    initials: string;
    text: string;
    paragraphId: string | null;
    anchoredParagraphId: string | null;
    replies: Comment[];
};
/**
 * Read all comments from a document, building a threaded tree.
 *
 * Root comments are returned at the top level; replies are nested under
 * their parent's `replies` array. Thread linkage is resolved via
 * commentsExtended.xml paraIdParent relationships.
 */
export declare function getComments(zip: DocxZip, documentXml: Document): Promise<Comment[]>;
/**
 * Get a single comment by ID, searching the full tree including replies.
 */
export declare function getComment(zip: DocxZip, documentXml: Document, commentId: number): Promise<Comment | null>;
/**
 * Delete a comment and all its descendants from the document.
 *
 * - Removes comment elements from comments.xml
 * - Removes commentEx entries from commentsExtended.xml (if present)
 * - For root comments: removes commentRangeStart, commentRangeEnd, and
 *   commentReference from document.xml (element-level; run removed only if empty)
 * - Transitive cascade: deleting any node also deletes all descendants
 */
export declare function deleteComment(documentXml: Document, zip: DocxZip, params: {
    commentId: number;
}): Promise<void>;
//# sourceMappingURL=comments.d.ts.map