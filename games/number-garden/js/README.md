# Number Garden Module Architecture

## Overview

The Number Garden game uses a modular architecture with clear separation of concerns. The main entry point (`game.js`) orchestrates multiple subsystems through dependency injection.

## Core Architecture Pattern

```
game.js (NumberGarden class)
├── GameState         - Manages game data and progress
├── GameUI            - Handles all DOM manipulation
├── EventManager      - Coordinates user interactions
├── ProgressionManager - Controls level difficulty
├── ActivityGenerator - Creates math problems
├── SoundManager      - Manages audio feedback
├── StorageManager    - Handles localStorage persistence
├── RewardSystem      - Manages rewards and achievements
├── ParticleSystem    - Visual effects
└── ProjectVisuals    - SVG generation for projects
```

## Key Modules

### game.js
Main controller that orchestrates all game systems. Uses dependency injection to initialize subsystems and wire them together through callbacks passed to EventManager.

### GameState.js
Single source of truth for game data (progress, stats, settings). Provides methods to query and update state. Works with StorageManager for persistence.

### GameUI.js
Extends BaseGameUI. Responsible for all DOM manipulation and rendering. Receives data from GameState and displays it. Never directly modifies game state.

### EventManager.js
Central event coordination. Attaches event listeners to DOM elements and routes them to appropriate callbacks (defined in game.js). Prevents event handler sprawl.

### ProgressionManager.js
Determines appropriate difficulty for activities based on player progress. Ensures steady learning curve.

### ActivityGenerator.js
Creates math problems based on difficulty level. Generates questions, answers, and visual representations.

### SoundManager.js
Manages Web Audio API for sound effects. Gracefully degrades if audio not supported.

### StorageManager.js
Shared utility (from `games/common/js/`) that handles localStorage operations with error handling.

### ProjectVisuals.js
Generates SVG visualizations for project completion (castles, gardens, robots, spaceships).

## Data Flow

1. User action → EventManager
2. EventManager → Callback in game.js
3. game.js → Updates GameState
4. game.js → Calls GameUI methods to reflect changes
5. GameUI → Queries GameState for data to display

## Testing

Tests are located in `__tests__/` directory. Each major module has corresponding tests:
- `GameState.test.js` - State management
- `SoundManager.test.js` - Audio system
- `ProgressionManager.test.js` - Difficulty scaling

Run tests: `npm test`

## Design Principles

- **Separation of Concerns**: UI, state, and logic are separate
- **Dependency Injection**: Main controller injects dependencies for testability
- **Unidirectional Data Flow**: State changes flow through game.js to UI
- **Graceful Degradation**: Sound/visual effects degrade gracefully if not supported
