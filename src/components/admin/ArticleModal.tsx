import React, { useState, useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props {
  supabase: SupabaseClient;
  article: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const FORMATS = [
  "news-analysis", "feature", "playbook", "data-reports", "case-study", "release-note",
  "opinion", "explainer", "news-brief", "product-review", "research-brief",
];

const THEMES = [
  "ai-product-strategy", "adoption-organizational-change", "agents-agentic-systems",
  "data-semantics-knowledge-foundations", "evaluation-benchmarking",
  "go-to-market-distribution", "governance-risk-trust", "ux-experience-design-for-ai",
];

const LENSES = ["business", "product", "societal", "technical"];

type Tab = "edit" | "html" | "preview";
type ArticleStatus = "draft" | "published" | "scheduled";

function toLocalDatetime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TIMEZONE_OPTIONS = [
  { label: "Eastern (ET)", value: "America/New_York" },
  { label: "Central (CT)", value: "America/Chicago" },
  { label: "Mountain (MT)", value: "America/Denver" },
  { label: "Pacific (PT)", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
  { label: "London (GMT/BST)", value: "Europe/London" },
  { label: "Central Europe (CET)", value: "Europe/Berlin" },
  { label: "India (IST)", value: "Asia/Kolkata" },
  { label: "Tokyo (JST)", value: "Asia/Tokyo" },
  { label: "Sydney (AEST)", value: "Australia/Sydney" },
];

export default function ArticleModal({ supabase, article, onClose, onSaved }: Props) {
  const isNew = !article?.id;
  const [tab, setTab] = useState<Tab>("edit");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState({
    title: article?.title ?? "",
    subtitle: article?.subtitle ?? "",
    slug: article?.slug ?? "",
    format: article?.format ?? "news-analysis",
    formats: article?.formats?.length ? article.formats : (article?.format ? [article.format] : ["news-analysis"]),
    author_slugs: article?.author_slugs ?? ["arpy-dragffy"],
    publish_date: article?.publish_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    published: article?.published ?? false,
    scheduled_at: article?.scheduled_at ?? null as string | null,
    meta_description: article?.meta_description ?? "",
    hero_image_url: article?.hero_image_url ?? "",
    hero_image_alt: article?.hero_image_alt ?? "",
    content_html: article?.content_html ?? "",
    content_markdown: article?.content_markdown ?? "",
    themes: article?.themes ?? [],
    lenses: article?.lenses ?? [],
    topics: article?.topics ?? [],
    tags: article?.tags ?? [],
    is_lead_story: article?.is_lead_story ?? false,
    read_time_minutes: article?.read_time_minutes ?? 5,
  });
  const [generatingTags, setGeneratingTags] = useState(false);

  const deriveStatus = (): ArticleStatus => {
    if (form.published) return "published";
    if (form.scheduled_at) return "scheduled";
    return "draft";
  };
  const [status, setStatus] = useState<ArticleStatus>(deriveStatus());
  const [scheduleTz, setScheduleTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York");
  const [scheduleLocal, setScheduleLocal] = useState(toLocalDatetime(form.scheduled_at));

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [topicInput, setTopicInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showSurveyPicker, setShowSurveyPicker] = useState(false);
  const [surveys, setSurveys] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    supabase.from("surveys").select("id, title").order("created_at", { ascending: false })
      .then(({ data }) => setSurveys(data ?? []));
  }, []);

  function insertSurvey(s: { id: string; title: string }) {
    // contenteditable=false so the embed reads as a single, draggable block in
    // the visual editor instead of letting the cursor land inside the label.
    const block =
      `<div data-survey-id="${s.id}" class="survey-embed" contenteditable="false" ` +
      `style="margin:1.5em 0;padding:1em;border:2px dashed #ff6b4a;border-radius:8px;` +
      `color:#ff6b4a;font-size:13px;text-align:center;background:rgba(255,107,74,0.06);` +
      `font-weight:600;user-select:none">` +
      `📋 Survey embed — ${escapeHtml(s.title || s.id)}` +
      `</div><p><br/></p>`;
    if (tab === "edit" && editorRef.current) {
      const editor = editorRef.current;
      editor.focus();
      const sel = window.getSelection();
      // If the cursor is outside the editor, append at the end so the block
      // doesn't silently disappear into the document body.
      if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      document.execCommand("insertHTML", false, block);
      syncFromEditor();
    } else {
      update("content_html", form.content_html + block);
    }
    setShowSurveyPicker(false);
  }

  function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  }

  // Parse the body looking for embedded surveys so the editor can show a
  // sticky list of them with move-up/down/remove controls.
  function getEmbeddedSurveys(): Array<{ index: number; id: string }> {
    const html = tab === "edit" && editorRef.current ? editorRef.current.innerHTML : form.content_html;
    const re = /data-survey-id="([^"]+)"/g;
    const out: Array<{ index: number; id: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) out.push({ index: m.index, id: m[1] });
    return out;
  }

  function mutateBody(fn: (root: HTMLElement) => void) {
    const html = tab === "edit" && editorRef.current ? editorRef.current.innerHTML : form.content_html;
    const root = document.createElement("div");
    root.innerHTML = html;
    fn(root);
    update("content_html", root.innerHTML);
    if (editorRef.current) editorRef.current.innerHTML = root.innerHTML;
  }

  function moveSurveyEmbed(surveyIndex: number, dir: -1 | 1) {
    mutateBody((root) => {
      const nodes = Array.from(root.querySelectorAll("[data-survey-id]")) as HTMLElement[];
      const node = nodes[surveyIndex];
      if (!node) return;
      const sibling = dir === -1 ? node.previousElementSibling : node.nextElementSibling;
      if (!sibling) return;
      // Move past one block-level sibling at a time.
      if (dir === -1) sibling.before(node); else sibling.after(node);
    });
  }

  function removeSurveyEmbed(surveyIndex: number) {
    if (!confirm("Remove this survey embed from the article?")) return;
    mutateBody((root) => {
      const nodes = Array.from(root.querySelectorAll("[data-survey-id]")) as HTMLElement[];
      nodes[surveyIndex]?.remove();
    });
  }

  function update(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleArray(field: string, value: string) {
    setForm(prev => {
      const arr: string[] = (prev as any)[field] ?? [];
      return { ...prev, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  }

  function autoSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  }

  function execCmd(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  }

  function syncFromEditor() {
    if (editorRef.current) {
      update("content_html", editorRef.current.innerHTML);
    }
  }

  async function generateTags() {
    const html = editorRef.current?.innerHTML ?? form.content_html;
    if (!form.title.trim() || !html.trim()) {
      setMsg("Need a title and article body to generate tags");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    setGeneratingTags(true);
    setMsg("Generating tags…");
    try {
      const { data, error } = await supabase.functions.invoke("generate-article-tags", {
        body: {
          title: form.title,
          subtitle: form.subtitle,
          content_html: html,
          themes: form.themes,
        },
      });
      if (error) throw error;
      const newTags: string[] = Array.isArray(data?.tags) ? data.tags : [];
      if (newTags.length === 0) {
        setMsg("Model returned 0 tags — try regenerating");
      } else {
        update("tags", newTags);
        setMsg(`Generated ${newTags.length} tags`);
      }
    } catch (e: any) {
      setMsg(`Tag generation failed: ${e.message ?? e}`);
    } finally {
      setGeneratingTags(false);
      setTimeout(() => setMsg(""), 3000);
    }
  }

  async function uploadHeroImage(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `heroes/${form.slug || "article"}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("article-heroes").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { setMsg(`Upload error: ${upErr.message}`); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("article-heroes").getPublicUrl(path);
    update("hero_image_url", urlData.publicUrl);
    setMsg("Image uploaded");
    setTimeout(() => setMsg(""), 2000);
    setUploading(false);
  }

  async function handleEditorPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    // Image paste — upload to storage and insert <img>
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        setMsg("Uploading image...");
        const ext = file.type.split("/")[1] ?? "png";
        const path = `content/${form.slug || "article"}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("article-heroes").upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) { setMsg(`Image upload error: ${upErr.message}`); return; }
        const { data: urlData } = supabase.storage.from("article-heroes").getPublicUrl(path);
        const imgTag = `<img src="${urlData.publicUrl}" alt="" style="max-width:100%;border-radius:8px;margin:1em 0" />`;
        document.execCommand("insertHTML", false, imgTag);
        syncFromEditor();
        setMsg("Image inserted");
        setTimeout(() => setMsg(""), 2000);
        return;
      }
    }

    // HTML paste — strip leading subtitle/byline paragraphs before inserting
    const htmlData = e.clipboardData.getData("text/html");
    if (htmlData) {
      e.preventDefault();
      const tmp = document.createElement("div");
      tmp.innerHTML = htmlData;
      const root = tmp.querySelector("body") ?? tmp;
      const subtitleNorm = (form.subtitle ?? "").trim().replace(/\s+/g, " ").toLowerCase();
      let el = root.firstElementChild;
      while (el) {
        const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
        const isSubtitleDupe = subtitleNorm && text.toLowerCase() === subtitleNorm;
        // "By Name" or "By First Last" patterns up to ~6 words
        const isByline = /^by\s+\S/i.test(text) && text.split(/\s+/).length <= 7;
        if (isSubtitleDupe || isByline) {
          const next = el.nextElementSibling;
          el.remove();
          el = next;
        } else {
          break;
        }
      }
      // Insert via DOM Range — preserves all tags/attributes including <a href>.
      // execCommand("insertHTML") is deprecated and silently sanitizes in some
      // browsers, which was stripping anchor links from pasted content.
      const editor = editorRef.current;
      const sel = window.getSelection();
      const selInsideEditor =
        sel && sel.rangeCount > 0 && editor &&
        editor.contains(sel.anchorNode) && editor.contains(sel.focusNode);

      if (selInsideEditor) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const frag = document.createDocumentFragment();
        while (root.firstChild) frag.appendChild(root.firstChild);
        const lastNode = frag.lastChild;
        range.insertNode(frag);
        if (lastNode) {
          range.setStartAfter(lastNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } else if (editor) {
        // Fallback: append to end of editor and place cursor there
        const frag = document.createDocumentFragment();
        while (root.firstChild) frag.appendChild(root.firstChild);
        editor.appendChild(frag);
      }
      syncFromEditor();
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { setMsg("Title is required"); return; }
    if (!form.slug.trim()) form.slug = autoSlug(form.title);

    if (status === "scheduled" && !scheduleLocal) {
      setMsg("Select a date and time for scheduling");
      return;
    }

    setSaving(true);
    setMsg("");

    let published = false;
    let scheduled_at: string | null = null;

    if (status === "published") {
      published = true;
    } else if (status === "scheduled" && scheduleLocal) {
      const asUtc = new Date(scheduleLocal + ":00Z");
      const inTzStr = asUtc.toLocaleString("sv-SE", { timeZone: scheduleTz });
      const inTzDate = new Date(inTzStr.replace(" ", "T") + "Z");
      const offsetMs = asUtc.getTime() - inTzDate.getTime();
      scheduled_at = new Date(asUtc.getTime() + offsetMs).toISOString();
    }

    const payload = {
      ...form,
      published,
      scheduled_at,
      word_count: form.content_html.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length,
      read_time_minutes: Math.max(1, Math.ceil(form.content_html.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length / 250)),
      updated_at: new Date().toISOString(),
    };

    let error;
    if (isNew) {
      const res = await supabase.from("articles").insert(payload);
      error = res.error;
    } else {
      const res = await supabase.from("articles").update(payload).eq("id", article.id);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      setMsg(`Error: ${error.message}`);
    } else {
      onSaved();
      onClose();
    }
  }

  async function handleDelete() {
    if (!article?.id) return;
    if (!confirm(`Delete "${form.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("articles").delete().eq("id", article.id);
    if (error) {
      alert(`Delete failed: ${error.message}`);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-2 sm:py-8 px-2 sm:px-4">
      <div className="w-full max-w-5xl bg-[#0c0c0c] border border-[#222] rounded-2xl shadow-2xl">

        {/* Header — sticky so Save / Close stay reachable while scrolling. */}
        <div className="sticky top-0 z-20 bg-[#0c0c0c]/95 backdrop-blur-sm flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-[#1a1a1a] rounded-t-2xl">
          <h2 className="text-[16px] sm:text-[18px] font-bold text-white flex-1 min-w-0 truncate">{isNew ? "New Article" : "Edit Article"}</h2>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {!isNew && (
              <button onClick={handleDelete} className="px-3 py-2 text-[12px] text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors">
                Delete
              </button>
            )}
            <button onClick={handleSave} disabled={saving}
              className="px-4 sm:px-5 py-2 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566] transition-colors disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={onClose} aria-label="Close" className="text-[#555] hover:text-white transition-colors p-2 -mr-1">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {msg && (
          <div className={`mx-4 sm:mx-6 mt-4 px-4 py-2 rounded-lg text-[13px] ${msg.startsWith("Error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
            {msg}
          </div>
        )}

        {/* Single-column on mobile/tablet; two-column with right-side meta
            sidebar on lg+. The sidebar moves below the editor on smaller
            screens so the editor gets the full viewport width. */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] lg:divide-x divide-[#1a1a1a]">
          {/* Main editor area */}
          <div className="p-4 sm:p-6 space-y-5 min-w-0">
            {/* Title */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Title</label>
              <input type="text" className="w-full px-4 py-3 bg-[#111] border border-[#222] rounded-lg text-[16px] font-bold text-white focus:outline-none focus:border-[#ff6b4a]/50"
                value={form.title} onChange={(e) => { update("title", e.target.value); if (isNew) update("slug", autoSlug(e.target.value)); }} placeholder="Article title" />
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Subtitle</label>
              <input type="text" className="w-full px-4 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[16px] sm:text-[14px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
                value={form.subtitle} onChange={(e) => update("subtitle", e.target.value)} placeholder="Optional subtitle" />
            </div>

            {/* Meta Description */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Summary / Meta Description</label>
              <textarea className="w-full h-20 bg-[#111] border border-[#222] rounded-lg p-3 text-[16px] sm:text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50 resize-y"
                value={form.meta_description} onChange={(e) => update("meta_description", e.target.value)} placeholder="Brief description for search engines and social sharing" />
              <div className="text-[10px] text-[#444] mt-1">{form.meta_description.length}/160 characters</div>
            </div>

            {/* Content — tabbed */}
            <div>
              <div className="flex items-center gap-0.5 mb-3">
                {(["edit", "html", "preview"] as Tab[]).map((t) => (
                  <button key={t} onClick={() => { if (tab === "edit") syncFromEditor(); setTab(t); }}
                    className={`px-4 py-2 text-[12px] font-semibold rounded-t-lg transition-colors ${
                      tab === t ? "bg-[#1a1a1a] text-white" : "text-[#666] hover:text-white"
                    }`}>
                    {t === "edit" ? "Visual" : t === "html" ? "HTML" : "Preview"}
                  </button>
                ))}
              </div>

              {tab === "edit" && (
                <div>
                  {/* Toolbar — sticky below the modal header so formatting
                       controls stay reachable while scrolling long articles.
                       z-15 so it sits below the z-10 header but above the
                       editor body. */}
                  <div
                    className="flex flex-wrap items-center gap-1 p-2 bg-[#111] border border-[#222] border-b-0 rounded-t-lg shadow-[0_4px_8px_-4px_rgba(0,0,0,0.7)]"
                    style={{ position: "sticky", top: "60px", zIndex: 15 }}
                  >
                    <ToolBtn label="B" cmd={() => execCmd("bold")} bold />
                    <ToolBtn label="I" cmd={() => execCmd("italic")} italic />
                    <ToolBtn label="U" cmd={() => execCmd("underline")} />
                    <span className="w-px h-5 bg-[#222] mx-1" />
                    <ToolBtn label="H2" cmd={() => execCmd("formatBlock", "h2")} />
                    <ToolBtn label="H3" cmd={() => execCmd("formatBlock", "h3")} />
                    <ToolBtn label="P" cmd={() => execCmd("formatBlock", "p")} />
                    <span className="w-px h-5 bg-[#222] mx-1" />
                    <ToolBtn label="UL" cmd={() => execCmd("insertUnorderedList")} />
                    <ToolBtn label="OL" cmd={() => execCmd("insertOrderedList")} />
                    <span className="w-px h-5 bg-[#222] mx-1" />
                    <ToolBtn label="Link" cmd={() => { const url = prompt("URL:"); if (url) execCmd("createLink", url); }} />
                    <ToolBtn label="—" cmd={() => execCmd("insertHorizontalRule")} />
                    <span className="w-px h-5 bg-[#222] mx-1" />
                    <ToolBtn label="+ Survey" cmd={() => setShowSurveyPicker(true)} />
                  </div>
                  <div ref={editorRef} contentEditable suppressContentEditableWarning
                    className="min-h-[400px] bg-[#111] border border-[#222] rounded-b-lg p-6 text-[14px] text-[#ddd] leading-relaxed focus:outline-none prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: form.content_html }}
                    onBlur={syncFromEditor}
                    onPaste={handleEditorPaste}
                  />
                </div>
              )}

              {tab === "html" && (
                <textarea
                  className="w-full min-h-[400px] bg-[#111] border border-[#222] rounded-lg p-4 text-[13px] text-[#ccc] font-mono focus:outline-none focus:border-[#ff6b4a]/50 resize-y"
                  value={form.content_html}
                  onChange={(e) => update("content_html", e.target.value)}
                  placeholder="<h2>Paste or edit HTML here</h2><p>...</p>"
                />
              )}

              {tab === "preview" && (
                <div className="min-h-[400px] bg-[#111] border border-[#222] rounded-lg p-8">
                  <div className="article-prose max-w-3xl" dangerouslySetInnerHTML={{ __html: form.content_html }} />
                </div>
              )}
            </div>

            {/* Embedded surveys — list + reorder controls */}
            {(() => {
              const embedded = getEmbeddedSurveys();
              if (embedded.length === 0) return null;
              return (
                <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-3">
                  <div className="text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-2">
                    Surveys in this article ({embedded.length})
                  </div>
                  <ul className="space-y-1.5">
                    {embedded.map((e, i) => {
                      const title = surveys.find((s) => s.id === e.id)?.title || e.id.slice(0, 8) + "…";
                      return (
                        <li key={`${e.id}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded">
                          <span className="text-[11px] text-[#666] font-mono w-5">{i + 1}.</span>
                          <span className="flex-1 text-[12px] text-white truncate">📋 {title}</span>
                          <button onClick={() => moveSurveyEmbed(i, -1)} disabled={i === 0}
                            className="p-1 text-[#666] hover:text-white disabled:opacity-30" title="Move up">↑</button>
                          <button onClick={() => moveSurveyEmbed(i, 1)} disabled={i === embedded.length - 1}
                            className="p-1 text-[#666] hover:text-white disabled:opacity-30" title="Move down">↓</button>
                          <button onClick={() => removeSurveyEmbed(i)}
                            className="p-1 text-red-400 hover:text-red-300" title="Remove">×</button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()}
          </div>

          {/* Sidebar */}
          <div className="p-4 sm:p-6 space-y-5 bg-[#0a0a0a] border-t lg:border-t-0 border-[#1a1a1a] rounded-b-2xl lg:rounded-bl-none lg:rounded-br-2xl">
            {/* Status */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Status</label>
              <select className="w-full px-3 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
                value={status} onChange={(e) => {
                  const v = e.target.value as ArticleStatus;
                  setStatus(v);
                  if (v === "published") { update("published", true); update("scheduled_at", null); }
                  else if (v === "draft") { update("published", false); update("scheduled_at", null); }
                  else { update("published", false); }
                }}>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
              </select>
            </div>

            {/* Schedule datetime — shown only when status is "scheduled" */}
            {status === "scheduled" && (
              <div className="space-y-2 p-3 bg-[#111] border border-[#222] rounded-lg">
                <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider">Publish at</label>
                <input type="datetime-local"
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
                  value={scheduleLocal}
                  onChange={(e) => setScheduleLocal(e.target.value)} />
                <select className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#222] rounded-lg text-[12px] text-[#ccc] focus:outline-none"
                  value={scheduleTz} onChange={(e) => setScheduleTz(e.target.value)}>
                  {TIMEZONE_OPTIONS.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                {scheduleLocal && (
                  <div className="text-[10px] text-[#666]">
                    UTC: {(() => {
                      try {
                        const asUtc = new Date(scheduleLocal + ":00Z");
                        const inTzStr = asUtc.toLocaleString("sv-SE", { timeZone: scheduleTz });
                        const inTzDate = new Date(inTzStr.replace(" ", "T") + "Z");
                        const offsetMs = asUtc.getTime() - inTzDate.getTime();
                        return new Date(asUtc.getTime() + offsetMs).toISOString().replace("T", " ").slice(0, 16);
                      } catch { return "—"; }
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Slug */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Slug</label>
              <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[12px] text-[#888] font-mono focus:outline-none focus:border-[#ff6b4a]/50"
                value={form.slug} onChange={(e) => update("slug", e.target.value)} />
            </div>

            {/* Formats — multi-select. The first selected becomes the
                 canonical "primary" format (kept in form.format for
                 back-compat with code that still reads a single value). */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Formats</label>
              <div className="flex flex-wrap gap-1.5">
                {FORMATS.map(f => {
                  const selected = form.formats.includes(f);
                  return (
                    <button key={f} type="button"
                      onClick={() => {
                        const next = selected ? form.formats.filter((x: string) => x !== f) : [...form.formats, f];
                        const safe = next.length ? next : [f];
                        setForm(prev => ({ ...prev, formats: safe, format: safe[0] }));
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                        selected ? "bg-[#ff6b4a]/15 text-[#ff6b4a] border border-[#ff6b4a]/30" : "bg-[#111] text-[#666] border border-[#1a1a1a] hover:text-white"
                      }`}>
                      {f.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Author */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Author</label>
              <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
                value={form.author_slugs?.[0] ?? ""} onChange={(e) => update("author_slugs", [e.target.value])} placeholder="author-slug" />
            </div>

            {/* Date */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Publish Date</label>
              <input type="date" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50"
                value={form.publish_date} onChange={(e) => update("publish_date", e.target.value)} />
            </div>

            {/* Hero Image */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Hero Image</label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHeroImage(f); }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="w-full px-3 py-2.5 bg-[#1a1a1a] border border-[#222] rounded-lg text-[12px] text-[#ccc] hover:text-white hover:border-[#333] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                {uploading ? "Uploading..." : "Upload Image"}
              </button>
              <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[11px] text-[#888] focus:outline-none focus:border-[#ff6b4a]/50"
                value={form.hero_image_url} onChange={(e) => update("hero_image_url", e.target.value)} placeholder="Or paste image URL" />
              {form.hero_image_url && (
                <img src={form.hero_image_url} alt="" className="mt-2 rounded-lg w-full aspect-video object-cover border border-[#222]" />
              )}
              <input type="text" className="w-full px-3 py-2 mt-2 bg-[#111] border border-[#222] rounded-lg text-[12px] text-[#888] focus:outline-none"
                value={form.hero_image_alt} onChange={(e) => update("hero_image_alt", e.target.value)} placeholder="Image alt text" />
            </div>

            {/* Themes */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-2">Themes</label>
              <div className="flex flex-wrap gap-1.5">
                {THEMES.map(t => (
                  <button key={t} onClick={() => toggleArray("themes", t)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      form.themes.includes(t) ? "bg-[#ff6b4a]/15 text-[#ff6b4a] border border-[#ff6b4a]/30" : "bg-[#111] text-[#666] border border-[#1a1a1a] hover:text-white"
                    }`}>
                    {t.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()).replace(/Ai /g, "AI ").replace(/Ux /g, "UX ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Lenses */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-2">Lenses</label>
              <div className="flex flex-wrap gap-1.5">
                {LENSES.map(l => (
                  <button key={l} onClick={() => toggleArray("lenses", l)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      form.lenses.includes(l) ? "bg-[#ff6b4a]/15 text-[#ff6b4a] border border-[#ff6b4a]/30" : "bg-[#111] text-[#666] border border-[#1a1a1a] hover:text-white"
                    }`}>
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Topics */}
            <div>
              <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Topics</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(form.topics ?? []).map((t: string) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#111] border border-[#1a1a1a] rounded text-[10px] text-[#888]">
                    {t}
                    <button onClick={() => update("topics", form.topics.filter((x: string) => x !== t))} className="text-[#555] hover:text-red-400">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input type="text" className="flex-1 px-2 py-1.5 bg-[#111] border border-[#222] rounded text-[11px] text-white focus:outline-none"
                  value={topicInput} onChange={(e) => setTopicInput(e.target.value)} placeholder="Add topic"
                  onKeyDown={(e) => { if (e.key === "Enter" && topicInput.trim()) { update("topics", [...(form.topics ?? []), topicInput.trim()]); setTopicInput(""); } }} />
                <button onClick={() => { if (topicInput.trim()) { update("topics", [...(form.topics ?? []), topicInput.trim()]); setTopicInput(""); } }}
                  className="px-2 py-1.5 bg-[#1a1a1a] text-[#888] text-[11px] rounded hover:text-white">+</button>
              </div>
            </div>

            {/* Tags — AI-generated. Hidden on the article template; used for
                 the /tags index and on-site search. Click a tag to remove it. */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-[#666] uppercase tracking-wider">
                  Tags{form.tags.length ? ` (${form.tags.length})` : ""}
                </label>
                <button type="button" onClick={generateTags} disabled={generatingTags}
                  className="text-[11px] text-[#ff6b4a] hover:text-[#ff8566] disabled:opacity-40 disabled:cursor-not-allowed">
                  {generatingTags ? "Generating…" : (form.tags.length ? "Regenerate" : "Generate")}
                </button>
              </div>
              {form.tags.length === 0 ? (
                <p className="text-[11px] text-[#555] italic">No tags yet — click Generate to create them from the article body.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map((t: string) => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#111] border border-[#1a1a1a] rounded text-[10px] text-[#888]">
                      {t}
                      <button type="button" onClick={() => update("tags", form.tags.filter((x: string) => x !== t))} className="text-[#555] hover:text-red-400">&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Lead story */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_lead_story} onChange={(e) => update("is_lead_story", e.target.checked)}
                className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
              <span className="text-[12px] text-[#888]">Lead story</span>
            </label>
          </div>
        </div>

        {showSurveyPicker && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowSurveyPicker(false)}>
            <div className="w-full max-w-md bg-[#0c0c0c] border border-[#222] rounded-2xl p-5 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold text-white">Insert survey</h3>
                <button onClick={() => setShowSurveyPicker(false)} className="text-[#555] hover:text-white text-[20px]">×</button>
              </div>
              {surveys.length === 0 ? (
                <p className="text-[13px] text-[#888]">
                  No surveys yet. Create one in <a href="/admin/" className="text-[#ff6b4a] hover:underline">Admin → Surveys</a>.
                </p>
              ) : (
                <ul className="space-y-2">
                  {surveys.map((s) => (
                    <li key={s.id}>
                      <button onClick={() => insertSurvey(s)}
                        className="w-full text-left px-3 py-2.5 bg-[#111] border border-[#1a1a1a] rounded-lg text-[13px] text-white hover:border-[#ff6b4a]/50 hover:bg-[#ff6b4a]/5">
                        {s.title || <span className="italic text-[#666]">Untitled</span>}
                        <span className="block text-[10px] text-[#555] font-mono mt-0.5">{s.id.slice(0, 8)}…</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolBtn({ label, cmd, bold, italic }: { label: string; cmd: () => void; bold?: boolean; italic?: boolean }) {
  return (
    <button onClick={cmd}
      className={`px-2 py-1 text-[11px] text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors ${bold ? "font-bold" : ""} ${italic ? "italic" : ""}`}>
      {label}
    </button>
  );
}
