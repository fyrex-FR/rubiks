#!/usr/bin/env node
// Enregistre toutes les phrases du Coach Panda avec une voix IA naturelle.
//
//   OpenAI (par défaut, voix « marin ») : OPENAI_API_KEY=sk-... node tools/generate-voice.js
//   Tout réenregistrer (nouvelle voix)  : ajouter --force ; autre voix : OPENAI_VOICE=cedar
//   ElevenLabs           : ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... node tools/generate-voice.js --provider=elevenlabs
//   Juste compter        : node tools/generate-voice.js --dry-run
//
// Les fichiers vont dans audio/ (un .mp3 par phrase) avec audio/manifest.json.
// Une phrase déjà enregistrée n'est pas refaite : après une modification des histoires,
// relancer le script n'enregistre que les phrases nouvelles ou modifiées.
const fs = require('fs');
const path = require('path');
const { collect, loadSite } = require('./speech-texts');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'audio');
const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const force = args.includes('--force');
const provider = (args.find((a) => a.startsWith('--provider=')) || '--provider=openai').split('=')[1];

const COACH = `Tu es Coach Panda, un coach sportif joyeux, chaleureux et bienveillant.
Tu parles à Camille, une petite fille de 10 ans qui apprend le Rubik's Cube.
Parle en français de France, avec un ton enthousiaste mais calme, souriant, en articulant bien,
à un rythme posé, comme un bon conteur. Marque de petites pauses aux points.`;

const OPENAI_VOICE = process.env.OPENAI_VOICE || 'marin';

async function ttsOpenAI(text) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Il manque OPENAI_API_KEY');
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: OPENAI_VOICE,
      input: text,
      instructions: COACH,
      response_format: 'mp3',
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status} : ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

async function ttsEleven(text) {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) throw new Error('Il manque ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID');
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status} : ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

async function main() {
  const { Speech } = loadSite();
  const texts = collect();
  const byKey = new Map();
  for (const t of texts) {
    const clean = Speech.clean(t);
    if (clean) byKey.set(Speech.key(t), clean);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const todo = [...byKey].filter(([k]) => force || !fs.existsSync(path.join(outDir, k + '.mp3')));
  const chars = todo.reduce((n, [, t]) => n + t.length, 0);
  console.log(`${byKey.size} phrases au total, ${todo.length} à enregistrer (${chars} caractères).`);
  if (dry) {
    todo.slice(0, 15).forEach(([k, t]) => console.log(` ${k}  ${t.slice(0, 110)}`));
    if (todo.length > 15) console.log(` … et ${todo.length - 15} autres`);
    return;
  }
  const tts = provider === 'elevenlabs' ? ttsEleven : ttsOpenAI;
  // Quelle voix a enregistré chaque phrase : sert à changer l'adresse du fichier quand la voix change,
  // pour que l'iPad ne rejoue pas l'ancienne voix gardée en cache.
  const tagFile = path.join(outDir, 'voices.json');
  const tags = fs.existsSync(tagFile) ? JSON.parse(fs.readFileSync(tagFile, 'utf8')) : {};
  const tag = provider === 'elevenlabs' ? 'el-' + (process.env.ELEVENLABS_VOICE_ID || '').slice(0, 8) : OPENAI_VOICE;
  let done = 0;
  let failed = 0;
  const queue = todo.slice();
  async function worker() {
    while (queue.length) {
      const [k, t] = queue.shift();
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const mp3 = await tts(t);
          fs.writeFileSync(path.join(outDir, k + '.mp3'), mp3);
          tags[k] = tag;
          done++;
          process.stdout.write(`\r${done}/${todo.length} enregistrées`);
          break;
        } catch (e) {
          if (attempt === 3) { failed++; console.error(`\nÉchec pour « ${t.slice(0, 60)}… » : ${e.message}`); }
          else await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  // Le manifeste liste uniquement les phrases actuelles qui ont un fichier
  const manifest = {};
  for (const k of byKey.keys()) {
    if (fs.existsSync(path.join(outDir, k + '.mp3'))) manifest[k] = `${k}.mp3?v=${tags[k] || 'coral'}`;
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 0));
  fs.writeFileSync(tagFile, JSON.stringify(tags, null, 0));
  console.log(`\nTerminé : ${Object.keys(manifest).length} phrases disponibles${failed ? `, ${failed} échecs (relance le script)` : ''}.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
