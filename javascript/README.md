# Experiments

Interactive tools and visualizations built with vanilla JavaScript.

## Available Tools

- **[Truth Tables](truth-tables.html)** - Generate truth tables for boolean expressions
- **[Password Generator](password-generator.html)** - Generate secure random passwords
- **[Coin Flipper](coin-flipper.html)** - Visualize probability with coin flips
- **[Life Calculator](life-calculator.html)** - Calculate how long you've lived
- **[Series Tester](series-tester.html)** - Test convergence of mathematical series
- **[Floating Point Exposed](floating-point.html)** - See the IEEE 754 bit layout of any number
- **[Hash Collision Lab](hash-collision-lab.html)** - Watch strings hash into buckets
- **[Cellular Automata](cellular-automata.html)** - Visualize elementary 1D cellular automata
- **[Markov Generator](markov/)** - Text generation using Markov chains
- **[Logic Engine](logic-engine/)** - Logical inference engine

## Architecture Patterns

**Self-contained pages**: Each tool is a self-contained HTML file with inline CSS and JavaScript, or references to separate JS files in the same directory. Pages follow a consistent visual style defined in `/css/style.css`.

**JavaScript modules**: Some pages like `truth-tables.html` load separate JS files (`truthtable.js`) with core logic. These JS files have corresponding test files (`truthtable.test.js`).

## Testing

Tests are configured with Jest. Test files follow the `*.test.js` pattern (e.g., `truthtable.test.js`).

Run tests: `npm test`
