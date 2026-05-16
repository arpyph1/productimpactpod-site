import React, { useState, useEffect, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import SurveyEditor from "../SurveyEditor";
import SurveyResultsModal from "../SurveyResultsModal";
import StoryWidgetAdmin from "../StoryWidgetAdmin";

interface Props {
  supabase: SupabaseClient;
}

interface SurveyRow {
  id: string;
  title: string;
  questions: any[];
  created_at: string;
  updated_at: string;
  response_count: number;
  last_response_at: string | null;
}

type SortKey = "created_at" | "updated_at" | "response_count" | "title";

export default function SurveysScreen({ supabase }: Props) {
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SurveyRow | "new" | null>(null);
  const [viewingResults, setViewingResults] = useState<SurveyRow | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("surveys_with_counts")
      .select("*")
      .order("created_at", { ascending: false });
    setSurveys(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function handleDuplicate(s: SurveyRow) {
    const { data: full } = await supabase.from("surveys").select("*").eq("id", s.id).single();
    if (!full) { alert("Failed to load survey for duplication."); return; }
    const { error } = await supabase.from("surveys").insert({
      title: `${full.title} (Copy)`,
      questions: full.questions ?? [],
      complete: full.complete ?? {},
    });
    if (error) { alert(`Duplicate failed: ${error.message}`); return; }
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this survey and all its responses? This cannot be undone.")) return;
    const { error } = await supabase.from("surveys").delete().eq("id", id);
    if (error) { alert(`Delete failed: ${error.message}`); return; }
    load();
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  const sorted = [...surveys]
    .filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey] as any, bv = b[sortKey] as any;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });

  return (
    <div className="space-y-5">
      <StoryWidgetAdmin supabase={supabase} />

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setEditing("new")}
          className="px-4 py-2 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566] transition-colors">
          + New Survey
        </button>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search surveys…"
          className="flex-1 min-w-[200px] px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
        />
      </div>

      {loading ? (
        <div className="text-[13px] text-[#666]">Loading…</div>
      ) : sorted.length === 0 ? (
        <div className="text-[13px] text-[#666] py-12 text-center border border-dashed border-[#222] rounded-xl">
          No surveys yet. Create one and embed it in an article.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#1a1a1a] rounded-xl">
          <table className="w-full text-[13px]">
            <thead className="bg-[#0c0c0c] text-[11px] uppercase tracking-wider text-[#666]">
              <tr>
                <Th label="Title"     active={sortKey==="title"}          dir={sortDir} onClick={() => toggleSort("title")} />
                <Th label="Questions" />
                <Th label="Responses" active={sortKey==="response_count"} dir={sortDir} onClick={() => toggleSort("response_count")} />
                <Th label="Created"   active={sortKey==="created_at"}     dir={sortDir} onClick={() => toggleSort("created_at")} />
                <Th label="Updated"   active={sortKey==="updated_at"}     dir={sortDir} onClick={() => toggleSort("updated_at")} />
                <th className="px-3 py-2 text-right">Embed</th>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2"></th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <tr key={s.id} className="border-t border-[#1a1a1a] hover:bg-[#0d0d0d]">
                  <td className="px-3 py-3">
                    <button onClick={() => setEditing(s)} className="text-white hover:text-[#ff6b4a] font-medium text-left">
                      {s.title || <span className="italic text-[#555]">Untitled</span>}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-[#888]">{s.questions?.length ?? 0}</td>
                  <td className="px-3 py-3 text-[#888]">{s.response_count}</td>
                  <td className="px-3 py-3 text-[#666]">{fmtDate(s.created_at)}</td>
                  <td className="px-3 py-3 text-[#666]">{fmtDate(s.updated_at)}</td>
                  <td className="px-3 py-3 text-right">
                    <code className="text-[11px] text-[#ff6b4a] bg-[#111] px-2 py-1 rounded border border-[#1a1a1a] cursor-pointer"
                      onClick={() => { navigator.clipboard.writeText(`[survey:${s.id}]`); }}
                      title="Click to copy">
                      [survey:{s.id.slice(0, 8)}…]
                    </code>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => setViewingResults(s)} className="text-[12px] text-[#ff6b4a] hover:text-[#ff8566]">
                      Results
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => handleDuplicate(s)} className="text-[12px] text-[#aaa] hover:text-white">
                      Duplicate
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => handleDelete(s.id)} className="text-[12px] text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <SurveyEditor
          supabase={supabase}
          survey={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {viewingResults && (
        <SurveyResultsModal
          supabase={supabase}
          survey={viewingResults}
          onClose={() => setViewingResults(null)}
        />
      )}
    </div>
  );
}

function Th({ label, active, dir, onClick }: { label: string; active?: boolean; dir?: "asc"|"desc"; onClick?: () => void }) {
  return (
    <th className={`px-3 py-2 text-left ${onClick ? "cursor-pointer select-none hover:text-white" : ""} ${active ? "text-[#ff6b4a]" : ""}`}
        onClick={onClick}>
      {label}{active && (dir === "asc" ? " ↑" : " ↓")}
    </th>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
