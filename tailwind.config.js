/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        iron: {
          light: '#fed7aa',
          DEFAULT: '#f97316',
          dark: '#c2410c',
        },
        fish: {
          light: '#bae6fd',
          DEFAULT: '#0ea5e9',
          dark: '#0369a1',
        },
        legume: {
          light: '#bbf7d0',
          DEFAULT: '#22c55e',
          dark: '#15803d',
        },
        veggie: {
          light: '#d9f99d',
          DEFAULT: '#84cc16',
          dark: '#4d7c0f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
