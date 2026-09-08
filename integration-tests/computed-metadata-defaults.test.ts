import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { afterEach, describe, expect, vi } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { runFieldSelector, extractAllText } from '../src/core/field-selector/index.js';
import { prepareFillData } from '../src/core/fill-pipeline.js';
const it = itAllure.epic('Filling & Rendering');
const roots: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true }); });
function fixture(dateDefault = '2026-09-08', choicesDefault = '["one"]') {
    const root = mkdtempSync(join(tmpdir(), 'oa-computed-defaults-'));
    roots.push(root);
    const dir = join(root, 'templates/synthetic/defaults-fixture');
    mkdirSync(dir, { recursive: true });
    const fields = [
        { name: 'mode', type: 'enum', options: ['standard', 'special'], default: 'standard' },
        { name: 'days', type: 'string', default: '120' },
        { name: 'enabled', type: 'boolean', default: 'true' },
        { name: 'date', type: 'date', default: dateDefault },
        { name: 'numeric_default', type: 'number', default: '0' },
        { name: 'choices', type: 'multiselect', options: ['one', 'two'], default: choicesDefault },
        { name: 'blank_default', type: 'string', default: '' },
        { name: 'absent', type: 'string' },
        { name: 'derived', type: 'string', default: 'metadata must not win' },
        { name: 'profile_owned', type: 'string', default: 'metadata must not win' },
    ].map(f => ({ ...f, description: f.name }));
    writeFileSync(join(dir, 'metadata.yaml'), JSON.stringify({ name: 'Synthetic defaults fixture', artifact_type: 'field-selector', source_url: 'https://example.com/source.docx', source_version: '1', license_note: 'Synthetic', fields }));
    writeFileSync(join(dir, 'computed.json'), JSON.stringify({ version: '1.0', defaults: { profile_owned: 'computed default' }, rules: [
            { id: 'standard', when_all: [{ field: 'mode', op: 'eq', value: 'standard' }, { field: 'enabled', op: 'eq', value: true }], set_fill: { derived: 'Standard ${days} days on ${date}' } },
            { id: 'special', when_all: [{ field: 'mode', op: 'eq', value: 'special' }], set_fill: { derived: 'Special ${days} days' } },
        ] }));
    writeFileSync(join(dir, 'replacements.json'), JSON.stringify({ '[Clause]': '{derived}', '[Profile]': '{profile_owned}', '[Days]': '{days}' }));
    const zip = new AdmZip();
    zip.addFile('[Content_Types].xml', Buffer.from('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
    zip.addFile('word/document.xml', Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>[Clause]</w:t></w:r></w:p><w:p><w:r><w:t>[Profile]</w:t></w:r></w:p><w:p><w:r><w:t>[Days]</w:t></w:r></w:p></w:body></w:document>'));
    const input = join(root, 'source.docx');
    zip.writeZip(input);
    vi.stubEnv('OPEN_AGREEMENTS_CONTENT_ROOTS', root);
    return { root, input };
}
describe('declared defaults before computed prose', () => {
    it('renders omitted caller defaults exactly like explicit equivalents without seeding undeclared fields', async () => {
        const { root, input } = fixture(), before = readFileSync(input);
        for (const [name, values] of Object.entries({ omitted: {}, explicit: { mode: 'standard', days: '120', enabled: true, date: '2026-09-08' } })) {
            const outputPath = join(root, name + '.docx'), computedOutPath = join(root, name + '.json');
            const result = await runFieldSelector({ fieldSelectorId: 'defaults-fixture', inputPath: input, outputPath, computedOutPath, values });
            expect(result.providedFieldsUsed.includes('days')).toBe(Object.hasOwn(values, 'days'));
            expect(result.providedFieldsUsed).toContain('derived');
            expect(extractAllText(outputPath)).toBe('Standard 120 days on September 8, 2026\ncomputed default\n120');
            const artifact = JSON.parse(readFileSync(computedOutPath, 'utf8'));
            expect(artifact.inputs).not.toHaveProperty('absent');
            expect(artifact.inputs.blank_default).toBe('');
            expect(artifact.inputs.numeric_default).toBe('0');
            expect(artifact.inputs.choices).toEqual(['one']);
            expect(artifact.inputs).not.toHaveProperty('profile_owned');
        }
        expect(readFileSync(input)).toEqual(before);
    });
    it('honors explicit overrides and computed-rule precedence, including intentional blanks', async () => {
        const { root, input } = fixture();
        for (const [name, values, expected] of [
            ['override', { mode: 'special', days: '45', derived: 'caller derived' }, 'Special 45 days'],
            ['blank', { mode: 'special', days: '' }, 'Special days'],
        ] as const) {
            const outputPath = join(root, name + '.docx');
            await runFieldSelector({ fieldSelectorId: 'defaults-fixture', inputPath: input, outputPath, values: { ...values } });
            expect(extractAllText(outputPath).split('\n')[0]).toBe(expected);
        }
    });
    it('preserves explicit false and blank dates without replacing them with defaults', async () => {
        const { root, input } = fixture(), outputPath = join(root, 'false.docx'), computedOutPath = join(root, 'false.json');
        await runFieldSelector({ fieldSelectorId: 'defaults-fixture', inputPath: input, outputPath, computedOutPath, values: { enabled: false, date: '', profile_owned: 'caller' } });
        const trace = JSON.parse(readFileSync(computedOutPath, 'utf8'));
        expect(trace.inputs.enabled).toBe(false);
        expect(trace.inputs.date).toBe('');
        expect(trace.final_fill_values.profile_owned).toBe('caller');
        expect(extractAllText(outputPath)).not.toContain('Standard 120');
    });
    it('rejects an impossible declared date default before document output', async () => {
        const { root, input } = fixture('2026-02-30'), outputPath = join(root, 'invalid.docx');
        await expect(runFieldSelector({ fieldSelectorId: 'defaults-fixture', inputPath: input, outputPath, values: {} })).rejects.toThrow(/date|calendar/i);
        expect(existsSync(outputPath)).toBe(false);
    });
    it('preserves direct empty-default semantics and metadata rejection of an empty multiselect default', async () => {
        const { root, input } = fixture('2026-09-08', '');
        const outputPath = join(root, 'multi.docx'), computedOutPath = join(root, 'multi.json');
        expect(prepareFillData({ values: {}, fields: [{ name: 'choices', type: 'multiselect', description: 'Choices', options: ['one'], default: '' }] }).choices).toEqual([]);
        await expect(runFieldSelector({ fieldSelectorId: 'defaults-fixture', inputPath: input, outputPath, computedOutPath, values: {} })).rejects.toThrow(/JSON-encoded array/);
        expect(existsSync(outputPath)).toBe(false);
    });
    it('rejects a malformed multiselect default before output', async () => {
        const { root, input } = fixture('2026-09-08', 'not json');
        const outputPath = join(root, 'multi.docx');
        expect(() => prepareFillData({ values: {}, fields: [{ name: 'choices', type: 'multiselect', description: 'Choices', options: ['one'], default: 'not json' }] })).toThrow(SyntaxError);
        await expect(runFieldSelector({ fieldSelectorId: 'defaults-fixture', inputPath: input, outputPath, values: {} })).rejects.toThrow(/JSON-encoded array/);
        expect(existsSync(outputPath)).toBe(false);
    });
});
