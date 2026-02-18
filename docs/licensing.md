# Licensing

> **Disclaimer**: This documentation describes how OpenAgreements handles template licensing from a technical perspective. It is not legal advice. Consult a qualified attorney for questions about your specific use of these documents.

## Tool License

OpenAgreements itself is licensed under the **MIT License**. You can use, modify, and distribute the tool freely.

## Template Licenses

Each template has its own license, specified in its `metadata.yaml`. Supported licenses:

| License | Can Modify Source? | Can Fill & Use? | Must Attribute? | Directory |
|---------|-------------------|-----------------|-----------------|-----------|
| CC BY 4.0 | Yes | Yes | Yes | `content/templates/` |
| CC0 1.0 | Yes | Yes | No | `content/templates/` |
| CC BY-ND 4.0 | No | Yes (fill in blanks) | Yes | `content/external/` |

### Templates (`content/templates/`)

Templates licensed under CC-BY-4.0 or CC0-1.0 allow derivative works. The DOCX files in `content/templates/` contain pre-baked `{tag}` placeholders and can be modified freely. These are filled directly by the template engine.

### External Templates (`content/external/`)

External templates are third-party standard-form documents (e.g., Y Combinator SAFEs) that are redistributable under CC-BY-ND 4.0 but must not be modified. The original DOCX files are committed to the repo **unmodified**. At fill time, the tool applies bracket-to-tag replacement in a temporary directory, fills the values, and produces an output file — the committed source is never altered.

**What CC-BY-ND means for you:**
- You **may** fill in the blanks and bracketed terms for your own deals (this is the intended use)
- You **may not** redistribute modified versions of the template text
- You **must** provide attribution to the original author
- The filled output document may constitute an "adapted work" under CC-BY-ND — do not redistribute your filled output publicly without reviewing the license terms

The CLI prints a redistribution notice each time you fill an external template.

## How Attribution Works

Templates licensed under CC BY 4.0 and CC BY-ND 4.0 require attribution. OpenAgreements handles this by:

1. Including the `attribution_text` from `metadata.yaml` in the generated DOCX
2. Displaying source URL and license info in the `list` command
3. Including attribution in each template's README
4. Maintaining a `LICENSE` file in the `content/external/` directory with full copyright notices

## What's Still Excluded

The following template sources are **not included** because they use CC BY-ND and their source organizations have not released them with clear guidance supporting programmatic fill-in-the-blank use:

- **oneNDA** — CC BY-ND 4.0
- **oneDPA** — CC BY-ND 4.0
- **oneSaaS** — CC BY-ND 4.0
- **Bonterms Standard End User Agreement** — CC BY-ND
- **Bonterms Standard Online Cloud Terms** — CC BY-ND

These may be added in the future if their publishers provide clear guidance on programmatic use, or via the recipe tier (download at runtime).

### Employment Source Classifications

Employment workflow sources are additionally tracked by terms compatibility:

- `permissive` (compatible with in-repo or derivative workflows)
- `pointer-only` (reference but no vendoring by default)
- `restricted-no-automation` (excluded from automated onboarding)

Current v1 employment policy and source registry:

- `docs/employment-source-policy.md`

## Integrity Enforcement

External templates include a SHA-256 hash (`source_sha256` in `metadata.yaml`) of the original DOCX file. Both the `validate` command and the `fill` command verify this hash before processing, ensuring the committed file has not been accidentally modified.

**Update workflow**: When a new version of an external template is released, re-download the DOCX from the official `source_url` (never re-save through Microsoft Word), update both `source_sha256` and `version` in `metadata.yaml`, and re-test the replacement mappings.

## CI Enforcement

The GitHub Actions workflow enforces license compliance:

- All templates and external templates must have valid license metadata
- External template DOCX files must match their `source_sha256` hash
- The `validate` command checks license compliance at runtime
