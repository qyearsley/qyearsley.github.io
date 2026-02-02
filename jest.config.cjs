module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.js"],
  silent: true, // Suppress console output during tests
  collectCoverageFrom: [
    "javascript/**/*.js",
    "games/number-garden/**/*.js",
    "!javascript/**/*.test.js",
    "!games/number-garden/**/*.test.js",
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
