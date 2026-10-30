"use client";

import { useRef, useState, type ReactNode } from "react";
import Figure from "./Figure";
import { Icon, NumField, Segmented, fmt, toast } from "./ui";
import { ACTIVITY, GOALS, MACROS, targetFractions, targetsFor } from "@/lib/nutrition";
import { cloudEnabled, signIn, signInGoogle, signUp } from "@/lib/cloud";
import { shapeFromPhoto } from "@/lib/pose";
import { parseScaleCsv } from "@/lib/scale-csv";
import { DEFAULT_PROFILE, finishOnboarding, importWeights, setProfile, useData } from "@/lib/store";
import type { BodyInput } from "@/lib/figure/engine";
import type { Profile, Skin } from "@/lib/types";

export function bodyOf(p: Profile): BodyInput {
  return { sex: p.neutralFigure ? "neutral" : p.sex, heightCm: p.heightCm, weightKg: p.weightKg, age: p.age, bodyFat: p.bodyFat, shape: p.shape };
}

const DEMO_FILL = { carbs: 0.3, protein: 0.17, fat: 0.07 };

function Stage({ children, hero }: { children: ReactNode; hero: ReactNode }) {
  return (
    <div className="theme-dark mx-auto grid min-h-dvh max-w-6xl bg-bg text-ink lg:grid-cols-2 lg:items-center lg:gap-10 lg:px-8">
      <div className="sticky top-0 z-10 order-1 h-[38dvh] min-h-[250px] bg-bg lg:static lg:order-2 lg:h-[82dvh]">{hero}</div>
      <div className="safe-b order-2 px-5 pb-8 lg:order-1 lg:px-0">{children}</div>
    </div>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button className="press -ml-3 mb-2 inline-flex items-center gap-1 rounded-full px-3 text-muted" onClick={onClick}>
      <Icon name="back" size={20} /> Back
    </button>
  );
}

export function Welcome({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  return (
    <Stage hero={<Figure className="absolute inset-0" body={bodyOf(DEFAULT_PROFILE)} skin="light" fill={DEMO_FILL} dark follow frame={1.12} />}>
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted">Fit Ninja</p>
      <h1 className="serif text-[clamp(3rem,9vw,5.5rem)] leading-[0.95]">See your day fill up.</h1>
      <p className="mt-4 max-w-md text-lg text-muted">Scan a barcode, log what you eat, and watch carbs, protein and fat fill your figure from the feet up. Free, and it works offline.</p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <button className="press btn-primary hov-accent text-lg" onClick={onStart}>Create free account</button>
        <button className="press btn-ghost hov text-lg" onClick={onSignIn}>Sign in</button>
      </div>
      <p className="mt-5 max-w-md text-sm text-muted">No data is sold. Photos never leave your device. Without an account everything is saved on this device.</p>
    </Stage>
  );
}

export function Auth({ mode, setMode, onDone, onBack }: { mode: "signup" | "signin"; setMode: (m: "signup" | "signin") => void; onDone: () => void; onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const data = useData();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const r: { error?: string; notice?: string } = mode === "signup" ? await signUp(email, pw) : await signIn(email, pw);
    setBusy(false);
    if (r.error) return setMsg(r.error);
    if (r.notice) return setMsg(r.notice);
    onDone();
  }

  return (
    <Stage hero={<Figure className="absolute inset-0" body={bodyOf(data.profile)} skin={data.profile.skin} fill={DEMO_FILL} dark frame={1.12} />}>
      <Back onClick={onBack} />
      <h1 className="serif text-5xl leading-none">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-3 text-muted">{cloudEnabled ? "An account keeps your log in sync across your phone and computer." : "Accounts aren't set up on this copy, so your log is saved on this device. You can continue without one."}</p>
      <form className="mt-6 space-y-3" onSubmit={submit}>
        <label className="block"><span className="mb-1 block text-sm text-muted">Email</span>
          <input className="field" type="email" autoComplete="email" required={cloudEnabled} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-sm text-muted">Password</span>
          <input className="field" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required={cloudEnabled} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        {msg && <p role="alert" className="text-sm text-accent">{msg}</p>}
        <button className="press btn-primary hov-accent w-full text-lg" disabled={busy || !cloudEnabled}>{mode === "signup" ? "Create free account" : "Sign in"}</button>
        <button type="button" className="press btn-ghost hov w-full" disabled={!cloudEnabled} onClick={async () => { const r = await signInGoogle(); if (r.error) setMsg(r.error); }}>Continue with Google</button>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <button className="press rounded-full px-1 text-muted underline underline-offset-4" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}
        </button>
        <button className="press btn-ghost hov" onClick={onDone}>Continue without an account</button>
      </div>
    </Stage>
  );
}

export function SkinPicker({ value, onChange }: { value: Skin; onChange: (s: Skin) => void }) {
  const tones: { id: Skin; label: string; c: string }[] = [
    { id: "light", label: "Light", c: "#e9c5a8" },
    { id: "medium", label: "Medium", c: "#c99468" },
    { id: "deep", label: "Deep", c: "#7a4a2e" },
  ];
  return (
    <div role="radiogroup" aria-label="Skin tone" className="flex gap-3">
      {tones.map((t) => (
        <button key={t.id} role="radio" aria-checked={value === t.id} aria-label={t.label} onClick={() => onChange(t.id)} className="press grid w-12 place-items-center rounded-full" style={{ background: t.c, outline: value === t.id ? "3px solid var(--accent)" : "1px solid var(--line)", outlineOffset: 2 }}>
          {value === t.id && <Icon name="check" size={18} className="text-white mix-blend-difference" />}
        </button>
      ))}
    </div>
  );
}

/** Profile fields shared by About you and Targets. */
export function ProfileForm({ compact }: { compact?: boolean }) {
  const { profile } = useData();
  const p = profile;
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm text-muted">Sex <span className="opacity-70">(used in the formula)</span></p>
        <Segmented label="Sex" value={p.sex} onChange={(sex) => setProfile({ sex })} options={[{ id: "female", label: "Female" }, { id: "male", label: "Male" }]} />
        <button className="press mt-1 rounded-full px-1 text-sm text-muted underline underline-offset-4" onClick={() => setProfile({ neutralFigure: !p.neutralFigure })}>
          {p.neutralFigure ? "Use a figure that matches" : "Prefer a neutral figure"}
        </button>
      </div>
      <div><p className="mb-2 text-sm text-muted">Skin tone</p><SkinPicker value={p.skin} onChange={(skin) => setProfile({ skin })} /></div>
      <div className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-3"}`}>
        <NumField label="Age" unit="yrs" min={14} max={100} value={p.age} onChange={(age) => setProfile({ age })} />
        <NumField label="Height" unit="cm" min={120} max={220} value={p.heightCm} onChange={(heightCm) => setProfile({ heightCm })} />
        <NumField label="Weight" unit="kg" min={30} max={250} step={0.1} value={p.weightKg} onChange={(weightKg) => setProfile({ weightKg })} />
      </div>
      <label className="block"><span className="mb-1 block text-sm text-muted">Activity</span>
        <select className="field" value={p.activity} onChange={(e) => setProfile({ activity: e.target.value as Profile["activity"] })}>
          {ACTIVITY.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select></label>
      <div><p className="mb-2 text-sm text-muted">Goal</p>
        <Segmented label="Goal" value={p.goal} onChange={(goal) => setProfile({ goal })} options={(Object.keys(GOALS) as (keyof typeof GOALS)[]).map((id) => ({ id, label: GOALS[id].label }))} />
        <p className="mt-1 text-sm text-muted">{GOALS[p.goal].note}</p></div>
    </div>
  );
}

export function ScaleImport({ className }: { className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        const pts = parseScaleCsv(await f.text());
        if (!pts.length) return toast("No weigh-ins found in that file");
        importWeights(pts);
        toast(`Imported ${pts.length} weigh-ins`);
      }} />
      <button className={`press btn-ghost hov inline-flex items-center justify-center gap-2 ${className ?? ""}`} onClick={() => ref.current?.click()}>
        <Icon name="scale" size={20} /> Scale data (Renpho CSV)
      </button>
    </>
  );
}

export function About({ onBack, onNext, onPhoto }: { onBack: () => void; onNext: () => void; onPhoto: () => void }) {
  const { profile } = useData();
  return (
    <Stage hero={<Figure className="absolute inset-0" body={bodyOf(profile)} skin={profile.skin} fill={DEMO_FILL} dark follow frame={1.12} />}>
      <Back onClick={onBack} />
      <h1 className="serif text-5xl leading-none">About you</h1>
      <p className="mb-6 mt-3 text-muted">Your numbers set your daily target and shape the figure. Change them any time.</p>
      <ProfileForm />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button className="press btn-ghost hov inline-flex items-center justify-center gap-2" onClick={onPhoto}><Icon name="camera" size={20} /> Match a photo</button>
        <ScaleImport />
      </div>
      <button className="press btn-primary hov-accent mt-6 w-full text-lg" onClick={onNext}>See my target</button>
    </Stage>
  );
}

export function ShapeSliders() {
  const { profile } = useData();
  const rows: { k: keyof Profile["shape"]; label: string }[] = [
    { k: "shoulders", label: "Shoulders" }, { k: "waist", label: "Waist" }, { k: "hips", label: "Hips" }, { k: "legs", label: "Legs" },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <label key={r.k} className="block">
          <span className="flex justify-between text-sm text-muted"><span>{r.label}</span><span className="num">{profile.shape[r.k] > 0 ? "+" : ""}{Math.round(profile.shape[r.k] * 100)}</span></span>
          <input type="range" min={-1} max={1} step={0.05} value={profile.shape[r.k]} aria-label={r.label} onChange={(e) => setProfile({ shape: { ...profile.shape, [r.k]: parseFloat(e.target.value) } })} />
        </label>
      ))}
      <button className="press rounded-full px-1 text-sm text-muted underline underline-offset-4" onClick={() => setProfile({ shape: { shoulders: 0, waist: 0, hips: 0, legs: 0 } })}>Reset to average</button>
    </div>
  );
}

export function PhotoMatch({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { profile } = useData();
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy?: boolean; msg?: string }>({});
  return (
    <Stage hero={<Figure className="absolute inset-0" body={bodyOf(profile)} skin={profile.skin} fill={DEMO_FILL} dark frame={1.12} />}>
      <Back onClick={onBack} />
      <h1 className="serif text-5xl leading-none">Match a photo</h1>
      <p className="mb-5 mt-3 text-muted">A full-length photo, standing, facing the camera. Your shoulders, waist, hips and legs are read on this device. The photo is never uploaded.</p>
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        setState({ busy: true, msg: "Reading the photo on this device…" });
        const r = await shapeFromPhoto(f);
        if ("error" in r) setState({ msg: r.error });
        else { setProfile({ shape: r.shape }); setState({ msg: r.note }); }
      }} />
      <button className="press btn-primary hov-accent mb-2 inline-flex w-full items-center justify-center gap-2 text-lg" disabled={state.busy} onClick={() => ref.current?.click()}><Icon name="camera" size={20} /> Choose or take a photo</button>
      <p role="status" className="mb-5 min-h-6 text-sm text-muted">{state.msg}</p>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Fine-tune</h2>
      <ShapeSliders />
      <button className="press btn-primary hov-accent mt-6 w-full text-lg" onClick={onDone}>Use this shape</button>
    </Stage>
  );
}

export function Target({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  const { profile } = useData();
  const t = targetsFor(profile);
  return (
    <Stage hero={<Figure className="absolute inset-0" body={bodyOf(profile)} skin={profile.skin} fill={targetFractions(t)} dark frame={1.12} />}>
      <Back onClick={onBack} />
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Your daily target</p>
      <p className="serif num mt-2 text-[clamp(4.5rem,16vw,7.5rem)] leading-[0.9]">{fmt(t.kcal)}<span className="ml-2 text-3xl text-muted">kcal</span></p>
      <p className="mt-3 text-muted">From {fmt(t.bmr)} kcal resting, ×{t.factor} for activity ({fmt(t.tdee)}), {t.adjust === 0 ? "no change" : `${t.adjust > 0 ? "+" : "−"}${Math.abs(t.adjust)}`} for your goal.</p>
      <ul className="mt-5 grid grid-cols-3 gap-3">
        {MACROS.map((m) => (
          <li key={m.key} className="rounded-2xl border border-line bg-surface p-3">
            <span className="flex items-center gap-2 text-sm text-muted"><i className="size-2.5 rounded-full" style={{ background: m.color }} />{m.label}</span>
            <span className="serif num block text-4xl">{t[m.key]}<span className="text-lg text-muted"> g</span></span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">The figure shows the full day: carbs, protein and fat filling from the feet up.</p>
      <button className="press btn-primary hov-accent mt-6 w-full text-lg" onClick={() => { finishOnboarding(); onStart(); }}>Start tracking</button>
    </Stage>
  );
}
