/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Product Impact brand palette — extracted from the existing Lovable design system.
        // Update these tokens once we have the actual hex values from Lovable's export.
        background: {
          DEFAULT: "#0a0a0a",
          elevated: "#141414",
          card: "#1a1a1a",
          hover: "#1f1f1f",
        },
        foreground: {
          DEFAULT: "#f5f5f5",
          muted: "#d4d4d4",
          subtle: "#a0a0a0",
          faint: "#707070",
        },
        accent: {
          DEFAULT: "#ff6b4a", // coral (Product Impact brand accent)
          hover: "#ff8566",
          muted: "#ff6b4a33",
        },
        // Theme accent bars (8 themes, 8 distinct hues drawn from the brand family)
        theme: {
          "ai-product-strategy": "#ff6b4a",
          "agents-agentic-systems": "#9b7bff",
          "ux-experience-design-for-ai": "#4ab8c9",
          "adoption-organizational-change": "#f5a623",
          "evaluation-benchmarking": "#6bbf71",
          "go-to-market-distribution": "#ff8566",
          "data-semantics-knowledge-foundations": "#5ba3cc",
          "governance-risk-trust": "#c96bff",
        },
        // Format badge colors
        format: {
          feature: "#ff6b4a",
          "news-analysis": "#4ab8c9",
          "case-study": "#6bbf71",
          "release-note": "#9b7bff",
          interview: "#f5a623",
          opinion: "#ef4444",
          explainer: "#4ab8c9",
          "research-brief": "#64748b",
          "news-brief": "#ff8566",
          "product-review": "#f5a623",
        },
      },
      fontFamily: {
        // Use system fonts until we extract Lovable's font stack
        display: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        body: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        serif: [
          "ui-serif",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
      },
      fontSize: {
        // Typography scale per the design brief
        // Body: 19px desktop / 17px mobile, line-height 1.75
        body: ["19px", { lineHeight: "1.75" }],
        "body-mobile": ["17px", { lineHeight: "1.75" }],
        deck: ["22px", { lineHeight: "1.5" }],
        "deck-mobile": ["18px", { lineHeight: "1.5" }],
        // Headlines
        "h1-display": ["64px", { lineHeight: "1.08", letterSpacing: "-0.02em" }],
        "h1-mobile": ["36px", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        "h2-article": ["36px", { lineHeight: "1.2" }],
        "h2-mobile": ["28px", { lineHeight: "1.25" }],
        "h3-article": ["26px", { lineHeight: "1.3" }],
        "h3-mobile": ["22px", { lineHeight: "1.35" }],
        // Metadata
        byline: ["16px", { lineHeight: "1.5" }],
        meta: ["14px", { lineHeight: "1.5" }],
        badge: ["11px", { lineHeight: "1", letterSpacing: "0.08em" }],
        caption: ["13px", { lineHeight: "1.5" }],
      },
      spacing: {
        // Reading column width
        prose: "720px",
        "prose-wide": "860px",
      },
      typography: {
        DEFAULT: {
          css: {
            color: "#e5e5e5",
            maxWidth: "720px",
          },
        },
      },
    },
  },
  plugins: [],
};
