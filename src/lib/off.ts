import type { Food, Per100 } from "./types";

const FIELDS = "code,product_name,brands,serving_size,serving_quantity,quantity,nutriments";

type Nutriments = Record<string, number | string | undefined>;

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Per-100 g values; kcal from energy-kcal_100g or kJ / 4.184. */
export function per100Of(n: Nutriments): Per100 | null {
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal == null) {
    const kj = num(n["energy_100g"]) ?? num(n["energy-kj_100g"]);
    if (kj != null) kcal = kj / 4.184;
  }
  if (kcal == null) return null;
  return {
    kcal: Math.round(kcal),
    protein: num(n["proteins_100g"]) ?? 0,
    carbs: num(n["carbohydrates_100g"]) ?? 0,
    fat: num(n["fat_100g"]) ?? 0,
    sugars: num(n["sugars_100g"]),
    fibre: num(n["fiber_100g"]),
    salt: num(n["salt_100g"]),
  };
}

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Nutriments;
}

export function foodFromProduct(p: OffProduct, code?: string): Food | null {
  const per100 = per100Of(p.nutriments ?? {});
  if (!per100) return null;
  const sq = num(p.serving_quantity);
  const servingG = sq && sq > 0 ? sq : 100;
  const barcode = p.code || code || "";
  return {
    id: `off:${barcode || p.product_name}`,
    source: "off",
    name: p.product_name?.trim() || "Unnamed product",
    brand: p.brands?.split(",")[0]?.trim() || "",
    servingG,
    servingLabel: sq && p.serving_size ? p.serving_size : "100 g",
    per100,
    barcode,
  };
}

export type Lookup = { status: "found"; food: Food } | { status: "missing" } | { status: "error" };

export async function lookupBarcode(code: string): Promise<Lookup> {
  const clean = code.replace(/\D/g, "");
  if (clean.length < 6) return { status: "missing" };
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${FIELDS}`);
    if (r.status === 404) return { status: "missing" };
    if (!r.ok) return { status: "error" };
    const j = await r.json();
    if (j.status !== 1 || !j.product) return { status: "missing" };
    const food = foodFromProduct(j.product, clean);
    return food ? { status: "found", food } : { status: "missing" };
  } catch {
    return { status: "error" };
  }
}

/** Name search needs the optional proxy, since Open Food Facts blocks browser CORS on text search. */
export const SEARCH_PROXY = process.env.NEXT_PUBLIC_OFF_SEARCH_PROXY || "";

export async function searchPackaged(q: string): Promise<Food[]> {
  if (!SEARCH_PROXY || q.trim().length < 2) return [];
  try {
    const r = await fetch(`${SEARCH_PROXY}?q=${encodeURIComponent(q.trim())}`);
    if (!r.ok) return [];
    const j = await r.json();
    return ((j.products ?? []) as OffProduct[]).map((p) => foodFromProduct(p)).filter((f): f is Food => !!f);
  } catch {
    return [];
  }
}

export const addToOffUrl = (code: string) =>
  `https://world.openfoodfacts.org/cgi/product.pl?type=product&code=${encodeURIComponent(code)}`;
