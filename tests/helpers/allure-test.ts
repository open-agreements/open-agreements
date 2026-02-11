import { expect, it as vitestIt, test as vitestTest } from 'vitest';

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

interface AllureLabelDefaults {
  epic?: EpicName;
  feature?: string;
  parentSuite?: string;
  suite?: string;
  subSuite?: string;
  openspecScenarioIds?: string[];
}

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
      return await allureStep('Execute test body', async () => fn(...args));
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      await allureAttachment('execution-error.txt', message, TEXT_CONTENT_TYPE);
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
