import React, { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }

interface Article {
  id: string; slug: string; title: string; subtitle: string | null;
  meta_description: string | null; content_html: string; themes: string[] | null;
  publish_date: string; author_slugs: string[] | null; format: string;
  hero_image_url: string | null;
}

interface SocialDraft {
  articleId: string; articleTitle: string; articleSlug: string;
  twitter: string; linkedin: string; generatedAt: string;
}

type Voice = "product-impact" | "arpy" | "brittany";

const SITE = "https://productimpactpod.com";

const VOICE_META: Record<Voice, { label: string; description: string }> = {
  "product-impact": {
    label: "Product Impact",
    description: "editorial · professional · brand-aligned",
  },
  arpy: {
    label: "Arpy Dragffy",
    description: "strategic insight · role-specific · opinionated",
  },
  brittany: {
    label: "Brittany Hobbs",
    description: "data-driven · research · key takeaways",
  },
};

const LINKEDIN_MAX = 3000;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ——— Content helpers ———

function plainText(html: string): string {
  return (html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function allSentences(html: string): string[] {
  return plainText(html)
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.length >= 25 && s.length <= 250);
}

function extractStats(html: string): string[] {
  const text = plainText(html);
  const patterns: RegExp[] = [
    /(\d{1,3}(?:,\d{3})*(?:\.\d+)?%[^.]{5,120}\.)/gi,
    /((?:only|just|over|nearly|almost|more than|fewer than)\s+\d[^.]{5,120}\.)/gi,
    /(\d+(?:\.\d+)?\s*(?:billion|million|trillion|x\s|times)[^.]{5,100}\.)/gi,
    /([A-Z][^.]*\d{2,}[^.]*(?:percent|%)[^.]*\.)/g,
  ];
  const stats: string[] = [];
  for (const p of patterns) {
    for (const m of text.matchAll(p)) {
      const s = m[1].trim();
      if (s.length > 20 && s.length < 160 && !stats.some(e => e.slice(0, 30) === s.slice(0, 30)))
        stats.push(s);
    }
  }
  return stats.slice(0, 8);
}

// ——— Product Impact ———
// Professional, editorial, title + meta_description aligned, no first-person.
// Target: SHORT. 400-1000 chars (13-33% of LinkedIn max).

function generateProductImpactTwitter(article: Article): string {
  const link = `${SITE}/news/${article.slug}/`;
  const desc = article.meta_description ?? "";
  const firstSentence = desc.split(/(?<=[.!?])\s+/).find(s => s.length > 20) ?? "";

  const intros = ["", "New on Product Impact:", "Just published:", "This week:", "Worth reading:"];
  const intro = pick(intros);

  const variants = [
    () => `${intro ? intro + "\n\n" : ""}${article.title}\n\n${firstSentence.slice(0, 150)}\n\n${link}`,
    () => `${article.title}\n\n${firstSentence.slice(0, 180)}\n\n${link}`,
    () => `${intro ? intro + " " : ""}${article.title}\n\n${link}`,
  ];

  let text = pick(variants)();
  if (text.length > 280) text = `${article.title}\n\n${link}`;
  return text;
}

function generateProductImpactLinkedin(article: Article): string {
  const link = `${SITE}/news/${article.slug}/`;
  const desc = article.meta_description ?? "";
  const sentences = allSentences(article.content_html);

  const keyPoints = sentences
    .filter(s => s.match(/\d|key|important|critical|significant|major|leading|growing/i))
    .slice(0, 3)
    .map(s => "• " + s);
  const points = keyPoints.length >= 2 ? keyPoints : sentences.slice(1, 4).map(s => "• " + s);

  const tags = pick([
    "#AIProducts #ProductStrategy #ProductImpact",
    "#AI #ProductManagement #ProductImpact",
    "#AIStrategy #Enterprise #ProductImpact",
  ]);

  const parts: string[] = [
    article.title,
    "",
    desc || sentences[0] || "",
    "",
    ...points,
    "",
    `Read the full article: ${link}`,
    "",
    tags,
  ];

  return parts.join("\n");
}

// ——— Arpy ———
// Strategic insight distilled into impact. LONG-FORM narrative.
// First-person, opinionated, no lists. Challenges assumptions.
// Explains why this matters for PMs / execs / enterprise.
// Target: 1500-2700 chars (50-90% of LinkedIn max).
// MUST end with a strong declarative closing point.

function generateArpyTwitter(article: Article): string {
  const link = `${SITE}/news/${article.slug}/`;
  const sentences = allSentences(article.content_html);
  const stats = extractStats(article.content_html);
  const desc = article.meta_description ?? "";

  const bold = stats[0]
    ?? sentences.find(s => s.match(/should|must|can't|won't|fail|miss|overlook|underestimate|wrong|broken/i))
    ?? desc.split(/(?<=[.!?])\s+/)[0] ?? article.title;

  const intros = [
    "Something I keep seeing product teams get wrong —",
    "This one's worth reading carefully.",
    "Hot take:",
    "Been researching this. Key finding:",
    "The real story here isn't in the headline:",
    "Product leaders: pay attention to this.",
  ];

  let text = `${pick(intros)}\n\n${bold.slice(0, 195)}\n\n${link}`;
  if (text.length > 280) text = `${bold.slice(0, 210)}\n\n${link}`;
  return text;
}

function generateArpyLinkedin(article: Article): string {
  const link = `${SITE}/news/${article.slug}/`;
  const desc = article.meta_description ?? "";
  const sentences = allSentences(article.content_html);
  const stats = extractStats(article.content_html);

  // Arpy uses a punchy opening line, NOT the article title
  const openers = [
    "Something shifted this quarter and product leaders need to pay attention.",
    "I've been digging into this and the implications are bigger than the headline suggests.",
    "I keep hearing the same question from product teams. This article gets at the answer.",
    "A pattern I keep seeing across enterprise AI deployments — and it should worry you.",
    "This came up on the podcast and I decided to go deeper. Glad I did.",
    "The conventional wisdom on this is wrong. Here's what the data actually shows.",
    "Most product teams are making the same mistake right now. Here's what it is.",
    "If you're in AI product leadership, this is the most important thing I've read this month.",
  ];

  const roles = [
    { lens: "If you're a PM leading an AI feature", what: "this changes how you should think about the build/buy decision entirely" },
    { lens: "If you're a product exec setting AI roadmap priorities", what: "this should make you reconsider where you're allocating resources" },
    { lens: "If you're leading AI adoption at scale", what: "this data explains what's actually happening underneath the adoption curves" },
    { lens: "If you're an engineering leader evaluating AI infrastructure", what: "this reframes the technical debt conversation completely" },
    { lens: "If you're a founder building in the AI space", what: "this is the market signal your pitch deck needs to address" },
  ];
  const rf = pick(roles);

  // Strategic sentence (implication-focused)
  const strategic = sentences.find(s =>
    s.match(/means|indicates|suggests|reveals|demonstrates|impact|implication|consequence|shift|fundamental|transform/i)
  ) ?? sentences[0] ?? desc;

  // Contrarian/challenge sentence
  const challenge = sentences.find(s =>
    s.match(/but|however|despite|yet|although|contrary|instead|rather|not just|beyond|overlooked|missed|wrong/i)
  ) ?? sentences[2] ?? "";

  // Build narrative paragraphs — no lists, flowing prose
  const closingPoints = [
    "The companies that figure this out first won't just have a competitive advantage — they'll define the next era of product development.",
    "This is the kind of shift that separates companies that are genuinely AI-native from those that are just adding AI as a feature checkbox.",
    "The window to act on this is shorter than most product teams realize. The organizations moving now are the ones that will set the standard.",
    "If your AI strategy doesn't account for this, you're building on assumptions that are already outdated.",
    "This isn't a trend to monitor. It's a structural change in how products get built, deployed, and adopted at scale. Act accordingly.",
    "The teams that internalize this insight will ship better products, faster. The ones that don't will spend the next two years wondering why their AI features aren't getting adopted.",
  ];

  // Gather more article substance to fill the length
  const usedSentences = new Set([strategic, challenge]);
  const impactSentences = sentences
    .filter(s => !usedSentences.has(s))
    .filter(s => s.match(/\d|key|critical|significant|shift|change|trend|adoption|growth|decline|impact|strategy|decision|risk|opportunity|failure|success/i));
  const contextSentences = sentences
    .filter(s => !usedSentences.has(s) && !impactSentences.includes(s));

  const parts: string[] = [];

  // Section 1: Punchy opener
  parts.push(pick(openers));
  parts.push("");

  // Section 2: What the article is about (desc or strategic finding)
  parts.push(desc || strategic);
  parts.push("");

  // Section 3: The strategic insight, elaborated
  if (strategic !== desc && strategic) {
    parts.push(strategic);
    parts.push("");
  }

  // Section 4: Role-specific framing
  parts.push(`${rf.lens}, ${rf.what}.`);
  parts.push("");

  // Section 5: Supporting data/evidence (woven into narrative, NOT lists)
  if (stats[0]) {
    parts.push(`The number that jumped out at me: ${stats[0]}`);
    parts.push("");
  }

  // Section 6: Challenge / contrarian point
  if (challenge && challenge !== strategic) {
    parts.push(`Here's what most people are getting wrong: ${challenge}`);
    parts.push("");
  }

  // Section 7: Additional strategic observations — add until we hit minimum length
  let currentLen = parts.join("\n").length;
  const targetMin = Math.floor(LINKEDIN_MAX * 0.50);
  const targetMax = Math.floor(LINKEDIN_MAX * 0.90);

  for (const s of impactSentences) {
    if (currentLen >= targetMin) break;
    parts.push(s);
    parts.push("");
    currentLen += s.length + 2;
  }

  for (const s of contextSentences) {
    if (currentLen >= targetMin) break;
    parts.push(s);
    parts.push("");
    currentLen += s.length + 2;
  }

  // If still short and we have stats, add more
  if (currentLen < targetMin) {
    for (const st of stats.slice(1, 4)) {
      if (currentLen >= targetMin) break;
      parts.push(st);
      parts.push("");
      currentLen += st.length + 2;
    }
  }

  // Section 8: Link
  parts.push(`I wrote about this in depth on Product Impact: ${link}`);
  parts.push("");

  // Section 9: Strong closing point (NEVER a question)
  parts.push(pick(closingPoints));

  let result = parts.join("\n");
  if (result.length > targetMax) {
    result = result.slice(0, targetMax - 3) + "...";
  }
  return result;
}

// ——— Brittany ———
// Data-driven, research perspective. USES numbered lists.
// Audience: researchers + enterprise AI leads.
// Target: 900-2100 chars (30-70% of LinkedIn max).
// MUST end with a question.

function generateBrittanyTwitter(article: Article): string {
  const link = `${SITE}/news/${article.slug}/`;
  const stats = extractStats(article.content_html);
  const desc = article.meta_description ?? "";
  const leadStat = stats[0] ?? desc.split(/(?<=[.!?])\s+/)[0] ?? article.title;

  const intros = [
    "The research on this is clear —",
    "New findings:",
    "Data point worth noting:",
    "Here's what the evidence actually says:",
    "The numbers behind this story:",
  ];

  let text = `${pick(intros)}\n\n${leadStat.slice(0, 200)}\n\n${link}`;
  if (text.length > 280) text = `${leadStat.slice(0, 210)}\n\n${link}`;
  return text;
}

function generateBrittanyLinkedin(article: Article): string {
  const link = `${SITE}/news/${article.slug}/`;
  const desc = article.meta_description ?? "";
  const sentences = allSentences(article.content_html);
  const stats = extractStats(article.content_html);

  // Brittany uses a research-framed opening, different from Arpy's personal take
  const openers = [
    "From a research perspective, this is significant.",
    "New research findings that AI product and enterprise teams should know about.",
    "The gap between perception and reality here is striking.",
    "The adoption data tells a different story than the headlines.",
    "This is the kind of evidence-based insight enterprise AI teams need right now.",
    "The behavioral data on this is really interesting — and underreported.",
  ];

  // Build numbered list from stats + data sentences
  const dataPoints: string[] = [...stats];
  sentences
    .filter(s => !stats.some(st => st.slice(0, 30) === s.slice(0, 30)))
    .filter(s => s.match(/\d|research|study|data|evidence|finding|report|analysis|survey|adoption|rate|gap|correlation|percent|growth|decline/i))
    .slice(0, 6)
    .forEach(s => dataPoints.push(s));

  if (dataPoints.length < 3) {
    sentences.slice(0, 5).forEach(s => {
      if (dataPoints.length < 4 && !dataPoints.includes(s)) dataPoints.push(s);
    });
  }

  const targetMin = Math.floor(LINKEDIN_MAX * 0.30);
  const targetMax = Math.floor(LINKEDIN_MAX * 0.70);

  // Cap list length based on target
  const maxItems = dataPoints.length > 6 ? 6 : dataPoints.length;
  const numberedList = dataPoints.slice(0, maxItems).map((p, i) => `${i + 1}. ${p}`).join("\n");

  const closingQuestions = [
    "How is your organization measuring the real impact of AI adoption — and are those metrics actually telling you the truth?",
    "What methodologies are you using to separate AI hype from measurable outcomes in your product decisions?",
    "Are enterprise teams actually benchmarking AI ROI correctly, or are we all just optimizing for the wrong metrics?",
    "What's the biggest gap between AI research findings and how your team is actually implementing them?",
    "I'd love to hear from other researchers and enterprise leads — are you seeing these same patterns in your data?",
    "For those leading AI initiatives at scale: what surprised you most when you looked at the actual adoption numbers?",
  ];

  const parts: string[] = [];

  // Section 1: Research-framed opener
  parts.push(pick(openers));
  parts.push("");

  // Section 2: Context from desc
  if (desc) {
    parts.push(desc);
    parts.push("");
  }

  // Section 3: Numbered Key Takeaways (Brittany's signature)
  parts.push("Key Takeaways:");
  parts.push(numberedList);
  parts.push("");

  // Section 4: Brief "why it matters" (only add if we need length)
  let currentLen = parts.join("\n").length;
  if (currentLen < targetMin) {
    const contextSentences = sentences
      .filter(s => !dataPoints.includes(s))
      .slice(0, 2);
    if (contextSentences.length > 0) {
      parts.push("Why this matters for enterprise AI:");
      contextSentences.forEach(s => parts.push(s));
      parts.push("");
    }
  }

  // Section 5: Link
  parts.push(`Full analysis and methodology: ${link}`);
  parts.push("");

  // Section 6: Closing question (ALWAYS a question, never a statement)
  parts.push(pick(closingQuestions));
  parts.push("");

  // Section 7: Hashtags
  parts.push("#AIResearch #EnterpriseAI #ProductResearch #DataDriven");

  let result = parts.join("\n");
  if (result.length > targetMax) {
    result = result.slice(0, targetMax - 3) + "...";
  }
  return result;
}

// ——— Dispatchers ———

function generateTwitter(article: Article, voice: Voice): string {
  if (voice === "product-impact") return generateProductImpactTwitter(article);
  if (voice === "arpy") return generateArpyTwitter(article);
  return generateBrittanyTwitter(article);
}

function generateLinkedin(article: Article, voice: Voice): string {
  if (voice === "product-impact") return generateProductImpactLinkedin(article);
  if (voice === "arpy") return generateArpyLinkedin(article);
  return generateBrittanyLinkedin(article);
}

function twitterShareUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function linkedinShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

export default function SocialScreen({ supabase }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [drafts, setDrafts] = useState<Map<string, SocialDraft>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [twitterVoice, setTwitterVoice] = useState<Voice>("product-impact");
  const [linkedinVoice, setLinkedinVoice] = useState<Voice>("arpy");
  const [editingTwitter, setEditingTwitter] = useState("");
  const [editingLinkedin, setEditingLinkedin] = useState("");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [artRes, draftsRes] = await Promise.all([
      supabase.from("articles")
        .select("id, slug, title, subtitle, meta_description, content_html, themes, publish_date, author_slugs, format, hero_image_url")
        .eq("published", true).order("publish_date", { ascending: false }).limit(30),
      supabase.from("site_settings").select("value").eq("key", "social_drafts").single(),
    ]);
    if (artRes.data) setArticles(artRes.data);
    const saved = draftsRes.data?.value?.drafts as SocialDraft[] | undefined;
    if (saved) {
      const map = new Map<string, SocialDraft>();
      saved.forEach(d => map.set(d.articleId, d));
      setDrafts(map);
    }
    setLoading(false);
  }

  function openArticle(article: Article) {
    setSelectedId(article.id);
    const existing = drafts.get(article.id);
    if (existing) {
      setEditingTwitter(existing.twitter);
      setEditingLinkedin(existing.linkedin);
    } else {
      setEditingTwitter(generateTwitter(article, twitterVoice));
      setEditingLinkedin(generateLinkedin(article, linkedinVoice));
    }
  }

  function regenTwitter() {
    const article = articles.find(a => a.id === selectedId);
    if (article) setEditingTwitter(generateTwitter(article, twitterVoice));
  }

  function regenLinkedin() {
    const article = articles.find(a => a.id === selectedId);
    if (article) setEditingLinkedin(generateLinkedin(article, linkedinVoice));
  }

  async function saveDraft() {
    const article = articles.find(a => a.id === selectedId);
    if (!article) return;
    const draft: SocialDraft = {
      articleId: article.id, articleTitle: article.title, articleSlug: article.slug,
      twitter: editingTwitter, linkedin: editingLinkedin,
      generatedAt: new Date().toISOString(),
    };
    const updated = new Map(drafts);
    updated.set(article.id, draft);
    setDrafts(updated);
    await supabase.from("site_settings").upsert({
      key: "social_drafts",
      value: { drafts: Array.from(updated.values()) },
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    setMsg("Draft saved");
    setTimeout(() => setMsg(""), 2000);
  }

  async function copyText(text: string, platform: string) {
    await navigator.clipboard.writeText(text);
    setCopied(platform);
    setTimeout(() => setCopied(""), 2000);
  }

  const selected = articles.find(a => a.id === selectedId);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="grid grid-cols-[340px_1fr] gap-6 max-w-6xl">
      {/* Article list */}
      <div className="space-y-1 max-h-[calc(100vh-160px)] overflow-y-auto pr-2">
        <div className="text-[11px] font-semibold text-[#555] uppercase tracking-wider mb-3">Published Articles</div>
        {articles.map(a => (
          <button key={a.id} onClick={() => openArticle(a)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${selectedId === a.id ? "bg-[#ff6b4a]/10 border border-[#ff6b4a]/20" : "hover:bg-[#111] border border-transparent"}`}>
            <div className="flex items-start gap-2">
              {drafts.has(a.id) && <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" title="Draft saved" />}
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-[#ccc] line-clamp-2 leading-snug">{a.title}</div>
                <div className="text-[10px] text-[#555] mt-1">{a.publish_date?.slice(0, 10)} · {a.format}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Editor */}
      <div>
        {msg && <div className="mb-4 px-4 py-2 rounded-lg text-[13px] font-medium bg-green-500/10 text-green-400">{msg}</div>}

        {!selected ? (
          <div className="flex items-center justify-center h-64 text-[#555]">
            <div className="text-center">
              <p className="text-[16px] mb-2">Select an article to generate social posts</p>
              <p className="text-[12px] text-[#444]">Each voice produces fundamentally different content — Product Impact (editorial), Arpy (strategic insight + role framing), Brittany (data + research lists)</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Article context */}
            <div className="flex items-start gap-4 p-4 rounded-xl bg-[#0c0c0c] border border-[#1a1a1a]">
              {selected.hero_image_url && <img src={selected.hero_image_url} alt="" className="w-20 h-14 rounded-lg object-cover flex-shrink-0" />}
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-white leading-snug mb-1">{selected.title}</h3>
                <div className="text-[11px] text-[#555]">{selected.publish_date?.slice(0, 10)} · {SITE}/news/{selected.slug}/</div>
              </div>
            </div>

            <button onClick={saveDraft} className="px-4 py-2 bg-[#ff6b4a] text-white rounded-lg text-[12px] font-semibold hover:bg-[#ff8566] transition-colors">
              Save All Drafts
            </button>

            {/* Twitter/X */}
            <PlatformCard
              platform="twitter"
              icon={<svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>}
              label="X / Twitter"
              voice={twitterVoice}
              onVoiceChange={(v) => {
                setTwitterVoice(v);
                const article = articles.find(a => a.id === selectedId);
                if (article) setEditingTwitter(generateTwitter(article, v));
              }}
              text={editingTwitter}
              onTextChange={setEditingTwitter}
              onRegenerate={regenTwitter}
              onCopy={() => copyText(editingTwitter, "twitter")}
              copied={copied === "twitter"}
              charLimit={280}
              shareUrl={twitterShareUrl(editingTwitter)}
              shareLabel="Share on X →"
              shareClass="bg-white/10 text-white hover:bg-white/20"
            />

            {/* LinkedIn */}
            <PlatformCard
              platform="linkedin"
              icon={<svg className="w-4 h-4 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>}
              label="LinkedIn"
              voice={linkedinVoice}
              onVoiceChange={(v) => {
                setLinkedinVoice(v);
                const article = articles.find(a => a.id === selectedId);
                if (article) setEditingLinkedin(generateLinkedin(article, v));
              }}
              text={editingLinkedin}
              onTextChange={setEditingLinkedin}
              onRegenerate={regenLinkedin}
              onCopy={() => copyText(editingLinkedin, "linkedin")}
              copied={copied === "linkedin"}
              shareUrl={linkedinShareUrl(`${SITE}/news/${selected.slug}/`)}
              shareLabel="Share on LinkedIn →"
              shareClass="bg-[#0A66C2]/20 text-[#0A66C2] hover:bg-[#0A66C2]/30"
            />
          </div>
        )}
      </div>
    </div>
  );
}

const VOICE_LINKEDIN_TARGETS: Record<Voice, { min: number; max: number; label: string }> = {
  "product-impact": { min: 400, max: 1000, label: "13-33%" },
  arpy: { min: 1500, max: 2700, label: "50-90%" },
  brittany: { min: 900, max: 2100, label: "30-70%" },
};

function PlatformCard({ platform, icon, label, voice, onVoiceChange, text, onTextChange, onRegenerate, onCopy, copied, charLimit, shareUrl, shareLabel, shareClass }: {
  platform: string; icon: React.ReactNode; label: string;
  voice: Voice; onVoiceChange: (v: Voice) => void;
  text: string; onTextChange: (t: string) => void;
  onRegenerate: () => void; onCopy: () => void; copied: boolean;
  charLimit?: number; shareUrl: string; shareLabel: string; shareClass: string;
}) {
  const liTarget = platform === "linkedin" ? VOICE_LINKEDIN_TARGETS[voice] : null;
  const liInRange = liTarget ? text.length >= liTarget.min && text.length <= liTarget.max : true;

  return (
    <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[#0c0c0c] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          {icon}
          <span className="text-[13px] font-semibold text-white">{label}</span>
          {charLimit && (
            <span className={`text-[10px] ${text.length > charLimit ? "text-red-400 font-bold" : "text-[#555]"}`}>
              {text.length}/{charLimit}
            </span>
          )}
          {liTarget && (
            <span className={`text-[10px] ${liInRange ? "text-green-400" : "text-yellow-400"}`}>
              {text.length}/{LINKEDIN_MAX} · target {liTarget.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select className="bg-[#111] border border-[#222] rounded-lg px-2.5 py-1.5 text-[11px] text-[#ccc] focus:outline-none"
            value={voice} onChange={(e) => onVoiceChange(e.target.value as Voice)}>
            <option value="product-impact">Product Impact</option>
            <option value="arpy">Arpy Dragffy</option>
            <option value="brittany">Brittany Hobbs</option>
          </select>
          <button onClick={onRegenerate} className="p-1.5 text-[#666] hover:text-white transition-colors rounded-lg hover:bg-[#1a1a1a]" title="Generate new variant">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
          </button>
          <button onClick={onCopy} className="text-[11px] text-[#666] hover:text-white transition-colors">
            {copied ? "Copied!" : "Copy"}
          </button>
          <a href={shareUrl} target="_blank" rel="noopener"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${shareClass}`}>
            {shareLabel}
          </a>
        </div>
      </div>
      <div className="px-4 py-2 bg-[#0a0a0a] border-b border-[#141414]">
        <span className="text-[10px] text-[#444]">Voice: <strong className="text-[#888]">{VOICE_META[voice].label}</strong> — {VOICE_META[voice].description}</span>
      </div>
      <textarea className={`w-full bg-[#080808] p-4 text-[14px] text-[#ddd] leading-relaxed focus:outline-none resize-y ${platform === "twitter" ? "h-32" : "h-96"}`}
        value={text} onChange={(e) => onTextChange(e.target.value)} />
    </div>
  );
}
