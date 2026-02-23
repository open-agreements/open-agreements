import { chai, expect } from 'vitest';
import {
  createAllureTestHelpers,
  getAllureRuntime,
  allureSeverity,
  allureDescription,
  allureDescriptionHtml,
  allureMarkdownAttachment,
  allurePrettyJsonAttachment,
  allureWordLikeTextAttachment,
  allureWordLikeMarkdownAttachment,
  allureWordLikeMarkdownDiffAttachment,
  allureFileAttachment,
  allureImageAttachment,
  type AllureBddContext,
  type AllureRuntime,
  type AllureStepContext,
  type AllureSeverityLevel,
} from '@usejunior/allure-test-factory';

// ── Repo-specific epic names ────────────────────────────────────────────────

type EpicName =
  | 'Platform & Distribution'
  | 'Discovery & Metadata'
  | 'Cleaning & Normalization'
  | 'Filling & Rendering'
  | 'Verification & Drift'
  | 'Compliance & Governance'
  | 'NVCA SPA Template';

// ── Assertion capture constants ─────────────────────────────────────────────

const MAX_ASSERTIONS_RECORDED_PER_TEST = 250;
const MAX_STRING_PREVIEW_CHARS = 500;
const MAX_ARRAY_PREVIEW_ITEMS = 25;
const MAX_OBJECT_PREVIEW_KEYS = 25;
const MAX_PREVIEW_DEPTH = 4;

// ── Assertion capture infrastructure (OA-only) ─────────────────────────────

interface AssertionRecord {
  index: number;
  matcher: string;
  operator?: string;
  negated: boolean;
  passed: boolean;
  message?: string;
  expected?: unknown;
  actual?: unknown;
  timestamp: string;
}

const assertionRecordsByTest = new Map<string, AssertionRecord[]>();
const droppedAssertionsByTest = new Map<string, number>();
let assertionInstrumentationInstalled = false;

function getCurrentTestKeyContext(): string {
  const key = (globalThis as Record<string, unknown>).__OA_ALLURE_TEST_KEY__;
  if (typeof key === 'string' && key.length > 0) {
    return key;
  }
  const state = expect.getState() as { currentTestName?: string; testPath?: string };
  return `${state.testPath ?? ''}::${state.currentTestName ?? ''}`;
}

function beginAssertionCapture(testKey: string): void {
  assertionRecordsByTest.set(testKey, []);
  droppedAssertionsByTest.set(testKey, 0);
  (globalThis as Record<string, unknown>).__OA_ALLURE_TEST_KEY__ = testKey;
}

function consumeAssertionCapture(testKey: string): { records: AssertionRecord[]; dropped: number } {
  const records = assertionRecordsByTest.get(testKey) ?? [];
  const dropped = droppedAssertionsByTest.get(testKey) ?? 0;
  assertionRecordsByTest.delete(testKey);
  droppedAssertionsByTest.delete(testKey);
  const ctx = (globalThis as Record<string, unknown>).__OA_ALLURE_TEST_KEY__;
  if (ctx === testKey) {
    delete (globalThis as Record<string, unknown>).__OA_ALLURE_TEST_KEY__;
  }
  return { records, dropped };
}

function incrementDroppedAssertion(testKey: string): void {
  droppedAssertionsByTest.set(testKey, (droppedAssertionsByTest.get(testKey) ?? 0) + 1);
}

function addAssertionRecord(testKey: string, record: AssertionRecord): void {
  const records = assertionRecordsByTest.get(testKey);
  if (!records) {
    return;
  }
  if (records.length >= MAX_ASSERTIONS_RECORDED_PER_TEST) {
    incrementDroppedAssertion(testKey);
    return;
  }
  records.push(record);
}

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_PREVIEW_CHARS) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_PREVIEW_CHARS)}... [truncated ${value.length - MAX_STRING_PREVIEW_CHARS} chars]`;
}

function toSerializablePreview(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  const valueType = typeof value;
  if (valueType === 'string') {
    return truncateString(value as string);
  }
  if (valueType === 'number' || valueType === 'boolean') {
    return value;
  }
  if (valueType === 'bigint') {
    return `${value}n`;
  }
  if (valueType === 'symbol') {
    return String(value);
  }
  if (valueType === 'function') {
    const fn = value as Function;
    return `[Function ${fn.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof RegExp) {
    return String(value);
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(value.message),
      stack: truncateString(value.stack ?? ''),
    };
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (depth >= MAX_PREVIEW_DEPTH) {
    return '[Max depth reached]';
  }
  if (typeof value === 'object') {
    const obj = value as object;
    if (seen.has(obj)) {
      return '[Circular]';
    }
    seen.add(obj);

    if (Array.isArray(value)) {
      const preview = value.slice(0, MAX_ARRAY_PREVIEW_ITEMS).map((entry) =>
        toSerializablePreview(entry, depth + 1, seen),
      );
      if (value.length > MAX_ARRAY_PREVIEW_ITEMS) {
        preview.push(`[+${value.length - MAX_ARRAY_PREVIEW_ITEMS} more items]`);
      }
      return preview;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const previewEntries = entries.slice(0, MAX_OBJECT_PREVIEW_KEYS).map(([key, entryValue]) => [
      key,
      toSerializablePreview(entryValue, depth + 1, seen),
    ]);
    const output = Object.fromEntries(previewEntries);
    if (entries.length > MAX_OBJECT_PREVIEW_KEYS) {
      output.__truncated_keys__ = entries.length - MAX_OBJECT_PREVIEW_KEYS;
    }
    return output;
  }

  return String(value);
}

function extractExecutionError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }
  const asRecord = error as Error & {
    actual?: unknown;
    expected?: unknown;
    operator?: unknown;
    showDiff?: unknown;
  };
  return {
    name: error.name,
    message: error.message,
    operator: typeof asRecord.operator === 'string' ? asRecord.operator : undefined,
    showDiff: typeof asRecord.showDiff === 'boolean' ? asRecord.showDiff : undefined,
    expected: toSerializablePreview(asRecord.expected),
    actual: toSerializablePreview(asRecord.actual),
    stack: truncateString(error.stack ?? ''),
  };
}

function installAssertionInstrumentation(): void {
  if (assertionInstrumentationInstalled) {
    return;
  }

  const assertionProto = (chai.Assertion as { prototype?: { assert?: (...args: unknown[]) => unknown } }).prototype;
  const originalAssert = assertionProto?.assert;
  if (!assertionProto || typeof originalAssert !== 'function') {
    return;
  }

  assertionInstrumentationInstalled = true;
  assertionProto.assert = function patchedAssert(...args: unknown[]): unknown {
    const key = getCurrentTestKeyContext();
    const records = assertionRecordsByTest.get(key);
    const shouldRecord = Array.isArray(records);
    const util = chai.util as {
      flag: (obj: unknown, key: string) => unknown;
      getActual: (obj: unknown, assertionArgs: unknown[]) => unknown;
      getOperator?: (obj: unknown, assertionArgs: unknown[]) => unknown;
      getMessage?: (obj: unknown, assertionArgs: unknown[]) => unknown;
    };

    let passed = false;
    try {
      const result = originalAssert.apply(this, args);
      passed = true;
      return result;
    } catch (error) {
      if (shouldRecord) {
        const negated = Boolean(util.flag(this, 'negate'));
        const matcher = String(util.flag(this, '_name') ?? util.flag(this, 'operator') ?? 'assert');
        const messageValue = typeof util.getMessage === 'function' ? util.getMessage(this, args) : undefined;
        const operatorValue = typeof util.getOperator === 'function' ? util.getOperator(this, args) : undefined;
        addAssertionRecord(key, {
          index: records.length + 1,
          matcher,
          operator: typeof operatorValue === 'string' ? operatorValue : undefined,
          negated,
          passed: false,
          message: typeof messageValue === 'string' ? truncateString(messageValue) : undefined,
          expected: toSerializablePreview(args[3]),
          actual: toSerializablePreview(util.getActual(this, args)),
          timestamp: new Date().toISOString(),
        });
      }
      throw error;
    } finally {
      if (shouldRecord && passed) {
        const negated = Boolean(util.flag(this, 'negate'));
        const matcher = String(util.flag(this, '_name') ?? util.flag(this, 'operator') ?? 'assert');
        const messageValue = typeof util.getMessage === 'function' ? util.getMessage(this, args) : undefined;
        const operatorValue = typeof util.getOperator === 'function' ? util.getOperator(this, args) : undefined;
        addAssertionRecord(key, {
          index: records.length + 1,
          matcher,
          operator: typeof operatorValue === 'string' ? operatorValue : undefined,
          negated,
          passed: true,
          message: typeof messageValue === 'string' ? truncateString(messageValue) : undefined,
          expected: toSerializablePreview(args[3]),
          actual: toSerializablePreview(util.getActual(this, args)),
          timestamp: new Date().toISOString(),
        });
      }
    }
  };
}

installAssertionInstrumentation();

// ── Factory instantiation with lifecycle hooks ──────────────────────────────

const helpers = createAllureTestHelpers<EpicName>({
  defaultEpic: 'Platform & Distribution',
  defaultParentSuite: 'epic',
  injectBddContext: false,
  openspec: {
    repoBaseUrl: 'https://github.com/open-agreements/open-agreements',
  },
  beforeTest: ({ testKey }) => {
    beginAssertionCapture(testKey);
  },
  afterTest: async ({ testKey, error, helpers: h }) => {
    const capture = consumeAssertionCapture(testKey);
    if (capture.records.length > 0 || capture.dropped > 0) {
      await h.allureJsonAttachment('assertion-details.json', {
        totalAssertions: capture.records.length + capture.dropped,
        recordedAssertions: capture.records.length,
        droppedAssertions: capture.dropped,
        failures: capture.records.filter((r) => !r.passed).length,
        assertions: capture.records,
      });
    }
    if (error) {
      await h.allureJsonAttachment('execution-error.json', extractExecutionError(error));
    }
  },
});

// ── Re-exports (same names, same module path → zero test file changes) ──────

export const {
  itAllure,
  testAllure,
  allureStep,
  allureParameter,
  allureAttachment,
  allureJsonAttachment,
} = helpers;

export {
  getAllureRuntime,
  allureSeverity,
  allureDescription,
  allureDescriptionHtml,
  allureMarkdownAttachment,
  allurePrettyJsonAttachment,
  allureWordLikeTextAttachment,
  allureWordLikeMarkdownAttachment,
  allureWordLikeMarkdownDiffAttachment,
  allureFileAttachment,
  allureImageAttachment,
};

export type { AllureSeverityLevel, AllureBddContext, AllureRuntime, AllureStepContext };
