"use client";

import { useRef, useState } from "react";
import Figure from "./Figure";
import { FoodSearch, MEALS } from "./Food";
import { ProfileForm, ScaleImport, ShapeSliders, SkinPicker, bodyOf } from "./Onboarding";
import { Icon, fmt, toast } from "./ui";
import { MACROS, targetsFor } from "@/lib/nutrition";
import { signOut } from "@/lib/cloud";
import { addWater, dayKey, getState, logWeight, removeEntry, replaceAll, resetAll, restoreEntry, setProfile, useData, useToday } from "@/lib/store";
import type { Food, MacroKey } from "@/lib/types";

export function FigureCard({ highlight, className = "" }: { highlight?: MacroKey | null; className?: string }) {
  const { profile } = useData();
  const { fill } = useToday();
  return (
    <div className={`card relative overflow-hidden ${className}`}>
      <Figure className="absolute inset-0" body={bodyOf(profile)} skin={profile.skin} fill={fill} highlight={highlight} follow frame={1.1} />
    </div>
  );
}

export function Today({ onScan, onPick, session }: { onScan: () => void; onPick: (f: Food) => void; session: string | null }) {
  const data = useData();
  const { day, targets: t, eaten } = useToday();
  const [hi, setHi] = useState<MacroKey | null>(null);
  const left = t.kcal - eaten.kcal;
  const today = dayKey();
  const lastWeight = data.weights[data.weights.length - 1];
  const [w, setW] = useState("");

  return (
    <div className="lg:grid lg:grid-cols-[minmax(340px,5fr)_7fr] lg:gap-8">
      <div className="lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)]">
        <FigureCard highlight={hi} className="h-[44dvh] min-h-[300px] lg:h-full" />
      </div>
      <div className="mt-4 space-y-4 lg:mt-0">
        <section className="card p-5" aria-label="Calories left">
          <p className="text-sm text-muted">{left >= 0 ? "Left today" : "Over today"}</p>
          <p className="serif num text-[clamp(4rem,14vw,6rem)] leading-[0.9]">{fmt(Math.abs(left))}<span className="ml-2 text-2xl text-muted">kcal</span></p>
          <p className="num text-sm text-muted">{fmt(eaten.kcal)} eaten of {fmt(t.kcal)}</p>
          <ul className="mt-4 space-y-1" onPointerLeave={() => setHi(null)}>
            {MACROS.map((m) => {
              const got = eaten[m.key];
              const pct = Math.min(1, got / Math.max(1, t[m.key]));
              return (
                <li key={m.key}>
                  <button
                    className="press hov w-full rounded-2xl px-3 py-2 text-left"
                    aria-pressed={hi === m.key}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setHi(m.key)}
                    onClick={() => setHi(hi === m.key ? null : m.key)}
                  >
                    <span className="flex items-baseline justify-between">
                      <span className="flex items-center gap-2 font-medium"><i className="size-3 rounded-full" style={{ background: m.color }} />{m.label}</span>
                      <span className="num text-sm text-muted"><b className="text-base text-ink">{Math.round(got)}</b> / {t[m.key]} g</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full" style={{ width: `${pct * 100}%`, background: m.color, transition: "width 400ms var(--ease)" }} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button className="press btn-primary hov-accent mt-4 inline-flex w-full items-center justify-center gap-2 text-lg" onClick={onScan}><Icon name="scan" /> Scan a barcode</button>
        </section>

        <section className="card p-4" aria-label="Add food">
          <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wider text-muted">Add food</h2>
          <FoodSearch onPick={onPick} />
        </section>

        <section className="space-y-3" aria-label="Meals">
          {MEALS.map((m) => {
            const es = day.entries.filter((e) => e.meal === m.id);
            const kcal = es.reduce((s, e) => s + e.kcal, 0);
            return (
              <div key={m.id} className="card p-4">
                <div className="flex items-baseline justify-between px-1">
                  <h3 className="serif text-2xl">{m.label}</h3>
                  <span className="num text-sm text-muted">{fmt(kcal)} kcal</span>
                </div>
                {es.length === 0 ? <p className="px-1 pt-1 text-sm text-muted">Nothing yet</p> : (
                  <ul className="mt-1">
                    {es.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 rounded-xl px-1">
                        <span className="min-w-0 flex-1 py-2">
                          <span className="block truncate font-medium">{e.name}</span>
                          <span className="num block text-sm text-muted">{e.grams} g · P {Math.round(e.protein)} · C {Math.round(e.carbs)} · F {Math.round(e.fat)}</span>
                        </span>
                        <span className="num text-sm font-semibold">{e.kcal}</span>
                        <button aria-label={`Remove ${e.name}`} className="press hov grid w-11 place-items-center rounded-full text-muted" onClick={() => { removeEntry(e.id); toast(`Removed ${e.name}`, () => restoreEntry(e)); }}><Icon name="trash" size={19} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        <section className="card p-5" aria-label="Daily target">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Daily target</h2>
          <p className="serif num text-5xl">{fmt(t.kcal)} <span className="text-xl text-muted">kcal</span></p>
          <p className="num mt-1 text-sm text-muted">{t.protein} g protein · {t.fat} g fat · {t.carbs} g carbs</p>
          <p className="mt-2 text-sm text-muted">{fmt(t.bmr)} resting × {t.factor} activity = {fmt(t.tdee)}, {t.adjust === 0 ? "no goal change" : `${t.adjust > 0 ? "+" : "−"}${Math.abs(t.adjust)} for your goal`}.</p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="card p-5" aria-label="Weight">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Weight</h2>
            <p className="serif num text-5xl">{(lastWeight?.kg ?? data.profile.weightKg).toFixed(1)}<span className="text-xl text-muted"> kg</span></p>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = parseFloat(w); if (n >= 30 && n <= 250) { logWeight(n); setW(""); toast("Weight saved"); } }}>
              <input className="field num" inputMode="decimal" placeholder={lastWeight?.date === today ? "Update today" : "Log today"} value={w} onChange={(e) => setW(e.target.value)} aria-label="Weight in kg" />
              <button className="press btn-ghost hov">Save</button>
            </form>
          </section>
          <section className="card p-5" aria-label="Water">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Water</h2>
            <p className="serif num text-5xl">{(day.waterMl / 1000).toFixed(2)}<span className="text-xl text-muted"> L</span></p>
            <div className="mt-2 flex gap-2">
              <button className="press btn-ghost hov flex-1" aria-label="Remove 250 ml" onClick={() => addWater(-250)}><Icon name="minus" size={18} className="mx-auto" /></button>
              <button className="press btn-ghost hov inline-flex flex-[2] items-center justify-center gap-2" onClick={() => addWater(250)}><Icon name="drop" size={18} /> 250 ml</button>
            </div>
          </section>
        </div>
        {!session && <p className="px-2 pb-4 text-center text-sm text-muted">Saved on this device.</p>}
      </div>
    </div>
  );
}

function Lines({ points, unit, color, decimals = 1 }: { points: { x: number; y: number; label: string }[]; unit: string; color: string; decimals?: number }) {
  if (points.length < 2) return <p className="text-sm text-muted">Log at least two {unit === "kg" ? "weigh-ins" : "readings"} to see a trend.</p>;
  const W = 600, H = 150, pad = 8;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const lo = Math.min(...ys), hi = Math.max(...ys), span = Math.max(0.5, hi - lo);
  const X = (x: number) => pad + ((x - x0) / Math.max(1, x1 - x0)) * (W - pad * 2);
  const Y = (y: number) => H - pad - ((y - lo) / span) * (H - pad * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(" ");
  const last = points[points.length - 1], first = points[0];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-36 w-full" role="img" aria-label={`${unit} from ${first.y.toFixed(decimals)} to ${last.y.toFixed(decimals)}`}>
        <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={X(last.x)} cy={Y(last.y)} r={5} fill={color} />
      </svg>
      <p className="num flex justify-between text-sm text-muted"><span>{first.label}: {first.y.toFixed(decimals)} {unit}</span><span>{last.label}: <b className="text-ink">{last.y.toFixed(decimals)} {unit}</b></span></p>
    </div>
  );
}

export function History() {
  const data = useData();
  const t = targetsFor(data.profile);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const k = dayKey(d);
    const kcal = (data.days[k]?.entries ?? []).reduce((s, e) => s + e.kcal, 0);
    return { k, kcal, label: d.toLocaleDateString("en-GB", { weekday: "narrow" }), today: i === 13 };
  });
  const max = Math.max(t.kcal * 1.25, ...days.map((d) => d.kcal));
  const logged = days.filter((d) => d.kcal > 0);
  const avg = logged.length ? logged.reduce((s, d) => s + d.kcal, 0) / logged.length : 0;
  const stamp = (s: string) => new Date(s).getTime() / 86400000;
  const short = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const wPts = data.weights.map((w) => ({ x: stamp(w.date), y: w.kg, label: short(w.date) }));
  const fPts = data.weights.filter((w) => w.bodyFat != null).map((w) => ({ x: stamp(w.date), y: w.bodyFat as number, label: short(w.date) }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="serif text-5xl">History</h1>
      <section className="card p-5" aria-label="Calories, last 14 days">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Calories, 14 days</h2>
        <p className="num mt-1 text-sm text-muted">{logged.length ? `Average ${fmt(avg)} kcal on ${logged.length} logged days · target ${fmt(t.kcal)}` : `Target ${fmt(t.kcal)} kcal. Log food to see your days.`}</p>
        <div className="relative mt-4 flex h-44 items-end gap-1.5">
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink/40" style={{ bottom: `${(t.kcal / max) * 100}%` }}><span className="num absolute -top-5 right-0 text-xs text-muted">target</span></div>
          {days.map((d) => (
            <div key={d.k} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.k}: ${d.kcal} kcal`}>
              <div className="w-full rounded-t-lg" style={{ height: `${(d.kcal / max) * 100}%`, minHeight: d.kcal ? 4 : 2, background: d.kcal > t.kcal * 1.05 ? "var(--accent)" : d.kcal ? "var(--fat)" : "var(--line)" }} />
              <span className={`text-[11px] ${d.today ? "font-bold text-ink" : "text-muted"}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card p-5" aria-label="Weight trend">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Weight</h2>
        <Lines points={wPts} unit="kg" color="var(--ink)" />
      </section>
      <section className="card p-5" aria-label="Body fat trend">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Body fat</h2>
        {fPts.length ? <Lines points={fPts} unit="%" color="var(--protein)" /> : <p className="text-sm text-muted">Import scale data (Targets → Scale data) to see body fat.</p>}
      </section>
    </div>
  );
}

export function Foods({ onPick, onAddOwn }: { onPick: (f: Food) => void; onAddOwn: () => void }) {
  const data = useData();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-end justify-between"><h1 className="serif text-5xl">Foods</h1>
        <button className="press btn-ghost hov inline-flex items-center gap-2" onClick={onAddOwn}><Icon name="plus" size={18} /> Your own</button></div>
      <div className="card p-4"><FoodSearch onPick={onPick} /></div>
      {data.custom.length > 0 && (
        <section className="card p-4"><h2 className="mb-1 px-3 text-sm font-semibold uppercase tracking-wider text-muted">Your foods</h2>
          <ul>{data.custom.map((f) => (
            <li key={f.id}><button className="press hov flex w-full items-center justify-between rounded-2xl px-3 text-left" onClick={() => onPick(f)}><span className="py-2"><span className="block font-medium">{f.name}</span><span className="num block text-sm text-muted">{f.per100.kcal} kcal per 100 g</span></span></button></li>
          ))}</ul></section>
      )}
    </div>
  );
}

export function Targets({ session, onSignIn, onPhoto }: { session: string | null; onSignIn: () => void; onPhoto: () => void }) {
  const { profile } = useData();
  const t = targetsFor(profile);
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="mx-auto max-w-3xl space-y-4 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-4">
        <h1 className="serif text-5xl">Targets</h1>
        <section className="card p-5"><h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Your numbers</h2><ProfileForm />
          <label className="mt-4 block"><span className="mb-1 block text-sm text-muted">Body fat % from a scale (optional)</span>
            <input className="field num" inputMode="decimal" placeholder="Estimated from BMI and age" value={profile.bodyFat ?? ""} onChange={(e) => { const n = parseFloat(e.target.value); setProfile({ bodyFat: Number.isFinite(n) && n > 3 && n < 60 ? n : null }); }} /></label></section>
        <section className="card p-5"><h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Daily target</h2>
          <p className="serif num text-5xl">{fmt(t.kcal)} <span className="text-xl text-muted">kcal</span></p>
          <p className="num text-sm text-muted">{t.protein} g protein · {t.fat} g fat · {t.carbs} g carbs</p></section>
        <section className="card space-y-4 p-5"><h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Figure</h2>
          <SkinPicker value={profile.skin} onChange={(skin) => setProfile({ skin })} />
          <ShapeSliders />
          <div className="flex flex-wrap gap-3"><button className="press btn-ghost hov inline-flex items-center gap-2" onClick={onPhoto}><Icon name="camera" size={19} /> Match a photo</button><ScaleImport /></div></section>
        <section className="card space-y-3 p-5"><h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Your data</h2>
          <div className="flex flex-wrap gap-3">
            <button className="press btn-ghost hov inline-flex items-center gap-2" onClick={() => {
              const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `fit-ninja-backup-${dayKey()}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}><Icon name="download" size={19} /> Back up</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try { const j = JSON.parse(await f.text()); if (!j.profile) throw new Error(); replaceAll(j, false); toast("Backup restored"); } catch { toast("That isn't a Fit Ninja backup"); }
            }} />
            <button className="press btn-ghost hov inline-flex items-center gap-2" onClick={() => file.current?.click()}><Icon name="upload" size={19} /> Restore</button>
            <button className="press btn-ghost hov text-accent" onClick={() => { if (confirm("Erase everything saved on this device?")) { resetAll(); toast("Data erased"); } }}>Erase data</button>
          </div></section>
        <section className="card p-5"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Account</h2>
          {session ? <><p className="mb-3 text-muted">Signed in as {session}. Your log syncs automatically.</p><button className="press btn-ghost hov" onClick={async () => { await signOut(); toast("Signed out"); }}>Sign out</button></>
            : <><p className="mb-3 text-muted">Saved on this device. An account keeps your log in sync across devices.</p><button className="press btn-ghost hov" onClick={onSignIn}>Sign in or create an account</button></>}
          <p className="mt-4 text-sm text-muted">No data is sold. Photos are read on this device and never uploaded.</p></section>
      </div>
      <div className="hidden lg:sticky lg:top-6 lg:block"><FigureCard className="h-[70dvh]" /></div>
    </div>
  );
}

