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

**Shareable URL state**: A few pages read their main input from the query
string on load and keep it in sync via `history.replaceState` as it changes,
so the address bar is always a link to what's on screen. An invalid or
missing value falls back to the page's own default, silently.

- `truth-tables.html?expr=<expression>` — the boolean expression (URL-encoded).
- `cellular-automata.html?rule=<0-255>` — the rule number.
- `floating-point.html?n=<number or expression>` — the input value.
- `logic-engine/?example=<name>` — a predefined example, by its exact name
  (e.g. `?example=Modus%20Ponens`). Only set when a predefined example was
  clicked; manually adding or clearing premises drops the param, since the
  page can't represent an arbitrary proof in one query param.

Other tools (Hash Collision Lab, Series Tester, Coin Flipper) take more than
one input to describe their state, so they don't have this. Password
Generator and Life Calculator are deliberately excluded: a password or a
birthdate isn't something to put in a shareable link.

## Testing

Tests use Jest and follow the `*.test.js` pattern, sitting next to the code they
cover (e.g. `truthtable.js` / `truthtable.test.js`). Run them from the
repository root:

```bash
npm test                                   # all tests
npm test -- --testPathPatterns truthtable  # one file
```
