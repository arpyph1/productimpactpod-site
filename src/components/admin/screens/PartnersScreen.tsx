import React, { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }

interface Sponsor {
  id: string; slug: string; name: string; tagline: string | null;
  description: string | null; logo_url: string | null; website_url: string | null;
  cta_text: string | null; tier: string | null; active: boolean;
  display_order: number | null; themes: string[] | null; created_at: string;
}

const EMPTY_SPONSOR: Partial<Sponsor> = {
  name: "", slug: "", tagline: "", description: "", logo_url: "", website_url: "",
  cta_text: "", tier: "standard", active: true, display_order: 0, themes: [],
};

export default function PartnersScreen({ supabase }: Props) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [editing, setEditing] = useState<Partial<Sponsor> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => { loadSponsors(); }, []);

  async function loadSponsors() {
    setLoading(true);
    const { data } = await supabase.from("sponsors").select("*").order("display_order", { ascending: true });
    if (data) setSponsors(data);
    setLoading(false);
  }

  async function saveSponsor() {
    if (!editing) return;
    if (!editing.name?.trim()) { setMsg("Name is required"); return; }
    if (!editing.slug?.trim()) editing.slug = editing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const payload = { ...editing };
    delete (payload as any).id;
    delete (payload as any).created_at;

    let error;
    if (isNew) {
      const res = await supabase.from("sponsors").insert(payload);
      error = res.error;
    } else {
      const res = await supabase.from("sponsors").update(payload).eq("id", editing.id);
      error = res.error;
    }

    if (error) { setMsg(`Error: ${error.message}`); }
    else { setMsg("Saved"); setEditing(null); setTimeout(() => setMsg(""), 2000); loadSponsors(); }
  }

  async function deleteSponsor(id: string) {
    if (!confirm("Delete this partner?")) return;
    await supabase.from("sponsors").delete().eq("id", id);
    loadSponsors();
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("sponsors").update({ active: !current }).eq("id", id);
    setSponsors(prev => prev.map(s => s.id === id ? { ...s, active: !current } : s));
  }

  async function moveOrder(id: string, direction: "up" | "down") {
    const idx = sponsors.findIndex(s => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sponsors.length) return;

    const a = sponsors[idx];
    const b = sponsors[swapIdx];
    await Promise.all([
      supabase.from("sponsors").update({ display_order: swapIdx }).eq("id", a.id),
      supabase.from("sponsors").update({ display_order: idx }).eq("id", b.id),
    ]);
    loadSponsors();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {msg && <div className={`px-4 py-2 rounded-lg text-[13px] font-medium ${msg.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>{msg}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-bold text-white">Partners & Sponsors</h3>
          <p className="text-[12px] text-[#555] mt-1">Manage sponsors shown on the homepage and podcast page.</p>
        </div>
        <button onClick={() => { setEditing({ ...EMPTY_SPONSOR }); setIsNew(true); }}
          className="px-4 py-2.5 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566] transition-colors flex items-center gap-1.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          Add Partner
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" /></div>
      ) : sponsors.length === 0 ? (
        <div className="text-center py-12 text-[#555]">
          <p className="text-[14px] mb-2">No partners in database</p>
          <p className="text-[12px]">Partners are currently hardcoded in index.astro and podcast/index.astro. Add them to the sponsors table to manage them here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sponsors.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-4 p-4 rounded-xl bg-[#0c0c0c] border border-[#1a1a1a] hover:border-[#282828] transition-colors">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveOrder(s.id, "up")} disabled={idx === 0} className="text-[#555] hover:text-white disabled:opacity-20 transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                </button>
                <button onClick={() => moveOrder(s.id, "down")} disabled={idx === sponsors.length - 1} className="text-[#555] hover:text-white disabled:opacity-20 transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
              </div>

              {/* Logo */}
              <div className="w-16 h-12 rounded bg-[#111] border border-[#1a1a1a] flex items-center justify-center flex-shrink-0 overflow-hidden">
                {s.logo_url ? (
                  <img src={s.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-[10px] text-[#444]">No logo</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#ccc]">{s.name}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${s.active ? "bg-green-500/10 text-green-400" : "bg-[#222] text-[#555]"}`}>
                    {s.active ? "Active" : "Inactive"}
                  </span>
                  {s.tier && <span className="text-[10px] text-[#555] uppercase">{s.tier}</span>}
                </div>
                {s.tagline && <div className="text-[12px] text-[#666] line-clamp-1 mt-0.5">{s.tagline}</div>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleActive(s.id, s.active)}
                  className="text-[11px] text-[#666] hover:text-white transition-colors">
                  {s.active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => { setEditing({ ...s }); setIsNew(false); }}
                  className="text-[11px] text-[#ff6b4a] hover:text-[#ff8566] font-medium">Edit</button>
                <button onClick={() => deleteSponsor(s.id)}
                  className="text-[11px] text-[#555] hover:text-red-400 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-[#0c0c0c] border border-[#222] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-white">{isNew ? "Add Partner" : "Edit Partner"}</h3>
              <button onClick={() => setEditing(null)} className="text-[#555] hover:text-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <EditField label="Name" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v, slug: v.toLowerCase().replace(/[^a-z0-9]+/g, "-") })} />
            <EditField label="Slug" value={editing.slug ?? ""} onChange={(v) => setEditing({ ...editing, slug: v })} mono />
            <EditField label="Tagline" value={editing.tagline ?? ""} onChange={(v) => setEditing({ ...editing, tagline: v })} />
            <EditField label="Logo URL" value={editing.logo_url ?? ""} onChange={(v) => setEditing({ ...editing, logo_url: v })} />
            {editing.logo_url && (
              <div className="h-16 bg-[#111] rounded-lg flex items-center justify-center p-2">
                <img src={editing.logo_url} alt="" className="max-h-full object-contain" />
              </div>
            )}
            <EditField label="Website URL" value={editing.website_url ?? ""} onChange={(v) => setEditing({ ...editing, website_url: v })} />
            <EditField label="CTA Text" value={editing.cta_text ?? ""} onChange={(v) => setEditing({ ...editing, cta_text: v })} />
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
            <EditField label="Display Order" value={String(editing.display_order ?? 0)} onChange={(v) => setEditing({ ...editing, display_order: parseInt(v) || 0 })} type="number" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
              <span className="text-[13px] text-[#ccc]">Active</span>
            </label>

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

function EditField({ label, value, onChange, mono, type }: { label: string; value: string; onChange: (v: string) => void; mono?: boolean; type?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[#666] mb-1">{label}</label>
      <input type={type ?? "text"} className={`w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50 ${mono ? "font-mono text-[12px] text-[#888]" : ""}`}
        value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
