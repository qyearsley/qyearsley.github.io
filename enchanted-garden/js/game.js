// Main game logic and state management
class EnchantedGarden {
    constructor() {
        this.currentScreen = 'title';
        this.currentArea = null;
        this.currentActivity = null;
        this.stats = {
            stars: 0,
            flowers: 0,
            activitiesCompleted: 0
        };

        this.garden = [];
        this.initializeEventListeners();
        this.loadProgress();
    }

    initializeEventListeners() {
        // Title screen - start button
        const startButton = document.getElementById('start-button');
        if (startButton) {
            startButton.addEventListener('click', () => {
                console.log('Start button clicked');
                this.showScreen('garden-hub');
            });
        }

        // Garden areas
        document.querySelectorAll('.garden-area.unlocked').forEach(area => {
            area.addEventListener('click', (e) => {
                const areaId = e.currentTarget.dataset.area;
                this.enterArea(areaId);
            });
        });

        // Back button
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.addEventListener('click', () => {
                this.showScreen('garden-hub');
            });
        }

        // Continue button (reward screen)
        const continueButton = document.getElementById('continue-button');
        if (continueButton) {
            continueButton.addEventListener('click', () => {
                this.showScreen('activity-screen');
                this.generateActivity();
            });
        }
    }

    showScreen(screenId) {
        console.log('Showing screen:', screenId);
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
        this.currentScreen = screenId;
    }

    enterArea(areaId) {
        this.currentArea = areaId;
        this.showScreen('activity-screen');
        this.generateActivity();
        this.renderGarden();
    }

    generateActivity() {
        // Use the ActivityGenerator to create a new activity
        this.currentActivity = window.activityGenerator.generateActivity(this.stats.activitiesCompleted);
        this.displayActivity(this.currentActivity);
    }

    displayActivity(activity) {
        // Update creature message
        document.getElementById('creature-message').textContent = activity.creatureMessage;

        // Update question
        document.getElementById('question-text').textContent = activity.question;

        // Display visual elements
        const visualArea = document.getElementById('visual-area');
        visualArea.innerHTML = '';

        if (activity.visual && activity.visual.length > 0) {
            activity.visual.forEach((item, index) => {
                setTimeout(() => {
                    const visualItem = document.createElement('div');
                    visualItem.className = 'visual-item';

                    // Check if item is crossed out (for subtraction)
                    if (typeof item === 'object' && item.crossed) {
                        visualItem.classList.add('crossed-out');
                        visualItem.textContent = item.emoji;
                    } else {
                        visualItem.textContent = item;
                    }

                    visualArea.appendChild(visualItem);
                }, index * 100);
            });
        }

        // Display answer options
        const answerOptions = document.getElementById('answer-options');
        answerOptions.innerHTML = '';

        activity.options.forEach((option) => {
            const button = document.createElement('button');
            button.className = 'answer-button';
            button.textContent = option;
            button.addEventListener('click', () => this.checkAnswer(option, button));
            answerOptions.appendChild(button);
        });

        // Hide feedback
        document.getElementById('feedback-area').classList.add('hidden');
    }

    checkAnswer(selectedAnswer, button) {
        const isCorrect = selectedAnswer === this.currentActivity.correctAnswer;

        // Disable all buttons
        document.querySelectorAll('.answer-button').forEach(btn => {
            btn.classList.add('disabled');
        });

        if (isCorrect) {
            // Mark button as correct
            button.classList.add('correct');

            // Show positive feedback
            this.showFeedback('Correct! 🌟', 'correct');

            // Create subtle particle effects
            this.createParticles(button);

            // Update stats
            this.stats.stars += 1;
            this.stats.flowers += 1;
            this.stats.activitiesCompleted += 1;

            // Add flower to garden
            const flower = window.rewardSystem.generateFlower();
            this.garden.push(flower);

            // Update displays
            this.updateStats();
            this.saveProgress();
            this.renderGarden();

            // Continue to next question after short delay (no reward screen)
            setTimeout(() => {
                this.generateActivity();
            }, 1500);
        } else {
            // Encourage to try again
            button.style.animation = 'shake 0.5s';
            this.showFeedback('Not quite! Try again! 💫', 'encourage');

            // Re-enable buttons after a moment
            setTimeout(() => {
                document.querySelectorAll('.answer-button').forEach(btn => {
                    btn.classList.remove('disabled');
                });
                button.style.animation = '';
            }, 1000);
        }
    }

    showFeedback(message, type) {
        const feedbackArea = document.getElementById('feedback-area');
        feedbackArea.textContent = message;
        feedbackArea.className = `feedback-area ${type}`;
        feedbackArea.classList.remove('hidden');
    }

    showReward(reward) {
        document.getElementById('reward-message').textContent =
            `You earned a beautiful ${reward.color} flower!`;

        const rewardVisual = document.getElementById('reward-visual');
        rewardVisual.textContent = reward.emoji;

        this.showScreen('reward-screen');
    }

    createParticles(sourceElement) {
        const rect = sourceElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const emojis = ['✨', '⭐'];

        // Reduced to just 5 particles
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
                particle.style.left = centerX + 'px';
                particle.style.top = centerY + 'px';
                particle.style.setProperty('--tx', (Math.random() - 0.5) * 200 + 'px');

                document.getElementById('particles-container').appendChild(particle);

                setTimeout(() => particle.remove(), 2000);
            }, i * 80);
        }
    }

    renderGarden() {
        const gardenCanvas = document.getElementById('garden-canvas');
        gardenCanvas.innerHTML = '';

        // Render all collected flowers
        this.garden.forEach((flower, index) => {
            setTimeout(() => {
                const flowerElement = document.createElement('div');
                flowerElement.className = `garden-item flower flower-${flower.color}`;
                flowerElement.textContent = flower.emoji;
                gardenCanvas.appendChild(flowerElement);
            }, index * 100);
        });
    }

    updateStats() {
        // Update all stat displays
        document.querySelectorAll('#star-count, #activity-star-count').forEach(el => {
            el.textContent = this.stats.stars;
        });
        document.getElementById('flower-count').textContent = this.stats.flowers;
    }

    saveProgress() {
        window.storageManager.saveProgress(this.stats, this.garden);
    }

    loadProgress() {
        const saved = window.storageManager.loadProgress();
        if (saved) {
            this.stats = saved.stats;
            this.garden = saved.garden;
            this.updateStats();
        }
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new EnchantedGarden();
});
