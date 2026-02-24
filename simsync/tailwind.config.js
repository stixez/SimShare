/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    "bg-accent-light",
    "bg-status-green",
    "bg-status-yellow",
    "bg-status-red",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0c0e14",
          card: "#151822",
          "card-hover": "#1c2030",
          "card-active": "#232840",
        },
        accent: {
          DEFAULT: "#6366f1",
          light: "#818cf8",
        },
        border: {
          DEFAULT: "#252a3a",
        },
        txt: {
          DEFAULT: "#e8ecf4",
          dim: "#7a8398",
        },
        status: {
          green: "#10b981",
          yellow: "#f59e0b",
          red: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
