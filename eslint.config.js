import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import html from "eslint-plugin-html"
import importPlugin from "eslint-plugin-import"

export default [
  js.configs.recommended,
  prettier,
  {
    files: ["javascript/**/*.js", "javascript/**/*.html"],
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Browser globals
        console: "readonly",
        document: "readonly",
        window: "readonly",
        URLSearchParams: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        // Chart.js
        Chart: "readonly",
        // Custom functions from your scripts
        simplify: "readonly",
        TruthTable: "readonly",
        // Node.js globals
        module: "readonly",
        require: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        // Jest globals
        jest: "readonly",
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "prefer-const": "warn",
      "no-var": "error",
      "import/no-unresolved": "off",
      "import/no-extraneous-dependencies": "off",
    },
  },
  {
    files: ["javascript/**/*.html"],
    plugins: {
      html,
    },
  },
]
