# Conditional required inputs

A scalar metadata field can require an explicit caller value only when a
top-level controller has a particular value:

```yaml
- name: include_optional_regime
  type: boolean
  description: Enable the optional regime
  default: false
- name: selected_rate
  type: string
  description: Selected percentage, without a percent sign
  required_when:
    field: include_optional_regime
    equals: true
```

The shared fill preparation and field-selector API reject an active requirement
whose input is absent, null, empty, or only whitespace. A numeric zero, the string
`"0"`, and boolean false are present values. Ordinary field type and enum checks
still apply. Field-selector rejection happens before source download or document
mutation, with error code `INCOMPLETE_CONDITIONAL_INPUT` and a `fields` array.
The CLI exits unsuccessfully and names the missing fields.

The controller must be another declared top-level scalar field. Its `equals`
value must have the controller's type and, for an enum, be one of its options.
Nested conditions, array controllers/targets, computed controllers/targets, and
defaults on conditionally required inputs are rejected. This contract requires
an explicit choice; it never supplies missing economics.

An omitted controller uses its metadata default to decide whether the requirement
applies. An explicitly supplied controller takes precedence and must have the
declared scalar type. An absent controller with no matching default does not
activate the requirement. Exported field-selector JSON Schema uses the same
default-aware `if`/`then` conditions, including `required` on the controller when
omission must not activate it. Active string inputs also require a non-whitespace
character. Unconditional `priority_fields` remain unconditional.

Recipe owners add these declarations to their canonical metadata; consumers
must not invent a legal requirement in a downstream mirror. Runtime support
alone does not activate a requirement on existing recipes.
