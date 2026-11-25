/* Logique du cube : pas de 3D ici, juste des pièces, des positions et des rotations.
   Utilisable dans le navigateur (window.CubeLogic) et dans Node (require). */
(function (root) {
  // Orientation de départ : Lion (jaune) en haut, Ours polaires (blanc) en bas.
  const START_COLORS = { U: 'Y', D: 'W', F: 'G', B: 'B', R: 'O', L: 'R' };
  const NORMALS = {
    U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1],
    B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0],
  };

  // axis: 0=x 1=y 2=z ; layer: 1, -1 ou null (tout le cube) ; sign: sens "horaire" vu depuis la face
  const MOVES = {
    R: { axis: 0, layer: 1, sign: -1 },
    L: { axis: 0, layer: -1, sign: 1 },
    U: { axis: 1, layer: 1, sign: -1 },
    D: { axis: 1, layer: -1, sign: 1 },
    F: { axis: 2, layer: 1, sign: -1 },
    B: { axis: 2, layer: -1, sign: 1 },
    x: { axis: 0, layer: null, sign: -1 },
    y: { axis: 1, layer: null, sign: -1 },
    z: { axis: 2, layer: null, sign: -1 },
  };

  const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  function mul3(a, b) {
    const r = new Array(9);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  }
  function apply3(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
  }
  function rotMatrix(axis, quarters) {
    const k = ((quarters % 4) + 4) % 4;
    const c = [1, 0, -1, 0][k];
    const s = [0, 1, 0, -1][k];
    if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c];
    if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c];
    return [c, -s, 0, s, c, 0, 0, 0, 1];
  }

  function createSolved() {
    const pieces = [];
    let id = 0;
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const stickers = [];
          if (x === 1) stickers.push({ n: NORMALS.R, c: START_COLORS.R });
          if (x === -1) stickers.push({ n: NORMALS.L, c: START_COLORS.L });
          if (y === 1) stickers.push({ n: NORMALS.U, c: START_COLORS.U });
          if (y === -1) stickers.push({ n: NORMALS.D, c: START_COLORS.D });
          if (z === 1) stickers.push({ n: NORMALS.F, c: START_COLORS.F });
          if (z === -1) stickers.push({ n: NORMALS.B, c: START_COLORS.B });
          const type = stickers.length === 1 ? 'center' : stickers.length === 2 ? 'edge' : 'corner';
          pieces.push({ id: id++, pos: [x, y, z], rot: IDENTITY.slice(), stickers, type });
        }
    return { pieces };
  }

  function clone(cube) {
    return {
      pieces: cube.pieces.map((p) => ({ ...p, pos: p.pos.slice(), rot: p.rot.slice() })),
    };
  }

  // "R U' F2" -> [{face:'R', turns:1, token:'R'}, ...]
  function parse(seq) {
    if (!seq) return [];
    if (Array.isArray(seq)) return seq.flatMap((s) => parse(typeof s === 'string' ? s : s.m));
    return seq.trim().split(/\s+/).filter(Boolean).map((tok) => {
      const m = /^([RLUDFBxyz])(2'?|'|2)?$/.exec(tok);
      if (!m) throw new Error('Mouvement inconnu : ' + tok);
      const suf = m[2] || '';
      const turns = suf.startsWith('2') ? 2 : suf === "'" ? -1 : 1;
      return { face: m[1], turns, token: tok };
    });
  }

  function invert(seq) {
    return parse(seq).reverse().map((mv) => {
      if (mv.turns === 2) return mv.face + '2';
      return mv.turns === 1 ? mv.face + "'" : mv.face;
    }).join(' ');
  }

  function piecesInMove(cube, mv) {
    const def = MOVES[mv.face];
    return cube.pieces.filter((p) => def.layer === null || p.pos[def.axis] === def.layer);
  }

  function applyMove(cube, mv) {
    const def = MOVES[mv.face];
    const q = def.sign * mv.turns;
    const m = rotMatrix(def.axis, q);
    for (const p of piecesInMove(cube, mv)) {
      p.pos = apply3(m, p.pos);
      p.rot = mul3(m, p.rot);
    }
    return cube;
  }

  function apply(cube, seq) {
    for (const mv of parse(seq)) applyMove(cube, mv);
    return cube;
  }

  function stickerWorld(p, s) {
    return apply3(p.rot, s.n);
  }

  const FACE_GRID = {
    U: { n: [0, 1, 0], rc: (p) => [p[2] + 1, p[0] + 1] },
    D: { n: [0, -1, 0], rc: (p) => [1 - p[2], p[0] + 1] },
    F: { n: [0, 0, 1], rc: (p) => [1 - p[1], p[0] + 1] },
    B: { n: [0, 0, -1], rc: (p) => [1 - p[1], 1 - p[0]] },
    R: { n: [1, 0, 0], rc: (p) => [1 - p[1], 1 - p[2]] },
    L: { n: [-1, 0, 0], rc: (p) => [1 - p[1], p[2] + 1] },
  };

  // Grille 3x3 des couleurs visibles sur une face (vue de face, "comme sur un dessin").
  function faceGrid(cube, face) {
    const g = FACE_GRID[face];
    const grid = [[null, null, null], [null, null, null], [null, null, null]];
    for (const p of cube.pieces)
      for (const s of p.stickers) {
        const w = stickerWorld(p, s);
        if (w[0] === g.n[0] && w[1] === g.n[1] && w[2] === g.n[2]) {
          const [r, c] = g.rc(p.pos);
          grid[r][c] = s.c;
        }
      }
    return grid;
  }

  // Couleur qu'une pièce montre dans une direction donnée (ou null)
  function colorFacing(p, dir) {
    for (const s of p.stickers) {
      const w = stickerWorld(p, s);
      if (w[0] === dir[0] && w[1] === dir[1] && w[2] === dir[2]) return s.c;
    }
    return null;
  }

  function hasColor(p, c) {
    return p.stickers.some((s) => s.c === c);
  }

  // Couleur du capitaine (centre) qui regarde dans la direction dir
  function centerColor(cube, dir) {
    const c = cube.pieces.find((p) => p.type === 'center' &&
      p.pos[0] === dir[0] && p.pos[1] === dir[1] && p.pos[2] === dir[2]);
    return c.stickers[0].c;
  }
  // Une pièce est "rentrée" si chacune de ses couleurs touche le capitaine de la même couleur
  function pieceSolved(cube, p) {
    return p.stickers.every((s) => centerColor(cube, stickerWorld(p, s)) === s.c);
  }
  function pieceAt(cube, pos) {
    return cube.pieces.find((p) => p.pos[0] === pos[0] && p.pos[1] === pos[1] && p.pos[2] === pos[2]);
  }
  function isSolved(cube) {
    return cube.pieces.every((p) => pieceSolved(cube, p));
  }

  /* ---------- Fabriquer un cube à partir des 6 faces photographiées ----------
     grids = { U: [[..3],[..3],[..3]], D, F, B, R, L } avec les couleurs 'W','Y','R','O','B','G',
     dans le même sens que faceGrid (Lion en haut, Grenouille devant).
     Renvoie { cube } ou { errors: [{ msg, cells: [[face, r, c], ...] }] }. */
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const eq3 = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  const COLOR_NAMES = { W: 'blanc', Y: 'jaune', R: 'rouge', O: 'orange', B: 'bleu', G: 'vert' };

  function fromFacelets(grids) {
    const errors = [];
    const solved = createSolved();
    // 1. Chaque couleur exactement 9 fois, et les capitaines à leur place
    const count = {};
    for (const f of Object.keys(FACE_GRID))
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const col = grids[f] && grids[f][r] && grids[f][r][c];
        count[col] = (count[col] || 0) + 1;
      }
    for (const f of Object.keys(FACE_GRID)) {
      if (grids[f][1][1] !== START_COLORS[f])
        errors.push({ msg: `Le centre de cette face devrait être ${COLOR_NAMES[START_COLORS[f]]}.`, cells: [[f, 1, 1]] });
    }
    const bad = Object.keys(COLOR_NAMES).filter((c) => count[c] !== 9);
    if (bad.length) {
      errors.push({
        msg: 'Chaque couleur doit apparaître 9 fois. Ici : ' +
          bad.map((c) => `${count[c] || 0} ${COLOR_NAMES[c]}`).join(', ') + '.',
        cells: [],
      });
      return { errors };
    }
    if (errors.length) return { errors };

    // 2. Les couleurs vues à chaque position
    const at = new Map(); // "x,y,z" -> [{n, c, cell}]
    for (const p of solved.pieces) at.set(p.pos.join(), []);
    for (const f of Object.keys(FACE_GRID)) {
      const g = FACE_GRID[f];
      for (const p of solved.pieces) {
        if (!p.stickers.some((s) => eq3(s.n, g.n))) continue;
        const [r, c] = g.rc(p.pos);
        at.get(p.pos.join()).push({ n: g.n, c: grids[f][r][c], cell: [f, r, c] });
      }
    }
    // 3. Retrouver chaque pièce et comment elle est tournée
    const cube = { pieces: [] };
    const used = new Set();
    for (const [posKey, seen] of at) {
      const pos = posKey.split(',').map(Number);
      const colors = seen.map((s) => s.c).sort().join('');
      const home = solved.pieces.find((p) => !used.has(p.id) && p.stickers.map((s) => s.c).sort().join('') === colors);
      if (!home) {
        errors.push({
          msg: seen.length === 2
            ? `Ce duo ${seen.map((s) => COLOR_NAMES[s.c]).join('-')} n'existe pas (ou il est en double).`
            : `Ce trio ${seen.map((s) => COLOR_NAMES[s.c]).join('-')} n'existe pas (ou il est en double).`,
          cells: seen.map((s) => s.cell),
        });
        continue;
      }
      used.add(home.id);
      const m = home.stickers.map((s) => seen.find((x) => x.c === s.c).n);
      const n = home.stickers.map((s) => s.n);
      let N = n.slice(); let M = m.slice();
      if (n.length === 1) { N = [n[0]]; M = [m[0]]; }
      if (n.length >= 2) { N = [n[0], n[1], cross(n[0], n[1])]; M = [m[0], m[1], cross(m[0], m[1])]; }
      let rot = IDENTITY.slice();
      if (n.length >= 2) {
        rot = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (let k = 0; k < 3; k++)
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) rot[i * 3 + j] += M[k][i] * N[k][j];
      }
      if (n.length === 3 && !eq3(apply3(rot, n[2]), m[2])) {
        errors.push({ msg: `Ce trio ${seen.map((s) => COLOR_NAMES[s.c]).join('-')} est impossible : deux de ses couleurs sont sûrement inversées.`, cells: seen.map((s) => s.cell) });
        continue;
      }
      cube.pieces.push({ ...home, pos, rot, stickers: home.stickers });
    }
    if (errors.length) return { errors };
    cube.pieces.sort((a, b) => a.id - b.id);
    return { cube };
  }

  const api = {
    START_COLORS, NORMALS, MOVES, COLOR_NAMES, FACE_GRID, createSolved, clone, parse, invert,
    applyMove, apply, piecesInMove, faceGrid, colorFacing, hasColor, stickerWorld,
    centerColor, pieceSolved, pieceAt, isSolved, fromFacelets,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CubeLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
