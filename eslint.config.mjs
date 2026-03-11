import { createRequire } from "node:module";

const require = createRequire(new URL("./src/apps/desktop/package.json", import.meta.url));
const js = require("@eslint/js");
const eslintConfigPrettier = require("eslint-config-prettier");
const reactHooks = require("eslint-plugin-react-hooks");
const globals = require("globals");
const tseslint = require("typescript-eslint");

const allSourceFiles = ["**/*.{js,mjs,cjs,ts,tsx}"];
const browserFiles = [
  "src/apps/desktop/src/renderer/**/*.{ts,tsx}",
  "src/apps/desktop/src/shared/meeting-room-client.ts",
  "src/apps/web/src/**/*.{ts,tsx}"
];
const nodeFiles = [
  "e2e/**/*.{js,mjs,cjs}",
  "scripts/**/*.{js,mjs,cjs}",
  "src/daemon/**/*.ts",
  "src/packages/**/*.ts",
  "src/apps/desktop/src/main/**/*.ts",
  "src/apps/desktop/vite.config.ts"
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      ".claude/agent-teams-log/**",
      ".claude/meeting-room/**",
      ".serena/**",
      "src/apps/desktop/dist/**",
      "src/apps/web/client/**",
      "src/apps/web/share-client/**",
      "src/daemon/dist/**"
    ]
  },
  {
    files: allSourceFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_"
        }
      ],
      "no-console": "off"
    }
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off"
    }
  },
  {
    files: browserFiles,
    plugins: {
      "react-hooks": reactHooks
    },
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      ...reactHooks.configs.recommended.rules
    }
  },
  {
    files: nodeFiles,
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ["src/daemon/src/runtime/terminal-utils.ts"],
    rules: {
      "no-control-regex": "off"
    }
  },
  eslintConfigPrettier
);
