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
    expect: true,
    require: true,
    test: true,
    module: true,
    describe: true,
    Graph: true,
  },
}
