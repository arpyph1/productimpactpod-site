import { getSiteSetting } from "./supabase";

export interface SiteConfig {
  name: string;
  alternateName: string;
  url: string;
  tagline: string;
  description: string;
  foundingDate: string;
  language: string;
  logoUrl: string;
  faviconUrl: string;

  accentColor: string;
  accentHover: string;
  accentHsl: string;

  email: {
    editorial: string;
    corrections: string;
    tips: string;
    partners: string;
    privacy: string;
  };

  social: {
    twitter: string;
    linkedin: string;
    youtube: string;
    spotify: string;
    apple: string;
    substack: string;
  };

  podcast: {
    feedUrl: string;
    youtubeChannelId: string;
    spotifyUrl: string;
    appleUrl: string;
    youtubeUrl: string;
  };

  hosts: Array<{
    name: string;
    slug: string;
    role: string;
    bio: string;
    linkedin: string;
    sameAs: string[];
  }>;

  analytics: {
    gaId: string;
  };

  admin: {
    allowedEmails: string[];
    allowedDomains: string[];
  };

  themes: Array<{
    slug: string;
    label: string;
    color: string;
    gradientFrom: string;
    keywords: string[];
  }>;

  partners: Array<{
    name: string;
    url: string;
    logoUrl: string;
  }>;

  nav: {
    items: Array<{ label: string; href: string }>;
  };

  footer: {
    tagline: string;
    copyright: string;
  };
}

const DEFAULTS: SiteConfig = {
  name: "Product Impact",
  alternateName: "Product Impact Podcast",
  url: "https://productimpactpod.com",
  tagline: "AI product impact — news, releases, and case studies.",
  description: "AI product impact — independent news, analysis, and case studies covering the AI products reshaping industries.",
  foundingDate: "2024",
  language: "en-US",
  logoUrl: "/logo.png",
  faviconUrl: "/favicon-192.png",

  accentColor: "#ff6b4a",
  accentHover: "#ff8566",
  accentHsl: "12 100% 65%",

  email: {
    editorial: "info@productimpactpod.com",
    corrections: "corrections@productimpactpod.com",
    tips: "tips@productimpactpod.com",
    partners: "partner@productimpactpod.com",
    privacy: "privacy@productimpactpod.com",
  },

  social: {
    twitter: "@productimpactpod",
    linkedin: "https://linkedin.com/company/product-impact-podcast",
    youtube: "https://youtube.com/@productimpactpod",
    spotify: "https://open.spotify.com/show/productimpactpod",
    apple: "https://podcasts.apple.com/productimpactpod",
    substack: "https://productimpactpod.substack.com",
  },

  podcast: {
    feedUrl: "https://anchor.fm/s/f32cce5c/podcast/rss",
    youtubeChannelId: "UCb1nY02YcJYZZ_XtvcIBcrw",
    spotifyUrl: "https://open.spotify.com/show/productimpactpod",
    appleUrl: "https://podcasts.apple.com/productimpactpod",
    youtubeUrl: "https://youtube.com/@productimpactpod",
  },

  hosts: [
    {
      name: "Arpy Dragffy",
      slug: "arpy-dragffy",
      role: "Co-host & Publisher",
      bio: "Founder of PH1 Research. Covers AI product strategy, go-to-market, and enterprise adoption.",
      linkedin: "https://linkedin.com/in/arpydragffy",
      sameAs: ["https://linkedin.com/in/arpydragffy"],
    },
    {
      name: "Brittany Hobbs",
      slug: "brittany-hobbs",
      role: "Co-host",
      bio: "Data and research lead. Covers evaluation, benchmarking, and applied AI research.",
      linkedin: "",
      sameAs: [],
    },
  ],

  analytics: { gaId: "G-5XKLYD86P7" },

  admin: {
    allowedEmails: ["arpy@ph1.ca", "brittany@ph1.ca", "info@productimpactpod.com"],
    allowedDomains: ["ph1.ca", "productimpactpod.com"],
  },

  themes: [
    { slug: "ai-product-strategy", label: "AI Product Strategy", color: "#ff6b4a", gradientFrom: "#8a3a28", keywords: ["product strategy", "roadmap", "product leader", "strategic"] },
    { slug: "agents-agentic-systems", label: "Agents & Agentic", color: "#9b7bff", gradientFrom: "#4a3a80", keywords: ["agent", "agentic", "autonomous", "copilot"] },
    { slug: "ux-experience-design-for-ai", label: "UX & Experience Design", color: "#4ab8c9", gradientFrom: "#1f5a66", keywords: ["ux", "user experience", "design", "interface"] },
    { slug: "adoption-organizational-change", label: "Adoption & Org Change", color: "#f5a623", gradientFrom: "#7a5310", keywords: ["adoption", "organizational", "transformation", "enterprise"] },
    { slug: "evaluation-benchmarking", label: "Evaluation & Benchmarking", color: "#6bbf71", gradientFrom: "#2d5a30", keywords: ["evaluat", "benchmark", "metric", "measur"] },
    { slug: "go-to-market-distribution", label: "Go-to-Market", color: "#ff8566", gradientFrom: "#8a3a28", keywords: ["go-to-market", "pricing", "monetiz", "growth"] },
    { slug: "data-semantics-knowledge-foundations", label: "Data & Knowledge", color: "#5ba3cc", gradientFrom: "#1f5a66", keywords: ["data", "knowledge", "semantic", "rag", "retrieval"] },
    { slug: "governance-risk-trust", label: "Governance & Trust", color: "#c96bff", gradientFrom: "#5a2a80", keywords: ["governance", "risk", "trust", "safety", "ethic"] },
  ],

  partners: [],

  nav: {
    items: [
      { label: "News", href: "/news" },
      { label: "Podcast", href: "/podcast" },
      { label: "Topics", href: "/topics" },
      { label: "About", href: "/about" },
    ],
  },

  footer: {
    tagline: "AI product impact — news, releases, and case studies.",
    copyright: "Product Impact",
  },
};

let _cached: SiteConfig | null = null;

export async function getSiteConfig(): Promise<SiteConfig> {
  if (_cached) return _cached;

  const saved = await getSiteSetting("site_config");
  if (!saved) {
    _cached = DEFAULTS;
    return DEFAULTS;
  }

  _cached = deepMerge(DEFAULTS, saved) as SiteConfig;
  return _cached;
}

export function getSiteConfigSync(): SiteConfig {
  return _cached ?? DEFAULTS;
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] === null || source[key] === undefined) continue;
    if (Array.isArray(source[key]) && source[key].length > 0) {
      result[key] = source[key];
    } else if (typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] ?? {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export { DEFAULTS as CONFIG_DEFAULTS };
