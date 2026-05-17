import React, { useState, useEffect, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props {
  supabase: SupabaseClient;
}

interface Config {
  id: string;
  title: string;
  prompt: string;
  char_limit: number;
  button_label: string;
  active: boolean;
}

interface Submission {
  id: string;
  story: string;
  article_slug: string | null;
  created_at: string;
}

type Tab = "edit" | "responses";

export default function StoryWidgetAdmin({ supabase }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("edit");
  const [config, setConfig] = useState<Config | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [responseCount, setResponseCount] = useState(0);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCount = useCallback(async () => {
    const { count } = await supabase
      .from("story_submissions")
      .select("id", { count: "exact", head: true });
    setResponseCount(count ?? 0);
  }, [supabase]);

  const loadConfig = useCallback(async () => {
    const { data } = await supabase
      .from("story_widget_config")
      .select("*")
      .eq("id", "default")
      .single();
    if (data) setConfig(data as Config);
  }, [supabase]);

  const loadSubmissions = useCallback(async () => {
    const { data } = await supabase
      .from("story_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    setSubmissions((data ?? []) as Submission[]);
  }, [supabase]);

  useEffect(() => { loadCount(); }, [loadCount]);
  useEffect(() => {
    if (!open) return;
    loadConfig();
    loadSubmissions();
  }, [open, loadConfig, loadSubmissions]);

  async function save() {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("story_widget_config")
      .update({
        title: config.title,
        prompt: config.prompt,
        char_limit: config.char_limit,
        button_label: config.button_label,
        active: config.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default");
    setSaving(false);
    if (error) { alert(`Save failed: ${error.message}`); return; }
  }

  async function deleteSubmission(id: string) {
    if (!confirm("Delete this submission?")) return;
    const { error } = await supabase.from("story_submissions").delete().eq("id", id);
    if (error) { alert(`Delete failed: ${error.message}`); return; }
    loadSubmissions();
    loadCount();
  }

  function downloadCsv() {
    const rows = [
      ["created_at", "article_slug", "story"],
      ...submissions.map(s => [s.created_at, s.article_slug ?? "", s.story]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `story-submissions-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const filtered = submissions.filter(s =>
    !search ||
    s.story.toLowerCase().includes(search.toLowerCase()) ||
    (s.article_slug ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0c0c0c] p-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#ff6b4a] mb-1">Story Widget</div>
          <div className="text-[14px] font-semibold text-white">Anonymous story submissions on every article</div>
          <div className="text-[12px] text-[#666] mt-0.5">{responseCount} {responseCount === 1 ? "response" : "responses"}</div>
        </div>
        <button onClick={() => setOpen(true)}
          className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222] border border-[#222] rounded-lg text-[12px] font-semibold text-white whitespace-nowrap">
          Edit & View
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-[#0a0a0a] border border-[#222] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-1">
                <TabBtn label="Edit widget" active={tab==="edit"} onClick={() => setTab("edit")} />
                <TabBtn label={`Responses (${responseCount})`} active={tab==="responses"} onClick={() => setTab("responses")} />
              </div>
              <button onClick={() => setOpen(false)} className="text-[#666] hover:text-white text-[20px] leading-none">×</button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {tab === "edit" && config && (
                <div className="space-y-4 max-w-xl">
                  <Field label="Title">
                    <input value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })}
                      className="input" />
                  </Field>
                  <Field label="Prompt / placeholder">
                    <textarea value={config.prompt} onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
                      rows={2} className="input" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Character limit">
                      <input type="number" min={50} max={2000} value={config.char_limit}
                        onChange={(e) => setConfig({ ...config, char_limit: parseInt(e.target.value) || 500 })}
                        className="input" />
                    </Field>
                    <Field label="Button label">
                      <input value={config.button_label} onChange={(e) => setConfig({ ...config, button_label: e.target.value })}
                        className="input" />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-[13px] text-white">
                    <input type="checkbox" checked={config.active}
                      onChange={(e) => setConfig({ ...config, active: e.target.checked })} />
                    <span>Active (show on articles)</span>
                  </label>
                  <button onClick={save} disabled={saving}
                    className="px-4 py-2 bg-[#ff6b4a] hover:bg-[#ff8566] text-white rounded-lg text-[13px] font-semibold disabled:opacity-50">
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              )}

              {tab === "responses" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter responses…"
                      className="flex-1 min-w-[200px] px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50" />
                    <button onClick={downloadCsv} disabled={!submissions.length}
                      className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#222] rounded-lg text-[12px] font-semibold text-white disabled:opacity-50">
                      Download CSV
                    </button>
                  </div>
                  {filtered.length === 0 ? (
                    <div className="text-[13px] text-[#666] py-8 text-center border border-dashed border-[#222] rounded-lg">
                      {submissions.length === 0 ? "No submissions yet." : "No matches."}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filtered.map(s => (
                        <div key={s.id} className="p-3 border border-[#1a1a1a] rounded-lg bg-[#0c0c0c]">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="text-[11px] text-[#666]">
                              {new Date(s.created_at).toLocaleString()}
                              {s.article_slug && <span className="ml-2 text-[#ff6b4a]">/news/{s.article_slug}/</span>}
                            </div>
                            <button onClick={() => deleteSubmission(s.id)}
                              className="text-[11px] text-red-400 hover:text-red-300">Delete</button>
                          </div>
                          <div className="text-[13px] text-white whitespace-pre-wrap leading-relaxed">{s.story}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .input {
          width: 100%;
          padding: 8px 12px;
          background: #111;
          border: 1px solid #222;
          border-radius: 8px;
          font-size: 13px;
          color: #fff;
          outline: none;
        }
        .input:focus { border-color: rgba(255,107,74,0.5); }
      `}</style>
    </>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${active ? "bg-white/10 text-white" : "text-[#666] hover:text-white"}`}>
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-[#666] mb-1.5">{label}</span>
      {children}
    </label>
  );
}
