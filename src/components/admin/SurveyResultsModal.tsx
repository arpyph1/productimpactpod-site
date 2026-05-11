import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Question {
  id: string;
  type: "single" | "multi" | "text" | "rating" | "yesno";
  prompt: string;
  options?: string[];
}

interface Survey {
  id: string;
  title: string;
  questions: Question[];
}

interface ResponseRow {
  id: string;
  survey_id: string;
  answers: Record<string, any>;
  email: string | null;
  employer: string | null;
  consent: boolean;
  created_at: string;
}

interface Props {
  supabase: SupabaseClient;
  survey: Survey;
  onClose: () => void;
}

type Tab = "overview" | "by-question" | "responses";

export default function SurveyResultsModal({ supabase, survey, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("survey_responses")
      .select("*")
      .eq("survey_id", survey.id)
      .order("created_at", { ascending: false });
    if (error) {
      alert(`Failed to load responses: ${error.message}`);
      setResponses([]);
    } else {
      setResponses((data ?? []) as ResponseRow[]);
    }
    setLoading(false);
  }, [supabase, survey.id]);

  useEffect(() => { load(); }, [load]);

  // Apply search across email, employer, and free-text answers.
  const filtered = useMemo(() => {
    if (!search.trim()) return responses;
    const q = search.toLowerCase();
    return responses.filter(r => {
      if (r.email?.toLowerCase().includes(q)) return true;
      if (r.employer?.toLowerCase().includes(q)) return true;
      for (const v of Object.values(r.answers ?? {})) {
        if (typeof v === "string" && v.toLowerCase().includes(q)) return true;
        if (Array.isArray(v) && v.some(x => String(x).toLowerCase().includes(q))) return true;
      }
      return false;
    });
  }, [responses, search]);

  function downloadCsv() {
    const headers = [
      "response_id",
      "submitted_at",
      "email",
      "employer",
      "consent",
      ...survey.questions.map(q => `q:${q.prompt}`),
    ];
    const rows = filtered.map(r => [
      r.id,
      r.created_at,
      r.email ?? "",
      r.employer ?? "",
      r.consent ? "yes" : "no",
      ...survey.questions.map(q => {
        const v = r.answers?.[q.id];
        if (v == null) return "";
        if (Array.isArray(v)) return v.join("; ");
        return String(v);
      }),
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-${survey.id.slice(0,8)}-responses.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const consentCount = filtered.filter(r => r.consent).length;
  const emailCount   = filtered.filter(r => r.email).length;
  const employerCount = filtered.filter(r => r.employer).length;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-5xl bg-[#0a0a0a] border border-[#222] rounded-2xl my-8" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-[#1a1a1a] px-6 py-4 flex items-center gap-4 rounded-t-2xl">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-[#666]">Survey results</div>
            <div className="text-white text-[16px] font-semibold truncate">{survey.title}</div>
          </div>
          <button onClick={downloadCsv}
            className="px-3 py-2 text-[12px] bg-[#111] border border-[#222] text-white rounded-lg hover:border-[#ff6b4a]/50">
            Download CSV
          </button>
          <button onClick={onClose} className="px-3 py-2 text-[12px] text-[#888] hover:text-white">
            Close
          </button>
        </div>

        <div className="px-6 pt-4 flex flex-wrap gap-2 border-b border-[#1a1a1a]">
          <TabBtn active={tab === "overview"}    onClick={() => setTab("overview")}>Overview</TabBtn>
          <TabBtn active={tab === "by-question"} onClick={() => setTab("by-question")}>By question</TabBtn>
          <TabBtn active={tab === "responses"}   onClick={() => setTab("responses")}>Responses ({filtered.length})</TabBtn>
          <div className="flex-1" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by email, employer, answer…"
            className="px-3 py-2 mb-2 bg-[#111] border border-[#222] rounded-lg text-[12px] text-white focus:outline-none focus:border-[#ff6b4a]/50 min-w-[260px]"
          />
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-[13px] text-[#666]">Loading…</div>
          ) : responses.length === 0 ? (
            <div className="text-[13px] text-[#666] py-12 text-center border border-dashed border-[#222] rounded-xl">
              No responses yet.
            </div>
          ) : tab === "overview" ? (
            <Overview
              total={filtered.length}
              consent={consentCount}
              email={emailCount}
              employer={employerCount}
              firstAt={filtered[filtered.length - 1]?.created_at}
              lastAt={filtered[0]?.created_at}
              questions={survey.questions}
              responses={filtered}
            />
          ) : tab === "by-question" ? (
            <ByQuestion questions={survey.questions} responses={filtered} />
          ) : (
            <Responses survey={survey} responses={filtered} />
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-2 text-[13px] rounded-t-lg border-b-2 -mb-px ${
        active
          ? "text-white border-[#ff6b4a]"
          : "text-[#888] border-transparent hover:text-white"
      }`}>
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-[#666]">{label}</div>
      <div className="text-white text-[20px] font-semibold mt-1">{value}</div>
    </div>
  );
}

function Overview({ total, consent, email, employer, firstAt, lastAt, questions, responses }: {
  total: number; consent: number; email: number; employer: number;
  firstAt?: string; lastAt?: string;
  questions: Question[]; responses: ResponseRow[];
}) {
  // Per-question completion rate
  const completion = questions.map(q => {
    const answered = responses.filter(r => {
      const v = r.answers?.[q.id];
      if (v == null) return false;
      if (typeof v === "string") return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    }).length;
    return { prompt: q.prompt, answered, rate: total ? answered / total : 0 };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Responses" value={total} />
        <Stat label="With email" value={`${email} (${pct(email, total)})`} />
        <Stat label="With employer" value={`${employer} (${pct(employer, total)})`} />
        <Stat label="Consented" value={`${consent} (${pct(consent, total)})`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Stat label="First response" value={<span className="text-[13px] font-normal text-[#aaa]">{firstAt ? fmtDateTime(firstAt) : "—"}</span>} />
        <Stat label="Latest response" value={<span className="text-[13px] font-normal text-[#aaa]">{lastAt ? fmtDateTime(lastAt) : "—"}</span>} />
      </div>

      <div>
        <h3 className="text-white text-[13px] font-semibold mb-2">Completion by question</h3>
        <div className="border border-[#1a1a1a] rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-[#0c0c0c] text-[11px] uppercase tracking-wider text-[#666]">
              <tr>
                <th className="px-3 py-2 text-left">Question</th>
                <th className="px-3 py-2 text-right w-32">Answered</th>
                <th className="px-3 py-2 text-right w-24">Rate</th>
              </tr>
            </thead>
            <tbody>
              {completion.map((c, i) => (
                <tr key={i} className="border-t border-[#1a1a1a]">
                  <td className="px-3 py-2 text-white">{c.prompt}</td>
                  <td className="px-3 py-2 text-right text-[#aaa]">{c.answered} / {total}</td>
                  <td className="px-3 py-2 text-right text-[#aaa]">{Math.round(c.rate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ByQuestion({ questions, responses }: { questions: Question[]; responses: ResponseRow[] }) {
  return (
    <div className="space-y-6">
      {questions.map((q, i) => (
        <div key={q.id} className="border border-[#1a1a1a] rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wider text-[#666] mb-1">Question {i + 1} · {q.type}</div>
          <div className="text-white text-[14px] font-semibold mb-3">{q.prompt}</div>
          <QuestionAggregate q={q} responses={responses} />
        </div>
      ))}
    </div>
  );
}

function QuestionAggregate({ q, responses }: { q: Question; responses: ResponseRow[] }) {
  const values = responses.map(r => r.answers?.[q.id]).filter(v => v != null && v !== "");

  if (q.type === "text") {
    const items = values.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    if (!items.length) return <div className="text-[13px] text-[#666] italic">No answers yet.</div>;
    return (
      <ul className="space-y-2">
        {items.map((v, i) => (
          <li key={i} className="text-[13px] text-white bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2">{v}</li>
        ))}
      </ul>
    );
  }

  if (q.type === "rating") {
    const nums = values.map(v => Number(v)).filter(n => !isNaN(n) && n >= 1 && n <= 5);
    if (!nums.length) return <div className="text-[13px] text-[#666] italic">No ratings yet.</div>;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    const dist = [1, 2, 3, 4, 5].map(n => ({ n, count: nums.filter(x => x === n).length }));
    return (
      <div className="space-y-3">
        <div className="text-[13px] text-[#aaa]">Average: <span className="text-white font-semibold">{avg.toFixed(2)}</span> · n={nums.length}</div>
        {dist.map(d => (
          <Bar key={d.n} label={`${d.n} ★`} count={d.count} total={nums.length} />
        ))}
      </div>
    );
  }

  // single, multi, yesno — count by option
  const counts = new Map<string, number>();
  for (const v of values) {
    if (Array.isArray(v)) for (const x of v) counts.set(String(x), (counts.get(String(x)) ?? 0) + 1);
    else counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  }
  const total = q.type === "multi" ? values.length : values.length;
  if (!counts.size) return <div className="text-[13px] text-[#666] italic">No answers yet.</div>;

  const options = q.type === "yesno"
    ? ["Yes", "No"]
    : (q.options ?? Array.from(counts.keys()));

  return (
    <div className="space-y-2">
      {options.map(opt => (
        <Bar key={opt} label={opt} count={counts.get(opt) ?? 0} total={total} />
      ))}
      {q.type === "multi" && (
        <div className="text-[11px] text-[#666] pt-1">Multi-select: percentages reflect share of respondents who chose that option.</div>
      )}
    </div>
  );
}

function Bar({ label, count, total }: { label: string; count: number; total: number }) {
  const rate = total ? count / total : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className="text-white">{label}</span>
        <span className="text-[#888]">{count} · {Math.round(rate * 100)}%</span>
      </div>
      <div className="h-2 bg-[#111] rounded-full overflow-hidden">
        <div className="h-full bg-[#ff6b4a]" style={{ width: `${rate * 100}%` }} />
      </div>
    </div>
  );
}

function Responses({ survey, responses }: { survey: Survey; responses: ResponseRow[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (!responses.length) return <div className="text-[13px] text-[#666] italic">No responses match.</div>;

  return (
    <div className="border border-[#1a1a1a] rounded-xl overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-[#0c0c0c] text-[11px] uppercase tracking-wider text-[#666]">
          <tr>
            <th className="px-3 py-2 text-left">Submitted</th>
            <th className="px-3 py-2 text-left">Email</th>
            <th className="px-3 py-2 text-left">Employer</th>
            <th className="px-3 py-2 text-left">Consent</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {responses.map(r => (
            <React.Fragment key={r.id}>
              <tr className="border-t border-[#1a1a1a] hover:bg-[#0d0d0d]">
                <td className="px-3 py-3 text-[#aaa]">{fmtDateTime(r.created_at)}</td>
                <td className="px-3 py-3 text-white">{r.email ?? <span className="text-[#555]">—</span>}</td>
                <td className="px-3 py-3 text-white">{r.employer ?? <span className="text-[#555]">—</span>}</td>
                <td className="px-3 py-3 text-[#aaa]">{r.consent ? "yes" : "no"}</td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => setOpen(open === r.id ? null : r.id)}
                    className="text-[12px] text-[#ff6b4a] hover:text-[#ff8566]">
                    {open === r.id ? "Hide" : "View"}
                  </button>
                </td>
              </tr>
              {open === r.id && (
                <tr className="bg-[#0a0a0a] border-t border-[#1a1a1a]">
                  <td colSpan={5} className="px-4 py-4">
                    <dl className="space-y-3">
                      {survey.questions.map(q => {
                        const v = r.answers?.[q.id];
                        return (
                          <div key={q.id}>
                            <dt className="text-[11px] uppercase tracking-wider text-[#666] mb-1">{q.prompt}</dt>
                            <dd className="text-[13px] text-white">{formatAnswer(v)}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAnswer(v: any): React.ReactNode {
  if (v == null || v === "") return <span className="text-[#555]">—</span>;
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function pct(n: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function csvCell(v: any): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
