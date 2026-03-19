// @cig/ui — Tailwind CSS v3 preset
// Import in any CIG app's tailwind.config.ts:
//   import cigPreset from '@cig/ui/tailwind-preset';
//   export default { presets: [cigPreset], ... }

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cig: {
          // Brand accent palette
          cyan:   { DEFAULT: '#06b6d4', glow: 'rgba(6,182,212,0.35)'   },
          blue:   { DEFAULT: '#3b82f6', glow: 'rgba(59,130,246,0.35)'  },
          violet: { DEFAULT: '#8b5cf6', glow: 'rgba(139,92,246,0.35)'  },
          purple: { DEFAULT: '#a855f7', glow: 'rgba(168,85,247,0.35)'  },
          green:  { DEFAULT: '#10b981', glow: 'rgba(16,185,129,0.35)'  },
          amber:  { DEFAULT: '#f59e0b', glow: 'rgba(245,158,11,0.35)'  },
          red:    { DEFAULT: '#ef4444', glow: 'rgba(239,68,68,0.35)'   },

          // Background scale
          bg: {
            deep:     '#050b14',
            card:     '#070d1a',
            elevated: '#0e1a30',
            overlay:  'rgba(8,15,30,0.85)',
          },

          // Border scale
          border: {
            subtle:  'rgba(255,255,255,0.05)',
            DEFAULT: 'rgba(255,255,255,0.08)',
            accent:  'rgba(255,255,255,0.14)',
          },
        },
      },

      backdropBlur: {
        glass: '12px',
        'glass-lg': '20px',
      },

      backdropSaturate: {
        glass: '1.3',
      },

      boxShadow: {
        'glow-cyan':   '0 0 24px rgba(6,182,212,0.4),   0 0 48px rgba(6,182,212,0.15)',
        'glow-blue':   '0 0 24px rgba(59,130,246,0.4),  0 0 48px rgba(59,130,246,0.15)',
        'glow-violet': '0 0 24px rgba(139,92,246,0.4),  0 0 48px rgba(139,92,246,0.15)',
        'glow-purple': '0 0 24px rgba(168,85,247,0.4),  0 0 48px rgba(168,85,247,0.15)',
        'glow-green':  '0 0 24px rgba(16,185,129,0.4),  0 0 48px rgba(16,185,129,0.15)',
        'glow-amber':  '0 0 24px rgba(245,158,11,0.4),  0 0 48px rgba(245,158,11,0.15)',
        'glow-red':    '0 0 24px rgba(239,68,68,0.4),   0 0 48px rgba(239,68,68,0.15)',
        'glass':       '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glass-lg':    '0 20px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)',
      },

      animation: {
        'cig-scan':         'cig-scan 3s ease-in-out infinite',
        'cig-scan-fast':    'cig-scan 1.2s ease-in-out infinite',
        'cig-glow-pulse':   'cig-glow-pulse 2.5s ease-in-out infinite',
        'cig-float':        'cig-float 4s ease-in-out infinite',
        'cig-scroll-left':  'cig-scroll-left var(--scroll-duration, 40s) linear infinite',
        'cig-scroll-right': 'cig-scroll-right var(--scroll-duration, 40s) linear infinite',
        'cig-fade-in':      'cig-fade-in 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'cig-slide-up':     'cig-slide-up 0.6s cubic-bezier(0.16,1,0.3,1) both',
      },

      keyframes: {
        'cig-scan': {
          '0%':   { top: '0%',   opacity: '0' },
          '8%':   { opacity: '1' },
          '92%':  { opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
        'cig-glow-pulse': {
          '0%, 100%': { opacity: '0.35' },
          '50%':      { opacity: '0.8'  },
        },
        'cig-float': {
          '0%, 100%': { transform: 'translateY(0px)'  },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'cig-scroll-left': {
          from: { transform: 'translateX(0)'    },
          to:   { transform: 'translateX(-50%)' },
        },
        'cig-scroll-right': {
          from: { transform: 'translateX(-50%)' },
          to:   { transform: 'translateX(0)'    },
        },
        'cig-fade-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)'    },
        },
        'cig-slide-up': {
          from: { opacity: '0', transform: 'translateY(28px)' },
          to:   { opacity: '1', transform: 'translateY(0)'    },
        },
      },

      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
