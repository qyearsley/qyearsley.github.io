# Build System Options

Comparison of approaches for reducing HTML boilerplate across pages.

## Current: Self-Contained HTML Files

Each page is a complete HTML file with its own `<head>`, `<header>`, etc.
The build script only handles translation, resume, sitemap, and validation.

**Pros:**

- Each file is readable and editable on its own
- Standard HTML -- all linters, formatters, and editors work
- No template abstraction to learn or maintain
- `npm run dev` serves files directly without building

**Cons:**

- Shared elements (head boilerplate, header, nav script tag) duplicated in every file
- Changing shared structure requires editing every HTML file

**When this breaks down:** If you have 50+ pages with shared headers/footers
that change frequently.

## Custom Templates (.page files)

What was tried and reverted: YAML frontmatter + HTML body in `.page` files,
rendered through a shared template by build.js.

**Pros:**

- Eliminates boilerplate (each page is ~50% shorter)
- Auto-generated breadcrumbs from directory structure
- Single template file for shared layout

**Cons:**

- Custom format -- linters, formatters, editor syntax highlighting don't work
- Pages are unreadable without the build step
- ~200 extra lines in build.js to maintain
- Learning curve for anyone new to the repo

## Static Site Generators (11ty, Hugo, Jekyll)

Mature tools designed for exactly this problem.

**Pros:**

- Large ecosystem, good documentation
- Markdown support, layouts, partials, data files
- Many output formats and features out of the box

**Cons:**

- Heavy dependency for ~25 mostly-static pages
- Learning curve for the tool's conventions
- Build step required for all development
- Jekyll (Ruby) or Hugo (Go) add a non-JS dependency

**Best fit for:** Sites with 50+ content pages, blog posts, or teams
that already use one of these tools.

## Web Components / HTML Includes

Use `<script>` or custom elements to inject shared headers/footers client-side.

**Pros:**

- Standard web technology, no build step
- Progressive enhancement possible

**Cons:**

- Requires JavaScript -- content invisible to noscript users and some crawlers
- Flash of unstyled/empty content before components load
- Not great for SEO-critical elements like `<title>` and meta tags

## Recommendation

Keep self-contained HTML until boilerplate maintenance becomes a real problem.
With ~25 pages that change infrequently, the duplication cost is low. If the
site grows significantly, 11ty is the natural next step -- it's JavaScript-based,
handles i18n well, and has a gentle learning curve.
