import { ActivityGenerator } from '../enchanted-garden/js/activities.js';

describe('ActivityGenerator', () => {
    let generator;

    beforeEach(() => {
        generator = new ActivityGenerator();
    });

    describe('generateActivity', () => {
        test('generates easy difficulty for early activities', () => {
            const activity = generator.generateActivity(0);
            expect(activity).toBeDefined();
            expect(activity.type).toMatch(/addition|subtraction/);
            expect(activity.question).toBeDefined();
            expect(activity.correctAnswer).toBeGreaterThan(0);
        });

        test('generates medium difficulty for mid activities', () => {
            const activity = generator.generateActivity(8);
            expect(activity).toBeDefined();
            expect(activity.correctAnswer).toBeLessThanOrEqual(20);
        });

        test('includes visual elements', () => {
            const activity = generator.generateActivity(0);
            expect(activity.visual).toBeDefined();
            expect(Array.isArray(activity.visual)).toBe(true);
            expect(activity.visual.length).toBeGreaterThan(0);
        });

        test('includes 4 answer options', () => {
            const activity = generator.generateActivity(0);
            expect(activity.options).toBeDefined();
            expect(activity.options.length).toBe(4);
            expect(activity.options).toContain(activity.correctAnswer);
        });

        test('includes creature message', () => {
            const activity = generator.generateActivity(0);
            expect(activity.creatureMessage).toBeDefined();
            expect(typeof activity.creatureMessage).toBe('string');
        });
    });

    describe('generateAddition', () => {
        test('generates valid addition problem', () => {
            const activity = generator.generateAddition('easy');
            expect(activity.type).toBe('addition');
            expect(activity.question).toContain('+');
            expect(activity.correctAnswer).toBeGreaterThan(0);
        });

        test('easy difficulty uses numbers 1-5', () => {
            for (let i = 0; i < 10; i++) {
                const activity = generator.generateAddition('easy');
                expect(activity.correctAnswer).toBeLessThanOrEqual(10);
            }
        });

        test('answer options are unique', () => {
            const activity = generator.generateAddition('easy');
            const uniqueOptions = new Set(activity.options);
            expect(uniqueOptions.size).toBe(4);
        });
    });

    describe('generateSubtraction', () => {
        test('generates valid subtraction problem', () => {
            const activity = generator.generateSubtraction('easy');
            expect(activity.type).toBe('subtraction');
            expect(activity.question).toContain('-');
            expect(activity.correctAnswer).toBeGreaterThanOrEqual(0);
        });

        test('includes crossed-out visual items', () => {
            const activity = generator.generateSubtraction('easy');
            const crossedOutItems = activity.visual.filter(
                item => typeof item === 'object' && item.crossed
            );
            expect(crossedOutItems.length).toBeGreaterThan(0);
        });

        test('answer is always positive', () => {
            for (let i = 0; i < 20; i++) {
                const activity = generator.generateSubtraction('medium');
                expect(activity.correctAnswer).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('createSubtractionVisual', () => {
        test('creates correct number of items', () => {
            const visual = generator.createSubtractionVisual(5, 2);
            expect(visual.length).toBe(5);
        });

        test('marks correct number as crossed out', () => {
            const visual = generator.createSubtractionVisual(7, 3);
            const crossedOut = visual.filter(
                item => typeof item === 'object' && item.crossed
            );
            expect(crossedOut.length).toBe(3);
        });

        test('non-crossed items come first', () => {
            const visual = generator.createSubtractionVisual(6, 2);
            const firstFour = visual.slice(0, 4);
            const lastTwo = visual.slice(4, 6);

            const firstFourAllStrings = firstFour.every(item => typeof item === 'string');
            const lastTwoAllCrossed = lastTwo.every(
                item => typeof item === 'object' && item.crossed
            );

            expect(firstFourAllStrings).toBe(true);
            expect(lastTwoAllCrossed).toBe(true);
        });
    });

    describe('generateOptions', () => {
        test('generates 4 unique options', () => {
            const options = generator.generateOptions(5, 20);
            expect(options.length).toBe(4);
            expect(new Set(options).size).toBe(4);
        });

        test('includes correct answer', () => {
            const correctAnswer = 7;
            const options = generator.generateOptions(correctAnswer, 20);
            expect(options).toContain(correctAnswer);
        });

        test('all options are positive', () => {
            const options = generator.generateOptions(3, 10);
            options.forEach(option => {
                expect(option).toBeGreaterThan(0);
            });
        });
    });
});
