// Activity generation system
class ActivityGenerator {
    constructor() {
        this.creatureMessages = [
            "Can you help me solve this problem?",
            "Let's work on this together!",
            "I need your help with the flowers!",
            "You're doing wonderfully! Try this one!",
            "The garden needs your clever thinking!",
            "Let's count these magical flowers!",
            "Can you figure out how many we have?"
        ];
    }

    generateActivity(activityNumber) {
        // Determine difficulty based on activity number
        const difficulty = this.getDifficulty(activityNumber);

        // For now, focus on addition activities
        const activityType = Math.random() < 0.7 ? 'addition' : 'subtraction';

        if (activityType === 'addition') {
            return this.generateAddition(difficulty);
        } else {
            return this.generateSubtraction(difficulty);
        }
    }

    getDifficulty(activityNumber) {
        if (activityNumber < 5) return 'easy';
        if (activityNumber < 15) return 'medium';
        return 'hard';
    }

    generateAddition(difficulty) {
        let max;

        switch (difficulty) {
            case 'easy':
                max = 5;
                break;
            case 'medium':
                max = 10;
                break;
            case 'hard':
                max = 15;
                break;
        }

        const num1 = Math.floor(Math.random() * max) + 1;
        const num2 = Math.floor(Math.random() * max) + 1;
        const answer = num1 + num2;

        // Generate visual representation
        const visual = this.createVisualItems(num1, num2);

        // Create simple question
        const question = `${num1} + ${num2} = ?`;

        // Generate answer options
        const options = this.generateOptions(answer, max * 2);

        return {
            type: 'addition',
            question: question,
            correctAnswer: answer,
            options: options,
            visual: visual,
            creatureMessage: this.creatureMessages[Math.floor(Math.random() * this.creatureMessages.length)]
        };
    }

    generateSubtraction(difficulty) {
        let max;

        switch (difficulty) {
            case 'easy':
                max = 5;
                break;
            case 'medium':
                max = 10;
                break;
            case 'hard':
                max = 15;
                break;
        }

        const num1 = Math.floor(Math.random() * max) + Math.floor(max / 2) + 1;
        const num2 = Math.floor(Math.random() * (num1 - 1)) + 1;
        const answer = num1 - num2;

        // Generate visual representation (showing items with some crossed out)
        const visual = this.createSubtractionVisual(num1, num2);

        // Create simple question
        const question = `${num1} - ${num2} = ?`;

        // Generate answer options
        const options = this.generateOptions(answer, max * 2);

        return {
            type: 'subtraction',
            question: question,
            correctAnswer: answer,
            options: options,
            visual: visual,
            creatureMessage: this.creatureMessages[Math.floor(Math.random() * this.creatureMessages.length)]
        };
    }

    createVisualItems(count1, count2) {
        const items1 = ['🌹', '🌺', '🌸', '🌼', '🌻'];
        const items2 = ['🌷', '💐', '🏵️', '🥀', '🌾'];

        const visual = [];

        // First group
        const emoji1 = items1[Math.floor(Math.random() * items1.length)];
        for (let i = 0; i < count1; i++) {
            visual.push(emoji1);
        }

        // Second group (if exists)
        if (count2 > 0) {
            const emoji2 = items2[Math.floor(Math.random() * items2.length)];
            for (let i = 0; i < count2; i++) {
                visual.push(emoji2);
            }
        }

        return visual;
    }

    createSubtractionVisual(total, toSubtract) {
        const items = ['🌹', '🌺', '🌸', '🌼', '🌻'];
        const visual = [];

        const emoji = items[Math.floor(Math.random() * items.length)];

        // Add items that remain (not crossed out)
        for (let i = 0; i < total - toSubtract; i++) {
            visual.push(emoji);
        }

        // Add crossed out items to show what was subtracted
        for (let i = 0; i < toSubtract; i++) {
            visual.push({ crossed: true, emoji: emoji });
        }

        return visual;
    }

    generateOptions(correctAnswer, maxRange) {
        const options = new Set([correctAnswer]);

        // Generate 3 wrong answers
        while (options.size < 4) {
            let wrongAnswer;

            // Generate plausible wrong answers
            const offset = Math.floor(Math.random() * 5) + 1;
            if (Math.random() < 0.5) {
                wrongAnswer = correctAnswer + offset;
            } else {
                wrongAnswer = correctAnswer - offset;
            }

            // Ensure answer is positive and within reasonable range
            if (wrongAnswer > 0 && wrongAnswer <= maxRange && wrongAnswer !== correctAnswer) {
                options.add(wrongAnswer);
            }
        }

        // Convert to array and shuffle
        return this.shuffleArray(Array.from(options));
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

// Initialize activity generator for browser
if (typeof window !== 'undefined') {
    window.activityGenerator = new ActivityGenerator();
}

// Export for tests
export { ActivityGenerator };
