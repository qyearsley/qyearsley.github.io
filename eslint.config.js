import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import html from "eslint-plugin-html"
import importPlugin from "eslint-plugin-import"

const browserGlobals = {
  console: "readonly",
  document: "readonly",
  window: "readonly",
  location: "readonly",
  atob: "readonly",
  btoa: "readonly",
  confirm: "readonly",
  alert: "readonly",
  prompt: "readonly",
  URLSearchParams: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  localStorage: "readonly",
  Storage: "readonly",
  Event: "readonly",
  KeyboardEvent: "readonly",
  MouseEvent: "readonly",
  HTMLElement: "readonly",
  HTMLInputElement: "readonly",
  HTMLButtonElement: "readonly",
  Chart: "readonly",
  simplify: "readonly",
  TruthTable: "readonly",
}

const jestGlobals = {
  jest: "readonly",
  describe: "readonly",
  it: "readonly",
  test: "readonly",
  expect: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  afterAll: "readonly",
}

const sharedRules = {
  "no-unused-vars": ["warn", { caughtErrors: "none", argsIgnorePattern: "^_" }],
  "prefer-const": "warn",
  "no-var": "error",
}

export default [
  {
    ignores: ["coverage/", "node_modules/", "dist/"],
  },
  js.configs.recommended,
  prettier,
  {
    files: [
      "javascript/**/*.js",
      "javascript/**/*.html",
      "games/**/*.js",
      "games/**/*.html",
      "shared/**/*.js",
    ],
    plugins: {
      import: importPlugin,
      html,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...browserGlobals, ...jestGlobals, getComputedStyle: "readonly" },
    },
    rules: {
      ...sharedRules,
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "import/no-unresolved": "error",
    },
  },
  {
    files: ["build.js", "build.test.js"],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
    rules: {
      ...sharedRules,
      "import/no-unresolved": "error",
    },
  },
  {
    files: ["**/*.test.js"],
    languageOptions: {
      globals: { ...jestGlobals, global: "readonly" },
    },
  },
]
