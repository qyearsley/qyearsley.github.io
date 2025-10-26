module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.js"],
  collectCoverageFrom: ["javascript/**/*.js", "!javascript/**/*.test.js", "!javascript/**/*.html"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
}
