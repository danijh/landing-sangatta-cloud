/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0D233A',
        teal: '#2F8D83',
        mist: '#b7b6b6',
        ember: '#d8570a',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 18px 60px rgba(13, 35, 58, 0.08)',
      },
    },
  },
  plugins: [],
}
