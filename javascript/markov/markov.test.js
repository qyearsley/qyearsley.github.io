/**
 * Tests for Markov Chain Text Generator
 */

// Simple test framework for browser environment
class TestFramework {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }
    
    test(name, fn) {
        this.tests.push({ name, fn });
    }
    
    run() {
        console.log('Running Markov Chain Tests...\n');
        
        this.tests.forEach(test => {
            try {
                test.fn();
                console.log(`✓ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.error(`✗ ${test.name}: ${error.message}`);
                this.failed++;
            }
        });
        
        console.log(`\nResults: ${this.passed} passed, ${this.failed} failed`);
        return this.failed === 0;
    }
    
    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
    
    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message}. Expected: ${expected}, Got: ${actual}`);
        }
    }
    
    assertTrue(condition, message) {
        this.assert(condition, message);
    }
    
    assertFalse(condition, message) {
        this.assert(!condition, message);
    }
}

const test = new TestFramework();

// Test MarkovChain class
test.test('MarkovChain should initialize with empty state', () => {
    const chain = new MarkovChain();
    test.assertEqual(chain.ngrams.size, 0, 'Should start with empty ngrams map');
    test.assertEqual(chain.startNgrams.length, 0, 'Should start with empty startNgrams array');
});

test.test('MarkovChain should train on character n-grams', () => {
    const chain = new MarkovChain();
    chain.train('hello', 2, 'char');
    
    test.assertTrue(chain.ngrams.size > 0, 'Should have trained ngrams');
    test.assertTrue(chain.startNgrams.length > 0, 'Should have starting ngrams');
    test.assertEqual(chain.getNgramSize(), 2, 'Should have correct ngram size');
});

test.test('MarkovChain should train on word n-grams', () => {
    const chain = new MarkovChain();
    chain.train('hello world test', 2, 'word');
    
    test.assertTrue(chain.ngrams.size > 0, 'Should have trained ngrams');
    test.assertTrue(chain.startNgrams.length > 0, 'Should have starting ngrams');
    test.assertEqual(chain.getNgramSize(), 2, 'Should have correct ngram size');
});

test.test('MarkovChain should handle empty input gracefully', () => {
    const chain = new MarkovChain();
    chain.train('', 2, 'char');
    chain.train(null, 2, 'char');
    chain.train('   ', 2, 'char');
    
    test.assertEqual(chain.ngrams.size, 0, 'Should handle empty input');
    test.assertEqual(chain.startNgrams.length, 0, 'Should handle empty input');
});

test.test('MarkovChain should handle input shorter than ngram size', () => {
    const chain = new MarkovChain();
    chain.train('a', 3, 'char');
    
    test.assertEqual(chain.ngrams.size, 0, 'Should handle input shorter than ngram size');
});

test.test('MarkovChain should generate text with character n-grams', () => {
    const chain = new MarkovChain();
    const input = 'hello world hello there';
    chain.train(input, 2, 'char');
    
    const generated = chain.generate(10, '', 'char');
    test.assertTrue(generated.length > 0, 'Should generate text');
    test.assertTrue(typeof generated === 'string', 'Should return string');
});

test.test('MarkovChain should generate text with word n-grams', () => {
    const chain = new MarkovChain();
    const input = 'hello world hello there world test';
    chain.train(input, 2, 'word');
    
    const generated = chain.generate(5, '', 'word');
    test.assertTrue(generated.length > 0, 'Should generate text');
    test.assertTrue(typeof generated === 'string', 'Should return string');
});

test.test('MarkovChain should use provided start text when valid', () => {
    const chain = new MarkovChain();
    const input = 'hello world hello there world test';
    chain.train(input, 2, 'word');
    
    const generated = chain.generate(5, 'hello world', 'word');
    test.assertTrue(generated.startsWith('hello world'), 'Should start with provided text');
});

test.test('MarkovChain should fall back to random start when start text is invalid', () => {
    const chain = new MarkovChain();
    const input = 'hello world hello there world test';
    chain.train(input, 2, 'word');
    
    const generated = chain.generate(5, 'invalid start text that does not exist', 'word');
    test.assertTrue(generated.length > 0, 'Should still generate text');
});

test.test('MarkovChain should return error message when not trained', () => {
    const chain = new MarkovChain();
    const generated = chain.generate(10, '', 'char');
    
    test.assertEqual(generated, 'No training data available. Please provide input text.', 'Should return error message');
});

test.test('MarkovChain should provide correct statistics', () => {
    const chain = new MarkovChain();
    const input = 'hello world hello there world test';
    chain.train(input, 2, 'word');
    
    const stats = chain.getStats();
    test.assertTrue(stats.ngramCount > 0, 'Should have ngram count');
    test.assertTrue(stats.startNgramCount > 0, 'Should have start ngram count');
    test.assertTrue(stats.avgTransitions >= 0, 'Should have average transitions');
});

test.test('MarkovChain should handle different ngram sizes', () => {
    const chain = new MarkovChain();
    const input = 'hello world hello there world test hello again';
    
    // Test size 2
    chain.train(input, 2, 'word');
    test.assertEqual(chain.getNgramSize(), 2, 'Should have ngram size 2');
    
    // Test size 3
    chain.train(input, 3, 'word');
    test.assertEqual(chain.getNgramSize(), 3, 'Should have ngram size 3');
});

test.test('MarkovChain should generate text of approximately correct length', () => {
    const chain = new MarkovChain();
    const input = 'the quick brown fox jumps over the lazy dog the quick brown fox jumps over the lazy dog';
    chain.train(input, 2, 'word');
    
    const generated = chain.generate(10, '', 'word');
    const wordCount = generated.split(' ').length;
    
    // Should be close to requested length (allow some variance)
    test.assertTrue(wordCount >= 5 && wordCount <= 15, `Should generate approximately correct length. Got ${wordCount} words`);
});

// Run tests when loaded
if (typeof window !== 'undefined') {
    // Browser environment
    window.addEventListener('load', () => {
        console.log('Markov Chain Test Suite');
        console.log('======================');
        test.run();
    });
} else {
    // Node.js environment (if running with Jest)
    module.exports = { test };
}