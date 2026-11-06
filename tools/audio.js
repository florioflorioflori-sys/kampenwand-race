const audio = { ctx: null, muted: false };
// Hilfspuffer: Rauschen, Knacken (Kies), Freilauf-Klicks, Hall
function audioBuffers(ctx) {
  const sr = ctx.sampleRate, B = (sec, ch = 1) => ctx.createBuffer(ch, Math.floor(sr * sec), sr);
  const noise = B(2); { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  // braunes Rauschen für Wind und Grollen
  const brown = B(3); { const d = brown.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }
  // Kies: einzelne kurze Knackser in zufälligen Abständen
  const crunch = B(2); { const d = crunch.getChannelData(0); let i = 0; while (i < d.length) { const a = 0.3 + Math.random() * 0.7, L = 40 + Math.random() * 260; for (let k = 0; k < L && i + k < d.length; k++) d[i + k] += (Math.random() * 2 - 1) * a * Math.exp(-k / (L * 0.25)); i += Math.floor(sr * (0.002 + Math.random() * 0.02)); } }
  // Freilauf: 60 Klicks pro Sekunde bei Wiedergaberate 1
  const ratchet = B(1); { const d = ratchet.getChannelData(0); for (let c = 0; c < 60; c++) { const i0 = Math.floor((c + (Math.random() - 0.5) * 0.15) / 60 * sr); for (let k = 0; k < 90; k++) if (i0 + k >= 0 && i0 + k < d.length) d[i0 + k] += Math.sin(k * 1.9) * Math.exp(-k / 14) * (0.8 + Math.random() * 0.2); } }
  // Kette: metallisches Rasseln
  const chain = B(1.2); { const d = chain.getChannelData(0); for (let c = 0; c < 40; c++) { const i0 = Math.floor(Math.random() * d.length * 0.9), f = 0.5 + Math.random() * 0.9; for (let k = 0; k < 500 && i0 + k < d.length; k++) d[i0 + k] += Math.sin(k * f) * Math.exp(-k / 60) * 0.6; } }
  // Hall: zweikanalige, abklingende Rauschantwort (Bergtal, leichte frühe Echos)
  const ir = B(2.6, 2); for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / 2.6, 3.2) * (t < 0.012 ? t / 0.012 : 1) * 0.55; }
    for (const [t, a] of [[0.19, 0.35], [0.43, 0.22], [0.81, 0.14]]) { const i0 = Math.floor((t + ch * 0.013) * sr); for (let k = 0; k < 400; k++) d[i0 + k] += (Math.random() * 2 - 1) * a * Math.exp(-k / 120); } }
  return { noise, brown, crunch, ratchet, chain, ir };
}
function initAudio() {
  if (audio.ctx) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const bufs = audioBuffers(ctx);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.006; comp.release.value = 0.25; comp.connect(ctx.destination);
    const master = ctx.createGain(); master.gain.value = 0.85; master.connect(comp);
    const verb = ctx.createConvolver(); verb.buffer = bufs.ir; const verbOut = ctx.createGain(); verbOut.gain.value = 0.55; verb.connect(verbOut).connect(master);
    const send = ctx.createGain(); send.gain.value = 1; send.connect(verb);
    // Schleife aus einem Puffer mit Filter, Lautstärke und Stereo-Lage
    const loop = (buf, type, f, q, out = master, rate = 1) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = rate;
      src.loopStart = 0; src.loopEnd = buf.duration;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0; const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      src.connect(fl).connect(g).connect(p).connect(out); src.start(0, Math.random() * buf.duration * 0.9);
      return { src, fl, g, p };
    };
    // Fahrtwind: tiefes Brausen, helles Pfeifen am Helm, beide mit Böen
    const windLo = loop(bufs.brown, 'lowpass', 300, 0.4), windHi = loop(bufs.noise, 'bandpass', 1500, 2.2);
    // Reifen: Rollgeräusch, Stollen-Brummen (Amplitudenmodulation), Kiesknacken
    const tire = loop(bufs.noise, 'bandpass', 600, 0.9);
    const knob = ctx.createOscillator(); knob.type = 'triangle'; knob.frequency.value = 100; const knobD = ctx.createGain(); knobD.gain.value = 0;
    knob.connect(knobD).connect(tire.g.gain); knob.start();
    const crunch = loop(bufs.crunch, 'highpass', 900, 0.7);
    const skid = loop(bufs.noise, 'highpass', 2200, 0.7);
    // Freilauf (Ratsche) und Kette
    const ratchet = loop(bufs.ratchet, 'bandpass', 3800, 1.2), chainL = loop(bufs.chain, 'bandpass', 2600, 1.5);
    // Scheibenbremse: Quietschen mit Vibrato
    const sq = ctx.createOscillator(), sq2 = ctx.createOscillator(), sqG = ctx.createGain(), vib = ctx.createOscillator(), vibG = ctx.createGain();
    sq.frequency.value = 1960; sq2.frequency.value = 2950; vib.frequency.value = 7; vibG.gain.value = 18; vib.connect(vibG); vibG.connect(sq.frequency); vibG.connect(sq2.frequency);
    const sqM = ctx.createGain(); sqM.gain.value = 0.5; sq2.connect(sqM).connect(sqG); sq.connect(sqG); sqG.gain.value = 0; sqG.connect(master); sq.start(); sq2.start(); vib.start();
    // Motorsäge: Sägezahn mit Tremolo
    const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 118;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 23; const lfoG = ctx.createGain(); lfoG.gain.value = 18; lfo.connect(lfoG).connect(saw.frequency);
    const sawF = ctx.createBiquadFilter(); sawF.type = 'lowpass'; sawF.frequency.value = 1600;
    const sawG = ctx.createGain(); sawG.gain.value = 0; const sawP = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); saw.connect(sawF).connect(sawG).connect(sawP).connect(master); saw.start(); lfo.start();
    // Publikum: Gemurmel (zwei Bänder), Jubel (Vokal-Formanten), beides mit Hall
    const murmA = loop(bufs.noise, 'bandpass', 420, 1.4, send), murmB = loop(bufs.noise, 'bandpass', 1100, 2.0, send);
    const cheerA = loop(bufs.noise, 'bandpass', 750, 3.5, send), cheerB = loop(bufs.noise, 'bandpass', 1250, 4.5, send);
    for (const c of [murmA, murmB, cheerA, cheerB]) { const dry = ctx.createGain(); dry.gain.value = 0.8; c.p.connect(dry).connect(master); }
    // Wald und Bergwiese: Rauschen in den Bäumen, Grillen
    const leaves = loop(bufs.noise, 'bandpass', 3200, 0.8), cric = ctx.createOscillator(), cricG = ctx.createGain(), cricA = ctx.createOscillator(), cricAD = ctx.createGain();
    cric.frequency.value = 4300; cricA.type = 'square'; cricA.frequency.value = 28; cricAD.gain.value = 0; cricA.connect(cricAD).connect(cricG.gain); cricG.gain.value = 0; cric.connect(cricG).connect(master); cric.start(); cricA.start();
    // Seilbahn: Brummen des Zugseils
    const hum = ctx.createOscillator(), humG = ctx.createGain(); hum.type = 'sawtooth'; hum.frequency.value = 62; const humF = ctx.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 240;
    humG.gain.value = 0; hum.connect(humF).connect(humG).connect(master); hum.start();
    Object.assign(audio, { ctx, master, send, comp, bufs, noiseBuf: bufs.noise, windLo, windHi, tire, knobD, knob, crunch, skid, ratchet, chainL, sqG, sq, sawG, sawP,
      murmA, murmB, cheerA, cheerB, leaves, cricAD, humG, ev: { brakeT: 0, sqAmt: 0, hornT: 4, clapT: 6, whistT: 3, birdT: 2, gust: 0, lastFin: false } });
  } catch (e) { console.warn('Audio', e); audio.ctx = null; }
}
// Lage einer Quelle relativ zur Kamera: Lautstärke über Entfernung, Links/Rechts
const _apv = new THREE.Vector3(), _apr = new THREE.Vector3();
function audioPan(pos) {
  if (!pos) return 0;
  _apr.set(1, 0, 0).applyQuaternion(camera.quaternion); _apv.set(pos.x - camera.position.x, 0, pos.z - camera.position.z);
  const d = _apv.length(); if (d < 0.5) return 0;
  return clamp(_apv.dot(_apr) / d, -1, 1) * 0.85;
}
// Einmaliges Geräusch: Quelle -> Filter -> Hüllkurve -> Stereo -> Ausgang (+Hall)
function oneShot(src, gainVal, t, dur, pan, wet = 0.25, filter = null) {
  const ctx = audio.ctx, g = ctx.createGain(); g.gain.value = gainVal;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (p.pan) p.pan.value = pan;
  let n = src; if (filter) { n.connect(filter); n = filter; }
  n.connect(g).connect(p).connect(audio.master);
  if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w).connect(audio.send); }
  return g;
}
function beep(freq, dur, vol = 0.2) {
  if (!audio.ctx || audio.muted) return;
  // Startuhr: reiner Ton mit weichem Einsatz und etwas Hall
  const ctx = audio.ctx, t = ctx.currentTime;
  for (const [m, a] of [[1, 1], [2, 0.18], [3, 0.06]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * m;
    const g = oneShot(o, 0, t, dur, 0, 0.3); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * a * 0.9, t + 0.008); g.gain.setValueAtTime(vol * a * 0.9, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.05);
    o.start(t); o.stop(t + dur + 0.1);
  }
}
// Landung: dumpfer Schlag, Federgabel schlägt durch, Kette schlägt an
function thump(v) {
  if (!audio.ctx || audio.muted || v <= 0.01) return;
  const ctx = audio.ctx, t = ctx.currentTime, k = Math.min(1, v);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
  const g = oneShot(o, 0, t, 0.3, 0, 0.05); g.gain.setValueAtTime(0.65 * k, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.start(t); o.stop(t + 0.3);
  const n = ctx.createBufferSource(); n.buffer = audio.bufs.brown; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
  const g2 = oneShot(n, 0, t, 0.25, 0, 0, lp); g2.gain.setValueAtTime(0.5 * k, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18); n.start(t, Math.random() * 2); n.stop(t + 0.25);
  if (k > 0.25) {
    const c = ctx.createBufferSource(); c.buffer = audio.bufs.chain; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400 + Math.random() * 800; bp.Q.value = 1.4;
    const g3 = oneShot(c, 0, t, 0.5, (Math.random() - 0.5) * 0.3, 0, bp); g3.gain.setValueAtTime(0.32 * k, t + 0.01); g3.gain.exponentialRampToValueAtTime(0.001, t + 0.45); c.start(t + 0.01, Math.random() * 0.6); c.stop(t + 0.5);
    // Klacken der Federung
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 180 + Math.random() * 60; const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 900; bp2.Q.value = 3;
    const g4 = oneShot(o2, 0, t, 0.08, 0, 0, bp2); g4.gain.setValueAtTime(0.12 * k, t + 0.02); g4.gain.exponentialRampToValueAtTime(0.001, t + 0.09); o2.start(t + 0.02); o2.stop(t + 0.1);
  }
}
function sfxGain(pos, d) { const dist = d ?? Math.hypot(pos.x - camera.position.x, pos.z - camera.position.z); return clamp(1 - dist / 160, 0, 1) ** 2; }
function sfx(kind, pos, d) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx, t = ctx.currentTime, gv = sfxGain(pos, d), pan = audioPan(pos);
  if (gv <= 0.001) return;
  const wetFar = 0.15 + (1 - gv) * 0.6;
  if (kind === 'bell') {
    // Kuhglocke: blechern, unharmonische Teiltöne, zweimal angeschlagen
    const f0 = 480 + Math.random() * 160, n = 1 + (Math.random() < 0.6 ? 1 : 0);
    for (let r = 0; r < n; r++) for (const [m, a, dec] of [[1, 0.5, 0.5], [2.41, 0.32, 0.35], [3.86, 0.2, 0.25], [5.3, 0.1, 0.15]]) {
      const t0 = t + r * (0.22 + Math.random() * 0.1), o = ctx.createOscillator(); o.type = m === 1 ? 'triangle' : 'sine'; o.frequency.value = f0 * m * (1 + (Math.random() - 0.5) * 0.01);
      const g = oneShot(o, 0, t0, dec, pan, wetFar); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.11 * a * gv, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dec);
      o.start(t0); o.stop(t0 + dec + 0.05);
    }
  } else if (kind === 'whistle') {
    // Murmeltier-Pfiff
    for (const dt0 of [0, 0.32]) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(2900, t + dt0); o.frequency.linearRampToValueAtTime(3400, t + dt0 + 0.05); o.frequency.linearRampToValueAtTime(2700, t + dt0 + 0.2);
      const g = oneShot(o, 0, t, 0.25, pan, wetFar); g.gain.setValueAtTime(0.0001, t + dt0); g.gain.linearRampToValueAtTime(0.16 * gv, t + dt0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + dt0 + 0.22);
      o.start(t + dt0); o.stop(t + dt0 + 0.25);
    }
  } else if (kind === 'fingerwhistle') {
    // Pfiff aus dem Publikum: steigt an, fällt ab
    const o = ctx.createOscillator(); o.type = 'sine'; const b = 2200 + Math.random() * 600;
    o.frequency.setValueAtTime(b, t); o.frequency.linearRampToValueAtTime(b * 1.35, t + 0.18); o.frequency.setValueAtTime(b * 1.35, t + 0.5); o.frequency.linearRampToValueAtTime(b * 0.9, t + 0.75);
    const g = oneShot(o, 0, t, 0.8, pan, wetFar); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * gv, t + 0.04); g.gain.setValueAtTime(0.09 * gv, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.8);
    o.start(t); o.stop(t + 0.85);
  } else if (kind === 'horn') {
    // Druckluft-Fanfare: zwei schnarrende Töne
    const f = 330 + Math.random() * 60, dur = 0.7 + Math.random() * 0.6;
    for (const m of [1, 1.26]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * m; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 2;
      const g = oneShot(o, 0, t, dur, pan, wetFar, lp); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * gv, t + 0.03); g.gain.setValueAtTime(0.06 * gv, t + dur - 0.1); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.start(t); o.stop(t + dur + 0.05);
    }
  } else if (kind === 'clap') {
    // Klatschen: viele kurze Rauschimpulse, unregelmäßig
    const n = 18 + Math.floor(Math.random() * 14);
    for (let k = 0; k < n; k++) {
      const t0 = t + k * (0.11 + Math.random() * 0.06) + Math.random() * 0.04, s = ctx.createBufferSource(); s.buffer = audio.bufs.noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200 + Math.random() * 900; bp.Q.value = 1.2;
      const g = oneShot(s, 0, t0, 0.05, pan + (Math.random() - 0.5) * 0.2, wetFar, bp); g.gain.setValueAtTime(0.14 * gv, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.035);
      s.start(t0, Math.random() * 1.8); s.stop(t0 + 0.05);
    }
  } else if (kind === 'chirp') {
    // Alpendohlen
    for (let k = 0; k < 3; k++) {
      const t0 = t + k * 0.13 + Math.random() * 0.05, o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(2300 + Math.random() * 300, t0); o.frequency.exponentialRampToValueAtTime(3600, t0 + 0.09);
      const g = oneShot(o, 0, t0, 0.12, pan, wetFar); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.06 * gv, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.11);
      o.start(t0); o.stop(t0 + 0.12);
    }
  } else if (kind === 'song') {
    // Singvogel im Wald: kurze, gezwitscherte Phrase
    const base = 2600 + Math.random() * 1600, n = 4 + Math.floor(Math.random() * 6);
    for (let k = 0; k < n; k++) {
      const t0 = t + k * (0.07 + Math.random() * 0.05), o = ctx.createOscillator(); o.type = 'sine'; const f = base * (0.8 + Math.random() * 0.5);
      o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.4 : 0.75), t0 + 0.05);
      const g = oneShot(o, 0, t0, 0.07, pan, 0.4); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.035 * gv, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.06);
      o.start(t0); o.stop(t0 + 0.08);
    }
  } else if (kind === 'whoosh') {
    const src = ctx.createBufferSource(); src.buffer = audio.bufs.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.18);
    const g = oneShot(src, 0, t, 0.3, pan, 0.05, f); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25 * gv, t + 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    src.start(t); src.stop(t + 0.3);
  } else if (kind === 'heli') {
    for (let k = 0; k < 2; k++) {
      const t0 = t + k * 0.165, src = ctx.createBufferSource(); src.buffer = audio.bufs.noise;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
      const g = oneShot(src, 0, t0, 0.15, pan, 0.3, f); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.5 * gv, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);
      src.start(t0); src.stop(t0 + 0.15);
    }
  } else if (kind === 'shutter') {
    // Fotografen: Spiegelschlag
    for (const dt0 of [0, 0.045]) {
      const s = ctx.createBufferSource(); s.buffer = audio.bufs.noise; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 2;
      const g = oneShot(s, 0, t + dt0, 0.03, pan, 0.05, bp); g.gain.setValueAtTime(0.12 * gv, t + dt0); g.gain.exponentialRampToValueAtTime(0.0005, t + dt0 + 0.025); s.start(t + dt0, Math.random()); s.stop(t + dt0 + 0.03);
    }
  } else if (kind === 'crack' || kind === 'thud') {
    const src = ctx.createBufferSource(); src.buffer = audio.bufs.noise;
    const f = ctx.createBiquadFilter(); f.type = kind === 'crack' ? 'bandpass' : 'lowpass'; f.frequency.value = kind === 'crack' ? 1800 : 180;
    const g = oneShot(src, 0, t, 1, pan, 0.4, f); g.gain.setValueAtTime((kind === 'crack' ? 0.5 : 0.9) * gv, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'crack' ? 0.35 : 0.9));
    src.start(t); src.stop(t + 1);
    if (kind === 'thud') thump(0.7 * gv);
  }
}
// Stadionsprecher (Sprachausgabe), tiefer und langsamer als die Rufe
function announce(text) {
  if (audio.muted || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; u.rate = 1.02; u.pitch = 0.85; u.volume = 0.95;
    const v = typeof cheerVoices === 'function' ? cheerVoices() : []; if (v && v.length) u.voice = v.find((x) => /male|Mann|Stefan|Markus|Conrad/i.test(x.name)) || v[0];
    speechSynthesis.speak(u);
  } catch (e) { /* keine Sprachausgabe */ }
}
const _ap = new THREE.Vector3();
function updateAudio(speed, grounded, slip, onTrail) {
  if (!audio.ctx) return;
  const A = audio, E = A.ev, t = A.ctx.currentTime, m = A.muted ? 0 : 1, dt = 1 / 60;
  const P = player, ego = typeof camMode !== 'undefined' && camMode === 2;
  const dCam = Math.hypot(P.pos.x - camera.position.x, P.pos.z - camera.position.z), near = clamp(1 - (dCam - 3) / 30, 0.15, 1);
  const set = (prm, v, tc = 0.08) => prm.setTargetAtTime(v, t, tc);
  // Wind: Böen aus dem Wettermodul, im Ego-Blick lauter am Helm
  const wz = typeof uWind !== 'undefined' ? uWind.value.z : 1;
  E.gust = damp(E.gust, Math.random(), 1.5, dt);
  const ws = speed * speed * 0.0008 * (ego ? 1.35 : 1) + wz * 0.03 * (0.5 + E.gust);
  set(A.windLo.g.gain, m * Math.min(0.55, ws)); set(A.windLo.fl.frequency, 220 + speed * 28 + E.gust * 80);
  set(A.windHi.g.gain, m * Math.min(0.12, Math.max(0, speed - 8) * 0.006 * (0.6 + E.gust * 0.8))); set(A.windHi.fl.frequency, 1200 + speed * 45 + E.gust * 400);
  if (A.windHi.p.pan) set(A.windHi.p.pan, Math.sin(t * 0.37) * 0.4, 0.5);
  // Reifen
  const wet = typeof WX !== 'undefined' ? (WX.wet || WX.rain || 0) : 0;
  const roll = grounded ? Math.min(0.22, speed * 0.014) * near : 0;
  set(A.tire.g.gain, m * roll * (onTrail ? 0.8 : 1.3)); set(A.tire.fl.frequency, onTrail ? 450 + speed * 22 : 280 + speed * 12);
  A.knob.frequency.setTargetAtTime(Math.max(20, speed * 28), t, 0.05); set(A.knobD.gain, m * roll * 0.55);
  set(A.crunch.g.gain, m * (grounded ? Math.min(0.3, speed * 0.02) * near * (onTrail ? 1 : 0.5) * (1 - wet * 0.6) : 0)); A.crunch.src.playbackRate.setTargetAtTime(0.5 + speed * 0.06, t, 0.1);
  set(A.skid.g.gain, m * (grounded ? Math.min(0.25, slip * 0.045 + (input.brake > 0 ? speed * 0.006 : 0)) * near : 0));
  // Freilauf surrt beim Rollen, Kette beim Treten
  const pedal = input.pedal > 0 && grounded && speed < 13, coast = !pedal && speed > 1.2 && P.crashT <= 0;
  set(A.ratchet.g.gain, m * (coast ? 0.05 + Math.min(0.06, speed * 0.003) : 0) * near, 0.05); A.ratchet.src.playbackRate.setTargetAtTime(clamp(speed * 2.8 / 60, 0.2, 4), t, 0.05);
  set(A.chainL.g.gain, m * (grounded ? Math.min(0.12, speed * 0.004 + (pedal ? 0.03 : 0)) * (0.4 + (P.comp || 0)) : 0) * near);
  // Bremsquietschen: bei kräftigem Bremsen, im Nassen öfter
  if (input.brake > 0 && speed > 5) { if (E.brakeT <= 0) E.sqAmt = Math.random() < 0.45 + wet * 0.4 ? 0.4 + Math.random() * 0.6 : 0; E.brakeT += dt; } else E.brakeT = 0;
  set(A.sqG.gain, m * (E.brakeT > 0.15 && grounded ? E.sqAmt * 0.025 * Math.min(1, speed / 12) * near : 0), 0.04);
  A.sq.frequency.setTargetAtTime(1800 + E.sqAmt * 400, t, 0.2);
  // Motorsäge der Holzarbeiter
  const W = life.workers;
  set(A.sawG.gain, m * (W && W.state === 'saw' ? 0.09 * sfxGain(W.base) : 0), 0.1); if (W && A.sawP.pan) set(A.sawP.pan, audioPan(W.base), 0.2);
  // Publikum: Gemurmel nach Dichte in der Nähe, Jubel nach Begeisterung, Lage im Stereobild
  let dens = 0, cheer = 0, px = 0, pw = 0, best = null, bestG = 0;
  for (const p of life.people) {
    _ap.set(p.x, 0, p.z); const g = sfxGain(_ap); if (g < 0.01) continue;
    dens += g * 0.02; const e = p.react ? (p.e || 0) : 0; cheer += e * g * 0.04;
    const pn = audioPan(_ap); px += pn * g; pw += g;
    if (e > 0.4 && g > bestG) { bestG = g; best = p; }
  }
  const pan = pw > 0 ? px / pw : 0;
  set(A.murmA.g.gain, m * Math.min(0.12, dens), 0.4); set(A.murmB.g.gain, m * Math.min(0.06, dens * 0.5), 0.4);
  set(A.cheerA.g.gain, m * Math.min(0.32, cheer), 0.15); set(A.cheerB.g.gain, m * Math.min(0.2, cheer * 0.6), 0.15);
  set(A.cheerA.fl.frequency, 700 + Math.sin(t * 2.3) * 120 + cheer * 300, 0.1); set(A.cheerB.fl.frequency, 1150 + Math.sin(t * 3.1 + 1) * 180, 0.1);
  for (const c of [A.murmA, A.murmB, A.cheerA, A.cheerB]) if (c.p.pan) set(c.p.pan, pan, 0.3);
  // einzelne Geräusche aus der Menge: Fanfare, Pfiffe, Klatschen
  if (best && !A.muted) {
    _ap.set(best.x, 0, best.z);
    E.hornT -= dt; E.whistT -= dt; E.clapT -= dt;
    if (E.hornT <= 0 && cheer > 0.08) { sfx('horn', _ap); E.hornT = 5 + Math.random() * 9; }
    if (E.whistT <= 0) { sfx('fingerwhistle', _ap); E.whistT = 2 + Math.random() * 5; }
    if (E.clapT <= 0) { sfx('clap', _ap); E.clapT = 4 + Math.random() * 6; }
  }
  // Natur: Bäume rauschen und Vögel singen im Wald, Grillen auf der Wiese (nicht bei Regen)
  const forest = typeof inLeafZone === 'function' && inLeafZone(P.s) ? 1 : 0, rain = typeof WX !== 'undefined' ? (WX.rain || 0) : 0;
  set(A.leaves.g.gain, m * (0.015 + forest * 0.03) * (0.6 + E.gust + wz * 0.3), 0.5);
  set(A.cricAD.gain, m * (1 - forest) * (1 - rain) * 0.006 * (Math.sin(t * 0.7) > 0 ? 1 : 0.3), 0.3);
  E.birdT -= dt; if (E.birdT <= 0) { E.birdT = 1.5 + Math.random() * 4; if (forest && rain < 0.3) sfx('song', _ap.set(camera.position.x + (Math.random() - 0.5) * 60, 0, camera.position.z + (Math.random() - 0.5) * 60)); }
  // Seilbahn: Brummen in der Nähe der Trasse
  if (stationA && stationB) {
    const ax = stationA.x, az = stationA.z, bx = stationB.x - ax, bz = stationB.z - az, cx = camera.position.x, cz = camera.position.z;
    const tt = clamp(((cx - ax) * bx + (cz - az) * bz) / (bx * bx + bz * bz), 0, 1), dc = Math.hypot(cx - ax - bx * tt, cz - az - bz * tt);
    set(A.humG.gain, m * clamp(1 - dc / 45, 0, 1) * 0.03, 0.4);
  }
}
