// Packs the MakeHuman body (all 19,158 base vertices, so clothes can hang on the
// helper geometry), its build targets, texture coordinates, and a set of CC0
// skins, clothes, hair, brows, lashes and eyes fitted the way MakeHuman fits them.
//
// Usage: node build-look.mjs <mh-src dir> <mh-assets/sel dir> <out dir>
// Writes <out>/human.js (body + targets) and <out>/human-look.js (assets).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Jimp = require('jimp');

const [src, sel, outDir] = process.argv.slice(2);
const b64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64');

function readObj(file, onlyGroup) {
  const v = [], vt = [], faces = [];
  let group = '';
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'v') v.push([+p[1], +p[2], +p[3]]);
    else if (p[0] === 'vt') vt.push([+p[1], +p[2]]);
    else if (p[0] === 'g') group = p.slice(1).join(' ');
    else if (p[0] === 'f' && (!onlyGroup || group === onlyGroup)) {
      faces.push(p.slice(1).map((t) => { const [a, b] = t.split('/'); return [parseInt(a, 10) - 1, b ? parseInt(b, 10) - 1 : -1]; }));
    }
  }
  return { v, vt, faces };
}

// Split vertices per (position, uv) pair so textures map cleanly.
function renderMesh(faces, vt) {
  const key = new Map(), map = [], uv = [], tris = [];
  const idx = ([vi, ti]) => {
    const k = vi * 65536 + ti;
    if (!key.has(k)) { key.set(k, map.length); map.push(vi); uv.push(...(ti >= 0 ? vt[ti] : [0, 0])); }
    return key.get(k);
  };
  for (const f of faces) {
    const r = f.map(idx);
    for (let i = 1; i + 1 < r.length; i++) tris.push(r[0], r[i], r[i + 1]);
  }
  return { map, uv, tris };
}

// ---- body and targets ------------------------------------------------------
const base = readObj(path.join(src, 'base.obj'), 'body');
const nv = base.v.length;
const body = renderMesh(base.faces, base.vt);
const eyes = {};
{
  const all = readObj(path.join(src, 'base.obj'));
  // eye joint centres: average of each joint helper's vertices, found by group
  let group = '';
  const sets = { l: new Set(), r: new Set() };
  for (const line of fs.readFileSync(path.join(src, 'base.obj'), 'utf8').split('\n')) {
    if (line.startsWith('g ')) group = line.slice(2).trim();
    else if (line.startsWith('f ') && (group === 'joint-l-eye' || group === 'joint-r-eye')) {
      for (const t of line.trim().split(/\s+/).slice(1)) sets[group[6]].add(parseInt(t, 10) - 1);
    }
  }
  eyes.l = [...sets.l]; eyes.r = [...sets.r];
  void all;
}

const SCALE = 4000;
const targets = {};
function readTarget(file) {
  const m = new Map();
  for (const line of fs.readFileSync(path.join(src, file), 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue;
    const [i, dx, dy, dz] = line.trim().split(/\s+/);
    m.set(+i, [+dx, +dy, +dz]);
  }
  return m;
}
function pack(key, m) {
  const idx = new Uint16Array(m.size), d = new Int16Array(m.size * 3);
  let j = 0;
  for (const [i, v] of m) { idx[j] = i; d[j * 3] = Math.round(v[0] * SCALE); d[j * 3 + 1] = Math.round(v[1] * SCALE); d[j * 3 + 2] = Math.round(v[2] * SCALE); j++; }
  targets[key] = { i: b64(idx), d: b64(d) };
}
const files = fs.readdirSync(src).filter((f) => f.endsWith('.target'));
for (const f of files.filter((f) => f.startsWith('universal-'))) pack(f.replace('universal-', '').replace('-young', '').replace('.target', ''), readTarget(f));
for (const sex of ['female', 'male']) {
  const eth = files.filter((f) => f.endsWith(`-${sex}-young.target`) && !f.startsWith('universal-'));
  const sum = new Map();
  for (const f of eth) for (const [i, v] of readTarget(f)) {
    const s = sum.get(i) || [0, 0, 0];
    sum.set(i, [s[0] + v[0] / eth.length, s[1] + v[1] / eth.length, s[2] + v[2] / eth.length]);
  }
  pack(`shape-${sex}`, sum);
}
// Proportions a photo can set: shoulder width, waist, hips, leg length.
const mdir = path.join(src, 'measure');
if (fs.existsSync(mdir)) {
  for (const f of fs.readdirSync(mdir).filter((f) => f.endsWith('.target'))) {
    pack(f.replace('measure-', '').replace('.target', ''), readTarget(path.join('measure', f)));
  }
}

const human = {
  nv,
  scale: SCALE,
  base: b64(new Float32Array(base.v.flat())),
  body: { map: b64(new Uint16Array(body.map)), uv: b64(new Float32Array(body.uv)), tris: b64(new Uint16Array(body.tris)) },
  targets,
  eyes,
};
fs.writeFileSync(path.join(outDir, 'human.js'), `// MakeHuman base mesh hm08 and targets, CC0 (makehumancommunity.org).\nwindow.TallyHumanData=${JSON.stringify(human)};\n`);

// ---- fitted assets -------------------------------------------------------
function readClo(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const out = { refs: [], w: [], off: [], scale: {}, del: [], obj: null };
  let mode = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const p = line.split(/\s+/);
    if (p[0] === 'verts') { mode = 'verts'; continue; }
    if (p[0] === 'delete_verts') { mode = 'del'; continue; }
    if (/^[a-z_]+$/.test(p[0])) {
      // keyword lines (material, z_depth…) can sit inside a section; only data lines are numbers
      if (p[0] === 'obj_file') out.obj = p[1];
      if (/^[xyz]_scale$/.test(p[0])) out.scale[p[0][0]] = [+p[1], +p[2], +p[3]];
      continue;
    }
    if (mode === 'verts') {
      if (p.length === 1) { out.refs.push(+p[0], +p[0], +p[0]); out.w.push(1, 0, 0); out.off.push(0, 0, 0); }
      else { out.refs.push(+p[0], +p[1], +p[2]); out.w.push(+p[3], +p[4], +p[5]); out.off.push(+p[6], +p[7], +p[8]); }
    } else if (mode === 'del') {
      for (let i = 0; i < p.length; i++) {
        if (p[i + 1] === '-') { for (let k = +p[i]; k <= +p[i + 2]; k++) out.del.push(k); i += 2; }
        else out.del.push(+p[i]);
      }
    }
  }
  return out;
}

// Logo removal: cover each rectangle (in 2048-px texture space) with clean
// fabric copied from (dx, dy) away, feathered at the edges so no seam shows.
const PATCHES = {
  'female_casualsuit01_diffuse.png': [[1450, 320, 330, 310, -360, 0]],
  'male_casualsuit06_diffuse.png': [[905, 240, 375, 180, 0, 260], [405, 235, 200, 105, 0, 210], [1495, 305, 55, 60, 0, 110]],
};
function patch(img, [x, y, w, h, dx, dy], feather = 18) {
  const src = img.clone(), W = img.bitmap.width;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const e = Math.min(i, j, w - 1 - i, h - 1 - j), a = Math.min(1, e / feather);
    const t = ((y + j) * W + (x + i)) * 4, s = ((y + j + dy) * W + (x + i + dx)) * 4;
    for (let c = 0; c < 3; c++) img.bitmap.data[t + c] = Math.round(img.bitmap.data[t + c] * (1 - a) + src.bitmap.data[s + c] * a);
  }
}

async function texture(file, size, kind) {
  const img = await Jimp.read(file);
  (PATCHES[path.basename(file)] || []).forEach((p) => patch(img, p));
  if (img.bitmap.width > size) img.resize(size, size);
  if (kind === 'png') return 'data:image/png;base64,' + (await img.deflateLevel(9).getBufferAsync(Jimp.MIME_PNG)).toString('base64');
  return 'data:image/jpeg;base64,' + (await img.quality(kind === 'normal' ? 88 : 82).getBufferAsync(Jimp.MIME_JPEG)).toString('base64');
}

const ITEMS = {
  'outfit-male': { dir: 'clothes/male_casualsuit06', clo: 'male_casualsuit06.mhclo', map: ['male_casualsuit06_diffuse.png', 1024, 'jpg'], normal: ['male_casualsuit06_normal.png', 1024, 'normal'], kind: 'cloth' },
  'outfit-female': { dir: 'clothes/female_casualsuit01', clo: 'female_casualsuit01.mhclo', map: ['female_casualsuit01_diffuse.png', 1024, 'jpg'], normal: ['female_casualsuit01_normal.png', 1024, 'normal'], kind: 'cloth' },
  shoes: { dir: 'clothes/shoes06', clo: 'shoes06.mhclo', map: ['shoes06_diffuse.png', 512, 'jpg'], kind: 'cloth' },
  'hair-male': { dir: 'hair/short02', clo: 'short02.mhclo', map: ['short02_diffuse.png', 1024, 'png'], kind: 'hair' },
  'hair-female': { dir: 'hair/ponytail01', clo: 'ponytail01.mhclo', map: ['ponytail01_diffuse.png', 1024, 'png'], kind: 'hair' },
  brows: { dir: 'eyebrows/eyebrow001', clo: 'eyebrow001.mhclo', map: ['eyebrow001.png', 256, 'png'], kind: 'hair' },
  lashes: { dir: 'eyelashes/eyelashes01', clo: 'eyelashes01.mhclo', map: ['eyelashes01.png', 256, 'png'], kind: 'hair' },
  eyes: { dir: 'eyes/low-poly', clo: 'low-poly.mhclo', mapPath: 'eyes/materials/brown_eye.png', map: [null, 256, 'jpg'], kind: 'eyes' },
};
const SKINS = {};
for (const eth of ['caucasian', 'african', 'asian']) for (const sex of ['male', 'female']) {
  const dir = path.join(sel, 'skins', `young_${eth}_${sex}`);
  if (!fs.existsSync(dir)) continue;
  const png = fs.readdirSync(dir).find((f) => f.endsWith('.png'));
  SKINS[`${eth}-${sex}`] = await texture(path.join(dir, png), 1024, 'jpg');
}

const look = { items: {}, skins: SKINS };
for (const [name, it] of Object.entries(ITEMS)) {
  const dir = path.join(sel, it.dir);
  const clo = readClo(path.join(dir, it.clo));
  const obj = readObj(path.join(dir, clo.obj));
  const mesh = renderMesh(obj.faces, obj.vt);
  look.items[name] = {
    kind: it.kind,
    n: obj.v.length,
    refs: b64(new Uint16Array(clo.refs)),
    w: b64(new Float32Array(clo.w)),
    off: b64(new Float32Array(clo.off)),
    scale: clo.scale,
    del: b64(new Uint16Array(clo.del)),
    map: b64(new Uint16Array(mesh.map)),
    uv: b64(new Float32Array(mesh.uv)),
    tris: b64(new Uint16Array(mesh.tris)),
    tex: await texture(it.mapPath ? path.join(sel, it.mapPath) : path.join(dir, it.map[0]), it.map[1], it.map[2]),
    normal: it.normal ? await texture(path.join(dir, it.normal[0]), it.normal[1], it.normal[2]) : null,
  };
  console.log(name, { verts: obj.v.length, tris: mesh.tris.length / 3, del: clo.del.length });
}
fs.writeFileSync(path.join(outDir, 'human-look.js'), `// MakeHuman system assets (skins, clothes, hair, eyes), CC0 (makehumancommunity.org).\nwindow.TallyHumanLook=${JSON.stringify(look)};\n`);
for (const f of ['human.js', 'human-look.js']) console.log(f, fs.statSync(path.join(outDir, f)).size);
