export type Sex = "female" | "male";
export type FigureSex = Sex | "neutral";
export type Skin = "light" | "medium" | "deep";
export type ActivityId = "sedentary" | "light" | "moderate" | "very" | "athlete";
export type GoalId = "lose" | "maintain" | "gain";
export type MealId = "breakfast" | "lunch" | "snack" | "dinner";
export type MacroKey = "carbs" | "protein" | "fat";

export interface Shape {
  shoulders: number;
  waist: number;
  hips: number;
  legs: number;
}

export interface Profile {
  sex: Sex;
  neutralFigure: boolean;
  skin: Skin;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFat: number | null;
  activity: ActivityId;
  goal: GoalId;
  shape: Shape;
}

export interface Per100 {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number | null;
  fibre: number | null;
  salt: number | null;
}

export interface Food {
  id: string;
  source: "generic" | "off" | "custom";
  name: string;
  brand: string;
  servingG: number;
  servingLabel: string;
  per100: Per100;
  barcode?: string;
}

export interface Entry {
  id: string;
  meal: MealId;
  foodId: string;
  name: string;
  brand: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  t: number;
}

export interface DayLog {
  entries: Entry[];
  waterMl: number;
}

export interface WeightPoint {
  date: string;
  kg: number;
  bodyFat?: number | null;
}

export interface AppData {
  version: 1;
  onboarded: boolean;
  profile: Profile;
  days: Record<string, DayLog>;
  weights: WeightPoint[];
  custom: Food[];
  recent: Food[];
  updatedAt: number;
}
