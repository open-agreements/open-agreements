import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect } from 'vitest';
import { z } from 'zod';
import { itAllure } from '../../integration-tests/helpers/allure-test.js';
import { RUNTIME_CAPABILITIES } from './runtime-capabilities.js';
import { SelectionsConfigSchema } from './selector.js';

const it = itAllure.epic('Platform & Distribution');
const option = {
  marker: 'Optional paragraph', trigger: { field: 'include_optional' },
  removal: { kind: 'paragraph', anchor: 'Optional paragraph', match: 'exact', expectedMatches: 1 },
};
const config = { groups: [{ id: 'optional', type: 'checkbox', markerless: true, options: [option] }] };

describe('runtime capability contract', () => {
  it('matches the shipped declaration to the runtime export', () => {
    expect(JSON.parse(readFileSync(resolve('runtime-capabilities.json'), 'utf8'))).toEqual(RUNTIME_CAPABILITIES);
  });

  it('pins the old 0.7.6 stripping behavior and preserves removal in the supported schema', () => {
    // Frozen verbatim OptionSchema / TriggerSchema shape from published
    // open-agreements@0.7.6 dist/core/selector.js; intentionally NOT strict.
    const OldTriggerSchema = z.union([
      z.literal('default'),
      z.object({ field: z.string(), equals: z.union([z.string(), z.boolean()]) }),
      z.object({ field: z.string() }),
    ]);
    const OldOptionSchema = z.object({
      marker: z.string(), trigger: OldTriggerSchema, replaceWith: z.string().optional(),
    });
    expect(OldOptionSchema.parse(option)).not.toHaveProperty('removal');
    expect(SelectionsConfigSchema.parse(config).groups[0].options[0].removal).toEqual(option.removal);
  });

  it('rejects unknown operations at every formerly stripping selections boundary', () => {
    expect(() => SelectionsConfigSchema.parse({ ...config, futureOperation: true })).toThrow();
    expect(() => SelectionsConfigSchema.parse({ groups: [{ ...config.groups[0], futureOperation: true }] })).toThrow();
    expect(() => SelectionsConfigSchema.parse({ groups: [{ ...config.groups[0], options: [{ ...option, futureOperation: true }] }] })).toThrow();
    expect(() => SelectionsConfigSchema.parse({ groups: [{ ...config.groups[0], options: [{ ...option, trigger: { field: 'include_optional', futureOperation: true } }] }] })).toThrow();
  });

  it('accepts every shipped selections file including legitimate option labels', () => {
    let checked = 0;
    const visit = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (entry.name === 'selections.json') {
          const raw = JSON.parse(readFileSync(path, 'utf8'));
          expect(SelectionsConfigSchema.parse(raw).groups).toMatchObject(raw.groups);
          checked++;
        }
      }
    };
    visit(resolve('templates'));
    expect(checked).toBeGreaterThan(7);
  });
});
