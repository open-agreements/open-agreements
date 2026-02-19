import { z } from 'zod';

const idPattern = /^[a-z0-9][a-z0-9-]*$/;
const fieldNamePattern = /^[a-z_][a-z0-9_]*$/;

const textSchema = z.string().min(1);

const coverRowSchema = z.object({
  label: textSchema,
  value: z.string(),
  hint: z.string().optional(),
  note: z.string().optional(),
  condition: z.string().regex(fieldNamePattern).optional(),
});

const clauseSchema = z.object({
  heading: textSchema,
  body: textSchema,
});

const twoPartySignatureRowSchema = z.object({
  label: textSchema,
  hint: z.string().optional(),
  left: z.string().optional(),
  right: z.string().optional(),
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

export const contractSpecSchema = z.object({
  template_id: z.string().regex(idPattern),
  layout_id: z.string().regex(idPattern),
  style_id: z.string().regex(idPattern),
  output_docx_path: textSchema,
  output_markdown_path: textSchema,
  document: z.object({
    title: textSchema,
    label: textSchema,
    version: textSchema,
    license: textSchema,
    include_cloud_doc_line: z.boolean().optional().default(false),
  }),
  sections: z.object({
    cover_terms: z.object({
      section_label: textSchema,
      heading_title: textSchema,
      subtitle: textSchema,
      rows: z.array(coverRowSchema).min(1),
    }),
    standard_terms: z.object({
      section_label: textSchema,
      heading_title: textSchema,
      clauses: z.array(clauseSchema).min(1),
    }),
    signature: z.union([twoPartySignatureSchema, onePartySignatureSchema]),
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
    checklist_working_group: z.array(z.number().int().positive()).length(4).optional(),
    checklist_documents: z.array(z.number().int().positive()).length(2).optional(),
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
