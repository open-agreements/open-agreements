/** @type {import('tailwindcss').Config} */
export default {
  content: ["site/**/*.{njk,md}"],
  theme: {
    extend: {
      colors: {
        bg: "#f5f0e8",
        ink: "#142023",
        "ink-soft": "#334348",
        card: "#fff8ee",
        line: "#d2c2ae",
        accent: "#be4b2f",
        "accent-deep": "#953118",
        "accent-soft": "#f9dac5",
      },
      fontFamily: {
        serif: ['"Fraunces"', "serif"],
        sans: ['"IBM Plex Sans"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
