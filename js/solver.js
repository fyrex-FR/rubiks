/* Le solveur de « Mon cube ».
   Il résout le cube de Camille EXACTEMENT comme dans les entraînements (pâquerette, plongeons,
   ascenseurs, rugissements, ronde, ping-pong), et raconte chaque étape avec les mêmes histoires.
   solve(cube) -> { stages: [{ chapter, icon, title, intro, steps: [{ title, text, target, moves }] }], moves }
   Si le cube est impossible (couleur mal lue, pièce tournée à la main), solve lance une erreur. */
(function (root) {
  const L = root.CubeLogic;
  const LB = root.Content.LABELS;

  const UP = [0, 1, 0], DOWN = [0, -1, 0], FRONT = [0, 0, 1], RIGHT = [1, 0, 0], LEFT = [-1, 0, 0];
  const ROTS = ['', 'y', "y'", 'y2'];
  const UTURNS = ['', 'U', "U'", 'U2'];
  const DTURNS = ['', 'D', "D'", 'D2'];
  const ELEVATOR = "R U R' U'";
  const RONDE = "R U R' U R U2 R'";
  const PINGPONG = "U R U' L' U R' U' L";
  const ARROW = { U: '⬅️', "U'": '➡️', U2: '🔁', D: '➡️', "D'": '⬅️', D2: '🔁' };

  /* ---------- Ce que dit le coach (phrases fixes : elles peuvent être enregistrées) ---------- */
  const TEXT = {
    daisyMid: "Cet ours est à l'étage du milieu, son blanc te regarde. On fait de la place au-dessus de lui si besoin (règle d'or), puis il monte à côté du Lion !",
    daisyDown: "Cet ours est tout en bas et son blanc regarde le sol. On libère la place au-dessus, puis la face fait 2 tours : grand saut !",
    daisyBottomSide: "Cet ours est en bas, son blanc te regarde. On libère la place au-dessus, la face tourne pour le ramener au milieu, puis il monte.",
    daisyFlipped: "Cet ours est en haut, mais la tête à l'envers. La face tourne pour le faire descendre au milieu, puis il remonte dans le bon sens.",
    cross: "Le haut glisse jusqu'au check : le maillot de l'ours au-dessus de son capitaine. Puis le plongeon : la face fait 2 tours !",
    crossDone: "Ton cube a déjà sa croix blanche bien rangée ! On passe directement à la suite.",
    corner1: "On met une maison vide devant toi, en bas à droite, et son trio juste au-dessus. Son blanc regarde à droite : 1 seul voyage d'ascenseur !",
    corner3: "On met une maison vide devant toi, en bas à droite, et son trio juste au-dessus. Son blanc regarde en haut : 3 voyages d'ascenseur.",
    corner5: "On met une maison vide devant toi, en bas à droite, et son trio juste au-dessus. Son blanc te regarde : 5 voyages d'ascenseur.",
    cornerTwisted: "Ce trio est dans sa maison, mais mal tourné. Ascenseur jusqu'à ce que son blanc soit en dessous !",
    cornerStuck: "Ce trio est coincé en bas, dans la mauvaise maison. Un voyage d'ascenseur pour le faire remonter en haut.",
    midRight: "Ce joueur fait son check au-dessus de son capitaine. Le dessus de sa tête dit d'aller à droite : il s'éloigne, ascenseur droit, on le suit, ascenseur gauche.",
    midLeft: "Ce joueur fait son check au-dessus de son capitaine. Le dessus de sa tête dit d'aller à gauche : il s'éloigne, ascenseur gauche, on le suit, ascenseur droit.",
    midStuck: "Ce joueur est coincé au 2e étage, mal placé. On envoie un duo Lion à sa place pour le faire ressortir en haut.",
    yDot: "Le point : seul le capitaine est jaune. Un rugissement, et un coude va apparaître !",
    yElbow: "Le coude ! On le place à 9 heures, puis rugissement.",
    yLine: "La ligne ! On la couche de gauche à droite, puis rugissement : la croix !",
    yDone: "La croix jaune est déjà là ! On passe à la suite.",
    eAdjacent: "Check : 2 duos Lion sont au-dessus de leur capitaine, côte à côte. On les met à 3 heures, puis la ronde !",
    eOpposite: "Check : les 2 bons duos sont face à face. On fait une ronde, puis on recommence.",
    eDone: "Dernier check : tous les duos Lion sont devant leur capitaine !",
    pNone: "Aucun trio Lion n'est dans sa maison. Un ping-pong n'importe comment, et un trio va trouver sa maison.",
    pPlay: "Ce trio est dans sa maison : on le met devant, en haut à droite, et ping-pong !",
    pDone: "Les 4 trios Lion sont déjà dans leur maison ! On passe à la 2e mi-temps.",
    tFlip: "2e mi-temps ! Retourne ton cube comme une roue : le Lion passe en bas.",
    tCorner: "Le bas glisse pour amener un trio mal tourné devant toi, en bas à droite. Puis ascenseur jusqu'à ce que son jaune soit en dessous. Si le cube a l'air cassé, c'est normal !",
    tLast: "Tous les trios ont le jaune en dessous. Le bas glisse une dernière fois… et ton cube est rangé !",
    tFinish: "Ton ascenseur n'est pas fini ! Continue les voyages jusqu'à ce que le jaune de ce trio soit en dessous.",
    orient: "Tourne tout ton cube pour avoir le Lion en haut. Les autres étapes se font avec le Lion en haut !",
    finishMacro: "Ton geste n'est pas fini ! Termine-le, et le cube va se réparer.",
  };
  const INTRO = {
    ch1: "Première étape : la pâquerette. Les ours polaires viennent s'échauffer autour du capitaine Lion.",
    ch2: "Deuxième étape : le grand plongeon. Chaque ours retrouve son capitaine et plonge tout en bas.",
    ch3: "Troisième étape : l'ascenseur des trios. Chaque trio ours polaire rentre dans sa maison.",
    ch4: "Quatrième étape : les visiteurs du 2e étage. Les joueurs sans jaune descendent au milieu.",
    ch5: "Cinquième étape : le cri du Lion. On fait la croix jaune sur le dessus.",
    ch6: "Sixième étape : la ronde des Lions. Chaque duo Lion va devant son capitaine.",
    ch7: "La grande finale : les trios Lion dans leur maison, puis on les tourne. Allez Camille !",
  };
  const STAGES = {
    ch1: { icon: '🌼', title: 'La pâquerette' },
    ch2: { icon: '🤿', title: 'Le grand plongeon' },
    ch3: { icon: '🛗', title: 'L’ascenseur des trios' },
    ch4: { icon: '🚪', title: 'Le 2e étage' },
    ch5: { icon: '📣', title: 'Le cri du Lion' },
    ch6: { icon: '💃', title: 'La ronde des Lions' },
    ch7: { icon: '🏆', title: 'La grande finale' },
  };

  /* ---------- Les étiquettes des gestes ---------- */
  const rot = (r, why) => r && [r, '🔄', r === 'y2' ? 'Demi-tour' : 'Tourne le cube', undefined, 'Tout le cube tourne : ' + why];
  const uLabel = (k, text, long) => k && [k, ARROW[k], text, undefined, long];
  const free = (k) => uLabel(k, 'Fais de la place', 'Le haut glisse : on fait de la place (règle d’or)');
  const above = (k) => uLabel(k, 'Au-dessus', 'Le haut glisse : le trio arrive au-dessus de sa maison');
  const nineOClock = (k) => uLabel(k, 'À 9 heures', 'Le haut glisse : le coude se place à 9 heures');
  const lieDown = (k) => uLabel(k, 'On la couche', 'Le haut glisse : la ligne se couche');
  const bottom = (k) => k && [k, ARROW[k], 'Le bas glisse', undefined, 'Le bas glisse : un trio mal tourné arrive devant, en bas à droite'];
  const lastBottom = (k) => k && [k, ARROW[k], 'Dernier glissé', undefined, 'Le bas glisse jusqu’à ce que tout soit rangé !'];
  const M = {
    R: ['R', '⬆️', 'La droite monte', undefined, 'La droite monte : l’ours arrive à côté du Lion'],
    Li: ["L'", '⬆️', 'La gauche monte', undefined, 'La gauche monte : l’ours arrive à côté du Lion'],
    jump: ['F2', '🦘', 'Grand saut', undefined, 'Grand saut : la face fait 2 tours'],
    downMid: ['F', '🔃', 'Vers le milieu', undefined, 'La face tourne : l’ours va au milieu'],
    dive: ['F2', '🤿', 'Le plongeon !', undefined, 'Le plongeon : la face fait 2 tours'],
  };
  const elev = (n, label) => LB.voyages(n, label);

  /* ---------- Petits outils ---------- */
  const byId = (c, id) => c.pieces.find((p) => p.id === id);
  const at = (p, pos) => p.pos[0] === pos[0] && p.pos[1] === pos[1] && p.pos[2] === pos[2];
  const after = (c, seq) => L.apply(L.clone(c), seq.filter(Boolean).join(' '));
  const isWhiteEdge = (p) => p.type === 'edge' && L.hasColor(p, 'W');
  const isPetal = (p) => p.pos[1] === 1 && L.colorFacing(p, UP) === 'W';
  const fail = (stage) => { const e = new Error('impossible'); e.code = 'impossible'; e.stage = stage; throw e; };

  class Recorder {
    constructor(cube) { this.c = L.clone(cube); this.stages = []; this.all = []; }
    stage(ch) { this.st = { chapter: ch, ...STAGES[ch], intro: INTRO[ch], steps: [] }; this.stages.push(this.st); }
    step(title, text, target) { this.cur = { title, text, target: target == null ? null : target, moves: [] }; this.st.steps.push(this.cur); }
    play(...args) {
      // un argument = un geste ['R', icône, texte…] ou une liste de gestes
      const entries = [];
      for (const a of args) {
        if (!a) continue;
        if (typeof a[0] === 'string') entries.push(a);
        else a.forEach((e) => e && entries.push(e));
      }
      for (const e of entries) {
        if (!e[0]) continue;
        this.cur.moves.push(e);
        this.all.push(e[0]);
        L.apply(this.c, e[0]);
      }
    }
  }

  // Cherche la combinaison (r, k) la plus courte qui rend test() vrai
  function search(c, lists, test) {
    let best = null;
    const rec = (i, chosen) => {
      if (i === lists.length) {
        const cost = chosen.filter(Boolean).length;
        if ((!best || cost < best.cost) && test(after(c, chosen))) best = { cost, chosen: chosen.slice() };
        return;
      }
      for (const x of lists[i]) rec(i + 1, [...chosen, x]);
    };
    rec(0, []);
    return best && best.chosen;
  }

  /* ---------- 1. La pâquerette ---------- */
  function daisy(R) {
    const c0 = R.c;
    const crossDone = c0.pieces.filter(isWhiteEdge).every((p) => L.pieceSolved(c0, p));
    if (crossDone) return true;
    // Plongeons commencés : chaque ours est soit un pétale, soit déjà rangé en bas
    const diving = c0.pieces.filter(isWhiteEdge).every((p) => isPetal(p) || (p.pos[1] === -1 && L.pieceSolved(c0, p)));
    if (diving) { R.stage('ch1'); return false; }
    R.stage('ch1');
    let n = 0;
    for (let guard = 0; guard < 12; guard++) {
      const c = R.c;
      const todo = c.pieces.filter((p) => isWhiteEdge(p) && !isPetal(p));
      if (!todo.length) return false;
      let best = null;
      for (const p0 of todo) for (const r of ROTS) {
        const p = byId(after(c, [r]), p0.id);
        let kind = null;
        if (p.pos[1] === 0 && L.colorFacing(p, FRONT) === 'W') kind = p.pos[0] === 1 ? 'midR' : 'midL';
        else if (at(p, [0, -1, 1]) && L.colorFacing(p, DOWN) === 'W') kind = 'down';
        else if (at(p, [0, -1, 1]) && L.colorFacing(p, FRONT) === 'W') kind = 'bottomSide';
        else if (at(p, [0, 1, 1]) && L.colorFacing(p, FRONT) === 'W') kind = 'flipped';
        if (!kind) continue;
        const cost = (r ? 1 : 0) + { midR: 1, midL: 1, down: 1, bottomSide: 3, flipped: 2 }[kind];
        if (!best || cost < best.cost) best = { cost, r, kind, id: p0.id };
      }
      if (!best) fail('ch1');
      n++;
      const textKey = { midR: 'daisyMid', midL: 'daisyMid', down: 'daisyDown', bottomSide: 'daisyBottomSide', flipped: 'daisyFlipped' }[best.kind];
      R.step(`🌼 Ours ${n}`, TEXT[textKey], best.id);
      R.play(rot(best.r, 'l’ours vient devant toi'));
      const freeSlot = (pos) => free(search(R.c, [UTURNS], (x) => !isPetal(L.pieceAt(x, pos))) [0]);
      if (best.kind === 'midR') R.play(freeSlot([1, 1, 0]), M.R);
      if (best.kind === 'midL') R.play(freeSlot([-1, 1, 0]), M.Li);
      if (best.kind === 'down') R.play(freeSlot([0, 1, 1]), M.jump);
      if (best.kind === 'bottomSide') { R.play(freeSlot([0, 1, 1]), M.downMid); R.play(freeSlot([-1, 1, 0]), M.Li); }
      if (best.kind === 'flipped') { R.play(M.downMid); R.play(freeSlot([1, 1, 0]), M.R); }
      if (!isPetal(byId(R.c, best.id))) fail('ch1');
    }
    fail('ch1');
  }

  /* ---------- 2. Le grand plongeon ---------- */
  function cross(R) {
    R.stage('ch2');
    const petals = R.c.pieces.filter((p) => isWhiteEdge(p) && isPetal(p)).length;
    for (let n = 1; n <= petals; n++) {
      const found = search(R.c, [ROTS, UTURNS], (x) => {
        const p = L.pieceAt(x, [0, 1, 1]);
        return isWhiteEdge(p) && isPetal(p) && L.colorFacing(p, FRONT) === L.centerColor(x, FRONT);
      });
      if (!found) fail('ch2');
      const target = L.pieceAt(after(R.c, found), [0, 1, 1]).id;
      R.step(`🤿 Plongeon ${n}`, TEXT.cross, target);
      R.play(rot(found[0], 'un autre ours vient devant toi'), found[1] && LB.check(found[1]), M.dive);
      if (!L.pieceSolved(R.c, byId(R.c, target))) fail('ch2');
    }
  }

  /* ---------- 3. L'ascenseur des trios ---------- */
  const isWhiteCorner = (p) => p.type === 'corner' && L.hasColor(p, 'W');
  const homeAtDFR = (x, p) => L.hasColor(p, L.centerColor(x, FRONT)) && L.hasColor(p, L.centerColor(x, RIGHT));
  function whiteCorners(R) {
    R.stage('ch3');
    let n = 0;
    for (let guard = 0; guard < 16; guard++) {
      const c = R.c;
      const todo = c.pieces.filter((p) => isWhiteCorner(p) && !L.pieceSolved(c, p));
      if (!todo.length) return;
      const top = todo.filter((p) => p.pos[1] === 1);
      if (top.length) {
        let best = null;
        for (const p0 of top) {
          const f = search(c, [ROTS, UTURNS], (x) => { const p = byId(x, p0.id); return at(p, [1, 1, 1]) && homeAtDFR(x, p); });
          if (f && (!best || f.filter(Boolean).length < best.f.filter(Boolean).length)) best = { f, id: p0.id };
        }
        if (!best) fail('ch3');
        const x = after(c, best.f);
        const p = byId(x, best.id);
        let trips = 0;
        const sim = L.clone(x);
        while (!L.pieceSolved(sim, byId(sim, best.id)) && trips < 6) { L.apply(sim, ELEVATOR); trips++; }
        if (trips >= 6) fail('ch3');
        const face = L.colorFacing(p, RIGHT) === 'W' ? 1 : L.colorFacing(p, UP) === 'W' ? 3 : 5;
        n++;
        R.step(`🛗 Trio ${n}`, TEXT['corner' + face], best.id);
        R.play(rot(best.f[0], 'une maison vide vient devant toi'), above(best.f[1]), elev(trips));
      } else {
        const p0 = todo[0];
        const f = search(c, [ROTS], (x) => at(byId(x, p0.id), [1, -1, 1]));
        const x = after(c, f);
        if (homeAtDFR(x, byId(x, p0.id))) {
          let trips = 0;
          const sim = L.clone(x);
          while (!L.pieceSolved(sim, byId(sim, p0.id)) && trips < 6) { L.apply(sim, ELEVATOR); trips++; }
          if (trips >= 6) fail('ch3');
          R.step('🛗 Trio mal tourné', TEXT.cornerTwisted, p0.id);
          R.play(rot(f[0], 'le trio vient devant toi'), elev(trips));
        } else {
          R.step('🛗 Trio coincé', TEXT.cornerStuck, p0.id);
          R.play(rot(f[0], 'le trio vient devant toi'), elev(1, '🛗 Pour le sortir'));
        }
      }
    }
    fail('ch3');
  }

  /* ---------- 4. Le 2e étage ---------- */
  const isMidEdge = (p) => p.type === 'edge' && !L.hasColor(p, 'Y') && !L.hasColor(p, 'W');
  function middle(R) {
    R.stage('ch4');
    let n = 0;
    for (let guard = 0; guard < 16; guard++) {
      const c = R.c;
      const todo = c.pieces.filter((p) => isMidEdge(p) && !L.pieceSolved(c, p));
      if (!todo.length) return;
      const top = todo.filter((p) => p.pos[1] === 1);
      if (top.length) {
        let best = null;
        for (const p0 of top) {
          const f = search(c, [ROTS, UTURNS], (x) => {
            const p = byId(x, p0.id);
            return at(p, [0, 1, 1]) && L.colorFacing(p, FRONT) === L.centerColor(x, FRONT);
          });
          if (f && (!best || f.filter(Boolean).length < best.f.filter(Boolean).length)) best = { f, id: p0.id };
        }
        if (!best) fail('ch4');
        const x = after(c, best.f);
        const goRight = L.colorFacing(byId(x, best.id), UP) === L.centerColor(x, RIGHT);
        n++;
        R.step(`🚪 Joueur ${n}`, goRight ? TEXT.midRight : TEXT.midLeft, best.id);
        R.play(rot(best.f[0], 'un autre joueur vient devant toi'), best.f[1] && LB.check(best.f[1]), goRight ? LB.SEND_RIGHT : LB.SEND_LEFT);
        if (!L.pieceSolved(R.c, byId(R.c, best.id))) fail('ch4');
      } else {
        const p0 = todo[0];
        const f = search(c, [ROTS], (x) => at(byId(x, p0.id), [1, 0, 1]));
        if (!f) fail('ch4');
        R.step('🚪 Joueur coincé', TEXT.midStuck, p0.id);
        R.play(rot(f[0], 'le joueur coincé vient devant toi, à droite'), LB.SEND_RIGHT);
      }
    }
    fail('ch4');
  }

  /* ---------- 5. Le cri du Lion ---------- */
  const TOP_EDGES = { F: [0, 1, 1], R: [1, 1, 0], B: [0, 1, -1], L: [-1, 1, 0] };
  const shape = (x) => Object.keys(TOP_EDGES).filter((k) => L.colorFacing(L.pieceAt(x, TOP_EDGES[k]), UP) === 'Y').join('');
  function yellowCross(R) {
    R.stage('ch5');
    for (let n = 1; n <= 4; n++) {
      const s = shape(R.c);
      if (s === 'FRBL') {
        if (n === 1) { R.step('📣 Déjà la croix', TEXT.yDone, null); }
        return;
      }
      if (s === '') { R.step('📣 Le point', TEXT.yDot, null); R.play(LB.roar()); continue; }
      if (s.length === 2) {
        const opposite = s === 'FB' || s === 'RL';
        const f = search(R.c, [UTURNS], (x) => shape(x) === (opposite ? 'RL' : 'BL'));
        if (!f) fail('ch5');
        if (opposite) { R.step('📣 La ligne', TEXT.yLine, null); R.play(lieDown(f[0]), LB.roar()); }
        else { R.step('📣 Le coude', TEXT.yElbow, null); R.play(nineOClock(f[0]), LB.roar()); }
        continue;
      }
      fail('ch5'); // 1 ou 3 duos jaunes : impossible
    }
    if (shape(R.c) !== 'FRBL') fail('ch5');
  }

  /* ---------- 6. La ronde des Lions ---------- */
  const matched = (x) => Object.keys(TOP_EDGES).filter((k) => L.pieceSolved(x, L.pieceAt(x, TOP_EDGES[k]))).join('');
  function yellowEdges(R) {
    R.stage('ch6');
    for (let guard = 0; guard < 5; guard++) {
      let best = null;
      for (const k of UTURNS) {
        const m = matched(after(R.c, [k]));
        if (!best || m.length > best.m.length) best = { k, m };
      }
      if (best.m.length === 4) {
        R.step('💃 Dernier check', TEXT.eDone, null);
        if (best.k) R.play(LB.check(best.k));
        return;
      }
      if (best.m.length < 2) fail('ch6');
      const opposite = best.m === 'FB' || best.m === 'RL';
      if (opposite) {
        R.step('💃 Face à face', TEXT.eOpposite, null);
        R.play(best.k && LB.check(best.k), LB.ronde());
      } else {
        R.step('💃 La ronde', TEXT.eAdjacent, null);
        const x = after(R.c, [best.k]);
        const f = search(x, [ROTS], (y) => { const m = matched(y); return m.includes('R') && m.includes('B'); });
        R.play(best.k && LB.check(best.k), rot(f[0], 'les 2 bons duos se placent à 3 heures'), LB.ronde());
      }
    }
    fail('ch6');
  }

  /* ---------- 7. La grande finale ---------- */
  const isYellowCorner = (p) => p.type === 'corner' && L.hasColor(p, 'Y');
  const trioHome = (x, p) => [[p.pos[0], 0, 0], [0, p.pos[1], 0], [0, 0, p.pos[2]]].every((d) => L.hasColor(p, L.centerColor(x, d)));
  function finale(R) {
    R.stage('ch7');
    const homes = (x) => x.pieces.filter((p) => isYellowCorner(p) && trioHome(x, p));
    for (let guard = 0; guard < 5; guard++) {
      const h = homes(R.c);
      if (h.length === 4) break;
      if (guard === 4) fail('ch7');
      if (!h.length) { R.step('🏓 Aucun trio chez lui', TEXT.pNone, null); R.play(LB.pingpong()); continue; }
      const f = search(R.c, [ROTS], (x) => { const p = L.pieceAt(x, [1, 1, 1]); return isYellowCorner(p) && trioHome(x, p); });
      const keep = L.pieceAt(after(R.c, f), [1, 1, 1]).id;
      R.step('🏓 Ping-pong', TEXT.pPlay, keep);
      R.play(rot(f[0], 'le trio dans sa maison vient devant, en haut à droite'), LB.pingpong());
    }
    if (L.isSolved(R.c)) return; // les trios sont déjà bien tournés : fini !
    if (R.st.steps.length === 0) R.step('🏓 Déjà chez eux', TEXT.pDone, null);
    // 2e mi-temps : Lion en bas, ascenseur jusqu'au jaune en dessous, le bas glisse
    R.step('🙃 2e mi-temps', TEXT.tFlip, null);
    R.play(LB.FLIP);
    secondHalf(R);
  }

  // La 2e mi-temps seule (le Lion est déjà en bas) : elle marche aussi si on l'a commencée
  function secondHalf(R) {
    let n = 0;
    for (let guard = 0; guard < 6; guard++) {
      const twisted = (x) => { const p = L.pieceAt(x, [1, -1, 1]); return isYellowCorner(p) && L.colorFacing(p, DOWN) !== 'Y'; };
      const f = search(R.c, [DTURNS], twisted);
      if (!f) break;
      let trips = 0;
      const sim = after(R.c, f);
      const id = L.pieceAt(sim, [1, -1, 1]).id;
      // on suit CE trio : ascenseur jusqu'à ce qu'il revienne en bas à droite, jaune en dessous
      const done = (x) => { const p = byId(x, id); return at(p, [1, -1, 1]) && L.colorFacing(p, DOWN) === 'Y'; };
      do { L.apply(sim, ELEVATOR); trips++; } while (!done(sim) && trips < 6);
      if (!done(sim)) fail('ch7');
      n++;
      R.step(`🛗 Trio Lion ${n}`, TEXT.tCorner, id);
      R.play(bottom(f[0]), elev(trips));
    }
    const f = search(R.c, [DTURNS], (x) => L.isSolved(x));
    if (!f) fail('ch7');
    R.step('🏆 Le dernier glissé', TEXT.tLast, null);
    R.play(lastBottom(f[0]));
  }

  function solve(cube) {
    const R = new Recorder(cube);
    if (L.isSolved(R.c)) return { stages: [], moves: [], alreadySolved: true };
    const skippedCross = daisy(R) === true;
    if (!skippedCross) cross(R);
    else { R.stage('ch2'); R.step('🤿 Croix déjà faite', TEXT.crossDone, null); }
    whiteCorners(R);
    middle(R);
    yellowCross(R);
    yellowEdges(R);
    finale(R);
    if (!L.isSolved(R.c)) fail('end');
    // une étape sans geste (ex : « déjà fait ») reste, pour que Camille comprenne pourquoi on saute
    return { stages: R.stages, moves: R.all };
  }

  /* ---------- Pour les exercices avec le vrai cube ---------- */
  // Le cube de Camille peut être tenu n'importe comment : on cherche d'abord à remettre le Lion en haut.
  const ORIENT = ['', 'x', "x'", 'x2', 'z', "z'"];
  const ORDER = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'done'];
  const orientEntry = (r) => [r, '🙃', 'Lion en haut', undefined, 'Tourne tout ton cube : le Lion passe en haut'];
  // Finir un ascenseur commencé : la 2e mi-temps ne se reprend qu'entre deux trios.
  // On essaie de finir le voyage en cours (0 à 3 gestes), puis 0 à 5 voyages entiers.
  const RESUME = [];
  for (let part = 0; part <= 3; part++) for (let trips = 0; trips <= 5; trips++) RESUME.push({ part, trips });
  RESUME.sort((a, b) => (a.part + 4 * a.trips) - (b.part + 4 * b.trips));

  function trySecondHalf(cube) {
    if (L.centerColor(cube, DOWN) !== 'Y') return null;
    for (const { part, trips } of RESUME) {
      try {
        const R = new Recorder(cube);
        R.stage('ch7');
        if (part || trips) {
          const finish = LB.ELEV_STEPS.slice(4 - part).map(([t, ic, tx, long]) => [t, ic, tx, '🛗 Fin du voyage', long]);
          R.step('🛗 Continue l’ascenseur', TEXT.tFinish, null);
          R.play(finish, elev(trips));
        }
        secondHalf(R);
        if (L.isSolved(R.c)) return R;
      } catch (e) { /* pas une 2e mi-temps */ }
    }
    return null;
  }

  // Un geste composé arrêté au milieu (ping-pong à moitié fait…) casse le cube pour un moment.
  // Si les derniers gestes faits (recent) sont le début d'un geste composé, et que le finir fait avancer
  // d'au moins une étape, le coach dit d'abord : « Finis ton geste ».
  const firstStage = (stages) => {
    const st = stages.find((x) => x.steps.some((s) => s.moves.length));
    return st ? st.chapter : 'done';
  };
  const MACRO_LIST = () => [LB.voyages(1, '🛗 Fin du voyage'), LB.liftL('🛗 Fin de l’ascenseur'), LB.roar(), LB.ronde(),
    LB.pingpong(), LB.SEND_RIGHT, LB.SEND_LEFT];
  function finishMacro(cube, rank0, recent) {
    let best = null;
    for (const m of MACRO_LIST()) {
      for (let k = 1; k < m.length; k++) {
        if (k > recent.length || m.slice(0, k).some((e, i) => e[0] !== recent[recent.length - k + i])) continue;
        const rest = m.slice(k);
        const x = after(cube, rest.map((e) => e[0]));
        let stages;
        if (L.isSolved(x)) stages = [];
        else { try { stages = solve(x).stages; } catch (e) { continue; } }
        const r = ORDER.indexOf(firstStage(stages));
        // à égalité, le geste dont on a reconnu le plus long début (la fin d'un envoi = la fin d'un ascenseur)
        const better = !best || r > best.r || (r === best.r && (rest.length < best.rest.length || (rest.length === best.rest.length && k > best.k)));
        if (r >= rank0 + 1 && better) best = { r, rest, stages, k };
      }
    }
    return best;
  }

  // Le chemin du coach depuis l'état actuel : { done } ou { stages, rot, pre }
  function plan(cube, recent) {
    if (L.isSolved(cube)) return { done: true };
    const half = trySecondHalf(cube);
    if (half) return { stages: half.stages, rot: '' };
    const rot = ORIENT.find((r) => L.centerColor(after(cube, [r]), UP) === 'Y');
    const c = after(cube, [rot]);
    const res = solve(c);
    if (!rot && recent && recent.length) {
      const fin = finishMacro(c, ORDER.indexOf(firstStage(res.stages)), recent);
      if (fin) {
        // L'étape en cours = celle d'avant le geste commencé
        const before = after(c, L.invert(recent.slice(-fin.k).join(' ')).split(' '));
        const start = L.isSolved(before) ? 'done' : firstStage(solve(before).stages);
        return { stages: fin.stages, rot, pre: fin.rest, preChapter: ORDER[fin.r], current: start };
      }
    }
    return { stages: res.stages, rot };
  }

  // Première étape pas encore finie : 'ch1' … 'ch7', ou 'done'.
  // Avec recent (les derniers gestes faits) : au milieu d'un geste composé, l'étape où on en était.
  function progress(cube, recent) {
    const p = plan(cube, recent);
    if (p.done) return 'done';
    if (p.pre) return p.current;
    return firstStage(p.stages);
  }

  // Le prochain conseil du coach : { chapter, icon, stageTitle, title, text, target, moves } ou null
  function hint(cube, recent) {
    const p = plan(cube, recent);
    if (p.done) return null;
    if (p.pre && !p.rot) {
      const ch = p.preChapter === 'done' ? 'ch7' : p.preChapter;
      return { chapter: ch, ...STAGES[ch], stageTitle: STAGES[ch].title, title: '✋ Finis ton geste', text: TEXT.finishMacro, target: null, moves: p.pre };
    }
    const st = p.stages.find((x) => x.steps.some((s) => s.moves.length));
    if (!st) return null;
    const info = { chapter: st.chapter, icon: st.icon, stageTitle: st.title };
    if (p.rot) return { ...info, title: '🦁 Lion en haut', text: TEXT.orient, target: null, moves: [orientEntry(p.rot)] };
    const step = st.steps.find((s) => s.moves.length);
    // Chaque conseil est recalculé : pas de numéro (« Ours 1 » à chaque fois serait bizarre)
    return { ...info, ...step, title: step.title.replace(/ \d+$/, '') };
  }

  // « Le coach mélange juste ce qu'il faut » : des gestes qui ramènent le cube au début de l'étape ch
  const MIX = '🌀 On mélange';
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const one = (t) => t && [t, root.Content.SAY[t][0], root.Content.SAY[t][1], MIX];
  const MIXERS = {
    ch1: () => {
      const out = [];
      let prev = '';
      for (let i = 0; i < 7; i++) {
        let t;
        do { t = pick(['R', "R'", 'L', "L'", 'U', "U'", 'F', "F'", 'D', "D'"]); } while (t[0] === prev);
        prev = t[0];
        out.push(one(t));
      }
      return out;
    },
    ch2: () => [0, 1, 2, 3].flatMap(() => [one(pick(['', 'y', "y'"])), one(pick(['', 'U', "U'"])), one('F2')]),
    ch3: () => [0, 1].flatMap(() => [one(pick(['', 'y', "y'"])), one(pick(['', 'U', "U'"])), ...elev(pick([1, 2]), '🛗 Ascenseur')]),
    ch4: () => [one(pick(['', 'y', "y'"])), one(pick(['', 'U', "U'"])), ...pick([LB.SEND_RIGHT, LB.SEND_LEFT])],
    ch5: () => [one(pick(['', 'U', "U'"])), ...LB.roar(), ...(Math.random() < 0.5 ? [one(pick(['U', "U'"])), ...LB.roar()] : [])],
    ch6: () => [one(pick(['', 'U', "U'"])), ...LB.ronde(), ...(Math.random() < 0.5 ? [one(pick(['y', "y'"])), ...LB.ronde()] : [])],
    ch7: () => [one(pick(['', 'y', "y'"])), ...LB.pingpong(), ...(Math.random() < 0.6 ? [one(pick(['y', "y'"])), ...LB.pingpong()] : [])],
  };
  function practice(cube, ch) {
    let best = null;
    for (let k = 0, found = 0; k < 120 && found < 4; k++) {
      const moves = MIXERS[ch]().filter(Boolean);
      const x = after(cube, moves.map((m) => m[0]));
      if (progress(x) !== ch) continue;
      found++;
      if (!best || moves.length < best.length) best = moves;
    }
    return best;
  }

  function speechTexts() {
    const out = [...Object.values(TEXT), ...Object.values(INTRO)];
    orientEntry('x').slice(2).forEach((t) => t && out.push(t));
    const labels = [M.R, M.Li, M.jump, M.downMid, M.dive, free('U'), above('U'), nineOClock('U'), lieDown('U'), bottom('D'), lastBottom('D'),
      rot('y', ''), rot('y2', ''), ...elev(1, 'x'), ...LB.liftR(), ...LB.liftL(), ...LB.roar(), ...LB.ronde(), ...LB.pingpong(),
      ...LB.SEND_RIGHT, ...LB.SEND_LEFT, LB.check('U'), LB.FLIP];
    labels.forEach((l) => l && out.push(l[2]));
    return out;
  }

  const api = { solve, speechTexts, STAGES, ORDER, plan, progress, hint, practice };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Solver = api;
})(typeof window !== 'undefined' ? window : globalThis);
