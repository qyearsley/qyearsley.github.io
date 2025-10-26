# javascript

## Key Architecture Patterns

**Self-contained HTML pages**: Each tool/page is a self-contained HTML file with inline CSS and JavaScript, or references to separate JS files in the same directory. The pages follow a consistent visual style defined in `/style.css`.

**JavaScript modules**: Some pages like `truthtable.html` load separate JS
files (`truthtable.js`) with core logic. These JS files may have corresponding
test files (`truthtable.test.js`).

## Testing

Tests are configured with Jest and ts-jest preset. Test files follow the
`*.test.js` pattern (e.g., `truthtable.test.js`). The test environment is
Node.js.
