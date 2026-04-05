/** @type {import('tailwindcss').Config} */
export default {
  // Tell Tailwind to scan all React component files for classes
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}