import type { ToolCommandAdapter } from '../types.js';
import type { TemplateMetadata } from '../../metadata.js';

interface InterviewField {
  name: string;
  description: string;
  type: string;
  required: boolean;
}

export class ClaudeCodeAdapter implements ToolCommandAdapter {
  readonly name = 'claude-code';

  generateSkillFile(metadata: TemplateMetadata, templateId: string): string {
    const requiredFields = new Set(metadata.required_fields);
    const fieldsBySection = this.groupFieldsBySection(metadata);
    const questionRounds = this.buildQuestionRounds(fieldsBySection);

    return `# OpenAgreements: Fill ${metadata.name}

Fill the **${metadata.name}** template with user-provided values and render a DOCX file.

Source: ${metadata.source_url}
License: ${metadata.license}
${metadata.attribution_text}

## Instructions

1. Greet the user and explain you'll help them fill out a ${metadata.name}.
2. Collect field values using AskUserQuestion in multiple rounds (up to 4 questions each).
3. After collecting all values, run the template engine to produce the filled DOCX.

## Field Collection Rounds

${questionRounds}

## Execution

After collecting all field values, run:

\`\`\`bash
open-agreements fill ${templateId} ${metadata.fields
      .filter((f) => requiredFields.has(f.name))
      .map((f) => `--${f.name} "\${${f.name}}"`)
      .join(' ')}
\`\`\`

The filled DOCX will be saved to the current directory.

## Important

- All fields should be confirmed with the user before rendering.
- If the user is unsure about a field (e.g., governing law), suggest common defaults.
- This template is licensed under ${metadata.license}. ${metadata.attribution_text}
`;
  }

  getOutputPath(_templateId: string): string {
    return '.claude/commands/open-agreements.md';
  }

  private groupFieldsBySection(
    metadata: TemplateMetadata
  ): Map<string, InterviewField[]> {
    const requiredFields = new Set(metadata.required_fields);
    const sections = new Map<string, InterviewField[]>();
    for (const field of metadata.fields) {
      const fieldWithRequired = {
        ...field,
        required: requiredFields.has(field.name),
      };
      const section = field.section ?? 'General';
      if (!sections.has(section)) sections.set(section, []);
      sections.get(section)!.push(fieldWithRequired);
    }
    return sections;
  }

  private buildQuestionRounds(
    fieldsBySection: Map<string, InterviewField[]>
  ): string {
    let round = 1;
    let output = '';
    let currentBatch: InterviewField[] = [];

    for (const [section, fields] of fieldsBySection) {
      for (const field of fields) {
        currentBatch.push(field);
        if (currentBatch.length === 4) {
          output += this.formatRound(round, section, currentBatch);
          round++;
          currentBatch = [];
        }
      }
      if (currentBatch.length > 0) {
        output += this.formatRound(round, section, currentBatch);
        round++;
        currentBatch = [];
      }
    }

    return output;
  }

  private formatRound(
    round: number,
    section: string,
    fields: InterviewField[]
  ): string {
    const fieldList = fields
      .map(
        (f) =>
          `  - **${f.name}** (${f.type}${f.required ? ', required' : ', optional'}): ${f.description}`
      )
      .join('\n');
    return `### Round ${round}: ${section}\n${fieldList}\n\n`;
  }
}
