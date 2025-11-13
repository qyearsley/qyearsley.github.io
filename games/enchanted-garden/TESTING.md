# Testing Enchanted Garden

## Query Parameters for Testing

You can unlock areas using query parameters for easier testing:

### Unlock all areas
```
index.html?unlock=all
```

### Unlock specific area
```
index.html?unlock=crystal-cave
index.html?unlock=enchanted-forest
```

## Starting Fresh

When you have saved progress, the title screen will show two buttons:
- **Continue** - Resume your saved progress
- **Start Fresh** - Reset all progress and start over

When you don't have saved progress, only the **Start** button appears.

Clicking "Start Fresh" will:
- Clear all saved progress
- Reset stars, flowers, and levels to initial state
- Show a confirmation dialog before resetting
- Take you directly to the Garden Hub

## Console Messages

When using testing features, you'll see console messages:
- `🔓 All areas unlocked for testing` - when using `?unlock=all`
- `🔓 Unlocked [area-name] for testing` - when unlocking a specific area
- `🔄 Started fresh` - after successfully resetting progress
