import React, { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }

interface AdminRole { id: string; user_id: string; role: string; created_at: string; email?: string; name?: string }

export default function SettingsScreen({ supabase }: Props) {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
    }
  }

  async function saveSetting(key: string, value: any) {
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) { setMsg(`Error: ${error.message}`); }
    else { setMsg("Saved"); setTimeout(() => setMsg(""), 2000); }
  }

  async function removeRole(id: string) {
    if (!confirm("Remove this admin?")) return;
    await supabase.from("user_roles").delete().eq("id", id);
    loadData();
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {msg && (
        <div className={`px-4 py-2 rounded-lg text-[13px] font-medium ${msg.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
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
                <div className="text-[11px] text-[#555]">{r.email} &middot; {r.role}</div>
              </div>
              <button onClick={() => removeRole(r.id)} className="text-[11px] text-[#555] hover:text-red-400 transition-colors">Remove</button>
            </div>
          ))}
          {roles.length === 0 && <p className="text-[13px] text-[#555]">No admin users found. Sign in with an authorized account to auto-provision.</p>}
        </div>
        <p className="text-[11px] text-[#555] mb-2">Auto-provisioned admins: arpy@ph1.ca, brittany@ph1.ca, info@productimpactpod.com</p>
      </section>

      {/* Custom CSS */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-4">Custom CSS Snippet</h3>
        <textarea
          className="w-full h-40 bg-[#111] border border-[#222] rounded-lg p-4 text-[13px] text-[#ccc] font-mono focus:outline-none focus:border-[#ff6b4a]/50 resize-y"
          placeholder="/* Add custom CSS here — injected into <head> on every page */"
          defaultValue={settings.custom_css?.css ?? ""}
          onBlur={(e) => saveSetting("custom_css", { css: e.target.value })}
        />
      </section>

      {/* Custom Head Snippets */}
      <section>
        <h3 className="text-[16px] font-bold text-white mb-4">Custom &lt;head&gt; Snippet</h3>
        <textarea
          className="w-full h-32 bg-[#111] border border-[#222] rounded-lg p-4 text-[13px] text-[#ccc] font-mono focus:outline-none focus:border-[#ff6b4a]/50 resize-y"
          placeholder="<!-- Add custom scripts/meta tags here -->"
          defaultValue={settings.custom_head?.html ?? ""}
          onBlur={(e) => saveSetting("custom_head", { html: e.target.value })}
        />
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [val, setVal] = useState(value);
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#888] mb-1.5">{label}</label>
      <input
        type="text"
        className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50 transition-colors"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => onChange(val)}
      />
    </div>
  );
}
