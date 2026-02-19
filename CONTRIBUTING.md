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

## License

By contributing, you agree that your contributions will be licensed under the MIT License. Template content retains the license of its source (CC BY 4.0, CC0, or CC BY-ND 4.0).
