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
          teal: '#0d7663', // Main brand color based on the image (Dashboard button)
          light: '#e8f5f3',
        }
      }
    },
  },
  plugins: [],
}
