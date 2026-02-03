# Number Garden 🌸

An educational math game for children featuring addition, subtraction, multiplication, time-telling, measurement, and pattern recognition.

## Features

- **6 Themed Areas:** Each area teaches a different math concept
  - 🦄 Flower Meadow (Addition)
  - 🔮 Crystal Cave (Subtraction)
  - 🌲 Enchanted Forest (Multiplication)
  - 🕰️ Time Temple (Time-telling)
  - 🦊 Measurement Market (Measurement)
  - 🦋 Pattern Path (Patterns & sequences)

- **Multiple Project Types:** Choose to build a castle 🏰, grow a garden 🌻, create a robot 🤖, or construct a rocket 🚀
- **Progressive Difficulty:** Questions get harder as you progress through levels
- **Visual Learning:** Pictures and animations help reinforce concepts
- **Project Building:** Complete areas to collect project pieces (6 total)
- **Save Progress:** Automatically saves your stars, progress, and project choice

## Settings

Access settings via the ⚙️ button on the garden hub:

- **Answer Mode:** Multiple choice or keyboard typing
- **Visual Hints:** Toggle pictures on or off
- **Sound Effects:** Toggle sound effects on or off

Each level consists of 5 questions.

## Keyboard Controls

- **Tab** - Navigate between elements
- **j/k** - Move between navigation links (vim-style)
- **1, 2, 3, 4** - Quick select answers during questions
- **Enter/Space** - Activate buttons and submit keyboard answers
- **Home button** - Return to start screen from garden hub

## For Developers

See [js/README.md](js/README.md) for detailed module architecture documentation.

### Structure

```
js/
├── game.js              # Main game controller (orchestrates all systems)
├── GameState.js         # State management and progress persistence
├── GameUI.js            # UI rendering and display logic
├── EventManager.js      # Input handling and event coordination
├── activities.js        # Math problem generation for all topics
├── storage.js           # LocalStorage wrapper for save/load
├── rewards.js           # Reward distribution and flower generation
├── ProgressionManager.js # Area unlocking and progression logic
└── ParticleSystem.js    # Visual effects for celebrations

styles/
├── main.css            # Core layout and components
├── garden.css          # Garden visualization
└── animations.css      # Keyframe animations
```

### Testing

```bash
npm install
npm test        # Run all tests
```

**Quick testing:**
- `index.html?unlock=all` - Unlock all areas
- `index.html?unlock=crystal-cave` - Unlock specific area

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Fully accessible with keyboard and screen readers.

### Mobile Support

Optimized for touch devices with responsive design and proper viewport handling.

## Security & Privacy

- No user input accepted - all content generated from game data
- Progress saved locally in browser (no external transmission)
- No personal information collected
- No cookies or tracking
- Self-hosted code (Google Fonts only external resource)
