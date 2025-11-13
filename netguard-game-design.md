# NetGuard - Cybersecurity Educational Game

## Game Concept Overview

A web-based roguelike/adventure game focused on teaching cybersecurity concepts to software engineers. Players investigate a compromised network, learn security fundamentals, and uncover who's attacking and why.

## Core Goals

- **Educational for software engineers** - Learn practical cybersecurity concepts
- **Not too complex** - Implement first version relatively quickly
- **Fun and educational** - Balance gameplay with learning

## Target Audience

- Software engineers who want to learn more about cybersecurity
- Adult learners comfortable with technical concepts
- Developers interested in security best practices

## Key Game Elements

### Exploration

- **Grid-based network map** you navigate
- Network topology diagram with different node types (servers, databases, APIs, workstations)
- Visual health indicators: 🟢 healthy, 🟡 suspicious, 🔴 compromised, 🔵 unexamined

### Investigation

- **Terminal commands** to examine systems
- Commands like: `check-logs`, `verify-cert`, `test-auth`, `inspect-token`, `scan-headers`, `trace-request`
- Terminal-style interface with monospace fonts

### Social/Narrative

- **Dialog with NPCs** (sysadmins, users, even the attacker leaving taunts)
- Gather clues through conversations
- **Narrative thread**: Who's attacking and why?

### Learning Focus

- **Real security concepts**: authentication flaws, crypto mistakes
- Specific topics to cover:
  - Authentication and authorization
  - Certificates, tokens (JWTs)
  - TLS, asymmetric cryptography
  - Best practices for web apps and services

## Detailed Game Design

### Premise

You're a junior security engineer at a tech company. Strange things are happening - unauthorized access, data leaks, suspicious traffic. Navigate the company's network, talk to employees, examine systems, and piece together what's happening.

### Game Loop

1. **Exploration Phase**
   - Navigate network diagram between nodes
   - Each node represents: web server, database, auth service, API gateway, employee workstation, etc.
   - Choose which system to investigate

2. **Investigation Phase**
   - Terminal-style command interface
   - Use security tools to examine the selected node
   - Discover vulnerabilities and attack indicators

3. **Dialog/Narrative Phase**
   - Talk to NPCs for clues:
     - DevOps: "We've been having SSL cert warnings..."
     - Developer: "I hard-coded the API key, just temporarily..."
     - User: "I got a weird email asking me to click a link..."
     - Attacker: Anonymous taunts hinting at methods

4. **Remediation Phase**
   - Fix discovered vulnerabilities:
     - Rotate compromised tokens
     - Enable HTTPS/TLS properly
     - Implement proper JWT validation
     - Add authorization checks
     - Configure CORS correctly

### Educational Concepts

#### Authentication & Authorization

- Find systems with broken auth (weak passwords, session hijacking)
- Learn the difference: "who you are" vs "what you can do"
- Implement OAuth2 flows, understand scopes
- Discover privilege escalation vulnerabilities

#### Certificates & Tokens

- Examine certificate chains, understand CA trust
- Decode JWTs, learn about claims, signing, verification
- Find expired/invalid certs causing issues
- Discover stolen tokens being misused

#### TLS & Asymmetric Cryptography

- Identify MITM attacks due to missing TLS
- Understand public/private key pairs
- Learn why self-signed certs are risky
- Understand cipher suites and weak encryption

#### Web Security Best Practices

- OWASP Top 10 as puzzle elements (SQLi, XSS, CSRF, etc.)
- Security headers (CSP, HSTS, X-Frame-Options)
- Input validation failures
- API security (rate limiting, authentication, authorization)

### Progression & Replayability

**Unlocks:**

- New terminal commands as you learn concepts
- Access to deeper network layers
- Better "scanning tools" that reveal more information

**Procedural Elements:**

- Different attack scenarios each playthrough
- Randomized network topology
- Various vulnerability combinations

**Narrative Branches:**

- Multiple attacker types: disgruntled employee, competitor, nation-state, script kiddie
- Multiple endings based on how well you secure systems
- Different difficulty levels

### UI/Aesthetic

**Visual Style:**

- Monospace font throughout
- Terminal green/amber on dark background (or modern VS Code dark theme)
- Network map: ASCII-art style or simple nodes/edges diagram
- Dialogues in terminal-style message boxes
- Grid or terminal aesthetic

**Technical Implementation:**

- Pure HTML/CSS/JavaScript
- No backend needed - runs entirely in browser
- Save progress in localStorage
- Single-page application
- Shareable on personal website
- Possibly shareable seeds for specific scenarios

## Implementation Considerations

### MVP (Minimum Viable Product) Features

- Simple network map with 5-8 nodes
- 3-4 basic terminal commands
- 1-2 NPCs with dialog
- 2-3 vulnerability types to discover
- Basic narrative with one ending

### Future Enhancements

- More complex network topologies
- Additional terminal commands and tools
- More NPCs and dialog branches
- Expanded vulnerability library
- Multiple difficulty levels
- Daily challenge mode
- Achievement system
- Tutorial mode

## Game Aesthetics

- **Terminal/Grid aesthetic** - Clean, simple, retro-technical
- **Monospace fonts** - Courier, Monaco, or similar
- **Color scheme options:**
  - Classic terminal: green on black
  - Amber terminal: orange on dark brown
  - Modern: VS Code dark theme colors
- **Simple icons/emojis** for quick visual feedback
- **ASCII art** for network diagrams and decorative elements

## Open Questions / To Decide

- Exact network topology for level 1
- Specific vulnerability scenario to prototype first
- Which terminal commands to implement in MVP
- Detailed UI mockup
- Win/lose conditions
- How much procedural generation vs. hand-crafted scenarios
- Difficulty progression curve
- Tutorial/onboarding experience

## Next Steps

1. Sketch out network topology for first scenario
2. Design specific vulnerability scenario to prototype
3. Create UI mockup/wireframe
4. Decide on tech stack specifics (vanilla JS? lightweight framework?)
5. Build simple prototype with one vulnerability type
