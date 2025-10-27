# Future Improvements

This document tracks potential improvements for the site that have been
considered but deferred.

## Build System & TypeScript

Should we add TypeScript with a build process?
Consider doing this if:

- building a complex multi-file JS project (>500 lines, multiple modules)
- type-related bugs become frequent
- IDE support becomes important for development

## Template System / Static Site Generator

Options Considered include:

- **Jekyll**: Ruby-based, GitHub Pages native support, automatic building
- **11ty (Eleventy)**: JavaScript-based, modern, flexible templating

Consider doing this if:

- adding Chinese language versions of all pages (would double page count)
- navigation structure becomes more complex
- updating shared elements (header/footer) becomes tedious across many files

## Project Structure for Complex Experiments

Current state is a flat structure in `/javascript/` directory, works for simple
experiments.

### Proposed Structure for Complex Projects

```
/javascript/
  index.html              (directory listing - keep as is)

  # Simple experiments stay flat
  passgen.html
  coinflip.html
  date.html

  # Complex experiments get their own directories
  truthtable/
    index.html
    truthtable.js
    truthtable.test.js

  # Future complex projects
  my-complex-app/
    index.html
    main.js
    components/
      graph.js
      controls.js
    utils/
      helpers.js
    README.md
```

## Dependency Management

Current State:

- Chart.js loaded from CDN (coinflip.html)
- No version pinning or local copies
- Vulnerable to CDN downtime or breaking changes

Options:

1. **Use npm packages + bundler**: Most robust but adds complexity
2. **Download and self-host**: Simple but requires manual updates
3. **Version-pinned CDN URLs with SRI**: Good middle ground

When to Revisit:

- When adding more external dependencies
- If CDN reliability becomes an issue
- When building complex projects that need bundling anyway

## GitHub Actions / CI

Add automated testing and linting on push/PR?

Decision: Tests run locally; not collaborating with others currently.

When to Revisit:

- If collaborating with others
- To ensure GitHub Pages builds successfully
- When build process becomes complex enough to benefit from automation

## Summary

The site intentionally maintains simplicity. Add complexity only when:

1. Current approach becomes painful (frequent bugs, tedious updates)
2. Planning a specific complex project that would benefit
3. Adding major features (like full i18n support)

The improvements above are documented so they can be implemented when actually
needed, not prematurely.
