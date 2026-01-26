# Common Game Modules

## Overview

Shared utilities used across all games to reduce code duplication and ensure consistent behavior.

## Modules

### BaseGameUI.js
Base class for all game UI managers. Provides common DOM manipulation patterns:
- `showScreen(screenId)` - Screen transition logic
- `showModal(modal)` / `hideModal(modal)` - Modal management
- `cacheCommonElements()` - Cache frequently accessed DOM elements

All game-specific GameUI classes extend this base class.

**Security Note**: Uses innerHTML for dynamic content generation. All content is generated from controlled game data (not user input), making it safe from XSS attacks.

### StorageManager.js
Handles localStorage operations with error handling:
- `save(key, data)` - Serialize and save to localStorage
- `load(key)` - Load and deserialize from localStorage
- `clear(key)` - Remove saved data
- `has(key)` - Check if data exists

Gracefully handles:
- localStorage not available (private browsing)
- Quota exceeded errors
- JSON parse failures

### utils.js
Utility functions shared across games:
- Array shuffling
- Random number generation
- Math helpers
- String manipulation

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
