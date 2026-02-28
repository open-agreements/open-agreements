import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function appendJsonl(filePath: string, record: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf-8');
}

export function readJsonl<T = unknown>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf-8').trim();
  if (!content) return [];
  return content.split('\n').map((line) => JSON.parse(line) as T);
}
