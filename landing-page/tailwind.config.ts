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
          300: '#E5C17A',
          400: '#D4A853',
          500: '#B8903D',
        },
        secondary: {
          300: '#4DB89E',
          400: '#2D9B83',
          500: '#1F7A66',
        },
        cream: {
          50: '#FDFBF7',
          100: '#F5F0E8',
          200: '#EBE4D8',
          300: '#D9D0C1',
        },
        glass: {
          light: 'rgba(253, 251, 247, 0.25)',
          dark: 'rgba(44, 36, 24, 0.1)',
          border: 'rgba(212, 168, 83, 0.3)',
        },
      },
      backgroundImage: {
        'aurora': 'linear-gradient(135deg, #E07B39 0%, #D4A853 25%, #F09856 50%, #C46A2E 75%, #E07B39 100%)',
        'aurora-light': 'linear-gradient(135deg, rgba(224, 123, 57, 0.4) 0%, rgba(212, 168, 83, 0.4) 50%, rgba(196, 106, 46, 0.4) 100%)',
        'mesh-gradient': 'radial-gradient(at 40% 20%, hsla(25,75%,55%,0.3) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(40,60%,58%,0.3) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(168,55%,40%,0.3) 0px, transparent 50%), radial-gradient(at 80% 50%, hsla(30,70%,50%,0.3) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(45,55%,55%,0.3) 0px, transparent 50%), radial-gradient(at 80% 100%, hsla(20,65%,52%,0.3) 0px, transparent 50%)',
      },
      animation: {
        'aurora': 'aurora 15s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        aurora: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(224, 123, 57, 0.4)' },
          '100%': { boxShadow: '0 0 40px rgba(224, 123, 57, 0.8)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(44, 36, 24, 0.12)',
        'glass-lg': '0 25px 50px -12px rgba(44, 36, 24, 0.2)',
        'glow': '0 0 40px rgba(224, 123, 57, 0.4)',
        'glow-lg': '0 0 60px rgba(224, 123, 57, 0.6)',
      },
    },
  },
  plugins: [],
}
export default config
