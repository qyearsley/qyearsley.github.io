module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.js"],
  silent: true, // Suppress console output during tests
  collectCoverageFrom: [
    "shared/**/*.js",
    "javascript/**/*.js",
    "games/number-garden/**/*.js",
    "games/turing-tape/**/*.js",
    "games/life-garden/**/*.js",
    "games/shared/**/*.js",
    "!shared/**/*.test.js",
    "!javascript/**/*.test.js",
    "!games/number-garden/**/*.test.js",
    "!games/turing-tape/**/*.test.js",
    "!games/life-garden/**/*.test.js",
    "!games/shared/**/*.test.js",
    "!javascript/**/*.html",
    "!games/number-garden/**/*.html",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  transform: {},
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
}
