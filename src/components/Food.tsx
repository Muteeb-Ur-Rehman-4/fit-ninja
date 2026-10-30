"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Sheet, Stepper, fmt, toast } from "./ui";
import { addToOffUrl, lookupBarcode, searchPackaged, SEARCH_PROXY } from "@/lib/off";
import { makeDetector, readBarcodeFromFile } from "@/lib/barcode";
import { searchGeneric } from "@/lib/foods";
import { forGrams } from "@/lib/nutrition";
import { addEntry, saveCustomFood, useData, useToday } from "@/lib/store";
import type { Food, MealId } from "@/lib/types";

export const MEALS: { id: MealId; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "snack", label: "Snack" },
  { id: "dinner", label: "Dinner" },
];

export function mealNow(): MealId {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 15 ? "lunch" : h < 17 ? "snack" : h < 22 ? "dinner" : "snack";
}

const BAND = { carbs: "var(--carbs)", protein: "var(--protein)", fat: "var(--fat)" } as const;

export function FoodRow({ food, onPick }: { food: Food; onPick: (f: Food) => void }) {
  return (
    <li>
      <button className="press hov flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left" onClick={() => onPick(food)}>
        <span className="min-w-0">
          <span className="block truncate font-medium">{food.name}</span>
          <span className="block truncate text-sm text-muted">{food.brand || "Your food"} · {food.servingLabel}</span>
        </span>
        <span className="num shrink-0 text-right text-sm text-muted"><b className="text-base text-ink">{Math.round(food.per100.kcal * food.servingG / 100)}</b> kcal</span>
      </button>
    </li>
  );
}

export function FoodSearch({ onPick, autoFocus }: { onPick: (f: Food) => void; autoFocus?: boolean }) {
  const data = useData();
  const [q, setQ] = useState("");
  const [packaged, setPackaged] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!SEARCH_PROXY || q.trim().length < 2) return;
    const t = setTimeout(async () => {
      setLoading(true);
      setPackaged(await searchPackaged(q));
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const mine = data.custom.filter((f) => words.every((w) => f.name.toLowerCase().includes(w)));
  const everyday = searchGeneric(q);
  const shownPackaged = q.trim().length >= 2 ? packaged : [];

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search foods</span>
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
        <input className="field pl-11" type="search" placeholder="Search everyday foods and your own" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} />
      </label>
      {!q.trim() ? (
        data.recent.length > 0 && (
          <>
            <h3 className="mb-1 mt-4 px-3 text-sm font-semibold uppercase tracking-wider text-muted">Recent</h3>
            <ul>{data.recent.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul>
          </>
        )
      ) : (
        <div className="mt-3">
          {mine.length > 0 && <><h3 className="px-3 text-sm font-semibold uppercase tracking-wider text-muted">Your foods</h3><ul>{mine.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul></>}
          {everyday.length > 0 && <><h3 className="mt-2 px-3 text-sm font-semibold uppercase tracking-wider text-muted">Everyday</h3><ul>{everyday.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul></>}
          {shownPackaged.length > 0 && <><h3 className="mt-2 px-3 text-sm font-semibold uppercase tracking-wider text-muted">Packaged</h3><ul>{shownPackaged.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}</ul></>}
          {loading && <p className="px-3 py-2 text-sm text-muted">Searching packaged foods…</p>}
          {!mine.length && !everyday.length && !shownPackaged.length && !loading && (
            <p className="px-3 py-4 text-muted">
              Nothing for “{q}”. {SEARCH_PROXY ? "" : "Packaged foods are found by scanning the barcode. "}You can add it yourself below.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Product page: grams stepper, meal chips, "fits today", Add. */
export function ProductSheet({ food, onClose, onAdded }: { food: Food; onClose: () => void; onAdded: () => void }) {
  const [grams, setGrams] = useState(Math.round(food.servingG));
  const [meal, setMeal] = useState<MealId>(mealNow());
  const { targets, eaten } = useToday();
  const v = forGrams(food.per100, grams);
  const left = targets.kcal - eaten.kcal;
  const after = left - v.kcal;
  const serving = Math.round(food.servingG);

  return (
    <Sheet title={food.name} onClose={onClose}>
      <p className="-mt-3 mb-4 text-muted">{food.brand || "Your food"} · serving {food.servingLabel}{food.servingLabel !== `${serving} g` ? ` (${serving} g)` : ""}</p>
      <div className="card p-4">
        <p className="serif num text-6xl leading-none">{fmt(v.kcal)} <span className="text-2xl text-muted">kcal</span></p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
          {([["carbs", "Carbs", v.carbs], ["protein", "Protein", v.protein], ["fat", "Fat", v.fat]] as const).map(([k, l, g]) => (
            <div key={k} className="rounded-xl bg-surface-2 p-2">
              <dt className="flex items-center gap-1.5 text-muted"><i className="size-2.5 rounded-full" style={{ background: BAND[k] }} />{l}</dt>
              <dd className="serif num text-3xl">{g}<span className="text-base text-muted"> g</span></dd>
            </div>
          ))}
        </dl>
        {(v.sugars != null || v.fibre != null || v.salt != null) && (
          <p className="num mt-3 text-sm text-muted">
            {[v.sugars != null && `Sugars ${v.sugars} g`, v.fibre != null && `Fibre ${v.fibre} g`, v.salt != null && `Salt ${v.salt} g`].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <p className="mb-1 mt-4 text-sm text-muted">Amount</p>
      <Stepper value={grams} onChange={setGrams} step={10} min={1} max={3000} unit="g" />
      {serving !== 100 && (
        <div className="mt-2 flex gap-2">
          <button className="press btn-ghost hov text-sm" onClick={() => setGrams(serving)}>1 serving</button>
          <button className="press btn-ghost hov text-sm" onClick={() => setGrams(100)}>100 g</button>
        </div>
      )}
      <p className="mb-2 mt-4 text-sm text-muted">Meal</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Meal">
        {MEALS.map((m) => (
          <button key={m.id} role="radio" aria-checked={meal === m.id} className={`press rounded-full px-4 font-medium ${meal === m.id ? "bg-ink text-bg" : "btn-ghost hov"}`} onClick={() => setMeal(m.id)}>{m.label}</button>
        ))}
      </div>
      <p className={`num mt-4 text-[15px] ${after < 0 ? "text-accent" : "text-muted"}`} aria-live="polite">
        {after >= 0 ? `Fits today: leaves ${fmt(after)} kcal.` : `${fmt(-after)} kcal over today's target.`}
      </p>
      <button className="press btn-primary hov-accent mt-3 w-full text-lg" onClick={() => {
        addEntry(food, grams, meal);
        toast(`Added ${food.name}`);
        onAdded();
      }}>Add to {MEALS.find((m) => m.id === meal)!.label.toLowerCase()}</button>
    </Sheet>
  );
}

/** Enter a food yourself, from a barcode that wasn't found or from scratch. */
export function ManualSheet({ code, onClose, onSaved }: { code?: string; onClose: () => void; onSaved: (f: Food) => void }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [basis, setBasis] = useState<"100" | "serving">("100");
  const [servingG, setServingG] = useState(100);
  const [n, setN] = useState({ kcal: "", protein: "", carbs: "", fat: "" });
  const num = (s: string) => Math.max(0, parseFloat(s) || 0);
  const ok = name.trim() && n.kcal !== "";

  function save() {
    const k = basis === "100" ? 1 : 100 / Math.max(1, servingG);
    const food: Food = {
      id: `custom:${Date.now().toString(36)}`,
      source: "custom",
      name: name.trim(),
      brand: brand.trim(),
      servingG: basis === "100" ? 100 : servingG,
      servingLabel: basis === "100" ? "100 g" : `${servingG} g`,
      per100: { kcal: Math.round(num(n.kcal) * k), protein: +(num(n.protein) * k).toFixed(1), carbs: +(num(n.carbs) * k).toFixed(1), fat: +(num(n.fat) * k).toFixed(1), sugars: null, fibre: null, salt: null },
      barcode: code,
    };
    saveCustomFood(food);
    onSaved(food);
  }

  const field = (key: keyof typeof n, label: string) => (
    <label className="block"><span className="mb-1 block text-sm text-muted">{label}</span>
      <input className="field num" inputMode="decimal" type="number" min={0} value={n[key]} onChange={(e) => setN({ ...n, [key]: e.target.value })} /></label>
  );

  return (
    <Sheet title={code ? "Enter it yourself" : "Add your own food"} onClose={onClose}>
      {code && (
        <p className="-mt-2 mb-4 text-muted">
          We couldn&apos;t find {code} in Open Food Facts. Enter it here, and consider{" "}
          <a className="underline underline-offset-4" href={addToOffUrl(code)} target="_blank" rel="noreferrer">adding it to Open Food Facts</a> so everyone can scan it.
        </p>
      )}
      <div className="space-y-3">
        <label className="block"><span className="mb-1 block text-sm text-muted">Name</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block"><span className="mb-1 block text-sm text-muted">Brand (optional)</span><input className="field" value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
        <div className="flex gap-2" role="radiogroup" aria-label="Values are per">
          {([["100", "Per 100 g"], ["serving", "Per serving"]] as const).map(([id, l]) => (
            <button key={id} role="radio" aria-checked={basis === id} className={`press rounded-full px-4 font-medium ${basis === id ? "bg-ink text-bg" : "btn-ghost hov"}`} onClick={() => setBasis(id)}>{l}</button>
          ))}
        </div>
        {basis === "serving" && <label className="block"><span className="mb-1 block text-sm text-muted">Serving size (g)</span><input className="field num" type="number" min={1} value={servingG} onChange={(e) => setServingG(Math.max(1, parseFloat(e.target.value) || 1))} /></label>}
        <div className="grid grid-cols-2 gap-3">{field("kcal", "Calories (kcal)")}{field("protein", "Protein (g)")}{field("carbs", "Carbs (g)")}{field("fat", "Fat (g)")}</div>
      </div>
      <button className="press btn-primary hov-accent mt-5 w-full text-lg" disabled={!ok} onClick={save}>Save and continue</button>
    </Sheet>
  );
}

/** Camera scanner with BarcodeDetector, ZXing fallback, typed number and photo fallbacks. */
export function ScanSheet({ onClose, onCode }: { onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Starting the camera…");
  const [camOk, setCamOk] = useState(false);
  const [typed, setTyped] = useState("");
  const photo = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  const found = useMemo(
    () => (code: string) => {
      if (done.current) return;
      done.current = true;
      navigator.vibrate?.(30);
      onCode(code);
    },
    [onCode],
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;
    let zx: { stop: () => void } | null = null;
    let raf = 0;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setStatus("This browser can't open the camera. Type the number or use a photo.");
      try {
        const det = await makeDetector();
        if (det) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
          if (stop) return stream.getTracks().forEach((t) => t.stop());
          const v = video.current!;
          v.srcObject = stream;
          await v.play();
          setCamOk(true);
          setStatus("Point at the barcode");
          let last = 0;
          const tick = async (now: number) => {
            if (stop) return;
            if (now - last > 160 && v.readyState >= 2) {
              last = now;
              try {
                const r = await det.detect(v);
                if (r[0]?.rawValue) return found(r[0].rawValue);
              } catch { /* frame not ready */ }
            }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, video.current!, (res) => {
            if (res) found(res.getText());
          });
          if (stop) controls.stop();
          else { zx = controls; setCamOk(true); setStatus("Point at the barcode"); }
        }
      } catch {
        setStatus("Camera isn't available or was blocked. Type the number or use a photo.");
      }
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      zx?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [found]);

  return (
    <div className="theme-dark fixed inset-0 z-40 flex flex-col bg-black text-ink">
      <div className="safe-t flex items-center justify-between px-4 pb-2">
        <h2 className="serif text-3xl">Scan a barcode</h2>
        <button aria-label="Close scanner" className="press grid w-11 place-items-center rounded-full" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="relative mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-hidden bg-[#0e1511]">
        <video ref={video} className={`h-full w-full object-cover ${camOk ? "" : "opacity-0"}`} playsInline muted />
        {camOk && <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-[28%] -translate-y-1/2 rounded-2xl border-2 border-[#f0b04a]/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />}
        <p className="absolute inset-x-0 bottom-4 px-6 text-center text-sm text-white/90" role="status">{status}</p>
      </div>
      <div className="safe-b mx-auto w-full max-w-2xl space-y-3 px-4 pt-4">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) found(typed.trim()); }}>
          <input className="field num" inputMode="numeric" placeholder="Type the number under the bars" value={typed} onChange={(e) => setTyped(e.target.value.replace(/[^\d]/g, ""))} aria-label="Barcode number" />
          <button className="press btn-primary hov-accent" disabled={typed.length < 6}>Find</button>
        </form>
        <input ref={photo} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setStatus("Reading the photo…");
          const c = await readBarcodeFromFile(f);
          if (c) found(c); else setStatus("No barcode found in that photo. Try closer, or type the number.");
        }} />
        <button className="press btn-ghost hov inline-flex w-full items-center justify-center gap-2" onClick={() => photo.current?.click()}><Icon name="camera" size={20} /> Photo of the barcode</button>
      </div>
    </div>
  );
}

export async function resolveCode(code: string) {
  return lookupBarcode(code);
}
