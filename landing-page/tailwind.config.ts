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
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#dc2626',
        info: '#3b82f6',
      },
      backgroundImage: {
        'hero-grid':
          'linear-gradient(to right, rgba(37, 99, 235, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(37, 99, 235, 0.08) 1px, transparent 1px), radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.18), transparent 28%), radial-gradient(circle at 85% 15%, rgba(6, 182, 212, 0.18), transparent 30%)',
      },
      backgroundSize: {
        'hero-grid': '44px 44px, 44px 44px, auto, auto',
      },
      boxShadow: {
        soft: '0 20px 70px -35px rgba(15, 23, 42, 0.35)',
        blue: '0 18px 45px -24px rgba(37, 99, 235, 0.65)',
      },
    },
  },
  plugins: [],
}

export default config
