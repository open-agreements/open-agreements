import { afterEach, describe, expect, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import {
  allureJsonAttachment,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

interface ChecklistHarnessOptions {
  templateDir?: string;
}

interface ChecklistHarness {
  runChecklistCreate: (args: { dealName: string; data?: string }) => Promise<void>;
  runChecklistPatchValidate: (args: {
    state: string;
    patch: string;
    output?: string;
    validationStore?: string;
  }) => Promise<void>;
  runChecklistPatchApply: (args: {
    state: string;
    request: string;
    output?: string;
    validationStore?: string;
    appliedStore?: string;
    proposedStore?: string;
  }) => Promise<void>;
  spies: {
    fillTemplate: ReturnType<typeof vi.fn>;
    findTemplateDir: ReturnType<typeof vi.fn>;
    buildChecklistTemplateContext: ReturnType<typeof vi.fn>;
    createChecklist: ReturnType<typeof vi.fn>;
    validateChecklistPatch: ReturnType<typeof vi.fn>;
    applyChecklistPatch: ReturnType<typeof vi.fn>;
  };
}

const it = itAllure.epic('Platform & Distribution');
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.unmock('../src/core/engine.js');
  vi.unmock('../src/utils/paths.js');
  vi.unmock('../src/core/checklist/index.js');
  vi.restoreAllMocks();
  vi.resetModules();
});

function createTempDir(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), label));
  tempDirs.push(dir);
  return dir;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function createChecklistPayload(): Record<string, unknown> {
  return {
    deal_name: 'Project Atlas',
    updated_at: '2026-02-28',
    documents: {
      'doc-1': {
        document_id: 'doc-1',
        title: 'Escrow Agreement',
      },
    },
    checklist_entries: {
      'entry-1': {
        entry_id: 'entry-1',
        document_id: 'doc-1',
        stage: 'CLOSING',
        sort_key: '100',
        title: 'Escrow Executed',
        status: 'FULLY_EXECUTED',
      },
    },
    action_items: {
      'action-1': {
        action_id: 'action-1',
        description: 'Confirm wire',
        status: 'NOT_STARTED',
      },
    },
    issues: {
      'issue-1': {
        issue_id: 'issue-1',
        title: 'Signature mismatch',
        status: 'OPEN',
      },
    },
  };
}

function createStatePayload(revision = 1): Record<string, unknown> {
  return {
    checklist_id: 'ck-1',
    revision,
    checklist: createChecklistPayload(),
  };
}

function createPatchEnvelope(): Record<string, unknown> {
  return {
    patch_id: 'patch-1',
    expected_revision: 1,
    operations: [
      {
        op: 'add',
        path: '/issues/issue-2',
        value: {
          issue_id: 'issue-2',
          title: 'Added issue',
          status: 'OPEN',
        },
      },
    ],
  };
}

async function loadChecklistHarness(opts: ChecklistHarnessOptions = {}): Promise<ChecklistHarness> {
  vi.resetModules();

  const fillTemplate = vi.fn(async ({ outputPath }: { outputPath: string }) => ({
    outputPath,
    metadata: { name: 'Closing Checklist' },
    fieldsUsed: ['deal_name'],
  }));

  const findTemplateDir = vi.fn(() => opts.templateDir ?? '/templates/closing-checklist');

  const buildChecklistTemplateContext = vi.fn((checklist: { deal_name: string; updated_at: string }) => ({
    deal_name: checklist.deal_name,
    updated_at: checklist.updated_at,
    working_group: [],
    documents: [],
    action_items: [],
    open_issues: [],
  }));

  const validateChecklistPatch = vi.fn(async ({
    checklist_id,
    current_revision,
    patch,
    store,
  }: {
    checklist_id: string;
    current_revision: number;
    patch: { patch_id: string; expected_revision: number };
    store?: { set: (artifact: unknown) => Promise<void>; get: (id: string) => Promise<unknown>; delete: (id: string) => Promise<void> };
  }) => {
    if (store) {
      const artifact = {
        validation_id: 'val-1',
        checklist_id,
        patch_id: patch.patch_id,
        expected_revision: patch.expected_revision,
        current_revision,
      };
      await store.set(artifact);
      await store.get('val-1');
      await store.delete('val-1');
    }
    return {
      ok: true,
      validation_id: 'val-1',
      expires_at: '2026-02-28T00:00:00.000Z',
      diagnostics: [],
    };
  });

  const applyChecklistPatch = vi.fn(async ({
    current_revision,
    checklist,
  }: {
    current_revision: number;
    checklist: Record<string, unknown>;
  }) => ({
    ok: true,
    applied: true,
    idempotent_replay: false,
    new_revision: current_revision + 1,
    checklist,
  }));

  const createChecklist = vi.fn((_dealName: string, _initialData?: unknown) => ({
    uuid: 'ck-123',
  }));

  vi.doMock('../src/core/engine.js', () => ({
    fillTemplate,
  }));

  vi.doMock('../src/utils/paths.js', () => ({
    findTemplateDir,
  }));

  vi.doMock('../src/core/checklist/index.js', () => {
    const ClosingChecklistSchema = z.object({
      deal_name: z.string().min(1),
      updated_at: z.string().min(1),
      documents: z.record(z.string(), z.unknown()).default({}),
      checklist_entries: z.record(z.string(), z.unknown()).default({}),
      action_items: z.record(z.string(), z.unknown()).default({}),
      issues: z.record(z.string(), z.unknown()).default({}),
    });

    const ChecklistPatchEnvelopeSchema = z.object({
      patch_id: z.string().min(1),
      expected_revision: z.number().int().nonnegative(),
      mode: z.enum(['APPLY', 'PROPOSED']).default('APPLY'),
      operations: z.array(
        z.object({
          op: z.enum(['add', 'replace', 'remove']),
          path: z.string().min(1),
          value: z.unknown().optional(),
        })
      ).min(1),
    });

    const ChecklistPatchApplyRequestSchema = z.object({
      validation_id: z.string().min(1),
      patch: ChecklistPatchEnvelopeSchema,
    });

    return {
      ClosingChecklistSchema,
      ChecklistPatchEnvelopeSchema,
      ChecklistPatchApplyRequestSchema,
      buildChecklistTemplateContext,
      createChecklist,
      validateChecklistPatch,
      applyChecklistPatch,
    };
  });

  const module = await import('../src/commands/checklist.js');

  return {
    runChecklistCreate: module.runChecklistCreate,
    runChecklistPatchValidate: module.runChecklistPatchValidate,
    runChecklistPatchApply: module.runChecklistPatchApply,
    spies: {
      fillTemplate,
      findTemplateDir,
      buildChecklistTemplateContext,
      createChecklist,
      validateChecklistPatch,
      applyChecklistPatch,
    },
  };
}

describe('checklist command coverage', () => {
  it('rejects invalid checklist JSON payloads before rendering', async () => {
    const harness = await loadChecklistHarness();
    const dir = createTempDir('oa-checklist-invalid-');
    const dataPath = join(dir, 'checklist.json');
    writeJson(dataPath, { updated_at: '2026-02-28' });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(harness.runChecklistCreate({ dealName: 'Project Atlas', data: dataPath })).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Validation errors:'));
    expect(harness.spies.createChecklist).not.toHaveBeenCalled();
  });

  it('creates checklist state from valid initial data and logs UUID', async () => {
    const harness = await loadChecklistHarness();
    const dir = createTempDir('oa-checklist-template-missing-');
    const dataPath = join(dir, 'checklist.json');
    writeJson(dataPath, createChecklistPayload());

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await harness.runChecklistCreate({ dealName: 'Project Atlas', data: dataPath });

    expect(harness.spies.createChecklist).toHaveBeenCalledWith('Project Atlas', expect.objectContaining({
      deal_name: 'Project Atlas',
      updated_at: '2026-02-28',
    }));
    expect(logSpy).toHaveBeenCalledWith('Created checklist "Project Atlas"');
    expect(logSpy).toHaveBeenCalledWith('UUID: ck-123');
  });

  it('creates checklist state without initial data when --data is omitted', async () => {
    const harness = await loadChecklistHarness();
    await harness.runChecklistCreate({ dealName: 'Project Atlas' });
    expect(harness.spies.createChecklist).toHaveBeenCalledWith('Project Atlas', undefined);
  });

  it('surfaces checklist state creation failures', async () => {
    const harness = await loadChecklistHarness();
    harness.spies.createChecklist.mockImplementationOnce(() => {
      throw new Error('state write failed');
    });

    await expect(harness.runChecklistCreate({ dealName: 'Project Atlas' })).rejects.toThrow('state write failed');
  });

  it('writes patch validation output and persists validation artifacts through the JSON store', async () => {
    const harness = await loadChecklistHarness();
    const dir = createTempDir('oa-checklist-validate-success-');
    const statePath = join(dir, 'state.json');
    const patchPath = join(dir, 'patch.json');
    const outputPath = join(dir, 'validation-result.json');
    const storePath = join(dir, 'validation-store.json');
    writeJson(statePath, createStatePayload());
    writeJson(patchPath, createPatchEnvelope());

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await harness.runChecklistPatchValidate({
      state: statePath,
      patch: patchPath,
      output: outputPath,
      validationStore: storePath,
    });

    const output = JSON.parse(readFileSync(outputPath, 'utf-8')) as { ok: boolean; validation_id?: string };
    const store = JSON.parse(readFileSync(storePath, 'utf-8')) as Record<string, unknown>;

    await allureJsonAttachment('checklist-patch-validate-success.json', {
      output,
      validationStore: store,
      logs: logSpy.mock.calls.map((call) => String(call[0])),
    });

    expect(output.ok).toBe(true);
    expect(output.validation_id).toBe('val-1');
    expect(store).toEqual({});
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('Patch validation result written to'))).toBe(true);
  });

  it('exits when patch-validate receives invalid envelope data', async () => {
    const harness = await loadChecklistHarness();
    const dir = createTempDir('oa-checklist-validate-invalid-');
    const statePath = join(dir, 'state.json');
    const patchPath = join(dir, 'patch.json');
    writeJson(statePath, createStatePayload());
    writeJson(patchPath, { expected_revision: 1 });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      harness.runChecklistPatchValidate({
        state: statePath,
        patch: patchPath,
      })
    ).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Patch validation errors:'));
  });

  it('updates checklist state and writes patch-apply output for successful apply', async () => {
    const harness = await loadChecklistHarness();
    const dir = createTempDir('oa-checklist-apply-success-');
    const statePath = join(dir, 'state.json');
    const requestPath = join(dir, 'request.json');
    const outputPath = join(dir, 'apply-result.json');
    const state = createStatePayload(7);

    writeJson(statePath, state);
    writeJson(requestPath, {
      validation_id: 'val-1',
      patch: createPatchEnvelope(),
    });

    harness.spies.applyChecklistPatch.mockResolvedValueOnce({
      ok: true,
      applied: true,
      idempotent_replay: false,
      new_revision: 8,
      checklist: {
        ...createChecklistPayload(),
        issues: {
          'issue-1': {
            issue_id: 'issue-1',
            title: 'Signature mismatch',
            status: 'CLOSED',
          },
        },
      },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await harness.runChecklistPatchApply({
      state: statePath,
      request: requestPath,
      output: outputPath,
    });

    const updatedState = JSON.parse(readFileSync(statePath, 'utf-8')) as { revision: number };
    const output = JSON.parse(readFileSync(outputPath, 'utf-8')) as { ok: boolean; new_revision?: number };

    await allureJsonAttachment('checklist-patch-apply-success.json', {
      updatedState,
      output,
      logs: logSpy.mock.calls.map((call) => String(call[0])),
    });

    expect(updatedState.revision).toBe(8);
    expect(output.ok).toBe(true);
    expect(output.new_revision).toBe(8);
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('Checklist state updated:'))).toBe(true);
  });

  it('keeps state unchanged on idempotent replay and exits on failed apply', async () => {
    const harness = await loadChecklistHarness();
    const unchangedDir = createTempDir('oa-checklist-apply-unchanged-');
    const failedDir = createTempDir('oa-checklist-apply-failed-');

    const unchangedStatePath = join(unchangedDir, 'state.json');
    const unchangedRequestPath = join(unchangedDir, 'request.json');
    writeJson(unchangedStatePath, createStatePayload(3));
    writeJson(unchangedRequestPath, {
      validation_id: 'val-1',
      patch: createPatchEnvelope(),
    });

    harness.spies.applyChecklistPatch.mockResolvedValueOnce({
      ok: true,
      applied: true,
      idempotent_replay: true,
      new_revision: 3,
      checklist: createChecklistPayload(),
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await harness.runChecklistPatchApply({
      state: unchangedStatePath,
      request: unchangedRequestPath,
    });

    const unchangedState = JSON.parse(readFileSync(unchangedStatePath, 'utf-8')) as { revision: number };
    expect(unchangedState.revision).toBe(3);
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('Checklist state unchanged.'))).toBe(true);

    const failedStatePath = join(failedDir, 'state.json');
    const failedRequestPath = join(failedDir, 'request.json');
    writeJson(failedStatePath, createStatePayload(3));
    writeJson(failedRequestPath, {
      validation_id: 'val-1',
      patch: createPatchEnvelope(),
    });

    harness.spies.applyChecklistPatch.mockResolvedValueOnce({
      ok: false,
      error_code: 'REVISION_CONFLICT',
      message: 'stale revision',
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      harness.runChecklistPatchApply({
        state: failedStatePath,
        request: failedRequestPath,
      })
    ).rejects.toThrow('EXIT_1');

    await allureJsonAttachment('checklist-patch-apply-failure.json', {
      stderr: errorSpy.mock.calls.map((call) => String(call[0])),
    });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('REVISION_CONFLICT'));
  });

  it('exits when patch-apply receives an invalid request envelope', async () => {
    const harness = await loadChecklistHarness();
    const dir = createTempDir('oa-checklist-apply-invalid-request-');
    const statePath = join(dir, 'state.json');
    const requestPath = join(dir, 'request.json');
    writeJson(statePath, createStatePayload(3));
    writeJson(requestPath, {
      validation_id: '',
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`EXIT_${code ?? 0}`);
    }) as never);

    await expect(
      harness.runChecklistPatchApply({
        state: statePath,
        request: requestPath,
      })
    ).rejects.toThrow('EXIT_1');

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Patch apply request errors:'));
  });
});
