import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Arial', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.01em' }],
        xl: ['clamp(1.125rem, 1.05rem + 0.3vw, 1.25rem)', { lineHeight: '1.35', letterSpacing: '-0.015em' }],
        '2xl': ['clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
        '3xl': ['clamp(1.5rem, 1.3rem + 0.8vw, 1.875rem)', { lineHeight: '1.2', letterSpacing: '-0.025em' }],
      },
      colors: {
        // Fluent-inspired enterprise palette. `neu` is retained for existing class compatibility.
        neu: { bg: '#F4F6F9', 'bg-alt': '#FFFFFF', 'shadow-dark': '#CFD7E3', 'shadow-light': '#FFFFFF' },
        surface: { DEFAULT: '#FFFFFF', subtle: '#F8FAFC', hover: '#F1F5F9' },
        line: { DEFAULT: '#E3E8EF', strong: '#CFD7E3', input: '#B9C3D0' },
        ink: { DEFAULT: '#131A26', soft: '#5A6675', muted: '#8593A4' },
        danger: { DEFAULT: '#C4314B', soft: '#FDF3F4' },
        warning: { DEFAULT: '#9A6700', soft: '#FFF8E6' },
        success: { DEFAULT: '#107C41', soft: '#EDF7F0' },
        primary: {
          50: '#EFF6FC', 100: '#DEECF9', 200: '#C7E0F4', 300: '#71AFE5', 400: '#2B88D8',
          500: '#0F6CBD', 600: '#115EA3', 700: '#0F548C', 800: '#0C3B5E', 900: '#092C47',
        },
        accent: { 50: '#EFF6FC', 100: '#DEECF9', 200: '#C7E0F4', 300: '#71AFE5', 400: '#2B88D8', 500: '#0F6CBD' },
        // Older JSX uses orange utility names; map them to the enterprise brand palette.
        orange: { 50: '#EFF6FC', 100: '#DEECF9', 200: '#C7E0F4', 300: '#71AFE5', 400: '#2B88D8', 500: '#0F6CBD', 600: '#115EA3', 700: '#0F548C', 800: '#0C3B5E', 900: '#092C47' },
        secondary: { 50: '#EAF6EE', 100: '#D3F0DD', 200: '#54B471', 300: '#107C41', 400: '#0B6A35', 500: '#095C2E' },
      },
      boxShadow: {
        neu: '0 1px 2px rgba(19, 26, 38, 0.05)',
        'neu-sm': 'none',
        'neu-inset': 'none',
        'neu-pressed': 'none',
        card: '0 1px 2px rgba(19, 26, 38, 0.05)',
        raised: '0 2px 4px rgba(19, 26, 38, 0.06), 0 1px 2px rgba(19, 26, 38, 0.04)',
        overlay: '0 12px 28px -8px rgba(19, 26, 38, 0.18), 0 4px 10px -4px rgba(19, 26, 38, 0.10)',
      },
      borderRadius: { neu: '8px', 'neu-lg': '12px' },
      transitionTimingFunction: { enter: 'cubic-bezier(.2,0,.2,1)' },
    },
  },
  plugins: [],
}
export default config
