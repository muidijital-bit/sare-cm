import type { Config } from 'tailwindcss'

/**
 * TailAdmin (ücretsiz, Next.js, MIT) tasarım dilinden PORT EDİLDİ — paket olarak
 * kurulmadı: TailAdmin'in güncel sürümü Next.js 16 / React 19 / Tailwind v4 gerektiriyor,
 * bu proje Next.js 13.5 / React 18 / Tailwind v3'te. Renk skalası, gölgeler ve başlık
 * tipografisi TailAdmin'in `@theme` (globals.css) tanımından bu v3 formatına elle taşındı.
 * Kaynak: https://github.com/TailAdmin/free-nextjs-admin-dashboard
 *
 * `brand` anahtarı KORUNDU (yalnızca değerler TailAdmin'in ramp'ıyla değiştirildi) —
 * proje genelinde `bg-brand-800`, `text-brand-700` vb. onlarca yerde zaten kullanılıyordu;
 * anahtar adını değiştirmek yüzlerce dosyada arama-değiştirme gerektirirdi. `gray` de aynı
 * sebeple TailAdmin'in incelttiği tonlarla EZİLDİ (değerler Tailwind varsayılanına çok
 * yakın, görsel kırılma yaratmaz).
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // Tremor (@tremor/react) — bileşenleri kendi Tailwind sınıflarını çalışma zamanında
    // üretiyor; bu satır olmadan production build'de bu sınıflar PURGE edilir (bileşenler
    // stilsiz görünür). Bkz. Panel grafikleri.
    './node_modules/@tremor/react/dist/**/*.{js,cjs}',
  ],
  // Tremor renkleri `colors={["violet"]}` gibi prop'tan dinamik üretir; tarayıcı bunları
  // kaynakta göremediği için safelist şart (yoksa alan/çubuklar boş, lejant noktaları siyah).
  safelist: [
    {
      pattern:
        /^(bg|text|border|ring|stroke|fill)-(violet|fuchsia|indigo|purple|emerald|amber|rose|sky|cyan|gray|slate)-(50|100|200|300|400|500|600|700|800|900|950)$/,
      variants: ['hover'],
    },
  ],
  theme: {
    extend: {
      borderRadius: {
        'tremor-small': '0.375rem',
        'tremor-default': '0.5rem',
        'tremor-full': '9999px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Mor/indigo marka rengi (kullanıcı geri bildirimi: "sol bar mor gradientli olsun") —
        // `brand` anahtar adı korundu, yalnızca değerler TailAdmin'in mavisinden bu mor
        // rampasına kaydırıldı; tüm `bg-brand-800`, `focus:ring-brand-600` vb. kullanımlar
        // (butonlar, linkler, odak halkaları, "blue" rozet varyantı) otomatik güncellendi.
        brand: {
          25: '#f8f5ff',
          50: '#f1ebff',
          100: '#e4d8ff',
          200: '#cbb3ff',
          300: '#ab82ff',
          400: '#9061fa',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6',
          800: '#4c1d95',
          900: '#3b1370',
          950: '#2a0e52',
        },
        gray: {
          25: '#fcfcfd',
          50: '#f9fafb',
          100: '#f2f4f7',
          200: '#e4e7ec',
          300: '#d0d5dd',
          400: '#98a2b3',
          500: '#667085',
          600: '#475467',
          700: '#344054',
          800: '#1d2939',
          900: '#101828',
          950: '#0c111d',
          dark: '#1a2231',
        },
        success: {
          25: '#f6fef9', 50: '#ecfdf3', 100: '#d1fadf', 200: '#a6f4c5', 300: '#6ce9a6',
          400: '#32d583', 500: '#12b76a', 600: '#039855', 700: '#027a48', 800: '#05603a', 900: '#054f31',
        },
        error: {
          25: '#fffbfa', 50: '#fef3f2', 100: '#fee4e2', 200: '#fecdca', 300: '#fda29b',
          400: '#f97066', 500: '#f04438', 600: '#d92d20', 700: '#b42318', 800: '#912018', 900: '#7a271a',
        },
        warning: {
          25: '#fffcf5', 50: '#fffaeb', 100: '#fef0c7', 200: '#fedf89', 300: '#fec84b',
          400: '#fdb022', 500: '#f79009', 600: '#dc6803', 700: '#b54708', 800: '#93370d', 900: '#7a2e0e',
        },
        tremor: {
          brand: {
            faint: '#f5f3ff',
            muted: '#ddd6fe',
            subtle: '#a78bfa',
            DEFAULT: '#7c3aed',
            emphasis: '#5b21b6',
            inverted: '#ffffff',
          },
          background: { muted: '#f9fafb', subtle: '#f3f4f6', DEFAULT: '#ffffff', emphasis: '#374151' },
          border: { DEFAULT: '#e5e7eb' },
          ring: { DEFAULT: '#e5e7eb' },
          content: { subtle: '#9ca3af', DEFAULT: '#6b7280', emphasis: '#374151', strong: '#111827', inverted: '#ffffff' },
        },
        'blue-light': {
          25: '#f5fbff', 50: '#f0f9ff', 100: '#e0f2fe', 200: '#b9e6fe', 300: '#7cd4fd',
          400: '#36bffa', 500: '#0ba5ec', 600: '#0086c9', 700: '#026aa2', 800: '#065986', 900: '#0b4a6f',
        },
      },
      fontSize: {
        'title-2xl': ['72px', { lineHeight: '90px' }],
        'title-xl': ['60px', { lineHeight: '72px' }],
        'title-lg': ['48px', { lineHeight: '60px' }],
        'title-md': ['36px', { lineHeight: '44px' }],
        'title-sm': ['30px', { lineHeight: '38px' }],
        'theme-xl': ['20px', { lineHeight: '30px' }],
        'theme-sm': ['14px', { lineHeight: '20px' }],
        'theme-xs': ['12px', { lineHeight: '18px' }],
        'tremor-label': ['0.75rem', { lineHeight: '1rem' }],
        'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
        'tremor-title': ['1.125rem', { lineHeight: '1.75rem' }],
        'tremor-metric': ['1.875rem', { lineHeight: '2.25rem' }],
      },
      boxShadow: {
        'theme-xs': '0px 1px 2px 0px rgba(16, 24, 40, 0.05)',
        'theme-sm': '0px 1px 3px 0px rgba(16, 24, 40, 0.1), 0px 1px 2px 0px rgba(16, 24, 40, 0.06)',
        'theme-md': '0px 4px 8px -2px rgba(16, 24, 40, 0.1), 0px 2px 4px -2px rgba(16, 24, 40, 0.06)',
        'theme-lg': '0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
        'theme-xl': '0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03)',
        'tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
}
export default config
