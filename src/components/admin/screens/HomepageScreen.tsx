import React, { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }
interface Article { id: string; slug: string; title: string; is_lead_story: boolean; published: boolean; format: string; publish_date: string }

export default function HomepageScreen({ supabase }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
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
      setSettings(map);
    }
  }

  async function save(key: string, value: any) {
    const { error } = await supabase.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) setMsg(`Error: ${error.message}`);
    else { setMsg("Saved"); setTimeout(() => setMsg(""), 2000); }
  }

  async function toggleLead(id: string, current: boolean) {
    await supabase.from("articles").update({ is_lead_story: !current }).eq("id", id);
    loadData();
  }

  const hp = settings.homepage ?? {};
  const carouselSlugs: string[] = hp.carousel_slugs ?? [];
  const leadArticles = articles.filter(a => a.is_lead_story);

  return (
    <div className="space-y-8 max-w-4xl">
      {msg && <div className="px-4 py-2 rounded-lg text-[13px] font-medium bg-green-500/10 text-green-400">{msg}</div>}

      {/* Hero Carousel */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">Hero Carousel</h3>
        <p className="text-[12px] text-[#555] mb-4">Select which articles appear in the homepage hero slider. If none selected, the 6 most recent articles are used.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Carousel Mode</label>
            <select
              className="px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              value={hp.carousel_mode ?? "latest"}
              onChange={(e) => save("homepage", { ...hp, carousel_mode: e.target.value })}
            >
              <option value="latest">Latest articles (auto)</option>
              <option value="lead">Lead stories only</option>
              <option value="manual">Manual selection</option>
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Auto-rotate interval (seconds)</label>
            <input type="number" min={3} max={30}
              className="w-32 px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              defaultValue={hp.carousel_interval ?? 6}
              onBlur={(e) => save("homepage", { ...hp, carousel_interval: parseInt(e.target.value) || 6 })}
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Max slides</label>
            <input type="number" min={1} max={12}
              className="w-32 px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              defaultValue={hp.carousel_max ?? 6}
              onBlur={(e) => save("homepage", { ...hp, carousel_max: parseInt(e.target.value) || 6 })}
            />
          </div>
        </div>
      </section>

      {/* Lead Story Selection */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">Lead Stories</h3>
        <p className="text-[12px] text-[#555] mb-4">Toggle articles as lead stories. Lead stories appear in the hero when carousel mode is "Lead stories only".</p>

        <div className="grid grid-cols-1 gap-1">
          <div className="grid grid-cols-[auto_1fr_100px_80px] gap-4 px-3 py-2 text-[11px] font-semibold text-[#555] uppercase tracking-wider">
            <span>Lead</span>
            <span>Title</span>
            <span>Format</span>
            <span>Date</span>
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
        <p className="text-[12px] text-[#555] mb-4">Toggle visibility of homepage sections.</p>

        <div className="space-y-2">
          {[
            { key: "show_hero", label: "Hero Carousel", default: true },
            { key: "show_latest", label: "Latest Articles", default: true },
            { key: "show_podcast", label: "Podcast Episodes", default: true },
            { key: "show_featured", label: "Featured Reading", default: true },
            { key: "show_resources", label: "AI Strategy Resources", default: true },
            { key: "show_newsletter", label: "Newsletter / Substack", default: true },
            { key: "show_partners", label: "Partners", default: true },
          ].map((s) => (
            <label key={s.key} className="flex items-center gap-3 p-3 rounded-lg bg-[#111] border border-[#1a1a1a] cursor-pointer hover:bg-[#151515] transition-colors">
              <input type="checkbox" checked={hp[s.key] !== false}
                onChange={(e) => save("homepage", { ...hp, [s.key]: e.target.checked })}
                className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
              <span className="text-[13px] text-[#ccc]">{s.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Homepage Copy */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">Homepage Copy</h3>
        <p className="text-[12px] text-[#555] mb-4">Edit the subtitle and section headings.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Podcast Section Tagline</label>
            <input type="text"
              className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              defaultValue={hp.podcast_tagline ?? "Prove impact. Improve impact. Scale impact."}
              onBlur={(e) => save("homepage", { ...hp, podcast_tagline: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Newsletter CTA Heading</label>
            <input type="text"
              className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              defaultValue={hp.newsletter_heading ?? "Subscribe to our Substack"}
              onBlur={(e) => save("homepage", { ...hp, newsletter_heading: e.target.value })}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
