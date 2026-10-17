import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
   darkMode: "class",
   content: [
      "./app/**/*.{ts,tsx}",
      "./components/**/*.{ts,tsx}",
      "./core/**/*.{ts,tsx}",
      "./features/**/*.{ts,tsx}",
      "./lib/**/*.{ts,tsx}",
   ],
   theme: {
      extend: {
         screens: {
            xs: "400px",
         },
         colors: {
            obsidian: {
               bg: "#0d0d0d",
               card: "#141414",
               elevated: "#1c1c1c",
               subtle: "#181818",
               cardHover: "#1a1a1a",
               nested: "#292929",
               input: "#545454",
               inputBorder: "#484848",
               border: "#292929",
               borderSubtle: "#242424",
               borderLight: "#434343",
               borderHighlight: "#333333",
               text: "#f4f3f6",
               textMuted: "#d1d1d1",
               textDim: "#868686",
               serpents: {
                  bg: "#144520",
                  border: "#22c55e",
                  text: "#85ff93",
               },
               raven: {
                  bg: "#102d40",
                  border: "#3b82f6",
                  text: "#85d6ff",
               },
               purple: {
                  bg: "#230e40",
                  border: "#8b5cf6",
                  text: "#a29dae",
               },
               crimson: {
                  bg: "#401010",
                  border: "#ef4444",
                  text: "#ff5757",
               },
            },
            economy: {
               gold: "hsl(var(--economy-gold) / <alpha-value>)",
               goldLight: "hsl(var(--economy-gold-light) / <alpha-value>)",
               goldDark: "hsl(var(--economy-gold-dark) / <alpha-value>)",
               admin: "hsl(var(--economy-admin) / <alpha-value>)",
               adminHover: "hsl(var(--economy-admin-hover) / <alpha-value>)",
               credit: "hsl(var(--economy-credit) / <alpha-value>)",
               debit: "hsl(var(--economy-debit) / <alpha-value>)",
               reserved: "hsl(var(--economy-reserved) / <alpha-value>)",
               refund: "hsl(var(--economy-refund) / <alpha-value>)",
               adjustment: "hsl(var(--economy-adjustment) / <alpha-value>)",
               reversal: "hsl(var(--economy-reversal) / <alpha-value>)",
            },
            pokedex: {
               bg: "hsl(var(--pokedex-bg) / <alpha-value>)",
               card: "hsl(var(--pokedex-card) / <alpha-value>)",
               cardSubtle: "hsl(var(--pokedex-card-subtle) / <alpha-value>)",
               elevated: "hsl(var(--pokedex-elevated) / <alpha-value>)",
               inset: "hsl(var(--pokedex-inset) / <alpha-value>)",
               border: "hsl(var(--pokedex-border) / <alpha-value>)",
               borderSubtle:
                  "hsl(var(--pokedex-border-subtle) / <alpha-value>)",
               borderLight: "hsl(var(--pokedex-border-light) / <alpha-value>)",
               text: "hsl(var(--pokedex-text) / <alpha-value>)",
               textSecondary:
                  "hsl(var(--pokedex-text-secondary) / <alpha-value>)",
               textMuted: "hsl(var(--pokedex-text-muted) / <alpha-value>)",
               textDim: "hsl(var(--pokedex-text-dim) / <alpha-value>)",
               accentRose: "hsl(var(--pokedex-accent-rose) / <alpha-value>)",
               accentPurple:
                  "hsl(var(--pokedex-accent-purple) / <alpha-value>)",
               accentAmber: "hsl(var(--pokedex-accent-amber) / <alpha-value>)",
            },
            border: "hsl(var(--border))",
            input: "hsl(var(--input))",
            ring: "hsl(var(--ring))",
            background: "hsl(var(--background))",
            foreground: "hsl(var(--foreground))",
            primary: {
               DEFAULT: "hsl(var(--primary))",
               foreground: "hsl(var(--primary-foreground))",
            },
            secondary: {
               DEFAULT: "hsl(var(--secondary))",
               foreground: "hsl(var(--secondary-foreground))",
            },
            destructive: {
               DEFAULT: "hsl(var(--destructive))",
               foreground: "hsl(var(--destructive-foreground))",
            },
            muted: {
               DEFAULT: "hsl(var(--muted))",
               foreground: "hsl(var(--muted-foreground))",
            },
            accent: {
               DEFAULT: "hsl(var(--accent))",
               foreground: "hsl(var(--accent-foreground))",
            },
            popover: {
               DEFAULT: "hsl(var(--popover))",
               foreground: "hsl(var(--popover-foreground))",
            },
            card: {
               DEFAULT: "hsl(var(--card))",
               foreground: "hsl(var(--card-foreground))",
            },
         },
         fontFamily: {
            sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
            display: ["var(--font-display)", "Outfit", "Inter", "sans-serif"],
         },
         borderRadius: {
            lg: "var(--radius)",
            md: "calc(var(--radius) - 2px)",
            sm: "calc(var(--radius) - 4px)",
            "2xl": "1rem",
            "3xl": "1.5rem",
         },
         boxShadow: {
            obsidian:
               "0 8px 30px -4px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
         },
      },
   },
   plugins: [tailwindcssAnimate],
};

export default config;
