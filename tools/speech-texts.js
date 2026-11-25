// Liste toutes les phrases que le Coach Panda peut dire (pour les enregistrer).
// Doit rester d'accord avec les appels à speak() dans js/app.js.
const path = require('path');
const root = path.join(__dirname, '..');

function loadSite() {
  global.window = global.window || {};
  const L = require(path.join(root, 'js/cube.js'));
  window.CubeLogic = L;
  window.Speech = require(path.join(root, 'js/speech.js'));
  require(path.join(root, 'js/content.js'));
  try { require(path.join(root, 'js/solver.js')); } catch (e) { /* pas encore de solveur */ }
  return { Content: window.Content, Solver: window.Solver, Speech: window.Speech };
}

function collect() {
  const { Content, Solver } = loadSite();
  const out = new Set();
  const add = (t) => { if (t && String(t).trim()) out.add(String(t)); };
  const addMoves = (moves) => {
    if (!moves) return;
    const list = typeof moves === 'string' ? moves.trim().split(/\s+/) : moves;
    for (const m of list) {
      if (Array.isArray(m)) add(m[2]);
      else if (Content.SAY[m]) add(Content.SAY[m][1]);
    }
  };

  // Phrases fixes
  add('Coucou Camille ! Je vais te lire les histoires.');
  add('Coucou Camille ! Je suis Coach Panda. Prête pour l’entraînement ?');
  Object.values(Content.SAY).forEach((s) => add(s[1]));

  // Les entraînements
  for (const ch of Content.CHAPTERS) {
    add(ch.winTitle ? `${ch.winTitle} ${ch.winText}` : `Bravo Camille ! Tu as gagné la ${ch.medal} !`);
    for (const s of ch.slides) {
      add(s.title + '. ' + s.text);
      if (s.scene) {
        addMoves(s.scene.moves);
        if (s.scene.caption) add(s.scene.caption[1]);
      }
      (s.quiz || []).forEach((q) => add(q.bravo));
      if (s.trainer && s.trainer.goalText) {
        if (s.trainer.goalText.includes('{n}')) for (let n = 1; n <= 12; n++) add(s.trainer.goalText.replace('{n}', n));
        else add(s.trainer.goalText);
      }
    }
  }

  // Mon cube (solveur) : toutes ses phrases possibles
  if (Solver && Solver.speechTexts) Solver.speechTexts().forEach(add);
  add('Voici ton cube, exactement comme dans tes mains. Tiens-le comme sur l’écran. À chaque écran, regarde le geste, puis fais-le sur ton vrai cube.');

  // Les exercices « À toi de jouer » avec le vrai cube
  const MS = Content.MINE_SAY;
  for (const ch of Content.CHAPTERS) {
    if (!ch.mine) continue;
    add(MS.ready(ch.mine.goal));
    add(MS.prepared(ch.mine.goal));
    add(MS.reached(ch.mine.goal));
  }
  [MS.early, MS.done, MS.mix].forEach(add);
  add('Si ton vrai cube ressemble à celui-ci, avec chaque face d’une seule couleur, appuie sur le bouton : tu as résolu ton cube !');
  add('Bravo Camille ! Tu as résolu <b>ton</b> Rubik’s Cube avec le coach ! 🏆');

  return [...out];
}

module.exports = { collect, loadSite };

if (require.main === module) {
  const { Speech } = loadSite();
  const texts = collect();
  const chars = texts.reduce((n, t) => n + Speech.clean(t).length, 0);
  console.log(texts.length, 'phrases,', chars, 'caractères');
}
