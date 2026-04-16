/** @type {import('tailwindcss').Config} */
//
// Color system uses HSL CSS variables (set in src/styles/global.css :root).
// Matches Lovable's Particle.news-inspired palette: dark foundation, coral
// primary, amber accent, plus named tokens (teal, lavender, sage, orange).
//
// Pattern: tailwind names map to `hsl(var(--name))` so we can swap the whole
// palette without touching JSX/Astro markup.

export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // shadcn-style semantic tokens
        background: {
          DEFAULT: "hsl(var(--background))",
          elevated: "hsl(var(--card))",       // alias for legacy code
          card: "hsl(var(--card))",
          hover: "hsl(var(--secondary))",
        },
        foreground: {
          DEFAULT: "hsl(var(--foreground))",
          muted: "hsl(var(--muted-foreground))",
          subtle: "hsl(var(--muted-foreground))",
          faint: "hsl(var(--muted-foreground) / 0.7)",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          // Legacy aliases — keep so existing components still compile
          hover: "hsl(var(--accent) / 0.85)",
          muted: "hsl(var(--accent) / 0.2)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Named brand colours (Lovable palette)
        coral:    "hsl(var(--coral))",
        teal:     "hsl(var(--teal))",
        amber:    "hsl(var(--amber))",
        lavender: "hsl(var(--lavender))",
        sage:     "hsl(var(--sage))",
        orange:   "hsl(var(--orange))",

        // Theme accent bars
        theme: {
          "ai-product-strategy":                  "hsl(var(--coral))",
          "agents-agentic-systems":               "hsl(var(--lavender))",
          "ux-experience-design-for-ai":          "hsl(var(--teal))",
          "adoption-organizational-change":       "hsl(var(--sage))",
          "evaluation-benchmarking":              "hsl(var(--teal))",
          "go-to-market-distribution":            "hsl(var(--orange))",
          "data-semantics-knowledge-foundations": "hsl(var(--lavender))",
          "governance-risk-trust":                "hsl(var(--amber))",
        },
      },
      fontFamily: {
        // Inter for body, Montserrat for display headings — matches Lovable
        body: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Montserrat", "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        serif: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"],
      },
      fontSize: {
        body: ["19px", { lineHeight: "1.75" }],
        "body-mobile": ["17px", { lineHeight: "1.75" }],
        deck: ["22px", { lineHeight: "1.5" }],
        "deck-mobile": ["18px", { lineHeight: "1.5" }],
        "h1-display": ["64px", { lineHeight: "1.08", letterSpacing: "-0.02em" }],
        "h1-mobile": ["36px", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        "h2-article": ["36px", { lineHeight: "1.2" }],
        "h2-mobile": ["28px", { lineHeight: "1.25" }],
        "h3-article": ["26px", { lineHeight: "1.3" }],
        "h3-mobile": ["22px", { lineHeight: "1.35" }],
        byline: ["16px", { lineHeight: "1.5" }],
        meta: ["14px", { lineHeight: "1.5" }],
        badge: ["11px", { lineHeight: "1", letterSpacing: "0.08em" }],
        caption: ["13px", { lineHeight: "1.5" }],
      },
      spacing: {
        prose: "720px",
        "prose-wide": "860px",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        wave: "wave 1.4s ease-in-out infinite",
        marquee: "marquee 24s linear infinite",
        "fade-up": "fadeUp 0.5s ease forwards",
      },
    },
  },
  plugins: [],
};
