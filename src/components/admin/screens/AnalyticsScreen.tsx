import React, { useState, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import ArticleAnalyticsDetail from "../ArticleAnalyticsDetail";

interface Props { supabase: SupabaseClient }

interface EngagementRow {
  article_id: string;
  views: number;
  shares: number;
  hearts: number;
  avg_read_pct: number;
  read_pct_count: number;
  link_clicks: number;
  avg_pages: number;
  session_count: number;
  title?: string;
  slug?: string;
  publish_date?: string;
}

type SortKey = "views" | "shares" | "hearts" | "avg_read_pct" | "link_clicks" | "avg_pages" | "publish_date";

export default function AnalyticsScreen({ supabase }: Props) {
  const [data, setData] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SortKey>("views");
  const [showAll, setShowAll] = useState(false);
  const [minReadPct, setMinReadPct] = useState(0);
  const [minLinkClicks, setMinLinkClicks] = useState(0);
  const [detailRow, setDetailRow] = useState<EngagementRow | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [engRes, artRes, sesRes] = await Promise.all([
        supabase.from("article_engagement").select("*"),
        supabase.from("articles").select("id, title, slug, publish_date").eq("published", true),
        // Aggregated server-side — avoids downloading every raw session row.
        supabase.rpc("get_session_stats"),
      ]);

      const sessionsByArticle = new Map<string, { avg_pages: number; session_count: number }>();
      (sesRes.data ?? []).forEach((s: any) => {
        sessionsByArticle.set(s.landing_article_id as string, {
          avg_pages: parseFloat(s.avg_pages) || 0,
          session_count: parseInt(s.session_count) || 0,
        });
      });

      const engagementByArticle = new Map<string, { views: number; shares: number; hearts: number; avg_read_pct: number; read_pct_count: number; link_clicks: number }>();
      (engRes.data ?? []).forEach((e: any) => {
        const sum = e.read_pct_sum ?? 0;
        const count = e.read_pct_count ?? 0;
        engagementByArticle.set(e.article_id, {
          views: e.views ?? 0, shares: e.shares ?? 0, hearts: e.hearts ?? 0,
          avg_read_pct: count > 0 ? Math.round(sum / count) : 0,
          read_pct_count: count,
          link_clicks: e.link_clicks ?? 0,
        });
      });

      // Include every published article so "Newest" sort surfaces articles that
      // haven't accumulated engagement yet.
      const rows: EngagementRow[] = (artRes.data ?? []).map((a: any) => {
        const eng = engagementByArticle.get(a.id) ?? { views: 0, shares: 0, hearts: 0, avg_read_pct: 0, read_pct_count: 0, link_clicks: 0 };
        const ses = sessionsByArticle.get(a.id) ?? { avg_pages: 0, session_count: 0 };
        return {
          article_id: a.id,
          views: eng.views, shares: eng.shares, hearts: eng.hearts,
          avg_read_pct: eng.avg_read_pct, read_pct_count: eng.read_pct_count,
          link_clicks: eng.link_clicks,
          avg_pages: ses.avg_pages,
          session_count: ses.session_count,
          title: a.title, slug: a.slug, publish_date: a.publish_date,
        };
      });

      setData(rows);
    } catch (e) {
      console.error("Analytics loadData failed:", e);
    } finally {
      setLoading(false);
    }
  }

  const filteredData = data.filter(r =>
    r.avg_read_pct >= minReadPct && r.link_clicks >= minLinkClicks
  );
  const sorted = [...filteredData].sort((a, b) => {
    if (tab === "publish_date") {
      const at = a.publish_date ? new Date(a.publish_date).getTime() : 0;
      const bt = b.publish_date ? new Date(b.publish_date).getTime() : 0;
      return bt - at;
    }
    return (b[tab] as number) - (a[tab] as number);
  });
  const displayed = showAll ? sorted : sorted.slice(0, 10);
  const totals = data.reduce((acc, r) => ({
    views: acc.views + r.views,
    shares: acc.shares + r.shares,
    hearts: acc.hearts + r.hearts,
    link_clicks: acc.link_clicks + r.link_clicks,
    pct_sum: acc.pct_sum + r.avg_read_pct * r.read_pct_count,
    pct_count: acc.pct_count + r.read_pct_count,
    pages_sum: acc.pages_sum + r.avg_pages * r.session_count,
    sessions: acc.sessions + r.session_count,
  }), { views: 0, shares: 0, hearts: 0, link_clicks: 0, pct_sum: 0, pct_count: 0, pages_sum: 0, sessions: 0 });
  const totalAvgReadPct = totals.pct_count > 0 ? Math.round(totals.pct_sum / totals.pct_count) : 0;
  const totalAvgPages = totals.sessions > 0 ? Math.round((totals.pages_sum / totals.sessions) * 10) / 10 : 0;

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Total Views" value={totals.views} icon="👁" active={tab === "views"} onClick={() => setTab("views")} />
        <SummaryCard label="Total Shares" value={totals.shares} icon="↗" active={tab === "shares"} onClick={() => setTab("shares")} />
        <SummaryCard label="Total Hearts" value={totals.hearts} icon="❤️" active={tab === "hearts"} onClick={() => setTab("hearts")} />
        <SummaryCard label="Avg % Read" value={totalAvgReadPct} suffix="%" icon="📖" active={tab === "avg_read_pct"} onClick={() => setTab("avg_read_pct")} />
        <SummaryCard label="Link Clicks" value={totals.link_clicks} icon="🔗" active={tab === "link_clicks"} onClick={() => setTab("link_clicks")} />
        <SummaryCard label="Avg Pages" value={totalAvgPages} icon="📄" active={tab === "avg_pages"} onClick={() => setTab("avg_pages")} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 rounded-xl border border-[#1a1a1a] bg-[#0c0c0c]">
        <span className="text-[11px] uppercase tracking-wider text-[#555] font-bold">Filter</span>
        <label className="flex items-center gap-2 text-[12px] text-[#888]">
          Min % read
          <input type="number" min={0} max={100} value={minReadPct}
            onChange={(e) => setMinReadPct(parseInt(e.target.value) || 0)}
            className="w-16 px-2 py-1 bg-[#111] border border-[#222] rounded text-[12px] text-white" />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-[#888]">
          Min link clicks
          <input type="number" min={0} value={minLinkClicks}
            onChange={(e) => setMinLinkClicks(parseInt(e.target.value) || 0)}
            className="w-16 px-2 py-1 bg-[#111] border border-[#222] rounded text-[12px] text-white" />
        </label>
        {(minReadPct > 0 || minLinkClicks > 0) && (
          <button onClick={() => { setMinReadPct(0); setMinLinkClicks(0); }}
            className="text-[11px] text-[#ff6b4a] hover:text-[#ff8566]">Clear</button>
        )}
        <span className="ml-auto text-[11px] text-[#555]">{filteredData.length} of {data.length} articles</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#0c0c0c] border-b border-[#1a1a1a]">
          <span className="text-[11px] text-[#555]">
            Sorted by <span className="text-white font-semibold">
              {tab === "views" ? "Views" : tab === "shares" ? "Shares" : tab === "hearts" ? "Hearts"
                : tab === "avg_read_pct" ? "% Read" : tab === "link_clicks" ? "Link Clicks"
                : tab === "avg_pages" ? "Avg Pages" : "Publish date"}
            </span>
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => { setTab(tab === "publish_date" ? "views" : "publish_date"); setShowAll(false); }}
              className={`text-[11px] transition-colors ${tab === "publish_date" ? "text-[#ff6b4a]" : "text-[#555] hover:text-white"}`}>
              {tab === "publish_date" ? "✓ Newest first" : "🗓 Sort by newest"}
            </button>
            <button onClick={loadData} className="text-[11px] text-[#555] hover:text-white transition-colors">↻ Refresh</button>
          </div>
        </div>

        {/* Engagement table is wider than a phone — wrap in horizontal
            scroll instead of clipping article titles. */}
        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-[#555] border-b border-[#1a1a1a]">
              <th className="text-left px-4 py-2.5 w-8">#</th>
              <th className="text-left px-4 py-2.5">Article</th>
              <th className="text-right px-4 py-2.5 w-20">Views</th>
              <th className="text-right px-4 py-2.5 w-20">Shares</th>
              <th className="text-right px-4 py-2.5 w-20">Hearts</th>
              <th className="text-right px-4 py-2.5 w-20">% Read</th>
              <th className="text-right px-4 py-2.5 w-20">Clicks</th>
              <th className="text-right px-4 py-2.5 w-20">Avg Pages</th>
              <th className="text-right px-4 py-2.5 w-28">Published</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-[#555] text-[13px]">No engagement data yet. Views, shares, and hearts will appear as readers interact with articles.</td></tr>
            ) : displayed.map((row, i) => (
              <tr key={row.article_id} onClick={() => setDetailRow(row)}
                className="border-b border-[#111] hover:bg-[#101010] cursor-pointer transition-colors">
                <td className="px-4 py-3 text-[12px] text-[#555] font-mono">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="text-[13px] font-semibold text-white leading-snug line-clamp-1 hover:text-[#ff6b4a]">{row.title}</div>
                  {row.slug && (
                    <a href={`/news/${row.slug}/`} target="_blank" rel="noopener"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-[#555] hover:text-[#ff6b4a] transition-colors">
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
                <td className={`px-4 py-3 text-right text-[13px] font-mono ${tab === "avg_read_pct" ? "text-white font-bold" : "text-[#666]"}`}>
                  {row.read_pct_count > 0 ? `${row.avg_read_pct}%` : "—"}
                </td>
                <td className={`px-4 py-3 text-right text-[13px] font-mono ${tab === "link_clicks" ? "text-white font-bold" : "text-[#666]"}`}>
                  {row.link_clicks.toLocaleString()}
                </td>
                <td className={`px-4 py-3 text-right text-[13px] font-mono ${tab === "avg_pages" ? "text-white font-bold" : "text-[#666]"}`}>
                  {row.session_count > 0 ? row.avg_pages.toFixed(1) : "—"}
                </td>
                <td className={`px-4 py-3 text-right text-[12px] whitespace-nowrap ${tab === "publish_date" ? "text-white font-bold" : "text-[#666]"}`}>
                  {row.publish_date ? new Date(row.publish_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

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

      {detailRow && (
        <ArticleAnalyticsDetail
          supabase={supabase}
          article={detailRow}
          allArticles={data}
          onClose={() => setDetailRow(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, active, onClick, suffix }: {
  label: string; value: number; icon: string; active: boolean; onClick: () => void; suffix?: string;
}) {
  return (
    <button onClick={onClick}
      className={`p-4 rounded-xl border text-left transition-all ${active ? "border-[#ff6b4a]/30 bg-[#ff6b4a]/5" : "border-[#1a1a1a] bg-[#0c0c0c] hover:border-[#333]"}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#555] mb-1">{icon} {label}</div>
      <div className={`text-[24px] font-extrabold ${active ? "text-[#ff6b4a]" : "text-white"}`}>
        {value.toLocaleString()}{suffix ?? ""}
      </div>
    </button>
  );
}
