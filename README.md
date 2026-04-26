# qyearsley.github.io

Personal website with educational games, JavaScript experiments, and Chinese language tools.

## Site Structure

- [`/games/`](games/) -- Educational games (Number Garden, Life Garden, Turing Tape)
- [`/javascript/`](javascript/) -- Interactive tools exploring CS concepts (automata, hashing, logic, etc.)
- [`/chinese/`](chinese/) -- Chinese language reference tools (pinyin, tone tables, character encoding)
- [`/resume/`](resume/) -- Resume (rendered from markdown at build time)

The build generates Chinese translations at `/zh/` from source files in `i18n/zh/`.
This is unrelated to the `/chinese/` directory, which contains English-language tools about Chinese.

## Development

```bash
npm install     # Install dependencies
npm start       # Build + serve locally (http://localhost:8000)
npm run dev     # Serve source directly (no build step)
npm test        # Run tests
npm run lint    # Lint JS, HTML, CSS
npm run format  # Format with Prettier
```

See [docs/development.md](docs/development.md) for the build pipeline, how to add pages, and how translations work.
