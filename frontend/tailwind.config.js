/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        skyhawk: {
          50: '#e8f0f9',
          100: '#c5d8f0',
          200: '#9fbde6',
          300: '#78a2db',
          400: '#5b8fd4',
          500: '#3d7ccc',
          600: '#3370c0',
          700: '#2560b1',
          800: '#1a50a2',
          900: '#0a3485',
        },
      },
    },
  },
  plugins: [],
};
