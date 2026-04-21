import React, { useState, useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }
interface Article { id: string; slug: string; title: string; is_lead_story: boolean; published: boolean; format: string; publish_date: string }

interface SectionConfig {
  id: string;
  label: string;
  enabled: boolean;
  type: "carousel" | "vertical-list" | "special";
  theme: string;
  format: string;
}

const THEMES = [
  { slug: "", label: "All themes" },
  { slug: "ai-product-strategy", label: "AI Product Strategy" },
  { slug: "adoption-organizational-change", label: "Adoption & Organizational Change" },
  { slug: "agents-agentic-systems", label: "Agents & Agentic Systems" },
  { slug: "data-semantics-knowledge-foundations", label: "Data, Semantics & Knowledge" },
  { slug: "evaluation-benchmarking", label: "Evaluation & Benchmarking" },
  { slug: "go-to-market-distribution", label: "Go-to-Market & Distribution" },
  { slug: "governance-risk-trust", label: "Governance, Risk & Trust" },
  { slug: "ux-experience-design-for-ai", label: "UX & Experience Design for AI" },
];

const FORMATS = [
  { slug: "", label: "All formats" },
  { slug: "news-analysis", label: "News Analysis" },
  { slug: "feature", label: "Feature" },
  { slug: "data-reports", label: "Data & Reports" },
  { slug: "case-study", label: "Case Study" },
  { slug: "release-note", label: "Release" },
  { slug: "opinion", label: "Opinion" },
  { slug: "explainer", label: "Explainer" },
  { slug: "news-brief", label: "News Brief" },
  { slug: "product-review", label: "Product Review" },
  { slug: "research-brief", label: "Research Brief" },
];

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: "hero", label: "Hero Carousel", enabled: true, type: "carousel", theme: "", format: "" },
  { id: "latest", label: "Latest Articles", enabled: true, type: "vertical-list", theme: "", format: "" },
  { id: "podcast", label: "Podcast Episodes", enabled: true, type: "special", theme: "", format: "" },
  { id: "carousel2", label: "Carousel 2", enabled: true, type: "carousel", theme: "", format: "" },
  { id: "vertical2", label: "Vertical List 2", enabled: true, type: "vertical-list", theme: "", format: "" },
  { id: "featured", label: "Featured Reading", enabled: true, type: "carousel", theme: "", format: "" },
  { id: "resources", label: "AI Strategy Resources", enabled: true, type: "special", theme: "", format: "" },
  { id: "newsletter", label: "Newsletter / Substack", enabled: true, type: "special", theme: "", format: "" },
  { id: "partners", label: "Partners", enabled: true, type: "special", theme: "", format: "" },
];

export default function HomepageScreen({ supabase }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [hp, setHp] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [artRes, setRes] = await Promise.all([
      supabase.from("articles").select("id, slug, title, is_lead_story, published, format, publish_date").order("publish_date", { ascending: false }).limit(50),
      supabase.from("site_settings").select("*"),
    ]);
    if (artRes.data) setArticles(artRes.data);
    if (setRes.data) {
      const map: Record<string, any> = {};
      setRes.data.forEach((s: any) => { map[s.key] = s.value; });
      setHp(map.homepage ?? {});
    }
  }

  async function save(newHp: Record<string, any>) {
    setHp(newHp);
    const { error } = await supabase.from("site_settings").upsert({ key: "homepage", value: newHp, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) setMsg(`Error: ${error.message}`);
    else { setMsg("Saved"); setTimeout(() => setMsg(""), 2000); }
  }

  async function toggleLead(id: string, current: boolean) {
    await supabase.from("articles").update({ is_lead_story: !current }).eq("id", id);
    loadData();
  }

  const sections: SectionConfig[] = hp.sections ?? DEFAULT_SECTIONS;

  function updateSection(idx: number, patch: Partial<SectionConfig>) {
    const updated = sections.map((s, i) => i === idx ? { ...s, ...patch } : s);
    save({ ...hp, sections: updated });
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const updated = [...sections];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(idx, 0, moved);
    save({ ...hp, sections: updated });
    setDragIdx(null);
    setDragOverIdx(null);
  }

  function handleDragEnd() {
    setDragIdx(null);
    setDragOverIdx(null);
  }

  function toggleEvergreen(slug: string) {
    const current: string[] = hp.evergreen_slugs ?? [];
    const updated = current.includes(slug) ? current.filter((s: string) => s !== slug) : [...current, slug];
    save({ ...hp, evergreen_slugs: updated });
  }

  const evergreenSlugs: string[] = hp.evergreen_slugs ?? [];

  return (
    <div className="space-y-8 max-w-4xl">
      {msg && <div className={`px-4 py-2 rounded-lg text-[13px] font-medium ${msg.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>{msg}</div>}

      {/* Hero Carousel */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">Hero Carousel</h3>
        <p className="text-[12px] text-[#555] mb-4">Configure the homepage hero slider.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Carousel Mode</label>
            <select className="px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none"
              value={hp.carousel_mode ?? "latest"} onChange={(e) => save({ ...hp, carousel_mode: e.target.value })}>
              <option value="latest">Latest articles (auto)</option>
              <option value="lead">Lead stories only</option>
              <option value="manual">Manual selection</option>
            </select>
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Auto-rotate (sec)</label>
              <input type="number" min={3} max={30} className="w-28 px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none"
                defaultValue={hp.carousel_interval ?? 6} onBlur={(e) => save({ ...hp, carousel_interval: parseInt(e.target.value) || 6 })} />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#888] mb-1.5">Max slides</label>
              <input type="number" min={1} max={12} className="w-28 px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none"
                defaultValue={hp.carousel_max ?? 6} onBlur={(e) => save({ ...hp, carousel_max: parseInt(e.target.value) || 6 })} />
            </div>
          </div>
        </div>
      </section>

      {/* Lead Stories */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">Lead Stories</h3>
        <p className="text-[12px] text-[#555] mb-4">Toggle articles as lead stories for the hero carousel.</p>
        <div className="grid grid-cols-1 gap-1">
          <div className="grid grid-cols-[auto_1fr_100px_80px] gap-4 px-3 py-2 text-[11px] font-semibold text-[#555] uppercase tracking-wider">
            <span>Lead</span><span>Title</span><span>Format</span><span>Date</span>
          </div>
          {articles.filter(a => a.published).slice(0, 20).map((a) => (
            <div key={a.id} className="grid grid-cols-[auto_1fr_100px_80px] gap-4 px-3 py-2.5 rounded-lg hover:bg-[#111] items-center">
              <input type="checkbox" checked={a.is_lead_story} onChange={() => toggleLead(a.id, a.is_lead_story)}
                className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
              <span className="text-[13px] text-[#ccc] truncate">{a.title}</span>
              <span className="text-[11px] text-[#555]">{a.format}</span>
              <span className="text-[11px] text-[#555]">{a.publish_date?.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Homepage Sections — drag to reorder */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">Homepage Sections</h3>
        <p className="text-[12px] text-[#555] mb-4">Drag to reorder. Configure label, theme, and format filters for each section.</p>
        <div className="space-y-2">
          {sections.map((s, idx) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={`p-4 rounded-xl border transition-all ${
                dragOverIdx === idx ? "border-[#ff6b4a] bg-[#ff6b4a]/5" :
                dragIdx === idx ? "opacity-40 border-[#333]" :
                "border-[#1a1a1a] bg-[#0c0c0c]"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                {/* Drag handle */}
                <div className="cursor-grab active:cursor-grabbing text-[#444] hover:text-[#888] select-none" title="Drag to reorder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
                </div>
                {/* Enabled toggle */}
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) => updateSection(idx, { enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]"
                />
                {/* Section label (editable) */}
                <input
                  type="text"
                  className="flex-1 px-3 py-1.5 bg-transparent border border-transparent hover:border-[#222] focus:border-[#ff6b4a]/50 rounded-lg text-[14px] font-semibold text-white focus:outline-none"
                  defaultValue={s.label}
                  onBlur={(e) => updateSection(idx, { label: e.target.value })}
                />
                {/* Type badge */}
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#555] px-2 py-0.5 rounded bg-[#111] border border-[#222]">
                  {s.type === "carousel" ? "Carousel" : s.type === "vertical-list" ? "List" : "Special"}
                </span>
              </div>

              {/* Theme + Format filters (only for carousel and vertical-list) */}
              {s.type !== "special" && (
                <div className="flex gap-3 ml-9">
                  <div className="flex-1">
                    <label className="block text-[10px] font-medium text-[#666] mb-1">Theme filter</label>
                    <select
                      className="w-full px-3 py-1.5 bg-[#111] border border-[#222] rounded-lg text-[12px] text-white focus:outline-none"
                      value={s.theme}
                      onChange={(e) => updateSection(idx, { theme: e.target.value })}
                    >
                      {THEMES.map(t => <option key={t.slug} value={t.slug}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-medium text-[#666] mb-1">Format filter</label>
                    <select
                      className="w-full px-3 py-1.5 bg-[#111] border border-[#222] rounded-lg text-[12px] text-white focus:outline-none"
                      value={s.format}
                      onChange={(e) => updateSection(idx, { format: e.target.value })}
                    >
                      {FORMATS.map(f => <option key={f.slug} value={f.slug}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Evergreen / Featured Reading Carousel */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">Evergreen Carousel (Featured Reading)</h3>
        <p className="text-[12px] text-[#555] mb-4">Select articles to display in the "Featured Reading" carousel. Edit the section title below.</p>

        <div className="mb-4">
          <label className="block text-[12px] font-medium text-[#888] mb-1.5">Section Title</label>
          <input type="text" className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
            defaultValue={hp.evergreen_title ?? "Featured Reading"}
            onBlur={(e) => save({ ...hp, evergreen_title: e.target.value })} />
        </div>

        {evergreenSlugs.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-[#0c0c0c] border border-[#1a1a1a]">
            <div className="text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-2">Selected ({evergreenSlugs.length})</div>
            <div className="flex flex-wrap gap-2">
              {evergreenSlugs.map((slug: string) => {
                const art = articles.find(a => a.slug === slug);
                return (
                  <span key={slug} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#ff6b4a]/10 border border-[#ff6b4a]/20 rounded-lg text-[11px] text-[#ff6b4a]">
                    {art?.title?.slice(0, 40) ?? slug}
                    <button onClick={() => toggleEvergreen(slug)} className="hover:text-white">&times;</button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-1 max-h-[400px] overflow-y-auto">
          <div className="grid grid-cols-[auto_1fr_100px_80px] gap-4 px-3 py-2 text-[11px] font-semibold text-[#555] uppercase tracking-wider sticky top-0 bg-[#080808]">
            <span>Pick</span><span>Title</span><span>Format</span><span>Date</span>
          </div>
          {articles.filter(a => a.published).map((a) => (
            <div key={a.id} className={`grid grid-cols-[auto_1fr_100px_80px] gap-4 px-3 py-2.5 rounded-lg hover:bg-[#111] items-center ${evergreenSlugs.includes(a.slug) ? "bg-[#ff6b4a]/5" : ""}`}>
              <input type="checkbox" checked={evergreenSlugs.includes(a.slug)} onChange={() => toggleEvergreen(a.slug)}
                className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
              <span className="text-[13px] text-[#ccc] truncate">{a.title}</span>
              <span className="text-[11px] text-[#555]">{a.format}</span>
              <span className="text-[11px] text-[#555]">{a.publish_date?.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Homepage Copy */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">Homepage Copy</h3>
        <p className="text-[12px] text-[#555] mb-4">Edit section headings and copy.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Podcast Section Tagline</label>
            <input type="text" className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              defaultValue={hp.podcast_tagline ?? "Prove impact. Improve impact. Scale impact."}
              onBlur={(e) => save({ ...hp, podcast_tagline: e.target.value })} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Newsletter CTA Heading</label>
            <input type="text" className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              defaultValue={hp.newsletter_heading ?? "Subscribe to our Substack"}
              onBlur={(e) => save({ ...hp, newsletter_heading: e.target.value })} />
          </div>
        </div>
      </section>
    </div>
  );
}
