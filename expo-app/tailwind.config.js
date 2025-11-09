/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}','./app/**/*.{js,jsx,ts,tsx}',"./src/**/*.{js,jsx,ts,tsx}", "./src/**/**/*.{js,jsx,ts,tsx}"],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          300: '#A78BFA',
          500: '#7C3AED',
          600: '#6D28D9',
        },
      },
      borderRadius: {
        '2xl': 16,
        '3xl': 24,
      },
      boxShadow: {
        lg: '0 10px 30px rgba(12,8,30,0.6)',
      },
    },
  },
  plugins: [],
};
