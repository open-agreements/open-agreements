## 1. Path resolution

- [x] 1.1 Add optional `OPEN_AGREEMENTS_CONTENT_ROOTS` parsing in path utilities
- [x] 1.2 Add merged directory discovery for templates/external/recipes with precedence and dedupe
- [x] 1.3 Keep bundled package paths as default fallback

## 2. Command integration

- [x] 2.1 Update `fill` command to resolve agreements across merged content roots
- [x] 2.2 Update `list` command to enumerate merged content roots with first-match precedence
- [x] 2.3 Update `validate` command to enumerate merged content roots and support single-ID lookup across all tiers

## 3. Tests and docs

- [x] 3.1 Add tests for content-root discovery and precedence
- [x] 3.2 Document `OPEN_AGREEMENTS_CONTENT_ROOTS` in README

## 4. Validation

- [x] 4.1 Run `npm run build`
- [x] 4.2 Run `npm run test:run`
- [x] 4.3 Run `openspec validate add-content-root-overrides --strict`
