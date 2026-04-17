import React, { useState, useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props { supabase: SupabaseClient }

interface Resource {
  id: string; slug: string; title: string; description: string | null;
  resource_type: string; color: string; pdf_url: string | null;
  pdf_filename: string | null; cover_image_url: string | null;
  blog_content_html: string; blog_content_markdown: string;
  themes: string[]; published: boolean; featured: boolean;
  display_order: number; download_count: number;
  created_at: string; updated_at: string;
}

const RESOURCE_TYPES = ["report", "framework", "playbook", "guide", "whitepaper", "template", "toolkit"];
const COLORS = ["#ff6b4a", "#9b7bff", "#4ab8c9", "#f5a623", "#6bbf71", "#ff8566", "#5ba3cc", "#c96bff"];
const THEMES = [
  "ai-product-strategy", "adoption-organizational-change", "agents-agentic-systems",
  "data-semantics-knowledge-foundations", "evaluation-benchmarking",
  "go-to-market-distribution", "governance-risk-trust", "ux-experience-design-for-ai",
];

const EMPTY: Partial<Resource> = {
  title: "", slug: "", description: "", resource_type: "report", color: "#ff6b4a",
  pdf_url: null, pdf_filename: null, cover_image_url: null,
  blog_content_html: "", blog_content_markdown: "", themes: [],
  published: false, featured: false, display_order: 0,
};

type BlogTab = "edit" | "html" | "preview";

export default function ResourcesScreen({ supabase }: Props) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [editing, setEditing] = useState<Partial<Resource> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [blogTab, setBlogTab] = useState<BlogTab>("edit");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadResources(); }, []);

  async function loadResources() {
    setLoading(true);
    const { data } = await supabase.from("resources").select("*").order("display_order");
    if (data) setResources(data);
    setLoading(false);
  }

  function autoSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  }

  async function uploadPdf(file: File) {
    if (!editing) return;
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase();
    const path = `${editing.slug || "resource"}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from("resources").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (upErr) {
      setMsg(`Upload error: ${upErr.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("resources").getPublicUrl(path);
    setEditing({
      ...editing,
      pdf_url: urlData.publicUrl,
      pdf_filename: file.name,
    });
    setMsg("PDF uploaded");
    setTimeout(() => setMsg(""), 2000);
    setUploading(false);
  }

  function syncFromEditor() {
    if (editorRef.current && editing) {
      setEditing({ ...editing, blog_content_html: editorRef.current.innerHTML });
    }
  }

  function execCmd(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  }

  async function saveResource() {
    if (!editing) return;
    if (!editing.title?.trim()) { setMsg("Title is required"); return; }
    if (!editing.slug?.trim()) editing.slug = autoSlug(editing.title!);

    const payload: any = { ...editing, updated_at: new Date().toISOString() };
    delete payload.id;
    delete payload.created_at;
    delete payload.download_count;

    let error;
    if (isNew) {
      const res = await supabase.from("resources").insert(payload);
      error = res.error;
    } else {
      const res = await supabase.from("resources").update(payload).eq("id", editing.id);
      error = res.error;
    }

    if (error) setMsg(`Error: ${error.message}`);
    else { setMsg("Saved"); setEditing(null); setTimeout(() => setMsg(""), 2000); loadResources(); }
  }

  async function deleteResource(id: string) {
    if (!confirm("Delete this resource?")) return;
    await supabase.from("resources").delete().eq("id", id);
    loadResources();
  }

  async function togglePublished(id: string, current: boolean) {
    await supabase.from("resources").update({ published: !current }).eq("id", id);
    setResources(prev => prev.map(r => r.id === id ? { ...r, published: !current } : r));
  }

  async function toggleFeatured(id: string, current: boolean) {
    await supabase.from("resources").update({ featured: !current }).eq("id", id);
    setResources(prev => prev.map(r => r.id === id ? { ...r, featured: !current } : r));
  }

  function toggleTheme(slug: string) {
    if (!editing) return;
    const arr = editing.themes ?? [];
    setEditing({ ...editing, themes: arr.includes(slug) ? arr.filter(t => t !== slug) : [...arr, slug] });
  }

  // ─── Resource List ──────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div className="space-y-6 max-w-4xl">
        {msg && <div className="px-4 py-2 rounded-lg text-[13px] font-medium bg-green-500/10 text-green-400">{msg}</div>}

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-bold text-white">AI Strategy Resources</h3>
            <p className="text-[12px] text-[#555] mt-1">Manage PDFs, reports, frameworks, and blog posts about each resource.</p>
          </div>
          <button onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); setBlogTab("edit"); }}
            className="px-4 py-2.5 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566] transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            New Resource
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" /></div>
        ) : resources.length === 0 ? (
          <div className="text-center py-16 text-[#555]">
            <p className="text-[14px] mb-2">No resources yet</p>
            <p className="text-[12px]">The homepage currently shows placeholder resources. Add real ones here to replace them.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {resources.map((r) => (
              <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl bg-[#0c0c0c] border border-[#1a1a1a] hover:border-[#282828] transition-colors">
                <div className="w-10 h-12 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${r.color}15`, border: `1px solid ${r.color}25` }}>
                  <svg className="w-5 h-5" style={{ color: r.color }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 18h10M7 14h10M7 10h4M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><path d="M13 2v7h7"/>
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-[#ccc]">{r.title}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: r.color }}>{r.resource_type}</span>
                    {r.featured && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#ff6b4a]/10 text-[#ff6b4a]">Featured</span>}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${r.published ? "bg-green-500/10 text-green-400" : "bg-[#222] text-[#555]"}`}>
                      {r.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-[#555]">
                    {r.pdf_filename && <span>PDF: {r.pdf_filename}</span>}
                    {r.blog_content_html && <span>Has blog post</span>}
                    <span>{r.download_count} downloads</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleFeatured(r.id, r.featured)} className="text-[11px] text-[#666] hover:text-white">
                    {r.featured ? "Unfeature" : "Feature"}
                  </button>
                  <button onClick={() => togglePublished(r.id, r.published)} className="text-[11px] text-[#666] hover:text-white">
                    {r.published ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => { setEditing({ ...r }); setIsNew(false); setBlogTab("edit"); }}
                    className="text-[11px] text-[#ff6b4a] hover:text-[#ff8566] font-medium">Edit</button>
                  <button onClick={() => deleteResource(r.id)} className="text-[11px] text-[#555] hover:text-red-400">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Resource Editor ────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl">
      {msg && <div className={`mb-4 px-4 py-2 rounded-lg text-[13px] font-medium ${msg.startsWith("Error") || msg.startsWith("Upload error") ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>{msg}</div>}

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 text-[13px] text-[#888] hover:text-white transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back to Resources
        </button>
        <div className="flex items-center gap-3">
          <button onClick={saveResource} className="px-5 py-2 bg-[#ff6b4a] text-white rounded-lg text-[13px] font-semibold hover:bg-[#ff8566] transition-colors">Save</button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_300px] gap-6">
        {/* Main column */}
        <div className="space-y-5">
          <div>
            <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Title</label>
            <input type="text" className="w-full px-4 py-3 bg-[#111] border border-[#222] rounded-lg text-[16px] font-bold text-white focus:outline-none focus:border-[#ff6b4a]/50"
              value={editing.title ?? ""} onChange={(e) => { setEditing({ ...editing, title: e.target.value }); if (isNew) setEditing(prev => ({ ...prev!, slug: autoSlug(e.target.value) })); }}
              placeholder="Resource title" />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Description</label>
            <textarea className="w-full h-20 bg-[#111] border border-[#222] rounded-lg p-3 text-[13px] text-white focus:outline-none focus:border-[#ff6b4a]/50 resize-y"
              value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Brief description shown on cards" />
          </div>

          {/* PDF Upload */}
          <div>
            <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">PDF File</label>
            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="px-4 py-2.5 bg-[#1a1a1a] border border-[#222] rounded-lg text-[13px] text-[#ccc] hover:text-white hover:border-[#333] transition-colors disabled:opacity-50 flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                {uploading ? "Uploading..." : "Upload PDF"}
              </button>
              {editing.pdf_filename && (
                <div className="flex items-center gap-2 px-3 py-2 bg-[#111] rounded-lg border border-[#1a1a1a]">
                  <svg className="w-4 h-4 text-[#ff6b4a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 18h10M7 14h10M7 10h4M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7z"/><path d="M13 2v7h7"/>
                  </svg>
                  <span className="text-[12px] text-[#888]">{editing.pdf_filename}</span>
                  {editing.pdf_url && (
                    <a href={editing.pdf_url} target="_blank" rel="noopener" className="text-[11px] text-[#ff6b4a] hover:text-[#ff8566]">View</a>
                  )}
                </div>
              )}
            </div>
            {!editing.pdf_filename && editing.pdf_url && (
              <div className="mt-2">
                <label className="block text-[10px] text-[#555] mb-1">Or paste URL directly:</label>
                <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[12px] text-white focus:outline-none"
                  value={editing.pdf_url ?? ""} onChange={(e) => setEditing({ ...editing, pdf_url: e.target.value })} placeholder="https://..." />
              </div>
            )}
          </div>

          {/* Blog Post about the resource */}
          <div>
            <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-2">Blog Post</label>
            <p className="text-[11px] text-[#555] mb-3">Write a blog post or summary about this resource. Shown on the resource's detail page.</p>

            <div className="flex items-center gap-0.5 mb-2">
              {(["edit", "html", "preview"] as BlogTab[]).map((t) => (
                <button key={t} onClick={() => { if (blogTab === "edit") syncFromEditor(); setBlogTab(t); }}
                  className={`px-4 py-2 text-[12px] font-semibold rounded-t-lg transition-colors ${blogTab === t ? "bg-[#1a1a1a] text-white" : "text-[#666] hover:text-white"}`}>
                  {t === "edit" ? "Visual" : t === "html" ? "HTML" : "Preview"}
                </button>
              ))}
            </div>

            {blogTab === "edit" && (
              <div>
                <div className="flex flex-wrap items-center gap-1 p-2 bg-[#111] border border-[#222] border-b-0 rounded-t-lg">
                  <TBtn label="B" cmd={() => execCmd("bold")} bold />
                  <TBtn label="I" cmd={() => execCmd("italic")} italic />
                  <span className="w-px h-5 bg-[#222] mx-1" />
                  <TBtn label="H2" cmd={() => execCmd("formatBlock", "h2")} />
                  <TBtn label="H3" cmd={() => execCmd("formatBlock", "h3")} />
                  <TBtn label="P" cmd={() => execCmd("formatBlock", "p")} />
                  <span className="w-px h-5 bg-[#222] mx-1" />
                  <TBtn label="UL" cmd={() => execCmd("insertUnorderedList")} />
                  <TBtn label="OL" cmd={() => execCmd("insertOrderedList")} />
                  <TBtn label="Link" cmd={() => { const url = prompt("URL:"); if (url) execCmd("createLink", url); }} />
                </div>
                <div ref={editorRef} contentEditable suppressContentEditableWarning
                  className="min-h-[300px] bg-[#111] border border-[#222] rounded-b-lg p-6 text-[14px] text-[#ddd] leading-relaxed focus:outline-none"
                  dangerouslySetInnerHTML={{ __html: editing.blog_content_html ?? "" }}
                  onBlur={syncFromEditor}
                />
              </div>
            )}
            {blogTab === "html" && (
              <textarea className="w-full min-h-[300px] bg-[#111] border border-[#222] rounded-lg p-4 text-[13px] text-[#ccc] font-mono focus:outline-none resize-y"
                value={editing.blog_content_html ?? ""} onChange={(e) => setEditing({ ...editing, blog_content_html: e.target.value })}
                placeholder="<h2>About this resource</h2><p>...</p>" />
            )}
            {blogTab === "preview" && (
              <div className="min-h-[300px] bg-[#111] border border-[#222] rounded-lg p-8">
                <div className="article-prose max-w-3xl" dangerouslySetInnerHTML={{ __html: editing.blog_content_html ?? "" }} />
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div>
            <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Status</label>
            <select className="w-full px-3 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
              value={editing.published ? "published" : "draft"} onChange={(e) => setEditing({ ...editing, published: e.target.value === "published" })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Slug</label>
            <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[12px] text-[#888] font-mono focus:outline-none"
              value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Type</label>
            <select className="w-full px-3 py-2.5 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
              value={editing.resource_type ?? "report"} onChange={(e) => setEditing({ ...editing, resource_type: e.target.value })}>
              {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setEditing({ ...editing, color: c })}
                  className={`w-7 h-7 rounded-lg border-2 transition-all ${editing.color === c ? "border-white scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Cover Image URL</label>
            <input type="text" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[12px] text-white focus:outline-none"
              value={editing.cover_image_url ?? ""} onChange={(e) => setEditing({ ...editing, cover_image_url: e.target.value })} placeholder="https://..." />
            {editing.cover_image_url && <img src={editing.cover_image_url} alt="" className="mt-2 rounded-lg w-full aspect-[3/4] object-cover border border-[#222]" />}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-1.5">Display Order</label>
            <input type="number" className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-[13px] text-white focus:outline-none"
              value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: parseInt(e.target.value) || 0 })} />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#666] uppercase tracking-wider mb-2">Themes</label>
            <div className="flex flex-wrap gap-1.5">
              {THEMES.map(t => (
                <button key={t} onClick={() => toggleTheme(t)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                    (editing.themes ?? []).includes(t) ? "bg-[#ff6b4a]/15 text-[#ff6b4a] border border-[#ff6b4a]/30" : "bg-[#111] text-[#666] border border-[#1a1a1a] hover:text-white"
                  }`}>
                  {t.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()).replace(/Ai /g, "AI ").replace(/Ux /g, "UX ")}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={editing.featured ?? false} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
              className="w-4 h-4 rounded border-[#333] bg-[#0a0a0a] text-[#ff6b4a]" />
            <span className="text-[12px] text-[#888]">Featured on homepage</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function TBtn({ label, cmd, bold, italic }: { label: string; cmd: () => void; bold?: boolean; italic?: boolean }) {
  return (
    <button onClick={cmd}
      className={`px-2 py-1 text-[11px] text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded transition-colors ${bold ? "font-bold" : ""} ${italic ? "italic" : ""}`}>
      {label}
    </button>
  );
}
