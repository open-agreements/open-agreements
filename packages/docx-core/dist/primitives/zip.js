import JSZip from 'jszip';
function safeNonNegativeInt(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0)
        return 0;
    return Math.floor(parsed);
}
export class DocxZip {
    zip;
    constructor(zip) {
        this.zip = zip;
    }
    static async load(buffer) {
        const zip = await JSZip.loadAsync(buffer);
        return new DocxZip(zip);
    }
    readText(path) {
        const file = this.zip.file(path);
        if (!file)
            throw new Error(`Missing file in .docx: ${path}`);
        return file.async('text');
    }
    async readTextOrNull(path) {
        const file = this.zip.file(path);
        if (!file)
            return null;
        return file.async('text');
    }
    writeText(path, text) {
        this.zip.file(path, text);
    }
    hasFile(path) {
        return this.zip.file(path) !== null;
    }
    listFiles() {
        const files = [];
        this.zip.forEach((relativePath) => {
            files.push(relativePath);
        });
        return files;
    }
    async toBuffer() {
        const out = await this.zip.generateAsync({ type: 'nodebuffer' });
        return out;
    }
}
export async function createZipBuffer(files, opts) {
    const zip = new JSZip();
    for (const [name, value] of Object.entries(files)) {
        zip.file(name, value);
    }
    const out = await zip.generateAsync({
        type: 'nodebuffer',
        compression: opts?.compression ?? 'STORE',
        compressionOptions: { level: opts?.compressionLevel ?? 9 },
    });
    return out;
}
export async function readZipText(buffer, path) {
    const zip = await JSZip.loadAsync(buffer);
    const file = zip.file(path);
    if (!file)
        return null;
    return file.async('text');
}
export async function inspectZipEntries(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    return Object.values(zip.files).map((file) => {
        const stats = file._data;
        return {
            name: file.name,
            isDirectory: file.dir,
            compressedSize: safeNonNegativeInt(stats?.compressedSize),
            uncompressedSize: safeNonNegativeInt(stats?.uncompressedSize),
        };
    });
}
//# sourceMappingURL=zip.js.map