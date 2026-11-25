/* Préparer une phrase pour la voix : on enlève le HTML et les émojis, on écrit les nombres
   comme on les dit, et on calcule une "clé" pour retrouver le fichier audio enregistré.
   Utilisé par le site ET par le script tools/generate-voice.js (les deux doivent donner la même clé). */
(function (root) {
  const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

  function clean(html) {
    return String(html)
      .replace(/<br\s*\/?>/gi, '. ')
      .replace(/<\/(p|div|li|h\d)>/gi, '. ')
      .replace(/<[^>]+>/g, '')
      .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] || ' ')
      .replace(/[\p{Extended_Pictographic}‍️⃣←-⇿⬅-⬇✅✔]/gu, '')
      .replace(/\b1re\b/g, 'première')
      .replace(/\b1er\b/g, 'premier')
      .replace(/\b2e\b/g, 'deuxième')
      .replace(/\b(\d)e\b/g, (m, d) => ({ 3: 'troisième', 4: 'quatrième', 5: 'cinquième', 6: 'sixième', 7: 'septième' }[d] || m))
      .replace(/×\s?2/g, 'deux fois')
      .replace(/n°\s?/g, 'numéro ')
      .replace(/\s*·\s*/g, ' : ')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/(^|\.\s+)\d\.\s+/g, '$1')
      .replace(/\s+/g, ' ')
      .replace(/\s+([.,!?:;])/g, (m, p) => (p === ':' || p === ';' || p === '!' || p === '?' ? ' ' + p : p))
      .replace(/([.!?])(\s*\.)+/g, '$1')
      .replace(/^[\s.]+/, '')
      .trim();
  }

  // FNV-1a 32 bits : courte, stable, identique dans Node et le navigateur
  function key(text) {
    const s = clean(text);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  const api = { clean, key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Speech = api;
})(typeof window !== 'undefined' ? window : globalThis);
