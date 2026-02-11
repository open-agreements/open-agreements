import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect } from 'vitest';
import { itAllure } from './helpers/allure-test.js';
import { ClaudeCodeAdapter } from '../src/core/command-generation/adapters/claude.js';
import type { ToolCommandAdapter } from '../src/core/command-generation/types.js';
import type { TemplateMetadata } from '../src/core/metadata.js';

const it = itAllure.epic('Platform & Distribution');

const ROOT = new URL('..', import.meta.url).pathname;
const SKILL_MD = readFileSync(join(ROOT, 'skills/open-agreements/SKILL.md'), 'utf-8');

const SAMPLE_METADATA: TemplateMetadata = {
  name: 'Mutual Non-Disclosure Agreement',
  description: 'Mutual NDA',
  source_url: 'https://example.com/mnda',
  version: '1.0',
  license: 'CC-BY-4.0',
  allow_derivatives: true,
  attribution_text: 'Example attribution',
  fields: [
    {
      name: 'purpose',
      type: 'string',
      description: 'Purpose',
      required: true,
      section: 'Term Sheet',
    },
    {
      name: 'effective_date',
      type: 'date',
      description: 'Effective date',
      required: true,
      section: 'Term Sheet',
    },
    {
      name: 'governing_law',
      type: 'string',
      description: 'Governing law',
      required: false,
      section: 'Legal',
    },
  ],
};

describe('adapter architecture', () => {
  it.openspec('OA-052')('ClaudeCodeAdapter implements ToolCommandAdapter interface', () => {
    const adapter: ToolCommandAdapter = new ClaudeCodeAdapter();
    expect(adapter.name).toBe('claude-code');
    expect(adapter.getOutputPath('common-paper-mutual-nda')).toBe(
      '.claude/commands/open-agreements.md'
    );
    expect(typeof adapter.generateSkillFile).toBe('function');
  });

  it.openspec('OA-053')('new adapter can be added without modifying core', () => {
    const customAdapter: ToolCommandAdapter = {
      name: 'cursor',
      generateSkillFile: () => '# cursor skill',
      getOutputPath: (templateId: string) => `.cursor/rules/${templateId}.md`,
    };
    expect(customAdapter.generateSkillFile(SAMPLE_METADATA, 'nda')).toContain('cursor skill');
    expect(customAdapter.getOutputPath('nda')).toBe('.cursor/rules/nda.md');
  });
});

describe('Claude skill generation', () => {
  const adapter = new ClaudeCodeAdapter();
  const generatedSkill = adapter.generateSkillFile(SAMPLE_METADATA, 'common-paper-mutual-nda');

  it.openspec('OA-048')('generated Claude skill interviews user in AskUserQuestion rounds', () => {
    expect(generatedSkill).toContain('AskUserQuestion');
    expect(generatedSkill).toContain('Field Collection Rounds');
    expect(generatedSkill).toContain('Round 1');
  });

  it.openspec('OA-049')('generated Claude skill renders DOCX via fill command after interview', () => {
    expect(generatedSkill).toContain('open-agreements fill common-paper-mutual-nda');
  });
});

describe('published skills/open-agreements/SKILL.md execution paths', () => {
  it.openspec('OA-054')('documents npx zero-preinstall DOCX rendering path', () => {
    expect(SKILL_MD).toContain('npx -y open-agreements@latest fill <template-name>');
  });

  it.openspec('OA-055')('documents installed CLI DOCX rendering path', () => {
    expect(SKILL_MD).toContain('open-agreements fill <template-name>');
  });

  it.openspec('OA-056')('documents preview-only fallback when Node.js is unavailable', () => {
    expect(SKILL_MD).toContain('PREVIEW_ONLY');
    expect(SKILL_MD).toContain('install Node.js >=20 for signable DOCX output');
  });
});
