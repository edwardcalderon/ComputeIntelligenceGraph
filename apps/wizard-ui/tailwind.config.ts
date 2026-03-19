import type { Config } from "tailwindcss";
import cigPreset from "@cig/ui/tailwind-preset";

const config: Config = {
  presets: [cigPreset],
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
