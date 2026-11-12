# qyearsley.github.io

Personal website with educational games, JavaScript experiments, and Chinese language tools.

## Site Structure

- [`/games/`](games/) -- Educational games (Number Garden, Life Garden, Turing Tape, Times Trail, Seasons)
- [`/javascript/`](javascript/) -- Interactive tools exploring CS concepts (automata, hashing, logic, etc.)
- [`/chinese/`](chinese/) -- Chinese language reference tools (pinyin, tone tables, character encoding)
- [`/resume/`](resume/) -- Resume (rendered from markdown at build time)
- [`/contact/`](contact/) -- Contact form (see [docs/development.md](docs/development.md))

The build generates Chinese translations at `/zh/` from co-located `*.zh.json` files.
This is unrelated to the `/chinese/` directory, which contains English-language tools about Chinese.
Most pages carry an EN/中文 switcher; three games (Number Garden, Seasons, and
Times Trail) have none, because their gameplay text is written at runtime and
the build only translates static HTML. See
[docs/translations.md](docs/translations.md#which-pages-have-a-chinese-version-and-why)
for why, and [docs/improvements.md](docs/improvements.md) for what is left.

## Development

Commands and git hooks are in [docs/development.md](docs/development.md#commands).

See [docs/development.md](docs/development.md) for the build pipeline, how to add pages, and how translations work.
[docs/improvements.md](docs/improvements.md) is the maintenance backlog; the `*-plan.md` files beside it are per-feature design notes.
