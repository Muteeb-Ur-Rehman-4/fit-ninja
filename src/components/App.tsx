"use client";

import { useCallback, useEffect, useState } from "react";
import { About, Auth, PhotoMatch, Target, Welcome } from "./Onboarding";
import { ManualSheet, ProductSheet, ScanSheet, resolveCode } from "./Food";
import { Foods, History, Targets, Today } from "./Screens";
import { Icon, Toaster, toast } from "./ui";
import { cloudEnabled, getSession, pull, push, supabase } from "@/lib/cloud";
import { getState, replaceAll, useChangeHook, useData } from "@/lib/store";
import type { Food } from "@/lib/types";

type Screen = "welcome" | "auth" | "about" | "photo" | "target" | "app";
type Tab = "today" | "history" | "foods" | "targets";
type Overlay =
  | null
  | { kind: "scan" }
  | { kind: "product"; food: Food }
  | { kind: "manual"; code?: string }
  | { kind: "loading" };

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "today" },
  { id: "history", label: "History", icon: "history" },
  { id: "foods", label: "Foods", icon: "foods" },
  { id: "targets", label: "Targets", icon: "targets" },
];

export default function App() {
  const data = useData();
  const [screen, setScreen] = useState<Screen>(() => (getState().onboarded ? "app" : "welcome"));
  const [from, setFrom] = useState<"about" | "targets">("about");
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [tab, setTab] = useState<Tab>("today");
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [session, setSession] = useState<{ id: string; email: string } | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, [screen, tab]);

  // service worker
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // optional cloud: follow the session, pull on sign-in (newest wins), push on change
  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    const apply = async (s: { user: { id: string; email?: string } } | null) => {
      if (!s) return setSession(null);
      setSession({ id: s.user.id, email: s.user.email ?? "your account" });
      const remote = await pull();
      const local = getState();
      if (remote && remote.updatedAt > local.updatedAt) {
        replaceAll(remote.data, true);
        if (remote.data.onboarded) setScreen((c) => (c === "app" ? c : "app"));
      } else if (local.updatedAt) await push(s.user.id, local);
    };
    getSession().then(apply);
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => { void apply(s); });
    return () => sub.subscription.unsubscribe();
  }, []);

  useChangeHook((d) => { if (session) void push(session.id, d); });

  const openCode = useCallback(async (code: string) => {
    setOverlay({ kind: "loading" });
    const r = await resolveCode(code);
    if (r.status === "found") setOverlay({ kind: "product", food: r.food });
    else if (r.status === "missing") { toast("Not found in Open Food Facts"); setOverlay({ kind: "manual", code }); }
    else { toast("Couldn't reach Open Food Facts. Check your connection."); setOverlay({ kind: "scan" }); }
  }, []);

  const pick = useCallback((food: Food) => setOverlay({ kind: "product", food }), []);
  const goToday = () => { setTab("today"); setOverlay(null); };

  if (screen !== "app") {
    return (
      <>
        {screen === "welcome" && <Welcome onStart={() => { setAuthMode("signup"); setScreen("auth"); }} onSignIn={() => { setAuthMode("signin"); setScreen("auth"); }} />}
        {screen === "auth" && <Auth mode={authMode} setMode={setAuthMode} onBack={() => setScreen("welcome")} onDone={() => setScreen(getState().onboarded ? "app" : "about")} />}
        {screen === "about" && <About onBack={() => setScreen("auth")} onNext={() => setScreen("target")} onPhoto={() => { setFrom("about"); setScreen("photo"); }} />}
        {screen === "photo" && <PhotoMatch onBack={() => setScreen(from === "about" ? "about" : "app")} onDone={() => setScreen(from === "about" ? "about" : "app")} />}
        {screen === "target" && <Target onBack={() => setScreen("about")} onStart={() => { setTab("today"); setScreen("app"); }} />}
        <Toaster />
      </>
    );
  }

  const content = (
    <>
      {tab === "today" && <Today onScan={() => setOverlay({ kind: "scan" })} onPick={pick} session={session?.email ?? null} />}
      {tab === "history" && <History />}
      {tab === "foods" && <Foods onPick={pick} onAddOwn={() => setOverlay({ kind: "manual" })} />}
      {tab === "targets" && <Targets session={session?.email ?? null} onSignIn={() => { setAuthMode("signin"); setScreen("auth"); }} onPhoto={() => { setFrom("targets"); setScreen("photo"); }} />}
    </>
  );

  const navBtn = (t: (typeof TABS)[number]) => (
    <button key={t.id}
    role="tab" aria-selected={tab === t.id} aria-label={t.label} onClick={() => setTab(t.id)}
      className={`press flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-medium lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-base ${tab === t.id ? "text-accent" : "text-muted"} lg:hov`}>
      <Icon name={t.icon} /><span>{t.label}</span>
    </button>
  );

  return (
    <div className="min-h-dvh bg-bg text-ink lg:flex">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line p-5 lg:flex">
        <p className="serif mb-6 text-4xl">Fit Ninja</p>
        <nav role="tablist" aria-label="Main" className="flex flex-col gap-1">{TABS.map(navBtn)}</nav>
        <button className="press btn-primary hov-accent mt-6 inline-flex items-center justify-center gap-2" onClick={() => setOverlay({ kind: "scan" })}><Icon name="scan" size={20} /> Scan a barcode</button>
        <p className="mt-auto text-xs text-muted">{session ? session.email : "Saved on this device"}{!cloudEnabled && ""}</p>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-32 pt-[max(1rem,env(safe-area-inset-top))] lg:px-8 lg:pb-10 lg:pt-6" key={tab}>
        <div className="rise mx-auto max-w-6xl">{content}</div>
      </main>

      {/* phone tab bar */}
      <nav role="tablist" aria-label="Main" className="safe-b fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-line bg-surface/95 px-2 pt-2 backdrop-blur lg:hidden">
        {navBtn(TABS[0])}{navBtn(TABS[1])}
        <button aria-label="Scan a barcode" className="press btn-primary hov-accent -mt-7 grid size-16 shrink-0 place-items-center rounded-full px-0 shadow-lg" onClick={() => setOverlay({ kind: "scan" })}><Icon name="scan" size={28} /></button>
        {navBtn(TABS[2])}{navBtn(TABS[3])}
      </nav>

      {overlay?.kind === "scan" && <ScanSheet onClose={() => setOverlay(null)} onCode={openCode} />}
      {overlay?.kind === "loading" && <div className="theme-dark fixed inset-0 z-40 grid place-items-center bg-black/70 text-ink" role="status">Looking it up…</div>}
      {overlay?.kind === "product" && <ProductSheet food={overlay.food} onClose={() => setOverlay(null)} onAdded={goToday} />}
      {overlay?.kind === "manual" && <ManualSheet code={overlay.code} onClose={() => setOverlay(null)} onSaved={(f) => setOverlay({ kind: "product", food: f })} />}
      <Toaster />
      <span hidden>{data.updatedAt}</span>
    </div>
  );
}
