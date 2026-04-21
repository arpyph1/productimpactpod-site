import React, { useState, useEffect, useCallback } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getAdminClient, isAllowedAdmin } from "../../lib/admin-supabase";
import SettingsScreen from "./screens/SettingsScreen";
import SEOScreen from "./screens/SEOScreen";
import HomepageScreen from "./screens/HomepageScreen";
import ArticlesScreen from "./screens/ArticlesScreen";
import PodcastScreen from "./screens/PodcastScreen";
import PartnersScreen from "./screens/PartnersScreen";
import ResourcesScreen from "./screens/ResourcesScreen";
import SocialScreen from "./screens/SocialScreen";
import ArticleModal from "./ArticleModal";

type Screen = "settings" | "seo" | "homepage" | "articles" | "resources" | "podcast" | "partners" | "social";

interface AdminUser {
  user: User;
  email: string;
  name: string;
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const NAV_ITEMS: { key: Screen; label: string; icon: string }[] = [
  { key: "settings", label: "Settings", icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" },
  { key: "seo", label: "SEO", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { key: "homepage", label: "Homepage", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" },
  { key: "articles", label: "Articles", icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" },
  { key: "resources", label: "Resources", icon: "M7 18h10M7 14h10M7 10h4M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9l-7-7zM13 2v7h7" },
  { key: "podcast", label: "Podcast", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
  { key: "partners", label: "Partners", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { key: "social", label: "Social", icon: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" },
];

function Sidebar({ active, onNav, admin, onLogout }: {
  active: Screen;
  onNav: (s: Screen) => void;
  admin: AdminUser;
  onLogout: () => void;
}) {
  return (
    <aside className="w-60 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded bg-[#ff6b4a] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-[9px]">PI</span>
          </div>
          <span className="text-[14px] font-bold text-white">Admin</span>
        </div>
        <p className="text-[11px] text-[#555] mt-1">Product Impact CMS</p>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onNav(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
              active === item.key
                ? "bg-[#ff6b4a]/10 text-[#ff6b4a] border border-[#ff6b4a]/20"
                : "text-[#888] hover:text-white hover:bg-[#111] border border-transparent"
            }`}
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-[#1a1a1a]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#222] flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-[#666]">
              {admin.name.split(" ").map(n => n[0]).join("").toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-[#ccc] truncate">{admin.name}</div>
            <div className="text-[10px] text-[#555] truncate">{admin.email}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full text-[11px] text-[#666] hover:text-[#ff6b4a] transition-colors text-left"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ─── Login Screen ────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, error }: { onLogin: () => void; error: string | null }) {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#ff6b4a] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-[14px]">PI</span>
          </div>
          <h1 className="text-[24px] font-extrabold text-white mb-1">Admin</h1>
          <p className="text-[13px] text-[#666]">Product Impact CMS</p>
        </div>

        <button
          onClick={onLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white hover:bg-gray-100 text-[#333] rounded-xl text-[14px] font-semibold transition-colors shadow-lg"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400 text-center">
            {error}
          </div>
        )}

        <p className="text-[11px] text-[#444] text-center mt-6">
          Restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}

// ─── Main Admin App ──────────────────────────────────────────────────────────
export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("articles");
  const [editingArticle, setEditingArticle] = useState<any | undefined>(undefined);
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState("");

  const supabase = getAdminClient();

  useEffect(() => {
    // Check for OAuth error in URL hash (Supabase redirects errors here)
    const hash = window.location.hash;
    if (hash.includes("error=")) {
      const params = new URLSearchParams(hash.replace("#", "?"));
      const errDesc = decodeURIComponent(params.get("error_description") ?? "Unknown error");
      setError(`Auth error: ${errDesc}`);
      window.history.replaceState(null, "", window.location.pathname);
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess && !isAllowedAdmin(sess.user.email)) {
        setError(`Access denied for ${sess.user.email}. Contact an admin to get access.`);
        supabase.auth.signOut();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = useCallback(async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/admin/" },
    });
    if (err) setError(err.message);
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    setDeployMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("trigger-deploy");
      if (error) {
        setDeployMsg(`Deploy failed: ${error.message}`);
      } else if (data?.success) {
        setDeployMsg("Build triggered! Site will update in ~3 minutes.");
      } else {
        setDeployMsg(`Deploy error: ${data?.error ?? "Unknown error"}`);
      }
    } catch (e: any) {
      setDeployMsg(`Deploy failed: ${e.message}`);
    }
    setDeploying(false);
    setTimeout(() => setDeployMsg(""), 8000);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#ff6b4a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !isAllowedAdmin(session.user.email)) {
    return <LoginScreen onLogin={handleLogin} error={error} />;
  }

  const admin: AdminUser = {
    user: session.user,
    email: session.user.email ?? "",
    name: session.user.user_metadata?.full_name ?? session.user.email ?? "Admin",
  };

  return (
    <div className="flex min-h-screen bg-[#080808] text-white">
      <Sidebar active={screen} onNav={setScreen} admin={admin} onLogout={handleLogout} />
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 bg-[#080808]/95 backdrop-blur-sm border-b border-[#1a1a1a] px-8 py-4 flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-white capitalize">{screen}</h2>
          <div className="flex items-center gap-3">
            {deployMsg && (
              <span className={`text-[12px] ${deployMsg.includes("triggered") ? "text-green-400" : "text-[#ff6b4a]"}`}>{deployMsg}</span>
            )}
            <button onClick={handleDeploy} disabled={deploying}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#222] text-[12px] font-semibold text-[#ccc] hover:text-white hover:border-[#444] transition-colors disabled:opacity-50">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              {deploying ? "Deploying..." : "Rebuild & Deploy"}
            </button>
          </div>
        </header>
        <div className="p-8">
          <ScreenRouter screen={screen} supabase={supabase} admin={admin} onEditArticle={(a: any) => setEditingArticle(a)} />
        </div>
      </main>
      {editingArticle !== undefined && (
        <ArticleModal
          supabase={supabase}
          article={editingArticle}
          onClose={() => setEditingArticle(undefined)}
          onSaved={() => setEditingArticle(undefined)}
        />
      )}
    </div>
  );
}

function ScreenRouter({ screen, supabase, admin, onEditArticle }: { screen: Screen; supabase: any; admin: AdminUser; onEditArticle: (a: any) => void }) {
  switch (screen) {
    case "settings": return <SettingsScreen supabase={supabase} />;
    case "seo": return <SEOScreen supabase={supabase} />;
    case "homepage": return <HomepageScreen supabase={supabase} />;
    case "articles": return <ArticlesScreen supabase={supabase} onEditArticle={onEditArticle} />;
    case "resources": return <ResourcesScreen supabase={supabase} />;
    case "podcast": return <PodcastScreen supabase={supabase} />;
    case "partners": return <PartnersScreen supabase={supabase} />;
    case "social": return <SocialScreen supabase={supabase} />;
    default: return null;
  }
}
