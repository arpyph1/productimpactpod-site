import React, { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }
interface Article { id: string; slug: string; title: string; is_lead_story: boolean; published: boolean; format: string; publish_date: string }

const SECTIONS = [
  { key: "show_hero", label: "Hero Carousel" },
  { key: "show_latest", label: "Latest Articles" },
  { key: "show_podcast", label: "Podcast Episodes" },
  { key: "show_featured", label: "Featured Reading (Evergreen Carousel)" },
  { key: "show_resources", label: "AI Strategy Resources" },
  { key: "show_newsletter", label: "Newsletter / Substack" },
  { key: "show_partners", label: "Partners" },
];

export default function HomepageScreen({ supabase }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [hp, setHp] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState("");

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

  function toggleSection(key: string, checked: boolean) {
    save({ ...hp, [key]: checked });
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

      {/* Section Visibility */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">Homepage Sections</h3>
        <p className="text-[12px] text-[#555] mb-4">Toggle visibility of each section on the homepage.</p>
        <div className="space-y-2">
          {SECTIONS.map((s) => (
            <label key={s.key} className="flex items-center gap-3 p-3 rounded-lg bg-[#111] border border-[#1a1a1a] cursor-pointer hover:bg-[#151515] transition-colors">
              <input type="checkbox" checked={hp[s.key] !== false}
                onChange={(e) => toggleSection(s.key, e.target.checked)}
                className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
              <span className={`text-[13px] ${hp[s.key] !== false ? "text-[#ccc]" : "text-[#555]"}`}>{s.label}</span>
            </label>
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
