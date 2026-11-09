// ------------------------------------------------------------------
// Musik (v31): eigener, synthetischer Soundtrack, passend zur Spielphase
//  menu  – Bergstimmung in d-Moll, Flächen, Zupf-Arpeggio, Alphorn
//  count – Herzschlag und Steigerung vor dem Start
//  race  – treibender Downhill-Beat in a-Moll, Stufen je nach Tempo
//  chill – entspannter Groove nach dem Ziel
//  cere  – Fanfare zur Siegerehrung in C-Dur
// ------------------------------------------------------------------
const MUS = { on: true, vol: 0.5, bus: null, fx: null, mode: null, step: 0, nextT: 0, L: 1, Lwant: 1, duck: 1, duckT: 0, startT: 0 };
try { if (localStorage.getItem('kw_music') === '0') MUS.on = false; } catch (e) { /* egal */ }
const mF = (n) => 440 * Math.pow(2, (n - 69) / 12);
function musInit() {
  const ctx = audio.ctx; if (!ctx || MUS.bus) return;
  MUS.bus = ctx.createGain(); MUS.bus.gain.value = 0; MUS.bus.connect(audio.comp || ctx.destination);
  // Echo für Melodien (punktierte Achtel)
  const dl = ctx.createDelay(1.5), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
  dl.delayTime.value = 0.357; fb.gain.value = 0.32; lp.type = 'lowpass'; lp.frequency.value = 2600;
  dl.connect(lp).connect(fb).connect(dl); const wet = ctx.createGain(); wet.gain.value = 0.35; lp.connect(wet).connect(MUS.bus);
  MUS.fx = ctx.createGain(); MUS.fx.connect(dl);
  // etwas Raum aus dem Hall der Effekte
  MUS.verb = ctx.createGain(); MUS.verb.gain.value = 0.18; if (audio.send) MUS.verb.connect(audio.send);
}
function mOut(node, send = 0, verb = 0) {
  node.connect(MUS.bus);
  if (send) { const g = audio.ctx.createGain(); g.gain.value = send; node.connect(g).connect(MUS.fx); }
  if (verb && MUS.verb) { const g = audio.ctx.createGain(); g.gain.value = verb; node.connect(g).connect(MUS.verb); }
}
function mNoise(t, dur) { const s = audio.ctx.createBufferSource(); s.buffer = audio.bufs.noise; s.start(t, Math.random() * 1.5); s.stop(t + dur); return s; }
function mKick(t, v = 1) {
  const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
  o.connect(g); mOut(g); o.start(t); o.stop(t + 0.36);
}
function mSnare(t, v = 1) {
  const ctx = audio.ctx, n = mNoise(t, 0.22), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7;
  g.gain.setValueAtTime(0.45 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); n.connect(f).connect(g); mOut(g, 0, 0.6);
  const o = ctx.createOscillator(), g2 = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
  g2.gain.setValueAtTime(0.35 * v, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.11); o.connect(g2); mOut(g2); o.start(t); o.stop(t + 0.12);
}
function mHat(t, v = 1, open = false) {
  const ctx = audio.ctx, d = open ? 0.24 : 0.045, n = mNoise(t, d + 0.02), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'highpass'; f.frequency.value = 7600; g.gain.setValueAtTime(0.16 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); n.connect(f).connect(g); mOut(g);
}
function mCrash(t, v = 1) {
  const ctx = audio.ctx, n = mNoise(t, 2.2), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'highpass'; f.frequency.value = 3800; g.gain.setValueAtTime(0.22 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.0); n.connect(f).connect(g); mOut(g, 0, 0.5);
}
function mBass(t, n, dur, v = 1) {
  const ctx = audio.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), sub = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = mF(n); o2.type = 'square'; o2.frequency.value = mF(n - 12); sub.gain.value = 0.5;
  f.type = 'lowpass'; f.Q.value = 5; f.frequency.setValueAtTime(1500, t); f.frequency.exponentialRampToValueAtTime(240, t + 0.16);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32 * v, t + 0.005); g.gain.setTargetAtTime(0.0001, t + dur * 0.85, 0.03);
  o.connect(f); o2.connect(sub).connect(f); f.connect(g); mOut(g); o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
}
function mStab(t, ns, dur, v = 1) {
  const ctx = audio.ctx, f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.008); g.gain.setTargetAtTime(0.0001, t + dur * 0.7, 0.05);
  f.connect(g); mOut(g, 0.25, 0.4);
  for (const n of ns) for (const dt of [-8, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mF(n); o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + 0.3); }
}
function mPad(t, ns, dur, v = 1) {
  const ctx = audio.ctx, f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'lowpass'; f.frequency.value = 1100; f.Q.value = 0.6;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * v, t + Math.min(0.9, dur * 0.4)); g.gain.setValueAtTime(0.06 * v, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.0);
  f.connect(g); mOut(g, 0, 0.9);
  for (const n of ns) for (const [ty, dt] of [['sawtooth', -6], ['triangle', 5]]) { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = mF(n); o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + 1.1); }
}
function mPluck(t, n, v = 1, send = 0.5) {
  const ctx = audio.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'square'; o.frequency.value = mF(n); o2.type = 'triangle'; o2.frequency.value = mF(n + 12);
  f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.2);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
  o.connect(f); o2.connect(f); f.connect(g); mOut(g, send, 0.4); o.start(t); o2.start(t); o.stop(t + 0.4); o2.stop(t + 0.4);
}
function mBrass(t, ns, dur, v = 1) {
  const ctx = audio.ctx, f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'lowpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(350, t); f.frequency.linearRampToValueAtTime(2800, t + 0.07); f.frequency.setTargetAtTime(1500, t + 0.08, 0.2);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.075 * v, t + 0.05); g.gain.setValueAtTime(0.075 * v, t + dur); g.gain.setTargetAtTime(0.0001, t + dur, 0.09);
  f.connect(g); mOut(g, 0.1, 1.0);
  const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.4; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(6, t + Math.min(dur, 0.5)); vib.connect(vg); vib.start(t); vib.stop(t + dur + 0.6);
  for (const n of ns) for (const dt of [-9, 0, 9]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mF(n); o.detune.value = dt; vg.connect(o.detune); o.connect(f); o.start(t); o.stop(t + dur + 0.6); }
}
function mTimp(t, n, v = 1) {
  const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(mF(n) * 1.06, t); o.frequency.exponentialRampToValueAtTime(mF(n), t + 0.08);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 1.3); o.connect(g); mOut(g, 0, 0.7); o.start(t); o.stop(t + 1.35);
  const nz = mNoise(t, 0.12), f = ctx.createBiquadFilter(), g2 = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 500; g2.gain.setValueAtTime(0.25 * v, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1); nz.connect(f).connect(g2); mOut(g2);
}
function mBell(t, n, v = 1) {
  const ctx = audio.ctx;
  for (const [m, a, d] of [[1, 0.5, 0.6], [2.41, 0.3, 0.4], [3.86, 0.18, 0.25]]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = m === 1 ? 'triangle' : 'sine'; o.frequency.value = mF(n) * m; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * a * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + d); o.connect(g); mOut(g, 0.3, 0.6); o.start(t); o.stop(t + d + 0.05); }
}
function mHorn(t, n, dur, v = 1) {
  // Alphorn: weicher, hohler Ton mit langsamem Einschwingen
  const ctx = audio.ctx, o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = mF(n); o2.type = 'sine'; o2.frequency.value = mF(n);
  f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 1.5;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05 * v, t + 0.45); g.gain.setValueAtTime(0.05 * v, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5);
  o.connect(f); o2.connect(f); f.connect(g); mOut(g, 0.2, 1.2); o.start(t); o2.start(t); o.stop(t + dur + 0.6); o2.stop(t + dur + 0.6);
}
function mRiser(t, dur, v = 1) {
  const ctx = audio.ctx, n = mNoise(t, dur + 0.1), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'bandpass'; f.Q.value = 2.5; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * v, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.08);
  n.connect(f).connect(g); mOut(g, 0, 0.5);
}
// Titel-Einschlag fürs Intro: Rauschen zieht hoch, tiefer Schlag, Becken, Freilauf
function titleHit() {
  if (!audio.ctx || audio.muted) return; musInit();
  const t = audio.ctx.currentTime + 0.05;
  mRiser(t, 0.9, 1.4); mKick(t + 0.95, 1.4); mTimp(t + 0.95, 33, 1.2); mCrash(t + 0.95, 1.2); mBrass(t + 0.95, [45, 52, 57, 60, 64], 1.6, 1.3);
}
// --- Lieder: je Schritt (Sechzehntel) werden Töne geplant
const CH_RACE = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]], BS_RACE = [45, 41, 48, 43];
const RIFF = [[76, 0, 74, 72, 0, 69, 0, 72, 74, 0, 76, 0, 79, 0, 76, 74], [72, 0, 69, 0, 72, 74, 0, 76, 0, 74, 72, 0, 69, 0, 67, 69]];
const CH_MENU = [[62, 65, 69], [58, 62, 65], [57, 60, 65], [55, 60, 64]], BS_MENU = [38, 34, 41, 36];
const CH_CHILL = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], BS_CHILL = [36, 43, 45, 41];
const CH_CERE = [[60, 64, 67], [60, 64, 67], [53, 57, 60], [55, 59, 62]], BS_CERE = [36, 36, 41, 43];
const FANF = [[67, 0, 0, 72, 0, 0, 76, 0, 79, 0, 0, 0, 0, 0, 0, 0], [76, 0, 72, 0, 76, 0, 79, 0, 84, 0, 0, 0, 0, 0, 0, 0], [81, 0, 79, 0, 77, 0, 76, 0, 74, 0, 0, 0, 76, 0, 0, 0], [74, 0, 0, 0, 67, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0]];
const SONGS = {
  menu: { bpm: 80, step(i, t, sp) {
    const bar = Math.floor(i / 16) % 4, s = i % 16, ch = CH_MENU[bar], cyc = Math.floor(i / 64);
    if (s === 0) { mPad(t, ch, sp * 16, 1); mBass(t, BS_MENU[bar], sp * 14, 0.45); }
    if (s % 2 === 0) mPluck(t, ch[(s / 2) % 3] + 12 * (s % 8 === 6 ? 1 : 0), 0.55, 0.6);
    if (cyc >= 1 && (s === 0 || s === 8)) mKick(t, 0.45);
    if (cyc >= 1 && s % 4 === 2) mHat(t, 0.4);
    if (s === 0 && bar === 0 && cyc % 2 === 1) { mHorn(t, 62, sp * 12, 1); mHorn(t + sp * 12, 69, sp * 18, 0.9); }
    if (s === 15 && bar === 3) mBell(t, 81, 0.6);
  } },
  count: { bpm: 126, step(i, t, sp) {
    const s = i % 16;
    if (s === 0) { mPad(t, CH_RACE[0], sp * 16, 0.9); mBass(t, 45, sp * 2, 0.6); }
    if (s % 4 === 0) mKick(t, 0.55 + Math.min(0.4, i / 160));
    if (i > 32 && s % 2 === 0) mHat(t, 0.5);
    if (i % 64 === 48) mRiser(t, sp * 16, 0.8);
  } },
  race: { bpm: 126, step(i, t, sp) {
    const bar = Math.floor(i / 16) % 4, s = i % 16, L = MUS.L, ch = CH_RACE[bar], b = BS_RACE[bar];
    if (s === 0) MUS.L = MUS.Lwant;
    if (s === 0 && i % 64 === 0 && i > 0 && L >= 2) mCrash(t, 0.6);
    // Schlagzeug
    if (L >= 1 ? s % 4 === 0 : s % 8 === 0) mKick(t, L >= 1 ? 0.95 : 0.7);
    if (L >= 1 && (s === 4 || s === 12)) mSnare(t, 0.9);
    if (L >= 3 && s === 14 && bar === 3) mSnare(t, 0.5);
    if (L >= 2 ? true : s % 2 === 0) mHat(t, s % 4 === 2 ? 0.8 : 0.45, L >= 2 && s % 8 === 6);
    // Bass: treibende Achtel mit Oktavsprüngen
    if (L >= 1 && [0, 2, 3, 6, 8, 10, 11, 14].includes(s)) mBass(t, b + (s === 6 || s === 14 ? 12 : 0), sp * 1.6, 0.9);
    if (L === 0 && s === 0) mBass(t, b, sp * 8, 0.6);
    // Akkord-Stöße auf den Offbeats
    if (L >= 2 && (s === 2 || s === 6 || s === 10 || s === 13)) mStab(t, ch, sp * 1.2, 0.9);
    if (L <= 1 && s === 0) mPad(t, ch, sp * 16, 0.7);
    // Melodie bei vollem Tempo
    if (L >= 3) { const n = RIFF[bar >= 2 ? 1 : 0][s]; if (n) mPluck(t, n, 0.85, 0.45); }
  } },
  chill: { bpm: 100, step(i, t, sp) {
    const bar = Math.floor(i / 16) % 4, s = i % 16, ch = CH_CHILL[bar];
    if (s === 0) { mPad(t, ch, sp * 16, 0.8); }
    if ([0, 7, 10].includes(s)) mBass(t, BS_CHILL[bar], sp * 2.5, 0.65);
    if (s === 0 || s === 10) mKick(t, 0.6);
    if (s === 4 || s === 12) mSnare(t, 0.45);
    if (s % 2 === 0) mHat(t, 0.35);
    if (s % 4 === 2) mPluck(t, ch[(s >> 2) % 3] + 12, 0.45, 0.6);
  } },
  cere: { bpm: 92, step(i, t, sp) {
    const bar = Math.floor(i / 16) % 4, s = i % 16, ch = CH_CERE[bar];
    if (s === 0) { mBrass(t, ch.map((n) => n - 12), sp * 15, 0.7); mBass(t, BS_CERE[bar], sp * 15, 0.5); mTimp(t, BS_CERE[bar] - 12 + 12, 0.9); }
    if (s === 8) mTimp(t, BS_CERE[bar] + 7 - 12 + 12, 0.6);
    const n = FANF[bar][s]; if (n) mBrass(t, [n], sp * (FANF[bar][s + 1] === 0 && FANF[bar][s + 2] === 0 ? 3.5 : 1.7), 1.2);
    if (bar === 3 && s >= 8) mSnare(t, 0.25 + (s - 8) * 0.05);
    if (s === 0 && bar === 0 && i > 0) mCrash(t, 0.7);
  } },
};
function musSwitch(mode) {
  const ctx = audio.ctx, prev = MUS.mode; MUS.mode = mode; MUS.step = 0;
  MUS.nextT = ctx.currentTime + 0.06;
  if (!MUS.on || audio.muted) return;
  if (mode === 'race' && prev === 'count') mCrash(MUS.nextT, 1);
  if (mode === 'chill' && prev === 'race') {
    // Zielfanfare, danach der ruhige Groove
    const t = ctx.currentTime + 0.05; mCrash(t, 1.1); mTimp(t, 36, 1); mBrass(t, [60, 64, 67, 72], 1.4, 1.1); mBrass(t + 0.5, [62, 65, 69, 74], 0.3, 0.9); mBrass(t + 0.8, [64, 67, 72, 76], 2.2, 1.2); mTimp(t + 0.8, 43, 0.8);
    MUS.nextT = ctx.currentTime + 3.4;
  }
  if (mode === 'cere') { const t = ctx.currentTime + 0.05; mCrash(t, 0.8); for (let k = 0; k < 8; k++) mTimp(t + k * 0.09, 36, 0.35 + k * 0.06); MUS.nextT = ctx.currentTime + 0.85; }
}
function musDirector() {
  let mode = 'menu';
  const st = race.state;
  if (typeof CERE !== 'undefined' && CERE.on) mode = 'cere';
  else if (REPLAY.on) mode = 'race';
  else if (st === 'countdown') mode = race.pan > 0 ? 'menu' : 'count';
  else if (st === 'race') mode = player && player.finished ? 'chill' : 'race';
  else if (st === 'done') mode = 'chill';
  else if (st === 'paused') mode = MUS.mode || 'menu';
  if (mode !== MUS.mode) musSwitch(mode);
  // Intensität: Tempo des Spielers, in der Zusammenfassung voll
  if (REPLAY.on) MUS.Lwant = 3;
  else if (player && st === 'race') { const v = player.vel.length(); MUS.Lwant = v < 3 ? 1 : v < 10 ? 2 : 3; }
}
function musTick() {
  const ctx = audio.ctx; if (!ctx) return;
  musInit();
  try { musDirector(); } catch (e) { return; }
  MUS.duckT = Math.max(0, MUS.duckT - 0.04); const duck = MUS.duckT > 0 ? 0.45 : race.state === 'paused' ? 0.3 : 1;
  MUS.bus.gain.setTargetAtTime(MUS.on && !audio.muted ? MUS.vol * duck : 0, ctx.currentTime, 0.25);
  const song = SONGS[MUS.mode]; if (!song || !MUS.on || audio.muted) { MUS.nextT = ctx.currentTime + 0.05; return; }
  const sp = 60 / song.bpm / 4;
  if (MUS.nextT < ctx.currentTime - 0.3) MUS.nextT = ctx.currentTime + 0.02;
  while (MUS.nextT < ctx.currentTime + 0.16) { try { song.step(MUS.step, MUS.nextT, sp); } catch (e) { /* weiter */ } MUS.step++; MUS.nextT += sp; }
}
setInterval(musTick, 40);
function musToggle() {
  MUS.on = !MUS.on; try { localStorage.setItem('kw_music', MUS.on ? '1' : '0'); } catch (e) { /* egal */ }
  const b = document.getElementById('musBtn'); if (b) b.setAttribute('aria-pressed', MUS.on);
}
// erste Berührung oder Taste schaltet den Ton frei (Browser-Regel), dann läuft die Menümusik
function audioUnlock() {
  try { initAudio(); if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); } catch (e) { /* kein Ton */ }
}
addEventListener('pointerdown', audioUnlock, { passive: true });
addEventListener('keydown', audioUnlock);

// ------------------------------------------------------------------
// Publikum mit Stimmen: viele kleine "Rufe" (Hey, Ooh, Jaa) statt reinem Rauschen
// ------------------------------------------------------------------
const CV = { v: [], out: null, pan: null };
const VOWELS = [[750, 1200], [500, 900], [450, 1850], [650, 1650], [350, 800]];
function crowdVoxInit() {
  const ctx = audio.ctx; CV.out = ctx.createGain(); CV.out.gain.value = 0;
  CV.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  CV.out.connect(CV.pan).connect(audio.master); const w = ctx.createGain(); w.gain.value = 0.7; CV.pan.connect(w).connect(audio.send);
  for (let i = 0; i < 16; i++) {
    const fem = i % 3 === 0, base = fem ? 210 + Math.random() * 90 : 105 + Math.random() * 60;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = base;
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.5 + Math.random() * 2.5; vg.gain.value = base * 0.02; vib.connect(vg).connect(o.frequency);
    const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g2 = ctx.createGain(), g = ctx.createGain();
    f1.type = f2.type = 'bandpass'; f1.Q.value = 6; f2.Q.value = 8; g2.gain.value = 0.6; g.gain.value = 0;
    o.connect(f1).connect(g); o.connect(f2).connect(g2).connect(g); g.connect(CV.out); o.start(); vib.start();
    CV.v.push({ o, f1, f2, g, base, t: Math.random() * 2 });
  }
}
function crowdVox(cheer, dens, pan, m) {
  const ctx = audio.ctx; if (!ctx) return; if (!CV.out) crowdVoxInit();
  const t = ctx.currentTime, lvl = clamp(cheer * 2.4 + dens * 0.5, 0, 1) * m;
  CV.out.gain.setTargetAtTime(lvl * 0.1, t, 0.3); if (CV.pan.pan) CV.pan.pan.setTargetAtTime(pan, t, 0.3);
  if (lvl < 0.02) return;
  for (const v of CV.v) {
    v.t -= 1 / 60; if (v.t > 0) continue;
    v.t = 0.25 + Math.random() * 1.4 / (lvl + 0.25);
    if (Math.random() > lvl + 0.15) continue;
    const [a, b] = VOWELS[Math.floor(Math.random() * VOWELS.length)], hold = 0.15 + Math.random() * 0.6, up = 1.15 + Math.random() * 0.35;
    v.f1.frequency.setValueAtTime(a * (0.9 + Math.random() * 0.2), t); v.f2.frequency.setValueAtTime(b * (0.9 + Math.random() * 0.2), t);
    v.o.frequency.cancelScheduledValues(t); v.o.frequency.setValueAtTime(v.base, t); v.o.frequency.linearRampToValueAtTime(v.base * up, t + 0.12); v.o.frequency.linearRampToValueAtTime(v.base * (up - 0.1), t + hold); v.o.frequency.linearRampToValueAtTime(v.base * 0.8, t + hold + 0.3);
    v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(0.0001, t); v.g.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.5, t + 0.05); v.g.gain.setValueAtTime(0.45, t + hold); v.g.gain.linearRampToValueAtTime(0.0001, t + hold + 0.35);
  }
}
