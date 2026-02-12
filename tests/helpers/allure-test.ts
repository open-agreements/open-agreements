import { chai, expect, it as vitestIt, test as vitestTest } from 'vitest';

declare const allure: any;

type AnyFn = (...args: any[]) => any;

type WrappedTestFn = typeof vitestIt;

type EpicName =
  | 'Platform & Distribution'
  | 'Discovery & Metadata'
  | 'Cleaning & Normalization'
  | 'Filling & Rendering'
  | 'Verification & Drift'
  | 'Compliance & Governance'
  | 'NVCA SPA Template';

const DEFAULT_EPIC: EpicName = 'Platform & Distribution';
const JSON_CONTENT_TYPE = 'application/json';
const TEXT_CONTENT_TYPE = 'text/plain';
const MAX_ASSERTIONS_RECORDED_PER_TEST = 250;
const MAX_STRING_PREVIEW_CHARS = 500;
const MAX_ARRAY_PREVIEW_ITEMS = 25;
const MAX_OBJECT_PREVIEW_KEYS = 25;
const MAX_PREVIEW_DEPTH = 4;

interface AllureLabelDefaults {
  epic?: EpicName;
  feature?: string;
  parentSuite?: string;
  suite?: string;
  subSuite?: string;
  openspecScenarioIds?: string[];
}

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

function currentTestKey(): string {
  const state = expect.getState() as { currentTestName?: string; testPath?: string };
  return `${state.testPath ?? ''}::${state.currentTestName ?? ''}`;
}

function setCurrentTestKeyContext(): string {
  const key = currentTestKey();
  if (key.length > 2) {
    (globalThis as Record<string, unknown>).__OA_ALLURE_TEST_KEY__ = key;
  }
  return key;
}

function getCurrentTestKeyContext(): string {
  const key = (globalThis as Record<string, unknown>).__OA_ALLURE_TEST_KEY__;
  if (typeof key === 'string' && key.length > 0) {
    return key;
  }
  return currentTestKey();
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

function installAssertionInstrumentation(): void {
  if (assertionInstrumentationInstalled) {
    return;
  }

  const assertionProto = (chai.Assertion as { prototype?: { assert?: (...args: any[]) => unknown } }).prototype;
  const originalAssert = assertionProto?.assert;
  if (!assertionProto || typeof originalAssert !== 'function') {
    return;
  }

  assertionInstrumentationInstalled = true;
  assertionProto.assert = function patchedAssert(...args: any[]): unknown {
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

installAssertionInstrumentation();

function parseCurrentTestName(): string[] {
  const state = expect.getState() as { currentTestName?: string };
  return (state.currentTestName ?? '')
    .split(' > ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function resolveEpic(feature: string, fullName: string, defaults?: AllureLabelDefaults): EpicName {
  void feature;
  void fullName;
  if (defaults?.epic) {
    return defaults.epic;
  }
  return DEFAULT_EPIC;
}

async function applyDefaultAllureLabels(defaults?: AllureLabelDefaults): Promise<void> {
  if (typeof allure === 'undefined') {
    return;
  }

  const nameParts = parseCurrentTestName();
  const hierarchyParts = nameParts.slice(0, -1);
  const fullName = nameParts.join(' > ');
  const feature = defaults?.feature ?? hierarchyParts[0] ?? nameParts[0] ?? 'General';
  const suite = defaults?.suite ?? hierarchyParts[1];
  const subSuite = defaults?.subSuite ?? hierarchyParts[2];
  const epic = resolveEpic(feature, fullName, defaults);
  const parentSuite = defaults?.parentSuite ?? epic;

  await allure.epic(epic);
  await allure.feature(feature);
  await allure.parentSuite(parentSuite);
  if (suite) {
    await allure.suite(suite);
  }
  if (subSuite && typeof allure.subSuite === 'function') {
    await allure.subSuite(subSuite);
  }
  await allure.severity('normal');
}

function resolveStoryLabel(explicitName: unknown, nameParts: string[]): string {
  if (
    typeof explicitName === 'string' &&
    explicitName.trim().length > 0 &&
    !/%[sdifjoO]/.test(explicitName)
  ) {
    return explicitName;
  }
  return nameParts.at(-1) ?? 'Unnamed test';
}

function normalizeOpenSpecScenarioIds(values: unknown[]): string[] {
  const flattened = values.flatMap((value) => Array.isArray(value) ? value : [value]);
  const ids = flattened
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(ids)];
}

function wrapWithAllure(fn?: AnyFn, explicitName?: unknown, defaults?: AllureLabelDefaults): AnyFn | undefined {
  if (!fn) {
    return undefined;
  }

  return async (...args: any[]) => {
    const testKey = setCurrentTestKeyContext();
    beginAssertionCapture(testKey);
    await applyDefaultAllureLabels(defaults);

    const nameParts = parseCurrentTestName();
    const hierarchyParts = nameParts.slice(0, -1);
    const fullName = nameParts.join(' > ');
    const feature = defaults?.feature ?? hierarchyParts[0] ?? nameParts[0] ?? 'General';
    const suite = defaults?.suite ?? hierarchyParts[1] ?? '';
    const epic = resolveEpic(feature, fullName, defaults);
    const scenarioIds = defaults?.openspecScenarioIds ?? [];
    const storyLabels: string[] = scenarioIds.length > 0
      ? scenarioIds
      : [resolveStoryLabel(explicitName, nameParts)];

    if (typeof allure !== 'undefined') {
      for (const story of storyLabels) {
        await allure.story(story);
      }
    }

    await allureParameter('epic', epic);
    await allureParameter('feature', feature);
    if (suite.length > 0) {
      await allureParameter('suite', suite);
    }
    await allureParameter('test_name', fullName);
    if (scenarioIds.length > 0) {
      await allureParameter('openspec_scenario_ids', scenarioIds.join(' | '));
    }
    await allureJsonAttachment('test-context', {
      epic,
      feature,
      suite: suite.length > 0 ? suite : undefined,
      testName: fullName,
      stories: storyLabels,
      openspecScenarioIds: scenarioIds,
    });

    try {
      const result = await allureStep('Execute test body', async () => fn(...args));
      const assertionCapture = consumeAssertionCapture(testKey);
      if (assertionCapture.records.length > 0 || assertionCapture.dropped > 0) {
        await allureJsonAttachment('assertion-details.json', {
          totalAssertions: assertionCapture.records.length + assertionCapture.dropped,
          recordedAssertions: assertionCapture.records.length,
          droppedAssertions: assertionCapture.dropped,
          failures: assertionCapture.records.filter((record) => !record.passed).length,
          assertions: assertionCapture.records,
        });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      await allureAttachment('execution-error.txt', message, TEXT_CONTENT_TYPE);
      await allureJsonAttachment('execution-error.json', extractExecutionError(error));
      const assertionCapture = consumeAssertionCapture(testKey);
      if (assertionCapture.records.length > 0 || assertionCapture.dropped > 0) {
        await allureJsonAttachment('assertion-details.json', {
          totalAssertions: assertionCapture.records.length + assertionCapture.dropped,
          recordedAssertions: assertionCapture.records.length,
          droppedAssertions: assertionCapture.dropped,
          failures: assertionCapture.records.filter((record) => !record.passed).length,
          assertions: assertionCapture.records,
        });
      }
      throw error;
    }
  };
}

type WrappedAllureTestFn = WrappedTestFn & {
  withLabels: (defaults: AllureLabelDefaults) => WrappedAllureTestFn;
  epic: (epic: EpicName) => WrappedAllureTestFn;
  openspec: (...scenarioIds: Array<string | string[]>) => WrappedAllureTestFn;
};

function withAllure(base: any, defaults?: AllureLabelDefaults): WrappedAllureTestFn {
  const wrapped: any = (name: any, fn?: AnyFn, timeout?: number) =>
    base(name, wrapWithAllure(fn, name, defaults), timeout);

  wrapped.only = (name: any, fn?: AnyFn, timeout?: number) =>
    base.only(name, wrapWithAllure(fn, name, defaults), timeout);
  wrapped.skip = base.skip.bind(base);
  wrapped.todo = base.todo.bind(base);
  wrapped.fails = (name: any, fn?: AnyFn, timeout?: number) =>
    base.fails(name, wrapWithAllure(fn, name, defaults), timeout);
  wrapped.concurrent = (name: any, fn?: AnyFn, timeout?: number) =>
    base.concurrent(name, wrapWithAllure(fn, name, defaults), timeout);

  wrapped.each = (...tableArgs: any[]) => {
    const eachBase = base.each(...tableArgs);
    return (name: any, fn?: AnyFn, timeout?: number) =>
      eachBase(name, wrapWithAllure(fn, name, defaults), timeout);
  };

  wrapped.withLabels = (nextDefaults: AllureLabelDefaults) =>
    withAllure(base, { ...defaults, ...nextDefaults });
  wrapped.epic = (epic: EpicName) =>
    withAllure(base, { ...defaults, epic });
  wrapped.openspec = (...scenarioIds: Array<string | string[]>) =>
    withAllure(base, {
      ...defaults,
      openspecScenarioIds: normalizeOpenSpecScenarioIds(scenarioIds),
    });

  return wrapped as WrappedAllureTestFn;
}

export const itAllure = withAllure(vitestIt);
export const testAllure = withAllure(vitestTest);

export async function allureStep<T>(name: string, run: () => T | Promise<T>): Promise<T> {
  if (typeof allure !== 'undefined' && typeof allure.step === 'function') {
    return allure.step(name, run);
  }
  return run();
}

export async function allureParameter(name: string, value: string): Promise<void> {
  if (typeof allure !== 'undefined' && typeof allure.parameter === 'function') {
    await allure.parameter(name, value);
  }
}

export async function allureAttachment(name: string, content: string, contentType = TEXT_CONTENT_TYPE): Promise<void> {
  if (typeof allure !== 'undefined' && typeof allure.attachment === 'function') {
    await allure.attachment(name, content, contentType);
  }
}

export async function allureJsonAttachment(name: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload, null, 2);
  await allureAttachment(name, body, JSON_CONTENT_TYPE);
}
