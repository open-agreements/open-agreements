---
title: Troubleshooting
description: Resolve common installation, discovery, validation, and rendering failures.
order: 3
section: Start Here
---

# Troubleshoot a failed workflow

## The command is not found

Confirm Node.js 20 or newer and the global npm binary directory are on `PATH`:

```bash
node --version
npm prefix --global
npm install -g open-agreements
open-agreements --version
```

## A template is not listed

Run `open-agreements list --json-strict`. A non-zero exit identifies invalid
catalog metadata. Also confirm the installed package version; a template on the
`main` branch may not be in the latest npm release yet.

## Filling reports missing priority fields

The renderer may create a DOCX while warning that important fields are blank.
Inspect the field definitions with `open-agreements list --json`, add the missing
values, and run the fill again. Do not treat a warning-bearing output as complete.

## A field-selector source cannot be downloaded

Field-selectors may retrieve official documents at runtime. Confirm network
access, then inspect the source URL and hash in the field-selector metadata. If
the publisher replaced the source, do not bypass the integrity check; update and
revalidate the field-selector instead.

## Validation fails after a metadata change

Run the narrow command first, then the repository preflight:

```bash
open-agreements validate <template>
npm run preflight:ci
```

Validation errors usually identify a missing required field, an unsupported
license combination, or a mismatch between metadata and the DOCX placeholders.

## The generated DOCX looks wrong

Keep the input values and exact command, note the installed version, and report
which page or field is affected. Do not attach a confidential agreement to a
public issue. Use the [security policy](../SECURITY.md) for sensitive reports.
