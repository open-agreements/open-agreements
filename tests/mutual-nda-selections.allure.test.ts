import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'vitest';
import { getTemplatesDir } from '../src/utils/paths.js';
import { MUTUAL_NDA_SELECTION_SCENARIOS } from './fixtures/template-behavior-scenarios.js';
import {
  assertTemplateScenarioText,
  renderTemplateScenario,
  type TemplateBehaviorScenario,
} from './helpers/template-behavior.js';

declare const allure: any;

const TEST_CAPABILITY = 'open-agreements';
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function tagScenario(story: string, description: string): Promise<void> {
  await allure.epic('OpenSpec Traceability');
  await allure.feature(TEST_CAPABILITY);
  await allure.parentSuite('Template behavior');
  await allure.suite('common-paper-mutual-nda');
  await allure.story(story);
  await allure.severity('normal');
  await allure.description(description);
}

async function runScenario(scenario: TemplateBehaviorScenario): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), `oa-${scenario.id}-`));
  tempDirs.push(tempDir);

  let renderedText = '';

  await allure.step('Render template', async () => {
    const result = await renderTemplateScenario({
      scenario,
      outputDir: tempDir,
      templatesRoot: getTemplatesDir(),
    });
    renderedText = result.text;
  });

  await assertTemplateScenarioText(renderedText, scenario.assertions, async (name, run) => {
    await allure.step(name, async () => {
      await run();
    });
  });
}

describe('common-paper-mutual-nda selections', () => {
  const fixedScenario = MUTUAL_NDA_SELECTION_SCENARIOS.fixed_term;
  const perpetualScenario = MUTUAL_NDA_SELECTION_SCENARIOS.perpetual;

  it(fixedScenario.title, async () => {
    await tagScenario(
      'Fixed term selection removes non-selected options',
      fixedScenario.description
    );
    await runScenario(fixedScenario);
  });

  it(perpetualScenario.title, async () => {
    await tagScenario(
      'Perpetual selection marks selected options',
      perpetualScenario.description
    );
    await runScenario(perpetualScenario);
  });
});
