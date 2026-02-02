# Common Game Modules

## Overview

Shared utilities used across educational games to reduce code duplication and ensure consistent behavior.

## Modules

### BaseGameUI.js
Base class for all game UI managers. Provides common DOM manipulation patterns:
- `showScreen(screenId)` - Screen transition logic
- `showModal(modal)` / `hideModal(modal)` - Modal management
- `setVisible(element, visible)` - Toggle element visibility
- `setText(elementId, text)` / `setHTML(elementId, html)` - Content updates
- `updateProgressBar(current, total)` - Progress tracking
- `disableButton()` / `enableButton()` - Button state management
- `showFeedback(message, type)` - Feedback display
- `markButtonCorrect()` / `markButtonIncorrect()` - Visual feedback
- `shakeElement()` - Error animation

All game-specific GameUI classes extend this base class.

**Security Note**: Uses innerHTML for dynamic content generation. All content is generated from controlled game data (not user input), making it safe from XSS attacks.

### StorageManager.js
Handles localStorage operations with error handling and version management:
- `saveGameState(data)` - Serialize and save to localStorage
- `loadGameState()` - Load and deserialize from localStorage
- `clearGameState()` - Remove saved data
- `hasGameState()` - Check if data exists
- `exportGameState()` / `importGameState(json)` - Import/export functionality

Features:
- Automatic version checking and migration
- Graceful error handling for private browsing mode
- Quota exceeded error handling
- JSON parse failure protection

## Usage Pattern

Each game imports these shared modules:

```javascript
import { BaseGameUI } from "../../common/js/BaseGameUI.js"
import { StorageManager } from "../../common/js/StorageManager.js"
```

Game-specific UI classes extend BaseGameUI:

```javascript
export class GameUI extends BaseGameUI {
  constructor() {
    super()
    // Game-specific initialization
  }
}
```

## Design Principles

- **DRY (Don't Repeat Yourself)**: Common patterns extracted to shared modules
- **Error Handling**: Graceful degradation when browser features unavailable
- **Consistent Behavior**: All games handle screen transitions, storage, etc. the same way
- **Extensibility**: Base classes designed for extension via inheritance
