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
        // crack.wrtn.ai exact color palette
        background: {
          DEFAULT: '#0d0b18',   // Main background
          secondary: '#12101f', // Cards, sidebars
          tertiary: '#1a1729',  // Hover states
          elevated: '#201d33',  // Modals, dropdowns
        },
        surface: {
          DEFAULT: '#1a1729',
          hover: '#221f38',
          active: '#2a2745',
          border: '#2d2a4a',
        },
        brand: {
          DEFAULT: '#7c5cfc',  // Primary purple
          hover: '#8f72fd',
          light: '#a590fd',
          dark: '#6240fb',
          glow: 'rgba(124, 92, 252, 0.4)',
        },
        accent: {
          pink: '#e879f9',
          cyan: '#22d3ee',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#fb7185',
        },
        text: {
          primary: '#f0ecff',
          secondary: '#b8b0d8',
          muted: '#7b7299',
          disabled: '#3d3a5c',
        },
        border: {
          DEFAULT: '#2d2a4a',
          subtle: '#1e1c30',
          strong: '#3d3a5c',
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
        'brand-gradient': 'linear-gradient(135deg, #7c5cfc 0%, #e879f9 100%)',
        'card-gradient': 'linear-gradient(180deg, transparent 40%, rgba(13,11,24,0.95) 100%)',
        'hero-gradient': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124,92,252,0.3), transparent)',
        'sidebar-gradient': 'linear-gradient(180deg, #12101f 0%, #0d0b18 100%)',
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
          '0%, 100%': { boxShadow: '0 0 20px rgba(124,92,252,0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(124,92,252,0.7)' },
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
        'brand': '0 0 20px rgba(124,92,252,0.4)',
        'card': '0 4px 24px rgba(0,0,0,0.5)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,92,252,0.3)',
        'inner-border': 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        'glow-pink': '0 0 20px rgba(232,121,249,0.4)',
        'glow-cyan': '0 0 20px rgba(34,211,238,0.4)',
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
