/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Salesforce-inspired color palette
        'sf-blue': {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffd',
          300: '#7cc6fb',
          400: '#36a9f7',
          500: '#0c8ce9', // Primary Salesforce blue
          600: '#006fcc',
          700: '#0058a6',
          800: '#034a89',
          900: '#083e71',
        },
        // Diff highlighting colors
        'diff-added': '#dcfce7',
        'diff-removed': '#fee2e2',
        'diff-changed': '#fef9c3',
        'diff-added-border': '#86efac',
        'diff-removed-border': '#fca5a5',
        'diff-changed-border': '#fde047',
      },
    },
  },
  plugins: [],
}
