import { afterEach, describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';
import { createNumberingRenderCopy } from '../src/core/field-selector/numbering-render-copy.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const it = itAllure.epic('Filling & Rendering');
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'glyph-font-')); dirs.push(dir);
  const input = join(dir, 'original.docx'), output = join(dir, 'preview.render.docx');
  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from(`<w:document xmlns:w="${W}"><w:body><w:p><w:bookmarkStart w:id="1" w:name="anchor"/><w:r><w:t>Alpha</w:t><w:noBreakHyphen/><w:t>Beta‑Gamma</w:t></w:r><w:bookmarkEnd w:id="1"/></w:p></w:body></w:document>`));
  zip.addFile('word/styles.xml', Buffer.from(`<w:styles xmlns:w="${W}"/>`));
  zip.writeZip(input);
  return { dir, input, output, zip };
}

describe('render-copy glyph fallback API and CLI', () => {
  it('leaves default behavior and original bytes unchanged without numbering', () => {
    const f = fixture(), original = readFileSync(f.input);
    const result = createNumberingRenderCopy(f.input, f.output);
    expect(result).not.toHaveProperty('glyphFallback');
    expect(new AdmZip(f.output).readAsText('word/document.xml')).toBe(f.zip.readAsText('word/document.xml'));
    expect(readFileSync(f.input)).toEqual(original);
  });

  it('uses the public CLI option and emits a bound receipt without requiring a numbering part', () => {
    const f = fixture(), original = readFileSync(f.input);
    const receipt = JSON.parse(execFileSync(process.execPath, ['bin/open-agreements.js', 'field-selector', 'render-copy', f.input,
      '-o', f.output, '--nonbreaking-hyphen-font', 'Verified Serif'], { encoding: 'utf8' }));
    expect(receipt.glyphFallback).toEqual({ fontFamily: 'Verified Serif', codePoint: 'U+2011', replacements: 2, parts: ['word/document.xml'] });
    const out = new AdmZip(f.output);
    expect(out.readAsText('word/styles.xml')).toBe(f.zip.readAsText('word/styles.xml'));
    const doc = new DOMParser().parseFromString(out.readAsText('word/document.xml'), 'text/xml');
    expect(doc.getElementsByTagNameNS(W, 'noBreakHyphen')).toHaveLength(0);
    expect(Array.from(doc.getElementsByTagNameNS(W, 't')).map(t => t.textContent).join('')).toBe('Alpha‑Beta‑Gamma');
    expect(readFileSync(f.input)).toEqual(original);
    expect(() => createNumberingRenderCopy(f.input, f.output, { nonbreakingHyphenFont: 'Verified Serif' })).toThrow(/EEXIST/);
  });

  it.each(['header1.xml', 'footer1.xml', 'footnotes.xml', 'endnotes.xml', 'comments.xml', 'custom-story.xml'])('rejects unsupported glyph story %s before output', name => {
    const f = fixture();
    const root = name.startsWith('header') || name === 'custom-story.xml' ? 'hdr' : name.startsWith('footer') ? 'ftr' : name.replace('.xml', '');
    f.zip.addFile(`word/${name}`, Buffer.from(`<w:${root} xmlns:w="${W}"><w:p><w:r><w:t>Other‑story</w:t></w:r></w:p></w:${root}>`));
    f.zip.writeZip(f.input);
    expect(() => createNumberingRenderCopy(f.input, f.output, { nonbreakingHyphenFont: 'Verified Serif' })).toThrow(/nonbreaking hyphens.*unsupported/);
    expect(existsSync(f.output)).toBe(false);
  });

  it('rejects bad font input before creating output', () => {
    const f = fixture();
    expect(() => createNumberingRenderCopy(f.input, f.output, { nonbreakingHyphenFont: 'Bad\nFont' })).toThrow(/font must/);
    expect(existsSync(f.output)).toBe(false);
  });
});
