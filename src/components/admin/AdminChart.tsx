import React, { useState, useRef } from "react";

export interface DailyPoint { date: string; value: number }
export interface ChartSeries { id: string; label: string; points: DailyPoint[]; color: string }

const COLORS = ["#ff6b4a", "#4aa3ff", "#9d7aff", "#4adb8c", "#ffd24a"];
export { COLORS as CHART_COLORS };

// Builds a continuous date axis so gaps render as 0.
export function buildDateRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  const d = new Date(from); d.setUTCHours(0, 0, 0, 0);
  const end = new Date(to); end.setUTCHours(0, 0, 0, 0);
  while (d <= end) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

export function Chart({ series, unit, onPointClick, selectedDate }: {
  series: ChartSeries[];
  unit: string;
  onPointClick?: (date: string) => void;
  selectedDate?: string | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tooltipLeft, setTooltipLeft] = useState(0);
  const [flipTooltip, setFlipTooltip] = useState(false);

  const W = 800, H = 240, P = 28;

  if (!series.length || !series[0].points.length) {
    return (
      <div className="h-[240px] flex items-center justify-center text-[12px] text-[#555]">
        No events recorded in this range.
      </div>
    );
  }

  const days = series[0].points.length;
  const maxV = Math.max(1, ...series.flatMap(s => s.points.map(p => p.value)));
  const xStep = (W - 2 * P) / Math.max(1, days - 1);

  const xFor = (i: number) => P + i * xStep;
  const yFor = (v: number) => H - P - (v / maxV) * (H - 2 * P);

  function pathFor(points: DailyPoint[]) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.value)}`).join(" ");
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const idx = Math.max(0, Math.min(days - 1, Math.round(((relX / rect.width) * W - P) / xStep)));
    setHoverIdx(idx);
    setTooltipLeft(relX);
    setFlipTooltip(relX > rect.width * 0.55);
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    v: Math.round(maxV * t), y: yFor(maxV * t),
  }));
  const xLabels = [0, Math.floor(days / 2), days - 1].map(i => ({
    label: series[0].points[i]?.date?.slice(5) ?? "", x: xFor(i),
  }));

  const hoverDate = hoverIdx !== null ? series[0].points[hoverIdx]?.date : null;
  const hoverValues = hoverIdx !== null
    ? series.map(s => ({ label: s.label, color: s.color, value: s.points[hoverIdx]?.value ?? 0 }))
    : [];

  function handleClick() {
    if (hoverIdx !== null && onPointClick) {
      const date = series[0].points[hoverIdx]?.date;
      if (date) onPointClick(date);
    }
  }

  return (
    <div className="relative" onMouseLeave={() => setHoverIdx(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-[240px]"
        preserveAspectRatio="none" onMouseMove={handleMouseMove}
        onClick={handleClick} style={{ cursor: onPointClick ? "pointer" : "default" }}>
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
          <path key={s.id} d={pathFor(s.points)} fill="none" stroke={s.color} strokeWidth="2"
            vectorEffect="non-scaling-stroke" />
        ))}
        {/* Selected date marker */}
        {selectedDate && (() => {
          const selIdx = series[0].points.findIndex(p => p.date === selectedDate);
          if (selIdx < 0) return null;
          const cx = xFor(selIdx);
          return (
            <g pointerEvents="none">
              <line x1={cx} x2={cx} y1={P} y2={H - P} stroke="#ff6b4a" strokeWidth="1"
                strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.6" />
              {series.map(s => (
                <circle key={s.id} cx={cx} cy={yFor(s.points[selIdx]?.value ?? 0)}
                  r="5" fill="#ff6b4a" stroke="#0a0a0a" strokeWidth="2"
                  vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          );
        })()}
        {hoverIdx !== null && (() => {
          const cx = xFor(hoverIdx);
          return (
            <g pointerEvents="none">
              <line x1={cx} x2={cx} y1={P} y2={H - P} stroke="#555" strokeWidth="1"
                strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              {series.map(s => (
                <circle key={s.id} cx={cx} cy={yFor(s.points[hoverIdx]?.value ?? 0)}
                  r="4" fill={s.color} stroke="#0a0a0a" strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          );
        })()}
      </svg>

      {hoverIdx !== null && hoverDate && (
        <div
          className="absolute top-2 pointer-events-none z-10 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 shadow-xl min-w-[140px]"
          style={flipTooltip
            ? { right: `calc(100% - ${tooltipLeft}px + 10px)` }
            : { left: tooltipLeft + 10 }}
        >
          <div className="text-[10px] text-[#666] font-mono mb-1.5">{hoverDate}</div>
          {hoverValues.map((hv, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: hv.color }} />
              <span className="text-[12px] font-bold text-white tabular-nums">
                {hv.value.toLocaleString()}{unit}
              </span>
              {series.length > 1 && (
                <span className="text-[10px] text-[#555] truncate max-w-[120px]">{hv.label}</span>
              )}
            </div>
          ))}
          {onPointClick && <div className="text-[9px] text-[#444] mt-1.5">Click to drill down</div>}
        </div>
      )}
    </div>
  );
}
