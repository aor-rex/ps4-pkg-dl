/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-surface)",
        surface: "var(--bg-surface)",
        "surface-dim": "var(--bg-surface-dim)",
        "surface-container-low": "var(--surface-container-low)",
        "surface-container": "var(--surface-container)",
        "surface-container-high": "var(--surface-container-high)",
        "surface-container-highest": "var(--surface-container-highest)",
        "surface-container-lowest": "var(--surface-lowest)",
        "surface-bright": "var(--surface-bright)",

        "primary": "var(--primary)",
        "on-primary": "var(--on-primary)",
        "primary-container": "var(--primary-container)",

        "on-surface": "var(--on-surface)",
        "on-surface-variant": "var(--on-surface-variant)",
        "outline": "var(--border)",
        "outline-variant": "var(--outline-variant)",

        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
      },
      borderRadius: {
        'DEFAULT': '0.125rem', // 2px
        'lg': '0.25rem', // 4px
        'xl': '0.375rem', // 6px
        '2xl': '0.5rem', // 8px
        'full': '0.75rem', // 12px
      },
      fontFamily: {
        'headline': ['Inter', 'sans-serif'],
        'body': ['Inter', 'sans-serif'],
        'label': ['Inter', 'sans-serif'],
      },
      letterSpacing: {
        'tighter': '-0.02em',
        'tight': '-0.01em',
        'widest': '0.05em',
      }
    },
  },
  plugins: [],
}
