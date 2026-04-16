import { z } from 'zod';

const templateIdPattern = /^[a-z0-9][a-z0-9-]*$/;
const variableNamePattern = /^[a-z_][a-z0-9_]*$/;
const styleSlugPattern = /^[a-z0-9][a-z0-9-]*$/;
const hexColorPattern = /^[0-9A-Fa-f]{6}$/;

const textSchema = z.string().min(1);

const variableDefinitionSchema = z.object({
  type: z.enum(['string', 'date', 'number', 'boolean', 'enum']),
  description: textSchema,
  options: z.array(textSchema).optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'enum' && (!value.options || value.options.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['options'],
      message: 'Enum variables must declare at least one option',
    });
  }
});

const alignmentSchema = z.enum(['left', 'center', 'right', 'justified']);
const previewEmphasisSchema = z.enum(['plain', 'italic', 'bold', 'bold_italic']);

const paragraphStyleSchema = z.object({
  align: alignmentSchema.optional(),
  font: textSchema.optional(),
  font_size: z.number().int().positive().optional(),
  color: z.string().regex(hexColorPattern).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  spacing_before: z.number().int().nonnegative().optional(),
  spacing_after: z.number().int().nonnegative().optional(),
  page_break_before: z.boolean().optional().default(false),
  preview_emphasis: previewEmphasisSchema.optional().default('plain'),
});

const inlineStyleSchema = z.object({
  font: textSchema.optional(),
  font_size: z.number().int().positive().optional(),
  color: z.string().regex(hexColorPattern).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  preview_emphasis: previewEmphasisSchema.optional().default('plain'),
});

export const contractIrFrontmatterSchema = z.object({
  template_id: z.string().regex(templateIdPattern),
  schema: textSchema,
  docStyle: textSchema,
  title: textSchema.optional(),
  jurisdiction: textSchema.optional(),
  running_header: textSchema.optional(),
});

export const contractIrSchemaRegistrySchema = z.object({
  schema_id: z.string().regex(templateIdPattern),
  variables: z.record(z.string(), variableDefinitionSchema),
}).superRefine((value, ctx) => {
  for (const variableName of Object.keys(value.variables)) {
    if (!variableNamePattern.test(variableName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variables', variableName],
        message: `Variable names must match ${variableNamePattern}`,
      });
    }
  }
});

export const contractIrStyleRegistrySchema = z.object({
  style_id: z.string().regex(templateIdPattern),
  docx: z.object({
    page_size: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    page_margin: z.object({
      top: z.number().int().nonnegative(),
      right: z.number().int().nonnegative(),
      bottom: z.number().int().nonnegative(),
      left: z.number().int().nonnegative(),
      header: z.number().int().nonnegative(),
      footer: z.number().int().nonnegative(),
      gutter: z.number().int().nonnegative(),
    }),
    defaults: z.object({
      font: textSchema,
      font_size: z.number().int().positive(),
      color: z.string().regex(hexColorPattern),
      line: z.number().int().positive(),
      spacing_after: z.number().int().nonnegative(),
    }),
    header: z.object({
      enabled: z.boolean().default(false),
      first_page_only: z.boolean().default(false),
      font_size: z.number().int().positive().default(18),
      color: z.string().regex(hexColorPattern).default('107087'),
      rule_color: z.string().regex(hexColorPattern).default('107087'),
      rule_size: z.number().int().positive().default(14),
      spacing_after: z.number().int().nonnegative().default(60),
    }).optional(),
    footer: z.object({
      enabled: z.boolean().default(false),
      font_size: z.number().int().positive().default(13),
      color: z.string().regex(hexColorPattern).default('494A4B'),
    }).optional(),
  }),
  headings: z.object({
    h1: paragraphStyleSchema,
    h2: paragraphStyleSchema.optional(),
    h3: paragraphStyleSchema.optional(),
  }),
  block_styles: z.record(z.string(), paragraphStyleSchema).default({}),
  inline_styles: z.record(z.string(), inlineStyleSchema).default({}),
}).superRefine((value, ctx) => {
  for (const slug of Object.keys(value.block_styles)) {
    if (!styleSlugPattern.test(slug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['block_styles', slug],
        message: `Block style slugs must match ${styleSlugPattern}`,
      });
    }
  }

  for (const slug of Object.keys(value.inline_styles)) {
    if (!styleSlugPattern.test(slug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['inline_styles', slug],
        message: `Inline style slugs must match ${styleSlugPattern}`,
      });
    }
  }
});

function formatIssues(parsedError) {
  return parsedError.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

export function validateContractIrFrontmatter(value, filePath = 'Contract IR frontmatter') {
  const parsed = contractIrFrontmatterSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  throw new Error(`Invalid Contract IR frontmatter (${filePath}): ${formatIssues(parsed.error)}`);
}

export function validateContractIrSchemaRegistry(value, filePath = 'Contract IR schema registry') {
  const parsed = contractIrSchemaRegistrySchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  throw new Error(`Invalid Contract IR schema registry (${filePath}): ${formatIssues(parsed.error)}`);
}

export function validateContractIrStyleRegistry(value, filePath = 'Contract IR style registry') {
  const parsed = contractIrStyleRegistrySchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  throw new Error(`Invalid Contract IR style registry (${filePath}): ${formatIssues(parsed.error)}`);
}

export {
  previewEmphasisSchema,
  variableNamePattern,
  styleSlugPattern,
};
