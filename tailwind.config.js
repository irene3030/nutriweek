/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Cap border-radius: max 4px (hard edges, blueprint aesthetic)
    borderRadius: {
      none: '0',
      sm:   '2px',
      DEFAULT: '4px',
      md:   '4px',
      lg:   '4px',
      xl:   '4px',
      '2xl':'4px',
      '3xl':'4px',
      full: '9999px',
    },
    // Flat/technical shadows — no soft glows
    boxShadow: {
      sm:    '2px 2px 0 0 rgba(26,64,107,0.12)',
      DEFAULT:'3px 3px 0 0 rgba(26,64,107,0.15)',
      md:    '4px 4px 0 0 rgba(26,64,107,0.18)',
      lg:    '5px 5px 0 0 rgba(26,64,107,0.20)',
      xl:    '6px 6px 0 0 rgba(26,64,107,0.22)',
      '2xl': '8px 8px 0 0 rgba(26,64,107,0.25)',
      inner: 'inset 0 2px 4px 0 rgba(26,64,107,0.10)',
      none:  'none',
    },
    extend: {
      colors: {
        // === Paleta principal ===
        brand: {
          50:  '#EEF3F8',
          100: '#D5E3EF',
          200: '#AACADE',
          300: '#7FAFCB',
          400: '#4D8AB5',
          500: '#2A6290',
          600: '#1A406B',  // Azul Blueprint — cabeceras, títulos
          700: '#143356',
          800: '#0E2540',
          900: '#07182B',
        },
        // Cian Blueprint — iconos técnicos, IA, datos numéricos
        blueprint: '#00BFFF',
        cyan: {
          blueprint: '#00BFFF',
        },
        // Fondos
        cream: '#FDFCF5',   // Fondo principal
        mist:  '#E5E9F0',   // Fondos de sección / bordes
        // Acento acción
        caldero: {
          light:   '#F5A55A',
          DEFAULT: '#E67E22',
          dark:    '#C0621A',
        },
        // Indicadores de salud
        albahaca: {
          light:   '#7BAE3E',
          DEFAULT: '#4B7721',
          dark:    '#365717',
        },
        // === Colores semánticos por categoría de alimento (solo acento) ===
        iron:   { light: '#fed7aa', DEFAULT: '#f97316', dark: '#c2410c' },
        fish:   { light: '#bae6fd', DEFAULT: '#0ea5e9', dark: '#0369a1' },
        legume: { light: '#bbf7d0', DEFAULT: '#22c55e', dark: '#15803d' },
        veggie: { light: '#d9f99d', DEFAULT: '#84cc16', dark: '#4d7c0f' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Space Mono"', 'Courier New', 'monospace'],
      },
      backgroundImage: {
        // Engineering grid: papel milimetrado técnico 20×20px
        'grid-paper': [
          'linear-gradient(to right,  rgba(229,233,240,0.30) 1px, transparent 1px)',
          'linear-gradient(to bottom, rgba(229,233,240,0.30) 1px, transparent 1px)',
        ].join(', '),
      },
      backgroundSize: {
        'grid-paper': '20px 20px',
      },
    },
  },
  plugins: [],
}
