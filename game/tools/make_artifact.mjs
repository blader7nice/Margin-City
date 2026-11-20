// Turn dist/index.html into a hosted-page body (the host adds doctype/html/head/body) + copy files.
import fs from 'node:fs';
import path from 'node:path';
const [src = 'dist', out] = process.argv.slice(2);
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html.replace(/<!doctype html>/i, '').replace(/<\/?html[^>]*>/gi, '').replace(/<\/?head>/gi, '').replace(/<\/?body>/gi, '');
html = html.replace(/<meta charset="utf-8" \/>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
fs.writeFileSync(path.join(out, 'index.html'), html.trim() + '\n');
// Artifact hosting does not serve .glb: ship the JSON glTF variant (the game falls back to it automatically).
import { execFileSync } from 'node:child_process';
const modelsDir = path.join(out, 'models');
if (fs.existsSync(modelsDir)) {
  for (const f of fs.readdirSync(modelsDir).filter((n) => n.endsWith('.glb'))) {
    execFileSync('python3', ['-I', path.resolve('tools/glb_to_json.py'), path.join(modelsDir, f), path.join(modelsDir, f.replace(/\.glb$/, '.gltf.json'))]);
    fs.rmSync(path.join(modelsDir, f));
  }
}
const files = {};
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p);
  else if (e.name !== 'index.html') files[path.relative(out, p).split(path.sep).join('/')] = p;
});
walk(out);
console.log(JSON.stringify(files));
