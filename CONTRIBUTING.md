# Contributing to OpenAgreements

Thanks for your interest in contributing! OpenAgreements is an open-source tool for filling standard legal agreement templates. Contributions of new templates, recipe improvements, bug fixes, and documentation are welcome.

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md) in all project spaces.

## Ways to Contribute

### Add a Template

The most impactful contribution is adding a new template. Requirements:

- Source document must be **CC BY 4.0** or **CC0** licensed
- Available as DOCX with fillable fields

See [docs/adding-templates.md](docs/adding-templates.md) for the full guide.

### Add a Recipe

Recipes handle documents that aren't redistributable (e.g., NVCA model documents). You author transformation instructions — never commit the source DOCX.

See [docs/adding-recipes.md](docs/adding-recipes.md) for the full guide.

### Report a Bug

Open an issue with:
- What you expected to happen
- What actually happened
- The command you ran
- Your Node.js version (`node -v`)

### Improve Documentation

Docs live in `docs/`. Fix typos, clarify instructions, or add examples.

### Add Your Project to "Built With OpenAgreements"

If you've built something on OpenAgreements, we'd love to feature it. Open a PR adding a one-liner here:

*No projects listed yet — be the first!*

## Development Setup

```bash
git clone https://github.com/open-agreements/open-agreements.git
cd open-agreements
npm install
npm run build
npm run test:run
```

## Before Submitting a PR

1. **Build**: `npm run build` passes
2. **Lint**: `npm run lint` passes
3. **Test**: `npm run test:run` passes (all 81+ tests)
4. **Validate**: `node bin/open-agreements.js validate` passes for all templates and recipes

## Project Structure

```
content/
  templates/        # Internal templates (CC BY 4.0) — we ship the DOCX
  external/         # External templates (CC BY-ND 4.0) — vendored unchanged
  recipes/          # Recipes (not redistributable) — instructions only, DOCX downloaded at runtime
src/                # TypeScript source + collocated unit tests
integration-tests/  # Integration and end-to-end tests
skills/             # Agent Skills (Claude Code, Cursor, etc.)
docs/               # Documentation
```

## Releasing

Releases are automated through GitHub Actions using npm trusted publishing (OIDC) with provenance enabled.

1. Update versions in root package + publishable MCP packages.
2. Push commit + tag with `git push origin main --tags`
3. Run the local Gemini extension gate (copy/symlink into `~/.gemini/extensions/open-agreements` and verify both local MCP servers start/respond).
4. The `Release` workflow publishes from the tag after running build, validation, tests, isolated runtime smoke, and package checks.

Workflow guardrails:

- Tag must match root + publishable package versions
- Release commit must be contained in `origin/main`
- Publish fails if any target npm version already exists

## Architecture

- **Language**: TypeScript
- **DOCX Engine**: [docx-templates](https://www.npmjs.com/package/docx-templates) (MIT)
- **CLI**: [Commander.js](https://www.npmjs.com/package/commander)
- **Validation**: [Zod](https://www.npmjs.com/package/zod) schemas
- **Skill Pattern**: Agent-agnostic `ToolCommandAdapter` interface

```
content/                    # All content directories
├── templates/              # Internal templates (CC BY 4.0)
├── external/               # External templates (CC BY-ND 4.0)
└── recipes/                # Recipes (downloaded at runtime)

src/                        # TypeScript source + collocated unit tests
├── cli/                    # Commander.js CLI
├── commands/               # fill, validate, list, recipe, scan
├── core/
│   ├── engine.ts           # docx-templates wrapper
│   ├── metadata.ts         # Zod schemas + loader
│   ├── recipe/             # Recipe pipeline (clean → patch → fill → verify)
│   ├── external/           # External template support
│   ├── validation/         # template, license, output, recipe
│   └── command-generation/
│       ├── types.ts        # ToolCommandAdapter interface
│       └── adapters/       # Claude Code adapter
└── index.ts                # Public API

integration-tests/          # Integration and end-to-end tests
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License. Template content retains the license of its source (CC BY 4.0, CC0, or CC BY-ND 4.0).
