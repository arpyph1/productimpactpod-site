import React, { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }

interface Episode {
  id: string; episode_guid: string; slug: string | null; title: string;
  episode_number: number | null; season_number: number | null;
  published_at: string | null; published: boolean; duration: string | null;
  meta_description: string | null; themes: string[] | null;
}

export default function PodcastScreen({ supabase }: Props) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [epRes, setRes] = await Promise.all([
      supabase.from("episode_shownotes").select("*").order("published_at", { ascending: false }).limit(100),
      supabase.from("site_settings").select("*"),
    ]);
    if (epRes.data) setEpisodes(epRes.data);
    if (setRes.data) {
      const map: Record<string, any> = {};
      setRes.data.forEach((s: any) => { map[s.key] = s.value; });
      setSettings(map);
    }
    setLoading(false);
  }

  async function saveSetting(key: string, value: any) {
    const { error } = await supabase.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) setMsg(`Error: ${error.message}`);
    else { setMsg("Saved"); setTimeout(() => setMsg(""), 2000); }
  }

  async function saveEpisode(ep: Episode) {
    const { error } = await supabase.from("episode_shownotes").update({
      title: ep.title,
      slug: ep.slug,
      meta_description: ep.meta_description,
      themes: ep.themes,
      published: ep.published,
    }).eq("id", ep.id);
    if (error) setMsg(`Error: ${error.message}`);
    else { setMsg("Saved"); setEditing(null); setTimeout(() => setMsg(""), 2000); loadData(); }
  }

  async function togglePublished(id: string, current: boolean) {
    await supabase.from("episode_shownotes").update({ published: !current }).eq("id", id);
    setEpisodes(prev => prev.map(e => e.id === id ? { ...e, published: !current } : e));
  }

  const pc = settings.podcast ?? {};

  return (
    <div className="space-y-8">
      {msg && <div className="px-4 py-2 rounded-lg text-[13px] font-medium bg-green-500/10 text-green-400 max-w-3xl">{msg}</div>}

      {/* Podcast Page Content */}
      <section className="max-w-3xl">
        <h3 className="text-[16px] font-bold text-white mb-4">Podcast Page Content</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Hero Tagline</label>
            <input type="text" className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              defaultValue={pc.hero_tagline ?? "Prove impact. Improve impact. Scale impact."}
              onBlur={(e) => saveSetting("podcast", { ...pc, hero_tagline: e.target.value })} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Hero Description</label>
            <textarea className="w-full h-24 bg-[#111] border border-[#222] rounded-lg p-3 text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50 resize-y"
              defaultValue={pc.hero_description ?? "Follow the Product Impact Podcast to learn frameworks and strategies to ensure your product is delivering impact to users, teams, businesses, and communities."}
              onBlur={(e) => saveSetting("podcast", { ...pc, hero_description: e.target.value })} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Spotify Show URL</label>
            <input type="text" className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              defaultValue={pc.spotify_url ?? ""}
              onBlur={(e) => saveSetting("podcast", { ...pc, spotify_url: e.target.value })} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">Apple Podcasts URL</label>
            <input type="text" className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              defaultValue={pc.apple_url ?? ""}
              onBlur={(e) => saveSetting("podcast", { ...pc, apple_url: e.target.value })} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">YouTube Channel URL</label>
            <input type="text" className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              defaultValue={pc.youtube_url ?? ""}
              onBlur={(e) => saveSetting("podcast", { ...pc, youtube_url: e.target.value })} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#888] mb-1.5">RSS Feed URL</label>
            <input type="text" className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
              defaultValue={pc.rss_url ?? "https://anchor.fm/s/f32cce5c/podcast/rss"}
              onBlur={(e) => saveSetting("podcast", { ...pc, rss_url: e.target.value })} />
          </div>
        </div>
      </section>

      {/* Episodes */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-4">Episodes (Supabase)</h3>
        <p className="text-[12px] text-[#555] mb-4">Episodes from the episode_shownotes table. These provide show notes for episodes fetched via RSS.</p>

        {loading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" /></div>
        ) : episodes.length === 0 ? (
          <p className="text-[13px] text-[#555] py-8">No episodes in database. Episodes are populated via the RSS feed at build time.</p>
        ) : (
          <div className="border border-[#1a1a1a] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0c0c0c] text-[11px] font-semibold text-[#555] uppercase tracking-wider">
                  <th className="text-left px-4 py-3 w-12">Pub</th>
                  <th className="text-left px-4 py-3 w-20">EP</th>
                  <th className="text-left px-4 py-3">Title</th>
                  <th className="text-left px-4 py-3 w-28">Date</th>
                  <th className="text-left px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]">
                {episodes.map((ep) => (
                  <tr key={ep.id} className="hover:bg-[#0c0c0c] transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => togglePublished(ep.id, ep.published)}
                        className={`w-3 h-3 rounded-full ${ep.published ? "bg-green-500" : "bg-[#333]"}`} />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#888]">
                      {ep.season_number && ep.episode_number ? `S${ep.season_number}E${ep.episode_number}` : ep.episode_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#ccc] line-clamp-1">{ep.title}</td>
                    <td className="px-4 py-3 text-[11px] text-[#666]">{ep.published_at?.slice(0, 10) ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setEditing(ep)} className="text-[11px] text-[#ff6b4a] hover:text-[#ff8566] font-medium">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Episode edit modal */}
      {editing && (
        <EpisodeEditModal episode={editing} onClose={() => setEditing(null)} onSave={saveEpisode} />
      )}
    </div>
  );
}

function EpisodeEditModal({ episode, onClose, onSave }: { episode: Episode; onClose: () => void; onSave: (ep: Episode) => void }) {
  const [form, setForm] = useState({ ...episode });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg bg-[#0c0c0c] border border-[#222] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold text-white">Edit Episode</h3>
          <button onClick={onClose} className="text-[#555] hover:text-white">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[#666] mb-1">Title</label>
          <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[#666] mb-1">Slug</label>
          <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[12px] text-[#888] font-mono focus:outline-none"
            value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[#666] mb-1">Meta Description</label>
          <textarea className="w-full h-20 bg-[#111] border border-[#222] rounded-lg p-3 text-[13px] text-white focus:outline-none resize-y"
            value={form.meta_description ?? ""} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })}
            className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
          <span className="text-[13px] text-[#ccc]">Published</span>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#888] hover:text-white transition-colors">Cancel</button>
          <button onClick={() => onSave(form)} className="px-5 py-2 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566]">Save</button>
        </div>
      </div>
    </div>
  );
}
