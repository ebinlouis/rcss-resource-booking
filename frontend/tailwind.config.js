import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "outline": "#6f7a71",
        "surface-container-low": "#f1f5ee",
        "surface-container-high": "#e5e9e3",
        "surface-container": "#ebefe9",
        "on-error-container": "#93000a",
        "secondary-fixed-dim": "#c0c6db",
        "on-secondary-container": "#5c6274",
        "surface-variant": "#dfe4dd",
        "on-primary-fixed-variant": "#00522f",
        "on-primary-fixed": "#002110",
        "secondary-fixed": "#dce2f7",
        "surface-bright": "#f6fbf4",
        "on-error": "#ffffff",
        "secondary": "#575e70",
        "tertiary": "#81333a",
        "on-secondary-fixed-variant": "#404758",
        "on-tertiary": "#ffffff",
        "inverse-on-surface": "#eef2eb",
        "primary-container": "#157347",
        "on-surface": "#181d19",
        "inverse-primary": "#82d8a3",
        "surface-dim": "#d7dbd5",
        "surface-container-highest": "#dfe4dd",
        "on-tertiary-container": "#ffd9da",
        "on-surface-variant": "#3f4941",
        "on-tertiary-fixed": "#3f020c",
        "tertiary-fixed": "#ffdada",
        "primary": "#005934",
        "primary-fixed": "#9ef5be",
        "tertiary-fixed-dim": "#ffb3b5",
        "surface": "#f6fbf4",
        "inverse-surface": "#2d322d",
        "on-primary-container": "#9ef5be",
        "surface-tint": "#076c41",
        "background": "#f6fbf4",
        "tertiary-container": "#9f4a50",
        "on-primary": "#ffffff",
        "outline-variant": "#bec9bf",
        "on-background": "#181d19",
        "on-tertiary-fixed-variant": "#7a2d34",
        "error-container": "#ffdad6",
        "primary-fixed-dim": "#82d8a3",
        "on-secondary": "#ffffff",
        "error": "#ba1a1a",
        "secondary-container": "#d9dff5",
        "surface-container-lowest": "#ffffff",
        "on-secondary-fixed": "#141b2b"
      },
      fontFamily: {
        "geist": ["Geist", "sans-serif"],
      }
    },
  },
  plugins: [
    forms,
    containerQueries,
  ],
}