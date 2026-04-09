import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Neumorphism Warm Cream Theme
        neu: {
          bg: '#F5F0E8',
          'bg-alt': '#EBE4D8',
          'shadow-dark': '#D4CEC2',
          'shadow-light': '#FFFFFF',
        },
        primary: {
          50: '#FDF5ED',
          100: '#FBEAD8',
          200: '#F7D4B1',
          300: '#F09856',
          400: '#E07B39',
          500: '#C46A2E',
          600: '#A85A28',
          700: '#8C4A22',
          800: '#703B1B',
          900: '#542C14',
        },
        accent: {
          50: '#FBF7ED',
          100: '#F5ECDA',
          200: '#E5C17A',
          300: '#D4A853',
          400: '#B8903D',
          500: '#9A7832',
        },
        secondary: {
          50: '#E8F5F1',
          100: '#D1EBE4',
          200: '#4DB89E',
          300: '#2D9B83',
          400: '#1F7A66',
          500: '#165A4A',
        },
      },
      boxShadow: {
        'neu': '5px 5px 10px #D4CEC2, -5px -5px 10px #FFFFFF',
        'neu-sm': '3px 3px 6px #D4CEC2, -3px -3px 6px #FFFFFF',
        'neu-inset': 'inset 3px 3px 6px #D4CEC2, inset -3px -3px 6px #FFFFFF',
        'neu-pressed': 'inset 2px 2px 4px #D4CEC2, inset -2px -2px 4px #FFFFFF',
      },
      borderRadius: {
        'neu': '16px',
        'neu-lg': '24px',
      },
    },
  },
  plugins: [],
}
export default config
