// Canonical 8 themes — the site's editorial taxonomy.
// Single source of truth for: /themes index, /themes/[slug] hub pages,
// homepage themes grid, and cross-reference sidebars.
//
// Supabase `themes` table overrides the description and long_form_intro
// at runtime if populated (see /themes/[slug].astro). The slugs and
// colours are fixed — they must match tailwind.config.js theme tokens
// and the llms.txt canonical list.

export interface CanonicalTheme {
  slug: string;
  name: string;
  description: string;
  intro: string;
  gradient: string;
  color: string;
}

export const canonicalThemes: CanonicalTheme[] = [
  {
    slug: "ai-product-strategy",
    name: "AI Product Strategy",
    description: "How to define, build, and position AI products in competitive markets.",
    intro:
      "AI product strategy is the practice of deciding what to build, for whom, and why — in an era when the capabilities themselves are evolving faster than most product frameworks. This theme covers product vision, positioning, competitive differentiation, and the strategic decisions that separate AI products that create lasting value from those that don't.",
    gradient: "from-[#ff6b4a] to-[#8a3a28]",
    color: "#ff6b4a",
  },
  {
    slug: "agents-agentic-systems",
    name: "Agents & Agentic Systems",
    description: "The architecture, design, and deployment of autonomous AI agents.",
    intro:
      "Agentic systems are AI products that can plan, reason, use tools, and take actions on behalf of users — autonomously, over extended time horizons. This theme covers multi-agent architectures, tool use, memory, orchestration, safety constraints, and the UX challenges of building products that users trust to act.",
    gradient: "from-[#9b7bff] to-[#4a3a80]",
    color: "#9b7bff",
  },
  {
    slug: "ux-experience-design-for-ai",
    name: "UX & Experience Design for AI",
    description: "Designing AI-powered interfaces that earn trust and drive adoption.",
    intro:
      "AI changes the fundamental contract between software and users. When outputs are probabilistic and capabilities shift with each model update, traditional UX heuristics need rethinking. This theme covers interaction design for AI, trust-building UI patterns, error recovery, progressive disclosure of AI capabilities, and what good AI product design looks like in practice.",
    gradient: "from-[#4ab8c9] to-[#1f5a66]",
    color: "#4ab8c9",
  },
  {
    slug: "adoption-organizational-change",
    name: "Adoption & Organizational Change",
    description: "Getting teams to use AI products — and building orgs that sustain it.",
    intro:
      "The hardest part of AI products is rarely the model — it's getting people to use them, and building the organizational structures that sustain adoption over time. This theme covers change management, workflow integration, training, resistance patterns, and the organizational design decisions that separate AI deployments that stick from those that don't.",
    gradient: "from-[#f5a623] to-[#7a5310]",
    color: "#f5a623",
  },
  {
    slug: "evaluation-benchmarking",
    name: "Evaluation & Benchmarking",
    description: "Measuring AI product quality, reliability, and business impact.",
    intro:
      "How do you know if your AI product is working? Evaluation is one of the hardest open problems in AI product development. This theme covers evals design, human evaluation, automated metrics, A/B testing for AI, quality regression detection, and how to connect model performance to business outcomes that actually matter.",
    gradient: "from-[#6bbf71] to-[#2d5a30]",
    color: "#6bbf71",
  },
  {
    slug: "go-to-market-distribution",
    name: "Go-to-Market & Distribution",
    description: "Bringing AI products to market — channels, pricing, and growth.",
    intro:
      "AI products create new GTM challenges: usage-based pricing, trust hurdles, enterprise procurement complexity, and the challenge of demonstrating ROI on probabilistic outputs. This theme covers positioning, channel strategy, pricing models, sales motion, and the growth tactics that are working for AI-native companies.",
    gradient: "from-[#ff8566] to-[#8a3a28]",
    color: "#ff8566",
  },
  {
    slug: "data-semantics-knowledge-foundations",
    name: "Data, Semantics & Knowledge Foundations",
    description: "The data infrastructure, ontologies, and knowledge graphs that power AI products.",
    intro:
      "AI products are only as good as the data and knowledge representations underlying them. This theme covers data pipelines, knowledge graphs, ontologies, RAG architectures, semantic search, embeddings, and the data engineering decisions that determine whether AI products deliver accurate, grounded, and trustworthy outputs.",
    gradient: "from-[#5ba3cc] to-[#1f4a66]",
    color: "#5ba3cc",
  },
  {
    slug: "governance-risk-trust",
    name: "Governance, Risk & Trust",
    description: "Safety, compliance, and building AI products that organisations can trust.",
    intro:
      "As AI products move from experimental to mission-critical, governance becomes a product requirement rather than a checkbox. This theme covers AI safety, bias and fairness, regulatory compliance (EU AI Act, NIST AI RMF), responsible AI frameworks, red-teaming, and the policies and processes that help organizations deploy AI responsibly.",
    gradient: "from-[#c96bff] to-[#5a2a80]",
    color: "#c96bff",
  },
];

/**
 * Tailwind gradient class map keyed by theme slug.
 * Usable as `bg-gradient-to-br ${themeGradients[slug]}` in templates.
 */
export const themeGradients: Record<string, string> = Object.fromEntries(
  canonicalThemes.map((t) => [t.slug, t.gradient]),
);
