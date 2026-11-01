// ------------------------------------------------------------------
// Anfeuerungsrufe auf Bairisch: Sprechblase über dem Zuschauer und
// gesprochen über die Sprachausgabe des Browsers (deutsche Stimme)
// ------------------------------------------------------------------
const CHEERS = ['Gemma, gemma, gemma!', 'Gib Gas!', 'Obi, obi, obi!', "Zoag's eana!", 'Hopp, hopp, hopp!', "Auf geht's!", 'Hau di nei!', 'Lass laffa!', 'Bremsn is fia Feiglinge!',
  'Geh weida, geh weida!', 'Jawoll!', 'Des is a Wahnsinn!', 'Obi damit!', 'Volle Pulle!', 'Schneller, schneller!', 'Ziag o!', 'Bravo!', 'Gas, Gas, Gas!'];
const CHEER_SAY = { "Zoag's eana!": 'Zoags eana!', 'Ziag o!': 'Ziag oh!', 'Obi damit!': 'Obi damid!' };
const cheer = { cd: 1.5, bubbles: [], voices: null };
function cheerBubble(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.font = '800 58px "Saira Condensed", "Arial Narrow", sans-serif';
  const w = Math.min(500, x.measureText(text).width + 50);
  x.fillStyle = 'rgba(255,255,255,0.94)'; x.strokeStyle = '#1d1f1a'; x.lineWidth = 5;
  const l = (512 - w) / 2;
  x.beginPath(); x.roundRect(l, 8, w, 88, 26); x.moveTo(246, 94); x.lineTo(256, 122); x.lineTo(272, 94); x.fill(); x.stroke();
  x.fillStyle = '#d4141c'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 54, 480);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function cheerVoices() {
  if (!('speechSynthesis' in window)) return [];
  if (!cheer.voices || !cheer.voices.length) cheer.voices = speechSynthesis.getVoices().filter((v) => /^de/i.test(v.lang));
  return cheer.voices;
}
function cheerSay(text, female, vol) {
  if (audio.muted || !audio.ctx || !('speechSynthesis' in window)) return;
  const vs = cheerVoices();
  if (speechSynthesis.speaking && speechSynthesis.pending) return;
  const u = new SpeechSynthesisUtterance(CHEER_SAY[text] || text);
  u.lang = 'de-DE';
  if (vs.length) { const fem = vs.filter((v) => /female|frau|anna|petra|marlene|vicki|katja|hedda|helena/i.test(v.name)); u.voice = (female && fem.length ? fem : vs)[Math.floor(Math.random() * (female && fem.length ? fem.length : vs.length))]; }
  u.pitch = female ? 1.25 + Math.random() * 0.35 : 0.7 + Math.random() * 0.35;
  u.rate = 1.1 + Math.random() * 0.25; u.volume = clamp(vol, 0.15, 1);
  speechSynthesis.speak(u);
}
// einzelner Ruf eines Zuschauers in der Nähe (z. B. nach einem Foul)
function cheerShout(text) {
  if (!player) return;
  let best = null, bd = 30;
  for (const p of life.people) { const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z); if (d < bd && !cheer.bubbles.some((b) => b.p === p)) { bd = d; best = p; } }
  if (!best) return;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cheerBubble(text), transparent: true, depthWrite: false }));
  s.scale.set(3.2, 0.8, 1); s.renderOrder = 5; scene.add(s);
  cheer.bubbles.push({ s, p: best, t: 1.6 });
  cheerSay(text, best.h.sex === 'F', 1 - bd / 34);
  cheer.cd = Math.max(cheer.cd, 1.2);
}
function updateCheers(dt) {
  // Sprechblasen ausblenden
  for (let i = cheer.bubbles.length - 1; i >= 0; i--) {
    const b = cheer.bubbles[i]; b.t -= dt;
    b.s.position.set(b.p.x, b.p.y + 2.25 * (b.p.h.kid ? 0.7 : 1) + (1.8 - b.t) * 0.15, b.p.z);
    b.s.material.opacity = clamp(b.t * 3, 0, 1);
    if (b.t <= 0) { scene.remove(b.s); b.s.material.map.dispose(); b.s.material.dispose(); cheer.bubbles.splice(i, 1); }
  }
  if (!player || !(race.state === 'race' || race.state === 'countdown')) return;
  cheer.cd -= dt;
  if (cheer.cd > 0) return;
  // Zuschauer in Rufweite vor oder neben dem Fahrer
  const P = player, near = [];
  for (const p of life.people) {
    if (!p.react) continue;
    const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);
    if (d < 26 && !cheer.bubbles.some((b) => b.p === p)) near.push([d, p]);
  }
  if (!near.length) { cheer.cd = 0.4; return; }
  const [d, p] = near[Math.floor(Math.random() * Math.min(near.length, 12))];
  const team = P.cfg && P.cfg.team ? P.cfg.team.replace(' Prien', '') : null;
  const text = team && Math.random() < 0.2 ? `Auf geht's, ${team}!` : CHEERS[Math.floor(Math.random() * CHEERS.length)];
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cheerBubble(text), transparent: true, depthWrite: false }));
  s.scale.set(3.2, 0.8, 1); s.renderOrder = 5;
  scene.add(s);
  cheer.bubbles.push({ s, p, t: 1.8 });
  cheerSay(text, p.h.sex === 'F' || p.h.kid, 1 - d / 30);
  cheer.cd = (race.state === 'countdown' ? 1.6 : 1.1) + Math.random() * 1.6;
}
