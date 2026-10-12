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
         colors: {
            obsidian: {
               bg: "#0d0d0d",
               card: "#141414",
               elevated: "#1c1c1c",
               nested: "#292929",
               input: "#545454",
               inputBorder: "#484848",
               border: "#292929",
               borderLight: "#434343",
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
