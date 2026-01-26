# Word Quest 📖

A phonics-based educational game that teaches reading skills through interactive activities and progressive quests.

## Features

- **6 Progressive Quests:** Each quest focuses on a different reading skill
  - 🔊 Sound Cipher (Phoneme identification)
  - 🎵 Blending Workshop (Sound blending)
  - ⚡ Speed Vault (Sight word recognition)
  - 🔍 Pattern Archive (Word pattern recognition)
  - ✨ Spell Forge (Spelling activities)
  - 📚 Story Vault (Reading comprehension)

- **Audio Support:** Web Audio API generates phonics sounds for letters and blends
- **Multiple Input Modes:** Keyboard typing or multiple choice
- **Word Gallery:** Track mastered words with visual representations
- **Progressive Unlocking:** Complete quests to unlock new challenges
- **Star Ratings:** Earn stars based on accuracy
- **Save Progress:** Automatically saves completed quests and mastered words

## Settings

Access settings via the ⚙️ button:

- **Audio Hints:** Toggle phonics sound playback on or off
- **Input Mode:** Switch between keyboard input and multiple choice

Each quest consists of 10 activities.

## Keyboard Controls

- **Tab** - Navigate between elements
- **Enter/Space** - Activate buttons
- **Keyboard Input Mode:** Type answers directly when enabled

## Quest System

Quests unlock progressively as you complete them:
1. Sound Cipher (always available)
2. Blending Workshop
3. Speed Vault
4. Pattern Archive
5. Spell Forge
6. Story Vault

Earn stars based on accuracy:
- ⭐⭐⭐ Perfect (0-1 mistakes)
- ⭐⭐ Good (2-3 mistakes)
- ⭐ Complete (4+ mistakes)

## For Developers

See [js/README.md](js/README.md) for detailed module architecture documentation.

### Structure

```
js/
├── game.js                  # Main game controller
├── GameState.js             # Progress tracking and save/load
├── GameUI.js                # UI rendering and display
├── EventManager.js          # Input handling and event coordination
├── WordActivityGenerator.js # Reading activity generation
├── WordBank.js              # Word lists and phonics data (762 lines)
├── SoundManager.js          # Web Audio API for phonics sounds
├── storage.js               # LocalStorage wrapper
└── constants.js             # Quest configuration and thresholds
```

### Running Tests

```bash
npm install
npm test
```

### Testing & Development

**Unlock all quests for testing:**
- `index.html?unlock=all`

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Web Audio API required for sound features but game works without it.

### Accessibility

- Comprehensive ARIA labels for screen readers
- Keyboard navigation support
- Audio hints toggle for different learning styles
- High contrast visual feedback
