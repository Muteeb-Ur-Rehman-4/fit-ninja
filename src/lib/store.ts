"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { forGrams, targetsFor, totals, fillFractions } from "./nutrition";
import type { AppData, DayLog, Entry, Food, MealId, Profile, WeightPoint } from "./types";

const KEY = "fitninja:v1";

export const DEFAULT_PROFILE: Profile = {
  sex: "male",
  neutralFigure: false,
  skin: "light",
  age: 29,
  heightCm: 178,
  weightKg: 74,
  bodyFat: null,
  activity: "moderate",
  goal: "lose",
  shape: { shoulders: 0, waist: 0, hips: 0, legs: 0 },
};

export const emptyData = (): AppData => ({
  version: 1,
  onboarded: false,
  profile: DEFAULT_PROFILE,
  days: {},
  weights: [],
  custom: [],
  recent: [],
  updatedAt: 0,
});

export const dayKey = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function normalise(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<AppData>;
  return {
    ...base,
    ...r,
    version: 1,
    profile: { ...DEFAULT_PROFILE, ...(r.profile ?? {}), shape: { ...DEFAULT_PROFILE.shape, ...(r.profile?.shape ?? {}) } },
    days: r.days ?? {},
    weights: r.weights ?? [],
    custom: r.custom ?? [],
    recent: r.recent ?? [],
  };
}

let state: AppData = emptyData();
let loaded = false;
const listeners = new Set<() => void>();
const changeHooks = new Set<(d: AppData) => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const s = localStorage.getItem(KEY);
    if (s) state = normalise(JSON.parse(s));
  } catch {
    /* storage blocked: stay in memory */
  }
}

function emit(local = true) {
  if (local) state = { ...state, updatedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked */
  }
  listeners.forEach((l) => l());
  if (local) changeHooks.forEach((h) => h(state));
}

export function update(fn: (d: AppData) => AppData) {
  load();
  state = fn(state);
  emit();
}

/** Replace everything (restore or cloud pull) without marking a fresh local edit. */
export function replaceAll(next: unknown, keepStamp = true) {
  load();
  const n = normalise(next);
  state = keepStamp ? n : { ...n, updatedAt: Date.now() };
  emit(!keepStamp);
}

export function onChange(h: (d: AppData) => void) {
  changeHooks.add(h);
  return () => { changeHooks.delete(h); };
}

export const getState = () => {
  load();
  return state;
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

const SERVER = emptyData();
export function useData(): AppData {
  return useSyncExternalStore(subscribe, getState, () => SERVER);
}

/** False on the server and on the first client render, so persisted state doesn't cause hydration mismatches. */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// ---- actions ---------------------------------------------------------------
let seq = 0;
const uid = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const dayOf = (d: AppData, date: string): DayLog => d.days[date] ?? { entries: [], waterMl: 0 };

export function setProfile(patch: Partial<Profile>) {
  update((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
}

export function finishOnboarding() {
  update((d) => {
    const today = dayKey();
    const weights = d.weights.some((w) => w.date === today) ? d.weights : [...d.weights, { date: today, kg: d.profile.weightKg, bodyFat: d.profile.bodyFat }];
    return { ...d, onboarded: true, weights };
  });
}

export function addEntry(food: Food, grams: number, meal: MealId, date = dayKey()): Entry {
  const v = forGrams(food.per100, grams);
  const entry: Entry = {
    id: uid(), meal, foodId: food.id, name: food.name, brand: food.brand, grams,
    kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, t: Date.now(),
  };
  update((d) => {
    const day = dayOf(d, date);
    const recent = [food, ...d.recent.filter((f) => f.id !== food.id)].slice(0, 12);
    return { ...d, days: { ...d.days, [date]: { ...day, entries: [...day.entries, entry] } }, recent };
  });
  return entry;
}

export function removeEntry(id: string, date = dayKey()) {
  update((d) => {
    const day = dayOf(d, date);
    return { ...d, days: { ...d.days, [date]: { ...day, entries: day.entries.filter((e) => e.id !== id) } } };
  });
}

export function restoreEntry(entry: Entry, date = dayKey()) {
  update((d) => {
    const day = dayOf(d, date);
    if (day.entries.some((e) => e.id === entry.id)) return d;
    return { ...d, days: { ...d.days, [date]: { ...day, entries: [...day.entries, entry].sort((a, b) => a.t - b.t) } } };
  });
}

export function addWater(ml: number, date = dayKey()) {
  update((d) => {
    const day = dayOf(d, date);
    return { ...d, days: { ...d.days, [date]: { ...day, waterMl: Math.max(0, day.waterMl + ml) } } };
  });
}

export function logWeight(kg: number, bodyFat?: number | null, date = dayKey()) {
  update((d) => {
    const rest = d.weights.filter((w) => w.date !== date);
    const point: WeightPoint = { date, kg, bodyFat: bodyFat ?? null };
    const weights = [...rest, point].sort((a, b) => a.date.localeCompare(b.date));
    const latest = weights[weights.length - 1];
    return { ...d, weights, profile: latest.date === date ? { ...d.profile, weightKg: kg, bodyFat: bodyFat ?? d.profile.bodyFat } : d.profile };
  });
}

export function importWeights(points: WeightPoint[]) {
  update((d) => {
    const map = new Map(d.weights.map((w) => [w.date, w]));
    for (const p of points) map.set(p.date, p);
    const weights = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    const latest = weights[weights.length - 1];
    return latest
      ? { ...d, weights, profile: { ...d.profile, weightKg: latest.kg, bodyFat: latest.bodyFat ?? d.profile.bodyFat } }
      : { ...d, weights };
  });
}

export function saveCustomFood(food: Food) {
  update((d) => ({ ...d, custom: [food, ...d.custom.filter((f) => f.id !== food.id)] }));
}

export function deleteCustomFood(id: string) {
  update((d) => ({ ...d, custom: d.custom.filter((f) => f.id !== id) }));
}

export function resetAll() {
  replaceAll(emptyData(), false);
}

// ---- derived ---------------------------------------------------------------
export function useToday(date = dayKey()) {
  const data = useData();
  return useMemo(() => {
    const day = data.days[date] ?? { entries: [], waterMl: 0 };
    const targets = targetsFor(data.profile);
    const eaten = totals(day.entries);
    return { day, targets, eaten, fill: fillFractions(eaten, targets.kcal) };
  }, [data, date]);
}

/** Debounced callback on every local change (used for cloud sync). */
export function useChangeHook(fn: (d: AppData) => void, delay = 1500) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  const wrap = useCallback((d: AppData) => ref.current(d), []);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onChange((d) => {
      clearTimeout(t);
      t = setTimeout(() => wrap(d), delay);
    });
    return () => { off(); clearTimeout(t); };
  }, [wrap, delay]);
}
