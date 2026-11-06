# ================= Etappe 7: Ton neu, mehr Kamerateams, Drohne, Zusammenfassung aus Sicht der Kamerateams
# --- Ton: ganzer Block ersetzt
i0 = src.index("const audio = { ctx: null, muted: false };")
i1 = src.index("function updateAudio(speed, grounded, slip, onTrail) {", i0)
i2 = src.index("\n}\n", i1) + 3
src = src[:i0] + rd('audio.js') + src[i2:]
# Drohnen-Summen als Dauerton
rep("    Object.assign(audio, { ctx, master, send, comp, bufs,", """    const dr = ctx.createOscillator(); dr.type = 'sawtooth'; dr.frequency.value = 196; const dr2 = ctx.createOscillator(); dr2.type = 'sawtooth'; dr2.frequency.value = 203;
    const drF = ctx.createBiquadFilter(); drF.type = 'bandpass'; drF.frequency.value = 900; drF.Q.value = 0.8; const droneG = ctx.createGain(); droneG.gain.value = 0;
    dr.connect(drF); dr2.connect(drF); drF.connect(droneG).connect(master); dr.start(); dr2.start();
    Object.assign(audio, { droneG, ctx, master, send, comp, bufs,""")
# Startuhr wie bei echten Zeitmessanlagen, Stadionsprecher
rep("if (c > 0 && c <= 3) { flash(String(c), 'Bergstation Kampenwand', 1); beep(440, 0.15); } }", "if (c > 0 && c <= 3) { flash(String(c), 'Bergstation Kampenwand', 1); beep(1000, 0.16, 0.22); if (c === 3) announce('Achtung, fertig!'); } }")
rep("if (race.countdown <= 0) { race.state = 'race'; flash('Los!', '', 0.8); beep(880, 0.4); }", "if (race.countdown <= 0) { race.state = 'race'; flash('Los!', '', 0.8); beep(1500, 0.6, 0.26); recReset(); }")
rep("  beep(660, 0.2); setTimeout(() => beep(990, 0.4), 200);", """  beep(1500, 0.5, 0.25);
  if (audio.ctx) { const fp = V(player.pos.x, 0, player.pos.z); sfx('horn', fp, 8); setTimeout(() => sfx('clap', fp, 6), 300); setTimeout(() => sfx('horn', fp, 12), 900); }
  announce(`Im Ziel: ${player.cfg.name}! ${fmtTime(t).replace('.', ',')}, Platz ${rank}.`);""")
# --- mehr Kamerateams, Fotografen, Kameratürme, Drohne
rep("  // Hubschrauber\n  for (const b of TV_BRANDS) { const h = tvHeli(b); TV.helis.push(h); grp.add(h.g); }",
"""  // weitere Teams auf der ganzen Strecke, abwechselnd links und rechts, dazu Fotografen
  {
    let k = 0;
    for (let s = 60; s < L - 60; s += 70 + rand() * 35, k++) {
      const c0 = trailPoint(s, 0, {});
      if (TV.cams.some((p) => Math.hypot(p.x - c0.x, p.z - c0.z) < 30)) continue;
      const side = k % 2 ? 1 : -1, b = TV_BRANDS[k % 3];
      if (k % 6 === 3) {
        const lat = side * (TRAIL_HALF + 5), pt = trailPoint(s, lat, {});
        if (free(pt.x, pt.z, 2)) { const tw = camTower(2.8); tw.position.set(pt.x, hAt(pt.x, pt.z), pt.z); grp.add(tw); clear(pt.x, pt.z, 2); addObstacle(pt.x, pt.z, 1.4);
          crew('tvtripod', s, lat, b, { y: hAt(pt.x, pt.z) + 2.85, force: true, yaw: -side * 0.3 }); continue; }
      }
      crew(k % 3 === 0 ? 'tvtripod' : 'tvcam', s, side * (TRAIL_HALF + 2.0 + rand() * 1.2), b, { yaw: -side * 0.5 });
      if (k % 2 === 0) { const ph = crew('photog', s + 6 + rand() * 4, -side * (TRAIL_HALF + 1.8 + rand()), b, { yaw: side * 0.6 }); if (ph) ph.photog = true; }
    }
  }
  // Hubschrauber und Drohne
  for (const b of TV_BRANDS) { const h = tvHeli(b); TV.helis.push(h); grp.add(h.g); }
  TV.drone = tvDrone(); grp.add(TV.drone.g);""")
rep("const TV = { helis: [], cams: [], heli: null, cd: 18, mode: 'idle', t: 0 };", "const TV = { helis: [], cams: [], heli: null, cd: 18, mode: 'idle', t: 0, drone: null };\n" + rd('replay.js'))
rep("""  for (const p of TV.cams) {
    const d = Math.hypot(P.x - p.x, P.z - p.z);""", """  updateDrone(dt, t);
  for (const p of TV.cams) {
    const d = Math.hypot(P.x - p.x, P.z - p.z);
    if (p.photog && d < 22 && race.state === 'race' && Math.random() < dt * 4) sfx('shutter', p, d);""")
# --- Aufzeichnung: Eingaben der Fahrerhaltung merken
rep("function riderDyn(r, st) {\n", "function riderDyn(r, st) {\n  if (!REPLAY.on) r._stIn = Object.assign({}, st);\n")
rep("""  POSE_DT = race.state === 'paused' ? 0 : frameDt;
  poseAllRiders(input);""", """  if (REPLAY.on) replayStep(frameDt);
  else { POSE_DT = race.state === 'paused' ? 0 : frameDt; poseAllRiders(input); recFrame(frameDt); }""")
rep("""  // Schatten & Sichtweite um den Spieler
  sun.target.position.copy(player.pos);
  sun.position.copy(player.pos).addScaledVector(sunDir, 300);""", """  if (REPLAY.on) { camera.fov = REPLAY.fov; camera.updateProjectionMatrix(); }
  // Schatten & Sichtweite um den Spieler (in der Zusammenfassung um den gezeigten Fahrer)
  const shC = REPLAY.on ? REPLAY.focusPos : player.pos;
  sun.target.position.copy(shC);
  sun.position.copy(shC).addScaledVector(sunDir, 300);""")
rep("  updateAudio(player.vel.length(), !player.air && player.crashT <= 0, player.slip, player.onTrail);",
    "  if (REPLAY.on) updateAudio(0, false, 0, true); else updateAudio(player.vel.length(), !player.air && player.crashT <= 0, player.slip, player.onTrail);")
# --- Bedienung: Knopf im Ergebnis, Überspringen mit Esc/Enter/Leertaste
rep("""      <button class="ghost" id="watchBtn">Weiter zuschauen</button>""", """      <button class="go" id="replayBtn">Zusammenfassung</button>
      <button class="ghost" id="watchBtn">Weiter zuschauen</button>""")
rep("$('watchBtn').onclick = () => { $('results').hidden = true; };", """$('watchBtn').onclick = () => { $('results').hidden = true; };
$('replayBtn').onclick = () => replayStart();
$('rpSkip').onclick = () => replayNextSeg();
$('rpEnd').onclick = () => replayStop();""")
rep("  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();", "  if (REPLAY.on) { if (e.code === 'Escape') replayStop(); else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowRight') replayNextSeg(); return; }\n  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();")
rep('<div id="results" class="overlay" hidden>', """<div id="replayUI" hidden>
  <div id="rpTop"><span id="rpBug">ARD</span><span id="rpTag">REPLAY</span><span id="rpCam"></span></div>
  <div id="rpLow"><div id="rpName"></div><div id="rpTime"></div></div>
  <div id="rpBarW"><div id="rpBar"></div></div>
  <div id="rpBtns"><button class="ghost" id="rpSkip">Nächste Szene ▶</button><button class="ghost" id="rpEnd">Beenden</button></div>
</div>
<div id="results" class="overlay" hidden>""")
rep("</style>", """#replayUI { position: fixed; inset: 0; pointer-events: none; z-index: 30; font-family: var(--font-num); }
#rpTop { position: absolute; top: calc(14px + env(safe-area-inset-top, 0px)); left: 16px; display: flex; gap: 8px; align-items: center; }
#rpBug { font: 900 18px/1 Barlow, sans-serif; padding: 6px 10px; border-radius: 3px; letter-spacing: .02em; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
#rpTag { background: #d2102a; color: #fff; font: 800 14px/1 Barlow, sans-serif; padding: 7px 10px; border-radius: 3px; letter-spacing: .08em; animation: rpPulse 1.6s infinite; }
#rpCam { color: #fff; font: 600 13px Barlow, sans-serif; text-shadow: 0 1px 3px rgba(0,0,0,.8); }
@keyframes rpPulse { 50% { opacity: .65; } }
#rpLow { position: absolute; left: 16px; bottom: calc(64px + env(safe-area-inset-bottom, 0px)); display: flex; align-items: stretch; box-shadow: 0 4px 14px rgba(0,0,0,.4); }
#rpName { background: rgba(10,16,30,.88); color: #fff; font: 700 18px Barlow, sans-serif; padding: 8px 14px; }
#rpTime { background: #f4efe6; color: #111; font: 800 18px var(--font-num); padding: 8px 12px; }
#rpBarW { position: absolute; left: 16px; right: 16px; bottom: calc(44px + env(safe-area-inset-bottom, 0px)); height: 3px; background: rgba(255,255,255,.25); }
#rpBar { height: 100%; width: 0; background: #d2102a; }
#rpBtns { position: absolute; right: 16px; top: calc(14px + env(safe-area-inset-top, 0px)); display: flex; gap: 8px; pointer-events: auto; }
body.replaying .hud, body.replaying #touch { display: none !important; }
</style>""")
rep('<div class="eyebrow">Vorabversion v21 · Sonnenalm, Haare, Fahrer · Browser</div>', '<div class="eyebrow">Vorabversion v22 · Ton, Kamerateams, Zusammenfassung · Browser</div>')
