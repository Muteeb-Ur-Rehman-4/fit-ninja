import type { ActivityId, GoalId, MacroKey, Per100, Profile } from "./types";

export const ACTIVITY: { id: ActivityId; label: string; factor: number }[] = [
  { id: "sedentary", label: "Mostly sitting", factor: 1.2 },
  { id: "light", label: "1–3 sessions a week", factor: 1.375 },
  { id: "moderate", label: "3–5 sessions a week", factor: 1.55 },
  { id: "very", label: "6–7 sessions a week", factor: 1.725 },
  { id: "athlete", label: "Hard training every day", factor: 1.9 },
];

export const GOALS: Record<GoalId, { label: string; kcal: number; proteinPerKg: number; note: string }> = {
  lose: { label: "Lose", kcal: -400, proteinPerKg: 2.0, note: "−400 kcal a day, about 0.35 kg a week" },
  maintain: { label: "Maintain", kcal: 0, proteinPerKg: 1.6, note: "Eat what you burn" },
  gain: { label: "Gain", kcal: 250, proteinPerKg: 1.8, note: "+250 kcal a day, a slow lean gain" },
};

const FAT_SHARE = 0.25;
const KCAL_FLOOR = { female: 1200, male: 1500 };

export const MACROS: { key: MacroKey; label: string; kcalPerG: number; color: string; wall: string }[] = [
  // Order is the order the figure fills, feet up.
  { key: "carbs", label: "Carbs", kcalPerG: 4, color: "#f0b04a", wall: "#c98a22" },
  { key: "protein", label: "Protein", kcalPerG: 4, color: "#e0553a", wall: "#b23a22" },
  { key: "fat", label: "Fat", kcalPerG: 9, color: "#3d7a5b", wall: "#285742" },
];

export function activityOf(id: ActivityId) {
  return ACTIVITY.find((a) => a.id === id) ?? ACTIVITY[2];
}

export function bmr(p: Pick<Profile, "sex" | "weightKg" | "heightCm" | "age">) {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "female" ? -161 : 5);
}

export interface Targets {
  bmr: number;
  tdee: number;
  factor: number;
  adjust: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  proteinPerKg: number;
  share: Record<MacroKey, number>;
}

export function targetsFor(profile: Profile): Targets {
  const goal = GOALS[profile.goal] ?? GOALS.maintain;
  const factor = activityOf(profile.activity).factor;
  const resting = bmr(profile);
  const tdee = resting * factor;
  const floor = KCAL_FLOOR[profile.sex] ?? 1200;
  const kcal = Math.max(Math.round(tdee + goal.kcal), Math.min(floor, Math.round(tdee)));
  const protein = Math.round(profile.weightKg * goal.proteinPerKg);
  const fat = Math.round((kcal * FAT_SHARE) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return {
    bmr: Math.round(resting),
    tdee: Math.round(tdee),
    factor,
    adjust: kcal - Math.round(tdee),
    kcal,
    protein,
    fat,
    carbs,
    proteinPerKg: goal.proteinPerKg,
    share: {
      protein: (protein * 4) / kcal,
      fat: (fat * 9) / kcal,
      carbs: (carbs * 4) / kcal,
    },
  };
}

export interface Totals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function totals(entries: Totals[]): Totals {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const e of entries) {
    t.kcal += e.kcal;
    t.protein += e.protein;
    t.carbs += e.carbs;
    t.fat += e.fat;
  }
  return t;
}

export function forGrams(per100: Per100, grams: number) {
  const k = grams / 100;
  const r = (v: number | null, d = 1) => (v == null ? null : Math.round(v * k * 10 ** d) / 10 ** d);
  return {
    kcal: Math.round((per100.kcal || 0) * k),
    protein: r(per100.protein) || 0,
    carbs: r(per100.carbs) || 0,
    fat: r(per100.fat) || 0,
    sugars: r(per100.sugars),
    fibre: r(per100.fibre),
    salt: r(per100.salt, 2),
  };
}

/** Fill fractions (of full height) per band: the eaten share of the target, split by calories. */
export function fillFractions(eaten: Totals, target: number): Record<MacroKey, number> {
  const mk = { carbs: eaten.carbs * 4, protein: eaten.protein * 4, fat: eaten.fat * 9 };
  const sum = mk.carbs + mk.protein + mk.fat;
  const filled = Math.min(1, target > 0 ? eaten.kcal / target : 0);
  return {
    carbs: sum > 0 ? (filled * mk.carbs) / sum : 0,
    protein: sum > 0 ? (filled * mk.protein) / sum : 0,
    fat: sum > 0 ? (filled * mk.fat) / sum : 0,
  };
}

export function targetFractions(t: Targets): Record<MacroKey, number> {
  return { carbs: t.share.carbs, protein: t.share.protein, fat: t.share.fat };
}
