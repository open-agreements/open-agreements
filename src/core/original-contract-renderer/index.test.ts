import { describe, expect, it } from 'vitest';
import AdmZip from 'adm-zip';
import { listCommands } from 'docx-templates';
import { renderOriginalMarkdoc } from './index.js';
import type { FieldDefinition } from '../metadata.js';

const fields: FieldDefinition[] = [
  { name: 'name', type: 'string', description: 'Global name' },
  { name: 'enabled', type: 'boolean', description: 'Condition', default: 'false' },
  { name: 'other', type: 'boolean', description: 'Other condition', default: 'false' },
  { name: 'people', type: 'array', description: 'People', items: [{ name: 'name', type: 'string', description: 'Scoped name' }] },
];
const source = (body: string) => `---
layout_id: cover-standard-signature-v1
style_id: openagreements-default-v1
document:
  title: Synthetic verification instrument
attribution_text: Synthetic fixture only
---
${body}`;
const xml = (buffer: Buffer) => new AdmZip(buffer).readAsText('word/document.xml');

describe('native canonical original renderer', () => {
  it('preserves inline fields, strong/emphasis, soft breaks and scoped fields', async () => {
    const result = await renderOriginalMarkdoc(source(`# Fixture

Before **{% field name="name" /%}** and *after*.
Same paragraph.

{% agreement-section type="standard_terms" %}
{% clause id="names-clause" %}
### Names
{% repeat field="people" %}
- **{% field name="name" /%}** signs.
{% /repeat %}
{% /clause %}
{% /agreement-section %}`), fields);
    const content = xml(result.buffer);
    expect(content).toContain('{name}');
    expect(content).toContain('{$people_item.name}');
    expect(content).toContain('Before ');
    expect(content).toContain('Same paragraph.');
    expect(content).toContain('<w:b/>');
    expect(content).toContain('<w:i/>');
    expect(content).toContain('<w:numPr>');
    expect(result.bindings).toContainEqual({ kind: 'array', field: 'people', item: 'people_item', itemFields: ['name'] });
    expect(content).not.toContain('Calibri');
  });

  it('compiles OR cover groups and scalar conditions to bounded synthetic gates', async () => {
    const result = await renderOriginalMarkdoc(source(`{% agreement-section type="cover_terms" %}
{% cover-terms %}
{% cover-term kind="group" label="Conditional group" include-when-any=["enabled", "other"] /%}
{% cover-term kind="row" label="Name" field="name" include-when="name" /%}
{% /cover-terms %}
{% /agreement-section %}`), fields);
    expect(result.syntheticGates).toEqual([
      { field: 'oa_render_gate_0', anyOf: ['enabled', 'other'] },
      { field: 'oa_render_gate_1', anyOf: ['name'] },
    ]);
    const commands = await listCommands(result.buffer, ['{', '}']);
    expect(commands.filter(command => command.type === 'IF').map(command => command.code)).toEqual(['oa_render_gate_0', 'oa_render_gate_1']);
    expect(xml(result.buffer)).toContain('Conditional group');
    expect(xml(result.buffer)).toContain('{name}');
  });

  it('preserves source signature lines without changing ordinary paragraph soft breaks', async () => {
    const result = await renderOriginalMarkdoc(source(`# Fixture
Ordinary first line.
Ordinary second line.

{% agreement-section type="signature" %}
{% signature-block arrangement="entity-plus-individual" %}
{% signer id="person" kind="individual" capacity="personal" label="Person" %}
Signature: _______________
Print Name: {% field name="name" /%}
Date: _______________
{% /signer %}
{% /signature-block %}
{% /agreement-section %}`), fields);
    const content = xml(result.buffer);
    expect(content.match(/<w:br\s*\/>/g)).toHaveLength(2);
    expect(content).toContain('Print Name: ');
    expect(content).toContain('{name}');
  });

  it('does not duplicate a signer caption already authored in the source', async () => {
    const result = await renderOriginalMarkdoc(source(`{% agreement-section type="signature" %}
{% signature-block arrangement="entity-plus-individual" %}
{% signer id="person" kind="individual" capacity="personal" label="Employee" %}
**Employee**

Signature: _______________
Print Name: {% field name="name" /%}
{% /signer %}
{% /signature-block %}
{% /agreement-section %}`), fields);
    expect(xml(result.buffer).match(/>Employee<\/w:t>/g)).toHaveLength(1);
  });

  it('emits applicable unconfirmed warnings and a cover warning without suppressing the recital', async () => {
    const confirmation: FieldDefinition = { name: 'confirmed', type: 'boolean', description: 'Synthetic confirmation', default: 'false',
      statutory_compliance_representation: true, confirm_note: 'Verify the prerequisite happened', authority_url: 'https://example.test/authority' };
    const result = await renderOriginalMarkdoc(source(`{% agreement-section type="standard_terms" %}
{% clause id="notice" include-when="enabled" confirm="confirmed" %}
### Notice
The prerequisite was completed.
{% /clause %}
{% /agreement-section %}`), [...fields, confirmation]);
    expect(result.confirmClauses).toEqual([{ id: 'notice', condition: 'enabled', confirm: 'confirmed' }]);
    expect(result.syntheticGates).toEqual([
      { field: 'oa_render_gate_0', anyOf: ['enabled'] },
      { field: 'oa_render_gate_1', allOf: ['oa_render_gate_0'], not: 'confirmed' },
      { field: 'oa_render_gate_2', anyOf: ['oa_render_gate_1'] },
    ]);
    expect(xml(result.buffer)).toContain('The prerequisite was completed.');
    expect(xml(result.buffer)).toContain('CONFIRM before signing: Verify the prerequisite happened');
    expect(xml(result.buffer)).toContain('CONFIRM BEFORE SIGNING:');
    expect(xml(result.buffer)).toContain('w:highlight w:val="yellow"');
  });

  it.each([
    '{% field name="missing" /%}',
    '{% field name="name" future=true /%}',
    '{% unknown /%}',
    '[unsupported link](https://example.test)',
    '3. A list that must not be silently renumbered',
    '{% agreement-section type="mystery" %}{% /agreement-section %}',
    '{% agreement-section type="standard_terms" %}\n{% clause id="a" include-when="missing" %}\nText\n{% /clause %}\n{% /agreement-section %}',
  ])('rejects unsupported syntax instead of dropping it: %s', async body => {
    await expect(renderOriginalMarkdoc(source(body), fields)).rejects.toThrow();
  });

  it('honors traditional presentation but still audits hidden source syntax', async () => {
    const body = `# Synthetic verification instrument
{% agreement-section type="cover_terms" %}
## Hidden summary
{% cover-terms %}
{% cover-term kind="row" label="Name" field="name" /%}
{% /cover-terms %}
{% /agreement-section %}
{% agreement-section type="standard_terms" %}
## Synthetic verification instrument
{% clause id="operative" %}
### Operative provision
The person is {% field name="name" /%}.
{% /clause %}
{% /agreement-section %}`;
    const traditional = source(body).replace('document:\n', 'document:\n  presentation: traditional\n');
    const result = await renderOriginalMarkdoc(traditional, fields);
    expect(xml(result.buffer)).not.toContain('Hidden summary');
    expect(xml(result.buffer).match(/Synthetic verification instrument/g)).toHaveLength(1);
    expect(xml(result.buffer)).toContain('The person is ');
    await expect(renderOriginalMarkdoc(traditional.replace('## Hidden summary', '{% future-directive /%}'), fields)).rejects.toThrow('Unsupported canonical tag');
    await expect(renderOriginalMarkdoc(traditional.replace('field="name"', 'field="typo"'), fields)).rejects.toThrow('Unknown canonical field');
  });
});
