import React, { useState, useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }

interface Sponsor {
  id: string; slug: string; name: string; tagline: string | null;
  description: string | null; logo_url: string | null; website_url: string | null;
  cta_text: string | null; tier: string | null; active: boolean;
  display_order: number | null; themes: string[] | null; created_at: string;
}

interface DisplayAd { id: string; name: string; image_url: string; link_url: string; active: boolean; media_type?: "image" | "video" }

interface HouseAd {
  enabled: boolean;
  presented_by_label: string;
  logo_url: string;
  logo_alt: string;
  link_url: string;
  headline: string;
  tagline: string;
  cta_text: string;
}

interface AdBullet { label: string; url: string; }
interface ArticleAd {
  id: string; title: string; active: boolean;
  logo_url: string; logo_link: string; logo_alt: string;
  headline: string; eyebrow: string;
  bullets: AdBullet[];
  position_heading: number; display_order: number;
}

const DEFAULT_HOUSE_AD: HouseAd = {
  enabled: true,
  presented_by_label: "Presented by",
  logo_url: "https://github.com/arpyph1/my-assets/blob/main/ph1_logo-200-271.png?raw=true",
  logo_alt: "PH1",
  link_url: "https://ph1.ca",
  headline: "PH1 runs the user research that tells you whether your AI product actually works for real people — before you ship it.",
  tagline: "Ship products proven to deliver impact in the AI era.",
  cta_text: "Learn more",
};

const SEED_PARTNERS = [
  { slug: "ph1", name: "PH1", tagline: "Ship products that are proven to deliver impact in the AI era", logo_url: "https://github.com/arpyph1/my-assets/blob/main/ph1_logo-200-271.png?raw=true", website_url: "https://ph1.ca", tier: "founding", active: true, display_order: 0 },
  { slug: "ai-value-acceleration", name: "AI Value Acceleration", tagline: "We find exactly where value stalls, why, and whose job it is to fix", logo_url: "https://aivalueacceleration.com/assets/logo-horizontal-dark-bg-B7ZF_V6_.png", website_url: "https://aivalueacceleration.com/", tier: "founding", active: true, display_order: 1 },
];

export default function PartnersScreen({ supabase }: Props) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [editing, setEditing] = useState<Partial<Sponsor> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [ads, setAds] = useState<DisplayAd[]>([]);
  const [adName, setAdName] = useState("");
  const [adLink, setAdLink] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);
  const adRef = useRef<HTMLInputElement>(null);

  const [houseAd, setHouseAd] = useState<HouseAd>(DEFAULT_HOUSE_AD);

  // Article inline ads state
  const [articleAds, setArticleAds] = useState<ArticleAd[]>([]);
  const [editingAd, setEditingAd] = useState<Partial<ArticleAd> | null>(null);
  const [isNewAd, setIsNewAd] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [spRes, setRes, aaRes, haRes] = await Promise.all([
      supabase.from("sponsors").select("*").order("display_order"),
      supabase.from("site_settings").select("*").eq("key", "display_ads"),
      supabase.from("article_ads").select("*").order("display_order"),
      supabase.from("site_settings").select("*").eq("key", "house_ad"),
    ]);
    if (spRes.data) setSponsors(spRes.data);
    if (setRes.data?.[0]?.value?.ads) setAds(setRes.data[0].value.ads);
    if (aaRes.data) setArticleAds(aaRes.data as ArticleAd[]);
    if (haRes.data?.[0]?.value) setHouseAd({ ...DEFAULT_HOUSE_AD, ...haRes.data[0].value });
    setLoading(false);
  }

  async function saveArticleAd() {
    if (!editingAd) return;
    if (!editingAd.title?.trim()) { setMsg("Internal title is required"); return; }
    const payload: any = {
      title: editingAd.title,
      active: editingAd.active ?? true,
      logo_url: editingAd.logo_url ?? "",
      logo_link: editingAd.logo_link ?? "",
      logo_alt: editingAd.logo_alt ?? "",
      headline: editingAd.headline ?? "",
      eyebrow: editingAd.eyebrow ?? "",
      bullets: editingAd.bullets ?? [],
      position_heading: editingAd.position_heading ?? 3,
      display_order: editingAd.display_order ?? articleAds.length,
      updated_at: new Date().toISOString(),
    };
    let error;
    if (isNewAd) {
      error = (await supabase.from("article_ads").insert(payload)).error;
    } else {
      error = (await supabase.from("article_ads").update(payload).eq("id", editingAd.id)).error;
    }
    if (error) setMsg(`Error: ${error.message}`);
    else { setMsg("Saved — rebuild site to publish"); setEditingAd(null); setTimeout(() => setMsg(""), 3000); loadAll(); }
  }

  async function deleteArticleAd(id: string) {
    if (!confirm("Delete this article ad?")) return;
    await supabase.from("article_ads").delete().eq("id", id);
    loadAll();
  }

  async function toggleArticleAdActive(id: string, current: boolean) {
    await supabase.from("article_ads").update({ active: !current, updated_at: new Date().toISOString() }).eq("id", id);
    setArticleAds(prev => prev.map(a => a.id === id ? { ...a, active: !current } : a));
  }

  function newArticleAd(): Partial<ArticleAd> {
    return {
      title: "", active: true,
      logo_url: "", logo_link: "", logo_alt: "",
      headline: "", eyebrow: "",
      bullets: [{ label: "", url: "" }],
      position_heading: 3, display_order: articleAds.length,
    };
  }

  async function seedPartners() {
    for (const p of SEED_PARTNERS) {
      await supabase.from("sponsors").upsert(p, { onConflict: "slug" });
    }
    setMsg("Seeded PH1 & AI Value Acceleration"); setTimeout(() => setMsg(""), 2000);
    loadAll();
  }

  async function saveSponsor() {
    if (!editing) return;
    if (!editing.name?.trim()) { setMsg("Name is required"); return; }
    if (!editing.slug?.trim()) editing.slug = editing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const payload: any = { ...editing };
    delete payload.id; delete payload.created_at;
    let error;
    if (isNew) { error = (await supabase.from("sponsors").insert(payload)).error; }
    else { error = (await supabase.from("sponsors").update(payload).eq("id", editing.id)).error; }
    if (error) setMsg(`Error: ${error.message}`);
    else { setMsg("Saved"); setEditing(null); setTimeout(() => setMsg(""), 2000); loadAll(); }
  }

  async function deleteSponsor(id: string) {
    if (!confirm("Delete this partner?")) return;
    const { error } = await supabase.from("sponsors").delete().eq("id", id);
    if (error) { alert(`Delete failed: ${error.message}`); return; }
    loadAll();
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("sponsors").update({ active: !current }).eq("id", id);
    setSponsors(prev => prev.map(s => s.id === id ? { ...s, active: !current } : s));
  }

  async function moveOrder(id: string, dir: "up" | "down") {
    const idx = sponsors.findIndex(s => s.id === id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sponsors.length) return;
    await Promise.all([
      supabase.from("sponsors").update({ display_order: swapIdx }).eq("id", sponsors[idx].id),
      supabase.from("sponsors").update({ display_order: idx }).eq("id", sponsors[swapIdx].id),
    ]);
    loadAll();
  }

  async function uploadFile(file: File, field: "logo_url") {
    if (!editing) return;
    setUploading(true);
    const path = `partners/${editing.slug || "p"}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("resources").upload(path, file, { contentType: file.type });
    if (error) { setMsg(`Upload error: ${error.message}`); setUploading(false); return; }
    const { data } = supabase.storage.from("resources").getPublicUrl(path);
    setEditing({ ...editing, [field]: data.publicUrl });
    setUploading(false);
  }

  async function saveAds(updatedAds: DisplayAd[]) {
    setAds(updatedAds);
    await supabase.from("site_settings").upsert({ key: "display_ads", value: { ads: updatedAds }, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setMsg("Ads saved"); setTimeout(() => setMsg(""), 2000);
  }

  async function saveHouseAd(updated: HouseAd) {
    setHouseAd(updated);
    await supabase.from("site_settings").upsert({ key: "house_ad", value: updated, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setMsg("House ad saved"); setTimeout(() => setMsg(""), 2000);
  }

  async function uploadAd(file: File) {
    setUploading(true);
    const path = `ads/ad-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("resources").upload(path, file, { contentType: file.type });
    if (error) { setMsg(`Upload error: ${error.message}`); setUploading(false); return; }
    const { data } = supabase.storage.from("resources").getPublicUrl(path);
    const media_type: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
    const newAd: DisplayAd = { id: crypto.randomUUID(), name: adName || file.name, image_url: data.publicUrl, link_url: adLink || "#", active: true, media_type };
    saveAds([...ads, newAd]);
    setAdName(""); setAdLink("");
    setUploading(false);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {msg && <div className={`px-4 py-2 rounded-lg text-[13px] font-medium ${msg.startsWith("Error") || msg.startsWith("Upload") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>{msg}</div>}

      {/* ─── Partners ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[16px] font-bold text-white">Partners & Sponsors</h3>
            <p className="text-[12px] text-[#555] mt-1">Manage partners shown on homepage and podcast page.</p>
          </div>
          <div className="flex gap-2">
            {sponsors.length === 0 && (
              <button onClick={seedPartners} className="px-4 py-2.5 bg-[#1a1a1a] border border-[#222] text-[#ccc] rounded-lg text-[13px] font-medium hover:border-[#444]">
                Seed PH1 &amp; AI Value
              </button>
            )}
            <button onClick={() => { setEditing({ name: "", slug: "", tagline: "", logo_url: "", website_url: "", tier: "standard", active: true, display_order: sponsors.length }); setIsNew(true); }}
              className="px-4 py-2.5 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566] flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              Add Partner
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {sponsors.map((s, idx) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-[#0c0c0c] border border-[#1a1a1a] hover:border-[#282828] transition-colors">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveOrder(s.id, "up")} disabled={idx === 0} aria-label="Move up" className="text-[#555] hover:text-white disabled:opacity-20 p-1">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                  </button>
                  <button onClick={() => moveOrder(s.id, "down")} disabled={idx === sponsors.length - 1} aria-label="Move down" className="text-[#555] hover:text-white disabled:opacity-20 p-1">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                </div>
                <div className="w-20 h-14 rounded bg-[#111] border border-[#1a1a1a] flex items-center justify-center flex-shrink-0 overflow-hidden p-1.5">
                  {s.logo_url ? <img src={s.logo_url} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-[10px] text-[#444]">No logo</span>}
                </div>
                <div className="flex-1 min-w-0 basis-[180px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-[#ccc]">{s.name}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.active ? "bg-green-500/10 text-green-400" : "bg-[#222] text-[#555]"}`}>{s.active ? "Active" : "Inactive"}</span>
                    {s.tier && <span className="text-[10px] text-[#555] uppercase">{s.tier}</span>}
                  </div>
                  {s.tagline && <div className="text-[12px] text-[#666] line-clamp-1 mt-0.5">{s.tagline}</div>}
                  {s.website_url && <div className="text-[11px] text-[#444] mt-0.5 truncate">{s.website_url}</div>}
                </div>
                {/* Action buttons wrap to a new row on narrow widths */}
                <div className="flex items-center gap-3 flex-shrink-0 ml-auto basis-full sm:basis-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1a1a1a]">
                  <button onClick={() => toggleActive(s.id, s.active)} className="text-[12px] text-[#666] hover:text-white py-1">{s.active ? "Deactivate" : "Activate"}</button>
                  <button onClick={() => { setEditing({ ...s }); setIsNew(false); }} className="text-[12px] text-[#ff6b4a] hover:text-[#ff8566] font-medium py-1">Edit</button>
                  <button onClick={() => deleteSponsor(s.id)} className="text-[12px] text-[#555] hover:text-red-400 py-1">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Article Inline Ads ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[16px] font-bold text-white">Article Inline Ads</h3>
            <p className="text-[12px] text-[#555] mt-1">CTA widgets auto-injected into article bodies. Rebuild the site after saving to publish changes.</p>
          </div>
          <button onClick={() => { setEditingAd(newArticleAd()); setIsNewAd(true); }}
            className="px-4 py-2.5 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566] flex items-center gap-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            New Ad
          </button>
        </div>

        {articleAds.length === 0 ? (
          <div className="text-[13px] text-[#555] py-6 text-center border border-dashed border-[#222] rounded-xl">
            No article ads yet. Run the migration (0014_article_ads.sql) to seed the PH1 ad.
          </div>
        ) : (
          <div className="space-y-2">
            {articleAds.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-[#0c0c0c] border border-[#1a1a1a]">
                {a.logo_url && (
                  <div className="w-16 h-12 rounded bg-[#111] border border-[#1a1a1a] flex items-center justify-center overflow-hidden p-1 flex-shrink-0">
                    <img src={a.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-[#ccc]">{a.title}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${a.active ? "bg-green-500/10 text-green-400" : "bg-[#222] text-[#555]"}`}>{a.active ? "Active" : "Inactive"}</span>
                    <span className="text-[10px] text-[#555]">before heading #{a.position_heading}</span>
                  </div>
                  {a.headline && <div className="text-[12px] text-[#666] truncate mt-0.5">{a.headline}</div>}
                  <div className="text-[11px] text-[#444] mt-0.5">{(a.bullets ?? []).length} CTA{(a.bullets ?? []).length !== 1 ? "s" : ""}</div>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  <button onClick={() => toggleArticleAdActive(a.id, a.active)} className="text-[12px] text-[#666] hover:text-white">{a.active ? "Deactivate" : "Activate"}</button>
                  <button onClick={() => { setEditingAd({ ...a, bullets: a.bullets ?? [] }); setIsNewAd(false); }} className="text-[12px] text-[#ff6b4a] hover:text-[#ff8566] font-medium">Edit</button>
                  <button onClick={() => deleteArticleAd(a.id)} className="text-[12px] text-[#555] hover:text-red-400">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Display Ads ─── */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">Display Ads</h3>
        <p className="text-[12px] text-[#555] mb-4">Upload banner ads that rotate randomly in the homepage sidebar ad slot.</p>

        {ads.length > 0 && (
          <div className="space-y-2 mb-4">
            {ads.map((ad, i) => (
              <div key={ad.id} className="flex items-center gap-4 p-3 rounded-lg bg-[#111] border border-[#1a1a1a]">
                <div className="w-24 h-16 rounded bg-[#0a0a0a] border border-[#1a1a1a] overflow-hidden flex-shrink-0">
                  {ad.media_type === "video" ? (
                    <video src={ad.image_url} muted playsInline className="w-full h-full object-contain" />
                  ) : (
                    <img src={ad.image_url} alt="" className="w-full h-full object-contain" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[#ccc]">{ad.name}</div>
                  <div className="text-[11px] text-[#555] truncate">{ad.link_url}</div>
                </div>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={ad.active} onChange={() => { const u = [...ads]; u[i] = { ...ad, active: !ad.active }; saveAds(u); }}
                    className="w-3.5 h-3.5 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
                  <span className="text-[10px] text-[#666]">Active</span>
                </label>
                <button onClick={() => saveAds(ads.filter((_, j) => j !== i))} className="text-[11px] text-[#555] hover:text-red-400">Remove</button>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 rounded-lg bg-[#0c0c0c] border border-[#1a1a1a]">
          <div className="text-[12px] font-semibold text-[#888] mb-3">Upload new ad</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input type="text" placeholder="Ad name" className="px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white placeholder:text-[#555] focus:outline-none"
              value={adName} onChange={(e) => setAdName(e.target.value)} />
            <input type="text" placeholder="Click-through URL" className="px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white placeholder:text-[#555] focus:outline-none"
              value={adLink} onChange={(e) => setAdLink(e.target.value)} />
          </div>
          <input ref={adRef} type="file" accept="image/*,video/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAd(f); }} />
          <button onClick={() => adRef.current?.click()} disabled={uploading}
            className="px-4 py-2.5 bg-[#1a1a1a] border border-[#222] rounded-lg text-[13px] text-[#ccc] hover:text-white disabled:opacity-50 flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            {uploading ? "Uploading..." : "Upload Ad (image or video)"}
          </button>
        </div>
      </section>

      {/* ─── House Ad ─── */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">House Ad</h3>
        <p className="text-[12px] text-[#555] mb-4">
          Fallback ad shown in the homepage sidebar when no uploaded display ads are active. Also participates in the random rotation when enabled.
        </p>

        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={houseAd.enabled}
            onChange={(e) => saveHouseAd({ ...houseAd, enabled: e.target.checked })}
            className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
          <span className="text-[13px] text-[#ccc]">Include in ad rotation</span>
        </label>

        <div className="space-y-3 p-4 rounded-xl bg-[#0c0c0c] border border-[#1a1a1a]">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#666] mb-1">Presented-by label</label>
              <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
                defaultValue={houseAd.presented_by_label} key={houseAd.presented_by_label + "-pbl"}
                onBlur={(e) => saveHouseAd({ ...houseAd, presented_by_label: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#666] mb-1">Logo alt text</label>
              <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
                defaultValue={houseAd.logo_alt} key={houseAd.logo_alt + "-alt"}
                onBlur={(e) => saveHouseAd({ ...houseAd, logo_alt: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#666] mb-1">Logo URL</label>
            <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
              defaultValue={houseAd.logo_url} key={houseAd.logo_url + "-logo"}
              onBlur={(e) => saveHouseAd({ ...houseAd, logo_url: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#666] mb-1">Click-through URL</label>
            <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
              defaultValue={houseAd.link_url} key={houseAd.link_url + "-link"}
              onBlur={(e) => saveHouseAd({ ...houseAd, link_url: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#666] mb-1">Headline</label>
            <textarea rows={2} className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none resize-none"
              defaultValue={houseAd.headline} key={houseAd.headline + "-head"}
              onBlur={(e) => saveHouseAd({ ...houseAd, headline: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#666] mb-1">Tagline / subtext</label>
            <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
              defaultValue={houseAd.tagline} key={houseAd.tagline + "-tag"}
              onBlur={(e) => saveHouseAd({ ...houseAd, tagline: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#666] mb-1">CTA button label</label>
            <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
              defaultValue={houseAd.cta_text} key={houseAd.cta_text + "-cta"}
              onBlur={(e) => saveHouseAd({ ...houseAd, cta_text: e.target.value })} />
          </div>
        </div>
      </section>

      {/* ─── Edit Article Ad Modal ─── */}
      {editingAd && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#0c0c0c] border border-[#222] rounded-xl p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-white">{isNewAd ? "New Article Ad" : "Edit Article Ad"}</h3>
              <button onClick={() => setEditingAd(null)} className="text-[#555] hover:text-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <F label="Internal title" value={editingAd.title ?? ""} onChange={v => setEditingAd({ ...editingAd, title: v })} />
              <div>
                <label className="block text-[11px] font-medium text-[#666] mb-1">Insert before heading #</label>
                <input type="number" min={1} max={20}
                  className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
                  value={editingAd.position_heading ?? 3}
                  onChange={e => setEditingAd({ ...editingAd, position_heading: parseInt(e.target.value) || 3 })} />
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editingAd.active ?? true}
                onChange={e => setEditingAd({ ...editingAd, active: e.target.checked })}
                className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
              <span className="text-[13px] text-[#ccc]">Active</span>
            </label>

            <div className="border-t border-[#1a1a1a] pt-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#666] mb-3">Left side</div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Logo URL" value={editingAd.logo_url ?? ""} onChange={v => setEditingAd({ ...editingAd, logo_url: v })} />
                <F label="Logo link" value={editingAd.logo_link ?? ""} onChange={v => setEditingAd({ ...editingAd, logo_link: v })} />
              </div>
              <div className="mt-3">
                <F label="Logo alt text" value={editingAd.logo_alt ?? ""} onChange={v => setEditingAd({ ...editingAd, logo_alt: v })} />
              </div>
              {editingAd.logo_url && (
                <div className="mt-2 h-14 bg-[#111] rounded-lg flex items-center p-2">
                  <img src={editingAd.logo_url} alt="" className="max-h-full object-contain" />
                </div>
              )}
              <div className="mt-3">
                <label className="block text-[11px] font-medium text-[#666] mb-1">Headline</label>
                <textarea className="w-full h-16 bg-[#111] border border-[#222] rounded-lg p-3 text-[13px] text-white focus:outline-none resize-y"
                  value={editingAd.headline ?? ""}
                  onChange={e => setEditingAd({ ...editingAd, headline: e.target.value })} />
              </div>
            </div>

            <div className="border-t border-[#1a1a1a] pt-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#666] mb-3">Right side</div>
              <F label="Eyebrow (small orange text)" value={editingAd.eyebrow ?? ""} onChange={v => setEditingAd({ ...editingAd, eyebrow: v })} />

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-medium text-[#666]">CTA links</label>
                  <button
                    onClick={() => setEditingAd({ ...editingAd, bullets: [...(editingAd.bullets ?? []), { label: "", url: "" }] })}
                    className="text-[12px] text-[#ff6b4a] hover:text-[#ff8566]">+ Add link</button>
                </div>
                <div className="space-y-2">
                  {(editingAd.bullets ?? []).map((b, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        className="flex-1 px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
                        placeholder="Label"
                        value={b.label}
                        onChange={e => {
                          const bullets = [...(editingAd.bullets ?? [])];
                          bullets[i] = { ...b, label: e.target.value };
                          setEditingAd({ ...editingAd, bullets });
                        }} />
                      <input
                        className="flex-1 px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none font-mono text-[11px] text-[#888]"
                        placeholder="https://…"
                        value={b.url}
                        onChange={e => {
                          const bullets = [...(editingAd.bullets ?? [])];
                          bullets[i] = { ...b, url: e.target.value };
                          setEditingAd({ ...editingAd, bullets });
                        }} />
                      <button
                        onClick={() => setEditingAd({ ...editingAd, bullets: (editingAd.bullets ?? []).filter((_, j) => j !== i) })}
                        className="text-[#555] hover:text-red-400 flex-shrink-0 px-1">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditingAd(null)} className="px-4 py-2 text-[13px] text-[#888] hover:text-white">Cancel</button>
              <button onClick={saveArticleAd} className="px-5 py-2 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566]">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Partner Modal ─── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 overflow-y-auto py-8">
          <div className="w-full max-w-lg bg-[#0c0c0c] border border-[#222] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-white">{isNew ? "Add Partner" : "Edit Partner"}</h3>
              <button onClick={() => setEditing(null)} className="text-[#555] hover:text-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <F label="Name" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v, slug: v.toLowerCase().replace(/[^a-z0-9]+/g, "-") })} />
            <F label="Slug" value={editing.slug ?? ""} onChange={(v) => setEditing({ ...editing, slug: v })} mono />
            <F label="Tagline" value={editing.tagline ?? ""} onChange={(v) => setEditing({ ...editing, tagline: v })} />

            <div>
              <label className="block text-[11px] font-medium text-[#666] mb-1">Logo</label>
              <input ref={logoRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, "logo_url"); }} />
              <div className="flex gap-2 mb-1">
                <button onClick={() => logoRef.current?.click()} disabled={uploading}
                  className="px-3 py-2 bg-[#1a1a1a] border border-[#222] rounded-lg text-[12px] text-[#ccc] hover:text-white disabled:opacity-50 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                  Upload
                </button>
                <input type="text" className="flex-1 px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[12px] text-[#888] focus:outline-none" placeholder="Or paste URL"
                  value={editing.logo_url ?? ""} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} />
              </div>
              {editing.logo_url && <div className="h-14 bg-[#111] rounded-lg flex items-center justify-center p-2"><img src={editing.logo_url} alt="" className="max-h-full object-contain" /></div>}
            </div>

            <F label="Website URL" value={editing.website_url ?? ""} onChange={(v) => setEditing({ ...editing, website_url: v })} />
            <F label="CTA Text" value={editing.cta_text ?? ""} onChange={(v) => setEditing({ ...editing, cta_text: v })} />
            <div>
              <label className="block text-[11px] font-medium text-[#666] mb-1">Description</label>
              <textarea className="w-full h-20 bg-[#111] border border-[#222] rounded-lg p-3 text-[13px] text-white focus:outline-none resize-y"
                value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#666] mb-1">Tier</label>
              <select className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white"
                value={editing.tier ?? "standard"} onChange={(e) => setEditing({ ...editing, tier: e.target.value })}>
                <option value="founding">Founding</option>
                <option value="premium">Premium</option>
                <option value="standard">Standard</option>
              </select>
            </div>
            <F label="Display Order" value={String(editing.display_order ?? 0)} onChange={(v) => setEditing({ ...editing, display_order: parseInt(v) || 0 })} type="number" />

            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" /><span className="text-[13px] text-[#ccc]">Active</span></label>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-[13px] text-[#888] hover:text-white">Cancel</button>
              <button onClick={saveSponsor} className="px-5 py-2 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566]">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, value, onChange, mono, type }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean; type?: string }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-medium text-[#666] mb-1">{label}</label>}
      <input type={type ?? "text"} className={`w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50 ${mono ? "font-mono text-[12px] text-[#888]" : ""}`}
        value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
