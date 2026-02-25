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
          DEFAULT: "#0a0f14",
          card: "#121a22",
          "card-hover": "#1a252e",
          "card-active": "#1f2e38",
        },
        accent: {
          DEFAULT: "#1ea84b",
          light: "#2ecc5e",
        },
        border: {
          DEFAULT: "#1e2d38",
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
