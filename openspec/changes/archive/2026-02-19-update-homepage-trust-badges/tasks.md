## 1. Implementation
- [x] 1.1 Add trust badge row with shield images in `site/index.njk` (diverged from spec: replaced pill row entirely with image-based badges instead of renaming status pill)
- [x] 1.2 Add `.badge-row` flex layout in `site/src/input.css`
- [x] 1.3 Add live MCP status indicator (diverged from spec: uses OpenStatus hosted badge image instead of custom `.status-dot` pulse animation)
- [x] 1.4 Add `checkMcpStatus()` function in `site/main.js`

## 2. Verification
- [x] 2.1 `npm run build:site` succeeds
- [x] 2.2 `npm run build:css` succeeds
- [x] 2.3 Badge row visible in built site with trust shields and live status badge
