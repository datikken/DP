/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,html}'],
  theme: {
    extend: {
      colors: {
        base: {
          900: '#1e1e2f',
          800: '#25253a',
          700: '#2d2d44',
          600: '#3a3a55',
        },
        brand: {
          DEFAULT: '#6c5ce7',
          dark: '#5a4bd4',
          light: '#a29bfe',
        },
      },
    },
  },
  plugins: [],
};
