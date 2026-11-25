/* L'application : pages, lecteur de démos, quiz, médailles, voix du coach. */
(function () {
  const L = window.CubeLogic;
  const { TEAMS, SAY, HL, CHAPTERS, COMING, MACROS, MINE_SAY } = window.Content;
  const app = document.getElementById('app');
  const HEX = (c) => '#' + window.Cube3D.STICKER_HEX[c].toString(16).padStart(6, '0');

  /* ---------- mémoire (médailles) : simple confort, le site marche sans ---------- */
  const STORE_KEY = 'grand-tournoi-cube-v1';
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* pas grave */ }
  }
  const store = Object.assign({ medals: {}, voice: false }, loadStore());

  /* ---------- voix du coach ---------- */
  // Tout passe par Voice (js/voice.js) : fichiers enregistrés d'abord, voix de l'appareil sinon.
  // Les phrases dites ici doivent aussi être listées par tools/speech-texts.js pour être enregistrées.
  const speak = (text) => window.Voice.speak(text);
  const hush = () => window.Voice.stop();
  if (store.voiceName) window.Voice.setPreferred(store.voiceName);

  /* ---------- petits outils ---------- */
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextChapter = () => CHAPTERS.find((c) => !store.medals[c.id]);

  function normMoves(moves) {
    if (!moves) return [];
    const list = typeof moves === 'string' ? moves.trim().split(/\s+/) : moves;
    return list.map((m) => {
      if (Array.isArray(m)) return { token: m[0], icon: m[1], text: m[2], group: m[3], long: m[4] };
      const s = SAY[m] || ['•', m];
      return { token: m, icon: s[0], text: s[1] };
    });
  }

  const SPEEDS = {
    normal: { preview: 500, duration: 650, gap: 500 },
    slow: { preview: 1000, duration: 1400, gap: 900 },
    quick: { preview: 150, duration: 380, gap: 160 },
    magic: { preview: 0, duration: 160, gap: 30 },
    tap: { preview: 0, duration: 380, gap: 0 },
  };

  /* ---------- le confetti des médailles ---------- */
  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.getElementById('confetti');
    const ctx = cv.getContext('2d');
    const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
    const colors = ['W', 'Y', 'R', 'O', 'B', 'G'].map(HEX).concat(['#ff2f86']);
    const parts = Array.from({ length: 160 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 16 - 4,
      s: 7 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      c: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.7);
        ctx.restore();
      }
      if (now - t0 < 3200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
    })(t0);
  }

  /* ============================================================
     LECTEUR DE DÉMOS : fait jouer les mouvements d'un écran
     ============================================================ */
  class Player {
    constructor(view, ui) {
      this.view = view;
      this.ui = ui;
      this.token = 0;
      this.slow = false;
      this.playing = false;
    }
    load(scene, first) {
      this.stop();
      this.scene = scene || { setup: '' };
      this.moves = normMoves(this.scene.moves);
      this.idx = 0;
      this.resetCube();
      this.view.setView(this.scene.view || 'normal', first);
      this.render();
    }
    resetCube() {
      this.view.reset(this.scene.setup || '');
      const hl = this.scene.hl;
      this.view.setHighlight(typeof hl === 'function' ? hl : HL[hl] || null);
      this.idx = 0;
    }
    speed() {
      if (this.scene.speed === 'magic') return SPEEDS.magic;
      if (this.slow) return SPEEDS.slow;
      return SPEEDS[this.scene.speed] || SPEEDS.normal;
    }
    stop() {
      this.token++;
      this.playing = false;
      this.view.abort();
      this.showCaption(null);
    }
    async step(my) {
      const mv = this.moves[this.idx];
      const sp = this.speed();
      const cap = this.scene.caption
        ? { icon: this.scene.caption[0], text: this.scene.caption[1] }
        : { icon: mv.icon, text: (mv.group ? mv.group + ' · ' : '') + (mv.long || mv.text) };
      this.showCaption(cap);
      this.render();
      if (store.voice && !this.scene.caption) speak(mv.text);
      const ok = await this.view.animateMove(mv.token, { preview: sp.preview, duration: sp.duration, arrow: !this.scene.caption });
      if (!ok || my !== this.token) return false;
      this.idx++;
      this.render();
      if (this.onStep) this.onStep(mv);
      if (this.afterStep) this.afterStep(mv);
      return true;
    }
    async play(fromStart) {
      if (!this.moves.length) return;
      if (fromStart || this.idx >= this.moves.length) this.resetCube();
      const my = ++this.token;
      this.playing = true;
      this.render();
      if (fromStart) await wait(350);
      if (store.voice && this.scene.caption) speak(this.scene.caption[1]);
      while (my === this.token && this.idx < this.moves.length) {
        const ok = await this.step(my);
        if (!ok) return;
        await wait(this.speed().gap);
      }
      if (my !== this.token) return;
      this.playing = false;
      this.showCaption(this.moves.length ? { icon: '✅', text: 'Fini ! Essaie sur ton cube.' } : null);
      this.render();
      if (this.scene.speed === 'magic') this.showCaption({ icon: '🏆', text: 'Toutes les équipes sont rangées !' });
      if (this.onEnd) this.onEnd();
    }
    async one() {
      if (this.playing || !this.moves.length) return;
      if (this.idx >= this.moves.length) { this.resetCube(); this.render(); await wait(300); }
      const my = ++this.token;
      this.playing = true;
      this.render();
      await this.step(my);
      if (my !== this.token) return;
      this.playing = false;
      this.showCaption(null);
      this.render();
      if (this.idx >= this.moves.length && this.onEnd) this.onEnd();
    }
    showCaption(c) {
      const el = this.ui.caption;
      if (!c) { el.hidden = true; return; }
      el.hidden = false;
      el.innerHTML = `<span class="cap-icon">${c.icon}</span><span>${c.text}</span>`;
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    }
    render() {
      const { controls, chips } = this.ui;
      const has = this.moves.length > 0;
      controls.hidden = !has || !!this.hideControls;
      chips.hidden = !has || !!this.scene.caption;
      if (!has) return;
      const done = this.idx >= this.moves.length;
      controls.querySelector('[data-act=play]').innerHTML = this.playing ? '⏳ Regarde…' : done ? '⟲ Revoir' : this.idx > 0 ? '▶ Continuer' : '▶ Regarder';
      controls.querySelector('[data-act=play]').disabled = this.playing;
      controls.querySelector('[data-act=one]').disabled = this.playing || !!this.scene.caption;
      controls.querySelector('[data-act=one]').hidden = !!this.scene.caption;
      const slowBtn = controls.querySelector('[data-act=slow]');
      slowBtn.hidden = this.scene.speed === 'magic';
      slowBtn.classList.toggle('speed-on', this.slow);
      slowBtn.innerHTML = this.slow ? '🐢 Lent' : '🐇 Normal';
      const chip = (i) => {
        const m = this.moves[i];
        const cls = i < this.idx ? 'done' : (i === this.idx && this.playing) ? 'now' : '';
        return `<span class="chip ${cls}">${m.icon} ${m.text}</span>`;
      };
      // Les gestes d'un même "voyage" sont regroupés dans une boîte
      let html = '<div class="chips-label">Les gestes</div>';
      for (let i = 0; i < this.moves.length;) {
        const g = this.moves[i].group;
        if (!g) { html += chip(i); i++; continue; }
        const start = i;
        let inner = '';
        while (i < this.moves.length && this.moves[i].group === g) { inner += chip(i); i++; }
        const cls = i <= this.idx ? 'done' : start <= this.idx && this.playing ? 'active' : '';
        html += `<div class="chip-group ${cls}"><span class="group-label">${g}</span>${inner}</div>`;
      }
      chips.innerHTML = html;
    }
  }

  /* ============================================================
     PAGES
     ============================================================ */
  let current = null; // { view, player }
  function teardown() {
    hush();
    if (current && current.stop) current.stop();
    if (current && current.view) current.view.destroy();
    current = null;
  }

  function teamsHTML() {
    return `<div class="teams">${['Y', 'W', 'G', 'B', 'O', 'R'].map((c) => `
      <div class="team"><span class="swatch" style="background:${HEX(c)}"></span>
        <span class="emoji">${TEAMS[c].emoji}</span>
        <span><b>${TEAMS[c].animal}</b><small>${TEAMS[c].color}</small></span></div>`).join('')}</div>`;
  }

  function voiceBtnHTML() {
    return `<button class="btn btn-small" data-act="voice" aria-pressed="${store.voice}">${store.voice ? '🔊 Coach qui parle' : '🔈 Coach muet'}</button>`;
  }
  function bindVoice(root) {
    root.querySelectorAll('[data-act=voice]').forEach((b) => b.addEventListener('click', () => {
      store.voice = !store.voice; saveStore();
      b.setAttribute('aria-pressed', store.voice);
      b.innerHTML = store.voice ? '🔊 Coach qui parle' : '🔈 Coach muet';
      if (store.voice) speak('Coucou Camille ! Je vais te lire les histoires.'); else hush();
    }));
  }

  /* ---------- accueil ---------- */
  function renderHome() {
    const medals = CHAPTERS.filter((c) => store.medals[c.id]).length;
    const next = nextChapter();
    const brandColors = ['Y', 'W', 'R', 'G', 'Y', 'O', 'B', 'W', 'Y'].map(HEX);
    const hasMy = !!myNow();
    const page = h(`
      <main class="home">
        <header class="topbar">
          <div class="brand">
            <div class="brand-mark">${brandColors.map((c) => `<i style="background:${c}"></i>`).join('')}</div>
            <div><h1>Le Grand Tournoi du Cube</h1><small>L'école de cube de Camille</small></div>
          </div>
          <div class="top-actions">
            ${voiceBtnHTML()}
            <span class="medal-count" title="Médailles gagnées">🏅 ${medals} / ${CHAPTERS.length}</span>
          </div>
        </header>

        <section class="hero">
          <div>
            <h2>${next ? (medals ? 'On continue, Camille ?' : 'Salut Camille !') : 'Championne, Camille !'}</h2>
            <p>${next
              ? `Coach Panda t'attend sur le terrain. Prochain entraînement : <b>${next.title}</b>.`
              : 'Tu as gagné toutes les médailles et la Coupe du Grand Tournoi 🏆. Tu sais résoudre le Rubik’s Cube ! Entraîne-toi sur le terrain libre pour aller de plus en plus vite.'}</p>
            ${next ? `<a class="btn btn-primary" href="#${next.id}">▶ C'est parti !</a>` : `<a class="btn btn-gold" href="#libre">🎮 Terrain libre</a>`}
          </div>
          <div class="coach-big" aria-hidden="true">🐼</div>
        </section>

        <a class="card mine mine-banner" href="#moncube">
          <span class="icon">📸</span>
          <span class="num">Avec ton vrai cube</span>
          <h3>Mon cube</h3>
          <p>${hasMy
            ? 'Ton cube est dans l’appli : il t’attend dans les exercices « À toi de jouer », pareil que dans tes mains.'
            : 'Prends ton cube en photo : tu le retrouves dans les exercices, pareil que dans tes mains.'}</p>
          <span class="status">${hasMy ? '✅ Ton cube est prêt · 📸 Nouvelles photos' : '▶ Prendre les photos'}</span>
        </a>

        <section>
          <div class="section-title"><h2>Les entraînements</h2><span>Un par jour, c'est parfait</span></div>
          <div class="chapters">
            ${CHAPTERS.map((c) => {
              const done = store.medals[c.id];
              const isNext = next && next.id === c.id;
              return `<a class="card ${done ? 'done' : ''} ${isNext ? 'next' : ''}" href="#${c.id}">
                <span class="icon">${c.icon}</span>
                <span class="num">Entraînement ${c.num}</span>
                <h3>${c.title}</h3>
                <p>${c.subtitle}</p>
                <span class="status">${done ? '🏅 Médaille gagnée' : isNext ? '▶ À toi de jouer' : '○ Pas encore fait'}</span>
              </a>`;
            }).join('')}
            ${COMING.map((c) => `<div class="card locked" aria-disabled="true">
                <span class="icon">${c.icon}</span>
                <span class="num">Entraînement ${c.num}</span>
                <h3>${c.title}</h3>
                <p>${c.subtitle}</p>
                <span class="status">🔒 Bientôt</span>
              </div>`).join('')}
            <a class="card free" href="#libre">
              <span class="icon">🎮</span>
              <span class="num">Quand tu veux</span>
              <h3>Terrain libre</h3>
              <p>Mélange, essaie tous les gestes, et range tout par magie.</p>
              <span class="status">▶ Jouer</span>
            </a>
          </div>
        </section>

        <section>
          <div class="section-title"><h2>Les 6 équipes</h2><span>Une couleur = une équipe</span></div>
          ${teamsHTML()}
        </section>

        <details class="parent-note">
          <summary>Pour les parents</summary>
          <p>Les médailles sont gardées sur cette tablette seulement. Chaque chapitre se fait en 10 à 20 minutes, cube en main.
          Le bouton « Coach qui parle » lit les histoires à voix haute.</p>
          <div class="voice-settings">
            <p class="voice-status"></p>
            <label for="voice-pick">Voix de secours (si une phrase n'est pas enregistrée)</label>
            <div class="row-inline">
              <select id="voice-pick"></select>
              <button class="btn btn-small" data-act="voice-test">🔊 Tester</button>
            </div>
            <p class="hint-small">Sur iPad, les voix « Premium » sont bien plus naturelles : Réglages › Accessibilité › Contenu énoncé › Voix › Français › Audrey (Premium) ou Thomas (Premium), puis rouvrir le site.</p>
          </div>
          <div class="app-status" hidden>
            <p>📱 <b>L’installer comme une app</b> : dans Safari, Partager › « Sur l’écran d’accueil ».
            Les médailles et le cube photographié de l’app sont séparés de ceux de Safari.</p>
            <p class="offline-status"></p>
          </div>
          <button class="btn btn-small" data-act="reset-medals">Effacer les médailles</button>
        </details>
      </main>`);
    app.replaceChildren(page);
    bindVoice(page);
    page.querySelector('.card.mine').addEventListener('click', () => { delete store.returnTo; saveStore(); });
    // Réglages de la voix (parents)
    const pick = page.querySelector('#voice-pick');
    const status = page.querySelector('.voice-status');
    const fillVoices = () => {
      const names = window.Voice.frenchVoices();
      const cur = store.voiceName || window.Voice.currentVoice();
      pick.innerHTML = names.length
        ? names.map((n) => `<option ${n === cur ? 'selected' : ''}>${n.replace(/</g, '&lt;')}</option>`).join('')
        : '<option>Aucune voix française trouvée</option>';
    };
    fillVoices();
    setTimeout(fillVoices, 800);
    window.Voice.ready.then(() => {
      const n = window.Voice.recordedCount();
      status.textContent = n
        ? `🎙️ ${n} phrases du coach sont enregistrées avec une voix naturelle.`
        : '🎙️ Pas encore de voix enregistrée : le coach utilise la voix de la tablette.';
    });
    // Hors ligne : combien de voix sont déjà gardées sur la tablette (seulement sur le site installable)
    if ('serviceWorker' in navigator && window.caches) {
      navigator.serviceWorker.getRegistration().then(async (reg) => {
        if (!reg || !page.isConnected) return;
        const box = page.querySelector('.app-status');
        box.hidden = false;
        const out = box.querySelector('.offline-status');
        try {
          await window.Voice.ready;
          const total = window.Voice.recordedCount();
          const kept = (await (await caches.open('tournoi-voix-v1')).keys()).length;
          out.textContent = kept >= total
            ? `✅ Hors ligne : le site et les ${total} voix sont gardés sur la tablette.`
            : `⏳ Hors ligne : ${kept} voix sur ${total} gardées sur la tablette (la suite se télécharge toute seule).`;
        } catch (e) { out.textContent = ''; }
      });
    }
    pick.addEventListener('change', () => {
      store.voiceName = pick.value; saveStore();
      window.Voice.setPreferred(pick.value);
    });
    page.querySelector('[data-act=voice-test]').addEventListener('click', () =>
      speak('Coucou Camille ! Je suis Coach Panda. Prête pour l’entraînement ?'));
    const rm = page.querySelector('[data-act=reset-medals]');
    rm.addEventListener('click', () => {
      if (rm.dataset.armed) { store.medals = {}; saveStore(); renderHome(); return; }
      rm.dataset.armed = '1';
      rm.textContent = 'Sûr ? Appuie encore pour effacer';
    });
  }

  /* ---------- page avec le cube (chapitre ou terrain libre) ---------- */
  function stageHTML() {
    return `
      <section class="stage">
        <div class="field"></div>
        <div class="caption" hidden></div>
        <div class="hint">👆 Glisse pour regarder</div>
        <div class="hold" hidden></div>
        <div class="controls" hidden>
          <button class="btn btn-primary" data-act="play">▶ Regarder</button>
          <button class="btn" data-act="one">⏭ Un geste</button>
          <button class="btn" data-act="slow">🐇 Normal</button>
        </div>
      </section>`;
  }

  function makeStage(page) {
    const view = new window.Cube3D(page.querySelector('.field'));
    const ui = {
      caption: page.querySelector('.caption'),
      controls: page.querySelector('.controls'),
      chips: page.querySelector('.chips') || document.createElement('div'),
    };
    const player = new Player(view, ui);
    ui.controls.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'play') player.play(player.idx >= player.moves.length);
      if (b.dataset.act === 'one') player.one();
      if (b.dataset.act === 'slow') { player.slow = !player.slow; player.render(); }
    });
    current = { view, player };
    return { view, player };
  }

  /* Boutons d'entraînement : chaque geste, + annuler / tout ranger */
  const TRAINER_MOVES = ['R', "R'", 'L', "L'", 'U', "U'", 'F', "F'", 'y'];
  // cfg : { moves: [...], macros: [{ icon, label, seq }], resetLabel }
  function trainerHTML(extra, cfg = {}) {
    const moves = cfg.moves || TRAINER_MOVES;
    const macros = cfg.macros || [];
    return `
      <div class="macros" ${macros.length ? '' : 'hidden'}>
        ${macros.map((m, k) => `<button class="move-btn macro" data-macro="${k}">
            <span class="mi">${m.icon}</span>${m.label}</button>`).join('')}
      </div>
      <div class="trainer" ${moves.length ? '' : 'hidden'}>
        ${moves.map((m) => `<button class="move-btn ${m.startsWith('y') ? 'whole' : ''}" data-move="${m}">
            <span class="mi">${SAY[m][0]}</span>${SAY[m][1]}</button>`).join('')}
      </div>
      <div class="trainer-tools">
        <button class="btn btn-small" data-tool="undo">↩️ Annuler</button>
        ${cfg.noReset ? '' : `<button class="btn btn-small" data-tool="reset">${cfg.resetLabel || '♻️ Tout ranger'}</button>`}
        ${extra || ''}
      </div>
      <div class="note" hidden></div>`;
  }

  function bindTrainer(root, view, opts = {}) {
    const history = opts.history || [];
    const note = root.querySelector('.note');
    let queue = Promise.resolve();
    const box = root.querySelector('.trainer');
    const run = (token, record = true) => {
      queue = queue.then(async () => {
        if (!box.isConnected) return;
        if (store.voice && SAY[token]) speak(SAY[token][1]);
        const ok = await view.animateMove(token, { duration: SPEEDS.tap.duration });
        if (!ok) return;
        if (record) history.push(token);
        if (opts.onMove) opts.onMove(history, note);
      });
    };
    root.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => run(b.dataset.move)));
    root.querySelectorAll('[data-macro]').forEach((b) => b.addEventListener('click', () => {
      const m = (opts.macros || [])[+b.dataset.macro];
      if (m) L.parse(m.seq).forEach((mv) => run(mv.token));
    }));
    root.querySelector('[data-tool=undo]').addEventListener('click', () => {
      queue = queue.then(async () => {
        const last = history.pop();
        if (!last) return;
        await view.animateMove(L.invert(last), { duration: SPEEDS.tap.duration });
      });
    });
    root.querySelector('[data-tool=reset]').addEventListener('click', () => {
      queue = queue.then(() => {
        history.length = 0;
        view.reset(opts.setup || '');
        note.hidden = true;
        if (opts.onReset) opts.onReset();
      });
    });
    return { history, run, get queue() { return queue; }, set queue(q) { queue = q; } };
  }

  /* ---------- chapitre ---------- */
  function renderChapter(ch) {
    let idx = 0;
    const speechOf = (s) => s.speech || s.title + '. ' + s.text;
    const seen = new Set();
    document.documentElement.classList.add('page-chapter');
    const page = h(`
      <div class="chapter">
        <header class="ch-top">
          <a class="btn btn-small" href="#home">← Stade</a>
          <div class="ch-name"><small>${ch.kicker || 'Entraînement ' + ch.num}</small><h1>${ch.icon} ${ch.title}</h1></div>
          <div class="dots"></div>
        </header>
        <div class="ch-body">
          ${stageHTML()}
          <section class="story">
            <div class="coach-row">
              <div class="coach-avatar" aria-hidden="true">🐼</div>
              <div class="bubble"><h2></h2><p></p><button class="speak" aria-label="Lire à voix haute">🔊</button></div>
            </div>
            <div class="chips" hidden></div>
            <div class="extra"></div>
            <nav class="pager">
              <button class="btn" data-nav="prev">◀ Avant</button>
              <button class="btn btn-primary" data-nav="next">Suivant ▶</button>
            </nav>
          </section>
        </div>
      </div>`);
    app.replaceChildren(page);
    const { view, player } = makeStage(page);
    const dots = page.querySelector('.dots');
    const bubble = page.querySelector('.bubble');
    const extra = page.querySelector('.extra');
    const story = page.querySelector('.story');
    const prev = page.querySelector('[data-nav=prev]');
    const next = page.querySelector('[data-nav=next]');

    let cur = null;
    bubble.querySelector('.speak').addEventListener('click', () => {
      speak(speechOf(cur || ch.slides[idx]));
    });

    function show(i, first) {
      idx = i;
      seen.add(i);
      let s = ch.slides[i];
      // Dernier écran « À toi de jouer » : avec le vrai cube de Camille, s'il est dans l'appli
      if (s.finish && ch.mine) s = mineSlide(ch, s);
      cur = s;
      player.onStep = null;
      player.onEnd = null;
      player.afterStep = null;
      player.hideControls = false;
      bubble.querySelector('h2').innerHTML = s.title;
      bubble.querySelector('p').innerHTML = s.text;
      dots.innerHTML = ch.slides.length > 16
        ? `<span class="counter">${i + 1} / ${ch.slides.length}</span>`
        : ch.slides.map((_, k) =>
          `<button class="dot ${k === i ? 'here' : seen.has(k) ? 'seen' : ''}" data-go="${k}" aria-label="Écran ${k + 1}"></button>`).join('');
      if (ch.resumeKey) { store[ch.resumeKey] = i; saveStore(); }
      if (ch.onSlide) ch.onSlide(i);
      extra.innerHTML = '';
      player.load(s.scene, first);
      // Le dessin « Tiens ton cube » quand on travaille avec le vrai cube
      const holdOn = !!(s.mine || ch.showHold);
      page.querySelector('.hold').hidden = !holdOn;
      if (holdOn) { player.afterStep = updateHold; updateHold(); }
      if (s.teams) extra.innerHTML = teamsHTML();
      if (s.html) extra.innerHTML = s.html;
      if (s.trainer) {
        const cfg = s.trainer === true ? {} : s.trainer;
        extra.innerHTML = trainerHTML('', cfg);
        let streak = 0;
        let reached = false;
        bindTrainer(extra, view, {
          macros: cfg.macros,
          setup: s.scene && s.scene.setup,
          onReset: () => { reached = false; streak = 0; },
          onMove: (hist, note) => {
            if (!cfg.goal) {
              streak = hist[hist.length - 1] === 'R' ? streak + 1 : 0;
              if (streak === 4) {
                note.hidden = false;
                note.innerHTML = '🎉 Tu as vu ? Après 4 fois « La droite monte », tout est revenu comme avant ! Un geste fait 4 fois revient toujours au départ.';
              }
              return;
            }
            const ok = cfg.goal(view.cube, hist);
            if (ok && !reached) {
              reached = true;
              note.hidden = false;
              const voyages = hist.filter((t) => t === 'R').length;
              note.innerHTML = cfg.goalText.replace('{n}', voyages);
              if (store.voice) speak(note.innerHTML);
              if (cfg.celebrate) confetti();
            } else if (!ok) reached = false;
          },
        });
      }
      if (s.quiz) renderQuiz(extra, s.quiz);
      if (s.mine) bindMine(extra, ch, s.mine, view, player, () => show(idx));
      if (s.invite) bindInvite(extra, ch);
      prev.disabled = i === 0;
      const last = i === ch.slides.length - 1;
      next.className = 'btn ' + (last ? 'btn-gold' : 'btn-primary');
      next.innerHTML = last ? '🏅 J’ai réussi !' : 'Suivant ▶';
      story.scrollTop = 0;
      if (!first) window.scrollTo({ top: 0 });
      if (store.voice) speak(speechOf(s));
    }

    dots.addEventListener('click', (e) => { const d = e.target.closest('[data-go]'); if (d) show(+d.dataset.go); });
    prev.addEventListener('click', () => idx > 0 && show(idx - 1));
    next.addEventListener('click', () => {
      if (idx < ch.slides.length - 1) show(idx + 1);
      else winMedal(ch);
    });
    let start = ch.start != null ? ch.start : ch.resumeKey ? store[ch.resumeKey] || 0 : 0;
    // Retour des photos : on revient directement à l'exercice avec le vrai cube
    if (ch.mine && store.resumeMine === ch.id) {
      start = ch.slides.findIndex((x) => x.finish);
      delete store.resumeMine; saveStore();
    }
    show(Math.max(0, Math.min(start, ch.slides.length - 1)), true);
  }

  function renderQuiz(root, questions) {
    const wrap = h('<div class="quiz"></div>');
    root.appendChild(wrap);
    const ask = (qi) => {
      const q = questions[qi];
      const el = h(`<div class="q"><h3>${qi + 1}. ${q.q}</h3>
        <div class="opts">${q.options.map((o, k) => `<button class="btn opt" data-k="${k}">${o}</button>`).join('')}</div>
        <div class="feedback" hidden></div></div>`);
      wrap.appendChild(el);
      const fb = el.querySelector('.feedback');
      el.querySelector('.opts').addEventListener('click', (e) => {
        const b = e.target.closest('.opt'); if (!b || el.dataset.ok) return;
        fb.hidden = false;
        if (+b.dataset.k === q.answer) {
          el.dataset.ok = '1';
          b.classList.add('right');
          fb.className = 'feedback ok';
          fb.textContent = '✅ ' + q.bravo;
          if (store.voice) speak(q.bravo);
          if (qi + 1 < questions.length) setTimeout(() => ask(qi + 1), 600);
        } else {
          b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
          fb.className = 'feedback ko';
          fb.textContent = 'Presque ! Essaie encore 💪';
        }
      });
    };
    ask(0);
  }

  function winMedal(ch) {
    store.medals[ch.id] = true;
    saveStore();
    const pos = CHAPTERS.indexOf(ch);
    const after = pos >= 0 ? CHAPTERS[pos + 1] : null;
    const m = h(`<div class="modal-wrap" role="dialog" aria-modal="true">
      <div class="modal">
        <div class="medal">${ch.icon}</div>
        <h2>${ch.winTitle || 'Bravo Camille !'}</h2>
        <p>${ch.winText || `Tu as gagné la <b>${ch.medal}</b> 🏅`}</p>
        <div class="row">
          <a class="btn" href="#home">🏟️ Retour au stade</a>
          ${after ? `<a class="btn btn-primary" href="#${after.id}">Entraînement suivant ▶</a>` : ''}
        </div>
      </div></div>`);
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target.closest('a') || e.target === m) m.remove(); });
    confetti();
    if (ch.winTitle) setTimeout(confetti, 1200);
    if (store.voice) speak(ch.winTitle ? `${ch.winTitle} ${ch.winText}` : `Bravo Camille ! Tu as gagné la ${ch.medal} !`);
  }

  /* ---------- terrain libre ---------- */
  function renderFree() {
    document.documentElement.classList.add('page-chapter');
    const page = h(`
      <div class="chapter">
        <header class="ch-top">
          <a class="btn btn-small" href="#home">← Stade</a>
          <div class="ch-name"><small>Quand tu veux</small><h1>🎮 Terrain libre</h1></div>
        </header>
        <div class="ch-body">
          ${stageHTML()}
          <section class="story">
            <div class="coach-row">
              <div class="coach-avatar" aria-hidden="true">🐼</div>
              <div class="bubble"><h2>Ici, c'est toi le coach !</h2>
                <p>Pas de leçon : essaie tous les gestes, mélange tout... Et si tu es perdue, la <b>magie</b> range tout en remontant le temps.</p></div>
            </div>
            <div class="extra">${trainerHTML(`
              <button class="btn btn-small" data-tool="mix">🌪️ Mélanger</button>
              <button class="btn btn-small btn-primary" data-tool="magic">✨ Magie</button>`, { macros: MACROS })}</div>
          </section>
        </div>
      </div>`);
    app.replaceChildren(page);
    const { view, player } = makeStage(page);
    player.load({ setup: '' }, true);
    const t = bindTrainer(page, view, { macros: MACROS });
    const faces = ['R', 'L', 'U', 'D', 'F', 'B'];
    page.querySelector('[data-tool=mix]').addEventListener('click', () => {
      t.queue = t.queue.then(async () => {
        let prevFace = '';
        for (let i = 0; i < 18; i++) {
          let f; do { f = faces[(Math.random() * 6) | 0]; } while (f === prevFace);
          prevFace = f;
          const tok = f + ['', "'", '2'][(Math.random() * 3) | 0];
          if (!(await view.animateMove(tok, { duration: 140, arrow: false }))) return;
          t.history.push(tok);
        }
      });
    });
    page.querySelector('[data-tool=magic]').addEventListener('click', () => {
      t.queue = t.queue.then(async () => {
        player.showCaption({ icon: '✨', text: 'Magie… on remonte le temps !' });
        while (t.history.length) {
          const last = t.history.pop();
          if (!(await view.animateMove(L.invert(last), { duration: 150, arrow: false }))) break;
        }
        player.showCaption({ icon: '🏆', text: 'Tout est rangé !' });
        setTimeout(() => player.showCaption(null), 1800);
      });
    });
  }

  /* ============================================================
     MON CUBE : photos -> couleurs -> le coach guide sur SON cube
     ============================================================ */
  const MY_KEY = 'grand-tournoi-moncube-v1';
  const loadMy = () => { try { return JSON.parse(localStorage.getItem(MY_KEY)) || null; } catch (e) { return null; } };
  const saveMy = (v) => { try { localStorage.setItem(MY_KEY, JSON.stringify(v)); } catch (e) { /* pas grave */ } };
  const FACE_ORDER = ['F', 'R', 'B', 'L', 'U', 'D'];
  const centerOf = (f) => L.START_COLORS[f];
  const teamOf = (c) => TEAMS[c];

  // Le cube de Camille, prêt pour le solveur : { cube, solution, setup } ou { errors }
  function myCubeFromGrids(grids) {
    const r = L.fromFacelets(grids);
    if (r.errors) return { errors: r.errors };
    try {
      const solution = window.Solver.solve(r.cube);
      const rots = solution.moves.filter((t) => /^[xyz]/.test(t)).join(' ');
      const setup = (rots + ' ' + L.invert(solution.moves.join(' '))).trim();
      return { cube: r.cube, solution, setup };
    } catch (e) {
      return {
        errors: [{
          msg: 'Ce cube est impossible à résoudre tel quel : une case est sûrement mal lue (souvent rouge/orange ou blanc/jaune). ' +
            'Vérifie les cases entourées en pointillés. Si tout est juste, une pièce a peut-être été tournée à la main.',
          cells: [],
        }],
      };
    }
  }

  /* ---------- Le cube de Camille, suivi geste par geste ----------
     my = { grids (les photos), moves (tous les gestes faits depuis), solve ({ baseLen, slide } du guide « Mon cube ») } */
  let myCache = null;
  function myNow() {
    const my = loadMy();
    if (!my || !my.grids) return null;
    const key = JSON.stringify(my.grids);
    if (!myCache || myCache.key !== key) myCache = { key, res: myCubeFromGrids(my.grids) };
    const res = myCache.res;
    if (res.errors) return null;
    const moves = my.moves || [];
    const cube = L.clone(res.cube);
    if (moves.length) L.apply(cube, moves.join(' '));
    return { my, res, moves, cube, setup: [res.setup, ...moves].join(' ').trim() };
  }
  function setMyMoves(moves, solve = null) {
    const my = loadMy();
    if (!my) return;
    my.moves = moves;
    my.solve = solve;
    saveMy(my);
  }
  const RANK = (p) => window.Solver.ORDER.indexOf(p);
  const UPV = [0, 1, 0], FRONTV = [0, 0, 1];
  // Le dessin « Tiens ton cube » sur la scène : quel capitaine en haut, lequel devant
  function updateHold() {
    const el = document.querySelector('.stage .hold');
    if (!el || el.hidden || !current || !current.view) return;
    const c = current.view.cube;
    const top = L.centerColor(c, UPV), front = L.centerColor(c, FRONTV);
    el.innerHTML = `<span class="hold-title">Tiens ton cube</span>
      <span class="hold-row"><i style="background:${HEX(top)}">${TEAMS[top].emoji}</i>en haut</span>
      <span class="hold-row"><i style="background:${HEX(front)}">${TEAMS[front].emoji}</i>devant toi</span>`;
  }
  function holdText(cube) {
    const top = TEAMS[L.centerColor(cube, UPV)], front = TEAMS[L.centerColor(cube, FRONTV)];
    return `${top.one} ${top.emoji} en haut, ${front.one} ${front.emoji} devant toi`;
  }
  function goPhotos(ch, direct) {
    store.returnTo = ch.id;
    if (direct) store.autoShots = true;
    saveStore();
    location.hash = 'moncube';
  }

  /* L'écran « À toi de jouer » d'un entraînement, avec le vrai cube */
  function mineSlide(ch, s) {
    const now = myNow();
    if (!now) return { ...s, invite: true };
    let p;
    try { p = window.Solver.progress(now.cube, now.moves.slice(-12)); } catch (e) { return { ...s, invite: true, lost: true }; }
    const goal = ch.mine.goal;
    const state = RANK(p) < RANK(ch.id) ? 'early' : RANK(p) > RANK(ch.id) ? 'done' : 'ready';
    const checked = store.checkFor === ch.id; // elle vient de le faire seule et de montrer son cube
    if (checked) { delete store.checkFor; saveStore(); }
    const scene = { setup: now.setup, view: ch.mine.view || 'normal' };
    const base = { scene, finish: true, mine: { state, now, progress: p, checked } };
    if (state === 'done' && checked) {
      return { ...base, mine: { ...base.mine, state: 'won' },
        title: 'Bravo, c’est réussi ! 🎉',
        text: MINE_SAY.reached(goal),
        speech: MINE_SAY.reached(goal) };
    }
    if (state === 'ready') {
      return { ...base,
        title: checked ? 'Presque ! Encore un effort 💪' : 'À toi, avec <b>ton</b> cube !',
        text: `Prends ton cube et tiens-le <b>comme sur le dessin</b>, en haut du cube.<br>
               🎯 Ton but : <b>${goal}</b>.<br><br>
               Appuie sur <b>▶ Geste suivant</b> : le coach montre un geste, tu le fais sur ton vrai cube. Et ainsi de suite !`,
        speech: MINE_SAY.ready(goal) };
    }
    if (state === 'early') {
      const st = window.Solver.STAGES[p];
      const num = (CHAPTERS.find((c) => c.id === p) || {}).num;
      return { ...base,
        title: 'Ton cube n’est pas encore prêt',
        text: `Avant cet exercice, ton cube doit d’abord finir l’étape <b>${st.icon} ${st.title}</b> (entraînement ${num}).<br><br>
               Pas de souci : tiens ton cube <b>comme sur le dessin</b> et appuie sur <b>▶ Geste suivant</b>. Le coach te montre quoi faire.`,
        speech: MINE_SAY.early };
    }
    return { ...base,
      title: 'Déjà fait sur ton cube ! ✅',
      text: `Ton cube a déjà passé cette étape.<br><br>
             Pour t’entraîner, le coach peut le mélanger <b>juste ce qu’il faut</b> : regarde les gestes, et fais-les sur ton vrai cube.`,
      speech: MINE_SAY.done };
  }

  function bindInvite(root, ch) {
    const box = h(`<div class="mine-invite">
        <p>📸 Tu veux faire cet exercice avec <b>ton</b> cube, et le voir ici exactement comme dans tes mains ?</p>
        <button class="btn btn-primary">📸 Montrer mon cube au coach</button>
      </div>`);
    box.querySelector('button').addEventListener('click', () => goPhotos(ch, true));
    root.appendChild(box);
  }

  /* L'exercice avec le vrai cube : le coach mène, un gros bouton, un geste à la fois */
  function bindMine(root, ch, info, view, player, redo) {
    const cfg = ch.mine;
    const goal = cfg.goal;
    const base = info.now.moves.slice();
    const moves = base.slice();
    const setupNow = () => [info.now.res.setup, ...moves].join(' ').trim();
    const mixing = info.state === 'done';
    const won = info.state === 'won';
    root.innerHTML = `
      <div class="mine-ex">
        <div class="mine-goal ${won || mixing ? 'ok' : ''}"><span class="mg-icon">${won || mixing ? '✅' : '🎯'}</span><span>Ton but : <b>${goal}</b></span></div>
        <div class="mine-hint" hidden></div>
        <div class="note" hidden></div>
        ${won ? '' : `<button class="btn btn-primary mine-next" data-mine="next">${mixing ? '🌀 Mélange juste ce qu’il faut' : '▶ Geste suivant'}</button>`}
        <div class="mine-tools" ${won ? 'hidden' : ''}>
          <button class="btn btn-small" data-mine="again" disabled>🔁 Revoir le geste</button>
          <button class="btn btn-small" data-mine="undo" disabled>↩️ Oups, je me suis trompée</button>
        </div>
        <div class="mine-foot">
          ${won || mixing ? '' : '<button class="btn btn-small" data-mine="alone">💪 Je le fais toute seule</button>'}
          <button class="btn btn-small" data-mine="photos">📸 Mon vrai cube est différent</button>
        </div>
      </div>`;
    const note = root.querySelector('.note');
    const goalEl = root.querySelector('.mine-goal');
    const hintBox = root.querySelector('.mine-hint');
    const next = root.querySelector('[data-mine=next]');
    const again = root.querySelector('[data-mine=again]');
    const undo = root.querySelector('[data-mine=undo]');
    let reached = won || mixing;
    let wasEarly = info.state === 'early';
    let step = null; // le conseil en cours : on avance dedans geste par geste
    let busy = false;
    const say = (text) => { if (store.voice) speak(text); };
    const tools = () => {
      again.disabled = busy || moves.length <= base.length;
      undo.disabled = busy || moves.length <= base.length;
      if (next) next.disabled = busy;
    };
    const record = (t) => { moves.push(t); setMyMoves(moves.slice()); };
    player.onStep = (mv) => { record(mv.token); updateHold(); };
    const check = () => {
      if (!root.isConnected || mixing) return;
      let p;
      try { p = window.Solver.progress(view.cube); } catch (e) { return; }
      const ok = RANK(p) > RANK(ch.id);
      goalEl.classList.toggle('ok', ok);
      goalEl.querySelector('.mg-icon').textContent = ok ? '✅' : '🎯';
      if (ok && !reached) {
        reached = true;
        step = null;
        hintBox.hidden = true;
        if (next) next.hidden = true;
        note.hidden = false;
        note.innerHTML = MINE_SAY.reached(goal);
        say(note.innerHTML);
        if (ch.id === 'ch7') confetti();
      } else if (!ok && reached) { // « Oups » après la victoire : on repart
        reached = false;
        note.hidden = true;
        if (next) next.hidden = false;
      } else if (!ok && wasEarly && p === ch.id) {
        wasEarly = false;
        note.hidden = false;
        note.innerHTML = MINE_SAY.prepared(goal);
        say(note.innerHTML);
      }
    };
    // Charge le prochain conseil du coach (ou le mélange) sur la scène
    function loadStep() {
      if (mixing) {
        const m = window.Solver.practice(view.cube, ch.id);
        if (!m) { note.hidden = false; note.innerHTML = 'Oups, le coach n’a pas trouvé de mélange. Mélange ton cube toi-même et montre-le au coach 📸.'; return null; }
        hintBox.hidden = false;
        hintBox.innerHTML = `<h3>🌀 Le coach mélange</h3><p>${MINE_SAY.mix}</p>`;
        say(MINE_SAY.mix);
        return { moves: m, hl: null, mix: true };
      }
      let hh = null;
      try { hh = window.Solver.hint(view.cube, moves.slice(-12)); } catch (e) { hh = null; }
      if (!hh) { note.hidden = false; note.innerHTML = '🏆 Ton cube est rangé : rien à faire !'; return null; }
      const earlier = RANK(hh.chapter) < RANK(ch.id);
      hintBox.hidden = false;
      hintBox.innerHTML = `
        <h3>${hh.title}</h3>
        ${earlier ? `<p class="mh-before">D’abord, on finit l’étape <b>${hh.icon} ${hh.stageTitle}</b>.</p>` : ''}
        <p>${hh.text}</p>`;
      say(hh.text);
      const target = hh.target;
      return { moves: hh.moves, hl: target == null ? null : (p) => p.id === target || p.type === 'center' };
    }
    if (next) next.addEventListener('click', async () => {
      if (busy || player.playing) return;
      busy = true; tools();
      if (!step || player.idx >= player.moves.length) {
        step = loadStep();
        if (!step) { busy = false; tools(); return; }
        note.hidden = true;
        player.load({ setup: setupNow(), moves: step.moves, hl: step.hl, view: cfg.view });
        player.hideControls = true;
        player.render();
      }
      await player.one();
      busy = false;
      if (player.idx >= player.moves.length) {
        const wasMix = step && step.mix;
        step = null;
        player.load({ setup: setupNow(), view: cfg.view });
        updateHold();
        if (wasMix) { redo(); return; }
        hintBox.hidden = true;
      }
      tools();
      check();
    });
    // Revoir le dernier geste (sans rien changer au cube)
    again.addEventListener('click', async () => {
      if (busy || player.playing || moves.length <= base.length) return;
      busy = true; tools();
      const last = moves[moves.length - 1];
      await view.animateMove(L.invert(last), { duration: 200, arrow: false });
      await wait(250);
      if (SAY[last]) say(SAY[last][1]);
      await view.animateMove(last, { preview: 400, duration: 700 });
      busy = false; tools();
    });
    // Oups : on défait le dernier geste, sur l'écran et sur le vrai cube
    undo.addEventListener('click', async () => {
      if (busy || player.playing || moves.length <= base.length) return;
      busy = true; tools();
      step = null;
      hintBox.hidden = false;
      hintBox.innerHTML = '<p>↩️ Fais le geste <b>à l’envers</b> sur ton vrai cube, comme sur l’écran.</p>';
      player.load({ setup: setupNow(), view: cfg.view });
      const back = L.invert(moves[moves.length - 1]);
      if (SAY[back]) say(SAY[back][1]);
      const ok = await view.animateMove(back, { preview: 400, duration: 700 });
      if (ok) { moves.pop(); setMyMoves(moves.slice()); }
      updateHold();
      busy = false; tools(); check();
    });
    const alone = root.querySelector('[data-mine=alone]');
    if (alone) alone.addEventListener('click', () => { store.checkFor = ch.id; saveStore(); goPhotos(ch, true); });
    root.querySelector('[data-mine=photos]').addEventListener('click', () => goPhotos(ch, true));
    tools();
    if (won) confetti();
  }

  function renderMyCube() {
    let my = loadMy() || {};
    const page = h(`
      <div class="mc-page">
        <header class="ch-top">
          <a class="btn btn-small" href="#home">← Stade</a>
          <div class="ch-name"><small>Avec ton vrai cube</small><h1>📸 Mon cube</h1></div>
        </header>
        <main class="mc-wrap"></main>
        <input type="file" accept="image/*" id="mc-file" hidden>
      </div>`);
    app.replaceChildren(page);
    const wrap = page.querySelector('.mc-wrap');
    const fileInput = page.querySelector('#mc-file');

    /* --- accueil de la page --- */
    function home() {
      const has = my.grids && !myCubeFromGrids(my.grids).errors;
      const back = CHAPTERS.find((c) => c.id === store.returnTo);
      wrap.innerHTML = `
        <section class="mc-card">
          <div class="coach-row">
            <div class="coach-avatar" aria-hidden="true">🐼</div>
            <div class="bubble"><h2>Ton cube dans le stade !</h2>
              <p>Montre les <b>6 faces</b> de ton cube à la caméra, dans l’ordre et le sens que tu veux. Le coach lit les couleurs, et ton cube apparaît
              dans l’appli, exactement comme dans tes mains : dans les exercices <b>« À toi de jouer »</b> de chaque entraînement,
              et dans le grand guide où le coach résout <b>ton</b> cube avec toi.</p></div>
          </div>
          <div class="mc-actions">
            ${has && back ? `<a class="btn btn-primary" href="#${back.id}" data-act="back-ch">▶ Retour à l’entraînement ${back.num}</a>` : ''}
            ${has ? `<a class="btn ${back ? '' : 'btn-primary'}" href="#moncube-go">🧭 Le coach résout mon cube</a>` : ''}
            <button class="btn ${has ? '' : 'btn-primary'}" data-act="shots">📸 ${has ? 'Nouvelles photos' : 'Prendre les photos'}</button>
            <button class="btn" data-act="manual">🎨 Colorier à la main</button>
            ${my.grids ? `<button class="btn" data-act="edit">✏️ Corriger les couleurs</button>` : ''}
          </div>
          <p class="hint-small">💡 Pour de belles photos : une pièce bien éclairée, sans reflet du plafonnier, le cube bien en face.</p>
        </section>`;
      wrap.querySelector('[data-act=shots]').addEventListener('click', startShots);
      const bc = wrap.querySelector('[data-act=back-ch]');
      if (bc) bc.addEventListener('click', () => { store.resumeMine = store.returnTo; saveStore(); });
      wrap.querySelector('[data-act=manual]').addEventListener('click', () => {
        const blank = {};
        for (const f of FACE_ORDER) blank[f] = [0, 1, 2].map((r) => [0, 1, 2].map((c) => (r === 1 && c === 1 ? centerOf(f) : '?')));
        editor(blank, null);
      });
      const ed = wrap.querySelector('[data-act=edit]');
      if (ed) ed.addEventListener('click', () => editor(my.grids, null));
    }

    /* --- les 6 faces : n'importe laquelle, dans n'importe quel sens --- */
    let shots = []; // pour chaque photo : 3x3 couleurs [r, g, b]
    const startShots = () => {
      shots = [];
      const canLive = navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext;
      if (canLive) camera(); else filePhoto();
    };
    const facesHTML = () => `<div class="mc-faces">${[0, 1, 2, 3, 4, 5].map((k) => `
      <span class="mc-face ${shots[k] ? 'done' : k === shots.length ? 'here' : ''}">${shots[k]
        ? shots[k].flat().map((c) => `<i style="background:rgb(${c.map(Math.round).join(',')})"></i>`).join('')
        : `<b>${k + 1}</b>`}</span>`).join('')}</div>`;
    // Même face prise deux fois ? (on compare les 9 cases, dans les 4 sens)
    const LAB = (smp) => smp.map((row) => row.map((c) => window.Photo.rgbToLab(c)));
    function sameFace(a, b) {
      const la = LAB(a);
      let lb = LAB(b);
      if (window.Photo.dist(la[1][1], lb[1][1]) > 14) return false;
      for (let k = 0; k < 4; k++, lb = L.rot90(lb)) {
        let sum = 0;
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) sum += window.Photo.dist(la[r][c], lb[r][c]);
        if (sum / 9 < 14) return true;
      }
      return false;
    }
    // Une face de plus : renvoie un message si elle est refusée
    function addShot(smp) {
      const light = smp.flat().reduce((n, c) => n + (c[0] + c[1] + c[2]) / 3, 0) / 9;
      if (light < 35) return 'Je ne vois pas bien ton cube : mets-toi près d’une lumière, et remplis bien le carré.';
      if (shots.some((x) => sameFace(x, smp))) return 'Celle-là, tu l’as déjà prise ! Tourne ton cube pour montrer une autre face.';
      shots.push(smp);
      return null;
    }
    function finishShots() {
      stopCamera();
      const res = window.Photo.readShots(shots, L.arrangeFaces, (g) => !myCubeFromGrids(g).errors);
      if (res.ok) { saveGrids(res.grids, res.options); return; }
      // un souci de couleur : on montre les 6 photos, les cases douteuses en pointillés
      const raw = {};
      const conf = {};
      res.raw.forEach((g, k) => { raw['s' + k] = g; conf['s' + k] = res.confidence[k]; });
      editor(raw, conf, true);
    }

    /* --- la caméra en direct, avec un carré-guide --- */
    let stream = null;
    let loop = 0;
    function stopCamera() {
      cancelAnimationFrame(loop);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    current = { stop: stopCamera };
    async function camera() {
      wrap.innerHTML = `
        <section class="mc-card mc-cam-card">
          <h2>Montre une face de ton cube 📸</h2>
          <p>N’importe laquelle, <b>dans n’importe quel sens</b>. Remplis bien le carré avec le cube, puis appuie sur le gros bouton.</p>
          <div class="cam">
            <video playsinline muted autoplay></video>
            <div class="cam-guide"><div class="grid9 live">${'<i></i>'.repeat(9)}</div></div>
            <div class="cam-msg" hidden></div>
          </div>
          <div class="cam-bar">
            ${facesHTML()}
            <button class="btn btn-primary cam-snap" data-act="snap" disabled>📸 Clic !</button>
          </div>
          <div class="mc-actions">
            <button class="btn btn-small" data-act="undo-shot" ${shots.length ? '' : 'hidden'}>↩️ Reprendre la dernière</button>
            <button class="btn btn-small" data-act="file">🖼️ Plutôt avec l’appareil photo</button>
            <button class="btn btn-small" data-act="back">◀ Retour</button>
          </div>
        </section>`;
      const video = wrap.querySelector('video');
      const guide = wrap.querySelector('.cam-guide');
      const cells = wrap.querySelectorAll('.grid9.live i');
      const msg = wrap.querySelector('.cam-msg');
      const snap = wrap.querySelector('[data-act=snap]');
      const canvas = document.createElement('canvas');
      const say = (t) => { msg.hidden = !t; msg.textContent = t || ''; };
      wrap.querySelector('[data-act=back]').addEventListener('click', () => { stopCamera(); home(); });
      wrap.querySelector('[data-act=file]').addEventListener('click', () => { stopCamera(); filePhoto(); });
      const undoShot = wrap.querySelector('[data-act=undo-shot]');
      const refresh = () => {
        wrap.querySelector('.mc-faces').outerHTML = facesHTML();
        undoShot.hidden = !shots.length;
      };
      undoShot.addEventListener('click', () => { shots.pop(); refresh(); say(''); });
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false,
        });
      } catch (e) {
        say('La caméra ne veut pas s’ouvrir. Utilise « Plutôt avec l’appareil photo ».');
        return;
      }
      if (!wrap.contains(video)) { stopCamera(); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});
      // Le carré-guide (à l'écran) -> le même carré dans l'image de la caméra
      const box = () => {
        const vw = video.videoWidth, vh = video.videoHeight;
        const vr = video.getBoundingClientRect(), gr = guide.getBoundingClientRect();
        const k = Math.max(vr.width / vw, vr.height / vh); // la vidéo remplit le cadre (object-fit: cover)
        const ox = (vr.width - vw * k) / 2, oy = (vr.height - vh * k) / 2;
        return { x: (gr.left - vr.left - ox) / k, y: (gr.top - vr.top - oy) / k, size: gr.width / k };
      };
      let last = null;
      let t0 = 0;
      const tick = (t) => {
        loop = requestAnimationFrame(tick);
        if (!video.videoWidth || t - t0 < 180) return;
        t0 = t;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0);
        last = window.Photo.sample(canvas, box());
        last.flat().forEach((c, k) => { cells[k].style.background = `rgba(${c.map(Math.round).join(',')},0.85)`; });
        snap.disabled = false;
      };
      loop = requestAnimationFrame(tick);
      snap.addEventListener('click', () => {
        if (!last) return;
        const refused = addShot(last.map((row) => row.map((c) => c.slice())));
        if (refused) { say(refused); return; }
        if (shots.length === 6) { finishShots(); return; }
        refresh();
        say(`Super ! Encore ${6 - shots.length}. Tourne ton cube et montre une autre face.`);
        guide.classList.remove('flash'); void guide.offsetWidth; guide.classList.add('flash');
        if (store.voice && shots.length === 1) speak('Super ! Tourne ton cube et montre une autre face.');
      });
    }

    /* --- secours : une photo de l'appareil, puis on place la grille --- */
    function filePhoto() {
      wrap.innerHTML = `
        <section class="mc-card">
          <h2>Photo ${shots.length + 1} sur 6</h2>
          <p>Prends en photo une face de ton cube : <b>n’importe laquelle, dans n’importe quel sens</b>, bien en face.</p>
          ${facesHTML()}
          <div class="mc-shot" hidden>
            <div class="shot-frame"><canvas></canvas><div class="grid9" aria-label="Grille à placer sur le cube">${'<i></i>'.repeat(9)}</div></div>
            <label for="grid-size">Taille de la grille</label>
            <input type="range" id="grid-size" min="20" max="100" value="62">
            <p class="hint-small">👆 Fais glisser la grille pour que chaque case tombe sur une couleur du cube.</p>
          </div>
          <div class="cam-msg" hidden></div>
          <div class="mc-actions">
            <button class="btn btn-primary" data-act="take">📸 Prendre la photo</button>
            <button class="btn btn-primary" data-act="ok" hidden>✓ C'est bon</button>
            <button class="btn" data-act="back">◀ Retour</button>
          </div>
        </section>`;
      const area = wrap.querySelector('.mc-shot');
      const canvas = area.querySelector('canvas');
      const grid = area.querySelector('.grid9');
      const size = area.querySelector('#grid-size');
      const take = wrap.querySelector('[data-act=take]');
      const ok = wrap.querySelector('[data-act=ok]');
      const msg = wrap.querySelector('.cam-msg');
      let box = null;
      const place = () => {
        grid.style.left = (box.x / canvas.width) * 100 + '%';
        grid.style.top = (box.y / canvas.height) * 100 + '%';
        grid.style.width = (box.size / canvas.width) * 100 + '%';
        grid.style.height = (box.size / canvas.height) * 100 + '%';
      };
      const clampBox = () => {
        box.size = Math.min(box.size, canvas.width, canvas.height);
        box.x = Math.max(0, Math.min(canvas.width - box.size, box.x));
        box.y = Math.max(0, Math.min(canvas.height - box.size, box.y));
      };
      size.addEventListener('input', () => {
        const cx = box.x + box.size / 2, cy = box.y + box.size / 2;
        box.size = (Math.min(canvas.width, canvas.height) * size.value) / 100;
        box.x = cx - box.size / 2; box.y = cy - box.size / 2;
        clampBox(); place();
      });
      let drag = null;
      grid.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; grid.setPointerCapture(e.pointerId); });
      grid.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const k = canvas.width / canvas.getBoundingClientRect().width;
        box.x += (e.clientX - drag.x) * k; box.y += (e.clientY - drag.y) * k;
        drag = { x: e.clientX, y: e.clientY };
        clampBox(); place();
      });
      grid.addEventListener('pointerup', () => { drag = null; });
      grid.addEventListener('pointercancel', () => { drag = null; });
      take.addEventListener('click', () => { fileInput.value = ''; fileInput.click(); });
      fileInput.onchange = () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
          canvas.width = Math.round(img.naturalWidth * k);
          canvas.height = Math.round(img.naturalHeight * k);
          canvas.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          const s0 = Math.min(canvas.width, canvas.height) * 0.62;
          box = { x: (canvas.width - s0) / 2, y: (canvas.height - s0) / 2, size: s0 };
          size.value = 62;
          area.hidden = false;
          ok.hidden = false;
          take.className = 'btn';
          take.innerHTML = '↺ Reprendre la photo';
          place();
        };
        img.onerror = () => { URL.revokeObjectURL(url); take.innerHTML = '📸 Photo illisible, réessaie'; };
        img.src = url;
      };
      ok.addEventListener('click', () => {
        const refused = addShot(window.Photo.sample(canvas, box));
        if (refused) { msg.hidden = false; msg.textContent = refused; return; }
        if (shots.length === 6) finishShots(); else filePhoto();
      });
      wrap.querySelector('[data-act=back]').addEventListener('click', () => {
        if (shots.length) { shots.pop(); filePhoto(); } else home();
      });
    }

    /* --- vérifier / corriger les couleurs --- */
    // raw : les 6 photos telles que prises (s0…s5), dans leur sens ; sinon le patron du cube (U, F, R…)
    function editor(grids, confidence, raw) {
      grids = JSON.parse(JSON.stringify(grids));
      confidence = confidence && JSON.parse(JSON.stringify(confidence));
      let paint = 'W';
      let errorCells = new Set();
      const NET = raw
        ? { s0: [0, 0], s1: [0, 1], s2: [0, 2], s3: [1, 0], s4: [1, 1], s5: [1, 2] }
        : { U: [0, 1], L: [1, 0], F: [1, 1], R: [1, 2], B: [1, 3], D: [2, 1] };
      const KEYS = Object.keys(NET);
      wrap.innerHTML = `
        <section class="mc-card">
          <h2>${raw ? 'Aide le coach : une couleur est mal lue' : 'Vérifie les couleurs'}</h2>
          <p>${raw ? 'Voici tes 6 photos. Compare-les avec ton cube : ' : 'Compare avec ton vrai cube. '}si une case est fausse,
          choisis la bonne couleur en bas, puis touche la case.
          ${confidence ? 'Regarde surtout les cases en <b>pointillés</b> : le coach n’en est pas sûr.' : ''}</p>
          <div class="net ${raw ? 'raw' : ''}"></div>
          <div class="palette"></div>
          <div class="mc-errors" hidden></div>
          <div class="mc-actions">
            <button class="btn btn-primary" data-act="check">✓ C'est mon cube !</button>
            <button class="btn" data-act="back">◀ Retour</button>
          </div>
        </section>`;
      const net = wrap.querySelector('.net');
      const pal = wrap.querySelector('.palette');
      const errBox = wrap.querySelector('.mc-errors');
      const drawNet = () => {
        net.innerHTML = Object.entries(NET).map(([f, [row, col]]) => `
          <div class="net-face" style="grid-row:${row + 1};grid-column:${col + 1}">
            ${[0, 1, 2].map((r) => [0, 1, 2].map((c) => {
              const v = grids[f][r][c];
              const doubt = confidence && confidence[f][r][c] < 0.62 && !(r === 1 && c === 1);
              const err = errorCells.has(`${f}${r}${c}`);
              return `<button class="cell ${v === '?' ? 'empty' : ''} ${doubt ? 'doubt' : ''} ${err ? 'err' : ''} ${r === 1 && c === 1 && !raw ? 'center' : ''}"
                data-cell="${f}${r}${c}" style="${v !== '?' ? `background:${HEX(v)}` : ''}"
                aria-label="${f} ${r + 1}-${c + 1} : ${L.COLOR_NAMES[v] || 'vide'}">${r === 1 && c === 1 ? teamOf(v).emoji : ''}</button>`;
            }).join('')).join('')}
          </div>`).join('');
        const count = {};
        for (const f of KEYS) grids[f].flat().forEach((v) => { count[v] = (count[v] || 0) + 1; });
        pal.innerHTML = ['W', 'Y', 'G', 'B', 'O', 'R'].map((c) => `
          <button class="pal ${paint === c ? 'on' : ''} ${count[c] === 9 ? 'full' : ''}" data-paint="${c}" style="--c:${HEX(c)}">
            <i></i>${L.COLOR_NAMES[c]}<small>${count[c] || 0}/9</small></button>`).join('') +
          (count['?'] ? `<span class="todo">Encore ${count['?']} cases à colorier</span>` : '');
      };
      net.addEventListener('click', (e) => {
        const b = e.target.closest('[data-cell]');
        if (!b || b.classList.contains('center')) return;
        const key = b.dataset.cell;
        const [f, r, c] = [key.slice(0, -2), +key[key.length - 2], +key[key.length - 1]];
        grids[f][r][c] = paint;
        if (confidence) confidence[f][r][c] = 1;
        errorCells.delete(b.dataset.cell);
        drawNet();
      });
      pal.addEventListener('click', (e) => {
        const b = e.target.closest('[data-paint]');
        if (b) { paint = b.dataset.paint; drawNet(); }
      });
      drawNet();
      wrap.querySelector('[data-act=back]').addEventListener('click', raw ? startShots : home);
      wrap.querySelector('[data-act=check]').addEventListener('click', () => {
        if (raw) {
          const count = {};
          for (const f of KEYS) grids[f].flat().forEach((v) => { count[v] = (count[v] || 0) + 1; });
          const bad = ['W', 'Y', 'G', 'B', 'O', 'R'].filter((c) => count[c] !== 9);
          const centers = new Set(KEYS.map((f) => grids[f][1][1]));
          const arr = !bad.length && centers.size === 6 && L.arrangeFaces(KEYS.map((f) => grids[f]));
          const options = arr ? arr.all.filter((x) => !myCubeFromGrids(x).errors) : [];
          if (options.length) { saveGrids(options[0], options); return; }
          errBox.hidden = false;
          errBox.innerHTML = '<b>Oups, ce n’est pas encore ça :</b><ul>' +
            (bad.length ? `<li>Chaque couleur doit apparaître 9 fois. Ici : ${bad.map((c) => `${count[c] || 0} ${L.COLOR_NAMES[c]}`).join(', ')}.</li>`
              : centers.size !== 6 ? '<li>Les 6 cases du milieu doivent être 6 couleurs différentes.</li>'
                : '<li>Le cube ne tombe pas juste : une case est sûrement mal lue (souvent rouge/orange ou blanc/jaune).</li>') +
            '</ul>';
          errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }
        const res = myCubeFromGrids(grids);
        if (res.errors) {
          errorCells = new Set(res.errors.flatMap((er) => er.cells.map(([f, r, c]) => `${f}${r}${c}`)));
          errBox.hidden = false;
          errBox.innerHTML = '<b>Oups, il y a un souci :</b><ul>' + res.errors.map((er) => `<li>${er.msg}</li>`).join('') + '</ul>';
          drawNet();
          errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }
        errBox.hidden = true;
        saveGrids(grids);
      });
    }

    // options : quand les photos laissent 2 possibilités (rare), on peut passer à l'autre
    function saveGrids(grids, options, k = 0) {
      my = { grids, savedAt: Date.now(), moves: [] };
      saveMy(my);
      success(myCubeFromGrids(grids), options && options.length > 1 ? () => {
        const n = (k + 1) % options.length;
        saveGrids(options[n], options, n);
      } : null);
    }

    /* --- c'est bon ! --- */
    function success(res, other) {
      wrap.innerHTML = '<section class="mc-card mc-result"></section>';
      const box = wrap.querySelector('.mc-result');
      const solved = res.solution.alreadySolved;
      const back = CHAPTERS.find((c) => c.id === store.returnTo);
      box.innerHTML = `
        <h2>${solved ? 'Ton cube est déjà rangé ! 🏆' : 'Voilà ton cube ! ✨'}</h2>
        <p>${solved ? 'Dans les exercices, le coach peut le mélanger juste ce qu’il faut. Ou mélange-le, puis reprends les photos.' : 'Fais-le tourner avec ton doigt et compare avec ton vrai cube. C’est bien le même ?'}</p>
        <div class="mc-preview"></div>
        <div class="mc-actions">
          ${back ? `<a class="btn btn-primary" href="#${back.id}" data-act="back-ch">▶ Retour à l’entraînement ${back.num}</a>` : ''}
          ${solved ? '' : `<a class="btn ${back ? '' : 'btn-primary'}" href="#moncube-go">🧭 Le coach résout mon cube</a>`}
        </div>
        ${back ? '' : '<p class="hint-small">💡 Ton cube t’attend aussi dans les exercices « À toi de jouer » de chaque entraînement.</p>'}
        <div class="mc-actions">
          ${other ? '<button class="btn btn-small" data-act="other">🤔 Pas tout à fait pareil ? Voir l’autre version</button>' : ''}
          <button class="btn btn-small" data-act="fix">✏️ Une couleur est fausse</button>
          <button class="btn btn-small" data-act="again">📸 Refaire les photos</button>
        </div>`;
      box.querySelector('[data-act=fix]').addEventListener('click', () => editor(my.grids, null));
      if (other) box.querySelector('[data-act=other]').addEventListener('click', other);
      box.querySelector('[data-act=again]').addEventListener('click', startShots);
      const bc = box.querySelector('[data-act=back-ch]');
      if (bc) bc.addEventListener('click', () => { store.resumeMine = store.returnTo; saveStore(); });
      if (current && current.view) current.view.destroy();
      const view = new window.Cube3D(box.querySelector('.mc-preview'));
      view.reset(res.setup);
      current = { view, stop: stopCamera };
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (store.voice) speak(solved ? 'Ton cube est déjà rangé !' : 'Voilà ton cube ! Fais-le tourner avec ton doigt et compare avec ton vrai cube.');
    }

    if (store.autoShots) { delete store.autoShots; saveStore(); startShots(); } else home();
  }

  function renderMyCubeSolve() {
    const now = myNow();
    if (!now) { location.hash = 'moncube'; return; }
    // On reprend le guide là où il était, sinon on part de l'état actuel du cube
    let base = now.moves;
    let start = 0;
    const sv = now.my.solve;
    if (sv && sv.baseLen <= base.length) { base = base.slice(0, sv.baseLen); start = sv.slide || 0; }
    const cube0 = L.clone(now.res.cube);
    if (base.length) L.apply(cube0, base.join(' '));
    let plan;
    try { plan = window.Solver.plan(cube0, base.slice(-12)); } catch (e) { location.hash = 'moncube'; return; }
    const slides = [];
    const doneAt = [];
    let done = [];
    const setupNow = () => [now.res.setup, ...base, ...done].join(' ').trim();
    const add = (sl) => { slides.push(sl); doneAt.push(done.slice()); };
    const lost = `<div class="mc-lost"><a class="btn btn-small" href="#moncube">📸 Je suis perdue : nouvelles photos</a></div>`;
    add({
      title: 'C’est ton cube !',
      text: `Voici <b>ton</b> cube, exactement comme dans tes mains. Tiens-le <b>comme sur le dessin</b>, en haut du cube : <b>${holdText(cube0)}</b>.<br><br>
             À chaque écran, regarde le geste, puis fais-le sur ton vrai cube. Utilise ⏭ <b>Un geste</b> pour avancer tout doucement.`,
      speech: 'Voici ton cube, exactement comme dans tes mains. Tiens-le comme sur l’écran. À chaque écran, regarde le geste, puis fais-le sur ton vrai cube.',
      scene: { setup: setupNow(), view: 'normal' },
    });
    // D'abord : remettre le Lion en haut, ou finir un geste commencé
    const c = L.clone(cube0);
    for (let g = 0; g < 2 && (plan.rot || plan.pre); g++) {
      const pre = window.Solver.hint(c, base.concat(done).slice(-12));
      add({ title: pre.title, text: pre.text, speech: pre.text, scene: { setup: setupNow(), moves: pre.moves, view: 'normal' }, html: lost });
      pre.moves.forEach((m) => { L.apply(c, m[0]); done.push(m[0]); });
      plan = window.Solver.plan(c, base.concat(done).slice(-12));
    }
    for (const st of plan.stages || []) {
      const moves = st.steps.reduce((n, x) => n + x.moves.length, 0);
      if (!st.steps.length) continue;
      add({
        title: `${st.icon} ${st.title}`,
        text: st.intro + (moves ? '' : '<br><br>Rien à faire ici : c’est déjà fait ! ✅'),
        speech: st.intro,
        scene: { setup: setupNow(), view: 'normal' },
        html: lost,
      });
      for (const step of st.steps) {
        if (!step.moves.length) continue;
        const target = step.target;
        add({
          title: step.title,
          text: step.text,
          speech: step.text,
          scene: {
            setup: setupNow(),
            moves: step.moves,
            hl: target == null ? null : (p) => p.id === target || p.type === 'center',
            view: st.chapter === 'ch7' && step.moves.some((m) => m[0][0] === 'D' || m[0] === 'R') ? 'below' : 'normal',
          },
          html: lost,
        });
        done = done.concat(step.moves.map((m) => m[0]));
      }
    }
    add({
      title: 'Ton cube est rangé ! 🏆',
      text: 'Si ton vrai cube ressemble à celui-ci, avec <b>chaque face d’une seule couleur</b>, appuie sur le bouton : tu as résolu <b>ton</b> cube !',
      speech: 'Si ton vrai cube ressemble à celui-ci, avec chaque face d’une seule couleur, appuie sur le bouton : tu as résolu ton cube !',
      scene: { setup: setupNow(), view: 'normal' },
      finish: true,
    });
    renderChapter({
      id: 'moncube-go', icon: '🧭', title: 'Mon cube', kicker: 'Le coach résout ton cube avec toi', showHold: true,
      start,
      // Chaque écran = les gestes d'avant sont faits sur le vrai cube : on garde le cube de l'appli pareil
      onSlide: (i) => setMyMoves(base.concat(doneAt[i]), { baseLen: base.length, slide: i }),
      medal: 'Médaille de mon cube', winTitle: 'Bravo Camille !', winText: 'Tu as résolu <b>ton</b> Rubik’s Cube avec le coach ! 🏆',
      slides,
    });
  }

  /* ---------- navigation ---------- */
  function route() {
    teardown();
    document.querySelectorAll('.modal-wrap').forEach((m) => m.remove());
    document.documentElement.classList.remove('page-chapter');
    const name = (location.hash || '').replace('#', '');
    const ch = CHAPTERS.find((c) => c.id === name);
    if (ch) renderChapter(ch);
    else if (name === 'libre') renderFree();
    else if (name === 'moncube') renderMyCube();
    else if (name === 'moncube-go') renderMyCubeSolve();
    else renderHome();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();
})();
