/**
 * Grove Bloom Dashboard - Tailwind Configuration
 *
 * Extends the Grove Engine design system (Prism)
 * with Bloom-specific customizations.
 */

import grovePreset from '@autumnsgrove/groveengine/ui/tailwind';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  presets: [grovePreset],
  theme: {
    extend: {
      colors: {
        // Bloom-specific accent colors (pink theme)
        bloom: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
          950: '#500724',
        },
      },
    },
  },
  plugins: [],
};
