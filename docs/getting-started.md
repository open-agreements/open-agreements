---
title: Getting Started
description: Install open-agreements and fill your first agreement template.
order: 1
section: Start Here
---

# Getting Started

## Installation

```bash
npm install -g open-agreements
```

Or clone and build from source:

```bash
git clone https://github.com/open-agreements/open-agreements.git
cd open-agreements
npm install
npm run build
```

## Your First Agreement

### 1. List available templates

```bash
open-agreements list
```

### 2. Check what fields are needed

Look at the template's metadata:

```bash
cat content/templates/common-paper-mutual-nda/metadata.yaml
```

### 3. Create a data file

```json
{
  "party_1_name": "Your Company",
  "party_1_email": "legal@yourcompany.com",
  "party_2_name": "Other Party",
  "party_2_email": "legal@otherparty.com",
  "effective_date": "January 1, 2026",
  "purpose": "Evaluating a potential business relationship",
  "mnda_term": "1 year",
  "confidentiality_term": "1 year",
  "governing_law": "Delaware",
  "jurisdiction": "courts located in New Castle County, Delaware"
}
```

### 4. Fill the template

```bash
open-agreements fill common-paper-mutual-nda -d data.json -o my-nda.docx
```

### 5. Review the output

Open `my-nda.docx` in Word or any DOCX viewer. All fields will be filled in.

## Using with Claude Code

If you have Claude Code installed, use the slash command:

```
/open-agreements
```

Claude will ask you which template to use and interview you for field values interactively.

## Employment Templates

OpenAgreements includes employment templates with jurisdiction-aware memo generation:

```bash
open-agreements fill openagreements-employment-offer-letter -d employee.json -o offer.docx --memo memo.json
```

Available employment templates:
- `openagreements-employment-offer-letter`
- `openagreements-employee-ip-inventions-assignment`
- `openagreements-employment-confidentiality-acknowledgement`

## Recipe-Driven Templates

Some templates (like NVCA Series A documents) are downloaded from official sources at runtime:

```bash
open-agreements fill --recipe nvca-stock-purchase-agreement -d deal.json -o spa.docx
```

Recipes can include computed profiles that derive fill values automatically. Use `--computed-out computed.json` to capture the computed audit artifact.

## Validation

Run the validation pipeline to check all templates:

```bash
open-agreements validate
```

This checks:
- Metadata schema compliance (all required fields, valid license enum)
- Template-metadata alignment (DOCX placeholders match metadata field list)
- License compliance (no CC BY-ND derivatives)
