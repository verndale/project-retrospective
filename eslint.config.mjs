import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "scripts/tests/fixtures/**",
      "scripts/graph/viewer/vendor/**",
      "scripts/graph/data/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,cjs,mjs}"],
    ignores: ["scripts/graph/viewer/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
  },
  {
    files: ["scripts/graph/viewer/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        Sigma: "readonly",
        graphology: "readonly",
        graphologyLibrary: "readonly",
      },
    },
  },
];
