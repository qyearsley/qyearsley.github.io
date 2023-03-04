module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["eslint:recommended", "prettier"],
  overrides: [],
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {},
  plugins: ["html"],
  globals: {
    "expect": "readonly",
    "require": "readonly",
    "test": "readonly"
  }
}
