export type ParagraphBookmark = {
    name: string;
    numericId: number;
};
export declare function getParagraphBookmarkId(p: Element): string | null;
export declare function cleanupInternalBookmarks(doc: Document): number;
export declare function insertParagraphBookmarks(doc: Document, _attachmentId: string): {
    indexedParagraphs: number;
};
export declare function insertSingleParagraphBookmark(doc: Document, p: Element): string;
export declare function findParagraphByBookmarkId(doc: Document, bookmarkId: string): Element | null;
//# sourceMappingURL=bookmarks.d.ts.map