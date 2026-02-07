# Licensing

## Tool License

OpenAgreements itself is licensed under the **MIT License**. You can use, modify, and distribute the tool freely.

## Template Licenses

Each template has its own license, specified in its `metadata.yaml`. Currently supported licenses:

| License | Can Modify? | Must Attribute? | Templates Using |
|---------|------------|-----------------|-----------------|
| CC BY 4.0 | Yes | Yes | Common Paper, Bonterms |
| CC0 1.0 | Yes | No | (public domain) |
| CC BY-ND | No | Yes | **Excluded** — cannot create derivatives |

## How Attribution Works

Templates licensed under CC BY 4.0 require attribution. OpenAgreements handles this by:

1. Including the `attribution_text` from `metadata.yaml` in the generated DOCX
2. Displaying source URL and license info in the `list` command
3. Including attribution in each template's README

## What's Excluded

The following template sources are **not included** because they use CC BY-ND (No Derivatives):

- **oneNDA** — CC BY-ND 4.0
- **oneDPA** — CC BY-ND 4.0
- **oneSaaS** — CC BY-ND 4.0
- **Bonterms Standard End User Agreement** — CC BY-ND
- **Bonterms Standard Online Cloud Terms** — CC BY-ND

## CI Enforcement

The GitHub Actions workflow enforces license compliance:

- Templates with `allow_derivatives: false` cannot be modified in PRs
- All templates must have valid license metadata
- The `validate` command checks license compliance at runtime
