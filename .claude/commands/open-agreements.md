# OpenAgreements: Fill a Legal Template

Help the user fill a standard legal agreement template and produce a DOCX file.

## Available Templates

Run `open-agreements list` to see available templates. Current templates include:
- `common-paper-mutual-nda` — Mutual NDA (Common Paper, CC BY 4.0)
- `bonterms-mutual-nda` — Mutual NDA (Bonterms, CC BY 4.0)
- `common-paper-cloud-service-agreement` — Cloud Service Agreement (Common Paper, CC BY 4.0)

## Instructions

1. If the user specified a template in `$ARGUMENTS`, use it. Otherwise, ask which template they want using AskUserQuestion.

2. Run `open-agreements validate <template>` to confirm the template is valid.

3. Read the template metadata to discover required fields:
   ```bash
   cat templates/<template-name>/metadata.yaml
   ```

4. Interview the user for field values using AskUserQuestion. Group questions by section (from the metadata). Ask up to 4 questions per round. For fields with defaults, show the default and let the user accept or override.

5. After collecting all values, write them to a temporary JSON file and run:
   ```bash
   open-agreements fill <template> -d /path/to/values.json -o <template>-filled.docx
   ```

6. Confirm the output file was created and tell the user where to find it.

## Important Notes

- All templates are CC BY 4.0 licensed. Attribution is included in the output document.
- This tool generates documents from standard templates — it does not provide legal advice.
- If the user is unsure about a field value (e.g., governing law), suggest common defaults but note they should consult their attorney.
