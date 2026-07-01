# External Templates

This directory contains third-party standard-form legal documents that are redistributable under **CC BY-ND 4.0** but must not be modified. The `template.docx` files here are unmodified copies of the originals published by their respective authors.

## How It Works

Unlike templates in `templates/` (which contain pre-baked `{tag}` placeholders), external templates store the original document as-is. At fill time, the CLI applies bracket-to-tag replacement in a temporary directory, fills the values, and produces an output file. The committed source is never altered.

## Contents

| Directory | Document | Publisher |
|-----------|----------|-----------|
| `yc-safe-valuation-cap/` | Post-Money SAFE — Valuation Cap | Y Combinator |
| `yc-safe-discount/` | Post-Money SAFE — Discount | Y Combinator |
| `yc-safe-mfn/` | Post-Money SAFE — MFN | Y Combinator |
| `yc-safe-pro-rata-side-letter/` | Pro Rata Side Letter | Y Combinator |

## Each Directory Contains

- `template.docx` — Unmodified original DOCX from the publisher
- `metadata.yaml` — Zod-validated schema with fields, source URL, license info, and `source_sha256` integrity hash
- `replacements.json` — Bracket-to-tag mapping used at fill time
- `clean.json` — Optional cleanup config (footnotes, notes to drafter)
- `README.md` — Attribution, source link, usage notes

## Updating External Templates

When a publisher releases a new version:

1. Re-download the DOCX from the official `source_url` (never re-save through Microsoft Word)
2. Update `source_sha256` in `metadata.yaml` with the new file's SHA-256 hash
3. Update `version` in `metadata.yaml`
4. Re-test the replacement mappings with `open-agreements scan` and a test fill
5. Run `open-agreements validate` to confirm integrity

## License

See [LICENSE](./LICENSE) for full attribution and license details.
