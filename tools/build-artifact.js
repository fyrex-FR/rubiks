// Fabrique dist/artifact.html : la page en un seul fichier (CSS et JS intégrés), pour la publier.
// Usage : node tools/build-artifact.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const m = /<!-- PAGE -->([\s\S]*?)<!-- \/PAGE -->/.exec(html);
if (!m) throw new Error('Marqueurs PAGE introuvables dans index.html');
let page = m[1]
  .replace(/<\/head>\s*<body>/, '')
  .replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (_, f) =>
    `<style>\n${fs.readFileSync(path.join(root, f), 'utf8')}\n</style>`)
  .replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, f) =>
    `<script>\n${fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), page.trim() + '\n');
console.log('dist/artifact.html :', (page.length / 1024).toFixed(1), 'Ko');
