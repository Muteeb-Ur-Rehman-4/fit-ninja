"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

// ---- icons -----------------------------------------------------------------
const PATHS: Record<string, ReactNode> = {
  today: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  history: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
  foods: <><path d="M6 3v8a3 3 0 0 0 3 3v7M9 3v6M12 3v8a3 3 0 0 1-3 3M18 3c-2 2-3 5-3 8h3v10" /></>,
  targets: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 8v8M10 8v8M13 8v8M17 8v8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="M15 5l-7 7 7 7" />,
  check: <path d="M5 12l5 5 9-10" />,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  trash: <><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></>,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  scale: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8 9a5 5 0 0 1 8 0l-2 2h-4z" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
  upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
  download: <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />,
};

export function Icon({ name, size = 22, className }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      {PATHS[name]}
    </svg>
  );
}

// ---- toast -----------------------------------------------------------------
interface ToastMsg { id: number; text: string; undo?: () => void }
let toastState: ToastMsg | null = null;
const toastListeners = new Set<() => void>();
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string, undo?: () => void) {
  toastState = { id: Date.now(), text, undo };
  toastListeners.forEach((l) => l());
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastState = null;
    toastListeners.forEach((l) => l());
  }, 5000);
}

export function Toaster() {
  const t = useSyncExternalStore(
    (l) => { toastListeners.add(l); return () => { toastListeners.delete(l); }; },
    () => toastState,
    () => null,
  );
  if (!t) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-8" role="status" aria-live="polite">
      <div key={t.id} className="rise pointer-events-auto flex items-center gap-3 rounded-full bg-[#14201a] py-2 pl-5 pr-2 text-sm text-[#eef2ea] shadow-lg">
        <span>{t.text}</span>
        {t.undo && (
          <button
            className="press rounded-full px-4 font-semibold text-[#f0b04a]"
            onClick={() => { t.undo?.(); toastState = null; toastListeners.forEach((l) => l()); }}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

// ---- inputs ----------------------------------------------------------------
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full border border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`press flex-1 rounded-full px-3 text-[15px] font-medium ${value === o.id ? "bg-accent text-accent-ink" : "hov"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function NumField({ label, value, onChange, unit, min, max, step = 1 }: { label: string; value: number; onChange: (n: number) => void; unit: string; min: number; max: number; step?: number }) {
  // while typing the draft wins; otherwise show the value (which may change elsewhere)
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? String(value);
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <span className="relative block">
        <input
          className="field num pr-12"
          inputMode="decimal"
          type="number"
          min={min}
          max={max}
          step={step}
          value={text}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = parseFloat(e.target.value);
            if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
          onBlur={() => setDraft(null)}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
      </span>
    </label>
  );
}

export function Stepper({ value, onChange, step, min = 0, max = 5000, unit }: { value: number; onChange: (n: number) => void; step: number; min?: number; max?: number; unit: string }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex items-center gap-2">
      <button aria-label={`Less, ${step} ${unit}`} className="press btn-ghost grid w-12 place-items-center px-0" onClick={() => onChange(clamp(value - step))}>
        <Icon name="minus" />
      </button>
      <label className="relative flex-1">
        <input className="field num text-center text-xl" type="number" inputMode="decimal" value={value} min={min} max={max} onChange={(e) => onChange(clamp(parseFloat(e.target.value) || 0))} aria-label={`Amount in ${unit}`} />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
      </label>
      <button aria-label={`More, ${step} ${unit}`} className="press btn-ghost grid w-12 place-items-center px-0" onClick={() => onChange(clamp(value + step))}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

export function Sheet({ title, onClose, children, dark }: { title: string; onClose: () => void; children: ReactNode; dark?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className={`fixed inset-0 z-40 flex items-end justify-center bg-black/50 lg:items-center ${dark ? "theme-dark" : ""}`} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="sheet-in max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-bg p-5 text-ink lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="serif text-3xl">{title}</h2>
          <button aria-label="Close" className="press grid w-11 place-items-center rounded-full" onClick={onClose}><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-GB");
