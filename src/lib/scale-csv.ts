import type { WeightPoint } from "./types";

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim().replace(/^"|"$/g, ""));
}

function dateOf(s: string): string | null {
  const iso = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Renpho (and similar) CSV export: date, weight and body fat columns, found by header name. */
export function parseScaleCsv(text: string): WeightPoint[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = splitLine(lines[0]).map((h) => h.toLowerCase());
  const iDate = head.findIndex((h) => /time|date/.test(h));
  const iW = head.findIndex((h) => /weight/.test(h));
  const iFat = head.findIndex((h) => /body\s*fat/.test(h));
  if (iDate < 0 || iW < 0) return [];
  const lb = /lb/.test(head[iW]);
  const byDay = new Map<string, WeightPoint>();
  for (const line of lines.slice(1)) {
    const c = splitLine(line);
    const date = dateOf(c[iDate] ?? "");
    let kg = parseFloat(c[iW]);
    if (!date || !Number.isFinite(kg) || kg <= 0) continue;
    if (lb) kg *= 0.45359237;
    const bf = iFat >= 0 ? parseFloat(c[iFat]) : NaN;
    // later rows in the same day overwrite earlier ones; exports are usually newest first, so keep the first seen
    if (!byDay.has(date)) byDay.set(date, { date, kg: Math.round(kg * 10) / 10, bodyFat: Number.isFinite(bf) && bf > 0 && bf < 70 ? bf : null });
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}
