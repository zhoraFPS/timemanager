module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        foreground: "#fafafa",
        card: "#1c1c1e",
        "card-foreground": "#fafafa",
        primary: "#3b82f6",
        "primary-foreground": "#fafafa",
        secondary: "#27272a",
        "secondary-foreground": "#fafafa",
        muted: "#27272a",
        "muted-foreground": "#a1a1aa",
        destructive: "#ef4444",
        success: "#22c55e",
        border: "#27272a",
      },
    },
  },
  plugins: [],
};
