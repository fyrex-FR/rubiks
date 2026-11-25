/* ============================================================
   LES HISTOIRES DU COACH
   C'est ici qu'on écrit (et qu'on modifie !) les chapitres.
   Chaque chapitre = une liste d'écrans ("slides").
   Un écran peut avoir :
     - title / text : ce que dit le coach (on peut utiliser <b>gras</b>)
     - scene : ce que montre le cube 3D
         setup  : les mouvements faits en secret avant (pour préparer le cube)
         moves  : les mouvements qu'on montre (bouton ▶)
         view   : 'normal', 'top' (vu d'en haut), 'below' (vu d'en dessous), 'front', 'under'
         hl     : quelles pièces restent allumées (les autres sont grisées)
     - trainer : true pour afficher les boutons d'entraînement
     - teams   : true pour afficher les 6 équipes
     - quiz    : des questions
   ============================================================ */
(function () {
  const L = window.CubeLogic;
  const inv = L.invert;

  /* ---------- Les 6 équipes ---------- */
  const TEAMS = {
    Y: { animal: 'Lions', one: 'Lion', emoji: '🦁', color: 'jaune' },
    W: { animal: 'Ours polaires', one: 'Ours polaire', emoji: '🐻‍❄️', color: 'blanc' },
    G: { animal: 'Grenouilles', one: 'Grenouille', emoji: '🐸', color: 'vert' },
    B: { animal: 'Dauphins', one: 'Dauphin', emoji: '🐬', color: 'bleu' },
    O: { animal: 'Tigres', one: 'Tigre', emoji: '🐯', color: 'orange' },
    R: { animal: 'Renards', one: 'Renard', emoji: '🦊', color: 'rouge' },
  };

  /* ---------- Comment le coach dit chaque geste ---------- */
  const SAY = {
    R: ['⬆️', 'La droite monte'], "R'": ['⬇️', 'La droite descend'], R2: ['↕️', 'La droite fait 2 tours'],
    L: ['⬇️', 'La gauche descend'], "L'": ['⬆️', 'La gauche monte'], L2: ['↕️', 'La gauche fait 2 tours'],
    U: ['⬅️', 'Le haut glisse à gauche'], "U'": ['➡️', 'Le haut glisse à droite'], U2: ['🔁', 'Le haut fait 2 tours'],
    D: ['➡️', 'Le bas glisse à droite'], "D'": ['⬅️', 'Le bas glisse à gauche'], D2: ['🔁', 'Le bas fait 2 tours'],
    F: ['🔃', 'La face tourne vers la droite'], "F'": ['🔄', 'La face tourne vers la gauche'], F2: ['🔃', 'La face fait 2 tours'],
    B: ['🔙', 'Le dos tourne'], "B'": ['🔙', 'Le dos tourne'], B2: ['🔙', 'Le dos fait 2 tours'],
    y: ['🔄', 'Tout le cube tourne : la droite vient devant toi'],
    "y'": ['🔄', 'Tout le cube tourne : la gauche vient devant toi'],
    y2: ['🔄', 'Tout le cube fait un demi-tour'],
    z2: ['🙃', 'Retourne le cube la tête en bas'],
  };

  /* ---------- Quelles pièces on allume ---------- */
  const isWhiteEdge = (p) => p.type === 'edge' && L.hasColor(p, 'W');
  const at = (p, x, y, z) => p.pos[0] === x && p.pos[1] === y && p.pos[2] === z;
  const HL = {
    centers: (p) => p.type === 'center',
    edges: (p) => p.type === 'edge',
    corners: (p) => p.type === 'corner',
    whiteEdges: isWhiteEdge,
    daisy: (p) => isWhiteEdge(p) || (p.type === 'center' && L.hasColor(p, 'Y')),
    cross: (p) => isWhiteEdge(p) || p.type === 'center',
    firstPetal: (p) => (isWhiteEdge(p) && at(p, -1, 1, 0)) || p.type === 'center',
    bottom: (p) => p.pos[1] === -1 || p.type === 'center',
    whiteTeam: (p) => L.hasColor(p, 'W') || p.type === 'center',
    trioBackRight: (p) => at(p, 1, 1, -1) || p.type === 'center',
    trioTopRight: (p) => at(p, 1, 1, 1) || p.type === 'center',
    trioBottomRight: (p) => at(p, 1, -1, 1) || p.type === 'center',
    twoFloors: (p) => p.pos[1] <= 0 || p.type === 'center',
    midDuos: (p) => (p.type === 'edge' && !L.hasColor(p, 'Y') && !L.hasColor(p, 'W')) || p.type === 'center',
    duoTopRight: (p) => at(p, 1, 1, 0) || p.type === 'center',
    duoFront: (p) => at(p, 0, 1, 1) || p.type === 'center',
    duoStuck: (p) => at(p, 1, 0, 1) || at(p, 0, 1, 1) || p.type === 'center',
    lionTrios: (p) => (p.type === 'corner' && L.hasColor(p, 'Y')) || p.type === 'center',
    trioFrontRight: (p) => at(p, 1, 1, 1) || p.type === 'center',
    lionRonde: (p) => (p.type === 'edge' && L.hasColor(p, 'Y')) || p.type === 'center',
    lionDuos: (p) => (p.type === 'edge' && L.hasColor(p, 'Y')) || (p.type === 'center' && L.hasColor(p, 'Y')),
  };

  /* ---------- Les cubes préparés (vérifiés par script) ---------- */
  const SCRAMBLE = "R U' F2 L D B' R2 U F' D2 L' B U2 R' F";
  // Pâquerette terminée (le reste du cube est mélangé)
  const DAISY = "F2 R2 B2 L2 D R D R' F D2 F' L D' L' B D B' D2";
  // Pâquerette à 3 pétales (le 4e ours est caché en bas)
  const DAISY3 = DAISY + ' F2 D F2';
  // Croix blanche terminée
  const CROSS = "R U R' U F U2 F' L' U' L U2 B U B' R' U R U'";
  // Le chemin pâquerette -> croix : check, plongeon, on tourne le cube... 4 fois
  const CROSS_PATH = [
    ["U'", '➡️', 'Le haut glisse… jusqu’au capitaine ✋'], ['F2', '🤿', 'Le plongeon !'], ['y', '🔄', 'Au suivant : tout le cube tourne'],
    ['U', '⬅️', 'Le haut glisse… jusqu’au capitaine ✋'], ['F2', '🤿', 'Le plongeon !'], ['y', '🔄', 'Au suivant : tout le cube tourne'],
    ['F2', '🤿', 'Déjà au-dessus de son capitaine : plongeon direct !'], ['y', '🔄', 'Au suivant : tout le cube tourne'],
    ['U', '⬅️', 'Le haut glisse… jusqu’au capitaine ✋'], ['F2', '🤿', 'Le plongeon !'],
  ];
  const CROSS_START = CROSS + ' ' + inv(CROSS_PATH.map((m) => m[0]).join(' '));

  /* ---------- L'ascenseur (chapitre 3) ---------- */
  const ELEVATOR = "R U R' U'";
  const ELEV_STEPS = [
    ['R', '⬆️', 'Monte', 'Monte : la droite monte'],
    ['U', '⬅️', 'Ouvre', 'Ouvre : le haut glisse à gauche'],
    ["R'", '⬇️', 'Descend', 'Descend : la droite descend'],
    ["U'", '➡️', 'Ferme', 'Ferme : le haut revient à droite'],
  ];
  // n voyages d'ascenseur, numérotés "Voyage 1, 2, 3…"
  const voyages = (n, label) => Array.from({ length: n }, (_, i) =>
    ELEV_STEPS.map(([t, ic, tx, long]) => [t, ic, tx, label || `🛗 Voyage ${i + 1}`, long])).flat();
  const MACROS = [{ icon: '🛗', label: 'Un voyage d’ascenseur', seq: ELEVATOR }];
  const toks = (path) => path.map((m) => m[0]).join(' ');
  const TURN = ['y', '🔄', 'Tourne le cube', undefined, 'Tout le cube tourne : une autre maison vide vient devant toi'];
  const ABOVE = ['U', '⬅️', 'Le haut glisse', undefined, 'Le haut glisse : le trio arrive au-dessus de sa maison'];

  // Terrain blanc fini (1re couronne), le reste mélangé
  const FIRST = "U R U' R' U' F' U F U2 L' U L U F U' F' U' F R U R' U' F' U R U R' U R U2 R' U' L' U' L U F U F' U2";
  // Les 4 trios rentrent : blanc à droite (1 voyage), en haut (3), devant (5), à droite (1)
  const CORNER_PATH = [ABOVE, ...voyages(1), TURN, ...voyages(3), TURN, ...voyages(5), TURN, ABOVE, ...voyages(1)];
  const CORNER_START = FIRST + ' ' + inv(toks(CORNER_PATH));
  const WHITE_UP = CORNER_START + ' U ' + ELEVATOR + ' y'; // trio au-dessus de sa maison, blanc en haut
  // Trio coincé en bas, pas chez lui
  const STUCK_PATH = [...voyages(1, '🛗 Voyage pour le sortir'), TURN, ["U'", '➡️', 'Le haut glisse', undefined, 'Le haut glisse : le trio arrive au-dessus de sa maison'], ...voyages(1)];
  const STUCK = FIRST + ' ' + inv(toks(STUCK_PATH));
  // Trio chez lui mais mal tourné
  const TWISTED = FIRST + ' ' + inv(ELEVATOR + ' ' + ELEVATOR);
  const atDFR = (cube) => L.pieceSolved(cube, L.pieceAt(cube, [1, -1, 1]));

  /* ---------- Le 2e étage (chapitre 4) ---------- */
  // L'ascenseur gauche : le même geste, en miroir, avec la main gauche
  const ELEVATOR_LEFT = "L' U' L U";
  const ELEV_LEFT_STEPS = [
    ["L'", '⬆️', 'Monte', 'Monte : la gauche monte'],
    ["U'", '➡️', 'Ouvre', 'Ouvre : le haut glisse à droite'],
    ['L', '⬇️', 'Descend', 'Descend : la gauche descend'],
    ['U', '⬅️', 'Ferme', 'Ferme : le haut revient à gauche'],
  ];
  const liftR = (label = '🛗 Ascenseur droit') => ELEV_STEPS.map(([t, ic, tx, long]) => [t, ic, tx, label, long]);
  const liftL = (label = '🛗 Ascenseur gauche') => ELEV_LEFT_STEPS.map(([t, ic, tx, long]) => [t, ic, tx, label, long]);
  const CHECK_ICON = { U: '⬅️', "U'": '➡️', U2: '🔁' };
  const check = (k) => [k, CHECK_ICON[k], 'Check ✋', undefined, 'Le haut glisse jusqu’au check : sa couleur au-dessus de son capitaine ✋'];
  // Envoyer un joueur à droite : il s'éloigne, ascenseur de son côté, on le suit, ascenseur de l'autre main
  const SEND_RIGHT = [
    ['U', '⬅️', 'S’éloigne', undefined, 'Il s’éloigne : le haut glisse à gauche'],
    ...liftR(),
    ['y', '🔄', 'On le suit', undefined, 'On le suit : tout le cube tourne, la droite vient devant toi'],
    ...liftL(),
  ];
  const SEND_LEFT = [
    ["U'", '➡️', 'S’éloigne', undefined, 'Il s’éloigne : le haut glisse à droite'],
    ...liftL(),
    ["y'", '🔄', 'On le suit', undefined, 'On le suit : tout le cube tourne, la gauche vient devant toi'],
    ...liftR(),
  ];
  const NEXT_PLAYER = ['y2', '🔄', 'Tourne le cube', undefined, 'Tourne le cube : un autre joueur est déjà au-dessus de son capitaine'];
  // 2 étages finis, le haut mélangé
  const TWO = "R U R' U R U2 R' U F R U R' U' F' U2 R U2 R' U' R U' R' U2";
  // Les 4 joueurs descendent : droite, droite, gauche, gauche
  const MID_PATH = [check('U'), ...SEND_RIGHT, check('U'), ...SEND_RIGHT, NEXT_PLAYER, ...SEND_LEFT, check('U2'), ...SEND_LEFT];
  const MID_START = TWO + ' ' + inv(toks(MID_PATH));
  const RIGHT_CASE = TWO + ' ' + inv(toks(SEND_RIGHT));
  const LEFT_CASE = TWO + ' ' + inv(toks(SEND_LEFT));
  // Joueur coincé à l'envers au 2e étage
  const STUCK_MID_PATH = [
    ['U', '⬅️', 'S’éloigne', undefined, 'On prend un duo Lion du haut… le haut glisse à gauche'],
    ...liftR('🛗 Pour le sortir'),
    ['y', '🔄', 'On le suit', undefined, 'On le suit : la droite vient devant toi'],
    ...liftL('🛗 Pour le sortir'),
    ["y'", '🔄', 'Tourne le cube', undefined, 'Tourne le cube pour revenir face au joueur'],
    check('U'),
    ...SEND_RIGHT,
  ];
  const STUCK_MID = TWO + ' ' + inv(toks(STUCK_MID_PATH));
  const twoFloorsDone = (cube) => cube.pieces.filter((p) => p.pos[1] <= 0).every((p) => L.pieceSolved(cube, p));
  /* ---------- Le cri du Lion (chapitre 5) ---------- */
  // Petit dessin du dessus, vu d'en haut (la face de devant est en bas du dessin)
  // '1' = jaune, '2' = duo jaune déjà à sa place (check fait)
  const mini = (cells) => `<span class="mini" aria-hidden="true">${[...cells].map((c) => `<i class="${c === '1' ? 'y' : c === '2' ? 'y ok' : ''}"></i>`).join('')}</span>`;
  const SHAPE = { dot: '000010000', elbow: '010110000', line: '000111000', cross: '010111010', standing: '010010010' };
  const ROAR = "F R U R' U' F'";
  const roar = (n) => {
    const g = n ? `🦁 Rugissement ${n}` : '🦁 Rugissement';
    return [
      ['F', '🔃', 'Porte', g, 'Porte tournante : la face tourne vers la droite'],
      ...ELEV_STEPS.map(([t, ic, tx, long]) => [t, ic, tx, g, long]),
      ["F'", '🔄', 'Porte retour', g, 'Porte retour : la face tourne vers la gauche'],
    ];
  };
  const toNine = ['U2', '🔁', 'À 9 heures', undefined, 'Le haut fait 2 tours : le coude se place à 9 heures 🕘'];
  // Croix jaune faite, 2 étages rangés, le reste du haut mélangé
  const YCROSS = "R U R' U R U2 R' U2 R U R' U' R' F R2 U' R' U' R U R' F' U";
  const LINE = YCROSS + ' ' + inv(ROAR);
  const ELBOW = YCROSS + ' ' + inv(ROAR + ' ' + ROAR);
  const DOT_PATH = [...roar(1), toNine, ...roar(2), ...roar(3)];
  const DOT = YCROSS + ' ' + inv(toks(DOT_PATH));
  const STANDING = YCROSS + ' ' + inv('U ' + ROAR);
  const yellowCross = (cube) => [[0, 1, 1], [1, 1, 0], [0, 1, -1], [-1, 1, 0]]
    .every((pos) => L.colorFacing(L.pieceAt(cube, pos), [0, 1, 0]) === 'Y');
  const MACROS_ROAR = [{ icon: '🦁', label: 'Rugissement', seq: ROAR }];

  /* ---------- La ronde des Lions (chapitre 6) ---------- */
  const RONDE = "R U R' U R U2 R'";
  const ronde = (n) => {
    const g = n ? `💃 Ronde ${n}` : '💃 La ronde';
    return [
      ['R', '⬆️', 'Monte', 'Monte : la droite monte'],
      ['U', '⬅️', 'Glisse', 'Glisse : le haut glisse à gauche'],
      ["R'", '⬇️', 'Descend', 'Descend : la droite descend'],
      ['U', '⬅️', 'Glisse', 'Glisse : le haut glisse à gauche'],
      ['R', '⬆️', 'Monte', 'Monte : la droite monte'],
      ['U2', '⬅️', 'Glisse ×2', 'Double glisse : le haut glisse 2 fois à gauche'],
      ["R'", '⬇️', 'Descend', 'Descend : la droite descend'],
    ].map(([t, ic, tx, long]) => [t, ic, tx, g, long]);
  };
  const finalCheck = ['U', '⬅️', 'Check final ✋', undefined, 'Le haut glisse : tous les duos Lion font leur check ✋'];
  const toThree = ["y'", '🔄', 'À 3 heures', undefined, 'Tourne tout le cube : les 2 bons duos se placent à 3 heures 🕒'];
  // 2 étages + croix jaune bien rangée ; seuls les coins du haut restent mélangés
  const EDGES_DONE = "R' F R' B2 R F' R' B2 R2 R' D' R D R' D' R D U R' D' R D R' D' R D R' D' R D R' D' R D U'";
  const AT_THREE = EDGES_DONE + ' ' + inv(RONDE + ' U');
  const CHECK_FIRST = EDGES_DONE + ' ' + inv("U' " + RONDE + ' U');
  const WRONG_HOUR = EDGES_DONE + ' ' + inv("y' " + RONDE + ' U');
  const OPPOSITE_PATH = [check('U'), ...ronde(1), toThree, ...ronde(2), finalCheck];
  const OPPOSITE = EDGES_DONE + ' ' + inv(toks(OPPOSITE_PATH));
  const topEdgesDone = (cube) => [[0, 1, 1], [1, 1, 0], [0, 1, -1], [-1, 1, 0]]
    .every((pos) => L.pieceSolved(cube, L.pieceAt(cube, pos)));
  const MACROS_RONDE = [{ icon: '💃', label: 'La ronde', seq: RONDE }];

  /* ---------- La grande finale (chapitre 7) ---------- */
  // Le ping-pong : le haut va et vient, les mains montent puis descendent chacune leur tour
  const PINGPONG = "U R U' L' U R' U' L";
  const pingpong = (n) => {
    const g = n ? `🏓 Ping-pong ${n}` : '🏓 Ping-pong';
    return [
      ['U', '⬅️', 'Glisse', 'Glisse : le haut glisse à gauche'],
      ['R', '⬆️', 'Droite monte', 'La droite monte'],
      ["U'", '➡️', 'Retour', 'Retour : le haut glisse à droite'],
      ["L'", '⬆️', 'Gauche monte', 'La gauche monte'],
      ['U', '⬅️', 'Glisse', 'Glisse : le haut glisse à gauche'],
      ["R'", '⬇️', 'Droite descend', 'La droite descend'],
      ["U'", '➡️', 'Retour', 'Retour : le haut glisse à droite'],
      ['L', '⬇️', 'Gauche descend', 'La gauche descend'],
    ].map(([t, ic, tx, long]) => [t, ic, tx, g, long]);
  };
  const FLIP = ['z2', '🙃', 'Retourne le cube', undefined, 'Retourne le cube comme une roue : le Lion passe en bas'];
  const nextTrio = ['D', '➡️', 'Le bas glisse', undefined, 'Le bas glisse : le trio suivant arrive devant, en bas à droite'];
  const lastSlide = ["D'", '⬅️', 'Dernier glissé', undefined, 'Le bas glisse jusqu’à ce que tout soit rangé !'];
  const holdTrio = ['y', '🔄', 'Le bon trio devant', undefined, 'Tourne tout le cube : le trio bien placé vient devant, en haut à droite'];
  // Partie 2 : tourner les trios (Lion en bas) — 2 voyages pour le 1er, 4 pour le 2e
  const TWIST_PATH = [FLIP, ...voyages(2), nextTrio, ...voyages(4), lastSlide];
  const PLACED = 'z2 ' + inv(toks(TWIST_PATH)); // trios Lion à leur place, mais mal tournés (Lion en haut)
  const FLIPPED = PLACED + ' z2';
  // Partie 1 : placer les trios
  const ONE_HOME = PLACED + ' ' + inv(PINGPONG);
  const ONE_HOME_TWICE = PLACED + ' ' + inv(PINGPONG + ' ' + PINGPONG);
  const PLACE_PATH = [...pingpong(1), holdTrio, ...pingpong(2)];
  const NONE_HOME = PLACED + ' ' + inv(toks(PLACE_PATH));
  const FINAL_PATH = [...PLACE_PATH, ...TWIST_PATH];
  // Un trio est "à sa place" si ses 3 couleurs sont celles des 3 capitaines autour, même s'il est mal tourné
  const trioHome = (cube, p) => [[p.pos[0], 0, 0], [0, p.pos[1], 0], [0, 0, p.pos[2]]]
    .every((d) => L.hasColor(p, L.centerColor(cube, d)));
  const allTriosHome = (cube) => cube.pieces.filter((p) => p.type === 'corner' && L.hasColor(p, 'Y')).every((p) => trioHome(cube, p));
  const MACROS_PP = [{ icon: '🏓', label: 'Ping-pong', seq: PINGPONG }];

  const MACROS_LR = [
    { icon: '🛗', label: 'Ascenseur droit', seq: ELEVATOR },
    { icon: '🛗', label: 'Ascenseur gauche', seq: ELEVATOR_LEFT },
  ];

  /* ============================================================ */
  const CHAPTERS = [
    {
      id: 'ch0',
      num: 0,
      icon: '🏟️',
      title: 'Bienvenue au stade',
      subtitle: 'Les équipes, les capitaines et les gestes du coach',
      medal: 'Médaille de la recrue',
      slides: [
        {
          title: 'Bienvenue au Grand Tournoi !',
          text: `Salut Camille ! Moi, c'est <b>Coach Panda</b> 🐼.<br>
                 Ton Rubik's Cube, c'est un <b>stade</b> où jouent 6 équipes d'animaux.
                 Là, tout le monde est mélangé... Ta mission : remettre chaque équipe sur son terrain.<br><br>
                 Appuie sur <b>▶ Regarder</b> pour voir ce que tu sauras faire à la fin !`,
          scene: { setup: SCRAMBLE, moves: inv(SCRAMBLE), speed: 'magic', caption: ['✨', 'Magie… tout se range !'] },
        },
        {
          title: 'Les 6 équipes',
          text: `Chaque couleur, c'est une équipe.<br>
                 Le <b>blanc</b> et le <b>jaune</b> sont toujours face à face, comme deux équipes qui se regardent avant le match.<br><br>
                 👆 Fais glisser ton doigt sur le cube pour regarder tout autour.`,
          teams: true,
          scene: { setup: '' },
        },
        {
          title: 'Les capitaines ⭐',
          text: `Au milieu de chaque face, il y a le <b>capitaine</b>. C'est le chef de l'équipe.<br><br>
                 Son super-pouvoir : il ne bouge <b>jamais</b> de sa place ! Appuie sur ▶ : on mélange tout... et les capitaines restent au milieu.`,
          scene: { setup: '', hl: 'centers', moves: "R U F' L D' U2 R'", caption: ['🌀', 'On mélange…'] },
        },
        {
          title: 'Les duos',
          text: `Sur les bords, il y a des pièces avec <b>2 couleurs</b>. Ce sont les <b>duos</b> : deux joueurs de deux équipes qui se tiennent par la main.<br><br>
                 Il y en a <b>12</b>. Un duo reste toujours ensemble, même quand on mélange.`,
          scene: { setup: SCRAMBLE, hl: 'edges' },
        },
        {
          title: 'Les trios',
          text: `Dans les coins, il y a les <b>trios</b> : <b>3 couleurs</b>, 3 équipes collées ensemble.<br><br>
                 Il y en a <b>8</b>. Un trio ne devient jamais un duo : ils restent toujours dans les coins.`,
          scene: { setup: SCRAMBLE, hl: 'corners' },
        },
        {
          title: 'Comment tenir ton cube',
          text: `Prends ton cube dans tes mains. La face qui te regarde, c'est <b>la face de devant</b>.<br><br>
                 Pendant tout l'entraînement, le capitaine <b>Lion 🦁 (jaune)</b> sera <b>en haut</b>.
                 Et le capitaine <b>Ours polaire 🐻‍❄️ (blanc)</b> sera donc en dessous.`,
          scene: { setup: '', view: 'front' },
        },
        {
          title: 'Les gestes du coach',
          text: `Le coach ne parle pas en lettres compliquées : il te dit juste <b>quoi bouger</b>.
                 Appuie sur les boutons pour essayer, et fais pareil sur ton vrai cube !<br><br>
                 🔎 <b>Défi :</b> fais 4 fois « La droite monte ». Qu'est-ce qui se passe ?`,
          trainer: true,
          scene: { setup: '' },
        },
        {
          title: 'Petit quiz du coach',
          text: `Avant de gagner ta première médaille, 3 petites questions !`,
          quiz: [
            { q: 'Combien de couleurs sur un trio ?', options: ['2', '3', '4'], answer: 1, bravo: 'Oui ! Un trio, c\'est 3 couleurs, dans un coin.' },
            { q: 'Un capitaine peut-il changer de place ?', options: ['Oui', 'Non, jamais !'], answer: 1, bravo: 'Exact ! Le capitaine reste toujours au milieu.' },
            { q: 'Quelle couleur est en face du blanc ?', options: ['Jaune', 'Rouge', 'Vert'], answer: 0, bravo: 'Bravo ! Lions et Ours polaires sont face à face.' },
          ],
          scene: { setup: SCRAMBLE, hl: 'centers' },
        },
      ],
    },

    {
      id: 'ch1',
      num: 1,
      icon: '🌼',
      title: "L'échauffement",
      subtitle: 'La pâquerette : les ours polaires autour du Lion',
      medal: 'Médaille de la pâquerette',
      slides: [
        {
          title: 'Ton objectif : une fleur',
          text: `Avant le match, les 4 <b>duos ours polaires</b> 🐻‍❄️ (les duos qui ont du blanc) viennent s'échauffer autour du capitaine Lion 🦁.<br><br>
                 Vu d'en haut, ça fait une fleur : <b>une pâquerette</b> 🌼 ! Un cœur jaune, 4 pétales blancs.`,
          scene: { setup: DAISY, view: 'top', hl: 'daisy' },
        },
        {
          title: 'Trouve les ours polaires',
          text: `Lion en haut. Cherche les <b>duos qui ont du blanc</b> : il y en a 4.<br>
                 Attention, seulement les <b>duos</b> (2 couleurs), pas les trios !<br><br>
                 Ils peuvent être en haut, au milieu ou en bas. 👆 Fais tourner le cube avec ton doigt pour tous les trouver.`,
          scene: { setup: SCRAMBLE, hl: 'whiteEdges' },
        },
        {
          title: 'Situation 1 : l’ours est au milieu',
          text: `Cet ours est à l'étage du milieu, et son blanc te regarde.<br>
                 La place juste au-dessus de lui, à côté du Lion, est libre ?<br><br>
                 Alors <b>la droite monte</b>… et hop, il arrive à côté du Lion !`,
          scene: { setup: DAISY + " R'", moves: 'R', hl: 'daisy' },
        },
        {
          title: 'Et s’il est à gauche ?',
          text: `Pareil de l'autre côté ! S'il est au milieu à gauche, c'est <b>la gauche qui monte</b>.`,
          scene: { setup: DAISY + ' L', moves: "L'", hl: 'daisy' },
        },
        {
          title: 'La règle d’or ⚠️',
          text: `Avant de faire monter un ours, regarde la place au-dessus de lui.<br>
                 S'il y a <b>déjà un ours</b>, il va tomber !<br><br>
                 Alors d'abord, <b>le haut glisse</b> pour faire de la place. Ensuite seulement, l'ours monte.`,
          scene: {
            setup: DAISY + ' ' + inv('U R'),
            moves: [['U', '⬅️', 'Le haut glisse : on fait de la place'], ['R', '⬆️', 'La droite monte']],
            hl: 'daisy',
          },
        },
        {
          title: 'Situation 2 : il regarde par terre',
          text: `Cet ours est tout en bas, et son blanc regarde le sol.<br>
                 Vérifie que la place juste au-dessus de lui est libre (règle d'or !).<br><br>
                 Puis la face fait <b>2 tours</b> : l'ours fait un grand saut jusqu'en haut !`,
          scene: { setup: DAISY + ' F2', moves: [['F2', '🦘', 'Grand saut : la face fait 2 tours']], hl: 'daisy', view: 'below' },
        },
        {
          title: 'Situation 3 : la tête à l’envers',
          text: `Parfois, l'ours est bien en haut, mais son blanc regarde <b>sur le côté</b>. Pas grave !<br><br>
                 La face tourne pour le faire descendre au milieu… et c'est la situation 1 !
                 (N'oublie pas la règle d'or.)`,
          scene: {
            setup: DAISY3 + ' ' + inv('F R'),
            moves: [['F', '🔃', 'La face tourne : il descend au milieu'], ['R', '⬆️', 'La droite monte']],
            hl: 'daisy',
          },
        },
        {
          title: 'Même chose en bas',
          text: `S'il est en bas et que son blanc te regarde : la face tourne pour le mettre au milieu, puis il monte.<br><br>
                 💡 Le truc à retenir : <b>on ramène toujours l'ours au milieu</b>, puis il monte.`,
          scene: {
            setup: DAISY3 + ' ' + inv("F L'"),
            moves: [['F', '🔃', 'La face tourne : il remonte au milieu'], ["L'", '⬆️', 'La gauche monte']],
            hl: 'daisy',
            view: 'front',
          },
        },
        {
          title: 'Question du coach',
          text: `Une seule question, mais c'est la plus importante !`,
          quiz: [
            {
              q: 'Avant de faire monter un ours, je vérifie…',
              options: ['Que la place au-dessus est libre', 'Que le cube est propre', 'Qu’il est l’heure du goûter'],
              answer: 0,
              bravo: 'Oui ! C’est la règle d’or. Sinon, le haut glisse pour faire de la place.',
            },
          ],
          scene: { setup: DAISY, view: 'top', hl: 'daisy' },
        },
        {
          title: 'À toi de jouer, Camille !',
          text: `Prends ton cube et fabrique ta pâquerette. Prends ton temps : il n'y a pas de chrono !<br><br>
                 Quand tu as le <b>cœur jaune avec 4 pétales blancs</b> autour, appuie sur le bouton pour gagner ta médaille.`,
          scene: { setup: DAISY, view: 'top', hl: 'daisy' },
          finish: true,
        },
      ],
    },

    {
      id: 'ch2',
      num: 2,
      icon: '🤿',
      title: 'Le grand plongeon',
      subtitle: 'La croix blanche : chaque ours retrouve son capitaine',
      medal: 'Médaille du plongeon',
      slides: [
        {
          title: 'Ton objectif : une croix',
          text: `Les ours polaires vont maintenant rejoindre <b>leur terrain, tout en bas</b>.<br><br>
                 À la fin, sous ton cube, il y aura une <b>croix blanche</b>. Et sur les côtés, chaque ours sera juste en dessous du capitaine de son équipe.`,
          scene: { setup: CROSS, view: 'below', hl: 'cross' },
        },
        {
          title: 'Chaque ours a un maillot',
          text: `On part de ta pâquerette. Regarde l'ours qui brille, à gauche : il a du blanc sur la tête, et une autre couleur sur le côté.<br><br>
                 Cette couleur, c'est son <b>maillot</b> ! Lui porte le maillot <b>orange</b> des Tigres 🐯. Il doit retrouver le capitaine Tigre.`,
          scene: { setup: CROSS_START, hl: 'firstPetal' },
        },
        {
          title: 'Le check ✋',
          text: `Fais glisser le haut jusqu'à ce que le maillot de l'ours soit <b>juste au-dessus de son capitaine</b>.<br><br>
                 Même couleur, l'un au-dessus de l'autre : ils se font un check ✋ !`,
          scene: { setup: CROSS_START, moves: [CROSS_PATH[0]], hl: 'firstPetal' },
        },
        {
          title: 'Le plongeon 🤿',
          text: `L'ours est au-dessus de son capitaine ? Alors la face fait <b>2 tours</b>.<br><br>
                 Plouf ! L'ours plonge tout en bas, sur le terrain blanc. Et il est pile sous son capitaine !`,
          scene: { setup: CROSS_START + " U'", moves: [CROSS_PATH[1]], hl: 'firstPetal', view: 'front' },
        },
        {
          title: 'Et on recommence !',
          text: `Tourne tout le cube pour amener un autre ours devant toi (le Lion reste en haut !).<br>
                 Puis : check ✋, plongeon 🤿.<br><br>
                 <b>4 ours, 4 plongeons.</b> Regarde toute l'équipe y aller !`,
          scene: { setup: CROSS_START, moves: CROSS_PATH, hl: 'cross' },
        },
        {
          title: 'Vérifie ta croix',
          text: `Regarde sous ton cube : une <b>croix blanche</b> ✚ !<br>
                 Et sur chaque côté, l'ours est sous le capitaine de la même couleur.<br><br>
                 Un ours n'est pas sous le bon capitaine ? Pas de panique : fais-le remonter (comme pour la pâquerette), puis refais son check et son plongeon.`,
          scene: { setup: CROSS, view: 'under', hl: 'cross' },
        },
        {
          title: 'Questions du coach',
          text: `Deux petites questions avant la médaille !`,
          quiz: [
            {
              q: 'L’ours plonge quand…',
              options: ['Il est au-dessus de son capitaine', 'Il est fatigué', 'Le haut est tout jaune'],
              answer: 0,
              bravo: 'Exactement : d’abord le check ✋, ensuite le plongeon 🤿.',
            },
            { q: 'Pour le plongeon, la face fait…', options: ['1 tour', '2 tours', '3 tours'], answer: 1, bravo: 'Oui ! 2 tours, et plouf !' },
          ],
          scene: { setup: CROSS, view: 'below', hl: 'cross' },
        },
        {
          title: 'À toi de jouer, Camille !',
          text: `Fabrique d'abord ta pâquerette, puis fais plonger les 4 ours.<br><br>
                 Quand ta <b>croix blanche</b> est en dessous, avec chaque ours sous son capitaine, appuie sur le bouton !`,
          scene: { setup: CROSS, view: 'below', hl: 'cross' },
          finish: true,
        },
      ],
    },

    {
      id: 'ch3',
      num: 3,
      icon: '🛗',
      title: "L'ascenseur des trios",
      subtitle: 'Les coins blancs : chaque trio rentre à la maison',
      medal: 'Médaille de l’ascenseur',
      slides: [
        {
          title: 'Ton objectif : le terrain blanc',
          text: `Les ours polaires ont fait leur croix. Maintenant, c'est au tour des <b>trios ours polaires</b> 🐻‍❄️ : les coins qui ont du blanc.<br><br>
                 À la fin, <b>tout le dessous est blanc</b>. Et sur chaque côté, la rangée du bas a la couleur de son capitaine.`,
          scene: { setup: FIRST, view: 'under', hl: 'bottom' },
        },
        {
          title: 'Où habite un trio ?',
          text: `Regarde ce trio : il a du <b>blanc</b>, de l'<b>orange</b> 🐯 et du <b>bleu</b> 🐬.<br><br>
                 Sa maison est <b>en bas</b>, juste entre le capitaine Tigre et le capitaine Dauphin.<br>
                 💡 Pour trouver la maison d'un trio : regarde ses 2 couleurs qui ne sont pas blanches, et cherche les 2 capitaines de ces couleurs.`,
          scene: { setup: CORNER_START, hl: 'trioBackRight' },
        },
        {
          title: 'L’ascenseur 🛗',
          text: `Pour rentrer chez lui, le trio prend l'<b>ascenseur</b>. C'est un geste en 4 temps, avec la main droite :<br>
                 ⬆️ <b>Monte</b> : la droite monte<br>
                 ⬅️ <b>Ouvre</b> : le haut glisse à gauche<br>
                 ⬇️ <b>Descend</b> : la droite descend<br>
                 ➡️ <b>Ferme</b> : le haut revient à droite<br><br>
                 Dis-le à voix haute en le faisant : « Monte, ouvre, descend, ferme ! »`,
          scene: { setup: '', moves: voyages(1) },
        },
        {
          title: 'Entraîne-toi à l’ascenseur',
          text: `Appuie sur 🛗 pour faire un voyage complet, et fais-le en même temps sur ton cube.<br><br>
                 🔎 <b>Défi :</b> fais <b>6 voyages</b> de suite. Qu'est-ce qui se passe ?`,
          trainer: {
            moves: ['R', 'U', "R'", "U'"],
            macros: MACROS,
            goal: (cube, hist) => hist.length > 0 && L.isSolved(cube),
            goalText: '🎉 {n} voyages… et le cube est revenu comme au départ ! C’est le secret de l’ascenseur : si tu te perds, continue, il revient toujours.',
          },
          scene: { setup: '' },
        },
        {
          title: 'Le trio au-dessus de sa maison',
          text: `D'abord, tourne le cube pour avoir une <b>maison vide devant toi, en bas à droite</b>.<br><br>
                 Puis le haut glisse jusqu'à ce que son trio soit <b>juste au-dessus</b>, en haut à droite.
                 Ici, le trio orange-bleu arrive au-dessus de sa maison, entre Tigre et Dauphin.`,
          scene: { setup: CORNER_START, moves: [ABOVE], hl: 'trioBackRight' },
        },
        {
          title: 'Ascenseur jusqu’à la maison',
          text: `Le trio est au-dessus de sa maison ? <b>Ascenseur !</b><br><br>
                 Ici, son blanc regardait à droite : <b>1 seul voyage</b>, et il est rentré, le blanc en dessous. 🏠`,
          scene: { setup: CORNER_START + ' U', moves: voyages(1), hl: 'trioTopRight' },
        },
        {
          title: 'Parfois, il faut plus de voyages',
          text: `Ce trio a le blanc <b>en haut</b> : il lui faut <b>3 voyages</b>.
                 Si le blanc te regarde, ce sera <b>5 voyages</b>.<br><br>
                 💡 Pas besoin de compter : <b>continue l'ascenseur jusqu'à ce que le trio soit rentré</b>, le blanc en dessous.`,
          scene: { setup: WHITE_UP, moves: voyages(3), hl: 'trioTopRight' },
        },
        {
          title: 'À toi : fais-le rentrer !',
          text: `Ce trio est au-dessus de sa maison, le blanc en haut.<br>
                 Appuie sur 🛗 autant de fois qu'il faut pour le faire rentrer. Compte tes voyages !`,
          trainer: {
            moves: [],
            macros: MACROS,
            resetLabel: '♻️ Recommencer',
            goal: atDFR,
            goalText: '🎉 Il est rentré à la maison ! Tu as fait {n} voyages.',
          },
          scene: { setup: WHITE_UP, hl: 'trioTopRight' },
        },
        {
          title: 'Toute l’équipe rentre',
          text: `Pour chaque trio :<br>
                 1. Une <b>maison vide</b> devant toi, en bas à droite<br>
                 2. Le haut glisse pour amener <b>son trio au-dessus</b><br>
                 3. <b>Ascenseur</b> jusqu'à ce qu'il rentre<br><br>
                 4 trios, et le terrain blanc est fini ! Regarde (en accéléré) :`,
          scene: { setup: CORNER_START, moves: CORNER_PATH, hl: 'whiteTeam', speed: 'quick' },
        },
        {
          title: 'Coincé en bas ?',
          text: `Ce trio est en bas, mais <b>pas dans sa maison</b> (il a de l'orange et du vert, mais il est entre Renard et Grenouille).<br><br>
                 Mets-le devant toi, en bas à droite, et fais <b>1 voyage</b> : il remonte en haut ! Ensuite, comme d'habitude.
                 (Ici, bonus : un autre trio rentre en même temps !)`,
          scene: { setup: STUCK, moves: STUCK_PATH, hl: 'trioBottomRight', view: 'front' },
        },
        {
          title: 'Chez lui, mais mal tourné ?',
          text: `Ce trio est dans sa maison, mais son blanc n'est <b>pas en dessous</b>.<br><br>
                 Facile : fais l'ascenseur jusqu'à ce qu'il soit bien tourné, le blanc en bas.`,
          scene: { setup: TWISTED, moves: voyages(2), hl: 'trioBottomRight', view: 'front' },
        },
        {
          title: 'Questions du coach',
          text: `Trois questions avant la médaille !`,
          quiz: [
            {
              q: 'L’ascenseur, c’est…',
              options: ['Monte, ouvre, descend, ferme', 'Ouvre, monte, ferme, descend', 'Monte, monte, monte, monte'],
              answer: 0,
              bravo: 'Oui ! Monte, ouvre, descend, ferme. 🛗',
            },
            {
              q: 'Avant l’ascenseur, où doit être le trio ?',
              options: ['Au-dessus de sa maison, en haut à droite', 'N’importe où', 'En bas à gauche'],
              answer: 0,
              bravo: 'Exact : au-dessus de sa maison, devant toi à droite.',
            },
            {
              q: 'Après un voyage, le trio n’est pas encore rentré. Je…',
              options: ['Refais l’ascenseur', 'Mélange tout', 'Abandonne'],
              answer: 0,
              bravo: 'Bravo ! On continue l’ascenseur jusqu’à ce qu’il rentre.',
            },
          ],
          scene: { setup: FIRST, view: 'under', hl: 'bottom' },
        },
        {
          title: 'À toi de jouer, Camille !',
          text: `Prends ton cube avec sa croix blanche en dessous, et fais rentrer les 4 trios.<br><br>
                 Quand <b>tout le dessous est blanc</b>, et que chaque côté a sa rangée du bas de la bonne couleur, appuie sur le bouton !`,
          scene: { setup: FIRST, view: 'under', hl: 'bottom' },
          finish: true,
        },
      ],
    },

    {
      id: 'ch4',
      num: 4,
      icon: '🚪',
      title: 'Les visiteurs du 2e étage',
      subtitle: 'La deuxième couronne : les joueurs descendent au milieu',
      medal: 'Médaille du 2e étage',
      slides: [
        {
          title: 'Ton objectif : 2 étages finis',
          text: `Le terrain blanc est fini. Maintenant, on range le <b>2e étage</b>, le milieu du cube.<br><br>
                 À la fin, les <b>2 étages du bas</b> sont rangés : sur chaque côté, les 2 rangées du bas ont la couleur du capitaine. Seul le haut reste mélangé.`,
          scene: { setup: TWO, view: 'below', hl: 'twoFloors' },
        },
        {
          title: 'Qui doit descendre ?',
          text: `Les joueurs du 2e étage sont des <b>duos sans jaune</b> (et sans blanc). Il y en a 4.<br><br>
                 Les duos qui ont du <b>jaune</b> sont des duos Lion 🦁 : eux, ils restent en haut pour le prochain entraînement.
                 👆 Tourne le cube : les 4 joueurs allumés attendent en haut.`,
          scene: { setup: MID_START, hl: 'midDuos' },
        },
        {
          title: 'D’abord, le check ✋',
          text: `Tu te souviens du grand plongeon ? Pareil ! Prends un joueur en haut.
                 Le haut glisse jusqu'à ce que sa couleur de côté soit <b>juste au-dessus du capitaine de la même couleur</b>.<br><br>
                 Ici, le joueur bleu-rouge fait son check avec le capitaine Dauphin 🐬.`,
          scene: { setup: MID_START, moves: [check('U')], hl: 'duoTopRight' },
        },
        {
          title: 'À droite ou à gauche ?',
          text: `Regarde maintenant la couleur du joueur <b>sur le dessus</b>. Elle dit où est sa maison !<br><br>
                 Ici, c'est <b>vert</b> : sa maison est à côté de la capitaine Grenouille 🐸, qui est <b>à droite</b>. Le joueur doit descendre à droite.`,
          scene: { setup: RIGHT_CASE, hl: 'duoFront' },
        },
        {
          title: 'L’ascenseur gauche',
          text: `Pour faire descendre un joueur, il faut <b>2 ascenseurs</b>. Tu connais déjà celui de droite.<br><br>
                 Celui de gauche, c'est <b>le même en miroir</b>, avec la main gauche : la gauche monte, le haut glisse à droite, la gauche descend, le haut revient.
                 « Monte, ouvre, descend, ferme ! »`,
          scene: { setup: '', moves: liftL() },
        },
        {
          title: 'Envoyer un joueur à droite',
          text: `La recette en 4 étapes :<br>
                 1. <b>Il s'éloigne</b> : le haut glisse à l'opposé (à gauche)<br>
                 2. <b>Ascenseur de son côté</b> (droit)<br>
                 3. <b>On le suit</b> : tourne tout le cube vers la droite<br>
                 4. <b>Ascenseur de l'autre main</b> (gauche)<br><br>
                 Plouf, il est au 2e étage !`,
          scene: { setup: RIGHT_CASE, moves: SEND_RIGHT, hl: 'duoFront' },
        },
        {
          title: 'Envoyer un joueur à gauche',
          text: `Ce joueur a du <b>vert</b> sur le dessus : sa maison est à côté de la capitaine Grenouille 🐸, à <b>gauche</b>.<br><br>
                 Même recette, en miroir : il s'éloigne (à droite), ascenseur gauche, on le suit (vers la gauche), ascenseur droit.`,
          scene: { setup: LEFT_CASE, moves: SEND_LEFT, hl: 'duoFront' },
        },
        {
          title: 'À toi : fais-le descendre !',
          text: `Ce joueur a fait son check, et il doit aller <b>à droite</b>.<br>
                 Avec les boutons : il s'éloigne (⬅️), 🛗 ascenseur droit, on le suit (🔄), 🛗 ascenseur gauche.`,
          trainer: {
            moves: ['U', "U'", 'y', "y'"],
            macros: MACROS_LR,
            resetLabel: '♻️ Recommencer',
            goal: twoFloorsDone,
            goalText: '🎉 Bravo, il est au 2e étage ! Les 2 étages du bas sont rangés.',
          },
          scene: { setup: RIGHT_CASE, hl: 'duoFront' },
        },
        {
          title: 'Les 4 joueurs descendent',
          text: `Pour chaque joueur sans jaune :<br>
                 1. <b>Check</b> ✋ au-dessus de son capitaine<br>
                 2. Regarde le dessus : <b>droite ou gauche ?</b><br>
                 3. <b>S'éloigne, ascenseur, on le suit, ascenseur</b><br><br>
                 Regarde (en accéléré) : 2 vont à droite, 2 vont à gauche.`,
          scene: { setup: MID_START, moves: MID_PATH, hl: 'midDuos', speed: 'quick' },
        },
        {
          title: 'Coincé à l’envers ?',
          text: `Ce joueur rouge-vert est bien au 2e étage, mais <b>à l'envers</b>. Plus aucun joueur ne l'attend en haut !<br><br>
                 L'astuce : prends un <b>duo Lion</b> du haut et fais comme pour l'envoyer à droite. Le joueur coincé ressort en haut.
                 Ensuite, check ✋ et on le renvoie, bien tourné.`,
          scene: { setup: STUCK_MID, moves: STUCK_MID_PATH, hl: 'duoStuck', view: 'front', speed: 'quick' },
        },
        {
          title: 'Questions du coach',
          text: `Trois questions avant la médaille !`,
          quiz: [
            {
              q: 'Quels duos descendent au 2e étage ?',
              options: ['Ceux qui n’ont pas de jaune', 'Ceux qui ont du jaune', 'Les trios'],
              answer: 0,
              bravo: 'Oui ! Les duos Lion (avec du jaune) restent en haut.',
            },
            {
              q: 'Le dessus du joueur est rouge, et le capitaine Renard est à gauche. Il va…',
              options: ['À gauche', 'À droite'],
              answer: 0,
              bravo: 'Exact : la couleur du dessus dit où est sa maison.',
            },
            {
              q: 'La recette, c’est…',
              options: ['S’éloigne, ascenseur, on le suit, ascenseur', 'Ascenseur, ascenseur, ascenseur', 'On mélange et on espère'],
              answer: 0,
              bravo: 'Bravo ! S’éloigne, ascenseur de son côté, on le suit, ascenseur de l’autre main.',
            },
          ],
          scene: { setup: TWO, view: 'below', hl: 'twoFloors' },
        },
        {
          title: 'À toi de jouer, Camille !',
          text: `Prends ton cube, terrain blanc en dessous, et fais descendre les 4 joueurs du 2e étage.<br><br>
                 Quand les <b>2 étages du bas sont rangés</b> sur tous les côtés, appuie sur le bouton !`,
          scene: { setup: TWO, view: 'below', hl: 'twoFloors' },
          finish: true,
        },
      ],
    },

    {
      id: 'ch5',
      num: 5,
      icon: '📣',
      title: 'Le cri du Lion',
      subtitle: 'La croix jaune : les duos Lion se rassemblent',
      medal: 'Médaille du rugissement',
      slides: [
        {
          title: 'Ton objectif : la croix jaune',
          text: `Les 2 étages du bas sont rangés. Maintenant, c'est le terrain des <b>Lions</b> 🦁, tout en haut !<br><br>
                 Première mission : les 4 <b>duos Lion</b> doivent montrer leur jaune sur le dessus, pour faire une <b>croix jaune</b> ${mini(SHAPE.cross)}<br>
                 Les côtés peuvent rester mélangés : c'est normal, on les range au prochain entraînement.`,
          scene: { setup: YCROSS, view: 'top', hl: 'lionDuos' },
        },
        {
          title: 'Le rugissement 🦁',
          text: `Pour appeler ses duos, le Lion pousse un <b>rugissement</b>. C'est 3 choses à la suite :<br>
                 🔃 <b>Porte tournante</b> : la face tourne vers la droite<br>
                 🛗 <b>Ascenseur</b> : monte, ouvre, descend, ferme<br>
                 🔄 <b>Porte retour</b> : la face tourne vers la gauche<br><br>
                 Regarde : avec une ligne jaune, un seul rugissement fait la croix !`,
          scene: { setup: LINE, moves: roar(), view: 'high', hl: 'lionDuos' },
        },
        {
          title: 'Les 4 dessins du Lion',
          text: `Regarde le dessus de ton cube. Ne compte que le capitaine et les <b>duos</b> (pas les coins). Tu vas voir un de ces 4 dessins :`,
          html: `<div class="shapes">
              <div class="shape">${mini(SHAPE.dot)}Le point<small>3 rugissements</small></div>
              <div class="shape">${mini(SHAPE.elbow)}Le coude<small>2 rugissements</small></div>
              <div class="shape">${mini(SHAPE.line)}La ligne<small>1 rugissement</small></div>
              <div class="shape">${mini(SHAPE.cross)}La croix<small>Bravo, c'est fini !</small></div>
            </div>`,
          scene: { setup: DOT, view: 'top', hl: 'lionDuos' },
        },
        {
          title: 'La ligne : bien couchée',
          text: `La ligne doit être <b>couchée</b>, de gauche à droite ${mini(SHAPE.line)}<br>
                 Si elle est <b>debout</b> ${mini(SHAPE.standing)}, le haut glisse une fois pour la coucher.<br><br>
                 Ensuite : rugissement, et voilà la croix !`,
          scene: { setup: STANDING, moves: [['U', '⬅️', 'On la couche', undefined, 'Le haut glisse : la ligne se couche'], ...roar()], view: 'high', hl: 'lionDuos' },
        },
        {
          title: 'Le coude : à 9 heures 🕘',
          text: `Le coude se tient comme les aiguilles d'une horloge à <b>9 heures</b> : un duo derrière, un duo à gauche ${mini(SHAPE.elbow)}<br>
                 S'il n'est pas à 9 heures, fais glisser le haut jusqu'à ce qu'il y soit.<br><br>
                 Un rugissement… et le coude devient une ligne couchée ! Encore un, et c'est la croix.`,
          scene: { setup: ELBOW, moves: [...roar(1), ...roar(2)], view: 'high', hl: 'lionDuos' },
        },
        {
          title: 'Le point : rien que le capitaine',
          text: `Si seul le capitaine Lion est jaune ${mini(SHAPE.dot)}, pas de panique : fais un rugissement, et un <b>coude</b> apparaît.<br><br>
                 Fais glisser le haut pour le mettre à <b>9 heures</b> 🕘, puis continue comme pour le coude.`,
          scene: { setup: DOT, moves: [...roar(), toNine], view: 'high', hl: 'lionDuos' },
        },
        {
          title: 'À toi : fais rugir le Lion !',
          text: `Ici, il n'y a que le point. Appuie sur 🦁 pour rugir, et sur les flèches pour faire glisser le haut.<br><br>
                 💡 Le coude à 9 heures, la ligne couchée. Va jusqu'à la croix !`,
          trainer: {
            moves: ['U', "U'"],
            macros: MACROS_ROAR,
            resetLabel: '♻️ Recommencer',
            goal: yellowCross,
            goalText: '🎉 La croix jaune ! Le Lion est fier de toi. 🦁',
          },
          scene: { setup: DOT, view: 'high', hl: 'lionDuos' },
        },
        {
          title: 'Du point à la croix',
          text: `Tout le chemin, en accéléré :<br>
                 ${mini(SHAPE.dot)} rugissement → ${mini(SHAPE.elbow)} à 9 heures, rugissement → ${mini(SHAPE.line)} rugissement → ${mini(SHAPE.cross)}`,
          scene: { setup: DOT, moves: DOT_PATH, view: 'high', hl: 'lionDuos', speed: 'quick' },
        },
        {
          title: 'Questions du coach',
          text: `Trois questions avant la médaille !`,
          quiz: [
            {
              q: 'Le rugissement, c’est…',
              options: ['Porte, ascenseur, porte retour', 'Ascenseur, porte, ascenseur', 'Crier très fort'],
              answer: 0,
              bravo: 'Oui ! Porte tournante, ascenseur, porte retour. 🦁',
            },
            {
              q: 'Le coude se tient comme une horloge à…',
              options: ['9 heures 🕘', '3 heures 🕒', 'Midi 🕛'],
              answer: 0,
              bravo: 'Exact : un duo derrière, un duo à gauche.',
            },
            {
              q: 'Avant de rugir, la ligne doit être…',
              options: ['Couchée, de gauche à droite', 'Debout, de devant à derrière'],
              answer: 0,
              bravo: 'Bravo ! Une ligne couchée + un rugissement = la croix.',
            },
          ],
          scene: { setup: YCROSS, view: 'top', hl: 'lionDuos' },
        },
        {
          title: 'À toi de jouer, Camille !',
          text: `Prends ton cube, Lion en haut, et fais la croix jaune sur le dessus.<br><br>
                 Quand tu vois la <b>croix jaune</b> ${mini(SHAPE.cross)} (et que les 2 étages du bas sont toujours rangés), appuie sur le bouton !`,
          scene: { setup: YCROSS, view: 'top', hl: 'lionDuos' },
          finish: true,
        },
      ],
    },

    {
      id: 'ch6',
      num: 6,
      icon: '💃',
      title: 'La ronde des Lions',
      subtitle: 'Les bords jaunes : chaque duo Lion devant son capitaine',
      medal: 'Médaille de la ronde',
      slides: [
        {
          title: 'Ton objectif : les duos Lion à leur place',
          text: `Ta croix jaune est faite. Mais regarde les côtés : chaque duo Lion a aussi une <b>couleur de maillot</b> !<br><br>
                 Mission : chaque duo Lion doit se placer <b>au-dessus du capitaine de son maillot</b>. Les coins, on s'en occupe au dernier entraînement.`,
          scene: { setup: EDGES_DONE, view: 'high', hl: 'lionRonde' },
        },
        {
          title: 'D’abord, le check ✋',
          text: `Fais glisser le haut, et cherche la position où <b>au moins 2 duos Lion</b> sont au-dessus de leur capitaine.<br><br>
                 Il y en a toujours au moins 2 ! (Parfois les 4 : alors c'est déjà fini, bravo !)`,
          scene: { setup: CHECK_FIRST, moves: [check("U'")], view: 'high', hl: 'lionRonde' },
        },
        {
          title: 'Les 2 bons à 3 heures 🕒',
          text: `Tourne <b>tout le cube</b> pour que les 2 bons duos soient comme les aiguilles d'une horloge à <b>3 heures</b> : un derrière, un à droite ${mini('020112010')}<br><br>
                 (Au cri du Lion, c'était 9 heures. Là, c'est 3 heures !)`,
          scene: { setup: WRONG_HOUR, moves: [toThree], view: 'high', hl: 'lionRonde' },
        },
        {
          title: 'La ronde 💃',
          text: `Maintenant, la danse des Lions. La droite monte et descend, et <b>le haut glisse toujours vers la gauche</b> : 1 fois, 1 fois, puis 2 fois.<br>
                 « Monte, glisse, descend, glisse, monte, glisse-glisse, descend ! »<br><br>
                 Puis un dernier check ✋, et tous les duos Lion sont à leur place !`,
          scene: { setup: AT_THREE, moves: [...ronde(), finalCheck], view: 'high', hl: 'lionRonde' },
        },
        {
          title: 'Les 2 bons sont face à face ?',
          text: `Parfois, les 2 bons duos sont <b>face à face</b> ${mini('020111020')} : pas d'horloge possible !<br><br>
                 Pas grave : fais une ronde. Après, refais ton check : 2 bons duos seront côte à côte. Mets-les à 3 heures, et refais une ronde.`,
          scene: { setup: OPPOSITE, moves: OPPOSITE_PATH, view: 'high', hl: 'lionRonde', speed: 'quick' },
        },
        {
          title: 'À toi : la ronde des Lions !',
          text: `Rien n'est à sa place ici. Les boutons : ⬅️ ➡️ pour le check, 🔄 pour tourner tout le cube, 💃 pour la ronde.<br><br>
                 💡 Check, 3 heures, ronde. Et si les bons sont face à face : une ronde de plus.`,
          trainer: {
            moves: ['U', "U'", 'y', "y'"],
            macros: MACROS_RONDE,
            resetLabel: '♻️ Recommencer',
            goal: topEdgesDone,
            goalText: '🎉 Tous les duos Lion sont devant leur capitaine ! La ronde est parfaite. 💃',
          },
          scene: { setup: OPPOSITE, view: 'high', hl: 'lionRonde' },
        },
        {
          title: 'Questions du coach',
          text: `Trois questions avant la médaille !`,
          quiz: [
            {
              q: 'Dans la ronde, le haut glisse toujours…',
              options: ['Vers la gauche', 'Vers la droite', 'Une fois à gauche, une fois à droite'],
              answer: 0,
              bravo: 'Oui ! 1 fois, 1 fois, puis 2 fois, toujours vers la gauche.',
            },
            {
              q: 'Avant la ronde, les 2 bons duos sont à…',
              options: ['3 heures 🕒', '9 heures 🕘', '6 heures 🕕'],
              answer: 0,
              bravo: 'Exact : un derrière, un à droite.',
            },
            {
              q: 'Les 2 bons duos sont face à face. Je…',
              options: ['Fais une ronde, puis je recommence', 'Mélange tout', 'Pleure un peu'],
              answer: 0,
              bravo: 'Bravo ! Une ronde, et ils deviennent côte à côte.',
            },
          ],
          scene: { setup: EDGES_DONE, view: 'high', hl: 'lionRonde' },
        },
        {
          title: 'À toi de jouer, Camille !',
          text: `Prends ton cube avec sa croix jaune, et fais la ronde des Lions.<br><br>
                 Quand <b>chaque duo Lion est au-dessus du capitaine de son maillot</b>, sur les 4 côtés, appuie sur le bouton !`,
          scene: { setup: EDGES_DONE, view: 'high', hl: 'lionRonde' },
          finish: true,
        },
      ],
    },

    {
      id: 'ch7',
      num: 7,
      icon: '🏆',
      title: 'La grande finale',
      subtitle: 'Les coins jaunes : le cube entier est rangé !',
      medal: 'Coupe du Grand Tournoi',
      winTitle: 'Championne, Camille !',
      winText: 'Tu sais résoudre le Rubik’s Cube en entier ! Tu as gagné la <b>Coupe du Grand Tournoi</b> 🏆',
      slides: [
        {
          title: 'La grande finale !',
          text: `Dernier match, Camille ! Il ne reste que les 4 <b>trios Lion</b> 🦁 : les coins du haut.<br><br>
                 La finale se joue en <b>2 mi-temps</b> :<br>
                 1. Mettre chaque trio <b>dans sa maison</b> (même s'il est mal tourné)<br>
                 2. <b>Tourner</b> chaque trio pour que le jaune soit sur le dessus`,
          scene: { setup: NONE_HOME, view: 'high', hl: 'lionTrios' },
        },
        {
          title: '1re mi-temps : qui est dans sa maison ?',
          text: `Un trio est dans sa maison si ses <b>3 couleurs</b> sont celles des <b>3 capitaines</b> autour de lui.
                 Peu importe s'il est mal tourné !<br><br>
                 Ici, le trio devant à droite est dans sa maison : il touche Lion, et les 2 capitaines de ses 2 autres couleurs. 👆 Tourne le cube pour vérifier les autres.`,
          scene: { setup: ONE_HOME, view: 'high', hl: 'trioFrontRight' },
        },
        {
          title: 'Le ping-pong 🏓',
          text: `Mets le trio qui est dans sa maison <b>devant toi, en haut à droite</b>. Puis joue au ping-pong :<br>
                 le haut fait des allers-retours (glisse, retour, glisse, retour), et les mains jouent chacune leur tour :
                 <b>droite monte, gauche monte, droite descend, gauche descend</b>.<br><br>
                 « Glisse, droite monte, retour, gauche monte, glisse, droite descend, retour, gauche descend ! »`,
          scene: { setup: ONE_HOME, moves: pingpong(), view: 'high', hl: 'lionTrios' },
        },
        {
          title: 'Parfois, 2 ping-pongs',
          text: `Après un ping-pong, regarde : les 4 trios sont dans leur maison ? Bravo !<br>
                 Sinon, garde le même trio devant à droite et refais un ping-pong.<br><br>
                 💡 Les trios tournent en rond comme une balle de ping-pong : 1 ou 2 parties suffisent.`,
          scene: { setup: ONE_HOME_TWICE, moves: [...pingpong(1), ...pingpong(2)], view: 'high', hl: 'lionTrios', speed: 'quick' },
        },
        {
          title: 'Aucun trio dans sa maison ?',
          text: `Fais un ping-pong n'importe comment : après, <b>un trio sera dans sa maison</b>.<br><br>
                 Tourne tout le cube pour le mettre devant à droite, et continue le ping-pong.`,
          scene: { setup: NONE_HOME, moves: PLACE_PATH, view: 'high', hl: 'lionTrios', speed: 'quick' },
        },
        {
          title: 'À toi : la 1re mi-temps',
          text: `Aucun trio n'est dans sa maison. Avec 🏓 et 🔄, mets les 4 trios Lion dans leur maison !`,
          trainer: {
            moves: ['y', "y'"],
            macros: MACROS_PP,
            resetLabel: '♻️ Recommencer',
            goal: allTriosHome,
            goalText: '🎉 Les 4 trios sont dans leur maison ! Fin de la 1re mi-temps.',
          },
          scene: { setup: NONE_HOME, view: 'high', hl: 'lionTrios' },
        },
        {
          title: '2e mi-temps : retourne le cube',
          text: `Maintenant, il faut tourner les trios. Pour ça, <b>retourne ton cube</b> comme une roue : le Lion passe <b>en bas</b>, et la face de devant reste devant toi.<br><br>
                 Et tu sais quoi ? Le geste, tu le connais déjà : c'est <b>l'ascenseur</b> ! 🛗`,
          scene: { setup: PLACED, moves: [FLIP], view: 'normal', hl: 'lionTrios' },
        },
        {
          title: 'Ascenseur jusqu’au jaune en bas',
          text: `Mets un trio mal tourné <b>devant toi, en bas à droite</b>. Fais l'ascenseur jusqu'à ce que son <b>jaune soit en dessous</b> (2 ou 4 voyages).<br><br>
                 ⚠️ Le cube a l'air tout cassé ? <b>C'est normal !</b> Surtout, ne t'arrête pas : tout va se réparer à la fin.`,
          scene: { setup: FLIPPED, moves: voyages(2), view: 'below' },
        },
        {
          title: 'Le bas glisse (pas tout le cube !)',
          text: `Pour amener le trio suivant, fais glisser <b>seulement le bas</b>. Ne tourne <b>jamais tout le cube</b> pendant la 2e mi-temps !<br><br>
                 Puis ascenseur, jusqu'à ce que son jaune soit en dessous.`,
          scene: { setup: FLIPPED + ' ' + toks(voyages(2)), moves: [nextTrio, ...voyages(4)], view: 'below', speed: 'quick' },
        },
        {
          title: 'Et la magie opère ✨',
          text: `Quand tous les trios ont le jaune en dessous, le cube se répare tout seul !<br><br>
                 Il reste juste à faire glisser le bas une dernière fois… et <b>tout est rangé</b>. 🏆`,
          scene: { setup: FLIPPED + ' ' + toks([...voyages(2), nextTrio, ...voyages(4)]), moves: [lastSlide], view: 'below' },
        },
        {
          title: 'À toi : résous le cube !',
          text: `Le Lion est en bas, les trios sont dans leur maison mais mal tournés. Avec 🛗 et ⬅️ ➡️ (le bas), termine le cube !<br><br>
                 💡 Ascenseur jusqu'au jaune en bas, le bas glisse, ascenseur… Ne t'arrête pas si ça a l'air cassé !`,
          trainer: {
            moves: ['D', "D'"],
            macros: MACROS,
            resetLabel: '♻️ Recommencer',
            goal: (cube) => L.isSolved(cube),
            goalText: '🏆 TU AS RÉSOLU LE RUBIK’S CUBE ! Bravo Camille !',
            celebrate: true,
          },
          scene: { setup: FLIPPED, view: 'below' },
        },
        {
          title: 'Toute la finale',
          text: `Les 2 mi-temps, en accéléré :<br>
                 🏓 ping-pong jusqu'à ce que les trios soient dans leur maison, 🙃 retourne le cube, 🛗 ascenseur et le bas glisse… 🏆 !`,
          scene: { setup: NONE_HOME, moves: FINAL_PATH, view: 'high', speed: 'quick' },
        },
        {
          title: 'Questions du coach',
          text: `Les dernières questions du tournoi !`,
          quiz: [
            {
              q: 'Un trio est dans sa maison quand…',
              options: ['Ses 3 couleurs touchent les 3 bons capitaines', 'Son jaune est en haut', 'Il est dans un coin'],
              answer: 0,
              bravo: 'Oui ! Même s’il est mal tourné.',
            },
            {
              q: 'Pendant la 2e mi-temps, le cube a l’air tout cassé. Je…',
              options: ['Continue, c’est normal !', 'Recommence tout', 'Range-le dans un tiroir'],
              answer: 0,
              bravo: 'Exactement : il se répare tout seul à la fin.',
            },
            {
              q: 'Pour amener le trio suivant, je tourne…',
              options: ['Seulement le bas', 'Tout le cube'],
              answer: 0,
              bravo: 'Bravo ! Jamais tout le cube pendant la 2e mi-temps.',
            },
          ],
          scene: { setup: '', view: 'normal' },
        },
        {
          title: 'La finale, Camille !',
          text: `Prends ton cube et joue la finale : 🏓 ping-pong, puis 🙃 retourne le cube, 🛗 ascenseur et le bas glisse.<br><br>
                 Quand <b>toutes les faces sont d'une seule couleur</b>, appuie sur le bouton. Tu seras championne du Grand Tournoi !`,
          scene: { setup: '', view: 'normal' },
          finish: true,
        },
      ],
    },
  ];

  const COMING = [
  ];

  /* ---------- Les exercices « À toi de jouer » avec le VRAI cube de Camille ----------
     Quand Camille a pris son cube en photo, le dernier écran de chaque entraînement montre SON cube.
     moves / macros : les boutons ; goal : ce qu'il faut obtenir (affiché et dit par le coach). */
  const MINE = {
    ch1: { view: 'top', moves: ['U', "U'", 'R', "L'", 'F', 'y', "y'"], macros: [],
      goal: 'la pâquerette, avec 4 pétales blancs autour du cœur jaune 🌼' },
    ch2: { view: 'normal', moves: ['U', "U'", 'y', "y'"], macros: [{ icon: '🤿', label: 'Le plongeon', seq: 'F2' }],
      goal: 'la croix blanche en dessous, chaque ours sous son capitaine 🤿' },
    ch3: { view: 'normal', moves: ['U', "U'", 'y', "y'"], macros: MACROS,
      goal: 'tout le terrain blanc en dessous, avec ses 4 trios 🛗' },
    ch4: { view: 'normal', moves: ['U', "U'", 'y', "y'"], macros: MACROS_LR,
      goal: 'les 2 étages du bas rangés, sur les 4 côtés 🚪' },
    ch5: { view: 'high', moves: ['U', "U'", 'y', "y'"], macros: MACROS_ROAR,
      goal: 'la croix jaune sur le dessus 📣' },
    ch6: { view: 'high', moves: ['U', "U'", 'y', "y'"], macros: MACROS_RONDE,
      goal: 'chaque duo Lion au-dessus de son capitaine 💃' },
    ch7: { view: 'high', moves: ['y', "y'", 'D', "D'"],
      macros: [...MACROS_PP, { icon: '🙃', label: 'Retourne le cube', seq: 'z2' }, ...MACROS],
      goal: 'toutes les faces d’une seule couleur 🏆' },
  };
  CHAPTERS.forEach((c) => { if (MINE[c.id]) c.mine = MINE[c.id]; });

  // Ce que dit le coach pendant ces exercices (phrases fixes : elles peuvent être enregistrées)
  const MINE_SAY = {
    ready: (goal) => `Prends ton cube et tiens-le comme sur le dessin. Ton but : ${goal}. Appuie sur Geste suivant : le coach te montre un geste, et tu le fais sur ton vrai cube.`,
    early: 'Ton cube n’est pas encore prêt pour cet exercice : il manque une étape d’avant. Pas de souci : appuie sur Geste suivant, le coach te montre quoi faire.',
    done: 'Ton cube a déjà passé cette étape ! Pour t’entraîner, le coach peut le mélanger juste ce qu’il faut. Regarde les gestes, et fais-les sur ton vrai cube.',
    mix: 'Le coach mélange juste ce qu’il faut. Fais les mêmes gestes sur ton vrai cube. Ensuite, ce sera à toi de jouer !',
    prepared: (goal) => `👍 Ton cube est prêt pour l’exercice ! À toi de jouer : ${goal}.`,
    reached: (goal) => `🎉 Bravo Camille ! Sur ton vrai cube : ${goal}. Appuie sur « J’ai réussi » pour gagner ta médaille !`,
  };

  // Les gestes "racontés", réutilisés par le solveur de « Mon cube »
  const LABELS = { check, voyages, liftR, liftL, SEND_RIGHT, SEND_LEFT, roar, ronde, pingpong, FLIP, finalCheck, ELEV_STEPS };

  window.Content = { TEAMS, SAY, HL, CHAPTERS, COMING, SCRAMBLE, LABELS, MINE_SAY, MACROS: [...MACROS_LR, ...MACROS_ROAR, ...MACROS_RONDE, ...MACROS_PP] };
})();
