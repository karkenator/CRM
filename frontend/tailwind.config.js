export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#399BDB',
          light:   '#E9F4FB',
          dark:    '#2A82BF',
        },
        sidebar: {
          bg:          '#FFFFFF',
          border:      '#F0F0F0',
          'item-text': '#111827',
          'item-icon': '#9CA3AF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle:  '#F9FAFB',
          border:  '#E5E7EB',
        },
        // Legacy tokens kept for pages not yet migrated
        primary: {
          DEFAULT: '#399BDB',
          light:   '#E9F4FB',
          dark:    '#2A82BF',
        },
        dark: {
          DEFAULT: '#020203',
          light:   '#1A1A1A',
          lighter: '#2A2A2A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}
