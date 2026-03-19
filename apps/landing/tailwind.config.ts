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
    extend: {
      animation: {
        "pulse-slow":    "pulse 6s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-in":       "fadeIn 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in-fast":  "fadeIn 0.4s cubic-bezier(0.16,1,0.3,1) both",
        "slide-up":      "slideUp 0.8s cubic-bezier(0.16,1,0.3,1) both",
        "slide-up-sm":   "slideUpSm 0.6s cubic-bezier(0.16,1,0.3,1) both",
        glow:            "glow 3s ease-in-out infinite alternate",
        "bounce-gentle": "bounceGentle 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:       { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideUp:      { "0%": { opacity: "0", transform: "translateY(40px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideUpSm:    { "0%": { opacity: "0", transform: "translateY(20px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        glow:         { "0%": { opacity: "0.4", transform: "scale(1)" }, "100%": { opacity: "0.7", transform: "scale(1.1)" } },
        bounceGentle: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(8px)" } },
      },
    },
  },
  plugins: [],
};

export default config;
