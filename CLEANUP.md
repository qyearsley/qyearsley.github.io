# Cleanup Ideas

Quick reference for maintenance and refactoring tasks.

## Summary

**Completed (2025-02-02):**
- ✅ All "Immediate Fixes" (5/5)
- ✅ All "Code Cleanup" tasks (6/6)
- ✅ Added 207 new tests (253 → 460 tests, all passing)
- ✅ Enhanced architecture documentation with diagrams
- ✅ Improved accessibility with aria-labels
- ✅ Complete test coverage for UI components

**Remaining:** Architecture refactoring, security audits

---

## Immediate Fixes (< 30 min total)

- [x] Remove "Word Quest" reference from `index.html:39`
- [x] Add `@jest/globals` to root `package.json` devDependencies
- [x] Stage deleted `games/common/*` files in git (already handled)
- [x] Remove unused dependencies: `stylelint-config-standard` (in use), review `jest-environment-jsdom` (in use)
- [x] Add `.prettierignore` and migrate ESLint ignores to `eslint.config.js`

## Code Cleanup (1-2 hours)

- [x] Remove/conditionalize 15+ `console.log` statements in production code (removed 4 non-essential logs)
- [x] Remove unused `questionsPerLevelSelect` code in `EventManager.js:236-240`
- [x] Clarify `questionsPerLevel` property - now uses `DEFAULTS.QUESTIONS_PER_LEVEL` constant
- [x] Extract magic number `100` to `VISUAL_ITEM_ANIMATION_DELAY_MS` constant (`GameUI.js:4`)
- [x] Move inline error styles to CSS file (`.error-container` class in `common.css:200-223`)
- [x] Add JSDoc to exported functions in `utils.js` and `constants.js` (already present)

## Architecture Improvements

- [ ] Consolidate or document distinction between `storage.js` and `StorageManager.js`
- [ ] Consider splitting `GameUI.js` (660 lines) into focused files: ActivityUI, CastleUI, SettingsUI
- [ ] Consider splitting `constants.js` by concern: timing, progression, math, display

## Testing Gaps

Missing test coverage for:
- [x] `EventManager.js`
- [x] `ProjectVisuals.js`
- [x] `BaseGameUI.js`
- [x] `GameUI.js`
- [x] `generators/*` (TimeGenerator, BasicMathGenerator, MeasurementAndPatternGenerator)

## Security & Accessibility

- [ ] Add Subresource Integrity hashes to external resources (Google Fonts)
- [ ] Document security rationale for `innerHTML` usage (30+ instances)
- [ ] Audit color contrast ratios (WCAG AA compliance)
- [ ] Add focus trap to settings modal for keyboard accessibility
- [ ] Consider Content Security Policy if accepting user content

## Nice to Have

- [x] Add architecture diagram to `games/number-garden/js/README.md`
- [x] Systematic alt text audit across all HTML files (added aria-labels to all buttons)
- [ ] Standardize error handling patterns across storage implementations
