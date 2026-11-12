# CLAUDE.md

Context for AI assistants working on this codebase.

For detailed documentation, see:

- `docs/development.md` -- build system, commands, adding pages
- `docs/translations.md` -- i18n system and translation workflow
- `docs/zh-translation.md` -- Chinese conventions, settled terms, and review findings

## Quick Reference

Run `npm test` and `npm run lint` before you commit. The other commands are in
`docs/development.md`.

## Preferences

- Keep documentation brief and useful.
- Write clear tests with good coverage for non-trivial code.
- Follow best practices, use linters, keep things simple.
- Prefer self-contained HTML files over complex build abstractions.
  (`docs/build-system-options.md` records why, and what would reopen it.)
- Use American spelling in visible text: math, color, practice, neighbor, gray.
  Code comments and internal identifiers do not need changing. If the text is a
  translation key, rename the key in the `*.zh.json` files too.
- Keep mostly AI-generated pages as small as possible, so that Quinten can read
  the code. When you brief a subagent, ask for the smallest version that shows
  the idea: no URL sync, no extra presets, short comments. Compare with
  `javascript/truth-tables.html` (about 190 lines).
