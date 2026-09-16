import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      // Marka paleti — logo beyaz olduğu için koyu lacivert zeminler üzerinde
      // kullanılır (sidebar, birincil aksiyon butonları). Tek yerden yönetilir;
      // ileride marka rengi değişirse yalnızca burası güncellenir.
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#5b8def',
          500: '#3563d4',
          600: '#254bb0',
          700: '#1c3a8a',
          800: '#152c69',
          900: '#0f2050',
          950: '#0a1638',
        },
      },
    },
  },
  plugins: [],
}
export default config
