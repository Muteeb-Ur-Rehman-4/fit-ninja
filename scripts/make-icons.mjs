// Renders PNG icons from public/icon.svg
import sharp from "sharp";
import fs from "node:fs";
const svg = fs.readFileSync(new URL("../public/icon.svg", import.meta.url));
import { fileURLToPath } from "node:url";
const out = (n) => fileURLToPath(new URL(`../public/${n}`, import.meta.url));
for (const s of [192, 512]) await sharp(svg, { density: 384 }).resize(s, s).png().toFile(out(`icons/icon-${s}.png`));
await sharp(svg, { density: 384 }).resize(180, 180).png().toFile(out("apple-touch-icon.png"));
// maskable: art inside the safe zone on a full-bleed background
const inner = await sharp(svg, { density: 384 }).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0e1511" } }).composite([{ input: inner, gravity: "center" }]).png().toFile(out("icons/maskable-512.png"));
console.log("icons ok");
