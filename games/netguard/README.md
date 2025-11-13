# NetGuard - Cybersecurity Educational Game

Web-based game teaching security concepts through interactive investigation.

## Levels

1. **Expired Credentials** - JWT token expiration and access revocation
2. **SQL Injection & Secrets** - SQL injection and secret management
3. **Certificate Validation** - TLS/HTTPS and man-in-the-middle attacks

## How to Play

1. Open `index.html` in a browser
2. Select a mission
3. SSH into systems and investigate with terminal commands
4. Talk to NPCs to gather information
5. Find vulnerabilities and fix them

## Commands

- `scan` - System information
- `tail -f /var/log/system.log` - View logs
- `cat source.js` - View source code
- `tools` - Interactive security tools (JWT decoder, SQL tester, cert validator)
- Level-specific commands for investigation and fixing

## Interactive Tools

- **JWT Decoder** - Decode and analyze tokens
- **SQL Injection Tester** - Test injection payloads
- **Certificate Validator** - Analyze certificates

## Testing

```bash
npm test -- netguard/        # Run tests
npm run lint -- netguard/    # Run linter
```

## Development

**File Structure:**

- `levels.js` - Level definitions
- `networks.js` - Network topologies
- `tools.js` - Interactive tools (22 unit tests)
- `game.js` - Main game logic

**Adding Levels:**

1. Define in `levels.js`
2. Create network in `networks.js`
3. Add commands in `game.js`
