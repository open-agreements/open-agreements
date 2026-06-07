import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { compileCanonicalSourceString } from '../scripts/template_renderer/canonical-source.mjs';
import { loadStyleProfile, renderFromValidatedSpec } from '../scripts/template_renderer/index.mjs';

const it = itAllure.epic('Filling & Rendering');

const stylePath = join(import.meta.dirname, '..', 'scripts', 'template-specs', 'styles', 'openagreements-default-v1.json');

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

  it.openspec('OA-TMP-061')('compiles a confirm= clause into a statutory-compliance representation and renders a highlighted CONFIRM bracket gated on {IF !field}', async () => {
    const { Packer } = await import('docx');
    const AdmZip = (await import('adm-zip')).default;
    const style = loadStyleProfile(stylePath);
    const source = buildCanonicalSource(
      `<!-- oa:clause id=compliance-recital confirm=notice_confirmed confirm_note="the required notice was actually given before signing" authority_url="https://example.com/statute/542.45" -->
### Compliance Recital

The party gave the required notice before signing.

`
    );

    const compiled = compileCanonicalSourceString(source, 'inline confirm source');
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

  it.openspec('OA-TMP-062')('rejects confirm= combined with when/omitted', () => {
    const source = buildCanonicalSource(
      `<!-- oa:clause id=bad-confirm confirm=notice_confirmed when=notice_confirmed confirm_note="x" authority_url="https://example.com/s" -->
### Bad Confirm

Body.

`
    );
    expect(() => compileCanonicalSourceString(source, 'inline confirm+when source')).toThrow(
      /cannot combine confirm with when\/omitted/
    );
  });

  it.openspec('OA-TMP-062')('rejects confirm= missing confirm_note or authority_url', () => {
    const missingNote = buildCanonicalSource(
      `<!-- oa:clause id=no-note confirm=notice_confirmed authority_url="https://example.com/s" -->
### No Note

Body.

`
    );
    expect(() => compileCanonicalSourceString(missingNote, 'inline confirm missing note')).toThrow(
      /confirm requires a confirm_note/
    );

    const missingUrl = buildCanonicalSource(
      `<!-- oa:clause id=no-url confirm=notice_confirmed confirm_note="x" -->
### No URL

Body.

`
    );
    expect(() => compileCanonicalSourceString(missingUrl, 'inline confirm missing url')).toThrow(
      /confirm requires an http\(s\) authority_url/
    );
  });

  it.openspec('OA-TMP-062')('rejects confirm= with a non-field-name value (strict parser; "always" is not a sentinel)', () => {
    const source = buildCanonicalSource(
      `<!-- oa:clause id=bad-name-confirm confirm=NoticeConfirmed confirm_note="x" authority_url="https://example.com/s" -->
### Bad Name Confirm

Body.

`
    );
    expect(() => compileCanonicalSourceString(source, 'inline confirm bad-name source')).toThrow(
      /invalid field name "NoticeConfirmed"/
    );

    const always = buildCanonicalSource(
      `<!-- oa:clause id=always-confirm confirm=always confirm_note="x" authority_url="https://example.com/s" -->
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
