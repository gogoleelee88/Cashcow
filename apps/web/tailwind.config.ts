import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // crack.wrtn.ai exact color palette — WHITE theme, RED accent
        background: {
          DEFAULT: '#FFFFFF',
          secondary: '#F7F7F9',
          tertiary: '#F0F0F3',
          elevated: '#FFFFFF',
        },
        surface: {
          DEFAULT: '#F5F5F7',
          hover: '#EBEBEE',
          active: '#E3E3E8',
          border: '#E0E0E5',
        },
        brand: {
          DEFAULT: '#00D96B',
          hover: '#00C260',
          light: '#1AFF82',
          dark: '#00A855',
          glow: 'rgba(0, 217, 107, 0.3)',
        },
        accent: {
          pink: '#FF6B9D',
          cyan: '#00B4D8',
          emerald: '#10b981',
          amber: '#F59E0B',
          rose: '#FF6B6B',
          purple: '#7C5CFC',
        },
        text: {
          primary: '#111111',
          secondary: '#555555',
          muted: '#888888',
          disabled: '#BBBBBB',
        },
        border: {
          DEFAULT: '#E0E0E5',
          subtle: '#EBEBEE',
          strong: '#CCCCCC',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'brand-gradient': 'linear-gradient(135deg, #00D96B 0%, #00B4D8 100%)',
        'card-gradient': 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7) 100%)',
        'hero-gradient': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,217,107,0.1), transparent)',
        'sidebar-gradient': 'linear-gradient(180deg, #F7F7F9 0%, #FFFFFF 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'typing': 'typing 1s steps(3) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideLeft: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(0,217,107,0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(0,217,107,0.5)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        typing: {
          '0%, 100%': { content: '.' },
          '33%': { content: '..' },
          '66%': { content: '...' },
        },
      },
      boxShadow: {
        'brand': '0 0 15px rgba(0,217,107,0.3)',
        'card': '0 2px 12px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,217,107,0.2)',
        'inner-border': 'inset 0 0 0 1px rgba(0,0,0,0.06)',
        'glow-red': '0 0 20px rgba(0,217,107,0.4)',
        'nav': '0 2px 8px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
