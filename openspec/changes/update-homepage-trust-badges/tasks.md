## 1. Implementation
- [x] 1.1 Rename "status" pill to "status page" with status dot span in `site/index.njk`
- [x] 1.2 Add badge row div after pill row in `site/index.njk`
- [x] 1.3 Add `.status-dot` CSS with pulse animation and color classes in `site/src/input.css`
- [x] 1.4 Add `.badge-row` flex layout in `site/src/input.css`
- [x] 1.5 Add `checkMcpStatus()` function with JSON-RPC id and 5s timeout in `site/main.js`

## 2. Verification
- [ ] 2.1 `npm run build:site` succeeds
- [ ] 2.2 `npm run build:css` succeeds
- [ ] 2.3 Local preview shows renamed pill, pulsing dot, badge images
