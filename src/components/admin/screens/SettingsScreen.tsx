import React, { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }
interface AdminRole { id: string; user_id: string; role: string; created_at: string; email?: string; name?: string }
interface NavItem { label: string; href: string; visible: boolean }

const DEFAULT_NAV: NavItem[] = [
  { label: "News", href: "/news/", visible: true },
  { label: "Themes", href: "/themes/", visible: true },
  { label: "Podcast", href: "/podcast/", visible: true },
  { label: "Episodes", href: "/episodes/", visible: true },
  { label: "Partner", href: "/partnerships/", visible: true },
];

export default function SettingsScreen({ supabase }: Props) {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "editor">("admin");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [msg, setMsg] = useState("");
  const [navItems, setNavItems] = useState<NavItem[]>(DEFAULT_NAV);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [rolesRes, settingsRes] = await Promise.all([
      supabase.from("user_roles").select("*, profiles!user_roles_user_id_fkey(email, display_name)"),
      supabase.from("site_settings").select("*"),
    ]);

    if (rolesRes.data) {
      setRoles(rolesRes.data.map((r: any) => ({
        ...r,
        email: r.profiles?.email ?? "unknown",
        name: r.profiles?.display_name ?? "",
      })));
    }

    if (settingsRes.data) {
      const map: Record<string, any> = {};
      settingsRes.data.forEach((s: any) => { map[s.key] = s.value; });
      setSettings(map);
      if (map.nav_items?.items) setNavItems(map.nav_items.items);
    }
  }

  async function saveSetting(key: string, value: any) {
    const { error } = await supabase.from("site_settings").upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    if (error) setMsg(`Error: ${error.message}`);
    else { setMsg("Saved"); setTimeout(() => setMsg(""), 2000); }
  }

  async function addAdmin() {
    if (!newEmail.trim()) return;
    setAddingAdmin(true);
    setMsg("");

    const { data: users } = await supabase.from("profiles").select("user_id, email").eq("email", newEmail.trim().toLowerCase());

    if (!users || users.length === 0) {
      setMsg(`No account found for ${newEmail}. They must sign in with Google first, then you can add them.`);
      setAddingAdmin(false);
      return;
    }

    const { error } = await supabase.from("user_roles").insert({
      user_id: users[0].user_id,
      role: newRole,
    });

    if (error) {
      if (error.code === "23505") setMsg(`${newEmail} already has the ${newRole} role.`);
      else setMsg(`Error: ${error.message}`);
    } else {
      setMsg(`Added ${newEmail} as ${newRole}`);
      setNewEmail("");
    }
    setAddingAdmin(false);
    loadData();
  }

  async function removeRole(id: string) {
    if (!confirm("Remove this admin?")) return;
    await supabase.from("user_roles").delete().eq("id", id);
    loadData();
  }

  function updateNavItem(idx: number, field: keyof NavItem, value: any) {
    const updated = [...navItems];
    (updated[idx] as any)[field] = value;
    setNavItems(updated);
  }

  function moveNav(idx: number, dir: "up" | "down") {
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= navItems.length) return;
    const updated = [...navItems];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    setNavItems(updated);
  }

  function addNavItem() {
    setNavItems([...navItems, { label: "New Link", href: "/", visible: true }]);
  }

  function removeNavItem(idx: number) {
    setNavItems(navItems.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {msg && (
        <div className={`px-4 py-2 rounded-lg text-[13px] font-medium ${msg.startsWith("Error") || msg.startsWith("No account") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
          {msg}
        </div>
      )}

      {/* Site Identity */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-4">Site Identity</h3>
        <div className="space-y-4">
          <Field label="Site Name" value={settings.site_name?.name ?? "Product Impact"} onChange={(v) => saveSetting("site_name", { name: v })} />
          <Field label="Tagline" value={settings.site_tagline?.tagline ?? "AI product impact — news, releases, and case studies."} onChange={(v) => saveSetting("site_tagline", { tagline: v })} />
        </div>
      </section>

      {/* Admin Users */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-4">Admin Users</h3>
        <div className="space-y-2 mb-4">
          {roles.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-[#111] border border-[#1a1a1a]">
              <div>
                <div className="text-[13px] font-medium text-[#ccc]">{r.name || r.email}</div>
                <div className="text-[11px] text-[#555]">{r.email} &middot; <span className="uppercase">{r.role}</span></div>
              </div>
              <button onClick={() => removeRole(r.id)} className="text-[11px] text-[#555] hover:text-red-400 transition-colors">Remove</button>
            </div>
          ))}
          {roles.length === 0 && <p className="text-[13px] text-[#555]">No admin users found.</p>}
        </div>

        {/* Add admin form */}
        <div className="p-4 rounded-lg bg-[#0c0c0c] border border-[#1a1a1a]">
          <div className="text-[12px] font-semibold text-[#888] mb-3">Add a new admin or editor</div>
          <div className="flex gap-2">
            <input type="email" placeholder="email@example.com"
              className="flex-1 px-3 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white placeholder:text-[#555] focus:outline-none focus:border-[#ff6b4a]/50"
              value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addAdmin(); }} />
            <select className="px-3 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white"
              value={newRole} onChange={(e) => setNewRole(e.target.value as any)}>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
            </select>
            <button onClick={addAdmin} disabled={addingAdmin}
              className="px-4 py-2.5 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566] disabled:opacity-50">
              {addingAdmin ? "Adding..." : "Add"}
            </button>
          </div>
          <p className="text-[10px] text-[#444] mt-2">The user must have signed in at least once (via Google) before you can add them.</p>
        </div>
      </section>

      {/* Navigation Items */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-1">Navigation</h3>
        <p className="text-[12px] text-[#555] mb-4">Edit nav bar items — labels, links, visibility, and order.</p>

        <div className="space-y-2 mb-3">
          {navItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-[#111] border border-[#1a1a1a]">
              {/* Reorder */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveNav(idx, "up")} disabled={idx === 0} className="text-[#555] hover:text-white disabled:opacity-20">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                </button>
                <button onClick={() => moveNav(idx, "down")} disabled={idx === navItems.length - 1} className="text-[#555] hover:text-white disabled:opacity-20">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
              </div>

              {/* Visibility */}
              <input type="checkbox" checked={item.visible} onChange={(e) => updateNavItem(idx, "visible", e.target.checked)}
                className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" title="Visible" />

              {/* Label */}
              <input type="text" className="w-32 px-2 py-1.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
                value={item.label} onChange={(e) => updateNavItem(idx, "label", e.target.value)} />

              {/* Link */}
              <input type="text" className="flex-1 px-2 py-1.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-[12px] text-[#888] font-mono focus:outline-none focus:border-[#ff6b4a]/50"
                value={item.href} onChange={(e) => updateNavItem(idx, "href", e.target.value)} />

              <button onClick={() => removeNavItem(idx)} className="text-[#444] hover:text-red-400 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={addNavItem} className="text-[12px] text-[#666] hover:text-white transition-colors">+ Add nav item</button>
          <button onClick={() => saveSetting("nav_items", { items: navItems })}
            className="px-4 py-2 bg-[#ff6b4a] text-white rounded-lg text-[12px] font-semibold hover:bg-[#ff8566]">
            Save Navigation
          </button>
        </div>
      </section>

      {/* Custom CSS */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-4">Custom CSS Snippet</h3>
        <textarea className="w-full h-40 bg-[#111] border border-[#222] rounded-lg p-4 text-[13px] text-[#ccc] font-mono focus:outline-none focus:border-[#ff6b4a]/50 resize-y"
          placeholder="/* Custom CSS injected into every page */"
          defaultValue={settings.custom_css?.css ?? ""}
          onBlur={(e) => saveSetting("custom_css", { css: e.target.value })} />
      </section>

      {/* Custom Head */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-4">Custom &lt;head&gt; Snippet</h3>
        <textarea className="w-full h-32 bg-[#111] border border-[#222] rounded-lg p-4 text-[13px] text-[#ccc] font-mono focus:outline-none focus:border-[#ff6b4a]/50 resize-y"
          placeholder="<!-- Custom scripts/meta tags -->"
          defaultValue={settings.custom_head?.html ?? ""}
          onBlur={(e) => saveSetting("custom_head", { html: e.target.value })} />
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [val, setVal] = useState(value);
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#888] mb-1.5">{label}</label>
      <input type="text" className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50 transition-colors"
        value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => onChange(val)} />
    </div>
  );
}
