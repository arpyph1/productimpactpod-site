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
    .filter(s => s.length >= 30 && s.length <= 300)
    .filter(s => /^[A-Z\d"']/.test(s))
    .filter(s => s.split(/\s+/).length >= 5)
    .filter(s => !/^Sources?:|^\d+\.\s|^[-*]\s/.test(s));
}

function extractStats(html: string): string[] {
  const text = plainText(html);
  const patterns: RegExp[] = [
    /(\$\d[\d,.]*[^.]{5,140}\.)/gi,
    /(\d{1,3}(?:,\d{3})*(?:\.\d+)?%[^.]{5,140}\.)/gi,
    /((?:only|just|over|nearly|almost|more than|fewer than)\s+\d[^.]{5,140}\.)/gi,
    /(\d+(?:\.\d+)?\s*(?:billion|million|trillion|x\s|times)[^.]{5,120}\.)/gi,
    /([A-Z][^.]*\d{2,}[^.]*(?:percent|%)[^.]*\.)/g,
  ];
  const stats: string[] = [];
  for (const p of patterns) {
    for (const m of text.matchAll(p)) {
      const s = m[1].trim();
      if (s.length > 25 && s.length < 220
          && !stats.some(e => e.slice(0, 30) === s.slice(0, 30))
          && !/^Sources?:/.test(s)
          && s.split(/\s+/).length >= 5)
        stats.push(s);
    }
  }
  return stats.slice(0, 10);
}

// ——— Product Impact ———
// Professional editorial voice. Uses QUOTES from the article (not attributed).
// Lists 4-5 key points the article covers with brief context.
// Target: 800-1800 chars (27-60% of LinkedIn max).

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
  const stats = extractStats(article.content_html);

  // Find a quotable sentence: insightful, declarative, good standalone
  const quotable = sentences.find(s =>
    s.match(/the real|what matters|key insight|truth is|reality is|actually|means that|this is why|the reason|important to understand/i)
    && s.length >= 40 && s.length <= 220
  ) ?? sentences.find(s =>
    s.match(/means|reveals|shows|demonstrates|proves/i) && s.length >= 40 && s.length <= 200
  ) ?? sentences.find(s => s.length >= 50 && s.length <= 200) ?? "";

  // Gather diverse topic-covering sentences for key points
  const usedSet = new Set([quotable, desc]);
  const topicPool = sentences.filter(s => !usedSet.has(s) && s.length >= 30 && s.length <= 220);
  const keyPoints: string[] = [];
  const coveredWords = new Set<string>();
  for (const s of topicPool) {
    if (keyPoints.length >= 5) break;
    const words = s.toLowerCase().split(/\s+/).filter(w => w.length > 5);
    const isNew = words.some(w => !coveredWords.has(w));
    if (isNew || keyPoints.length < 3) {
      keyPoints.push(s);
      words.forEach(w => coveredWords.add(w));
    }
  }
  // Supplement with stats if needed
  for (const st of stats) {
    if (keyPoints.length >= 5) break;
    if (!keyPoints.some(p => p.slice(0, 30) === st.slice(0, 30))) keyPoints.push(st);
  }

  const tags = pick([
    "#AIProducts #ProductStrategy #ProductImpact",
    "#AI #ProductManagement #ProductImpact",
    "#AIStrategy #Enterprise #ProductImpact",
  ]);

  const parts: string[] = [];
  parts.push(article.title);
  parts.push("");
  parts.push(desc || sentences[0] || "");
  parts.push("");

  if (quotable) {
    parts.push(`"${quotable}"`);
    parts.push("");
  }

  if (keyPoints.length >= 2) {
    parts.push("What this article covers:");
    keyPoints.forEach((p, i) => parts.push(`${i + 1}. ${p}`));
    parts.push("");
  }

  parts.push(`Read the full article: ${link}`);
  parts.push("");
  parts.push(tags);

  return parts.join("\n");
}

// ——— Arpy ———
// Strategic, opinionated, first-person. Builds a THESIS with flowing prose paragraphs.
// NO bullet lists. NO single-sentence paragraphs (group 2-3 sentences per paragraph).
// Names the actual topic the article addresses. Explains WHY it matters strategically.
// Target: 1500-2700 chars (50-90% of LinkedIn max).

function generateArpyTwitter(article: Article): string {
  const link = `${SITE}/news/${article.slug}/`;
  const sentences = allSentences(article.content_html);
  const stats = extractStats(article.content_html);
  const desc = article.meta_description ?? "";

  const bold = stats[0]
    ?? sentences.find(s => s.match(/should|must|can't|won't|fail|miss|overlook|underestimate|wrong|broken/i))
    ?? desc.split(/(?<=[.!?])\s+/)[0] ?? article.title;

  let text = `${bold.slice(0, 220)}\n\n${link}`;
  if (text.length > 280) text = `${article.title.slice(0, 220)}\n\n${link}`;
  return text;
}

function generateArpyLinkedin(article: Article): string {
  const link = `${SITE}/news/${article.slug}/`;
  const desc = article.meta_description ?? "";
  const sentences = allSentences(article.content_html);
  const stats = extractStats(article.content_html);

  // Categorize sentences for building argument paragraphs
  const strategicPool = sentences.filter(s =>
    s.match(/means|indicates|suggests|reveals|impact|implication|consequence|shift|fundamental|transform|strategy|decision|opportunity/i)
  );
  const evidencePool = sentences.filter(s =>
    s.match(/\d|cost|price|percent|million|billion|growth|decline|increase|decrease|\$/i)
  );
  const contrarianPool = sentences.filter(s =>
    s.match(/but|however|despite|yet|although|contrary|instead|rather|not just|beyond|overlooked|missed|wrong|actually|reality/i)
  );
  const contextPool = sentences.filter(s =>
    !strategicPool.includes(s) && !evidencePool.includes(s) && !contrarianPool.includes(s)
  );

  // Helper: join sentences into a flowing paragraph
  function buildParagraph(pool: string[], max: number = 3): string {
    return pool.slice(0, max).join(" ");
  }

  const usedSentences = new Set<string>();
  function takeUnused(pool: string[], count: number): string[] {
    const result: string[] = [];
    for (const s of pool) {
      if (result.length >= count) break;
      if (!usedSentences.has(s)) {
        result.push(s);
        usedSentences.add(s);
      }
    }
    return result;
  }

  const parts: string[] = [];

  // Opening paragraph: the article's thesis + Arpy's take (2-3 sentences grouped)
  const openingSentences: string[] = [];
  if (desc) openingSentences.push(desc);
  const takeSentence = takeUnused(strategicPool, 1);
  if (takeSentence.length > 0 && takeSentence[0] !== desc) {
    openingSentences.push(takeSentence[0]);
  }
  if (openingSentences.length === 0) openingSentences.push(sentences[0] || article.title);
  parts.push(openingSentences.join(" "));
  parts.push("");

  // Evidence paragraph: data that supports the argument (2-3 evidence sentences)
  const evidenceTake = takeUnused(evidencePool, 3);
  if (evidenceTake.length > 0) {
    parts.push(buildParagraph(evidenceTake));
    parts.push("");
  }

  // Strategic implication paragraph: what this means for product leaders
  const strategicTake = takeUnused(strategicPool, 2);
  const contextTake = takeUnused(contextPool, 1);
  const implParagraph = [...strategicTake, ...contextTake];
  if (implParagraph.length > 0) {
    parts.push(buildParagraph(implParagraph));
    parts.push("");
  }

  // Contrarian/nuance paragraph: challenge assumptions
  const contrarianTake = takeUnused(contrarianPool, 2);
  if (contrarianTake.length > 0) {
    parts.push(buildParagraph(contrarianTake));
    parts.push("");
  }

  // Fill to target with remaining sentences grouped into paragraphs
  let currentLen = parts.join("\n").length;
  const targetMin = Math.floor(LINKEDIN_MAX * 0.50);
  const targetMax = Math.floor(LINKEDIN_MAX * 0.90);

  const allRemaining = [...evidencePool, ...strategicPool, ...contextPool, ...contrarianPool]
    .filter(s => !usedSentences.has(s));
  let paraBuffer: string[] = [];
  for (const s of allRemaining) {
    if (currentLen >= targetMin) break;
    paraBuffer.push(s);
    usedSentences.add(s);
    if (paraBuffer.length >= 2) {
      parts.push(buildParagraph(paraBuffer));
      parts.push("");
      currentLen += paraBuffer.join(" ").length + 2;
      paraBuffer = [];
    }
  }
  if (paraBuffer.length > 0 && currentLen < targetMin) {
    parts.push(buildParagraph(paraBuffer));
    parts.push("");
    currentLen += paraBuffer.join(" ").length + 2;
  }

  // Fill with remaining stats if still short
  if (currentLen < targetMin) {
    for (const st of stats) {
      if (currentLen >= targetMin) break;
      if (!usedSentences.has(st)) {
        parts.push(st);
        parts.push("");
        currentLen += st.length + 2;
      }
    }
  }

  parts.push(`I wrote about this on Product Impact: ${link}`);
  parts.push("");

  const closingPoints = [
    "The companies that understand this distinction will make better decisions. The rest will learn the hard way.",
    "This is a structural change in how products get built. The teams that see it clearly will act accordingly.",
    "The window to act is shorter than most realize. The organizations moving now will set the standard.",
    "If your strategy doesn't account for this, you're building on assumptions that are already outdated.",
    "The teams that internalize this will ship better products. The rest will spend years wondering why.",
  ];
  parts.push(pick(closingPoints));

  let result = parts.join("\n");
  if (result.length > targetMax) {
    result = result.slice(0, targetMax - 3) + "...";
  }
  return result;
}

// ——— Brittany ———
// Data analyst voice. Leads with specific numbers. Explains what each finding means.
// Uses "The data breakdown:" with numbered findings + context for each.
// Includes a "What to watch:" forward-looking section.
// Target: 1200-2400 chars (40-80% of LinkedIn max).
// MUST end with a question.

function generateBrittanyTwitter(article: Article): string {
  const link = `${SITE}/news/${article.slug}/`;
  const stats = extractStats(article.content_html);
  const desc = article.meta_description ?? "";
  const leadStat = stats[0] ?? desc.split(/(?<=[.!?])\s+/)[0] ?? article.title;

  let text = `${leadStat.slice(0, 220)}\n\n${link}`;
  if (text.length > 280) text = `${article.title.slice(0, 220)}\n\n${link}`;
  return text;
}

function generateBrittanyLinkedin(article: Article): string {
  const link = `${SITE}/news/${article.slug}/`;
  const desc = article.meta_description ?? "";
  const sentences = allSentences(article.content_html);
  const stats = extractStats(article.content_html);

  // Lead with the most concrete stat + an explanatory sentence
  const explanatory = sentences.find(s =>
    s.match(/because|this means|which means|the reason|in other words|the implication|this is why|that means/i)
  );

  // Build data findings with related context sentences
  const dataFindings: string[] = [];
  const usedForFindings = new Set<string>();
  for (const st of stats.slice(0, 5)) {
    const stWords = st.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const related = sentences.find(s => {
      if (usedForFindings.has(s) || s === st) return false;
      return stWords.some(w => s.toLowerCase().includes(w));
    });
    if (related) {
      dataFindings.push(`${st} ${related}`);
      usedForFindings.add(related);
    } else {
      dataFindings.push(st);
    }
    usedForFindings.add(st);
  }

  // Fallback: if no stats, use data-oriented sentences
  if (dataFindings.length < 2) {
    const dataSentences = sentences
      .filter(s => s.match(/\d|research|study|data|evidence|finding|report|analysis|survey|rate|gap|percent|growth|decline/i))
      .filter(s => !usedForFindings.has(s));
    for (const s of dataSentences) {
      if (dataFindings.length >= 4) break;
      dataFindings.push(s);
    }
  }

  // Implication sentences for bigger-picture paragraph
  const implicationSentences = sentences.filter(s =>
    s.match(/means|suggests|indicates|implies|points to|reveals|consequence|therefore|the result/i)
    && !usedForFindings.has(s)
  );

  // Extract key topic words from title for "What to watch" section
  const topicWords = article.title
    .replace(/[^a-zA-Z\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 4 && !["about", "their", "these", "those", "which", "where", "would", "could", "should", "being", "other", "every", "matters", "more"].includes(w.toLowerCase()))
    .slice(0, 4)
    .join(" ")
    .toLowerCase();

  const targetMin = Math.floor(LINKEDIN_MAX * 0.40);
  const targetMax = Math.floor(LINKEDIN_MAX * 0.80);

  const parts: string[] = [];

  // Opening: lead stat with explanation
  if (stats[0]) {
    if (explanatory) {
      parts.push(`${stats[0]} ${explanatory}`);
    } else {
      parts.push(stats[0]);
    }
  } else {
    parts.push(desc || sentences[0] || article.title);
  }
  parts.push("");

  // Data breakdown with context
  if (dataFindings.length >= 2) {
    parts.push("The data breakdown:");
    dataFindings.slice(0, 5).forEach((f, i) => parts.push(`${i + 1}. ${f}`));
    parts.push("");
  }

  // Bigger picture paragraph
  if (implicationSentences.length > 0) {
    parts.push(implicationSentences.slice(0, 3).join(" "));
    parts.push("");
  }

  // Fill to target if needed
  let currentLen = parts.join("\n").length;
  if (currentLen < targetMin) {
    const remaining = sentences.filter(s => !usedForFindings.has(s) && !implicationSentences.includes(s));
    for (const s of remaining) {
      if (currentLen >= targetMin) break;
      parts.push(s);
      currentLen += s.length + 1;
    }
    parts.push("");
  }

  // What to watch section
  parts.push("What to watch:");
  parts.push(`- How will the economics of ${topicWords || "this space"} change as model costs decrease?`);
  parts.push(`- What adoption patterns will emerge as more teams evaluate ${topicWords || "these tools"}?`);
  if (stats.length > 0) {
    parts.push("- Will these numbers hold as the market matures, or are we in an early-stage anomaly?");
  }
  parts.push("");

  parts.push(`Read full analysis: ${link}`);
  parts.push("");

  const closingQuestions = [
    "What cost assumptions is your team making? Are you factoring in iteration costs or just first-draft generation?",
    "How is your organization measuring the real impact? Are those metrics telling you the truth?",
    "What does your team's data actually show? Are you seeing the same patterns?",
    "Are enterprise teams benchmarking correctly, or are we optimizing for the wrong metrics?",
    "What's the biggest gap between these findings and how your team is implementing?",
  ];
  parts.push(pick(closingQuestions));
  parts.push("");
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
