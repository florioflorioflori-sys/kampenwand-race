

// ------------------------------------------------------------------
// Ton (WebAudio, synthetisch)
// ------------------------------------------------------------------
const audio = { ctx: null, muted: false };
function initAudio() {
  if (audio.ctx) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const mk = (type, f, q) => { const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(fl).connect(g); src.start(); return { fl, g }; };
    const master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    const wind = mk('lowpass', 300, 0.5), tire = mk('bandpass', 700, 0.8), skid = mk('highpass', 2500, 0.7);
    wind.g.connect(master); tire.g.connect(master); skid.g.connect(master);
    // Motorsäge: Sägezahn mit schnellem Tremolo
    const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 118;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 23; const lfoG = ctx.createGain(); lfoG.gain.value = 18; lfo.connect(lfoG).connect(saw.frequency);
    const sawF = ctx.createBiquadFilter(); sawF.type = 'lowpass'; sawF.frequency.value = 1600;
    const sawG = ctx.createGain(); sawG.gain.value = 0; saw.connect(sawF).connect(sawG).connect(master); saw.start(); lfo.start();
    const crowd = mk('bandpass', 900, 0.6); crowd.g.connect(master);
    Object.assign(audio, { ctx, master, wind, tire, skid, sawG, crowd, noiseBuf: buf });
  } catch (e) { audio.ctx = null; }
}
function beep(freq, dur, vol = 0.2) {
  if (!audio.ctx || audio.muted) return;
  const o = audio.ctx.createOscillator(), g = audio.ctx.createGain(); o.type = 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audio.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
  o.connect(g).connect(audio.master); o.start(); o.stop(audio.ctx.currentTime + dur);
}
function thump(v) {
  if (!audio.ctx || audio.muted) return;
  const o = audio.ctx.createOscillator(), g = audio.ctx.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(90, audio.ctx.currentTime); o.frequency.exponentialRampToValueAtTime(40, audio.ctx.currentTime + 0.2);
  g.gain.setValueAtTime(Math.min(0.6, v), audio.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.25);
  o.connect(g).connect(audio.master); o.start(); o.stop(audio.ctx.currentTime + 0.3);
}
function sfxGain(pos, d) { const dist = d ?? Math.hypot(pos.x - camera.position.x, pos.z - camera.position.z); return clamp(1 - dist / 160, 0, 1) ** 2; }
function sfx(kind, pos, d) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx, t = ctx.currentTime, gv = sfxGain(pos, d);
  if (gv <= 0.001) return;
  if (kind === 'bell') {
    // Kuhglocke: unharmonische Teiltöne mit schnellem Abklingen
    const f0 = 520 + Math.random() * 120;
    for (const [m, a] of [[1, 0.5], [2.32, 0.3], [3.9, 0.15]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f0 * m;
      g.gain.setValueAtTime(0.12 * a * gv, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.6);
      o.connect(g).connect(audio.master); o.start(t); o.stop(t + 0.65);
    }
  } else if (kind === 'crack' || kind === 'thud') {
    const src = ctx.createBufferSource(); src.buffer = audio.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = kind === 'crack' ? 'bandpass' : 'lowpass'; f.frequency.value = kind === 'crack' ? 1800 : 180;
    const g = ctx.createGain(); g.gain.setValueAtTime((kind === 'crack' ? 0.5 : 0.9) * gv, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'crack' ? 0.35 : 0.9));
    src.connect(f).connect(g).connect(audio.master); src.start(t); src.stop(t + 1);
    if (kind === 'thud') thump(0.7 * gv);
  }
}
function updateAudio(speed, grounded, slip, onTrail) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime, m = audio.muted ? 0 : 1;
  audio.wind.g.gain.setTargetAtTime(m * Math.min(0.5, speed * speed * 0.0009), t, 0.1);
  audio.wind.fl.frequency.setTargetAtTime(250 + speed * 35, t, 0.1);
  audio.tire.g.gain.setTargetAtTime(m * (grounded ? Math.min(0.25, speed * 0.016) * (onTrail ? 1 : 1.6) : 0), t, 0.05);
  audio.tire.fl.frequency.setTargetAtTime(onTrail ? 600 + speed * 20 : 350 + speed * 10, t, 0.1);
  audio.skid.g.gain.setTargetAtTime(m * (grounded ? Math.min(0.22, slip * 0.04) : 0), t, 0.05);
  const W = life.workers;
  audio.sawG.gain.setTargetAtTime(m * (W && W.state === 'saw' ? 0.09 * sfxGain(W.base) : 0), t, 0.1);
  let cheer = 0;
  for (const p of life.people) if (p.react && p.e > 0.3) cheer += p.e * sfxGain(V(p.x, 0, p.z)) * 0.03;
  audio.crowd.g.gain.setTargetAtTime(m * Math.min(0.3, cheer), t, 0.2);
  audio.crowd.fl.frequency.setTargetAtTime(800 + Math.sin(t * 3) * 200, t, 0.1);
}

// ------------------------------------------------------------------
// Eingabe
// ------------------------------------------------------------------
const keys = {};
const input = { steer: 0, pedal: 0, brake: 0, hop: false, boost: false };
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (keys[e.code]) return;
  keys[e.code] = true;
  if (e.code === 'KeyR') requestReset = true;
  if (e.code === 'KeyC') camMode = (camMode + 1) % 3;
  if (e.code === 'KeyM') audio.muted = !audio.muted;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const touchState = {};
for (const id of ['tL', 'tR', 'tBrake', 'tPedal', 'tHop', 'tBoost']) {
  const el = $(id);
  const on = (e) => { e.preventDefault(); touchState[id] = true; el.classList.add('on'); };
  const off = (e) => { e.preventDefault(); touchState[id] = false; el.classList.remove('on'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
}
let padPrev = {};
function readInput(dt) {
  let steer = 0, pedal = 0, brake = 0, hop = false, boost = false;
  if (keys.KeyA || keys.ArrowLeft) steer -= 1;
  if (keys.KeyD || keys.ArrowRight) steer += 1;
  if (keys.KeyW || keys.ArrowUp) pedal = 1;
  if (keys.KeyS || keys.ArrowDown) brake = 1;
  if (keys.Space) hop = true;
  if (keys.ShiftLeft || keys.ShiftRight) boost = true;
  if (touchState.tL) steer -= 1; if (touchState.tR) steer += 1;
  if (touchState.tPedal) pedal = 1; if (touchState.tBrake) brake = 1; if (touchState.tHop) hop = true; if (touchState.tBoost) boost = true;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0; if (Math.abs(ax) > 0.15) steer += ax;
    const b = (i) => p.buttons[i] ? p.buttons[i].value : 0;
    pedal = Math.max(pedal, b(7)); brake = Math.max(brake, b(6));
    if (b(0) > 0.5) hop = true; if (b(2) > 0.5) boost = true;
    if (b(3) > 0.5 && !padPrev.y) requestReset = true;
    if (b(9) > 0.5 && !padPrev.start) togglePause();
    padPrev = { y: b(3) > 0.5, start: b(9) > 0.5 };
    break;
  }
  steer = clamp(steer, -1, 1);
  // weiches Lenken bei Tastatur
  input.steer = Math.abs(steer) > Math.abs(input.steer) ? damp(input.steer, steer, 9, dt) : damp(input.steer, steer, 14, dt);
  input.pedal = pedal; input.brake = brake; input.hop = hop; input.boost = boost;
}

