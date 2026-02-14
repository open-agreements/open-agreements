import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { FileInfo, WorkspaceProvider } from './provider.js';

export class FilesystemProvider implements WorkspaceProvider {
  readonly root: string;

  constructor(rootDir: string) {
    this.root = rootDir;
  }

  private resolve(relativePath: string): string {
    return join(this.root, relativePath);
  }

  exists(relativePath: string): boolean {
    return existsSync(this.resolve(relativePath));
  }

  readFile(relativePath: string): Buffer {
    return readFileSync(this.resolve(relativePath));
  }

  readTextFile(relativePath: string): string {
    return readFileSync(this.resolve(relativePath), 'utf-8');
  }

  writeFile(relativePath: string, content: string | Buffer): void {
    const encoding = typeof content === 'string' ? 'utf-8' : undefined;
    writeFileSync(this.resolve(relativePath), content, encoding ? { encoding } : {});
  }

  mkdir(relativePath: string, options?: { recursive?: boolean }): void {
    mkdirSync(this.resolve(relativePath), options);
  }

  readdir(relativePath: string): FileInfo[] {
    const fullPath = this.resolve(relativePath);
    const entries = readdirSync(fullPath, { withFileTypes: true });
    return entries.map((entry) => {
      const entryRelative = join(relativePath, entry.name).replaceAll('\\', '/');
      const entryFull = join(fullPath, entry.name);
      const stats = statSync(entryFull);
      return {
        name: entry.name,
        relativePath: entryRelative,
        isDirectory: entry.isDirectory(),
        mtime: stats.mtime,
        size: stats.size,
      };
    });
  }

  stat(relativePath: string): FileInfo {
    const fullPath = this.resolve(relativePath);
    const stats = statSync(fullPath);
    const name = relativePath.split('/').at(-1) ?? relativePath;
    return {
      name,
      relativePath,
      isDirectory: stats.isDirectory(),
      mtime: stats.mtime,
      size: stats.size,
    };
  }

  walk(relativePath: string): FileInfo[] {
    return this.walkRecursive(this.resolve(relativePath), relativePath);
  }

  private walkRecursive(absolutePath: string, relPath: string): FileInfo[] {
    try {
      const entries = readdirSync(absolutePath, { withFileTypes: true });
      const output: FileInfo[] = [];

      for (const entry of entries) {
        const entryAbsolute = join(absolutePath, entry.name);
        const entryRelative = join(relPath, entry.name).replaceAll('\\', '/');

        if (entry.isDirectory()) {
          output.push(...this.walkRecursive(entryAbsolute, entryRelative));
        } else if (entry.isFile()) {
          const stats = statSync(entryAbsolute);
          output.push({
            name: entry.name,
            relativePath: entryRelative,
            isDirectory: false,
            mtime: stats.mtime,
            size: stats.size,
          });
        }
      }

      return output;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}

export function createProvider(rootDir: string): WorkspaceProvider {
  return new FilesystemProvider(rootDir);
}
