// Storage manager for saving and loading progress
class StorageManager {
    constructor() {
        this.storageKey = 'enchantedGardenProgress';
    }

    saveProgress(stats, garden) {
        try {
            const data = {
                stats: stats,
                garden: garden,
                lastPlayed: Date.now(),
                version: '1.0'
            };

            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving progress:', error);
            return false;
        }
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem(this.storageKey);

            if (!saved) {
                return null;
            }

            const data = JSON.parse(saved);

            // Validate data structure
            if (data.stats && data.garden) {
                return data;
            }

            return null;
        } catch (error) {
            console.error('Error loading progress:', error);
            return null;
        }
    }

    clearProgress() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.error('Error clearing progress:', error);
            return false;
        }
    }

    exportProgress() {
        const data = this.loadProgress();
        if (data) {
            return JSON.stringify(data, null, 2);
        }
        return null;
    }

    importProgress(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            // Validate structure
            if (data.stats && data.garden) {
                localStorage.setItem(this.storageKey, jsonString);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error importing progress:', error);
            return false;
        }
    }
}

// Initialize storage manager
window.storageManager = new StorageManager();
