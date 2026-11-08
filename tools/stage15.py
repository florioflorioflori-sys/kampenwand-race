# v30: Stabilität auf schwächeren Rechnern und in Firefox
# - Qualität wird gespeichert, nach einem Absturz startet das Spiel automatisch im sparsamen Modus
# - Zuschauer-Verdopplung nur in "Hoch", Bildauflösung gedeckelt
# - Fehler werden im Bild angezeigt statt das Spiel einzufrieren, Grafikverlust wird abgefangen
# - Regenschirme nur in Kameranähe, keine Objekte pro Bild neu angelegt

# --- Qualität merken und Absturz erkennen
rep("let QUALITY = isTouch ? 'low' : 'high';",
"""let QUALITY = isTouch ? 'low' : 'high';
let KW_CRASHED = false;
try {
  const q = localStorage.getItem('kw_q'); if (q === 'high' || q === 'low') QUALITY = q;
  if (localStorage.getItem('kw_alive')) { KW_CRASHED = true; QUALITY = 'low'; localStorage.setItem('kw_q', 'low'); }
  localStorage.removeItem('kw_alive');
} catch (e) { /* kein Speicher */ }
const CROWD_MUL = QUALITY === 'high' ? 2 : 1;
const kwAlive = (on) => { try { if (on) localStorage.setItem('kw_alive', '1'); else localStorage.removeItem('kw_alive'); } catch (e) { /* egal */ } };
addEventListener('pagehide', () => kwAlive(false));
addEventListener('beforeunload', () => kwAlive(false));""")
rep("$('qHigh').onclick = () => { QUALITY = 'high'; setQualityButtons(); applyQuality(); };\n$('qLow').onclick = () => { QUALITY = 'low'; setQualityButtons(); applyQuality(); };",
"""const qNote = () => { const n = document.getElementById('qNote'); if (n) n.hidden = (QUALITY === 'high' ? 2 : 1) === CROWD_MUL; };
$('qHigh').onclick = () => { QUALITY = 'high'; try { localStorage.setItem('kw_q', 'high'); } catch (e) { /* egal */ } setQualityButtons(); applyQuality(); qNote(); };
$('qLow').onclick = () => { QUALITY = 'low'; try { localStorage.setItem('kw_q', 'low'); } catch (e) { /* egal */ } setQualityButtons(); applyQuality(); qNote(); };""")
rep('    <div id="loading">',
'''    <div id="qNote" class="note" hidden>Die Zuschauerzahl passt sich beim nächsten Neuladen der Seite an.</div>
    <div id="crashNote" class="note" hidden>Das letzte Spiel wurde unerwartet beendet. Deshalb ist jetzt „Schnell“ eingestellt (halb so viele Zuschauer, geringere Auflösung). Mit „Hoch“ und Neuladen kommt alles zurück.</div>
    <div id="loading">''')

# --- Zuschauer nur in "Hoch" verdoppeln
rep("function crowd(rand, s, n, poses, spread = 24, sideBias = 0) {\n  for (let i = 0; i < n * 2; i++) {",
    "function crowd(rand, s, n, poses, spread = 24, sideBias = 0) {\n  for (let i = 0; i < n * CROWD_MUL; i++) {")
rep("  n = Math.round(n * 2); depth = depth * 1.4; len = len * 1.1;",
    "  n = Math.round(n * CROWD_MUL); depth = depth * (CROWD_MUL > 1 ? 1.4 : 1); len = len * (CROWD_MUL > 1 ? 1.1 : 1);")

# --- Auflösung deckeln (4K-Monitore und Bloom-Puffer fressen sonst den Grafikspeicher)
rep("  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 1.75 : 1));",
"""  const _px = Math.max(1, innerWidth * innerHeight), _cap = Math.sqrt((hi ? 3.7e6 : 2.1e6) / _px);
  renderer.setPixelRatio(Math.max(0.5, Math.min(window.devicePixelRatio || 1, hi ? 1.5 : 1, _cap)));""")

# --- Fehler sichtbar machen, Bildschleife läuft weiter
rep("function tick() {\n  requestAnimationFrame(tick);\n",
"""const KWERR = { n: 0, shown: false };
function kwReport(e) {
  KWERR.n++; console.error(e);
  const b = document.getElementById('kwErr'); if (!b) return;
  const msg = (e && (e.message || e.reason && e.reason.message)) || String(e);
  const where = e && e.stack ? String(e.stack).split('\\n').slice(0, 3).join(' | ') : '';
  b.hidden = false; b.querySelector('b').textContent = 'Fehler (' + KWERR.n + '×): ' + msg; b.querySelector('code').textContent = where.slice(0, 400);
}
addEventListener('error', (ev) => kwReport(ev.error || ev.message));
addEventListener('unhandledrejection', (ev) => kwReport(ev.reason));
renderer.domElement.addEventListener('webglcontextlost', (ev) => {
  ev.preventDefault(); kwAlive(false);
  try { localStorage.setItem('kw_q', 'low'); } catch (e) { /* egal */ }
  const b = document.getElementById('kwLost'); if (b) b.style.display = 'flex';
}, false);
function tick() {
  requestAnimationFrame(tick);
  try { tickBody(); } catch (e) { kwReport(e); }
}
function tickBody() {
""")
rep('<div id="msg" class="hud"></div>',
'''<div id="msg" class="hud"></div>
<div id="kwErr" hidden style="position:fixed;left:12px;bottom:12px;z-index:50;max-width:min(560px,calc(100vw - 24px));background:rgba(120,20,20,.92);color:#fff;font:13px/1.35 system-ui,sans-serif;padding:8px 12px;border-radius:6px;pointer-events:auto"><b></b><br><code style="font-size:11px;opacity:.85;word-break:break-all"></code><br><span style="opacity:.8">Bitte ein Foto davon an Claude schicken.</span> <button onclick="this.parentNode.hidden=true" style="margin-left:6px">OK</button></div>
<div id="kwLost" style="position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(10,12,10,.88);color:#fff;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px"><div>Die Grafikkarte hat den Speicher zurückgesetzt.<br>Das Spiel startet beim Neuladen im Modus „Schnell“.<br><br><button onclick="location.reload()" style="font-size:16px;padding:8px 18px">Neu laden</button></div></div>''')

# --- Absturzmarke beim Rennstart setzen, Hinweis im Menü
rep("$('startBtn').onclick = () => {\n  initAudio();",
    "$('startBtn').onclick = () => {\n  kwAlive(true);\n  initAudio();")
rep("  const b = $('startBtn'); b.disabled = false; b.textContent = 'Rennen starten';",
"""  try { renderer.compile(scene, camera); } catch (e) { console.warn('Shader vorab', e); }
  if (KW_CRASHED) { const n = document.getElementById('crashNote'); if (n) n.hidden = false; }
  const b = $('startBtn'); b.disabled = false; b.textContent = 'Rennen starten';""")

# --- Regenschirme: nur in Kameranähe, Farben ohne neue Objekte
rep("const _umQ = new THREE.Quaternion(), _umE = new THREE.Euler(),",
    "const _umC = new THREE.Color(), _umP = new THREE.Vector3(-1, -0.6, -0.2);\nconst _umQ = new THREE.Quaternion(), _umE = new THREE.Euler(),")
rep("    if (u.o <= 0.001) continue;\n    any = true;",
"""    if (u.o <= 0.001) continue;
    any = true;
    { const cx = p.x - camera.position.x, cz = p.z - camera.position.z; if (cx * cx + cz * cz > 360 * 360) continue; }""")
rep("if (n !== i) { const c = new THREE.Color(p.umb.col); im.setColorAt(n, c); }",
    "if (n !== i) im.setColorAt(n, _umC.setHex(p.umb.col));")
rep("j.elbowPoleR = V(-1, -0.6, -0.2); }", "j.elbowPoleR = _umP; }")

# --- Event-Teile dürfen das Spiel nicht anhalten
rep("  finishRings(dt, t);\n  rainGear(dt, t);",
    "  try { finishRings(dt, t); } catch (e) { kwReport(e); }\n  try { rainGear(dt, t); } catch (e) { kwReport(e); RAIN.im = null; }")

rep('<div class="eyebrow">Vorabversion v29 · Sprungtechnik, Regen, TV-Werbung · Browser</div>',
    '<div class="eyebrow">Vorabversion v30 · stabiler, Absturzschutz · Browser</div>')
