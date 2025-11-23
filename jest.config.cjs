module.exports = {
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.js"],
  silent: true, // Suppress console output during tests
  collectCoverageFrom: [
    "javascript/**/*.js",
    "games/netguard/**/*.js",
    "games/enchanted-garden/**/*.js",
    "!javascript/**/*.test.js",
    "!games/netguard/**/*.test.js",
    "!games/enchanted-garden/**/*.test.js",
    "!javascript/**/*.html",
    "!games/netguard/**/*.html",
    "!games/enchanted-garden/**/*.html",
    "!games/netguard/game.js.backup",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  transform: {},
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
}
