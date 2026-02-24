export type ZipCompression = 'STORE' | 'DEFLATE';
export type ZipEntryInfo = {
    name: string;
    isDirectory: boolean;
    compressedSize: number;
    uncompressedSize: number;
};
export declare class DocxZip {
    private zip;
    private constructor();
    static load(buffer: Buffer): Promise<DocxZip>;
    readText(path: string): Promise<string>;
    readTextOrNull(path: string): Promise<string | null>;
    writeText(path: string, text: string): void;
    hasFile(path: string): boolean;
    listFiles(): string[];
    toBuffer(): Promise<Buffer>;
}
export declare function createZipBuffer(files: Record<string, string | Buffer | Uint8Array>, opts?: {
    compression?: ZipCompression;
    compressionLevel?: number;
}): Promise<Buffer>;
export declare function readZipText(buffer: Buffer, path: string): Promise<string | null>;
export declare function inspectZipEntries(buffer: Buffer): Promise<ZipEntryInfo[]>;
//# sourceMappingURL=zip.d.ts.map