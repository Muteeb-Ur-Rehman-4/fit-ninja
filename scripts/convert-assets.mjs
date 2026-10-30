// Turns the reference window.X=... bundles into plain JSON files for lazy loading.
import fs from 'node:fs';
const jobs = [['human.js', 'human.json'], ['human-look.js', 'human-look.json']];
for (const [from, to] of jobs) {
  const s = fs.readFileSync(new URL(`../reference/body-assets/${from}`, import.meta.url), 'utf8');
  const i = s.indexOf('={');
  const json = s.slice(i + 1).trim().replace(/;$/, '');
  JSON.parse(json);
  fs.writeFileSync(new URL(`../public/assets/${to}`, import.meta.url), json);
  console.log(to, json.length);
}
