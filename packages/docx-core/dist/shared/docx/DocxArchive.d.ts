/**
 * DOCX archive handler using JSZip.
 *
 * Handles reading and writing DOCX files as ZIP archives,
 * providing access to document.xml and other parts.
 */
/** Standard paths within a DOCX archive */
export declare const DOCX_PATHS: {
    readonly DOCUMENT: "word/document.xml";
    readonly STYLES: "word/styles.xml";
    readonly NUMBERING: "word/numbering.xml";
    readonly SETTINGS: "word/settings.xml";
    readonly COMMENTS: "word/comments.xml";
    readonly FOOTNOTES: "word/footnotes.xml";
    readonly ENDNOTES: "word/endnotes.xml";
    readonly RELS: "word/_rels/document.xml.rels";
    readonly CONTENT_TYPES: "[Content_Types].xml";
};
/**
 * Represents a DOCX file as a ZIP archive.
 *
 * Provides methods to read and modify the XML parts of a DOCX file.
 */
export declare class DocxArchive {
    private zip;
    private modified;
    private constructor();
    /**
     * Load a DOCX file from a Buffer.
     *
     * @param buffer - The DOCX file contents
     * @returns A DocxArchive instance
     */
    static load(buffer: Buffer): Promise<DocxArchive>;
    /**
     * Create a new empty DOCX archive.
     *
     * @returns A new DocxArchive with minimal structure
     */
    static create(): Promise<DocxArchive>;
    /**
     * Get the main document.xml content.
     */
    getDocumentXml(): Promise<string>;
    /**
     * Set the main document.xml content.
     */
    setDocumentXml(xml: string): void;
    /**
     * Get an arbitrary file from the archive.
     *
     * @param path - Path within the archive
     * @returns File contents as string, or null if not found
     */
    getFile(path: string): Promise<string | null>;
    /**
     * Set an arbitrary file in the archive.
     *
     * @param path - Path within the archive
     * @param content - File contents
     */
    setFile(path: string, content: string): void;
    /**
     * Check if a file exists in the archive.
     */
    hasFile(path: string): boolean;
    /**
     * List all files in the archive.
     */
    listFiles(): string[];
    /**
     * Get the styles.xml content if present.
     */
    getStylesXml(): Promise<string | null>;
    /**
     * Get the numbering.xml content if present.
     */
    getNumberingXml(): Promise<string | null>;
    /**
     * Save the archive to a Buffer.
     *
     * @returns The DOCX file as a Buffer
     */
    save(): Promise<Buffer>;
    /**
     * Clone this archive (deep copy).
     */
    clone(): Promise<DocxArchive>;
    /**
     * Get list of modified paths since loading.
     */
    getModifiedPaths(): string[];
}
//# sourceMappingURL=DocxArchive.d.ts.map