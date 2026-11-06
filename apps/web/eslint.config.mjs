import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
   ...nextVitals,
   {
      rules: {
         // New in eslint-config-next@16 (React Hooks v6). These flag
         // pre-existing patterns across the app; defer to a dedicated
         // refactor ticket rather than expanding the migration scope.
         "react-hooks/set-state-in-effect": "off",
         "react-hooks/purity": "off",
         "react-hooks/refs": "off",
         "react-hooks/immutability": "off",
         "no-restricted-syntax": [
            "error",
            {
               selector:
                  "Literal[value=/\\b(?:bg|text|border|from|to|via|ring|shadow|fill|stroke|divide|outline|decoration|placeholder|caret|accent)-\\[#[0-9a-fA-F]{3,8}\\]/]",
               message:
                  "Raw hex colour: use a semantic/component token (DESIGN.md §2).",
            },
            {
               selector:
                  "JSXAttribute[name.name=/^(?:fill|stroke|color)$/] Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
               message:
                  "Raw hex in an SVG/style attribute: use var(--color-*) or currentColor.",
            },
            {
               selector: "Literal[value=/var\\(--primitive-/]",
               message:
                  "Primitive tokens are private: use a semantic/component token.",
            },
            {
               selector: "Literal[value=/\\bobsidian-[a-zA-Z0-9-]+/]",
               message:
                  "Legacy obsidian-* token removed: use a semantic token.",
            },
            {
               selector: "Literal[value=/\\btext-\\[[0-9.]+px\\]/]",
               message:
                  "Arbitrary font size: use a typography token (text-meta, text-label, text-caption, text-body, text-display-*).",
            },
            {
               selector:
                  "Literal[value=/(?:min-h|h|min-w|max-w)-\\[(?:44|50|74|170|200|240|400|620|840)px\\]/]",
               message:
                  "Arbitrary size: use a sizing token (control-sm/md/lg, dropdown-min, artwork-*, panel-*).",
            },
         ],
      },
   },
   prettier,
   globalIgnores([
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "prototype/**",
   ]),
]);
