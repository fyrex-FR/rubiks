/* Lire les couleurs du cube sur les photos.
   - sample() : la couleur moyenne de chacune des 9 cases d'une face (sous la grille posée sur la photo)
   - classify() : décide quelle couleur est chaque case, en sachant qu'il y a exactement 9 cases
     de chaque couleur et que le centre de chaque photo est connu (c'est le capitaine). */
(function (root) {
  /* ---------- couleurs : RGB -> Lab (plus proche de ce que voit l'œil) ---------- */
  function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function rgbToLab([r, g, b]) {
    const R = lin(r), G = lin(g), B = lin(b);
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  // La luminosité compte moins que la teinte : une photo plus sombre ne doit pas tout changer
  function dist(a, b) {
    const dl = (a[0] - b[0]) * 0.45, da = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  /* ---------- échantillonner une face ----------
     canvas : la photo ; box = { x, y, size } en pixels du canvas (le carré de la grille) */
  function sample(canvas, box) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const cell = box.size / 3;
    const out = [];
    for (let r = 0; r < 3; r++) {
      const row = [];
      for (let c = 0; c < 3; c++) {
        const inner = cell * 0.42; // on lit le milieu de la case, loin des bords noirs
        const x0 = Math.round(box.x + c * cell + (cell - inner) / 2);
        const y0 = Math.round(box.y + r * cell + (cell - inner) / 2);
        const w = Math.max(1, Math.round(inner));
        const d = ctx.getImageData(Math.max(0, x0), Math.max(0, y0), w, w).data;
        const rs = [], gs = [], bs = [];
        for (let i = 0; i < d.length; i += 16) { rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); }
        const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1] || 0; };
        row.push([med(rs), med(gs), med(bs)]);
      }
      out.push(row);
    }
    return out;
  }

  /* ---------- affectation optimale (algorithme hongrois, matrice carrée) ---------- */
  function hungarian(cost) {
    const n = cost.length;
    const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0);
    const p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = new Array(n + 1).fill(Infinity);
      const used = new Array(n + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = Infinity, j1 = 0;
        for (let j = 1; j <= n; j++) {
          if (used[j]) continue;
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const assign = new Array(n);
    for (let j = 1; j <= n; j++) assign[p[j] - 1] = j - 1;
    return assign; // assign[ligne] = colonne
  }

  /* ---------- classer les 54 cases ----------
     samples = { U: 3x3 [r,g,b], ... } ; centers = { U: 'Y', ... } (le capitaine de chaque face)
     -> { grids: { U: 3x3 'Y'... }, confidence: { U: 3x3 0..1 } } */
  const COLORS = ['W', 'Y', 'R', 'O', 'B', 'G'];
  function classify(samples, centers) {
    const faces = Object.keys(samples);
    const cells = [];
    for (const f of faces) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      if (r === 1 && c === 1) continue;
      cells.push({ f, r, c, lab: rgbToLab(samples[f][r][c]) });
    }
    // modèle de départ : la couleur du capitaine sur sa propre photo
    let proto = {};
    for (const f of faces) proto[centers[f]] = rgbToLab(samples[f][1][1]);
    let assign = null;
    for (let iter = 0; iter < 3; iter++) {
      // 48 cases, 6 couleurs x 8 places
      const cost = cells.map((cell) => {
        const row = [];
        for (const col of COLORS) for (let k = 0; k < 8; k++) row.push(dist(cell.lab, proto[col]));
        return row;
      });
      assign = hungarian(cost).map((j) => COLORS[Math.floor(j / 8)]);
      // on affine le modèle avec la moyenne des cases attribuées (+ le centre)
      const next = {};
      for (const col of COLORS) {
        const f = faces.find((x) => centers[x] === col);
        const labs = [rgbToLab(samples[f][1][1])];
        cells.forEach((cell, i) => { if (assign[i] === col) labs.push(cell.lab); });
        next[col] = [0, 1, 2].map((k) => labs.reduce((s, l) => s + l[k], 0) / labs.length);
      }
      proto = next;
    }
    const grids = {}, confidence = {};
    for (const f of faces) {
      grids[f] = [[null, null, null], [null, centers[f], null], [null, null, null]];
      confidence[f] = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
    }
    cells.forEach((cell, i) => {
      grids[cell.f][cell.r][cell.c] = assign[i];
      // confiance : écart entre la couleur choisie et la 2e plus proche
      const ds = COLORS.map((col) => dist(cell.lab, proto[col])).sort((a, b) => a - b);
      const mine = dist(cell.lab, proto[assign[i]]);
      confidence[cell.f][cell.r][cell.c] = Math.max(0, Math.min(1, (ds[1] - mine) / 25 + 0.5));
    });
    return { grids, confidence };
  }

  const api = { sample, classify, rgbToLab, hungarian };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Photo = api;
})(typeof window !== 'undefined' ? window : globalThis);
