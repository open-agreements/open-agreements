import { z } from 'zod';

const JSON_PATCH_OPS = ['add', 'replace', 'remove'] as const;

function isValidJsonPointer(pointer: string): boolean {
  if (!pointer.startsWith('/')) return false;

  for (let index = 0; index < pointer.length; index += 1) {
    const char = pointer[index];
    if (char !== '~') continue;
    const next = pointer[index + 1];
    if (next !== '0' && next !== '1') return false;
    index += 1;
  }

  return true;
}

export const ChecklistPatchModeEnum = z.enum(['APPLY', 'PROPOSED']);
export type ChecklistPatchMode = z.infer<typeof ChecklistPatchModeEnum>;

export const JsonPointerSchema = z.string().min(1).superRefine((pointer, ctx) => {
  if (!isValidJsonPointer(pointer)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'path must be a valid JSON Pointer starting with "/" and using "~0"/"~1" escapes',
    });
  }
});
export type JsonPointer = z.infer<typeof JsonPointerSchema>;

export const PatchCitationSchema = z.object({
  text: z.string().min(1),
  link: z.string().min(1).optional(),
  filepath: z.string().min(1).optional(),
});
export type PatchCitation = z.infer<typeof PatchCitationSchema>;

export const ChecklistPatchSourceEventSchema = z.object({
  provider: z.string().min(1).optional(),
  message_id: z.string().min(1).optional(),
  conversation_id: z.string().min(1).optional(),
});
export type ChecklistPatchSourceEvent = z.infer<typeof ChecklistPatchSourceEventSchema>;

export const ChecklistPatchOperationSchema = z.object({
  op: z.enum(JSON_PATCH_OPS),
  path: JsonPointerSchema,
  value: z.unknown().optional(),
}).superRefine((operation, ctx) => {
  const expectsValue = operation.op === 'add' || operation.op === 'replace';
  const hasValue = operation.value !== undefined;

  if (expectsValue && !hasValue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: `"${operation.op}" operations require a value`,
    });
  }

  if (!expectsValue && hasValue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: `"${operation.op}" operations must not include value`,
    });
  }

  if ((operation.op === 'remove' || operation.op === 'replace') && operation.path.endsWith('/-')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['path'],
      message: `"${operation.op}" cannot target the append index "-"`,
    });
  }

  const isCitationPath = /\/citations\/(?:-|[0-9]+)$/.test(operation.path);
  if (expectsValue && isCitationPath) {
    const citation = PatchCitationSchema.safeParse(operation.value);
    if (!citation.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'citation writes require value to match PatchCitationSchema',
      });
    }
  }
});
export type ChecklistPatchOperation = z.infer<typeof ChecklistPatchOperationSchema>;

export const ChecklistPatchEnvelopeSchema = z.object({
  patch_id: z.string().min(1),
  expected_revision: z.number().int().nonnegative(),
  mode: ChecklistPatchModeEnum.default('APPLY'),
  source_event: ChecklistPatchSourceEventSchema.optional(),
  operations: z.array(ChecklistPatchOperationSchema).min(1),
});
export type ChecklistPatchEnvelope = z.infer<typeof ChecklistPatchEnvelopeSchema>;

export const ChecklistPatchApplyRequestSchema = z.object({
  validation_id: z.string().min(1),
  patch: ChecklistPatchEnvelopeSchema,
});
export type ChecklistPatchApplyRequest = z.infer<typeof ChecklistPatchApplyRequestSchema>;
