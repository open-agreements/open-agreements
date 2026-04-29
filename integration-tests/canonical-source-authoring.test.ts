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
source_json: scripts/template-specs/canonical-source-test.json
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
});
