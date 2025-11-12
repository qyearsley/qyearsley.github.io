// Reward system - generates and manages rewards
class RewardSystem {
    constructor() {
        this.flowerTypes = [
            { color: 'red', emoji: '🌹', name: 'Rose' },
            { color: 'pink', emoji: '🌺', name: 'Hibiscus' },
            { color: 'yellow', emoji: '🌻', name: 'Sunflower' },
            { color: 'purple', emoji: '🪻', name: 'Lavender' },
            { color: 'blue', emoji: '💠', name: 'Blue Flower' },
            { color: 'orange', emoji: '🌼', name: 'Marigold' },
            { color: 'white', emoji: '🌸', name: 'Cherry Blossom' },
            { color: 'pink', emoji: '🌷', name: 'Tulip' }
        ];

        this.specialRewards = [
            { emoji: '🦋', name: 'Butterfly', unlockAt: 5 },
            { emoji: '🌈', name: 'Rainbow', unlockAt: 10 },
            { emoji: '⭐', name: 'Star', unlockAt: 15 },
            { emoji: '🎆', name: 'Sparkles', unlockAt: 20 }
        ];
    }

    generateFlower() {
        // Random flower selection
        const flower = this.flowerTypes[Math.floor(Math.random() * this.flowerTypes.length)];
        return {
            ...flower,
            timestamp: Date.now()
        };
    }

    getSpecialReward(activityCount) {
        // Check if player has unlocked any special rewards
        for (const reward of this.specialRewards) {
            if (activityCount === reward.unlockAt) {
                return reward;
            }
        }
        return null;
    }

    getEncouragingMessage() {
        const messages = [
            "You're doing amazing!",
            "Keep up the great work!",
            "What a clever gardener you are!",
            "The garden is blooming because of you!",
            "Wonderful job!",
            "You're a math superstar!",
            "The creatures are so proud of you!",
            "Look how beautiful the garden is becoming!"
        ];

        return messages[Math.floor(Math.random() * messages.length)];
    }

    getCelebrationEmoji() {
        const emojis = ['🎉', '🎊', '✨', '🌟', '💫', '🎆', '🎇'];
        return emojis[Math.floor(Math.random() * emojis.length)];
    }
}

// Initialize reward system
window.rewardSystem = new RewardSystem();
