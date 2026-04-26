# CLAUDE.md

Context for AI assistants working on this codebase.

For detailed documentation, see:

- `docs/development.md` -- build system, commands, adding pages
- `docs/translations.md` -- i18n system and translation workflow

## Quick Reference

```bash
npm run build   # Build site to dist/
npm start       # Build + serve locally
npm run dev     # Serve source directly (no build)
npm test        # Run all tests
npm run lint    # Run all linters
```

## Preferences

- Keep documentation brief and useful.
- Write clear tests with good coverage for non-trivial code.
- Follow best practices, use linters, keep things simple.
- Prefer self-contained HTML files over complex build abstractions.
