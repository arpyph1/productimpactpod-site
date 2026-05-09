import React, { useState, useCallback, useEffect } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type QType = "single" | "multi" | "text" | "rating" | "yesno";

interface Question {
  id: string;
  type: QType;
  prompt: string;
  options: string[];
  required: boolean;
}

interface Complete {
  prompt: string;
  consent_label: string;
}

interface SurveyShape {
  id?: string;
  title: string;
  questions: Question[];
  complete: Complete;
}

interface Props {
  supabase: SupabaseClient;
  survey: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const MAX_QUESTIONS = 10;

const DEFAULT_COMPLETE: Complete = {
  prompt: "Want a copy of the results? Leave your email.",
  consent_label: "We will be contacting you to send you the information you're requested.",
};

const TYPE_LABELS: Record<QType, string> = {
  single: "Single choice",
  multi: "Multiple choice",
  text: "Short text",
  rating: "Rating (1–5)",
  yesno: "Yes / No",
};

function newId() {
  return `q_${Math.random().toString(36).slice(2, 9)}`;
}

function newQuestion(): Question {
  return { id: newId(), type: "single", prompt: "", options: ["", ""], required: true };
}

type Step = "list" | "question" | "complete";

export default function SurveyEditor({ supabase, survey, onClose, onSaved }: Props) {
  const isNew = !survey?.id;
  const [step, setStep] = useState<Step>("list");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [data, setData] = useState<SurveyShape>({
    id: survey?.id,
    title: survey?.title ?? "",
    questions: Array.isArray(survey?.questions) && survey.questions.length
      ? survey.questions.map((q: any) => ({
          id: q.id ?? newId(),
          type: (q.type ?? "single") as QType,
          prompt: q.prompt ?? "",
          options: Array.isArray(q.options) ? q.options : [],
          required: q.required ?? true,
        }))
      : [],
    complete: { ...DEFAULT_COMPLETE, ...(survey?.complete ?? {}) },
  });

  const update = useCallback(<K extends keyof SurveyShape>(k: K, v: SurveyShape[K]) => {
    setData(prev => ({ ...prev, [k]: v }));
  }, []);

  function addQuestion() {
    if (data.questions.length >= MAX_QUESTIONS) return;
    const next = [...data.questions, newQuestion()];
    update("questions", next);
    setEditingIdx(next.length - 1);
    setStep("question");
  }

  function updateQuestion(idx: number, q: Question) {
    const next = [...data.questions];
    next[idx] = q;
    update("questions", next);
  }

  function removeQuestion(idx: number) {
    if (!confirm("Remove this question?")) return;
    update("questions", data.questions.filter((_, i) => i !== idx));
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= data.questions.length) return;
    const next = [...data.questions];
    [next[idx], next[j]] = [next[j], next[idx]];
    update("questions", next);
  }

  async function handleSave() {
    if (!data.title.trim()) { setMsg("Title is required"); return; }
    if (data.questions.length === 0) { setMsg("Add at least one question"); return; }
    for (const q of data.questions) {
      if (!q.prompt.trim()) { setMsg("Every question needs a prompt"); return; }
      if ((q.type === "single" || q.type === "multi") && q.options.filter(o => o.trim()).length < 2) {
        setMsg(`Question "${q.prompt || "(untitled)"}" needs at least 2 answer options`);
        return;
      }
    }

    setSaving(true);
    setMsg("");
    const payload = {
      title: data.title.trim(),
      questions: data.questions.map(q => ({
        ...q,
        options: (q.type === "single" || q.type === "multi") ? q.options.filter(o => o.trim()) : [],
      })),
      complete: data.complete,
      updated_at: new Date().toISOString(),
    };

    const res = isNew
      ? await supabase.from("surveys").insert(payload)
      : await supabase.from("surveys").update(payload).eq("id", data.id);

    setSaving(false);
    if (res.error) {
      setMsg(`Error: ${res.error.message}`);
    } else {
      onSaved();
    }
  }

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && step === "list") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-2 sm:py-8 px-2 sm:px-4">
      <div className="w-full max-w-3xl bg-[#0c0c0c] border border-[#222] rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-[#0c0c0c]/95 backdrop-blur-sm flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-[#1a1a1a] rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            {step !== "list" && (
              <button onClick={() => setStep("list")}
                className="text-[#888] hover:text-white text-[13px]">← Back</button>
            )}
            <h2 className="text-[16px] sm:text-[18px] font-bold text-white truncate">
              {step === "list" ? (isNew ? "New Survey" : "Edit Survey")
                : step === "question" ? "Edit Question"
                : "Completion screen"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566] transition-colors disabled:opacity-50">
              {saving ? "Saving…" : "Save survey"}
            </button>
            <button onClick={onClose} aria-label="Close" className="text-[#555] hover:text-white p-2 -mr-1">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {msg && (
          <div className={`mx-4 sm:mx-6 mt-4 px-4 py-2 rounded-lg text-[13px] ${msg.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
            {msg}
          </div>
        )}

        <div className="p-4 sm:p-6 space-y-5">
          {step === "list" && (
            <ListStep
              data={data}
              update={update}
              onEditQuestion={(i) => { setEditingIdx(i); setStep("question"); }}
              onAdd={addQuestion}
              onRemove={removeQuestion}
              onMove={moveQuestion}
              onEditComplete={() => setStep("complete")}
            />
          )}

          {step === "question" && editingIdx !== null && data.questions[editingIdx] && (
            <QuestionStep
              question={data.questions[editingIdx]}
              onChange={(q) => updateQuestion(editingIdx, q)}
              onDone={() => setStep("list")}
            />
          )}

          {step === "complete" && (
            <CompleteStep
              complete={data.complete}
              onChange={(c) => update("complete", c)}
              onDone={() => setStep("list")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step: list of questions ─────────────────────────────────────────────────
function ListStep({ data, update, onEditQuestion, onAdd, onRemove, onMove, onEditComplete }: {
  data: SurveyShape;
  update: <K extends keyof SurveyShape>(k: K, v: SurveyShape[K]) => void;
  onEditQuestion: (i: number) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: -1 | 1) => void;
  onEditComplete: () => void;
}) {
  return (
    <>
      <div>
        <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Survey title</label>
        <input type="text" value={data.title} onChange={(e) => update("title", e.target.value)}
          placeholder="Reader sentiment about agentic UX"
          className="w-full px-4 py-3 bg-[#111] border border-[#222] rounded-lg text-[15px] font-bold text-white focus:outline-none focus:border-[#ff6b4a]/50" />
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-[11px] font-semibold text-[#666] uppercase tracking-wider">
            Questions ({data.questions.length}/{MAX_QUESTIONS})
          </label>
        </div>
        {data.questions.length === 0 ? (
          <div className="text-[13px] text-[#666] italic py-6 text-center border border-dashed border-[#222] rounded-lg">
            No questions yet. Add your first below.
          </div>
        ) : (
          <ul className="space-y-2">
            {data.questions.map((q, i) => (
              <li key={q.id} className="flex items-center gap-2 p-3 bg-[#111] border border-[#1a1a1a] rounded-lg">
                <span className="text-[12px] font-bold text-[#ff6b4a] w-6">{i + 1}.</span>
                <button onClick={() => onEditQuestion(i)} className="flex-1 min-w-0 text-left">
                  <div className="text-[13px] text-white truncate">
                    {q.prompt || <span className="italic text-[#666]">Untitled question</span>}
                  </div>
                  <div className="text-[10px] text-[#666] uppercase tracking-wider">{TYPE_LABELS[q.type]}</div>
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => onMove(i, -1)} disabled={i === 0} className="p-1.5 text-[#666] hover:text-white disabled:opacity-30" title="Move up">↑</button>
                  <button onClick={() => onMove(i, 1)} disabled={i === data.questions.length - 1} className="p-1.5 text-[#666] hover:text-white disabled:opacity-30" title="Move down">↓</button>
                  <button onClick={() => onRemove(i)} className="p-1.5 text-red-400 hover:text-red-300" title="Remove">×</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button onClick={onAdd} disabled={data.questions.length >= MAX_QUESTIONS}
          className="mt-3 w-full px-4 py-3 border border-dashed border-[#333] rounded-lg text-[13px] text-[#888] hover:text-white hover:border-[#444] disabled:opacity-40 disabled:cursor-not-allowed">
          + Add question {data.questions.length >= MAX_QUESTIONS ? "(limit reached)" : ""}
        </button>
      </div>

      <div className="pt-4 border-t border-[#1a1a1a]">
        <button onClick={onEditComplete}
          className="w-full px-4 py-3 bg-[#ff6b4a]/10 border border-[#ff6b4a]/30 rounded-lg text-[13px] font-semibold text-[#ff6b4a] hover:bg-[#ff6b4a]/15">
          Edit complete screen →
        </button>
        <p className="text-[11px] text-[#666] mt-2">
          Asks readers for their email and shows the consent checkbox before saving the response.
        </p>
      </div>
    </>
  );
}

// ─── Step: edit one question ─────────────────────────────────────────────────
function QuestionStep({ question, onChange, onDone }: {
  question: Question;
  onChange: (q: Question) => void;
  onDone: () => void;
}) {
  const showOptions = question.type === "single" || question.type === "multi";

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Question type</label>
        <select value={question.type}
          onChange={(e) => onChange({ ...question, type: e.target.value as QType })}
          className="w-full px-3 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none">
          {(Object.keys(TYPE_LABELS) as QType[]).map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Prompt</label>
        <input type="text" value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          placeholder="What surprised you most about this story?"
          className="w-full px-4 py-3 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50" />
      </div>

      {showOptions && (
        <div>
          <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Answer options</label>
          <ul className="space-y-2">
            {question.options.map((opt, i) => (
              <li key={i} className="flex items-center gap-2">
                <input type="text" value={opt}
                  onChange={(e) => {
                    const next = [...question.options];
                    next[i] = e.target.value;
                    onChange({ ...question, options: next });
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50" />
                <button onClick={() => onChange({ ...question, options: question.options.filter((_, j) => j !== i) })}
                  className="p-2 text-red-400 hover:text-red-300" title="Remove">×</button>
              </li>
            ))}
          </ul>
          <button onClick={() => onChange({ ...question, options: [...question.options, ""] })}
            className="mt-2 px-3 py-1.5 text-[12px] text-[#ff6b4a] hover:text-[#ff8566]">
            + Add option
          </button>
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={question.required}
          onChange={(e) => onChange({ ...question, required: e.target.checked })}
          className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
        <span className="text-[12px] text-[#888]">Required</span>
      </label>

      <div className="pt-3 border-t border-[#1a1a1a]">
        <button onClick={onDone}
          className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-[#222] rounded-lg text-[13px] font-semibold text-white hover:border-[#444]">
          Save question
        </button>
      </div>
    </div>
  );
}

// ─── Step: completion / email screen ─────────────────────────────────────────
function CompleteStep({ complete, onChange, onDone }: {
  complete: Complete;
  onChange: (c: Complete) => void;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Email prompt</label>
        <input type="text" value={complete.prompt}
          onChange={(e) => onChange({ ...complete, prompt: e.target.value })}
          className="w-full px-4 py-3 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50" />
        <p className="text-[11px] text-[#666] mt-1">Shown above the email field on the final screen.</p>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Consent checkbox label</label>
        <textarea value={complete.consent_label}
          onChange={(e) => onChange({ ...complete, consent_label: e.target.value })}
          rows={2}
          className="w-full px-4 py-3 bg-[#111] border border-[#222] rounded-lg text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50 resize-y" />
      </div>

      <div className="p-4 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="text-[11px] uppercase tracking-wider text-[#666] mb-2">Preview</div>
        <p className="text-[14px] text-white mb-3">{complete.prompt}</p>
        <input type="email" disabled placeholder="you@example.com"
          className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-[#666] mb-3" />
        <label className="flex items-start gap-2">
          <input type="checkbox" disabled className="mt-1 w-4 h-4" />
          <span className="text-[12px] text-[#aaa]">{complete.consent_label}</span>
        </label>
      </div>

      <div className="pt-3 border-t border-[#1a1a1a]">
        <button onClick={onDone}
          className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-[#222] rounded-lg text-[13px] font-semibold text-white hover:border-[#444]">
          Done
        </button>
      </div>
    </div>
  );
}
