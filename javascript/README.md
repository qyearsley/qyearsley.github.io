# JavaScript Experiments

Interactive tools and visualizations built with vanilla JavaScript.

## Available Tools

- **[Truth Table Generator](truthtable.html)** - Generate truth tables for boolean expressions
- **[Password Generator](passgen.html)** - Generate secure random passwords
- **[Coin Flip Simulator](coinflip.html)** - Visualize probability with coin flips
- **[Date Calculator](date.html)** - Date and time calculations
- **[Series Test](seriestest.html)** - Test convergence of mathematical series
- **[Markov Chain](markov/)** - Text generation using Markov chains
- **[Logic Engine](logic-engine/)** - Logical inference engine

## Architecture Patterns

**Self-contained pages**: Each tool is a self-contained HTML file with inline CSS and JavaScript, or references to separate JS files in the same directory. Pages follow a consistent visual style defined in `/style.css`.

**JavaScript modules**: Some pages like `truthtable.html` load separate JS files (`truthtable.js`) with core logic. These JS files have corresponding test files (`truthtable.test.js`).

## Testing

Tests are configured with Jest. Test files follow the `*.test.js` pattern (e.g., `truthtable.test.js`).

Run tests: `npm test`
