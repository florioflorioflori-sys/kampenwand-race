# v31: Downhill Kampenwand – Name, korrigiertes Oischi-Intro (Production), Titel-Intro,
# neuer Sound mit eigener Musik, Siegerehrung, Browser-Kompatibilität
import base64 as _b64, re as _re

# --- Name
rep("<title>Kampenwand Downhill</title>", "<title>Downhill Kampenwand</title>")
rep("<h1>Kampenwand<span>Downhill</span></h1>", "<h1>Downhill<span>Kampenwand</span></h1>")
rep("'KAMPENWAND DOWNHILL · START' : 'KAMPENWAND DOWNHILL · ZIEL'", "'DOWNHILL KAMPENWAND · START' : 'DOWNHILL KAMPENWAND · ZIEL'")
rep("Sprünge, Absperrband und Gegner sind Platzhalter für die Godot-Version.", "Eine Oischi Production.")
rep('<div class="eyebrow">Vorabversion v30 · stabiler, Absturzschutz · Browser</div>',
    '<div class="eyebrow">Vorabversion v31 · Musik, Siegerehrung · Browser</div>')

# --- korrigiertes Intro-Video (PRODUCTION statt PRODUKTION)
_vid = _b64.b64encode(open(S + '/intro/fixed720.mp4', 'rb').read()).decode()
_m = _re.search(r'(<script id="introData" type="text/plain">)(.*?)(</script>)', src, _re.S)
assert _m, 'introData fehlt'
src = src[:_m.start(2)] + _vid + src[_m.end(2):]

# --- Titel-Intro nach dem Oischi-Logo
rep('<div id="intro">',
'''<div id="titleSeq" hidden><div class="tsIn">
  <svg class="tsRidge" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true"><path d="M0 220 L0 175 L90 160 L170 166 L250 120 L310 132 L370 82 L402 96 L436 46 L462 80 L494 34 L522 74 L552 50 L590 98 L650 84 L730 132 L820 122 L900 152 L1000 144 L1000 220 Z"/></svg>
  <div class="ts1">Downhill</div><div class="ts2">Kampenwand</div><div class="tape tsTape" aria-hidden="true"></div>
  <div class="ts3">Bergstation → Talstation Aschau · Chiemgau</div></div></div>
<div id="intro">''')
rep("/* Oischi-Intro: Vollbild vor allem anderen */",
"""/* Titel-Intro */
#titleSeq { position: fixed; inset: 0; z-index: 49; display: grid; place-items: center; overflow: hidden; background: radial-gradient(ellipse at 50% 60%, #1c3a26 0%, #0b140e 55%, #000 100%); transition: opacity .7s ease; cursor: pointer; }
#titleSeq.out { opacity: 0; pointer-events: none; }
#titleSeq .tsIn { position: relative; width: min(1100px, 100%); padding: 0 16px; text-align: center; }
#titleSeq .tsRidge { position: absolute; left: 0; right: 0; bottom: 18%; width: 100%; height: 38vh; opacity: 0; animation: tsRidge 1.4s .1s ease-out forwards; }
#titleSeq .tsRidge path { fill: rgba(244,239,230,.07); stroke: rgba(242,194,48,.75); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-dasharray: 2400; stroke-dashoffset: 2400; animation: tsDraw 1.6s .1s ease-out forwards; }
#titleSeq .ts1 { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; color: var(--ink); font-size: clamp(34px, 8vw, 92px); letter-spacing: .32em; line-height: 1; opacity: 0; transform: translateX(-40px); animation: tsSlide .6s .45s cubic-bezier(.2,.9,.3,1) forwards; }
#titleSeq .ts2 { font-family: var(--font-display); font-weight: 800; text-transform: uppercase; color: transparent; -webkit-text-stroke: 2px var(--ink); font-size: clamp(46px, 10.5vw, 140px); line-height: .9; letter-spacing: -.01em; opacity: 0; transform: scale(1.5); filter: blur(10px); animation: tsSlam .45s .95s cubic-bezier(.2,1.4,.4,1) forwards, tsFill .8s 1.5s ease forwards; }
#titleSeq .tsTape { margin: 14px auto 0; width: 0; animation: tsWipe .6s 1.35s ease-out forwards; }
#titleSeq .ts3 { margin-top: 14px; font-family: var(--font-body); letter-spacing: .22em; text-transform: uppercase; color: var(--leaf); font-size: clamp(12px, 1.6vw, 16px); opacity: 0; animation: tsFade .8s 1.9s ease forwards; }
@keyframes tsRidge { to { opacity: 1; } }
@keyframes tsDraw { to { stroke-dashoffset: 0; } }
@keyframes tsSlide { to { opacity: 1; transform: none; } }
@keyframes tsSlam { to { opacity: 1; transform: none; filter: none; } }
@keyframes tsFill { to { color: var(--ink); } }
@keyframes tsWipe { to { width: min(620px, 80%); } }
@keyframes tsFade { to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { #titleSeq * { animation-duration: .01s !important; animation-delay: 0s !important; } }
/* Siegerehrung */
#cereUI { position: fixed; inset: 0; pointer-events: none; z-index: 30; }
#cereTop { position: absolute; top: calc(14px + env(safe-area-inset-top, 0px)); left: 16px; display: flex; gap: 8px; align-items: center; }
#cereTop span { background: #d4a32a; color: #111; font: 800 14px/1 Barlow, sans-serif; padding: 7px 10px; border-radius: 3px; letter-spacing: .1em; }
#cereTop b { color: #fff; font: 800 16px/1 var(--font-display); letter-spacing: .08em; text-shadow: 0 1px 4px rgba(0,0,0,.8); }
#cereLow { position: absolute; left: 16px; bottom: calc(48px + env(safe-area-inset-bottom, 0px)); display: flex; align-items: stretch; box-shadow: 0 4px 14px rgba(0,0,0,.4); opacity: 0; transform: translateX(-30px); max-width: calc(100vw - 32px); }
#cereLow.show { animation: cereIn .5s ease-out forwards; }
@keyframes cereIn { to { opacity: 1; transform: none; } }
#cereLowP { background: #d4a32a; color: #111; font: 800 22px var(--font-num); padding: 10px 14px; display: grid; place-items: center; }
#cereLow > div:last-child { background: rgba(10,16,30,.9); color: #fff; padding: 8px 16px; }
#cereLowN { font: 800 22px Barlow, sans-serif; }
#cereLowT { font: 600 14px Barlow, sans-serif; color: #cfd6e0; }
#cereBtns { position: absolute; right: 16px; top: calc(14px + env(safe-area-inset-top, 0px)); pointer-events: auto; }
#musBtn[aria-pressed="false"] { opacity: .55; text-decoration: line-through; }
/* Oischi-Intro: Vollbild vor allem anderen */""")
rep("  const done = () => { if (box.classList.contains('out')) return; box.classList.add('out'); vid.pause(); setTimeout(() => { box.hidden = true; }, 650); };",
"""  const ts = $('titleSeq');
  const tsDone = () => { if (ts.hidden || ts.classList.contains('out')) return; ts.classList.add('out'); setTimeout(() => { ts.hidden = true; }, 750); };
  const showTitle = () => {
    ts.hidden = false; try { titleHit(); } catch (e) { /* ohne Ton */ }
    setTimeout(tsDone, 5200); ts.addEventListener('click', tsDone);
    addEventListener('keydown', (e) => { if (!ts.hidden && (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space')) tsDone(); });
  };
  const done = () => { if (box.classList.contains('out')) return; box.classList.add('out'); vid.pause(); showTitle(); setTimeout(() => { box.hidden = true; }, 650); };""")

# --- Siegerehrung: Oberfläche und Knöpfe
rep('<div id="results" class="overlay" hidden>',
'''<div id="cereUI" hidden>
  <div id="cereTop"><span>SIEGEREHRUNG</span><b>DOWNHILL KAMPENWAND</b></div>
  <div id="cereLow"><div id="cereLowP"></div><div><div id="cereLowN"></div><div id="cereLowT"></div></div></div>
  <div id="cereBtns"><button class="ghost" id="cereSkip">Überspringen</button></div>
</div>
<div id="results" class="overlay" hidden>''')
rep('      <button class="go" id="againBtn">Nochmal fahren</button>',
    '      <button class="go" id="cereBtn">Siegerehrung</button>\n      <button class="go" id="againBtn">Nochmal fahren</button>')
rep('''        <button id="qLow" aria-pressed="false">Schnell</button>
      </div>''', '''        <button id="qLow" aria-pressed="false">Schnell</button>
      </div>
      <button class="ghost" id="musBtn" aria-pressed="true" title="Musik an/aus (Taste N)">♪ Musik</button>''')
rep("$('againBtn').onclick = () => setupRace();",
"""$('againBtn').onclick = () => setupRace();
$('cereBtn').onclick = () => cereStart();
$('cereSkip').onclick = () => cereEnd();
$('musBtn').onclick = () => { audioUnlock(); musToggle(); };
$('musBtn').setAttribute('aria-pressed', MUS.on);""")

# --- neue Module: Siegerehrung und Musik
_cer = rd('ceremony.js').replace("p.y + (1.92 + Math.sin(T * 4) * 0.04) * sc", "p.y + (1.68 + Math.sin(T * 4) * 0.03) * sc")
rep("// Lage einer Quelle relativ zur Kamera", _cer + "\nconst _ceS = new THREE.Vector3();\n" + rd('sound2.js') + "\n// Lage einer Quelle relativ zur Kamera")
rep("  try { rainGear(dt, t); } catch (e) { kwReport(e); RAIN.im = null; }",
    "  try { rainGear(dt, t); } catch (e) { kwReport(e); RAIN.im = null; }\n  try { cereStep(dt); } catch (e) { kwReport(e); cereEnd(); }")
rep("function umbHand(j, p) {\n", "function umbHand(j, p) {\n  if (p.trophy && j && j.haR && j.haL) { j.haR.set(-0.17, 1.98, 0.13); j.haL.set(0.17, 1.98, 0.13); return j; }\n")
rep("  if (REPLAY.on) { camera.fov = REPLAY.fov; camera.updateProjectionMatrix(); }",
    "  if (REPLAY.on) { camera.fov = REPLAY.fov; camera.updateProjectionMatrix(); }\n  else if (CERE.on) { camera.fov = CERE.fov; camera.updateProjectionMatrix(); }")
rep("  const shC = REPLAY.on ? REPLAY.focusPos : player.pos;", "  const shC = REPLAY.on ? REPLAY.focusPos : CERE.on ? cereW(0, 1, 0, _ceS) : player.pos;")
rep("  if (e.code === 'KeyM') audio.muted = !audio.muted;",
    "  if (e.code === 'KeyM') audio.muted = !audio.muted;\n  if (e.code === 'KeyN') musToggle();\n  if (CERE.on) { if (e.code === 'Escape' || e.code === 'Enter') cereEnd(); return; }")

# --- Ton: Publikum mit Stimmen, Kuhglocken, weniger Roboter-Rufe, Musik leiser bei Durchsagen
rep("  for (const c of [A.murmA, A.murmB, A.cheerA, A.cheerB]) if (c.p.pan) set(c.p.pan, pan, 0.3);",
    "  for (const c of [A.murmA, A.murmB, A.cheerA, A.cheerB]) if (c.p.pan) set(c.p.pan, pan, 0.3);\n  try { crowdVox(cheer, dens, pan, m); } catch (e) { /* ohne Stimmen */ }")
rep("    if (E.clapT <= 0) { sfx('clap', _ap); E.clapT = 4 + Math.random() * 6; }",
    "    if (E.clapT <= 0) { sfx('clap', _ap); E.clapT = 4 + Math.random() * 6; }\n    E.bellT = (E.bellT ?? 1) - dt; if (E.bellT <= 0) { sfx('bell', _ap); E.bellT = 0.6 + Math.random() * 2.4 / (0.4 + cheer * 4); }")
rep("function cheerSay(text, female, vol) {", "function cheerSay(text, female, vol) { try { cheerSay0(text, female, vol); } catch (e) { /* keine Sprachausgabe */ } }\nfunction cheerSay0(text, female, vol) {")
rep("  cheer.cd = (race.state === 'countdown' ? 1.6 : 1.1) + Math.random() * 1.6;", "  cheer.cd = (race.state === 'countdown' ? 3.5 : 3.2) + Math.random() * 4;")
rep("function announce(text) {\n", "function announce(text) {\n  if (typeof MUS !== 'undefined') MUS.duckT = Math.max(MUS.duckT, 3);\n")

# --- Browser-Kompatibilität
rep("const V = (x, y, z) => new THREE.Vector3(x, y, z);",
"""const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Base64 schnell und speichersparend dekodieren (große eingebettete Modelle, alle Browser)
function kwB64(s) { const bin = atob(s), n = bin.length, u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u; }
// ältere Safari-Versionen kennen roundRect nicht
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) { r = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
const PERF = { s: 1, acc: 0, n: 0, last: 0, slow: 0 };""")
for _old in ["Uint8Array.from(atob($('introData').textContent.trim()), (c) => c.charCodeAt(0))",
             "Uint8Array.from(atob(document.getElementById('dogData').textContent.trim()), (c) => c.charCodeAt(0))"]:
    rep(_old, "kwB64(" + _old[len("Uint8Array.from(atob("):-len("), (c) => c.charCodeAt(0))")] + ")")
rep("Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))", "kwB64(b64)", count=3)
rep("  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));\n  const d = new Int16Array(await new Response(stream).arrayBuffer());",
"""  let d;
  if (typeof DecompressionStream !== 'undefined') { const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip')); d = new Int16Array(await new Response(stream).arrayBuffer()); }
  else { const { gunzipSync } = await import('three/addons/libs/fflate.module.js'); d = new Int16Array(gunzipSync(bin).slice().buffer); }""")
rep("const renderer = new THREE.WebGLRenderer(",
"""{ const tc = document.createElement('canvas'), tg = tc.getContext('webgl2');
  if (!tg) { const l = document.getElementById('loading'); if (l) l.textContent = 'Dieser Browser bietet kein WebGL 2. Bitte Hardwarebeschleunigung in den Browser-Einstellungen einschalten oder einen aktuellen Browser verwenden.'; throw new Error('Kein WebGL 2'); }
  const ext = tg.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
const renderer = new THREE.WebGLRenderer(""")
rep("  try { renderer.compile(scene, camera); } catch (e) { console.warn('Shader vorab', e); }",
"""  { const lt = $('loading').textContent; setLoad('Grafik wird vorbereitet …');
    try { await Promise.race([renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve(renderer.compile(scene, camera)), new Promise((r) => setTimeout(r, 15000))]); } catch (e) { console.warn('Shader vorab', e); }
    setLoad(lt); }""")
# Auflösung passt sich der Bildrate an, bei dauerhaft zu wenig Bildern automatisch "Schnell"
rep("  renderer.setPixelRatio(Math.max(0.5, Math.min(window.devicePixelRatio || 1, hi ? 1.5 : 1, _cap)));",
    "  renderer.setPixelRatio(Math.max(0.5, Math.min(window.devicePixelRatio || 1, hi ? 1.5 : 1, _cap) * PERF.s));")
rep("  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }",
    "  if (sun.shadow.map && sun.shadow.map.width !== ms) { sun.shadow.map.dispose(); sun.shadow.map = null; }")
rep("  drawHud();\n  renderFrame();\n}\n// Laub liegt",
"""  drawHud();
  renderFrame();
  kwPerf();
}
function kwPerf() {
  const now = performance.now(), d = PERF.last ? now - PERF.last : 16; PERF.last = now;
  if (!(race.state === 'race' || race.state === 'done' || race.state === 'countdown' || race.state === 'replay') || d > 400) return;
  PERF.acc += d; PERF.n++;
  if (PERF.acc < 2500) return;
  const avg = PERF.acc / PERF.n; PERF.acc = 0; PERF.n = 0;
  let s = PERF.s;
  if (avg > 38) s = Math.max(0.6, s - 0.12); else if (avg < 21 && s < 1) s = Math.min(1, s + 0.05);
  PERF.slow = avg > 55 ? PERF.slow + 1 : 0;
  if (PERF.slow >= 3 && QUALITY === 'high') { QUALITY = 'low'; try { localStorage.setItem('kw_q', 'low'); } catch (e) { /* egal */ } setQualityButtons(); flash('Grafik auf „Schnell“ gestellt', '', 2.2, true); PERF.slow = 0; s = 1; PERF.s = s; applyQuality(); return; }
  if (Math.abs(s - PERF.s) > 0.001) { PERF.s = s; applyQuality(); }
}
// Laub liegt""")
