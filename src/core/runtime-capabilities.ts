/**
 * Distribution contract for recipe operations supported by this runtime.
 * Consumers must inspect actual operations as well as explicit requirements.
 * A manifest cannot retrofit protection into an old loader that ignores it.
 */
export const RUNTIME_CAPABILITIES = Object.freeze({
  schema_version: 1,
  capabilities: Object.freeze([
    'legacy-replacements.v1',
    'clean.v1',
    'clean.story-paragraphs.v1',
    'selectors.v1',
    'selections.v1',
    'selections.bounded-removal.v1',
    'selections.applies-when.v1',
    'selections.unwrap-brackets.v1',
    'computed.v1',
    'normalize.v1',
    'normalize.numbering-continuations.v1',
    'repeatable-tables.v1',
    'anchored-paragraph-bindings.v1',
    'reference-fields.v1',
    'reference-fields.grouped.v1',
    'conditional-input-requirements.v1',
    'conditional-input-requirements.all-of.v1',
    'input-value-format.nonnegative-integer.v1',
    'render.numbering-snapshot.v1',
  ]),
});
