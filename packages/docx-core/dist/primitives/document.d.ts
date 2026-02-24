import { type ReplacementPart } from './text.js';
import { type DocumentStyles, type DocumentViewNode } from './document_view.js';
import { type ParagraphSpacingMutation, type ParagraphSpacingMutationResult, type TableCellPaddingMutation, type TableCellPaddingMutationResult, type TableRowHeightMutation, type TableRowHeightMutationResult } from './layout.js';
import { type MergeRunsResult } from './merge_runs.js';
import { type ValidateDocumentResult } from './validate_document.js';
import { type AcceptChangesResult } from './accept_changes.js';
import { type AddCommentResult, type AddCommentReplyResult, type Comment } from './comments.js';
import { type Footnote, type AddFootnoteResult } from './footnotes.js';
export type NormalizationResult = {
    runsMerged: number;
    proofErrRemoved: number;
    wrappersConsolidated: number;
    doubleElevationsFixed: number;
};
export type ParagraphRef = {
    id: string;
    text: string;
};
export declare class DocxDocument {
    private zip;
    private documentXml;
    private stylesXml;
    private numberingXml;
    private footnotesXml;
    private relsMap;
    private dirty;
    private documentViewCache;
    private constructor();
    static load(buffer: Buffer): Promise<DocxDocument>;
    getParagraphs(): Element[];
    getParagraphElementById(bookmarkId: string): Element | null;
    getParagraphTextById(bookmarkId: string): string | null;
    insertParagraphBookmarks(attachmentId: string): {
        paragraphCount: number;
    };
    /**
     * Normalize the document by merging format-identical adjacent runs and
     * consolidating adjacent same-author tracked-change wrappers.
     * Should be called BEFORE bookmark allocation.
     */
    normalize(): NormalizationResult;
    /**
     * Validate structural integrity of the document.
     * Non-destructive, read-only check.
     */
    validate(): ValidateDocumentResult;
    /**
     * Accept all tracked changes in the document body, producing a clean
     * document with no revision markup.
     */
    acceptChanges(): AcceptChangesResult;
    removeJuniorBookmarks(): number;
    readParagraphs(opts?: {
        nodeIds?: string[];
        offset?: number;
        limit?: number;
    }): {
        paragraphs: ParagraphRef[];
        totalParagraphs: number;
    };
    buildDocumentView(opts?: {
        includeSemanticTags?: boolean;
        showFormatting?: boolean;
    }): {
        nodes: DocumentViewNode[];
        styles: DocumentStyles;
    };
    replaceText(params: {
        targetParagraphId: string;
        findText: string;
        replaceText: string | ReplacementPart[];
    }): void;
    insertParagraph(params: {
        positionalAnchorNodeId: string;
        relativePosition: 'BEFORE' | 'AFTER';
        newText: string;
        newParagraphId?: string;
    }): {
        newParagraphId: string;
        newParagraphIds: string[];
    };
    setParagraphSpacing(mutation: ParagraphSpacingMutation): ParagraphSpacingMutationResult;
    setTableRowHeight(mutation: TableRowHeightMutation): TableRowHeightMutationResult;
    setTableCellPadding(mutation: TableCellPaddingMutation): TableCellPaddingMutationResult;
    /**
     * Merge format-identical adjacent runs only (no redline simplification).
     * Useful as a pre-processing step before text search when runs may be fragmented.
     */
    mergeRunsOnly(): MergeRunsResult;
    /**
     * Add a root comment anchored to a text range within a paragraph.
     *
     * Bootstraps comment parts if missing (idempotent).
     * Returns the allocated comment ID.
     */
    addComment(params: {
        paragraphId: string;
        start: number;
        end: number;
        author: string;
        text: string;
        initials?: string;
    }): Promise<AddCommentResult>;
    /**
     * Add a threaded reply to an existing comment.
     *
     * Bootstraps comment parts if missing (idempotent).
     * Returns the allocated comment ID and parent ID.
     */
    addCommentReply(params: {
        parentCommentId: number;
        author: string;
        text: string;
        initials?: string;
    }): Promise<AddCommentReplyResult>;
    getComments(): Promise<Comment[]>;
    getComment(commentId: number): Promise<Comment | null>;
    deleteComment(params: {
        commentId: number;
    }): Promise<void>;
    private refreshFootnotesXml;
    getFootnotes(): Promise<Footnote[]>;
    getFootnote(noteId: number): Promise<Footnote | null>;
    /**
     * Add a footnote anchored to a paragraph, optionally after specific text.
     *
     * Bootstraps footnote parts if missing (idempotent).
     * Returns the allocated footnote ID.
     */
    addFootnote(params: {
        paragraphId: string;
        afterText?: string;
        text: string;
    }): Promise<AddFootnoteResult>;
    /**
     * Update the text content of an existing footnote.
     */
    updateFootnoteText(params: {
        noteId: number;
        newText: string;
    }): Promise<void>;
    /**
     * Delete a footnote and its references from the document.
     */
    deleteFootnote(params: {
        noteId: number;
    }): Promise<void>;
    /**
     * Return a deep clone of the internal document.xml DOM.
     * Callers can mutate the clone (e.g. acceptChanges / rejectChanges)
     * without affecting session state.
     */
    getDocumentXmlClone(): Document;
    /**
     * Return a deep clone of the comments.xml DOM, or null if the document
     * has no comments part.
     */
    getCommentsXmlClone(): Promise<Document | null>;
    toBuffer(opts?: {
        cleanBookmarks?: boolean;
    }): Promise<{
        buffer: Buffer;
        bookmarksRemoved: number;
    }>;
}
//# sourceMappingURL=document.d.ts.map