/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00DC82',
          dark: '#00C16A',
        },
      },
      // VisionHR (Tailwind v4 numeric scale) parity for classes like w-125, max-w-100
      spacing: {
        100: '25rem',
        125: '31.25rem',
      },
      maxWidth: {
        100: '25rem',
        125: '31.25rem',
      },
    },
  },
  plugins: [],
}
