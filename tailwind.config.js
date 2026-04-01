import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./views/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./plugins/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: ["dracula", "nord", "light", "dark"],
    base: true, // DaisyUI base styles re-enabled
    styled: true, // DaisyUI component styles
    utils: true, // DaisyUI utility classes
    prefix: "", // No prefix
    logs: true, // Logs in console
    themeRoot: ":root", // Theme root
  },
};
