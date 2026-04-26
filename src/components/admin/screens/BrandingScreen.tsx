import React, { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }

interface ThemeEntry {
  slug: string; label: string; color: string; gradientFrom: string; keywords: string[];
}

interface HostEntry {
  name: string; slug: string; role: string; bio: string; linkedin: string; sameAs: string[];
}

interface NavItem {
  label: string; href: string;
}

interface SiteConfigData {
  name: string;
  alternateName: string;
  url: string;
  tagline: string;
  description: string;
  foundingDate: string;
  language: string;
  logoUrl: string;
  accentColor: string;
  accentHover: string;
  accentHsl: string;
  email: { editorial: string; corrections: string; tips: string; partners: string; privacy: string };
  social: { twitter: string; linkedin: string; youtube: string; spotify: string; apple: string; substack: string };
  podcast: { feedUrl: string; youtubeChannelId: string; spotifyUrl: string; appleUrl: string; youtubeUrl: string };
  hosts: HostEntry[];
  analytics: { gaId: string };
  admin: { allowedEmails: string[]; allowedDomains: string[] };
  themes: ThemeEntry[];
  nav: { items: NavItem[] };
  footer: { tagline: string; copyright: string };
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const SECTION_STYLE = "space-y-4 p-5 bg-[#0c0c0c] border border-[#1a1a1a] rounded-xl";
const LABEL = "block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5";
const INPUT = "w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50";
const INPUT_SM = "w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[12px] text-[#ccc] focus:outline-none";

export default function BrandingScreen({ supabase }: Props) {
  const [config, setConfig] = useState<SiteConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [section, setSection] = useState<string>("identity");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("site_settings").select("value").eq("key", "site_config").single();
    if (data?.value) {
      setConfig(data.value as SiteConfigData);
    }
    setLoading(false);
  }

  function update(path: string, value: any) {
    setConfig(prev => {
      if (!prev) return prev;
      const parts = path.split(".");
      const updated = JSON.parse(JSON.stringify(prev));
      let obj = updated;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      return updated;
    });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    if (config.accentColor?.match(/^#[0-9a-f]{6}$/i)) {
      config.accentHsl = hexToHsl(config.accentColor);
      config.accentHover = lightenHex(config.accentColor, 30);
    }
    const { error } = await supabase.from("site_settings").upsert({
      key: "site_config",
      value: config,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    setSaving(false);
    setMsg(error ? `Error: ${error.message}` : "Saved! Rebuild site to see changes.");
    setTimeout(() => setMsg(""), 4000);
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!config) return (
    <div className="max-w-2xl space-y-4">
      <p className="text-[14px] text-[#888]">No site config found. Initialize with defaults?</p>
      <button onClick={async () => {
        const resp = await fetch("/api/config-defaults");
        const mod = await import("@lib/config");
        setConfig(mod.CONFIG_DEFAULTS as any);
      }} className="px-4 py-2 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold">
        Initialize Config
      </button>
      <p className="text-[11px] text-[#555]">Or create manually: go to Supabase → site_settings → insert key "site_config" with your JSON.</p>
    </div>
  );

  const sections = [
    { id: "identity", label: "Identity" },
    { id: "colors", label: "Colors & Style" },
    { id: "emails", label: "Emails" },
    { id: "social", label: "Social & Podcast" },
    { id: "hosts", label: "Hosts / Team" },
    { id: "themes", label: "Themes" },
    { id: "nav", label: "Navigation" },
    { id: "admin", label: "Admin Access" },
    { id: "analytics", label: "Analytics" },
  ];

  return (
    <div className="max-w-4xl">
      {msg && <div className={`mb-4 px-4 py-2 rounded-lg text-[13px] font-medium ${msg.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>{msg}</div>}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${section === s.id ? "bg-[#ff6b4a]/10 text-[#ff6b4a] border border-[#ff6b4a]/20" : "text-[#666] hover:text-white"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={save} disabled={saving}
          className="px-5 py-2 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566] transition-colors disabled:opacity-50 flex-shrink-0">
          {saving ? "Saving..." : "Save Config"}
        </button>
      </div>

      {section === "identity" && (
        <div className={SECTION_STYLE}>
          <h3 className="text-[14px] font-bold text-white">Site Identity</h3>
          <Field label="Site Name" value={config.name} onChange={v => update("name", v)} />
          <Field label="Alternate Name" value={config.alternateName} onChange={v => update("alternateName", v)} placeholder="e.g. Your Podcast Name" />
          <Field label="Site URL" value={config.url} onChange={v => update("url", v)} placeholder="https://yoursite.com" />
          <Field label="Tagline" value={config.tagline} onChange={v => update("tagline", v)} />
          <div>
            <label className={LABEL}>Description</label>
            <textarea className={INPUT + " h-20 resize-y"} value={config.description} onChange={e => update("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Founded" value={config.foundingDate} onChange={v => update("foundingDate", v)} />
            <Field label="Language" value={config.language} onChange={v => update("language", v)} />
          </div>
          <Field label="Logo URL (path or full URL)" value={config.logoUrl} onChange={v => update("logoUrl", v)} />
          <div>
            <label className={LABEL}>Footer</label>
            <div className="grid grid-cols-2 gap-3">
              <input className={INPUT_SM} value={config.footer?.tagline ?? ""} onChange={e => update("footer.tagline", e.target.value)} placeholder="Footer tagline" />
              <input className={INPUT_SM} value={config.footer?.copyright ?? ""} onChange={e => update("footer.copyright", e.target.value)} placeholder="Copyright name" />
            </div>
          </div>
        </div>
      )}

      {section === "colors" && (
        <div className={SECTION_STYLE}>
          <h3 className="text-[14px] font-bold text-white">Colors & Style</h3>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className={LABEL}>Accent Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={config.accentColor} onChange={e => update("accentColor", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-[#333] cursor-pointer bg-transparent" />
                <input className={INPUT} value={config.accentColor} onChange={e => update("accentColor", e.target.value)} />
              </div>
            </div>
            <div className="flex-1">
              <label className={LABEL}>Hover Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={config.accentHover} onChange={e => update("accentHover", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-[#333] cursor-pointer bg-transparent" />
                <input className={INPUT} value={config.accentHover} onChange={e => update("accentHover", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <div className="h-12 flex-1 rounded-lg" style={{ background: config.accentColor }} />
            <div className="h-12 flex-1 rounded-lg" style={{ background: config.accentHover }} />
            <div className="h-12 flex-1 rounded-lg" style={{ background: config.accentColor, opacity: 0.15 }} />
          </div>
          <p className="text-[11px] text-[#555]">HSL (auto-computed on save): {config.accentHsl}</p>
        </div>
      )}

      {section === "emails" && (
        <div className={SECTION_STYLE}>
          <h3 className="text-[14px] font-bold text-white">Email Addresses</h3>
          <Field label="Editorial / General" value={config.email.editorial} onChange={v => update("email.editorial", v)} />
          <Field label="Corrections" value={config.email.corrections} onChange={v => update("email.corrections", v)} />
          <Field label="Tips" value={config.email.tips} onChange={v => update("email.tips", v)} />
          <Field label="Partnerships" value={config.email.partners} onChange={v => update("email.partners", v)} />
          <Field label="Privacy" value={config.email.privacy} onChange={v => update("email.privacy", v)} />
        </div>
      )}

      {section === "social" && (
        <div className={SECTION_STYLE}>
          <h3 className="text-[14px] font-bold text-white">Social & Podcast</h3>
          <Field label="Twitter Handle" value={config.social.twitter} onChange={v => update("social.twitter", v)} placeholder="@yourhandle" />
          <Field label="LinkedIn" value={config.social.linkedin} onChange={v => update("social.linkedin", v)} />
          <Field label="YouTube URL" value={config.social.youtube} onChange={v => update("social.youtube", v)} />
          <Field label="Spotify" value={config.social.spotify} onChange={v => update("social.spotify", v)} />
          <Field label="Apple Podcasts" value={config.social.apple} onChange={v => update("social.apple", v)} />
          <Field label="Substack / Newsletter" value={config.social.substack} onChange={v => update("social.substack", v)} />
          <hr className="border-[#1a1a1a]" />
          <Field label="Podcast RSS Feed URL" value={config.podcast.feedUrl} onChange={v => update("podcast.feedUrl", v)} />
          <Field label="YouTube Channel ID" value={config.podcast.youtubeChannelId} onChange={v => update("podcast.youtubeChannelId", v)} />
        </div>
      )}

      {section === "hosts" && (
        <div className={SECTION_STYLE}>
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-white">Hosts / Team</h3>
            <button onClick={() => update("hosts", [...config.hosts, { name: "", slug: "", role: "", bio: "", linkedin: "", sameAs: [] }])}
              className="px-3 py-1 text-[11px] text-[#ff6b4a] border border-[#ff6b4a]/20 rounded-lg hover:bg-[#ff6b4a]/10">+ Add Host</button>
          </div>
          {config.hosts.map((host, i) => (
            <div key={i} className="p-4 bg-[#080808] border border-[#161616] rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#888]">Host {i + 1}</span>
                <button onClick={() => update("hosts", config.hosts.filter((_, j) => j !== i))}
                  className="text-[10px] text-red-400 hover:text-red-300">&times; Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={INPUT_SM} value={host.name} onChange={e => { const h = [...config.hosts]; h[i] = { ...h[i], name: e.target.value }; update("hosts", h); }} placeholder="Name" />
                <input className={INPUT_SM} value={host.slug} onChange={e => { const h = [...config.hosts]; h[i] = { ...h[i], slug: e.target.value }; update("hosts", h); }} placeholder="slug" />
              </div>
              <input className={INPUT_SM} value={host.role} onChange={e => { const h = [...config.hosts]; h[i] = { ...h[i], role: e.target.value }; update("hosts", h); }} placeholder="Role" />
              <textarea className={INPUT_SM + " h-16 resize-y"} value={host.bio} onChange={e => { const h = [...config.hosts]; h[i] = { ...h[i], bio: e.target.value }; update("hosts", h); }} placeholder="Bio" />
              <input className={INPUT_SM} value={host.linkedin} onChange={e => { const h = [...config.hosts]; h[i] = { ...h[i], linkedin: e.target.value }; update("hosts", h); }} placeholder="LinkedIn URL" />
            </div>
          ))}
        </div>
      )}

      {section === "themes" && (
        <div className={SECTION_STYLE}>
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-white">Content Themes</h3>
            <button onClick={() => update("themes", [...config.themes, { slug: "", label: "", color: "#888888", gradientFrom: "#444444", keywords: [] }])}
              className="px-3 py-1 text-[11px] text-[#ff6b4a] border border-[#ff6b4a]/20 rounded-lg hover:bg-[#ff6b4a]/10">+ Add Theme</button>
          </div>
          {config.themes.map((theme, i) => (
            <div key={i} className="p-4 bg-[#080808] border border-[#161616] rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ background: theme.color }} />
                  <span className="text-[12px] font-bold text-[#ccc]">{theme.label || "Untitled"}</span>
                </div>
                <button onClick={() => update("themes", config.themes.filter((_, j) => j !== i))}
                  className="text-[10px] text-red-400 hover:text-red-300">&times;</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className={INPUT_SM} value={theme.label} onChange={e => { const t = [...config.themes]; t[i] = { ...t[i], label: e.target.value }; update("themes", t); }} placeholder="Label" />
                <input className={INPUT_SM} value={theme.slug} onChange={e => { const t = [...config.themes]; t[i] = { ...t[i], slug: e.target.value }; update("themes", t); }} placeholder="slug-name" />
              </div>
              <div className="flex items-center gap-3">
                <input type="color" value={theme.color} onChange={e => { const t = [...config.themes]; t[i] = { ...t[i], color: e.target.value }; update("themes", t); }}
                  className="w-8 h-8 rounded border border-[#333] cursor-pointer bg-transparent" />
                <input className={INPUT_SM} value={theme.color} onChange={e => { const t = [...config.themes]; t[i] = { ...t[i], color: e.target.value }; update("themes", t); }} placeholder="#hex" />
                <input type="color" value={theme.gradientFrom} onChange={e => { const t = [...config.themes]; t[i] = { ...t[i], gradientFrom: e.target.value }; update("themes", t); }}
                  className="w-8 h-8 rounded border border-[#333] cursor-pointer bg-transparent" title="Gradient dark end" />
              </div>
              <input className={INPUT_SM} value={theme.keywords.join(", ")} onChange={e => { const t = [...config.themes]; t[i] = { ...t[i], keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean) }; update("themes", t); }} placeholder="keyword1, keyword2, keyword3" />
            </div>
          ))}
        </div>
      )}

      {section === "nav" && (
        <div className={SECTION_STYLE}>
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-white">Navigation</h3>
            <button onClick={() => update("nav.items", [...(config.nav?.items ?? []), { label: "", href: "" }])}
              className="px-3 py-1 text-[11px] text-[#ff6b4a] border border-[#ff6b4a]/20 rounded-lg hover:bg-[#ff6b4a]/10">+ Add Item</button>
          </div>
          {(config.nav?.items ?? []).map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <input className={INPUT_SM} value={item.label} onChange={e => { const items = [...(config.nav?.items ?? [])]; items[i] = { ...items[i], label: e.target.value }; update("nav.items", items); }} placeholder="Label" />
              <input className={INPUT_SM} value={item.href} onChange={e => { const items = [...(config.nav?.items ?? [])]; items[i] = { ...items[i], href: e.target.value }; update("nav.items", items); }} placeholder="/path" />
              <button onClick={() => update("nav.items", (config.nav?.items ?? []).filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-300 text-[14px] px-2">&times;</button>
            </div>
          ))}
        </div>
      )}

      {section === "admin" && (
        <div className={SECTION_STYLE}>
          <h3 className="text-[14px] font-bold text-white">Admin Access Control</h3>
          <div>
            <label className={LABEL}>Allowed Emails (one per line)</label>
            <textarea className={INPUT + " h-24 resize-y font-mono text-[12px]"}
              value={(config.admin?.allowedEmails ?? []).join("\n")}
              onChange={e => update("admin.allowedEmails", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))} />
          </div>
          <div>
            <label className={LABEL}>Allowed Domains (one per line)</label>
            <textarea className={INPUT + " h-20 resize-y font-mono text-[12px]"}
              value={(config.admin?.allowedDomains ?? []).join("\n")}
              onChange={e => update("admin.allowedDomains", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))} />
          </div>
        </div>
      )}

      {section === "analytics" && (
        <div className={SECTION_STYLE}>
          <h3 className="text-[14px] font-bold text-white">Analytics</h3>
          <Field label="Google Analytics Measurement ID" value={config.analytics?.gaId ?? ""} onChange={v => update("analytics.gaId", v)} placeholder="G-XXXXXXXXXX" />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">{label}</label>
      <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
