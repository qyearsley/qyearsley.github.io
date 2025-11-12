module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.js"],
  collectCoverageFrom: [
    "javascript/**/*.js",
    "netguard/**/*.js",
    "!javascript/**/*.test.js",
    "!netguard/**/*.test.js",
    "!javascript/**/*.html",
    "!netguard/**/*.html",
    "!netguard/game.js.backup",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  transform: {},
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
}


