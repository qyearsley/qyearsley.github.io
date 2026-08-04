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
  fetch: "readonly",
  FormData: "readonly",
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
}

// Globals exposed by specific page scripts (not browser built-ins)
const pageScriptGlobals = {
  Chart: "readonly", // Chart.js, loaded via CDN in coin-flipper.html and series-tester.html
  TruthTable: "readonly", // declared in javascript/truthtable.js, used in truth-tables.html
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
      // jestGlobals are included here because *.test.js files coexist with
      // source files under shared/, javascript/, and games/ rather than
      // being isolated in a tests/ directory.
      globals: {
        ...browserGlobals,
        ...pageScriptGlobals,
        ...jestGlobals,
        getComputedStyle: "readonly",
      },
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
    // Walks the source tree (node) and parses pages via DOMParser (jsdom).
    files: ["__tests__/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { console: "readonly", process: "readonly", DOMParser: "readonly" },
    },
    rules: sharedRules,
  },
  {
    files: ["**/*.test.js"],
    languageOptions: {
      globals: { ...jestGlobals, global: "readonly" },
    },
  },
]
