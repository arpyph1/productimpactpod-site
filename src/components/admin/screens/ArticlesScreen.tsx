import React, { useState, useEffect, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props {
  supabase: SupabaseClient;
  onEditArticle: (article: any) => void;
}

interface Article {
  id: string; slug: string; title: string; subtitle: string | null; format: string;
  author_slugs: string[] | null; publish_date: string; published: boolean;
  scheduled_at: string | null;
  is_lead_story: boolean; hero_image_url: string | null; themes: string[] | null;
  meta_description: string | null; read_time_minutes: number | null;
}

const FORMAT_LABELS: Record<string, string> = {
  "news-analysis": "News Analysis", feature: "Feature", "data-reports": "Data & Reports",
  "case-study": "Case Study", "release-note": "Release", opinion: "Opinion",
  explainer: "Explainer", "news-brief": "Brief", "product-review": "Review",
  "research-brief": "Research",
};

const AUTHOR_OPTIONS = [
  { slug: "arpy-dragffy", name: "Arpy Dragffy" },
  { slug: "brittany-hobbs", name: "Brittany Hobbs" },
  { slug: "product-impact", name: "Product Impact" },
];

export default function ArticlesScreen({ supabase, onEditArticle }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState("");
  const [filterFormat, setFilterFormat] = useState("");
  const [filterPub, setFilterPub] = useState<"all" | "published" | "draft" | "scheduled">("all");
  const [loading, setLoading] = useState(true);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("articles")
      .select("id, slug, title, subtitle, format, author_slugs, publish_date, published, scheduled_at, is_lead_story, hero_image_url, themes, meta_description, read_time_minutes")
      .order("publish_date", { ascending: false })
      .limit(200);

    if (filterFormat) q = q.eq("format", filterFormat);
    if (filterPub === "published") q = q.eq("published", true);
    if (filterPub === "draft") q = q.eq("published", false).is("scheduled_at", null);
    if (filterPub === "scheduled") q = q.eq("published", false).not("scheduled_at", "is", null);

    const { data } = await q;
    setArticles(data ?? []);
    setLoading(false);
  }, [filterFormat, filterPub]);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  async function togglePublished(id: string, current: boolean) {
    await supabase.from("articles").update({ published: !current }).eq("id", id);
    setArticles(prev => prev.map(a => a.id === id ? { ...a, published: !current } : a));
  }

  async function openArticle(article: Article | null) {
    if (!article?.id) { onEditArticle(null); return; }
    const { data } = await supabase.from("articles").select("*").eq("id", article.id).single();
    onEditArticle(data ?? article);
  }

  async function updateField(id: string, field: string, value: any) {
    await supabase.from("articles").update({ [field]: value }).eq("id", id);
    loadArticles();
  }

  const filtered = articles.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.title.toLowerCase().includes(q) || (a.slug ?? "").includes(q) || (a.meta_description ?? "").toLowerCase().includes(q);
  });

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" placeholder="Search articles..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6b4a]/50"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="px-3 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
          value={filterFormat} onChange={(e) => setFilterFormat(e.target.value)}>
          <option value="">All formats</option>
          {Object.entries(FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="px-3 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
          value={filterPub} onChange={(e) => setFilterPub(e.target.value as any)}>
          <option value="all">All status</option>
          <option value="published">Published</option>
          <option value="scheduled">Scheduled</option>
          <option value="draft">Draft</option>
        </select>
        <button onClick={() => openArticle(null)}
          className="px-4 py-2.5 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566] transition-colors flex items-center gap-1.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          New Article
        </button>
      </div>

      <div className="text-[12px] text-[#555] mb-3">{filtered.length} articles</div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="border border-[#1a1a1a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0c0c0c] text-[11px] font-semibold text-[#555] uppercase tracking-wider">
                <th className="text-left px-4 py-3 w-12">Pub</th>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3 w-24">Format</th>
                <th className="text-left px-4 py-3 w-24">Author</th>
                <th className="text-left px-4 py-3">Themes / Topics</th>
                <th className="text-left px-4 py-3 w-24">Date</th>
                <th className="text-left px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-[#0c0c0c] transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => togglePublished(a.id, a.published)}
                      className={`w-3 h-3 rounded-full ${a.published ? "bg-green-500" : a.scheduled_at ? "bg-amber-500" : "bg-[#333]"}`}
                      title={a.published ? "Published — click to unpublish" : a.scheduled_at ? `Scheduled: ${new Date(a.scheduled_at).toLocaleString()}` : "Draft — click to publish"} />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openArticle(a)} className="text-left group">
                      <div className="text-[13px] font-medium text-[#ccc] group-hover:text-white transition-colors line-clamp-1">{a.title}</div>
                      {a.subtitle && <div className="text-[11px] text-[#555] line-clamp-1">{a.subtitle}</div>}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <select className="bg-transparent text-[11px] text-[#666] hover:text-white focus:outline-none cursor-pointer appearance-none pr-4"
                      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right center" }}
                      value={a.format} onChange={(e) => updateField(a.id, "format", e.target.value)}>
                      {Object.entries(FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select className="bg-transparent text-[11px] text-[#666] hover:text-white focus:outline-none cursor-pointer appearance-none pr-4"
                      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right center" }}
                      value={a.author_slugs?.[0] ?? ""} onChange={(e) => updateField(a.id, "author_slugs", [e.target.value])}>
                      <option value="">—</option>
                      {AUTHOR_OPTIONS.map((au) => <option key={au.slug} value={au.slug}>{au.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(a.themes ?? []).map((t: string) => (
                        <span key={t} className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#ff6b4a]/10 text-[#ff6b4a] border border-[#ff6b4a]/20">{t.replace(/-/g, " ").slice(0, 20)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input type="date" className="bg-transparent text-[11px] text-[#666] hover:text-white focus:outline-none cursor-pointer"
                      value={a.publish_date?.slice(0, 10) ?? ""} onChange={(e) => updateField(a.id, "publish_date", e.target.value)} />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openArticle(a)} className="text-[11px] text-[#ff6b4a] hover:text-[#ff8566] font-medium">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-[#555] text-[14px]">No articles found</div>
          )}
        </div>
      )}
    </div>
  );
}

