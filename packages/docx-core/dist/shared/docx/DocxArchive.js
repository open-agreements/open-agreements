/**
 * DOCX archive handler using JSZip.
 *
 * Handles reading and writing DOCX files as ZIP archives,
 * providing access to document.xml and other parts.
 */
import JSZip from 'jszip';
/** Standard paths within a DOCX archive */
export const DOCX_PATHS = {
    DOCUMENT: 'word/document.xml',
    STYLES: 'word/styles.xml',
    NUMBERING: 'word/numbering.xml',
    SETTINGS: 'word/settings.xml',
    COMMENTS: 'word/comments.xml',
    FOOTNOTES: 'word/footnotes.xml',
    ENDNOTES: 'word/endnotes.xml',
    RELS: 'word/_rels/document.xml.rels',
    CONTENT_TYPES: '[Content_Types].xml',
};
/**
 * Represents a DOCX file as a ZIP archive.
 *
 * Provides methods to read and modify the XML parts of a DOCX file.
 */
export class DocxArchive {
    zip;
    modified = new Set();
    constructor(zip) {
        this.zip = zip;
    }
    /**
     * Load a DOCX file from a Buffer.
     *
     * @param buffer - The DOCX file contents
     * @returns A DocxArchive instance
     */
    static async load(buffer) {
        const zip = await JSZip.loadAsync(buffer);
        // Verify this is a valid DOCX
        if (!zip.file(DOCX_PATHS.DOCUMENT)) {
            throw new Error('Invalid DOCX: missing word/document.xml');
        }
        if (!zip.file(DOCX_PATHS.CONTENT_TYPES)) {
            throw new Error('Invalid DOCX: missing [Content_Types].xml');
        }
        return new DocxArchive(zip);
    }
    /**
     * Create a new empty DOCX archive.
     *
     * @returns A new DocxArchive with minimal structure
     */
    static async create() {
        const zip = new JSZip();
        // Add minimal content types
        zip.file(DOCX_PATHS.CONTENT_TYPES, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
        // Add minimal document
        zip.file(DOCX_PATHS.DOCUMENT, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body/>
</w:document>`);
        // Add relationships
        zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
        return new DocxArchive(zip);
    }
    /**
     * Get the main document.xml content.
     */
    async getDocumentXml() {
        const file = this.zip.file(DOCX_PATHS.DOCUMENT);
        if (!file) {
            throw new Error('Document XML not found');
        }
        return file.async('string');
    }
    /**
     * Set the main document.xml content.
     */
    setDocumentXml(xml) {
        this.zip.file(DOCX_PATHS.DOCUMENT, xml);
        this.modified.add(DOCX_PATHS.DOCUMENT);
    }
    /**
     * Get an arbitrary file from the archive.
     *
     * @param path - Path within the archive
     * @returns File contents as string, or null if not found
     */
    async getFile(path) {
        const file = this.zip.file(path);
        if (!file) {
            return null;
        }
        return file.async('string');
    }
    /**
     * Set an arbitrary file in the archive.
     *
     * @param path - Path within the archive
     * @param content - File contents
     */
    setFile(path, content) {
        this.zip.file(path, content);
        this.modified.add(path);
    }
    /**
     * Check if a file exists in the archive.
     */
    hasFile(path) {
        return this.zip.file(path) !== null;
    }
    /**
     * List all files in the archive.
     */
    listFiles() {
        const files = [];
        this.zip.forEach((relativePath) => {
            files.push(relativePath);
        });
        return files;
    }
    /**
     * Get the styles.xml content if present.
     */
    async getStylesXml() {
        return this.getFile(DOCX_PATHS.STYLES);
    }
    /**
     * Get the numbering.xml content if present.
     */
    async getNumberingXml() {
        return this.getFile(DOCX_PATHS.NUMBERING);
    }
    /**
     * Save the archive to a Buffer.
     *
     * @returns The DOCX file as a Buffer
     */
    async save() {
        const content = await this.zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
        });
        return content;
    }
    /**
     * Clone this archive (deep copy).
     */
    async clone() {
        const buffer = await this.save();
        return DocxArchive.load(buffer);
    }
    /**
     * Get list of modified paths since loading.
     */
    getModifiedPaths() {
        return Array.from(this.modified);
    }
}
//# sourceMappingURL=DocxArchive.js.map