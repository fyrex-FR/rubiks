/* La voix du Coach Panda.
   1. Si une phrase a été enregistrée (audio/<clé>.mp3, listée dans audio/manifest.json), on joue ce fichier.
   2. Sinon, on utilise la plus belle voix française de l'appareil (sur iPad : les voix « Premium »). */
(function () {
  const S = window.Speech;
  const synth = window.speechSynthesis;
  let manifest = {};
  let ctx = null;
  let source = null;
  const buffers = new Map();
  let token = 0;
  let preferredName = null;

  // Liste des fichiers audio disponibles (s'il n'y en a pas, on reste sur la voix de l'appareil)
  const ready = fetch('audio/manifest.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((m) => { manifest = m || {}; })
    .catch(() => { manifest = {}; });

  // iPad : le son ne peut démarrer qu'après un premier toucher. On "déverrouille" à ce moment-là.
  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      const b = ctx.createBuffer(1, 1, 22050);
      const s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (e) { /* pas de son, tant pis */ }
  }
  ['pointerdown', 'touchend', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));

  async function loadBuffer(file) {
    if (buffers.has(file)) return buffers.get(file);
    const p = fetch('audio/' + file)
      .then((r) => { if (!r.ok) throw new Error('audio'); return r.arrayBuffer(); })
      .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)));
    buffers.set(file, p);
    p.catch(() => buffers.delete(file));
    return p;
  }

  function frenchVoices() {
    if (!synth) return [];
    return synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('fr'));
  }
  // Les voix "Premium" / "Améliorée" sont beaucoup plus naturelles que les voix de base
  function voiceScore(v) {
    let s = 0;
    if (/premium/i.test(v.name)) s += 100;
    if (/enhanced|améliorée|amelioree|natural|neural/i.test(v.name)) s += 60;
    if (/audrey|amélie|amelie|thomas|marie|aurélie|aurelie/i.test(v.name)) s += 10;
    if (/fr-fr/i.test(v.lang)) s += 5;
    if (/eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|jacques/i.test(v.name)) s -= 20; // voix "fantaisie" d'Apple
    return s;
  }
  function bestVoice() {
    const voices = frenchVoices();
    if (preferredName) {
      const p = voices.find((v) => v.name === preferredName);
      if (p) return p;
    }
    return voices.sort((a, b) => voiceScore(b) - voiceScore(a))[0] || null;
  }

  function speakDevice(text) {
    if (!synth) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      u.rate = 0.98;
      u.pitch = 1.05;
      const v = bestVoice();
      if (v) u.voice = v;
      synth.speak(u);
    } catch (e) { /* pas de voix */ }
  }

  function stop() {
    token++;
    try { if (source) source.stop(); } catch (e) { /* déjà fini */ }
    source = null;
    try { if (synth) synth.cancel(); } catch (e) { /* rien */ }
  }

  async function speak(html) {
    const text = S.clean(html);
    if (!text) return;
    stop();
    const my = token;
    await ready;
    const file = manifest[S.key(html)];
    if (file && ctx) {
      try {
        const buf = await loadBuffer(file);
        if (my !== token) return;
        if (ctx.state === 'suspended') await ctx.resume();
        source = ctx.createBufferSource();
        source.buffer = buf;
        source.connect(ctx.destination);
        source.start(0);
        return;
      } catch (e) { /* fichier absent : on passe à la voix de l'appareil */ }
    }
    if (my === token) speakDevice(text);
  }

  window.Voice = {
    speak,
    stop,
    ready,
    recordedCount: () => Object.keys(manifest).length,
    frenchVoices: () => frenchVoices().map((v) => v.name),
    currentVoice: () => (bestVoice() || {}).name || null,
    setPreferred: (name) => { preferredName = name || null; },
  };
  if (synth && 'onvoiceschanged' in synth) synth.onvoiceschanged = () => {};
})();
