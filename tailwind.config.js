module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FAF5FC',
          100: '#F3E8FA',
          200: '#E7D1F4',
          300: '#D5AEEA',
          400: '#B87BD9',
          500: '#944DBF',
          600: '#723795',
          700: '#522D60', // Primary Brand Color
          800: '#42244D',
          900: '#2E1836',
          950: '#1A0D1F',
          DEFAULT: '#522D60',
        },
        primary: {
          50:  '#FAF5FC',
          100: '#F3E8FA',
          200: '#E7D1F4',
          300: '#D5AEEA',
          400: '#B87BD9',
          500: '#944DBF',
          600: '#723795',
          700: '#522D60',
          800: '#42244D',
          900: '#2E1836',
          950: '#1A0D1F',
          DEFAULT: '#522D60',
        },
        forest: {
          light: '#6D3C80',
          DEFAULT: '#522D60',
          dark: '#3E2149',
          darker: '#26142D',
        },
        obsidian: {
          light: '#2E1836',
          DEFAULT: '#1A0D1F',
          dark: '#120816',
          darker: '#0A040D',
        },
        accent: {
          emerald: '#10B981',
          rose: '#F43F5E',
          plum: '#522D60',
          amber: '#F59E0B',
          blue: '#3B82F6',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#FAFAFC',
          3: '#F4F4F6',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      boxShadow: {
        'card': '0 2px 14px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 8px 24px rgba(82, 45, 96, 0.08)',
        'glow-plum': '0 0 28px rgba(82, 45, 96, 0.4)',
        'glass-nav': '0 10px 30px -5px rgba(82, 45, 96, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.12)',
      },
    },
  },
  plugins: [],
};
