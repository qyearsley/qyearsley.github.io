# Enchanted Garden 🌸

An educational math game for children featuring addition, subtraction, multiplication, time-telling, measurement, and pattern recognition.

## Features

- **6 Themed Areas:** Each area teaches a different math concept
  - 🦄 Flower Meadow (Addition)
  - 🔮 Crystal Cave (Subtraction)
  - 🌲 Enchanted Forest (Multiplication)
  - 🕰️ Time Temple (Time-telling)
  - 🦊 Measurement Market (Measurement)
  - 🦋 Pattern Path (Patterns & sequences)

- **Progressive Difficulty:** Questions get harder as you progress
- **Visual Learning:** Pictures and animations help reinforce concepts
- **Castle Building:** Complete areas to build a castle piece by piece
- **Save Progress:** Automatically saves your stars and progress

## Settings

Access settings via the ⚙️ button on the garden hub:
- **Answer Mode:** Multiple choice or keyboard typing
- **Visual Hints:** Control when pictures appear (always/sometimes/never)
- **Questions Per Level:** Choose 3, 5, 6, 8, or 10 questions

## Keyboard Controls

- **Tab** - Navigate between elements
- **1, 2, 3, 4** - Quick select answers
- **Enter/Space** - Activate buttons
- **Home button** - Return to start screen from garden hub

## For Developers

### Structure
```
js/
├── config/          # Configuration (areas, settings)
├── utils/           # Utilities (SVG generation)
├── game.js          # Main game controller
├── GameState.js     # State management
├── GameUI.js        # UI rendering
└── activities.js    # Question generation
```

### Running Tests
```bash
npm install
npm test
```

### Testing & Development
**Unlock areas for quick testing:**
- `index.html?unlock=all` - Unlock all areas
- `index.html?unlock=crystal-cave` - Unlock specific area

**Starting fresh:**
When you have saved progress, the title screen shows:
- **Continue** - Resume your saved progress
- **Start Fresh** - Reset all progress (with confirmation)

**Console messages:**
- `🔓 All areas unlocked for testing`
- `🔓 Unlocked [area-name] for testing`
- `🔄 Started fresh`

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Fully accessible with keyboard and screen readers.
