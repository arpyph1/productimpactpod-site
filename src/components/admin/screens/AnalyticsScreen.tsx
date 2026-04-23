import React, { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }

interface EngagementRow {
  article_id: string;
  views: number;
  shares: number;
  hearts: number;
  title?: string;
  slug?: string;
  publish_date?: string;
}

type SortKey = "views" | "shares" | "hearts";

export default function AnalyticsScreen({ supabase }: Props) {
  const [data, setData] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SortKey>("views");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [engRes, artRes] = await Promise.all([
      supabase.from("article_engagement").select("*"),
      supabase.from("articles").select("id, title, slug, publish_date").eq("published", true),
    ]);

    const articles = new Map<string, { title: string; slug: string; publish_date: string }>();
    (artRes.data ?? []).forEach((a: any) => articles.set(a.id, a));

    const rows: EngagementRow[] = (engRes.data ?? []).map((e: any) => {
      const art = articles.get(e.article_id);
      return {
        article_id: e.article_id,
        views: e.views ?? 0,
        shares: e.shares ?? 0,
        hearts: e.hearts ?? 0,
        title: art?.title ?? "Unknown",
        slug: art?.slug,
        publish_date: art?.publish_date,
      };
    });

    setData(rows);
    setLoading(false);
  }

  const sorted = [...data].sort((a, b) => b[tab] - a[tab]);
  const displayed = showAll ? sorted : sorted.slice(0, 10);
  const totals = data.reduce((acc, r) => ({
    views: acc.views + r.views,
    shares: acc.shares + r.shares,
    hearts: acc.hearts + r.hearts,
  }), { views: 0, shares: 0, hearts: 0 });

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Views" value={totals.views} icon="👁" active={tab === "views"} onClick={() => setTab("views")} />
        <SummaryCard label="Total Shares" value={totals.shares} icon="↗" active={tab === "shares"} onClick={() => setTab("shares")} />
        <SummaryCard label="Total Hearts" value={totals.hearts} icon="❤️" active={tab === "hearts"} onClick={() => setTab("hearts")} />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#0c0c0c] border-b border-[#1a1a1a]">
          <div className="flex items-center gap-1">
            {(["views", "shares", "hearts"] as SortKey[]).map(k => (
              <button key={k} onClick={() => { setTab(k); setShowAll(false); }}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${k === tab ? "bg-white/10 text-white" : "text-[#555] hover:text-white"}`}>
                {k === "views" ? "👁 Most Viewed" : k === "shares" ? "↗ Most Shared" : "❤️ Most Hearted"}
              </button>
            ))}
          </div>
          <button onClick={loadData} className="text-[11px] text-[#555] hover:text-white transition-colors">↻ Refresh</button>
        </div>

        <table className="w-full">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-[#555] border-b border-[#1a1a1a]">
              <th className="text-left px-4 py-2.5 w-8">#</th>
              <th className="text-left px-4 py-2.5">Article</th>
              <th className="text-right px-4 py-2.5 w-20">Views</th>
              <th className="text-right px-4 py-2.5 w-20">Shares</th>
              <th className="text-right px-4 py-2.5 w-20">Hearts</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-[#555] text-[13px]">No engagement data yet. Views, shares, and hearts will appear as readers interact with articles.</td></tr>
            ) : displayed.map((row, i) => (
              <tr key={row.article_id} className="border-b border-[#111] hover:bg-[#0c0c0c] transition-colors">
                <td className="px-4 py-3 text-[12px] text-[#555] font-mono">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="text-[13px] font-semibold text-white leading-snug line-clamp-1">{row.title}</div>
                  {row.slug && (
                    <a href={`/news/${row.slug}/`} target="_blank" rel="noopener" className="text-[10px] text-[#555] hover:text-[#ff6b4a] transition-colors">
                      /news/{row.slug}/
                    </a>
                  )}
                </td>
                <td className={`px-4 py-3 text-right text-[13px] font-mono ${tab === "views" ? "text-white font-bold" : "text-[#666]"}`}>
                  {row.views.toLocaleString()}
                </td>
                <td className={`px-4 py-3 text-right text-[13px] font-mono ${tab === "shares" ? "text-white font-bold" : "text-[#666]"}`}>
                  {row.shares.toLocaleString()}
                </td>
                <td className={`px-4 py-3 text-right text-[13px] font-mono ${tab === "hearts" ? "text-[#ff6b4a] font-bold" : "text-[#666]"}`}>
                  {row.hearts.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sorted.length > 10 && !showAll && (
          <div className="px-4 py-3 bg-[#0c0c0c] border-t border-[#1a1a1a] text-center">
            <button onClick={() => setShowAll(true)}
              className="text-[12px] text-[#ff6b4a] hover:text-[#ff8566] font-semibold transition-colors">
              View all {sorted.length} articles →
            </button>
          </div>
        )}
        {showAll && sorted.length > 10 && (
          <div className="px-4 py-3 bg-[#0c0c0c] border-t border-[#1a1a1a] text-center">
            <button onClick={() => setShowAll(false)}
              className="text-[12px] text-[#555] hover:text-white font-semibold transition-colors">
              Show top 10 only
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, active, onClick }: {
  label: string; value: number; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`p-4 rounded-xl border text-left transition-all ${active ? "border-[#ff6b4a]/30 bg-[#ff6b4a]/5" : "border-[#1a1a1a] bg-[#0c0c0c] hover:border-[#333]"}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#555] mb-1">{icon} {label}</div>
      <div className={`text-[28px] font-extrabold ${active ? "text-[#ff6b4a]" : "text-white"}`}>
        {value.toLocaleString()}
      </div>
    </button>
  );
}
