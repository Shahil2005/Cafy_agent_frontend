/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cafy: {
          50: '#eef3ff',
          100: '#dce8ff',
          200: '#b9d1ff',
          300: '#8eb8f7',
          400: '#5c8ef5',
          500: '#1a56db',
          600: '#1955da',
          700: '#1950aa',
          800: '#193c84',
          900: '#142f6b',
          950: '#0f2550',
        },
      },
      fontFamily: {
        sans: ["DM Sans", "Inter", "sans-serif"],
        inter: ["DM Sans", "Inter", "sans-serif"],
        poppins: ["Poppins", "sans-serif"],
      },
    },
  },
  plugins: [],
};
