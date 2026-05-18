import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ArticleRow {
  article_id: string;
  title?: string;
  slug?: string;
  views: number;
  shares: number;
  hearts: number;
  avg_read_pct: number;
  read_pct_count: number;
  link_clicks: number;
  avg_pages: number;
  session_count: number;
  publish_date?: string;
}

interface Props {
  supabase: SupabaseClient;
  article: ArticleRow;
  allArticles: ArticleRow[];
  onClose: () => void;
}

type Metric = "view" | "share" | "heart" | "read_pct" | "link_click";

const METRICS: { key: Metric; label: string; icon: string; unit: string }[] = [
  { key: "view",       label: "Views",       icon: "👁",  unit: "" },
  { key: "share",      label: "Shares",      icon: "↗",  unit: "" },
  { key: "heart",      label: "Hearts",      icon: "❤️", unit: "" },
  { key: "read_pct",   label: "% Read",      icon: "📖", unit: "%" },
  { key: "link_click", label: "Link Clicks", icon: "🔗", unit: "" },
];

const RANGE_PRESETS: { label: string; days: number | null }[] = [
  { label: "7d",  days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: null },
];

const SERIES_COLORS = ["#ff6b4a", "#4aa3ff", "#9d7aff", "#4adb8c", "#ffd24a"];

interface DailyPoint { date: string; value: number; }
interface Series {
  articleId: string;
  title: string;
  points: DailyPoint[];
  color: string;
}

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function parseDate(s: string) { return new Date(s + "T00:00:00Z"); }

// Build a continuous date axis between `from` and `to` so empty days render as 0.
function dateRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  const d = new Date(from); d.setUTCHours(0, 0, 0, 0);
  const end = new Date(to); end.setUTCHours(0, 0, 0, 0);
  while (d <= end) { out.push(fmtDate(d)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

async function loadSeries(
  supabase: SupabaseClient,
  articleId: string,
  metric: Metric,
  fromIso: string,
  toIso: string,
): Promise<DailyPoint[]> {
  const { data } = await supabase
    .from("article_events")
    .select("amount, created_at")
    .eq("article_id", articleId)
    .eq("event_type", metric)
    .gte("created_at", fromIso)
    .lte("created_at", toIso);

  const byDay = new Map<string, { sum: number; count: number }>();
  (data ?? []).forEach((r: any) => {
    const day = String(r.created_at).slice(0, 10);
    const cur = byDay.get(day) ?? { sum: 0, count: 0 };
    cur.sum += r.amount ?? 1;
    cur.count += 1;
    byDay.set(day, cur);
  });

  const from = parseDate(fromIso.slice(0, 10));
  const to = parseDate(toIso.slice(0, 10));
  return dateRange(from, to).map(day => {
    const b = byDay.get(day);
    if (!b) return { date: day, value: 0 };
    // % read is an average per day; other metrics are sums.
    const value = metric === "read_pct" ? Math.round(b.sum / b.count) : b.sum;
    return { date: day, value };
  });
}

export default function ArticleAnalyticsDetail({ supabase, article, allArticles, onClose }: Props) {
  const [metric, setMetric] = useState<Metric>("view");
  const [rangeDays, setRangeDays] = useState<number | null>(30);
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showComparePicker, setShowComparePicker] = useState(false);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);

  // Compute concrete from/to from preset OR custom range.
  const { fromIso, toIso, fromLabel, toLabel } = useMemo(() => {
    const to = customTo ? parseDate(customTo) : new Date();
    let from: Date;
    if (customFrom) {
      from = parseDate(customFrom);
    } else if (rangeDays !== null) {
      from = new Date(to);
      from.setUTCDate(from.getUTCDate() - rangeDays + 1);
    } else {
      // "All" — go back to article publish date or 365d, whichever is sooner.
      from = article.publish_date ? new Date(article.publish_date) : new Date(to.getTime() - 365 * 86400e3);
    }
    return {
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
      fromLabel: fmtDate(from),
      toLabel: fmtDate(to),
    };
  }, [rangeDays, customFrom, customTo, article.publish_date]);

  const reload = useCallback(async () => {
    setLoading(true);
    const ids = [article.article_id, ...compareIds];
    const titles = new Map<string, string>();
    titles.set(article.article_id, article.title ?? "(untitled)");
    compareIds.forEach((id) => {
      const a = allArticles.find(x => x.article_id === id);
      if (a) titles.set(id, a.title ?? "(untitled)");
    });

    const results = await Promise.all(
      ids.map((id) => loadSeries(supabase, id, metric, fromIso, toIso))
    );
    setSeries(results.map((points, i) => ({
      articleId: ids[i],
      title: titles.get(ids[i]) ?? "",
      points,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    })));
    setLoading(false);
  }, [supabase, article, allArticles, compareIds, metric, fromIso, toIso]);

  useEffect(() => { reload(); }, [reload]);

  // Sum for the primary series across the selected window — shown above the chart.
  const primary = series[0];
  const primarySum = useMemo(() => {
    if (!primary) return 0;
    if (metric === "read_pct") {
      const nonzero = primary.points.filter(p => p.value > 0);
      if (!nonzero.length) return 0;
      return Math.round(nonzero.reduce((a, p) => a + p.value, 0) / nonzero.length);
    }
    return primary.points.reduce((a, p) => a + p.value, 0);
  }, [primary, metric]);

  function downloadMarkdown() {
    if (!primary) return;
    const m = METRICS.find(x => x.key === metric)!;
    const lines: string[] = [];
    lines.push(`# ${article.title ?? article.article_id}`);
    lines.push("");
    lines.push(`- Slug: \`/news/${article.slug}/\``);
    lines.push(`- Metric: ${m.label}`);
    lines.push(`- Range: ${fromLabel} → ${toLabel}`);
    lines.push("");
    lines.push("## Lifetime totals");
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Views | ${article.views.toLocaleString()} |`);
    lines.push(`| Shares | ${article.shares.toLocaleString()} |`);
    lines.push(`| Hearts | ${article.hearts.toLocaleString()} |`);
    lines.push(`| Avg % Read | ${article.read_pct_count > 0 ? article.avg_read_pct + "%" : "—"} |`);
    lines.push(`| Link Clicks | ${article.link_clicks.toLocaleString()} |`);
    lines.push(`| Avg Pages / Session | ${article.session_count > 0 ? article.avg_pages.toFixed(1) : "—"} |`);
    lines.push("");
    series.forEach((s) => {
      lines.push(`## ${s.title}`);
      lines.push("");
      lines.push(`| Date | ${m.label}${m.unit ? " (" + m.unit + ")" : ""} |`);
      lines.push(`| --- | --- |`);
      s.points.forEach(p => lines.push(`| ${p.date} | ${p.value}${m.unit} |`));
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${article.slug || article.article_id}-${metric}-${fromLabel}-to-${toLabel}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleCompare(id: string) {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 4 ? [...prev, id] : prev);
  }

  const m = METRICS.find(x => x.key === metric)!;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-[#0a0a0a] border border-[#222] rounded-xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#1a1a1a]">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-[#ff6b4a] font-bold mb-1">Article analytics</div>
            <div className="text-[16px] font-bold text-white leading-snug line-clamp-2">{article.title}</div>
            {article.slug && <div className="text-[11px] text-[#555] mt-0.5">/news/{article.slug}/</div>}
          </div>
          <button onClick={onClose} className="text-[#666] hover:text-white text-[24px] leading-none">×</button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* Lifetime totals — clickable to pick the chart metric */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <MetricCard label="Views" value={article.views} icon="👁" active={metric === "view"} onClick={() => setMetric("view")} />
            <MetricCard label="Shares" value={article.shares} icon="↗" active={metric === "share"} onClick={() => setMetric("share")} />
            <MetricCard label="Hearts" value={article.hearts} icon="❤️" active={metric === "heart"} onClick={() => setMetric("heart")} />
            <MetricCard label="% Read" value={article.read_pct_count > 0 ? article.avg_read_pct : 0} suffix={article.read_pct_count > 0 ? "%" : ""} icon="📖" active={metric === "read_pct"} onClick={() => setMetric("read_pct")} />
            <MetricCard label="Link Clicks" value={article.link_clicks} icon="🔗" active={metric === "link_click"} onClick={() => setMetric("link_click")} />
          </div>

          {/* Range controls */}
          <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-xl border border-[#1a1a1a] bg-[#0c0c0c]">
            <span className="text-[11px] uppercase tracking-wider text-[#555] font-bold">Range</span>
            {RANGE_PRESETS.map(p => (
              <button key={p.label}
                onClick={() => { setRangeDays(p.days); setCustomFrom(""); setCustomTo(""); }}
                className={`text-[11px] px-2 py-1 rounded ${rangeDays === p.days && !customFrom ? "bg-white/10 text-white" : "text-[#666] hover:text-white"}`}>
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-1 ml-2">
              <input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setRangeDays(null); }}
                className="px-2 py-1 bg-[#111] border border-[#222] rounded text-[11px] text-white" />
              <span className="text-[#555] text-[11px]">→</span>
              <input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setRangeDays(null); }}
                className="px-2 py-1 bg-[#111] border border-[#222] rounded text-[11px] text-white" />
            </div>
            <span className="ml-auto text-[11px] text-[#555]">{fromLabel} → {toLabel}</span>
          </div>

          {/* Chart */}
          <div className="rounded-xl border border-[#1a1a1a] bg-[#0c0c0c] p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] uppercase tracking-wider text-[#555] font-bold">{m.label} per day</span>
                {primary && (
                  <span className="text-[20px] font-bold text-white">
                    {primarySum.toLocaleString()}{m.unit}
                    {metric === "read_pct" && <span className="text-[11px] text-[#555] ml-1">avg</span>}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowComparePicker(s => !s)}
                  className="text-[11px] px-2.5 py-1 rounded bg-[#1a1a1a] hover:bg-[#222] text-white border border-[#222]">
                  Compare {compareIds.length > 0 && `(${compareIds.length})`}
                </button>
                <button onClick={downloadMarkdown}
                  className="text-[11px] px-2.5 py-1 rounded bg-[#1a1a1a] hover:bg-[#222] text-white border border-[#222]">
                  ⬇ Markdown
                </button>
              </div>
            </div>
            {loading ? (
              <div className="h-[240px] flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <Chart series={series} unit={m.unit} />
            )}
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3">
              {series.map(s => (
                <div key={s.articleId} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-3 h-0.5" style={{ background: s.color }} />
                  <span className="text-white">{s.title}</span>
                  {s.articleId !== article.article_id && (
                    <button onClick={() => toggleCompare(s.articleId)} className="text-[#666] hover:text-red-400 ml-1">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Compare picker */}
          {showComparePicker && (
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0c0c0c] p-3">
              <div className="text-[11px] uppercase tracking-wider text-[#555] font-bold mb-2">Compare with (max 4)</div>
              <div className="max-h-[200px] overflow-auto space-y-1">
                {allArticles
                  .filter(a => a.article_id !== article.article_id)
                  .slice(0, 50)
                  .map(a => (
                    <label key={a.article_id} className="flex items-center gap-2 text-[12px] text-white cursor-pointer hover:bg-[#111] px-2 py-1 rounded">
                      <input type="checkbox" checked={compareIds.includes(a.article_id)}
                        onChange={() => toggleCompare(a.article_id)}
                        disabled={!compareIds.includes(a.article_id) && compareIds.length >= 4} />
                      <span className="truncate flex-1">{a.title}</span>
                      <span className="text-[#555] text-[10px]">{a.views.toLocaleString()} views</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, active, onClick, suffix }: {
  label: string; value: number; icon: string; active: boolean; onClick: () => void; suffix?: string;
}) {
  return (
    <button onClick={onClick}
      className={`p-3 rounded-lg border text-left transition-all ${active ? "border-[#ff6b4a]/40 bg-[#ff6b4a]/5" : "border-[#1a1a1a] bg-[#0c0c0c] hover:border-[#333]"}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#555] mb-0.5">{icon} {label}</div>
      <div className={`text-[18px] font-extrabold ${active ? "text-[#ff6b4a]" : "text-white"}`}>
        {value.toLocaleString()}{suffix ?? ""}
      </div>
    </button>
  );
}

// Inline SVG line chart. Supports multiple overlaid series sharing the same
// date axis. No axis labels for compactness — exact values appear in the
// download markdown.
function Chart({ series, unit }: { series: Series[]; unit: string }) {
  const W = 800, H = 240, P = 28; // viewBox; SVG scales via preserveAspectRatio
  if (!series.length || !series[0].points.length) {
    return <div className="h-[240px] flex items-center justify-center text-[12px] text-[#555]">No events recorded in this range.</div>;
  }
  const days = series[0].points.length;
  const maxV = Math.max(1, ...series.flatMap(s => s.points.map(p => p.value)));
  const xStep = (W - 2 * P) / Math.max(1, days - 1);

  function pathFor(points: DailyPoint[]) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${P + i * xStep} ${H - P - (p.value / maxV) * (H - 2 * P)}`).join(" ");
  }

  // Gridlines: 4 horizontal bands.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ t, v: Math.round(maxV * t), y: H - P - t * (H - 2 * P) }));

  // Show first, middle, and last x labels.
  const xLabels = [0, Math.floor(days / 2), days - 1].map(i => ({
    i, label: series[0].points[i]?.date?.slice(5) ?? "", x: P + i * xStep,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[240px]" preserveAspectRatio="none">
      {yTicks.map(({ y, v }, i) => (
        <g key={i}>
          <line x1={P} x2={W - P} y1={y} y2={y} stroke="#1a1a1a" strokeWidth="1" />
          <text x={4} y={y + 4} fontSize="10" fill="#444">{v}{unit}</text>
        </g>
      ))}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={H - 6} fontSize="10" fill="#444" textAnchor="middle">{l.label}</text>
      ))}
      {series.map(s => (
        <path key={s.articleId} d={pathFor(s.points)} fill="none" stroke={s.color} strokeWidth="2"
          vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
