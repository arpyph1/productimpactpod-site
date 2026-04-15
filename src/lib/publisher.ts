// Canonical publisher identity for Product Impact.
// This object is the single source of truth for the NewsMediaOrganization
// schema. It's embedded in BaseLayout on every page (Google News trust signal)
// and referenced by /about as the mainEntity of the AboutPage schema.

const SITE_URL = "https://productimpactpod.com";

/**
 * Shared NewsMediaOrganization schema. Google News, Bing, and LLM crawlers
 * all parse this on every page to establish publisher identity, ownership
 * disclosure links, and editorial-policy references.
 *
 * All policy URLs resolve to anchor sections on /about (see about.astro).
 */
export const publisherSchema = {
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  "@id": `${SITE_URL}/#organization`,
  name: "Product Impact",
  alternateName: "Product Impact Podcast",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    "@id": `${SITE_URL}/#logo`,
    url: `${SITE_URL}/logo.png`,
    width: 600,
    height: 60,
    caption: "Product Impact",
  },
  image: {
    "@id": `${SITE_URL}/#logo`,
  },
  description:
    "AI product impact — independent news, analysis, and case studies covering the AI products reshaping industries.",
  email: "info@productimpactpod.com",
  foundingDate: "2024",
  founder: [
    {
      "@type": "Person",
      name: "Arpy Dragffy",
      url: `${SITE_URL}/people/arpy-dragffy`,
    },
  ],
  // Google News publisher-policy references — all resolve to /about anchors
  publishingPrinciples:               `${SITE_URL}/about#editorial-standards`,
  actionableFeedbackPolicy:           `${SITE_URL}/about#corrections`,
  correctionsPolicy:                  `${SITE_URL}/about#corrections`,
  verificationFactCheckingPolicy:     `${SITE_URL}/about#fact-checking`,
  unnamedSourcesPolicy:               `${SITE_URL}/about#sources`,
  ethicsPolicy:                       `${SITE_URL}/about#ethics`,
  ownershipFundingInfo:               `${SITE_URL}/about#ownership`,
  masthead:                           `${SITE_URL}/about#masthead`,
  missionCoveragePrioritiesPolicy:    `${SITE_URL}/about#mission`,
  diversityPolicy:                    `${SITE_URL}/about#diversity`,
  // Canonical social / distribution channels
  sameAs: [
    "https://productimpactpod.substack.com",
    "https://linkedin.com/company/product-impact-podcast",
    "https://youtube.com/@productimpactpod",
    "https://open.spotify.com/show/productimpactpod",
    "https://podcasts.apple.com/productimpactpod",
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "editorial",
      email: "info@productimpactpod.com",
      availableLanguage: "en",
    },
    {
      "@type": "ContactPoint",
      contactType: "corrections",
      email: "corrections@productimpactpod.com",
      availableLanguage: "en",
    },
    {
      "@type": "ContactPoint",
      contactType: "tips",
      email: "tips@productimpactpod.com",
      availableLanguage: "en",
    },
    {
      "@type": "ContactPoint",
      contactType: "partnerships",
      email: "partner@productimpactpod.com",
      availableLanguage: "en",
    },
    {
      "@type": "ContactPoint",
      contactType: "privacy",
      email: "privacy@productimpactpod.com",
      availableLanguage: "en",
    },
  ],
};

/**
 * Minimal WebSite schema, companion to publisherSchema.
 * Links the site entity to the organization and declares the search action.
 */
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: "Product Impact",
  description:
    "AI product news, releases, and case studies about the products transforming how we work and industries.",
  publisher: { "@id": `${SITE_URL}/#organization` },
  inLanguage: "en-US",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/news?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};
