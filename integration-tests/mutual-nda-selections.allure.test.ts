import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe } from 'vitest';
import { getTemplatesDir } from '../src/utils/paths.js';
import { MUTUAL_NDA_SELECTION_SCENARIOS } from './fixtures/template-behavior-scenarios.js';
import {
  assertTemplateScenarioText,
  renderTemplateScenario,
  type TemplateBehaviorScenario,
} from './helpers/template-behavior.js';
import {
  allureAttachment,
  allureJsonAttachment,
  allureParameter,
  allureStep,
  itAllure,
} from './helpers/allure-test.js';

const tempDirs: string[] = [];
const it = itAllure.epic('Filling & Rendering');

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function runScenario(scenario: TemplateBehaviorScenario): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), `oa-${scenario.id}-`));
  tempDirs.push(tempDir);

  let renderedText = '';
  await allureParameter('template_id', scenario.templateId);
  await allureParameter('scenario_id', scenario.id);
  await allureAttachment('scenario-description.txt', scenario.description);
  await allureJsonAttachment('scenario-values.json', scenario.values);

  await allureStep('Render template', async () => {
    const result = await renderTemplateScenario({
      scenario,
      outputDir: tempDir,
      templatesRoot: getTemplatesDir(),
    });
    renderedText = result.text;
    await allureAttachment('rendered-output-path.txt', result.outputPath);
  });

  await assertTemplateScenarioText(renderedText, scenario.assertions, async (name, run) => {
    await allureStep(name, async () => {
      await run();
    });
  });
}

describe('common-paper-mutual-nda selections', () => {
  const fixedScenario = MUTUAL_NDA_SELECTION_SCENARIOS.fixed_term;
  const perpetualScenario = MUTUAL_NDA_SELECTION_SCENARIOS.perpetual;

  it.openspec('OA-036')('fixed-term flow removes non-selected options', async () => {
    await runScenario(fixedScenario);
  });

  it.openspec('OA-037')('perpetual flow marks selected options', async () => {
    await runScenario(perpetualScenario);
  });
});
