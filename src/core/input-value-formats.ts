/** Explicit opt-in formats; do not infer these from legal field names. */
export const INPUT_VALUE_FORMAT_IDS = ['nonnegative_integer'] as const;
export type InputValueFormat = typeof INPUT_VALUE_FORMAT_IDS[number];

export const INPUT_VALUE_FORMATS: Record<InputValueFormat, { pattern: string; expectation: string }> = {
  nonnegative_integer: {
    // Unlike `$`, the final negative lookahead cannot match before a trailing
    // newline. The format permits empty; required_when independently rejects
    // missing or blank values for active conditions. Generic presence rules
    // (including priority-field blank handling) are not changed here.
    pattern: '^(?:|0|[1-9][0-9]*)(?![\\s\\S])',
    expectation: 'a bare nonnegative integer string without signs, separators, whitespace, or units',
  },
};
