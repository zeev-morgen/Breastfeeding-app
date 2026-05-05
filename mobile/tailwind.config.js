/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F4ECE2',
          100: '#FBF6EE',
          200: '#EAD0BF',
          400: '#D9906A',
          500: '#C76A4A',
          600: '#C76A4A',
          700: '#2B1F1A',
        },
        sage: {
          100: '#D9DFCE',
          200: '#C5CFB8',
          500: '#7A8C6F',
          600: '#5E6F55',
        },
      },
    },
  },
  plugins: [],
};
