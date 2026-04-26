import type { SiteConfig } from "./config";

export function buildPublisherSchema(cfg: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "@id": `${cfg.url}/#organization`,
    name: cfg.name,
    alternateName: cfg.alternateName,
    url: cfg.url,
    logo: {
      "@type": "ImageObject",
      "@id": `${cfg.url}/#logo`,
      url: `${cfg.url}${cfg.logoUrl}`,
      width: 600,
      height: 60,
      caption: cfg.name,
    },
    image: { "@id": `${cfg.url}/#logo` },
    description: cfg.description,
    email: cfg.email.editorial,
    foundingDate: cfg.foundingDate,
    founder: cfg.hosts.slice(0, 1).map(h => ({
      "@type": "Person",
      name: h.name,
      url: `${cfg.url}/people/${h.slug}`,
    })),
    publishingPrinciples: `${cfg.url}/about#editorial-standards`,
    actionableFeedbackPolicy: `${cfg.url}/about#corrections`,
    correctionsPolicy: `${cfg.url}/about#corrections`,
    verificationFactCheckingPolicy: `${cfg.url}/about#fact-checking`,
    unnamedSourcesPolicy: `${cfg.url}/about#sources`,
    ethicsPolicy: `${cfg.url}/about#ethics`,
    ownershipFundingInfo: `${cfg.url}/about#ownership`,
    masthead: `${cfg.url}/about#masthead`,
    missionCoveragePrioritiesPolicy: `${cfg.url}/about#mission`,
    diversityPolicy: `${cfg.url}/about#diversity`,
    sameAs: [
      cfg.social.substack,
      cfg.social.linkedin,
      cfg.social.youtube,
      cfg.social.spotify,
      cfg.social.apple,
    ].filter(Boolean),
    contactPoint: [
      { "@type": "ContactPoint", contactType: "editorial", email: cfg.email.editorial, availableLanguage: "en" },
      { "@type": "ContactPoint", contactType: "corrections", email: cfg.email.corrections, availableLanguage: "en" },
      { "@type": "ContactPoint", contactType: "tips", email: cfg.email.tips, availableLanguage: "en" },
      { "@type": "ContactPoint", contactType: "partnerships", email: cfg.email.partners, availableLanguage: "en" },
      { "@type": "ContactPoint", contactType: "privacy", email: cfg.email.privacy, availableLanguage: "en" },
    ],
  };
}

export function buildWebsiteSchema(cfg: SiteConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${cfg.url}/#website`,
    url: cfg.url,
    name: cfg.name,
    description: cfg.description,
    publisher: { "@id": `${cfg.url}/#organization` },
    inLanguage: cfg.language,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${cfg.url}/news?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
