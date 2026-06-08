import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import {
  buildFieldLookup,
  compileCanonicalSourceFile,
  compileCanonicalSourceString,
} from '../scripts/template_renderer/canonical-source.mjs';
import { loadStyleProfile, renderFromValidatedSpec } from '../scripts/template_renderer/index.mjs';

const it = itAllure.epic('Filling & Rendering');

const stylePath = join(import.meta.dirname, '..', 'scripts', 'template-specs', 'styles', 'openagreements-default-v1.json');

// A valid statutory-compliance-representation field as it would appear in
// metadata.yaml. confirm= clauses resolve confirm_note/authority_url from here
// (SSOT), so tests supply it via { fieldLookup }.
const SCR_FIELD = {
  name: 'notice_confirmed',
  type: 'boolean',
  statutory_compliance_representation: true,
  confirm_note: 'the required notice was actually given before signing',
  authority_url: 'https://example.com/statute/542.45',
  default: 'false',
};

function fieldLookupFor(fields) {
  return buildFieldLookup({ fields });
}

function buildCanonicalSource(extraBody = '') {
  return `---
template_id: canonical-source-test
layout_id: cover-standard-signature-v1
style_id: openagreements-default-v1
outputs:
  docx: /tmp/canonical-source-test.docx
document:
  title: Canonical Source Test
  label: Canonical Source Test
  version: "1.0"
  license: Test License
sections:
  cover_terms:
    section_label: Cover Terms
    heading_title: Cover Terms
  standard_terms:
    section_label: Standard Terms
    heading_title: Standard Terms
  signature:
    section_label: Signature Page
    heading_title: Signatures
---

# Canonical Source Test

## Cover Terms

The terms below are incorporated into and form part of this agreement.

| Kind | Label | Value | Show When |
| --- | --- | --- | --- |
| row | Company | {company_name} | always |
| group | Confidentiality |  | always |
| subrow | Purpose | {purpose} | purpose_included |

## Standard Terms

<!-- oa:clause id=defined-terms type=definitions -->
### Defined Terms

The [[Company]] (Aliases: [[Companies]]) means the party identified as Company in Cover Terms.

An [[Affiliate]] (Aliases: [[Affiliates]]) means any person that directly or indirectly controls, is controlled by, or is under common control with the [[Company]].

[[Confidential Information]] means all non-public information disclosed by the [[Company]] to an [[Affiliate]].

<!-- oa:clause id=confidentiality -->
### Confidentiality

The [[Companies]] may disclose [[Confidential Information]] to their [[Affiliates]].
${extraBody}
## Signatures

<!-- oa:signature-mode arrangement=entity-plus-individual -->

By signing this agreement, each party agrees to the obligations above.

<!-- oa:signer id=company kind=entity capacity=through_representative label="Company" -->
**Company**

Signature: _______________
Print Name: {company_name}
Title: _______________
Date: _______________

<!-- oa:signer id=recipient kind=individual capacity=personal label="Recipient" -->
**Recipient**

Signature: _______________
Print Name: {recipient_name}
Date: _______________
`;
}

describe('canonical Markdown authoring', () => {
  it.openspec('OA-TMP-054')('renders directive-anchored sections from body H2 titles', () => {
    const style = loadStyleProfile(stylePath);
    const directiveAnchoredSource = buildCanonicalSource()
      .replace('## Standard Terms', '<!-- oa:section type=standard_terms -->\n## Operative Terms')
      .replace('## Signatures', '<!-- oa:section type=signature -->\n## Execution');

    const compiled = compileCanonicalSourceString(directiveAnchoredSource, 'inline directive-anchored source');
    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);

    expect(compiled.contractSpec.sections.standard_terms.heading_title).toBe('Operative Terms');
    expect(compiled.contractSpec.sections.signature.heading_title).toBe('Execution');
    expect(rendered.markdown).toContain('## Operative Terms');
    expect(rendered.markdown).toContain('## Execution');
    expect(rendered.markdown).not.toContain('## Standard Terms');
  });

  it.openspec('OA-TMP-055')('prefers directive-anchored standard terms when both anchor mechanisms are present', () => {
    const sourceWithBothAnchors = buildCanonicalSource()
      .replace(
        /## Standard Terms[\s\S]*?(?=## Signatures)/,
        `<!-- oa:section type=standard_terms -->
## Resolutions

<!-- oa:clause id=directive-clause -->
### Directive Clause

Directive body.

## Standard Terms

<!-- oa:clause id=legacy-clause -->
### Legacy Clause

Legacy body.

`
      );

    const compiled = compileCanonicalSourceString(sourceWithBothAnchors, 'inline source with both standard terms anchors');

    expect(compiled.contractSpec.sections.standard_terms.heading_title).toBe('Resolutions');
    expect(compiled.contractSpec.sections.standard_terms.clauses).toMatchObject([
      {
        id: 'directive-clause',
        heading: 'Directive Clause',
        body: 'Directive body.',
      },
    ]);
    expect(compiled.contractSpec.sections.standard_terms.clauses).not.toContainEqual(
      expect.objectContaining({ id: 'legacy-clause' })
    );
  });

  it.openspec('OA-TMP-061')('compiles a confirm= clause into a statutory-compliance representation, resolving note/url from metadata, and renders a highlighted CONFIRM bracket gated on {IF !field}', async () => {
    const { Packer } = await import('docx');
    const AdmZip = (await import('adm-zip')).default;
    const style = loadStyleProfile(stylePath);
    // SSOT: the directive names only the field; confirm_note/authority_url come
    // from metadata.yaml via the field lookup.
    const source = buildCanonicalSource(
      `<!-- oa:clause id=compliance-recital confirm=notice_confirmed -->
### Compliance Recital

The party gave the required notice before signing.

`
    );

    const compiled = compileCanonicalSourceString(source, 'inline confirm source', {
      fieldLookup: fieldLookupFor([SCR_FIELD]),
    });
    const clause = compiled.contractSpec.sections.standard_terms.clauses.find(
      (c) => c.id === 'compliance-recital'
    );
    expect(clause).toMatchObject({
      id: 'compliance-recital',
      confirm: 'notice_confirmed',
      confirm_note: 'the required notice was actually given before signing',
      authority_url: 'https://example.com/statute/542.45',
    });
    // A confirm clause is never conditionally dropped — it carries no when/omitted.
    expect(clause).not.toHaveProperty('condition');
    expect(clause).not.toHaveProperty('omitted_body');

    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);
    const buffer = await Packer.toBuffer(rendered.document);
    const xml = new AdmZip(buffer).getEntry('word/document.xml').getData().toString('utf-8');
    // Body renders unconditionally; the bracket is gated on the negated field
    // and highlighted yellow so a human notices the open item.
    expect(xml).toContain('The party gave the required notice before signing.');
    expect(xml).toContain('{IF !notice_confirmed}');
    expect(xml).toContain('[CONFIRM before signing: the required notice was actually given before signing; see https://example.com/statute/542.45]');
    expect(xml).toContain('w:val="yellow"');
  });

  it.openspec('OA-TMP-065')('compileCanonicalSourceFile resolves confirm= note/url from the sibling metadata.yaml', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oa-canonical-confirm-'));
    writeFileSync(
      join(dir, 'template.md'),
      buildCanonicalSource(
        `<!-- oa:clause id=compliance-recital confirm=notice_confirmed -->
### Compliance Recital

The party gave the required notice before signing.

`
      )
    );
    writeFileSync(
      join(dir, 'metadata.yaml'),
      `name: Sibling Metadata Test
source_url: https://example.com
version: "1.0"
license: CC0-1.0
allow_derivatives: true
attribution_text: test
fields:
  - name: notice_confirmed
    type: boolean
    statutory_compliance_representation: true
    confirm_note: the required notice was actually given before signing
    authority_url: https://example.com/statute/542.45
    description: confirm before signing
    default: 'false'
`
    );

    const compiled = compileCanonicalSourceFile(join(dir, 'template.md'));
    const clause = compiled.contractSpec.sections.standard_terms.clauses.find(
      (c) => c.id === 'compliance-recital'
    );
    expect(clause).toMatchObject({
      confirm: 'notice_confirmed',
      confirm_note: 'the required notice was actually given before signing',
      authority_url: 'https://example.com/statute/542.45',
    });
  });

  it.openspec('OA-TMP-065')('renders a confirm_note containing special characters (quotes/brackets) without breaking the layout', async () => {
    const { Packer } = await import('docx');
    const AdmZip = (await import('adm-zip')).default;
    const style = loadStyleProfile(stylePath);
    const trickyNote = `the "advisal" [and notice] were given before signing`;
    const source = buildCanonicalSource(
      `<!-- oa:clause id=compliance-recital confirm=notice_confirmed -->
### Compliance Recital

The party gave the required notice before signing.

`
    );

    const compiled = compileCanonicalSourceString(source, 'inline confirm special-chars source', {
      fieldLookup: fieldLookupFor([{ ...SCR_FIELD, confirm_note: trickyNote }]),
    });
    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);
    const buffer = await Packer.toBuffer(rendered.document);
    const xml = new AdmZip(buffer).getEntry('word/document.xml').getData().toString('utf-8');
    expect(xml).toContain('{IF !notice_confirmed}');
    expect(xml).toContain('w:val="yellow"');
    // The bracket renders with the special-character note intact (XML-escaped).
    expect(xml).toContain('[CONFIRM before signing: the &quot;advisal&quot; [and notice] were given before signing; see https://example.com/statute/542.45]');
  });

  it.openspec('OA-TMP-068')('allows confirm= combined with when= as an applicability gate and wraps the whole clause (body + CONFIRM bracket) in {IF condition}', async () => {
    const { Packer } = await import('docx');
    const AdmZip = (await import('adm-zip')).default;
    const style = loadStyleProfile(stylePath);
    const source = buildCanonicalSource(
      `<!-- oa:clause id=gated-recital when=covered_party confirm=notice_confirmed -->
### Gated Recital

The party gave the required notice before signing.

`
    );

    const compiled = compileCanonicalSourceString(source, 'inline confirm+when source', {
      fieldLookup: fieldLookupFor([SCR_FIELD]),
    });
    const clause = compiled.contractSpec.sections.standard_terms.clauses.find(
      (c) => c.id === 'gated-recital'
    );
    expect(clause).toMatchObject({ confirm: 'notice_confirmed', condition: 'covered_party' });
    expect(clause).not.toHaveProperty('omitted_body');

    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);
    const buffer = await Packer.toBuffer(rendered.document);
    const xml = new AdmZip(buffer).getEntry('word/document.xml').getData().toString('utf-8');
    const text = xml.replace(/<[^>]+>/g, '');
    // The applicability gate wraps the heading, body and the CONFIRM bracket; the
    // inner {IF !field} + bracket survives so the compliance validator still matches.
    expect(text).toContain('{IF covered_party}');
    expect(text).toContain('{IF !notice_confirmed}');
    expect(text).toContain('[CONFIRM before signing: the required notice was actually given before signing; see https://example.com/statute/542.45]');
    // {IF covered_party} opens before the {IF !notice_confirmed} bracket gate.
    expect(text.indexOf('{IF covered_party}')).toBeLessThan(text.indexOf('{IF !notice_confirmed}'));
  });

  it.openspec('OA-TMP-069')('rejects confirm= combined with omitted (a confirm clause is never replaced by a placeholder)', () => {
    const source = buildCanonicalSource(
      `<!-- oa:clause id=bad-confirm confirm=notice_confirmed omitted="[Intentionally Omitted.]" -->
### Bad Confirm

Body.

`
    );
    expect(() =>
      compileCanonicalSourceString(source, 'inline confirm+omitted source', { fieldLookup: fieldLookupFor([SCR_FIELD]) })
    ).toThrow(/cannot combine confirm with omitted/);
  });

  it.openspec('OA-TMP-066')('when= without omitted= wraps heading and body in {IF condition} so the clause is fully absent', async () => {
    const { Packer } = await import('docx');
    const AdmZip = (await import('adm-zip')).default;
    const style = loadStyleProfile(stylePath);
    const source = buildCanonicalSource(
      `<!-- oa:clause id=optional-clause when=clause_included -->
### Optional Clause

This optional clause body only appears when included.

`
    );

    const compiled = compileCanonicalSourceString(source, 'inline clean-omission source');
    const clause = compiled.contractSpec.sections.standard_terms.clauses.find(
      (c) => c.id === 'optional-clause'
    );
    expect(clause).toMatchObject({ condition: 'clause_included' });
    expect(clause).not.toHaveProperty('omitted_body');

    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);
    const buffer = await Packer.toBuffer(rendered.document);
    const xml = new AdmZip(buffer).getEntry('word/document.xml').getData().toString('utf-8');
    const text = xml.replace(/<[^>]+>/g, '');
    // The {IF clause_included} gate opens BEFORE the heading text (heading is
    // inside the gate) and there is no [Intentionally Omitted.] placeholder.
    expect(text).toContain('{IF clause_included}');
    expect(text).not.toContain('Intentionally Omitted');
    expect(text.indexOf('{IF clause_included}')).toBeLessThan(text.indexOf('Optional Clause'));
  });

  it.openspec('OA-TMP-067')('when= with omitted= keeps the heading and a placeholder', async () => {
    const { Packer } = await import('docx');
    const AdmZip = (await import('adm-zip')).default;
    const style = loadStyleProfile(stylePath);
    const source = buildCanonicalSource(
      `<!-- oa:clause id=placeholder-clause when=clause_included omitted="[Intentionally Omitted.]" -->
### Placeholder Clause

This body is swapped for a placeholder when excluded.

`
    );

    const compiled = compileCanonicalSourceString(source, 'inline placeholder source');
    const clause = compiled.contractSpec.sections.standard_terms.clauses.find(
      (c) => c.id === 'placeholder-clause'
    );
    expect(clause).toMatchObject({ condition: 'clause_included', omitted_body: '[Intentionally Omitted.]' });

    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);
    const buffer = await Packer.toBuffer(rendered.document);
    const xml = new AdmZip(buffer).getEntry('word/document.xml').getData().toString('utf-8');
    const text = xml.replace(/<[^>]+>/g, '');
    // The heading is OUTSIDE the gate (always renders) and the placeholder is present.
    expect(text).toContain('Placeholder Clause');
    expect(text).toContain('[Intentionally Omitted.]');
    expect(text.indexOf('Placeholder Clause')).toBeLessThan(text.indexOf('{IF clause_included}'));
  });

  it.openspec('OA-TMP-062')('rejects confirm= that restates confirm_note/authority_url in the directive (SSOT: they belong in metadata.yaml)', () => {
    const restatesNote = buildCanonicalSource(
      `<!-- oa:clause id=restate-note confirm=notice_confirmed confirm_note="x" -->
### Restate Note

Body.

`
    );
    expect(() =>
      compileCanonicalSourceString(restatesNote, 'inline confirm restate note', { fieldLookup: fieldLookupFor([SCR_FIELD]) })
    ).toThrow(/must not restate confirm_note\/authority_url/);

    const restatesUrl = buildCanonicalSource(
      `<!-- oa:clause id=restate-url confirm=notice_confirmed authority_url="https://example.com/s" -->
### Restate Url

Body.

`
    );
    expect(() =>
      compileCanonicalSourceString(restatesUrl, 'inline confirm restate url', { fieldLookup: fieldLookupFor([SCR_FIELD]) })
    ).toThrow(/must not restate confirm_note\/authority_url/);
  });

  it.openspec('OA-TMP-062')('rejects confirm= whose field is missing from metadata, is not an SCR field, or lacks note/url', () => {
    const base = buildCanonicalSource(
      `<!-- oa:clause id=compliance-recital confirm=notice_confirmed -->
### Compliance Recital

Body.

`
    );

    // (a) field missing from metadata
    expect(() =>
      compileCanonicalSourceString(base, 'inline confirm missing field', { fieldLookup: fieldLookupFor([]) })
    ).toThrow(/has no matching field in metadata\.yaml/);

    // (b) field present but not a statutory_compliance_representation
    expect(() =>
      compileCanonicalSourceString(base, 'inline confirm not-scr', {
        fieldLookup: fieldLookupFor([{ name: 'notice_confirmed', type: 'boolean' }]),
      })
    ).toThrow(/must reference a field with statutory_compliance_representation: true/);

    // (c) SCR field missing confirm_note
    expect(() =>
      compileCanonicalSourceString(base, 'inline confirm missing note', {
        fieldLookup: fieldLookupFor([{ ...SCR_FIELD, confirm_note: '   ' }]),
      })
    ).toThrow(/requires a non-empty confirm_note/);

    // (d) SCR field missing/invalid authority_url
    expect(() =>
      compileCanonicalSourceString(base, 'inline confirm missing url', {
        fieldLookup: fieldLookupFor([{ ...SCR_FIELD, authority_url: undefined }]),
      })
    ).toThrow(/requires an http\(s\) authority_url/);
  });

  it.openspec('OA-TMP-062')('rejects confirm= with a non-field-name value (strict parser; "always" is not a sentinel)', () => {
    const source = buildCanonicalSource(
      `<!-- oa:clause id=bad-name-confirm confirm=NoticeConfirmed -->
### Bad Name Confirm

Body.

`
    );
    expect(() => compileCanonicalSourceString(source, 'inline confirm bad-name source')).toThrow(
      /invalid field name "NoticeConfirmed"/
    );

    const always = buildCanonicalSource(
      `<!-- oa:clause id=always-confirm confirm=always -->
### Always Confirm

Body.

`
    );
    expect(() => compileCanonicalSourceString(always, 'inline confirm always source')).toThrow(
      /invalid field name "always".*not a sentinel/
    );
  });

  it.openspec('OA-TMP-055')('accepts legacy required section titles without section directives', () => {
    const compiled = compileCanonicalSourceString(buildCanonicalSource(), 'inline legacy section source');

    expect(compiled.contractSpec.sections.standard_terms.heading_title).toBe('Standard Terms');
    expect(compiled.contractSpec.sections.signature.heading_title).toBe('Signatures');
  });

  it.openspec('OA-TMP-054')('rejects sources that omit both standard terms anchor mechanisms', () => {
    expect(() =>
      compileCanonicalSourceString(
        buildCanonicalSource().replace('## Standard Terms', '## Resolutions'),
        'inline source missing standard terms anchors'
      )
    ).toThrow(/missing required "<!-- oa:section type=standard_terms -->" directive or "## Standard Terms" section/);
  });

  it.openspec('OA-TMP-054')('rejects oa:section directives that are not followed by a top-level heading', () => {
    expect(() =>
      compileCanonicalSourceString(
        buildCanonicalSource().replace('## Standard Terms', '<!-- oa:section type=standard_terms -->\nNot a heading'),
        'inline source with dangling standard terms directive'
      )
    ).toThrow(/oa:section type=standard_terms must be followed by a top-level "## Heading"/);
  });

  it.openspec('OA-TMP-054')('rejects unsupported oa:section type values', () => {
    expect(() =>
      compileCanonicalSourceString(
        buildCanonicalSource().replace('## Standard Terms', '<!-- oa:section type=bogus -->\n## Resolutions'),
        'inline source with unsupported section type'
      )
    ).toThrow(/uses unsupported oa:section type "bogus"/);
  });

  it.openspec('OA-TMP-033')('compiles label-keyed cover terms and paragraph-based definitions with aliases', () => {
    const compiled = compileCanonicalSourceString(buildCanonicalSource(), 'inline canonical source');
    const rows = compiled.contractSpec.sections.cover_terms.rows;
    const definitionsClause = compiled.contractSpec.sections.standard_terms.clauses[0];

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      kind: 'row',
      label: 'Company',
      value: '{company_name}',
    });
    expect(rows[1]).toMatchObject({
      kind: 'group',
      label: 'Confidentiality',
      value: '',
    });
    expect(rows[2]).toMatchObject({
      kind: 'subrow',
      label: 'Purpose',
      value: '{purpose}',
      condition: 'purpose_included',
      sub: true,
    });

    expect(definitionsClause).toMatchObject({
      id: 'defined-terms',
      type: 'definitions',
      heading: 'Defined Terms',
    });
    expect(compiled.contractSpec.output_markdown_path).toBeUndefined();
    if (definitionsClause.type !== 'definitions') {
      throw new Error('expected definitions clause');
    }
    expect(definitionsClause.terms).toEqual([
      {
        term: 'Company',
        aliases: ['Companies'],
        definition: 'means the party identified as Company in Cover Terms.',
      },
      {
        term: 'Affiliate',
        aliases: ['Affiliates'],
        definition: 'means any person that directly or indirectly controls, is controlled by, or is under common control with the Company.',
      },
      {
        term: 'Confidential Information',
        definition: 'means all non-public information disclosed by the Company to an Affiliate.',
      },
    ]);
  });

  it('parses cover-term cells that contain escaped pipes', () => {
    // A literal "|" inside a table cell is written "\|" in GFM/CommonMark.
    // Regression: a naive split on "|" miscounts the cells and trips the
    // cell-count invariant before this case was handled. Covers escaped
    // pipes mid-cell, at a cell boundary, consecutively, and a backslash
    // that is not before a pipe (which must survive verbatim).
    const source = buildCanonicalSource()
      .replace(
        '| row | Company | {company_name} | always |',
        '| row | Company | {company_name} \\| Acme \\| Inc | always |',
      )
      .replace(
        '| subrow | Purpose | {purpose} | purpose_included |',
        '| subrow | Purpose | \\| leads \\|\\| C:\\Temp | purpose_included |',
      );

    const compiled = compileCanonicalSourceString(
      source,
      'inline escaped-pipe source',
    );
    const rows = compiled.contractSpec.sections.cover_terms.rows;

    expect(rows[0]).toMatchObject({
      kind: 'row',
      label: 'Company',
      value: '{company_name} | Acme | Inc',
    });
    expect(rows[2]).toMatchObject({
      kind: 'subrow',
      label: 'Purpose',
      value: '| leads || C:\\Temp',
    });
  });

  it('treats an escaped backslash before a pipe as a real delimiter', () => {
    // `\\|` is an escaped backslash followed by a delimiter (GFM), NOT an
    // escaped pipe. The extra cell must trip the cell-count invariant
    // rather than be silently absorbed.
    const source = buildCanonicalSource().replace(
      '| row | Company | {company_name} | always |',
      '| row | Company | {company_name} \\\\| Acme | always |',
    );

    expect(() =>
      compileCanonicalSourceString(source, 'inline escaped-backslash source'),
    ).toThrow(/cells; expected/);
  });

  it('rejects a table row missing its trailing pipe', () => {
    // `.slice(1, -1)` would otherwise silently drop the last character.
    const source = buildCanonicalSource().replace(
      '| row | Company | {company_name} | always |',
      '| row | Company | {company_name} | always',
    );

    expect(() =>
      compileCanonicalSourceString(source, 'inline missing-pipe source'),
    ).toThrow(/must start and end with a pipe/);
  });

  it.openspec('OA-TMP-034')('rejects unresolved explicit references and alias collisions', () => {
    expect(() =>
      compileCanonicalSourceString(
        buildCanonicalSource('\nThe [[Missing Term]] must also comply.\n'),
        'inline canonical source with unresolved ref'
      )
    ).toThrow(/unknown defined term or alias "Missing Term"/);

    expect(() =>
      compileCanonicalSourceString(
        buildCanonicalSource().replace(
          '[[Confidential Information]] means all non-public information disclosed by the [[Company]] to an [[Affiliate]].',
          '[[Confidential Information]] (Aliases: [[Companies]]) means all non-public information disclosed by the [[Company]] to an [[Affiliate]].'
        ),
        'inline canonical source with alias collision'
      )
    ).toThrow(/alias collision on "Companies"/);
  });

  it.openspec('OA-TMP-035')('rejects output_markdown_path on canonical sources', () => {
    const baseSource = buildCanonicalSource();

    expect(() =>
      compileCanonicalSourceString(
        baseSource.replace(
          'outputs:\n  docx: /tmp/canonical-source-test.docx',
          'outputs:\n  docx: /tmp/canonical-source-test.docx\n  markdown: /tmp/canonical-source-test.md'
        ),
        'inline canonical source with outputs.markdown'
      )
    ).toThrow(/must not declare output_markdown_path/);

    expect(() =>
      compileCanonicalSourceString(
        baseSource.replace(
          'outputs:\n  docx: /tmp/canonical-source-test.docx',
          'outputs:\n  docx: /tmp/canonical-source-test.docx\noutput_markdown_path: /tmp/canonical-source-test.md'
        ),
        'inline canonical source with output_markdown_path'
      )
    ).toThrow(/must not declare output_markdown_path/);
  });

  it.openspec('OA-TMP-035')('schema accepts 1-signer signer-mode but cover-standard-signature-v1 throws at render', () => {
    const style = loadStyleProfile(stylePath);
    const oneSignerSource = buildCanonicalSource().replace(
      /<!-- oa:signer id=recipient[\s\S]+?Date: _______________\n/,
      ''
    );

    const compiled = compileCanonicalSourceString(oneSignerSource, 'inline 1-signer canonical source');
    expect(compiled.contractSpec.sections.signature.signers).toHaveLength(1);

    expect(() => renderFromValidatedSpec(compiled.contractSpec, style)).toThrow(
      /cover-standard-signature-v1 requires exactly 2 signers/
    );
  });

  it.openspec('OA-TMP-058')('renders repeat-backed stacked signer output from canonical source', () => {
    const style = loadStyleProfile(stylePath);
    const repeatingSource = buildCanonicalSource()
      .replace(
        '<!-- oa:signature-mode arrangement=entity-plus-individual -->',
        '<!-- oa:signature-mode arrangement=stacked repeat=signers item=signer -->'
      )
      .replace(
        /<!-- oa:signer id=company[\s\S]+?Date: _______________\n\n<!-- oa:signer id=recipient/,
        '<!-- oa:signer id=signer kind=individual capacity=personal label="Signer" -->\n**Signer**\n\nSignature: _______________\nPrint Name: {signer.name}\nDate: {effective_date}\n\n<!-- oa:signer id=recipient'
      )
      .replace(/<!-- oa:signer id=recipient[\s\S]+?Date: _______________\n/, '');

    const compiled = compileCanonicalSourceString(repeatingSource, 'inline repeating canonical source');
    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);

    expect(compiled.contractSpec.sections.signature).toMatchObject({
      mode: 'signers',
      arrangement: 'stacked',
      repeat: {
        collection_field: 'signers',
        item_name: 'signer',
      },
    });
    expect(compiled.contractSpec.sections.signature.signers).toHaveLength(1);
    expect(rendered.markdown).toContain('{FOR signer IN signers}');
    expect(rendered.markdown).toContain('{$signer.name}');
    expect(rendered.markdown).toContain('Date: {effective_date}');
    expect(rendered.markdown).toContain('{END-FOR signer}');
  });

  it.openspec('OA-FIL-029')('allows asymmetric signer rows within entity-plus-individual blocks', () => {
    const style = loadStyleProfile(stylePath);
    const asymmetricSource = buildCanonicalSource().replace(
      'Print Name: {recipient_name}',
      'Name: {recipient_name}'
    );

    const compiled = compileCanonicalSourceString(asymmetricSource, 'inline asymmetric signer canonical source');
    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);

    expect(compiled.contractSpec.sections.signature.signers[0].rows.map((row: { id: string }) => row.id)).toContain('title');
    expect(compiled.contractSpec.sections.signature.signers[1].rows.map((row: { id: string }) => row.id)).not.toContain('title');
    expect(rendered.markdown).toContain('Name: {recipient_name}');
  });

  it.openspec('OA-TMP-035')('renders signer-mode output and omits alias metadata from legal text', () => {
    const style = loadStyleProfile(stylePath);
    const compiled = compileCanonicalSourceString(buildCanonicalSource(), 'inline canonical source');
    const rendered = renderFromValidatedSpec(compiled.contractSpec, style);

    expect(compiled.contractSpec.sections.signature).toMatchObject({
      mode: 'signers',
      arrangement: 'entity-plus-individual',
    });
    expect(rendered.markdown).toContain('**Company**');
    expect(rendered.markdown).toContain('**Recipient**');
    expect(rendered.markdown).toContain('| **Confidentiality** | |');
    expect(rendered.markdown).toContain('| Purpose | {purpose} |');
    expect(rendered.markdown).not.toContain('Confidentiality — Purpose');
    expect(rendered.markdown).not.toContain('| *Purpose* |');
    expect(rendered.markdown).toContain('The Companies may disclose Confidential Information to their Affiliates.');
    expect(rendered.markdown).not.toContain('(Aliases:');
    expect(rendered.markdown).not.toContain('[[');
  });

  // Cover-page sections must be authored consistently: either declared in frontmatter
  // and present in the body, or absent from both. The compiler should reject either
  // half on its own. These cover that contract.
  describe('optional cover_terms section', () => {
    it.openspec('OA-TMP-047')('rejects sources that declare sections.cover_terms but omit the body section', () => {
      const sourceWithoutBody = buildCanonicalSource().replace(
        /## Cover Terms[\s\S]*?(?=## Standard Terms)/,
        ''
      );
      expect(() =>
        compileCanonicalSourceString(sourceWithoutBody, 'inline cover-frontmatter-only')
      ).toThrow(/missing the "## Cover Terms" body section/);
    });

    it.openspec('OA-TMP-047')('rejects sources that include the body section but omit sections.cover_terms', () => {
      const sourceWithoutFrontmatter = buildCanonicalSource().replace(
        /  cover_terms:\n    section_label: Cover Terms\n    heading_title: Cover Terms\n/,
        ''
      );
      expect(() =>
        compileCanonicalSourceString(sourceWithoutFrontmatter, 'inline cover-body-only')
      ).toThrow(/missing frontmatter sections\.cover_terms/);
    });
  });
});
