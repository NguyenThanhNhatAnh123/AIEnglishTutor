/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../packages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        app: {
          background: '#F7F7F8',
          surface: 'rgba(255,255,255,0.72)',
          primary: '#6366F1',
          secondary: '#8B5CF6',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          ink: '#111827',
          muted: '#6B7280',
        },
      },
      boxShadow: {
        'soft': '0 18px 45px rgba(15, 23, 42, 0.08)',
        'panel': '0 1px 0 rgba(255,255,255,0.8) inset, 0 18px 42px rgba(15,23,42,0.08)',
        'glow': '0 12px 34px rgba(99,102,241,0.22)',
      },
    },
  },
  plugins: [],
}
