export interface FileInfo {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  mtime: Date;
  size: number;
}

export interface WorkspaceProvider {
  readonly root: string;
  exists(relativePath: string): boolean;
  readFile(relativePath: string): Buffer;
  readTextFile(relativePath: string): string;
  writeFile(relativePath: string, content: string | Buffer): void;
  mkdir(relativePath: string, options?: { recursive?: boolean }): void;
  readdir(relativePath: string): FileInfo[];
  stat(relativePath: string): FileInfo;
  walk(relativePath: string): FileInfo[];
}
