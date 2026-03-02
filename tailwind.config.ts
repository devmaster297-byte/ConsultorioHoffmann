// tailwind.config.ts
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
        hf: {
          black:       '#0F0F0F',
          'black-soft':'#1A1A1A',
          charcoal:    '#2C2C2C',
          gold:        '#C9A96E',
          'gold-light':'#E8D5B0',
          'gold-pale': '#F5EDD8',
          cream:       '#FAF8F4',
          white:       '#FFFFFF',
          100:         '#F4F2EE',
          200:         '#E8E4DC',
          300:         '#C8C2B4',
          400:         '#9A9286',
          500:         '#6B6359',
        },
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'hf-sm':  '0 1px 3px 0 rgba(15,15,15,0.06), 0 1px 2px -1px rgba(15,15,15,0.04)',
        'hf-md':  '0 4px 12px -2px rgba(15,15,15,0.08), 0 2px 6px -2px rgba(15,15,15,0.04)',
        'hf-lg':  '0 12px 32px -4px rgba(15,15,15,0.12), 0 4px 12px -4px rgba(15,15,15,0.06)',
        'hf-gold':'0 4px 16px -4px rgba(201,169,110,0.30)',
      },
      borderRadius: {
        'hf': '12px',
        'hf-lg': '16px',
        'hf-xl': '20px',
      },
    },
  },
  plugins: [],
}

export default config