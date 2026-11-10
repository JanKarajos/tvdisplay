/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Farby ovládania sú premenné, svetlý/tmavý režim ich iba prepína (src/index.css)
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        sunken: token('sunken'),
        line: token('line'),
        fg: token('fg'),
        muted: token('muted'),
        accent: token('accent'),
        'on-accent': token('on-accent'),
        danger: token('danger'),
        ok: token('ok'),
        warn: token('warn'),
      },
      // Nízka obrazovka (mobil naležato): menšie ovládacie tlačidlá, hlavička neostáva pripnutá
      screens: {
        short: { raw: '(max-height: 560px)' },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
