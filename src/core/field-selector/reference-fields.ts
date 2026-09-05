import { existsSync, readFileSync } from 'node:fs';
import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer, type Document, type Element, type Node } from '@xmldom/xmldom';
import { z } from 'zod';
import { enumerateTextParts, getAllTextPartNames, preserveXmlSpace, rezipWithoutDirEntries } from './ooxml-parts.js';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REF_INSTRUCTION_RE = /^\s*REF\s+(?:"([^"]+)"|'([^']+)'|([^\s\\]+))(?:\s|\\|$)/i;

const ReferenceFieldActionBaseSchema = z.object({
  target: z.string().min(1),
  strategy: z.literal('literalize'),
  expected_matches: z.number().int().nonnegative(),
  expected_target_count: z.number().int().nonnegative(),
});

const SimpleReferenceFieldActionSchema = ReferenceFieldActionBaseSchema.extend({
  literal: z.string(),
  expected_cached_result: z.string(),
}).strict();

const GroupedReferenceFieldActionSchema = ReferenceFieldActionBaseSchema.extend({
  groups: z.array(z.object({
    expected_cached_result: z.string(),
    literal: z.string(),
    expected_matches: z.number().int().positive(),
  }).strict()).min(1),
}).strict().superRefine((action, ctx) => {
  const seen = new Set<string>();
  let sum = 0;
  for (const group of action.groups) {
    if (seen.has(group.expected_cached_result)) {
      ctx.addIssue({ code: 'custom', message: `duplicate cached-result group "${group.expected_cached_result}"` });
    }
    seen.add(group.expected_cached_result);
    sum += group.expected_matches;
  }
  if (sum !== action.expected_matches) {
    ctx.addIssue({
      code: 'custom',
      message: `group expected_matches sum ${sum} does not equal action expected_matches ${action.expected_matches}`,
    });
  }
});

export const ReferenceFieldActionSchema = z.union([
  SimpleReferenceFieldActionSchema,
  GroupedReferenceFieldActionSchema,
]);

export const ReferenceFieldsConfigSchema = z.object({
  version: z.literal(1),
  actions: z.array(ReferenceFieldActionSchema).min(1),
}).strict().superRefine((config, ctx) => {
  const seen = new Set<string>();
  for (const action of config.actions) {
    if (seen.has(action.target)) {
      ctx.addIssue({ code: 'custom', message: `duplicate target "${action.target}"` });
    }
    seen.add(action.target);
  }
});

export type ReferenceFieldsConfig = z.infer<typeof ReferenceFieldsConfigSchema>;

export function loadReferenceFieldsConfig(path: string): ReferenceFieldsConfig | undefined {
  if (!existsSync(path)) return undefined;
  return ReferenceFieldsConfigSchema.parse(JSON.parse(readFileSync(path, 'utf-8')));
}

interface FieldMatch {
  partName: string;
  target: string;
  cachedResult: string;
  replace: (literal: string) => void;
}

function attr(element: Element, localName: string): string {
  return element.getAttributeNS(W_NS, localName) || element.getAttribute(`w:${localName}`) || '';
}

function fieldTarget(instruction: string): string | undefined {
  const match = instruction.match(REF_INSTRUCTION_RE);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function textOf(node: Node): string {
  const texts = (node as Element).getElementsByTagNameNS(W_NS, 't');
  let text = '';
  for (let i = 0; i < texts.length; i++) text += texts[i].textContent ?? '';
  return text;
}

function ordinaryRun(doc: Document, styleSource: Element | undefined, literal: string): Element {
  const run = doc.createElementNS(W_NS, 'w:r') as unknown as Element;
  const rPr = styleSource?.getElementsByTagNameNS(W_NS, 'rPr')[0];
  if (rPr) run.appendChild(rPr.cloneNode(true));
  const text = doc.createElementNS(W_NS, 'w:t') as unknown as Element;
  preserveXmlSpace(text);
  text.textContent = literal;
  run.appendChild(text);
  return run;
}

function findFields(doc: Document, partName: string): FieldMatch[] {
  const matches: FieldMatch[] = [];

  // Atomic fields are self-contained and may carry split result runs.
  const simple = Array.from(doc.getElementsByTagNameNS(W_NS, 'fldSimple')) as unknown as Element[];
  for (const field of simple) {
    const instruction = attr(field, 'instr');
    const target = fieldTarget(instruction);
    if (!target) continue;
    const cachedResult = textOf(field);
    matches.push({
      partName,
      target,
      cachedResult,
      replace: (literal) => {
        const parent = field.parentNode;
        if (!parent) throw new Error(`${partName}: REF ${target} has no parent`);
        const styleRun = field.getElementsByTagNameNS(W_NS, 'r')[0] as unknown as Element | undefined;
        parent.replaceChild(ordinaryRun(doc, styleRun, literal), field);
      },
    });
  }

  // Complex fields are sibling run triplets. Pair begin/end with a stack so
  // nested fields remain atomic; concatenate split instrText and result text.
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W_NS, 'p')) as unknown as Element[];
  for (const paragraph of paragraphs) {
    const runs = Array.from(paragraph.getElementsByTagNameNS(W_NS, 'r')) as unknown as Element[];
    const stack: Array<{ start: number; separate?: number }> = [];
    for (let i = 0; i < runs.length; i++) {
      const chars = runs[i].getElementsByTagNameNS(W_NS, 'fldChar');
      for (let c = 0; c < chars.length; c++) {
        const type = attr(chars[c] as unknown as Element, 'fldCharType');
        if (type === 'begin') stack.push({ start: i });
        else if (type === 'separate' && stack.length > 0) stack[stack.length - 1].separate = i;
        else if (type === 'end' && stack.length > 0) {
          const range = stack.pop()!;
          const separate = range.separate;
          if (separate === undefined) continue;
          let instruction = '';
          for (let j = range.start; j < separate; j++) {
            const nodes = runs[j].getElementsByTagNameNS(W_NS, 'instrText');
            for (let k = 0; k < nodes.length; k++) instruction += nodes[k].textContent ?? '';
          }
          const target = fieldTarget(instruction);
          if (!target) continue;
          let cachedResult = '';
          let styleRun: Element | undefined;
          for (let j = separate + 1; j < i; j++) {
            const value = textOf(runs[j]);
            cachedResult += value;
            if (!styleRun && value.length > 0) styleRun = runs[j];
          }
          const start = range.start;
          const end = i;
          matches.push({
            partName,
            target,
            cachedResult,
            replace: (literal) => {
              const anchor = runs[start];
              const parent = anchor.parentNode;
              if (!parent) throw new Error(`${partName}: REF ${target} has no parent`);
              parent.insertBefore(ordinaryRun(doc, styleRun, literal), anchor);
              for (let j = end; j >= start; j--) runs[j].parentNode?.removeChild(runs[j]);
            },
          });
        }
      }
    }
  }
  return matches;
}

/**
 * Structurally literalize declared REF fields. All assertions are evaluated
 * before any mutation, so a stale recipe cannot partially rewrite a document.
 */
export function applyReferenceFieldActions(
  inputPath: string,
  outputPath: string,
  config: ReferenceFieldsConfig,
): void {
  const source = new AdmZip(inputPath);
  const partNames = getAllTextPartNames(enumerateTextParts(source));
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const docs = new Map<string, Document>();
  const fields: FieldMatch[] = [];
  const targetCounts = new Map<string, number>();

  for (const partName of partNames) {
    const entry = source.getEntry(partName);
    if (!entry) continue;
    const doc = parser.parseFromString(entry.getData().toString('utf-8'), 'text/xml');
    docs.set(partName, doc);
    fields.push(...findFields(doc, partName));
    const bookmarks = doc.getElementsByTagNameNS(W_NS, 'bookmarkStart');
    for (let i = 0; i < bookmarks.length; i++) {
      const name = attr(bookmarks[i] as unknown as Element, 'name');
      targetCounts.set(name, (targetCounts.get(name) ?? 0) + 1);
    }
  }

  const selected: Array<{ literal: string; field: FieldMatch }> = [];
  for (const action of config.actions) {
    const actionFields = fields.filter((field) => field.target === action.target);
    const actualTargetCount = targetCounts.get(action.target) ?? 0;
    if (actualTargetCount !== action.expected_target_count) {
      throw new Error(
        `reference-fields.json: target "${action.target}" expected ${action.expected_target_count} bookmark target(s), found ${actualTargetCount}`,
      );
    }
    if (actionFields.length !== action.expected_matches) {
      throw new Error(
        `reference-fields.json: target "${action.target}" expected ${action.expected_matches} REF field match(es), found ${actionFields.length}`,
      );
    }
    if ('groups' in action) {
      const groupsByCache = new Map(action.groups.map((group) => [group.expected_cached_result, group]));
      const actualByCache = new Map<string, FieldMatch[]>();
      for (const field of actionFields) {
        const group = groupsByCache.get(field.cachedResult);
        if (!group) {
          throw new Error(
            `reference-fields.json: ${field.partName} REF "${action.target}" has undeclared cached result "${field.cachedResult}"`,
          );
        }
        const groupFields = actualByCache.get(field.cachedResult) ?? [];
        groupFields.push(field);
        actualByCache.set(field.cachedResult, groupFields);
      }
      for (const group of action.groups) {
        const groupFields = actualByCache.get(group.expected_cached_result) ?? [];
        if (groupFields.length !== group.expected_matches) {
          throw new Error(
            `reference-fields.json: target "${action.target}" cached-result group ` +
            `"${group.expected_cached_result}" expected ${group.expected_matches} REF field match(es), found ${groupFields.length}`,
          );
        }
        for (const field of groupFields) selected.push({ field, literal: group.literal });
      }
    } else {
      for (const field of actionFields) {
        if (field.cachedResult !== action.expected_cached_result) {
          throw new Error(
            `reference-fields.json: ${field.partName} REF "${action.target}" expected cached result ` +
            `"${action.expected_cached_result}", found "${field.cachedResult}"`,
          );
        }
        selected.push({ field, literal: action.literal });
      }
    }
  }

  for (const { field, literal } of selected) field.replace(literal);

  const output = rezipWithoutDirEntries(source);
  for (const [partName, doc] of docs) {
    output.updateFile(partName, Buffer.from(serializer.serializeToString(doc)));
  }
  output.writeZip(outputPath);
}
