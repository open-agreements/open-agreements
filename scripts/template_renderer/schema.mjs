import { z } from 'zod';

const idPattern = /^[a-z0-9][a-z0-9-]*$/;
const fieldNamePattern = /^[a-z_][a-z0-9_]*$/;

const textSchema = z.string().min(1);

const coverRowSchema = z.object({
  id: z.string().regex(idPattern).optional(),
  kind: z.enum(['row', 'group', 'subrow']).optional(),
  label: textSchema,
  value: z.string(),
  hint: z.string().optional(),
  note: z.string().optional(),
  condition: z.string().regex(fieldNamePattern).optional(),
  sub: z.boolean().optional().default(false),
});

const textClauseSchema = z.object({
  id: z.string().regex(idPattern).optional(),
  heading: textSchema,
  body: textSchema,
  condition: z.string().regex(fieldNamePattern).optional(),
  omitted_body: z.string().optional(),
});

const definitionTermSchema = z.object({
  id: z.string().regex(idPattern).optional(),
  term: textSchema,
  aliases: z.array(textSchema).optional(),
  definition: textSchema,
});

const definitionsClauseSchema = z.object({
  id: z.string().regex(idPattern).optional(),
  type: z.literal('definitions'),
  heading: textSchema,
  terms: z.array(definitionTermSchema).min(1),
});

const clauseSchema = z.union([textClauseSchema, definitionsClauseSchema]);

const twoPartySignatureRowSchema = z.object({
  label: textSchema,
  hint: z.string().optional(),
  left: z.string().optional(),
  right: z.string().optional(),
  left_only: z.boolean().optional().default(false),
});

const onePartySignatureRowSchema = z.object({
  label: textSchema,
  hint: z.string().optional(),
  value: z.string().optional(),
});

const twoPartySignatureSchema = z.object({
  mode: z.literal('two-party'),
  section_label: textSchema,
  heading_title: textSchema,
  preamble: textSchema,
  party_a: textSchema,
  party_b: textSchema,
  rows: z.array(twoPartySignatureRowSchema).min(1),
});

const onePartySignatureSchema = z.object({
  mode: z.literal('one-party'),
  section_label: textSchema,
  heading_title: textSchema,
  preamble: textSchema,
  party: textSchema,
  rows: z.array(onePartySignatureRowSchema).min(1),
});

const signerRowSchema = z.object({
  id: z.string().regex(idPattern),
  label: textSchema,
  hint: z.string().optional(),
  value: z.string().optional().default(''),
});

const signerSchema = z.object({
  id: z.string().regex(idPattern),
  label: textSchema,
  kind: z.enum(['entity', 'individual', 'acknowledging-individual']),
  capacity: z.enum(['through_representative', 'personal', 'acknowledging']).optional(),
  rows: z.array(signerRowSchema).min(1),
});

const signerRepeatSchema = z.object({
  collection_field: z.string().regex(fieldNamePattern),
  item_name: z.string().regex(fieldNamePattern),
});

const signerModeSignatureSchema = z.object({
  mode: z.literal('signers'),
  arrangement: z.enum(['entity-plus-individual', 'stacked']).optional().default('stacked'),
  section_label: textSchema,
  heading_title: textSchema,
  preamble: textSchema,
  signers: z.array(signerSchema).min(1),
  repeat: signerRepeatSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.repeat && value.arrangement !== 'stacked') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['repeat'],
      message: 'repeat is only supported for signer arrangement "stacked"',
    });
  }

  if (value.repeat && value.signers.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['signers'],
      message: 'repeat-backed stacked signer sections require exactly one signer prototype',
    });
  }
});

export const contractSpecSchema = z.object({
  template_id: z.string().regex(idPattern),
  layout_id: z.string().regex(idPattern),
  style_id: z.string().regex(idPattern),
  output_docx_path: textSchema,
  output_markdown_path: textSchema.optional(),
  document: z.object({
    title: textSchema,
    label: textSchema,
    version: textSchema,
    license: textSchema,
    include_cloud_doc_line: z.boolean().optional().default(false),
    defined_term_highlight_mode: z.enum(['all_instances', 'definition_site_only', 'none']).optional().default('all_instances'),
    cover_row_height: z.number().int().positive().optional(),
    opening_note: textSchema.optional(),
    opening_recital: textSchema.optional(),
  }),
  sections: z.object({
    cover_terms: z.object({
      section_label: textSchema,
      heading_title: textSchema,
      subtitle: textSchema,
      rows: z.array(coverRowSchema).min(1),
    }).optional(),
    standard_terms: z.object({
      section_label: textSchema,
      heading_title: textSchema,
      clauses: z.array(clauseSchema).min(1),
    }),
    signature: z.union([twoPartySignatureSchema, onePartySignatureSchema, signerModeSignatureSchema]),
  }),
});

export const styleProfileSchema = z.object({
  id: z.string().regex(idPattern),
  defined_terms: z.array(textSchema),
  colors: z.object({
    ink: z.string().length(6),
    ink_soft: z.string().length(6),
    muted: z.string().length(6),
    accent: z.string().length(6),
    accent_deep: z.string().length(6),
    rule: z.string().length(6),
  }),
  fonts: z.object({
    heading: textSchema,
    body: textSchema,
  }),
  page_margin: z.object({
    top: z.number().int().positive(),
    right: z.number().int().positive(),
    bottom: z.number().int().positive(),
    left: z.number().int().positive(),
    header: z.number().int().nonnegative(),
    footer: z.number().int().nonnegative(),
    gutter: z.number().int().nonnegative(),
  }),
  table_widths: z.object({
    cover_terms: z.array(z.number().int().positive()).length(2),
    signature_two_party: z.array(z.number().int().positive()).length(4),
    signature_one_party: z.array(z.number().int().positive()).length(2),
    section_header: z.array(z.number().int().positive()).length(2),
    checklist_section_header: z.array(z.number().int().positive()).length(2).optional(),
    checklist_working_group: z.array(z.number().int().positive()).length(4).optional(),
    checklist_documents: z.array(z.number().int().positive()).length(5).optional(),
    checklist_action_items: z.array(z.number().int().positive()).length(5).optional(),
    checklist_open_issues: z.array(z.number().int().positive()).length(5).optional(),
  }),
  spacing: z.object({
    line: z.number().int().positive(),
    body_after: z.number().int().nonnegative(),
    title_before: z.number().int().nonnegative(),
    title_after: z.number().int().nonnegative(),
    section_title_after: z.number().int().nonnegative(),
    clause_heading_before: z.number().int().nonnegative(),
    clause_heading_after: z.number().int().nonnegative(),
    note_after: z.number().int().nonnegative(),
  }),
  sizes: z.object({
    header_accent_rule: z.number().int().positive(),
    table_rule: z.number().int().positive(),
    cover_row_height: z.number().int().positive(),
    signature_row_height: z.number().int().positive(),
    checklist_row_height: z.number().int().positive().optional(),
  }),
});

export function validateContractSpec(value, filePath = 'contract spec') {
  const parsed = contractSpecSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const details = parsed.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
      return `${path}: ${issue.message}`;
    })
    .join('; ');

  throw new Error(`Invalid contract spec (${filePath}): ${details}`);
}

export function validateStyleProfile(value, filePath = 'style profile') {
  const parsed = styleProfileSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const details = parsed.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
      return `${path}: ${issue.message}`;
    })
    .join('; ');

  throw new Error(`Invalid style profile (${filePath}): ${details}`);
}
