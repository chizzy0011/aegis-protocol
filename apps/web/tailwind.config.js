/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        aegis: {
          dark: '#07090E',
          card: '#0D111A',
          border: '#1E2638',
          gold: '#E5A93C',
          blue: '#2563EB',
          accent: '#38BDF8',
        },
      },
    },
  },
  plugins: [],
};
