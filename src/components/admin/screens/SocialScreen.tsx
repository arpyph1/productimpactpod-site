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

const VOICE_PROFILES: Record<Voice, {
  label: string;
  twitterHandle: string;
  twitterIntros: string[];
  linkedinIntros: string[];
  linkedinSignoffs: string[];
  tone: string[];
}> = {
  "product-impact": {
    label: "Product Impact",
    twitterHandle: "@productimpactpod",
    twitterIntros: [
      "", "New on Product Impact:", "Just published:", "Our latest analysis:",
      "Worth reading:", "This week on Product Impact:",
    ],
    linkedinIntros: [
      "We just published a new analysis.",
      "New on Product Impact — worth a read if you're in AI product leadership.",
      "Our latest piece digs into something we keep hearing about.",
      "We've been tracking this. Here's what the data says.",
    ],
    linkedinSignoffs: [
      "#AIProducts #ProductStrategy #ProductImpact",
      "#AI #ProductManagement",
      "#AIStrategy #Enterprise #ProductImpact",
      "#ProductLeadership #AI",
    ],
    tone: [
      "editorial", "analytical", "direct", "matter-of-fact",
    ],
  },
  arpy: {
    label: "Arpy Dragffy",
    twitterHandle: "@adragffy",
    twitterIntros: [
      "Something I've been thinking about —", "This one's important.",
      "Hot take:", "The data on this is wild —", "I wrote about this:",
      "Been researching this. Key finding:", "Can't stop thinking about this —",
    ],
    linkedinIntros: [
      "I've been digging into this and the numbers don't lie.",
      "Something shifted this quarter and I think product leaders need to pay attention.",
      "I wrote this because I kept hearing the same question from product teams.",
      "This came up on the podcast and I decided to go deeper.",
      "A pattern I keep seeing across enterprise AI deployments:",
    ],
    linkedinSignoffs: [
      "What are you seeing on your end?",
      "Curious what others are experiencing.",
      "Would love to hear if this matches your experience.",
      "The full analysis is on Product Impact — link in comments.",
      "Thoughts?",
    ],
    tone: [
      "personal", "opinionated", "conversational", "provocative",
    ],
  },
  brittany: {
    label: "Brittany Hobbs",
    twitterHandle: "@brittanyhobbs",
    twitterIntros: [
      "The research on this is clear —", "New findings:",
      "As a researcher, this stood out to me:", "Data point worth knowing:",
      "Important nuance here:", "Here's what the evidence actually says:",
    ],
    linkedinIntros: [
      "From a research perspective, this is significant.",
      "I've been studying this problem and the gap between perception and reality is striking.",
      "New research findings that product and UX teams should know about.",
      "The behavioral science angle on this is really interesting.",
      "I co-authored this piece because the adoption data tells a different story than the headlines.",
    ],
    linkedinSignoffs: [
      "The methodology and full findings are in the article.",
      "Happy to discuss the research approach if anyone wants to go deeper.",
      "What patterns are you seeing in your organization?",
      "Full analysis on Product Impact.",
    ],
    tone: [
      "research-driven", "evidence-based", "nuanced", "measured",
    ],
  },
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function extractInsight(article: Article): string {
  const desc = article.meta_description ?? "";
  const html = article.content_html ?? "";
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  const statMatch = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\s+(?:of|percent|billion|million|trillion)[^.]{5,60}\.)/i)
    || text.match(/((?:only|just|over|nearly|almost|more than)\s+\d[^.]{5,60}\.)/i)
    || desc.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?%[^.]{5,50}\.)/i);

  if (statMatch) return statMatch[1].trim();

  const sentences = desc.split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
  return sentences[0] ?? desc.slice(0, 200);
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

  return picks.length > 0 ? picks.join("\n") : sentences.slice(1, 4).map(s => "→ " + s).join("\n");
}

function generateTwitter(article: Article, voice: Voice): string {
  const v = VOICE_PROFILES[voice];
  const insight = extractInsight(article);
  const intro = pick(v.twitterIntros);
  const link = `${SITE}/news/${article.slug}/`;

  const variants = [
    () => `${intro ? intro + " " : ""}${insight}\n\n${link}`,
    () => `${intro ? intro + "\n\n" : ""}${article.title}\n\n${insight.slice(0, 120)}\n\n${link}`,
    () => `${insight}\n\n${intro ? intro + " " : ""}${link}`,
    () => `"${article.title}"\n\n${insight}\n\n${link}`,
    () => `${intro ? intro + "\n\n" : ""}${insight}\n\n👇\n${link}`,
  ];

  let text = pick(variants)();
  if (text.length > 280) text = `${insight.slice(0, 220)}\n\n${link}`;
  return text;
}

function generateLinkedin(article: Article, voice: Voice): string {
  const v = VOICE_PROFILES[voice];
  const insight = extractInsight(article);
  const body = extractBody(article);
  const intro = pick(v.linkedinIntros);
  const signoff = pick(v.linkedinSignoffs);
  const link = `${SITE}/news/${article.slug}/`;

  const variants = [
    () => `${intro}\n\n${insight}\n\n${body}\n\n${article.title}\n${link}\n\n${signoff}`,
    () => `${insight}\n\n${intro}\n\n${body}\n\nFull analysis → ${link}\n\n${signoff}`,
    () => `${article.title}\n\n${insight}\n\n${body}\n\n${link}\n\n${signoff}`,
    () => `${intro}\n\n${insight}\n\nKey findings:\n${body}\n\n👉 ${link}\n\n${signoff}`,
  ];

  return pick(variants)();
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
    setMsg("Draft saved"); setTimeout(() => setMsg(""), 2000);
  }

  async function copyText(text: string, platform: string) {
    await navigator.clipboard.writeText(text);
    setCopied(platform);
    setTimeout(() => setCopied(""), 2000);
  }

  const selected = articles.find(a => a.id === selectedId);

  if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" /></div>;

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
              <p className="text-[12px] text-[#444]">Choose a voice per platform — each generates different tone and framing</p>
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
              onVoiceChange={(v) => { setTwitterVoice(v); }}
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
              onVoiceChange={(v) => { setLinkedinVoice(v); }}
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

function PlatformCard({ platform, icon, label, voice, onVoiceChange, text, onTextChange, onRegenerate, onCopy, copied, charLimit, shareUrl, shareLabel, shareClass }: {
  platform: string; icon: React.ReactNode; label: string;
  voice: Voice; onVoiceChange: (v: Voice) => void;
  text: string; onTextChange: (t: string) => void;
  onRegenerate: () => void; onCopy: () => void; copied: boolean;
  charLimit?: number; shareUrl: string; shareLabel: string; shareClass: string;
}) {
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
        <span className="text-[10px] text-[#444]">Voice: <strong className="text-[#888]">{VOICE_PROFILES[voice].label}</strong> — {pick(VOICE_PROFILES[voice].tone)}</span>
      </div>
      <textarea className={`w-full bg-[#080808] p-4 text-[14px] text-[#ddd] leading-relaxed focus:outline-none resize-y ${platform === "twitter" ? "h-32" : "h-56"}`}
        value={text} onChange={(e) => onTextChange(e.target.value)} />
    </div>
  );
}
