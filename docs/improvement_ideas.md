# Future Improvements

Potential improvements, deferred until actually needed.

## Done

- Chinese translation build system (text-matching, hreflang, language switcher)
- GitHub Actions CI (build, test, lint on push)
- Sitemap generation
- Internal link validation
- Resume rendered from markdown
- Keyboard shortcuts and theme system

## Build System & TypeScript

Add TypeScript if:

- building a complex multi-file JS project (>500 lines, multiple modules)
- type-related bugs become frequent

## Template System

See `docs/build-system-options.md` for options and tradeoffs.

Consider if:

- updating shared elements (header/footer) becomes tedious across many files
- boilerplate maintenance becomes a real pain point

## Dependency Management

Current state: Chart.js loaded from CDN, no version pinning.

Options: npm + bundler, self-host, or version-pinned CDN with SRI.

Revisit when adding more external dependencies.

## Project Structure

Complex experiments (logic-engine, markov) already have their own directories.
Simple experiments stay flat. This works well.
