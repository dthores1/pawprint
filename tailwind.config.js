/** @type {import('tailwindcss').Config} */
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lato', 'sans-serif'],
        heading: ['Nunito Sans', 'sans-serif'],
      },
      colors: {
        background: '#F1EEE8',
        card: '#FFFFFF',
        border: '#DDD9D1',
        text: {
          primary: '#2B2B2B',
          secondary: '#6B6B6B',
        },
        primary: {
          DEFAULT: '#2E6F68',
          hover: '#255A54',
        },
        secondary: {
          DEFAULT: '#D98C5F',
        },
        accent: {
          DEFAULT: '#F3E4D7',
        },
        status: {
          adoptable: { bg: '#DDEFE2', text: '#3E7B52' },
          medical: { bg: '#F8E7C8', text: '#A36B00' },
          hold: { bg: '#E8DEEC', text: '#6E4E80' },
          urgent: { bg: '#F5D7D7', text: '#9B3A3A' },
          fostered: { bg: '#DCEAF7', text: '#356A9A' },
          intake: { bg: '#E5E2DC', text: '#6B6B6B' },
          adopted: { bg: '#F3E4D7', text: '#D98C5F' },
          hospice: { bg: '#EDE0DA', text: '#7C4A3D' },
          deceased: { bg: '#E0E0E0', text: '#555555' },
        }
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
        'soft-lg': '0 4px 24px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        '2xl': '20px',
      }
    },
  },
  plugins: [],
}