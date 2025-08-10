/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        success: '#16a34a',
        running: '#3b82f6',
        pending: '#9ca3af',
        error: '#ef4444'
      }
    },
  },
  plugins: [],
}
