import { join } from 'node:path';
import { expect } from 'vitest';
import { fillTemplate } from '../../src/core/engine.js';
import { extractAllText } from '../../src/core/field-selector/verifier.js';
import { findTemplateDir } from '../../src/utils/paths.js';

export type TemplateTextAssertion =
  | { kind: 'contains'; text: string; label?: string }
  | { kind: 'notContains'; text: string; label?: string };

export interface TemplateBehaviorScenario {
  id: string;
  title: string;
  story: string;
  description: string;
  templateId: string;
  outputFilename: string;
  values: Record<string, string>;
  assertions: TemplateTextAssertion[];
}

interface RenderScenarioOptions {
  scenario: TemplateBehaviorScenario;
  outputDir: string;
  templatesRoot: string;
}

export interface RenderScenarioResult {
  outputPath: string;
  text: string;
}

type StepFn = (name: string, run: () => Promise<void> | void) => Promise<void>;

function shortLabel(text: string): string {
  return text.length <= 90 ? text : `${text.slice(0, 87)}...`;
}

export async function renderTemplateScenario({
  scenario,
  outputDir,
  templatesRoot,
}: RenderScenarioOptions): Promise<RenderScenarioResult> {
  const outputPath = join(outputDir, scenario.outputFilename);
  // Slugs now live two levels deep as `templates/<source>-<rights>/<slug>/`;
  // findTemplateDir resolves the correct segment (templatesRoot kept for API compatibility).
  void templatesRoot;
  const templateDir = findTemplateDir(scenario.templateId);
  if (!templateDir) {
    throw new Error(`template slug "${scenario.templateId}" not found under templates/*/`);
  }
  await fillTemplate({
    templateDir,
    outputPath,
    values: scenario.values,
  });
  const text = extractAllText(outputPath);
  return { outputPath, text };
}

export async function assertTemplateScenarioText(
  text: string,
  assertions: TemplateTextAssertion[],
  step?: StepFn
): Promise<void> {
  const runStep: StepFn = step ?? (async (_name, run) => run());

  for (const assertion of assertions) {
    const label =
      assertion.label
      ?? (assertion.kind === 'contains'
        ? `contains: ${shortLabel(assertion.text)}`
        : `does not contain: ${shortLabel(assertion.text)}`);

    await runStep(label, () => {
      if (assertion.kind === 'contains') {
        expect(text).toContain(assertion.text);
      } else {
        expect(text).not.toContain(assertion.text);
      }
    });
  }
}
