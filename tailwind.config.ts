import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: "#E9E2D8",
        ivory: "#F8F6F2",
        taupe: "#B6A999",
        sage: "#C9D2C0",
        "dark-sage": "#B7C8B1",
        "sage-dark": "#9FAA9A",
        "sage-light": "#D5DFD0",
        charcoal: "#3F3A37",
        "warm-gray": "#6B635B",
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['48px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'h1': ['40px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'h2': ['32px', { lineHeight: '1.3' }],
        'h3': ['24px', { lineHeight: '1.4' }],
        'body': ['16px', { lineHeight: '1.6' }],
      },
          spacing: {
            'section-mobile': '20px',
            'section-desktop': '30px',
          },
    },
  },
  plugins: [],
};

export default config;

