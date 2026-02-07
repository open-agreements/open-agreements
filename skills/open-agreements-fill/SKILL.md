# Skill: open-agreements-fill

Fill a standard legal agreement template with user-provided values and produce a DOCX file.

## Description

This skill guides a user through filling out a legal agreement template. It discovers required fields from template metadata, interviews the user for values, and renders a filled DOCX.

## Prerequisites

- `open-agreements` CLI installed and on PATH
- Templates available in the `templates/` directory

## Interface

### Input

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `template` | string | yes | Template name (e.g., `common-paper-mutual-nda`) |
| `output` | string | no | Output file path (defaults to `<template>-filled.docx`) |

### Steps

1. **Discover fields**: Read `templates/<template>/metadata.yaml` to get the list of fields, their types, descriptions, defaults, and sections.

2. **Collect values**: Present fields to the user grouped by section. Use the agent's question-asking capability (e.g., `AskUserQuestion` in Claude Code) in rounds of up to 4 questions.

3. **Render**: Write collected values to a JSON file, then invoke:
   ```bash
   open-agreements fill <template> -d values.json -o output.docx
   ```

4. **Confirm**: Report the output path to the user.

### Output

A filled DOCX file at the specified output path.

## Adapter Notes

This skill is agent-agnostic. To implement for a new coding agent:

1. Implement the `ToolCommandAdapter` interface from `src/core/command-generation/types.ts`
2. Map the agent's user-interaction capability to the field collection step
3. Map the agent's shell execution capability to the render step
4. Register the adapter in `src/core/command-generation/adapters/`
