import React, { useState, useEffect, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props {
  supabase: SupabaseClient;
}

interface WrappedEntry {
  id: string;
  first_name: string;
  email: string;
  company: string;
  city: string;
  why_listen: string;
  wants_coffee_chat: boolean;
  created_at: string;
}

type SortKey = "created_at" | "first_name" | "company" | "city";

// Admin view of /wrapped giveaway submissions (wrapped_entries table).
// Read/delete rely on the "Admin read/delete wrapped entries" RLS policies
// in supabase/migrations/0025_wrapped_giveaway.sql — gated on the signed-in
// admin's email, same as surveys.
export default function LandingPageScreen({ supabase }: Props) {
  const [entries, setEntries] = useState<WrappedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [coffeeOnly, setCoffeeOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("wrapped_entries")
      .select("*")
      .order("created_at", { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    const { error } = await supabase.from("wrapped_entries").delete().eq("id", id);
    if (error) { alert(`Delete failed: ${error.message}`); return; }
    load();
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  function exportCsv() {
    const header = ["First name", "Email", "Company", "City", "Why they listen", "Wants coffee chat", "Submitted"];
    const rows = sorted.map(e => [
      e.first_name, e.email, e.company, e.city, e.why_listen,
      e.wants_coffee_chat ? "Yes" : "No", e.created_at,
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wrapped-entries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sorted = [...entries]
    .filter(e => !coffeeOnly || e.wants_coffee_chat)
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        e.first_name?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.company?.toLowerCase().includes(q) ||
        e.city?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey] as any, bv = b[sortKey] as any;
      if (av == null) return 1;
      if (bv == null) return -1;
      return String(av).localeCompare(String(bv)) * dir;
    });

  const coffeeCount = entries.filter(e => e.wants_coffee_chat).length;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[15px] font-bold text-white">/wrapped giveaway</h3>
        <p className="text-[13px] text-[#666] mt-1">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"} · {coffeeCount} requested a coffee chat
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, company, city…"
          className="flex-1 min-w-[200px] px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
        />
        <label className="flex items-center gap-2 text-[13px] text-[#aaa] cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={coffeeOnly}
            onChange={(e) => setCoffeeOnly(e.target.checked)}
            className="w-4 h-4 accent-[#ff6b4a]"
          />
          Coffee chat only
        </label>
        <button onClick={exportCsv}
          className="px-4 py-2 bg-[#1a1a1a] border border-[#222] text-[13px] font-semibold text-[#ccc] rounded-lg hover:text-white hover:border-[#444] transition-colors">
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="text-[13px] text-[#666]">Loading…</div>
      ) : sorted.length === 0 ? (
        <div className="text-[13px] text-[#666] py-12 text-center border border-dashed border-[#222] rounded-xl">
          No entries yet.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#1a1a1a] rounded-xl">
          <table className="w-full text-[13px]">
            <thead className="bg-[#0c0c0c] text-[11px] uppercase tracking-wider text-[#666]">
              <tr>
                <Th label="Name"    active={sortKey==="first_name"} dir={sortDir} onClick={() => toggleSort("first_name")} />
                <th className="px-3 py-2 text-left">Email</th>
                <Th label="Company" active={sortKey==="company"}    dir={sortDir} onClick={() => toggleSort("company")} />
                <Th label="City"    active={sortKey==="city"}       dir={sortDir} onClick={() => toggleSort("city")} />
                <th className="px-3 py-2 text-left">Why they listen</th>
                <th className="px-3 py-2 text-left">Coffee chat</th>
                <Th label="Submitted" active={sortKey==="created_at"} dir={sortDir} onClick={() => toggleSort("created_at")} />
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(e => (
                <tr key={e.id} className="border-t border-[#1a1a1a] hover:bg-[#0d0d0d] align-top">
                  <td className="px-3 py-3 text-white font-medium whitespace-nowrap">{e.first_name}</td>
                  <td className="px-3 py-3 text-[#888]">
                    <a href={`mailto:${e.email}`} className="hover:text-[#ff6b4a]">{e.email}</a>
                  </td>
                  <td className="px-3 py-3 text-[#888] whitespace-nowrap">{e.company}</td>
                  <td className="px-3 py-3 text-[#888] whitespace-nowrap">{e.city}</td>
                  <td className="px-3 py-3 text-[#aaa] max-w-[280px]">{e.why_listen}</td>
                  <td className="px-3 py-3">
                    {e.wants_coffee_chat
                      ? <span className="text-[11px] font-semibold text-[#ff6b4a] bg-[#ff6b4a]/10 border border-[#ff6b4a]/20 rounded-full px-2 py-0.5">Yes</span>
                      : <span className="text-[#555]">—</span>}
                  </td>
                  <td className="px-3 py-3 text-[#666] whitespace-nowrap">{fmtDate(e.created_at)}</td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => handleDelete(e.id)} className="text-[12px] text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
