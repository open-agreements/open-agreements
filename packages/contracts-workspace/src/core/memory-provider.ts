import { join, dirname } from 'node:path';
import type { FileInfo, WorkspaceProvider } from './provider.js';

export class MemoryProvider implements WorkspaceProvider {
  readonly root: string;
  private files = new Map<string, Buffer>();
  private directories = new Set<string>();
  private defaultMtime: Date;

  constructor(rootDir = '/memory-workspace', options?: { mtime?: Date }) {
    this.root = rootDir;
    this.defaultMtime = options?.mtime ?? new Date(0);
    this.directories.add('.');
  }

  private normalize(relativePath: string): string {
    return relativePath.replaceAll('\\', '/').replace(/\/$/u, '') || '.';
  }

  exists(relativePath: string): boolean {
    const key = this.normalize(relativePath);
    return this.files.has(key) || this.directories.has(key);
  }

  readFile(relativePath: string): Buffer {
    const key = this.normalize(relativePath);
    const content = this.files.get(key);
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${join(this.root, relativePath)}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    return content;
  }

  readTextFile(relativePath: string): string {
    return this.readFile(relativePath).toString('utf-8');
  }

  writeFile(relativePath: string, content: string | Buffer): void {
    const key = this.normalize(relativePath);
    const dir = dirname(key);
    if (dir !== '.' && !this.directories.has(dir)) {
      const error = new Error(`ENOENT: no such file or directory, open '${join(this.root, relativePath)}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    this.files.set(key, typeof content === 'string' ? Buffer.from(content, 'utf-8') : content);
  }

  mkdir(relativePath: string, options?: { recursive?: boolean }): void {
    const key = this.normalize(relativePath);
    if (this.directories.has(key)) {
      return;
    }

    if (options?.recursive) {
      const parts = key.split('/');
      let current = '';
      for (const part of parts) {
        current = current ? `${current}/${part}` : part;
        this.directories.add(current);
      }
    } else {
      const parent = dirname(key);
      if (parent !== '.' && !this.directories.has(parent)) {
        const error = new Error(`ENOENT: no such file or directory, mkdir '${join(this.root, relativePath)}'`) as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }
      this.directories.add(key);
    }
  }

  readdir(relativePath: string): FileInfo[] {
    const key = this.normalize(relativePath);
    if (!this.directories.has(key)) {
      const error = new Error(`ENOENT: no such file or directory, scandir '${join(this.root, relativePath)}'`) as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }

    const prefix = key === '.' ? '' : `${key}/`;
    const seen = new Set<string>();
    const results: FileInfo[] = [];

    for (const filePath of this.files.keys()) {
      if (!filePath.startsWith(prefix)) continue;
      const rest = filePath.slice(prefix.length);
      const firstSegment = rest.split('/')[0];
      if (rest.includes('/') || seen.has(firstSegment)) continue;
      seen.add(firstSegment);
      results.push({
        name: firstSegment,
        relativePath: prefix + firstSegment,
        isDirectory: false,
        mtime: this.defaultMtime,
        size: this.files.get(filePath)!.length,
      });
    }

    for (const dirPath of this.directories) {
      if (!dirPath.startsWith(prefix) || dirPath === key) continue;
      const rest = dirPath.slice(prefix.length);
      const firstSegment = rest.split('/')[0];
      if (rest.includes('/') || seen.has(firstSegment)) continue;
      seen.add(firstSegment);
      results.push({
        name: firstSegment,
        relativePath: prefix + firstSegment,
        isDirectory: true,
        mtime: this.defaultMtime,
        size: 0,
      });
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  stat(relativePath: string): FileInfo {
    const key = this.normalize(relativePath);
    const name = key.split('/').at(-1) ?? key;

    if (this.files.has(key)) {
      return {
        name,
        relativePath: key,
        isDirectory: false,
        mtime: this.defaultMtime,
        size: this.files.get(key)!.length,
      };
    }

    if (this.directories.has(key)) {
      return {
        name,
        relativePath: key,
        isDirectory: true,
        mtime: this.defaultMtime,
        size: 0,
      };
    }

    const error = new Error(`ENOENT: no such file or directory, stat '${join(this.root, relativePath)}'`) as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    throw error;
  }

  walk(relativePath: string): FileInfo[] {
    const key = this.normalize(relativePath);
    if (!this.directories.has(key)) {
      return [];
    }

    const prefix = key === '.' ? '' : `${key}/`;
    const results: FileInfo[] = [];

    for (const [filePath, content] of this.files) {
      if (!filePath.startsWith(prefix)) continue;
      const name = filePath.split('/').at(-1) ?? filePath;
      results.push({
        name,
        relativePath: filePath,
        isDirectory: false,
        mtime: this.defaultMtime,
        size: content.length,
      });
    }

    return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  /** Seed a file and its parent directories. Convenience for test setup. */
  seed(relativePath: string, content: string | Buffer): void {
    const key = this.normalize(relativePath);
    const dir = dirname(key);
    if (dir !== '.') {
      this.mkdir(dir, { recursive: true });
    }
    this.files.set(key, typeof content === 'string' ? Buffer.from(content, 'utf-8') : content);
  }
}
