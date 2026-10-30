// Realistic figure: MakeHuman base mesh (CC0) blended by the official targets for sex,
// muscle and weight, with CC0 skins/clothes/hair fitted to the morphed body.
import * as THREE from "three";
import type { FigureSex, MacroKey, Shape } from "../types";

export const COLORS: Record<MacroKey, number> = { carbs: 0xf0b04a, protein: 0xe0553a, fat: 0x3d7a5b };
export const ORDER: MacroKey[] = ["carbs", "protein", "fat"];

export interface BodyInput {
  sex: FigureSex;
  heightCm: number;
  weightKg: number;
  age: number;
  bodyFat?: number | null;
  shape?: Partial<Shape>;
}

export const DEFAULTS: Record<FigureSex, BodyInput> = {
  male: { sex: "male", heightCm: 178, weightKg: 74, age: 29 },
  female: { sex: "female", heightCm: 165, weightKg: 62, age: 29 },
  neutral: { sex: "neutral", heightCm: 172, weightKg: 68, age: 29 },
};

const OUTFIT: Record<FigureSex, string[]> = {
  male: ["outfit-male", "hair-male", "shoes", "brows", "lashes", "eyes"],
  female: ["outfit-female", "hair-female", "shoes", "brows", "lashes", "eyes"],
  neutral: ["outfit-male", "hair-male", "shoes", "brows", "lashes", "eyes"],
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface Build {
  muscle: number;
  fat: number;
  bmi: number;
  male: number;
  scale: number;
  bf: number;
  ffmi: number;
}

/** Muscle and fat on a 0–1 scale from body numbers (FFMI and body fat). */
export function buildOf(b: Pick<BodyInput, "sex" | "heightCm" | "weightKg" | "age" | "bodyFat">): Build {
  const h = b.heightCm / 100;
  const bmi = b.weightKg / (h * h);
  const male = b.sex === "male" ? 1 : b.sex === "female" ? 0 : 0.5;
  const bf = b.bodyFat != null ? b.bodyFat : 1.2 * bmi + 0.23 * (b.age || 30) - 10.8 * male - 5.4; // Deurenberg
  const lean = b.weightKg * (1 - bf / 100);
  const ffmi = lean / (h * h);
  const ffmiBase = 14 + 3 * male;
  const bfLow = 16 - 8 * male;
  return {
    muscle: clamp((ffmi - ffmiBase) / 6.5, 0, 1),
    fat: clamp((bf - bfLow) / 26, 0, 1),
    bmi,
    male,
    scale: h / 1.76,
    bf,
    ffmi,
  };
}

// ---- data ------------------------------------------------------------------
interface RawTarget { i: string; d: string }
interface RawHuman {
  nv: number;
  scale: number;
  base: string;
  body: { map: string; uv: string; tris: string };
  targets: Record<string, RawTarget>;
}
interface RawItem {
  kind: "cloth" | "hair" | "eyes";
  n: number;
  scale: Partial<Record<"x" | "y" | "z", [number, number, number]>>;
  tex: string | null;
  normal: string | null;
  refs: string; w: string; off: string; del: string; map: string; uv: string; tris: string;
}
interface RawLook { items: Record<string, RawItem>; skins: Record<string, string> }

function decode<T extends Float32Array | Uint16Array | Int16Array>(s: string, Arr: new (b: ArrayBuffer) => T): T {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Arr(u8.buffer);
}

interface Human {
  nv: number;
  scale: number;
  base: Float32Array;
  body: { map: Uint16Array; uv: Float32Array; tris: Uint16Array };
  t: Record<string, { i: Uint16Array; d: Int16Array }>;
}
interface Item {
  kind: RawItem["kind"];
  n: number;
  scale: RawItem["scale"];
  tex: string | null;
  normal: string | null;
  refs: Uint16Array; w: Float32Array; off: Float32Array; del: Uint16Array; map: Uint16Array; uv: Float32Array; tris: Uint16Array;
}
export interface FigureData { human: Human; items: Record<string, Item>; skins: Record<string, string> }

let dataPromise: Promise<FigureData> | null = null;

/** Loads the ~8 MB body and look assets once (the service worker caches them). */
export function loadFigureData(): Promise<FigureData> {
  dataPromise ??= (async () => {
    const [h, l] = await Promise.all([
      fetch("/assets/human.json").then((r) => r.json() as Promise<RawHuman>),
      fetch("/assets/human-look.json").then((r) => r.json() as Promise<RawLook>),
    ]);
    const human: Human = {
      nv: h.nv,
      scale: h.scale,
      base: decode(h.base, Float32Array),
      body: { map: decode(h.body.map, Uint16Array), uv: decode(h.body.uv, Float32Array), tris: decode(h.body.tris, Uint16Array) },
      t: {},
    };
    for (const k of Object.keys(h.targets)) human.t[k] = { i: decode(h.targets[k].i, Uint16Array), d: decode(h.targets[k].d, Int16Array) };
    const items: Record<string, Item> = {};
    for (const [name, it] of Object.entries(l.items)) {
      items[name] = {
        kind: it.kind, n: it.n, scale: it.scale, tex: it.tex, normal: it.normal,
        refs: decode(it.refs, Uint16Array), w: decode(it.w, Float32Array), off: decode(it.off, Float32Array),
        del: decode(it.del, Uint16Array), map: decode(it.map, Uint16Array), uv: decode(it.uv, Float32Array), tris: decode(it.tris, Uint16Array),
      };
    }
    return { human, items, skins: l.skins };
  })().catch((e) => {
    dataPromise = null;
    throw e;
  });
  return dataPromise;
}

function levels(v: number) {
  return v < 0.5 ? { min: 1 - 2 * v, average: 2 * v, max: 0 } : { min: 0, average: 2 - 2 * v, max: 2 * v - 1 };
}

// Morphed body: every base vertex (helpers too, since clothes hang on them),
// normalised so the feet are on y = 0 and the body is 1.76 units tall.
function morph(H: Human, body: BodyInput) {
  const B = buildOf(body);
  const mus = clamp(0.5 + (B.muscle - 0.33) * 0.95, 0, 1);
  const wt = clamp(0.5 + (B.bmi - 22) / (B.bmi < 22 ? 12 : 22) + (B.fat - 0.4) * 0.25, 0, 1);
  const pos = new Float32Array(H.base);
  const inv = 1 / H.scale;
  const apply = (t: { i: Uint16Array; d: Int16Array }, k: number) => {
    for (let j = 0; j < t.i.length; j++) {
      const o = t.i[j] * 3;
      const q = j * 3;
      pos[o] += t.d[q] * inv * k;
      pos[o + 1] += t.d[q + 1] * inv * k;
      pos[o + 2] += t.d[q + 2] * inv * k;
    }
  };
  const gw = { female: 1 - B.male, male: B.male };
  const mw = levels(mus);
  const ww = levels(wt);
  for (const g of ["female", "male"] as const) {
    if (gw[g] < 0.001) continue;
    if (H.t["shape-" + g]) apply(H.t["shape-" + g], gw[g]);
    for (const m of ["min", "average", "max"] as const) {
      for (const w of ["min", "average", "max"] as const) {
        const k = gw[g] * mw[m] * ww[w];
        const t = H.t[`${g}-${m}muscle-${w}weight`];
        if (k > 0.001 && t) apply(t, k);
      }
    }
  }
  // Proportions from a photo (or set by hand): each −1…1, 0 is the default.
  const shape = body.shape ?? {};
  const shapeKey: number[] = [];
  const parts: [keyof Shape, string][] = [["shoulders", "shoulder-dist"], ["waist", "waist-circ"], ["hips", "hips-circ"], ["legs", "upperleg-height"]];
  for (const [k, target] of parts) {
    const val = clamp(shape[k] ?? 0, -1, 1);
    shapeKey.push(Math.round(val * 10));
    const t = H.t[target + (val > 0 ? "-incr" : "-decr")];
    if (t && Math.abs(val) > 0.01) apply(t, Math.abs(val));
  }
  const map = H.body.map;
  let minY = 1e9, maxY = -1e9, sz = 0, n = 0;
  for (let i = 0; i < map.length; i++) {
    const v = map[i] * 3 + 1;
    if (pos[v] < minY) minY = pos[v];
    if (pos[v] > maxY) maxY = pos[v];
  }
  for (let i = 0; i < map.length; i++) {
    const v = map[i] * 3;
    const r = (pos[v + 1] - minY) / (maxY - minY);
    if (r > 0.45 && r < 0.7) { sz += pos[v + 2]; n++; }
  }
  const s = 1.76 / (maxY - minY);
  const cz = n ? sz / n : 0;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] *= s;
    pos[i + 1] = (pos[i + 1] - minY) * s;
    pos[i + 2] = (pos[i + 2] - cz) * s;
  }
  return { pos, build: B, key: [B.male, Math.round(mus * 20), Math.round(wt * 20), ...shapeKey].join(":") };
}

// Smooth normals on the welded topology, then spread to the uv-split copies.
function geometry(srcPos: Float32Array, nSrc: number, map: Uint16Array, uv: Float32Array, tris: Uint16Array, keep?: (a: number, b: number, c: number) => boolean) {
  const acc = new Float32Array(nSrc * 3);
  const idx: number[] = [];
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i], b = tris[i + 1], c = tris[i + 2];
    if (keep && !keep(a, b, c)) continue;
    idx.push(a, b, c);
    const A = map[a] * 3, Bv = map[b] * 3, C = map[c] * 3;
    const ux = srcPos[Bv] - srcPos[A], uy = srcPos[Bv + 1] - srcPos[A + 1], uz = srcPos[Bv + 2] - srcPos[A + 2];
    const vx = srcPos[C] - srcPos[A], vy = srcPos[C + 1] - srcPos[A + 1], vz = srcPos[C + 2] - srcPos[A + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [A, Bv, C]) { acc[o] += nx; acc[o + 1] += ny; acc[o + 2] += nz; }
  }
  const p = new Float32Array(map.length * 3);
  const nrm = new Float32Array(map.length * 3);
  for (let i = 0; i < map.length; i++) {
    const o = map[i] * 3;
    const l = Math.hypot(acc[o], acc[o + 1], acc[o + 2]) || 1;
    p[i * 3] = srcPos[o]; p[i * 3 + 1] = srcPos[o + 1]; p[i * 3 + 2] = srcPos[o + 2];
    nrm[i * 3] = acc[o] / l; nrm[i * 3 + 1] = acc[o + 1] / l; nrm[i * 3 + 2] = acc[o + 2] / l;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// MakeHuman fitting: weighted sum of three body vertices plus an offset scaled by
// how far apart two reference vertices are on this body.
function fit(it: Item, pos: Float32Array) {
  const out = new Float32Array(it.n * 3);
  const sc = { x: 1, y: 1, z: 1 };
  (["x", "y", "z"] as const).forEach((ax, k) => {
    const s = it.scale[ax];
    if (s) sc[ax] = Math.abs(pos[s[0] * 3 + k] - pos[s[1] * 3 + k]) / s[2];
  });
  for (let i = 0; i < it.n; i++) {
    const r = i * 3;
    for (let k = 0; k < 3; k++) {
      out[r + k] = it.w[r] * pos[it.refs[r] * 3 + k] + it.w[r + 1] * pos[it.refs[r + 1] * 3 + k] + it.w[r + 2] * pos[it.refs[r + 2] * 3 + k];
    }
    out[r] += it.off[r] * sc.x;
    out[r + 1] += it.off[r + 1] * sc.y;
    out[r + 2] += it.off[r + 2] * sc.z;
  }
  return out;
}

interface Part { name: string; kind: Item["kind"] | "skin"; tex?: string | null; normal?: string | null; geo: THREE.BufferGeometry }
const personCache = new Map<string, Part[]>();

function person(D: FigureData, body: BodyInput) {
  const H = D.human;
  const M = morph(H, body);
  const sex: FigureSex = body.sex in OUTFIT ? body.sex : "male";
  const key = sex + "|" + M.key;
  const hit = personCache.get(key);
  if (hit) return { parts: hit, build: M.build };
  const names = OUTFIT[sex].filter((n) => D.items[n]);
  const hidden = new Uint8Array(H.nv);
  for (const n of names) for (const v of D.items[n].del) hidden[v] = 1;
  const bm = H.body.map;
  const parts: Part[] = [{
    name: "skin", kind: "skin",
    geo: geometry(M.pos, H.nv, bm, H.body.uv, H.body.tris, (a, b, c) => !(hidden[bm[a]] && hidden[bm[b]] && hidden[bm[c]])),
  }];
  for (const n of names) {
    const it = D.items[n];
    parts.push({ name: n, kind: it.kind, tex: it.tex, normal: it.normal, geo: geometry(fit(it, M.pos), it.n, it.map, it.uv, it.tris) });
  }
  if (personCache.size > 24) personCache.clear();
  personCache.set(key, parts);
  return { parts, build: M.build };
}

const texCache = new Map<string, THREE.Texture>();
function texture(uri: string | null | undefined, color: boolean) {
  if (!uri) return null;
  let t = texCache.get(uri);
  if (!t) {
    t = new THREE.TextureLoader().load(uri);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(uri, t);
  }
  return t;
}

const planeAbove = (y: number) => new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
const planeBelow = (y: number) => new THREE.Plane(new THREE.Vector3(0, -1, 0), y);

export interface FigureModel {
  group: THREE.Group;
  build: Build;
  top: number;
  applyFill(fill: Record<MacroKey, number>, highlight: MacroKey | null): void;
  dispose(): void;
}

export const SKIN_KEY = { light: "caucasian", medium: "asian", deep: "african" } as const;

export function createFigure(D: FigureData, body: BodyInput, skin: keyof typeof SKIN_KEY): FigureModel {
  const P = person(D, body);
  const group = new THREE.Group();
  const mats: THREE.Material[] = [];
  const sexKey = body.sex === "female" ? "female" : "male";
  const skinUri = D.skins[`${SKIN_KEY[skin]}-${sexKey}`] ?? D.skins[`caucasian-${sexKey}`];

  function makeMat(kind: string, layer: "base" | MacroKey, map: THREE.Texture | null, normal: THREE.Texture | null) {
    let m: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
    if (kind === "skin") m = new THREE.MeshPhysicalMaterial({ map, roughness: 0.52, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffb8a0), clearcoat: 0.08 });
    else if (kind === "hair") m = new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0, alphaTest: 0.45, side: THREE.DoubleSide });
    else if (kind === "eyes") m = new THREE.MeshPhysicalMaterial({ map, roughness: 0.1, clearcoat: 1 });
    else m = new THREE.MeshStandardMaterial({ map, normalMap: normal, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    const band = layer === "base" ? null : new THREE.Color(COLORS[layer]);
    const mix = { value: 0 };
    const bandU = { value: band ?? new THREE.Color(0) };
    m.userData = { layer, mix, alpha: kind === "hair" };
    if (band) {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uMix = mix;
        sh.uniforms.uBand = bandU;
        sh.fragmentShader =
          "uniform float uMix;\nuniform vec3 uBand;\n" +
          sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uBand * (0.55 + 0.45 * dot(diffuseColor.rgb, vec3(0.333))), uMix);");
      };
      m.customProgramCacheKey = () => "band";
    }
    mats.push(m);
    return m;
  }

  for (const p of P.parts) {
    const map = texture(p.kind === "skin" ? skinUri : p.tex, true);
    const nmap = texture(p.normal, false);
    for (const layer of ["base", ...ORDER] as const) {
      const mesh = new THREE.Mesh(p.geo, makeMat(p.kind, layer, map, nmap));
      mesh.castShadow = layer === "base";
      mesh.receiveShadow = true;
      mesh.renderOrder = p.kind === "hair" ? 2 : 0;
      group.add(mesh);
    }
  }
  group.scale.setScalar(P.build.scale);
  const top = 1.76 * P.build.scale;

  return {
    group,
    build: P.build,
    top,
    applyFill(fill, hi) {
      let y = 0;
      const edges = {} as Record<MacroKey, [number, number, number]>;
      for (const k of ORDER) {
        const f = Math.max(0, fill[k] || 0);
        const y0 = y;
        y += f * top;
        edges[k] = [y0, Math.max(y0, y), f];
      }
      for (const m of mats) {
        const L = m.userData.layer as "base" | MacroKey;
        if (L === "base") { m.clippingPlanes = [planeAbove(y)]; continue; }
        const e = edges[L];
        const dim = hi && hi !== L;
        m.clippingPlanes = [planeAbove(e[0]), planeBelow(e[1])];
        m.visible = e[2] > 0.0005;
        m.userData.mix.value = dim ? 0.12 : m.userData.alpha ? 0.4 : 0.6;
      }
    },
    dispose() {
      for (const m of mats) m.dispose();
    },
  };
}

/** A soft studio baked into an environment map for lighting. */
export function studio(renderer: THREE.WebGLRenderer, dark: boolean) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 10), new THREE.MeshBasicMaterial({ color: dark ? 0x0c0f0d : 0x9aa39c, side: THREE.BackSide }));
  room.position.y = 3;
  s.add(room);
  const panel = (w: number, h: number, x: number, y: number, z: number, i: number, col = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(i), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 1, 0);
    s.add(m);
  };
  panel(3, 2.4, 2.8, 3.2, 3.2, dark ? 6 : 5);
  panel(1.4, 4, -3.6, 2.2, -2.4, dark ? 5 : 3, 0xffd6c4);
  panel(2.5, 2, -3, 1.6, 3, dark ? 1.4 : 2.2);
  panel(5, 5, 0, 7.5, 0, dark ? 1.2 : 2.5);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.04).texture;
  pm.dispose();
  return env;
}
