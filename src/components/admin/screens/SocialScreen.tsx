import React, { useState, useEffect, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }

interface Article {
  id: string; slug: string; title: string; subtitle: string | null;
  meta_description: string | null; content_html: string; themes: string[] | null;
  publish_date: string; author_slugs: string[] | null; format: string;
  hero_image_url: string | null;
}

interface SocialDraft {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  twitter: string;
  linkedin: string;
  generatedAt: string;
}

const SITE = "https://productimpactpod.com";

const TWITTER_TEMPLATES = [
  (a: Article, insight: string) => `${insight}\n\n${a.title}\n${SITE}/news/${a.slug}/`,
  (a: Article, insight: string) => `${insight}\n\nNew on Product Impact 👇\n${SITE}/news/${a.slug}/`,
  (a: Article, insight: string) => `"${a.title}"\n\n${insight}\n\nRead → ${SITE}/news/${a.slug}/`,
  (a: Article, insight: string) => `${insight}\n\nWhy it matters for product teams:\n${SITE}/news/${a.slug}/`,
  (a: Article, insight: string) => `${insight}\n\n🔗 ${SITE}/news/${a.slug}/`,
];

const LINKEDIN_TEMPLATES = [
  (a: Article, insight: string, body: string) =>
`${insight}

${body}

${a.title}
${SITE}/news/${a.slug}/

#AIProducts #ProductStrategy`,

  (a: Article, insight: string, body: string) =>
`${a.title}

${insight}

${body}

Read the full analysis → ${SITE}/news/${a.slug}/

#AI #ProductManagement #ProductImpact`,

  (a: Article, insight: string, body: string) =>
`${insight}

Here's what we found:

${body}

Full article on Product Impact → ${SITE}/news/${a.slug}/`,

  (a: Article, insight: string, body: string) =>
`We just published: ${a.title}

${insight}

${body}

👉 ${SITE}/news/${a.slug}/

#AIStrategy #Enterprise`,
];

function extractInsight(article: Article): string {
  const desc = article.meta_description ?? "";
  const html = article.content_html ?? "";
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  const statMatch = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\s+(?:of|percent|billion|million|trillion)[^.]{5,60}\.)/i)
    || text.match(/((?:only|just|over|nearly|almost|more than)\s+\d[^.]{5,60}\.)/i)
    || desc.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?%[^.]{5,50}\.)/i);

  if (statMatch) return statMatch[1].trim();

  const sentences = desc.split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
  if (sentences.length > 1) return sentences[0];
  if (sentences.length === 1) return sentences[0];

  return desc.slice(0, 200);
}

function extractBody(article: Article): string {
  const html = article.content_html ?? "";
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 30 && s.length < 200);
  const picks: string[] = [];

  for (const s of sentences.slice(0, 20)) {
    if (picks.length >= 3) break;
    if (s.match(/\d/) || s.match(/percent|billion|million|key|critical|important|gap|failure|success|shift|change/i)) {
      picks.push("→ " + s);
    }
  }

  if (picks.length === 0) {
    return sentences.slice(1, 4).map(s => "→ " + s).join("\n");
  }

  return picks.join("\n");
}

function generateDrafts(article: Article): { twitter: string; linkedin: string } {
  const insight = extractInsight(article);
  const body = extractBody(article);
  const tIdx = Math.floor(Math.random() * TWITTER_TEMPLATES.length);
  const lIdx = Math.floor(Math.random() * LINKEDIN_TEMPLATES.length);

  let twitter = TWITTER_TEMPLATES[tIdx](article, insight);
  if (twitter.length > 280) {
    twitter = `${insight.slice(0, 200)}\n\n${SITE}/news/${article.slug}/`;
  }

  const linkedin = LINKEDIN_TEMPLATES[lIdx](article, insight, body);

  return { twitter, linkedin };
}

function twitterShareUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

function linkedinShareUrl(text: string, url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

export default function SocialScreen({ supabase }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [drafts, setDrafts] = useState<Map<string, SocialDraft>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTwitter, setEditingTwitter] = useState("");
  const [editingLinkedin, setEditingLinkedin] = useState("");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [artRes, draftsRes] = await Promise.all([
      supabase.from("articles").select("id, slug, title, subtitle, meta_description, content_html, themes, publish_date, author_slugs, format, hero_image_url")
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
      const { twitter, linkedin } = generateDrafts(article);
      setEditingTwitter(twitter);
      setEditingLinkedin(linkedin);
    }
  }

  function regenerate() {
    const article = articles.find(a => a.id === selectedId);
    if (!article) return;
    const { twitter, linkedin } = generateDrafts(article);
    setEditingTwitter(twitter);
    setEditingLinkedin(linkedin);
  }

  async function saveDraft() {
    const article = articles.find(a => a.id === selectedId);
    if (!article) return;

    const draft: SocialDraft = {
      articleId: article.id,
      articleTitle: article.title,
      articleSlug: article.slug,
      twitter: editingTwitter,
      linkedin: editingLinkedin,
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

    setMsg("Draft saved"); setTimeout(() => setMsg(""), 2000);
  }

  async function copyText(text: string, platform: string) {
    await navigator.clipboard.writeText(text);
    setCopied(platform);
    setTimeout(() => setCopied(""), 2000);
  }

  const selected = articles.find(a => a.id === selectedId);

  if (loading) {
    return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="grid grid-cols-[340px_1fr] gap-6 max-w-6xl">
      {/* Article list */}
      <div className="space-y-1 max-h-[calc(100vh-160px)] overflow-y-auto pr-2">
        <div className="text-[11px] font-semibold text-[#555] uppercase tracking-wider mb-3">Published Articles</div>
        {articles.map(a => {
          const hasDraft = drafts.has(a.id);
          return (
            <button key={a.id} onClick={() => openArticle(a)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${selectedId === a.id ? "bg-[#ff6b4a]/10 border border-[#ff6b4a]/20" : "hover:bg-[#111] border border-transparent"}`}>
              <div className="flex items-start gap-2">
                {hasDraft && <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" title="Draft saved" />}
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[#ccc] line-clamp-2 leading-snug">{a.title}</div>
                  <div className="text-[10px] text-[#555] mt-1">{a.publish_date?.slice(0, 10)} · {a.format}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Draft editor */}
      <div>
        {msg && <div className="mb-4 px-4 py-2 rounded-lg text-[13px] font-medium bg-green-500/10 text-green-400">{msg}</div>}

        {!selected ? (
          <div className="flex items-center justify-center h-64 text-[#555]">
            <div className="text-center">
              <p className="text-[16px] mb-2">Select an article to generate social posts</p>
              <p className="text-[12px] text-[#444]">AI extracts key data points and insights for each platform</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Article context */}
            <div className="flex items-start gap-4 p-4 rounded-xl bg-[#0c0c0c] border border-[#1a1a1a]">
              {selected.hero_image_url && (
                <img src={selected.hero_image_url} alt="" className="w-20 h-14 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-white leading-snug mb-1">{selected.title}</h3>
                <div className="text-[11px] text-[#555]">{selected.publish_date?.slice(0, 10)} · {SITE}/news/{selected.slug}/</div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={regenerate} className="px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-lg text-[12px] text-[#ccc] hover:text-white hover:border-[#444] transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>
                Regenerate
              </button>
              <button onClick={saveDraft} className="px-4 py-2 bg-[#ff6b4a] text-white rounded-lg text-[12px] font-semibold hover:bg-[#ff8566] transition-colors">
                Save Drafts
              </button>
            </div>

            {/* Twitter/X */}
            <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#0c0c0c] border-b border-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  <span className="text-[13px] font-semibold text-white">X / Twitter</span>
                  <span className={`text-[10px] ${editingTwitter.length > 280 ? "text-red-400" : "text-[#555]"}`}>{editingTwitter.length}/280</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyText(editingTwitter, "twitter")}
                    className="text-[11px] text-[#666] hover:text-white transition-colors">
                    {copied === "twitter" ? "Copied!" : "Copy"}
                  </button>
                  <a href={twitterShareUrl(editingTwitter)} target="_blank" rel="noopener"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-[11px] font-semibold text-white hover:bg-white/20 transition-colors">
                    Share on X →
                  </a>
                </div>
              </div>
              <textarea className="w-full h-32 bg-[#080808] p-4 text-[14px] text-[#ddd] leading-relaxed focus:outline-none resize-y"
                value={editingTwitter} onChange={(e) => setEditingTwitter(e.target.value)} />
            </div>

            {/* LinkedIn */}
            <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#0c0c0c] border-b border-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#0A66C2]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  <span className="text-[13px] font-semibold text-white">LinkedIn</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyText(editingLinkedin, "linkedin")}
                    className="text-[11px] text-[#666] hover:text-white transition-colors">
                    {copied === "linkedin" ? "Copied!" : "Copy"}
                  </button>
                  <a href={linkedinShareUrl(editingLinkedin, `${SITE}/news/${selected.slug}/`)} target="_blank" rel="noopener"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A66C2]/20 text-[11px] font-semibold text-[#0A66C2] hover:bg-[#0A66C2]/30 transition-colors">
                    Share on LinkedIn →
                  </a>
                </div>
              </div>
              <textarea className="w-full h-56 bg-[#080808] p-4 text-[14px] text-[#ddd] leading-relaxed focus:outline-none resize-y"
                value={editingLinkedin} onChange={(e) => setEditingLinkedin(e.target.value)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
