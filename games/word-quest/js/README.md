# Word Quest Module Architecture

## Overview

Word Quest is a phonics-based educational game that teaches reading skills through interactive activities. The architecture follows a similar pattern to Number Garden with clear separation between state, UI, and logic.

## Core Architecture Pattern

```
game.js (Game class)
├── GameState              - Manages player progress and unlocked content
├── GameUI                 - Handles all DOM manipulation and rendering
├── EventManager           - Coordinates user interactions
├── WordActivityGenerator  - Creates reading activities
├── WordBank              - Stores word lists and phonics data
├── SoundManager          - Manages Web Audio API for phonics sounds
└── StorageManager        - Handles localStorage persistence
```

## Key Modules

### game.js
Main controller that orchestrates all game systems. Initializes subsystems and manages game flow between screens (title, quest map, activities, completion).

### GameState.js
Tracks player progress including:
- Unlocked quests
- Completed quests and star ratings
- Mastered words
- Player statistics (decoder rank, total stars)
- Settings (audio hints, input mode)

### GameUI.js
Extends BaseGameUI. Responsible for:
- Rendering quest map with progress indicators
- Displaying word activities (questions and choices)
- Showing feedback and level completion screens
- Managing word gallery
All content is generated from controlled data (WordBank), never user input.

### EventManager.js
Attaches listeners for user interactions:
- Screen navigation (Start, Continue, Quest selection)
- Activity interactions (answer selection, keyboard input)
- Settings changes (audio toggle, input mode)

### WordActivityGenerator.js
Creates reading activities based on quest type:
- Sound Cipher: Phoneme identification
- Blending Workshop: Sound blending
- Speed Vault: Sight word recognition
- Pattern Archive: Word pattern recognition
- Spell Forge: Spelling activities
- Story Vault: Reading comprehension

### WordBank.js
Large data file (762 lines) containing:
- CVC word lists organized by vowel
- Digraph word lists (sh, ch, th, etc.)
- Sight words by frequency
- Word patterns and phonics rules

### SoundManager.js
Manages Web Audio API to generate phonics sounds:
- Individual phoneme sounds
- Sound blending demonstrations
- Correct/incorrect feedback sounds
Gracefully degrades if Web Audio not supported.

### constants.js
Configuration for:
- Quest unlock requirements
- Star thresholds
- Activity counts per quest
- Input modes (keyboard vs. multiple choice)

## Data Flow

1. User selects quest → EventManager
2. EventManager → game.js starts quest
3. game.js → WordActivityGenerator creates activity
4. game.js → GameUI displays activity
5. User answers → EventManager
6. EventManager → game.js checks answer
7. game.js → Updates GameState
8. game.js → GameUI shows feedback
9. On completion → GameState persists via StorageManager

## Quest System

Quests unlock progressively:
- Sound Cipher (always unlocked)
- Blending Workshop (after Sound Cipher)
- Speed Vault (after Blending Workshop)
- Pattern Archive (after Speed Vault)
- Spell Forge (after Pattern Archive)
- Story Vault (after Spell Forge)

Each quest has 10 activities. Star ratings based on mistakes.

## Testing

Tests located in `__tests__/`:
- `GameState.test.js` - Progress tracking
- `SoundManager.test.js` - Audio generation

Run tests: `npm test`

## Design Principles

- **Progressive Disclosure**: Content unlocks as player progresses
- **Multiple Input Modes**: Supports keyboard and mouse interaction
- **Accessibility**: ARIA labels, keyboard navigation, audio hints
- **Graceful Degradation**: Works without Web Audio API
- **Data-Driven**: Activities generated from WordBank data
