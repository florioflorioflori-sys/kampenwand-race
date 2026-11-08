# v29: Fahrer stehen über dem Sattel und federn mit Knien und Hüfte, Gämsen nur an freien Stellen,
# viele Foto-Zuschauer auf der Bahn mit unterschiedlichen Ausweichsprüngen, doppelt so viele Kameras im Replay
# --- Angriffshaltung: Becken deutlich über dem Sattel
rep("  RP.hip.set((st.bodyX || 0) + rock, 1.0 - 0.13 * c", "  RP.hip.set((st.bodyX || 0) + rock, 1.09 - 0.1 * c")
# beim Einfedern geht das Becken nach hinten über das Hinterrad statt auf den Sattel
rep("  for (const k of ['hip', 'hpL', 'hpR']) RP[k].add(_ra.t.set(D.x, D.y, D.z));",
    "  for (const k of ['hip', 'hpL', 'hpR']) RP[k].add(_ra.t.set(D.x, D.y, D.z - Math.max(0, -D.y) * 0.75));")
# harte Sattelfreiheit: das Gesäß berührt den Sattel nie, Körper weicht nach oben und hinten aus
rep("  else bikeXform(u, 0, 0, 0, 0, 0.5, 0, 0, 0, 0);\n  combatPose(st);",
"""  else bikeXform(u, 0, 0, 0, 0, 0.5, 0, 0, 0, 0);
  if (D && !(st.crashT > 0) && u.bike) {
    const sv = _ra.t2.set(0, 0.89, -0.27).applyQuaternion(u.bike.quaternion).add(u.bike.position);
    const need = sv.y + 0.15 - RP.hip.y, overSaddle = RP.hip.z > -0.5 && RP.hip.z < 0.0;
    if (need > 0 && overSaddle) {
      const up = need * 0.55, back = need * 0.9;
      for (const k of ['hip', 'hpL', 'hpR']) { RP[k].y += up; RP[k].z -= back; }
      for (const k of ['chest', 'neck', 'head', 'shL', 'shR']) { RP[k].y += up * 0.6; RP[k].z -= back * 0.35; }
    }
  }
  combatPose(st);""")
# --- Gämsen: Querungen nur dort, wo im Umkreis keine Zuschauer stehen
rep("  for (const f of [0.2, 0.4, 0.6, 0.79]) {\n    const s = trail.L * f, side = rand() < 0.5 ? -1 : 1;",
"""  for (const f of [0.2, 0.4, 0.6, 0.79]) {
    let s = trail.L * f, bestN = 1e9;
    for (let k = -14; k <= 14; k++) {
      const s2 = trail.L * f + k * 12; if (s2 < 150 || s2 > trail.L - 200 || trail.kickers.some((q) => Math.abs(q - s2) < 40)) continue;
      const pts = [trailPoint(s2 - 6, 0, {}), trailPoint(s2 + 6, 0, {}), trailPoint(s2 + 18, 0, {}), trailPoint(s2, 24, {}), trailPoint(s2, -24, {}), trailPoint(s2 + 12, 30, {}), trailPoint(s2 + 12, -30, {})];
      let n = 0; for (const p of life.people) for (const q of pts) if (Math.abs(p.x - q.x) < 26 && Math.abs(p.z - q.z) < 26) { n++; break; }
      if (n < bestN) { bestN = n; s = s2; }
      if (n === 0) break;
    }
    const side = rand() < 0.5 ? -1 : 1;""")
# --- deutlich mehr Foto- und Film-Zuschauer auf der Bahn
rep("  for (let s = 220; s < trail.L - 160 && life.dashers.length < 7; s += 20) {\n    if (s - lastD < 280",
    "  for (let s = 180; s < trail.L - 140 && life.dashers.length < 26; s += 12) {\n    if (s - lastD < 85")
rep("    p.noReal = false; life.dashers.push({ p, s, side, st: 'wait', k: 0, t: 0 });",
    "    p.noReal = false; life.dashers.push({ p, s, side, st: 'wait', k: 0, t: 0, style: Math.floor(rand() * 6), when: 0.55 + rand() * 0.6, dur: 0.4 + rand() * 0.35, lift: 0.15 + rand() * 0.5, film: rand() < 0.45 });")
# Ausweichen: sechs Varianten (Hecht, Seitsprung, Hüpfer, Ducken, Rückwärts mit Armrudern, Hecht mit Liegenbleiben), Zeitpunkt variiert
rep("      if (tReach < 0.85 || ds < 7) { d.st = 'leap'; d.t = 0; d.lat0 = d.side * (TRAIL_HALF + 2.2 - e * (TRAIL_HALF + 1.4)); }",
    "      if (d.film) p.pose = 'film';\n      if (tReach < (d.when || 0.85) || ds < 6) { d.st = 'leap'; d.t = 0; d.lat0 = d.side * (TRAIL_HALF + 2.2 - e * (TRAIL_HALF + 1.4)); d.to = d.style === 1 && Math.random() < 0.5 ? -d.side : d.side; }")
rep("""      d.t += dt; const k = Math.min(1, d.t / 0.55), lat = d.lat0 + (d.side * (TRAIL_HALF + 2.6) - d.lat0) * (1 - (1 - k) * (1 - k));
      const pt = place(lat, Math.sin(k * Math.PI) * 0.45);
      p.yaw = pt.yaw + Math.PI; p.pose = d.side > 0 ? 'leapR' : 'leapL';""",
"""      const sty = d.style || 0, to = d.to || d.side, dur = sty === 3 ? 0.3 : (d.dur || 0.55);
      d.t += dt; const k = Math.min(1, d.t / dur), ease = 1 - (1 - k) * (1 - k);
      const latEnd = to * (TRAIL_HALF + (sty === 3 ? 0.9 : sty === 2 ? 1.6 : 2.6)), lat = d.lat0 + (latEnd - d.lat0) * ease;
      const hop = sty === 2 ? Math.abs(Math.sin(k * Math.PI * 2)) * 0.22 : sty === 3 ? 0 : Math.sin(k * Math.PI) * (d.lift || 0.45);
      const pt = place(lat, hop);
      const dir = to > 0 ? 'R' : 'L';
      p.yaw = pt.yaw + Math.PI + (sty === 4 ? to * 0.6 : 0);
      p.pose = sty === 0 || sty === 5 || sty === 1 ? 'leap' + dir : sty === 2 ? 'hopAway' : sty === 3 ? 'duck' : 'flail';
      if (k >= 1 && sty === 3) { d.st = 'crouch'; d.t = 0; }
      if (k >= 1 && sty === 5) { d.st = 'lie'; d.t = 0; p.pose = 'lyingBack'; }""")
rep("    } else if (d.st === 'done' && ds < -150) { d.st = 'wait'; place(d.side * (TRAIL_HALF + 2.2)); }",
"""    } else if (d.st === 'crouch' || d.st === 'lie') {
      d.t += dt; p.pose = d.st === 'crouch' ? 'duck' : 'lyingBack';
      if (d.t > (d.st === 'crouch' ? 0.9 : 1.6)) { d.st = 'done'; p.pose = d.film ? 'film' : 'snapper'; p.yaw = facingTrail(d.s, d.to || d.side); }
    } else if (d.st === 'done' && ds < -150) { d.st = 'wait'; place(d.side * (TRAIL_HALF + 2.2)); }""")
rep("      if (k >= 1) { d.st = 'done'; p.pose = 'snapper';", "      if (k >= 1 && d.st === 'leap') { d.st = 'done'; p.pose = d.film ? 'film' : 'snapper';")
rep("POSES.leapL = leapPose(1); POSES.leapR = leapPose(-1);",
"""POSES.leapL = leapPose(1); POSES.leapR = leapPose(-1);
// Hüpfer zur Seite, Arme hoch und Kamera schützen
POSES.hopAway = (t, e, ph) => {
  const j = baseSkel(-0.05), a = t * 14 + ph;
  j.haL.set(0.28, 1.72, 0.1); j.haR.set(-0.1, 1.55, 0.22); j.elbowPole = V(1, 0, -0.3); j.elbowPoleR = V(-1, -0.4, -0.2);
  j.ftL.set(0.16, 0.1 + Math.max(0, Math.sin(a)) * 0.12, 0.05); j.ftR.set(-0.08, 0.1 + Math.max(0, -Math.sin(a)) * 0.12, -0.05);
  j.headQ = E(-0.1, 0.6, 0);
  j.props = [{ a: V(-0.1, 1.53, 0.25), b: V(-0.1, 1.65, 0.24), r: 0.007, right: V(1, 0, 0), flat: 5 }];
  return j;
};
// Ducken am Rand: tief in die Hocke, Arme über den Kopf
POSES.duck = (t, e, ph) => ({
  pelvis: V(0, 0.42, -0.12), chest: V(0, 0.78, 0.12), neck: V(0, 0.86, 0.2), head: V(0, 0.95, 0.27),
  shL: V(0.17, 0.82, 0.13), shR: V(-0.17, 0.82, 0.13), hpL: V(0.11, 0.4, -0.1), hpR: V(-0.11, 0.4, -0.1),
  haL: V(0.06, 1.08, 0.24), haR: V(-0.06, 1.1, 0.22), ftL: V(0.18, 0.08, 0.12), ftR: V(-0.18, 0.08, 0.06),
  kneePole: V(0.3, 0, 1), kneePoleR: V(-0.3, 0, 1), elbowPole: V(1, 0.4, 0), elbowPoleR: V(-1, 0.4, 0), headQ: E(0.5, 0, 0),
});
// rückwärts wegstolpern und mit den Armen rudern
POSES.flail = (t, e, ph) => {
  const j = baseSkel(-0.12), a = t * 16 + ph;
  j.pelvis.z = -0.08; j.hpL.z = j.hpR.z = -0.08;
  j.haL.set(0.42, 1.6 + Math.sin(a) * 0.25, 0.1 + Math.cos(a) * 0.15); j.haR.set(-0.42, 1.6 - Math.sin(a) * 0.25, 0.1 - Math.cos(a) * 0.15);
  j.ftL.set(0.12, 0.08, 0.18); j.ftR.set(-0.14, 0.2, -0.22);
  j.headQ = E(-0.3, 0, 0);
  return j;
};""")
# --- Fernsehkameras an der Strecke: doppelt so viele Positionen
rep("  const spots = [...trail.kickers.filter((_, i) => i % 3 === 1), ...(life.rallySpots || []).filter((_, i) => i % 2 === 0)];",
    "  const spots = [...trail.kickers.filter((_, i) => i % 3 !== 0), ...(life.rallySpots || []), ...Array.from({ length: Math.max(0, Math.floor((L - 300) / 340)) }, (_, k) => 190 + k * 340)];")
# --- Zusammenfassung: jede Szene aus zwei Blickwinkeln, neue Boden- und Verfolgerkameras
rep("function replayPickCam(seg) {\n  const F = REPLAY.frames, pi = riders.findIndex((r) => r.isPlayer), mid = F[Math.floor((seg.a + seg.b) / 2)].r[pi].p;",
"""function replayPickCam(seg, prev, from) {
  const F = REPLAY.frames, pi = riders.findIndex((r) => r.isPlayer), a0 = from ?? seg.a, mi = Math.floor((a0 + seg.b) / 2), mid = F[mi].r[pi].p;
  const roll = Math.random(), pk = prev ? prev.kind : '';
  if (roll < 0.22 && pk !== 'ground') {
    const fs = F[Math.min(F.length - 1, mi + 30)].r[pi].s ?? 0, side = Math.random() < 0.5 ? -1 : 1, pt = trailPoint(fs, side * (TRAIL_HALF + 0.9), {});
    return { kind: 'ground', pos: new THREE.Vector3(pt.x, hAt(pt.x, pt.z) + 0.35, pt.z), brand: TV_BRANDS[Math.floor(Math.random() * TV_BRANDS.length)] };
  }
  if (roll < 0.4 && pk !== 'chase') return { kind: 'chase', brand: TV_BRANDS[Math.floor(Math.random() * TV_BRANDS.length)], pos: new THREE.Vector3() };""")
rep("  for (const p of TV.cams) {\n    if (p.pose === 'reporter') continue;", "  for (const p of TV.cams) {\n    if (p.pose === 'reporter' || p.pose === 'boom' || p.pose === 'phone' || (prev && prev.p === p)) continue;")
rep("  const s = REPLAY.segs[REPLAY.si]; REPLAY.t = s.a; REPLAY.cam = replayPickCam(s); REPLAY.lookInit = false;",
    "  const s = REPLAY.segs[REPLAY.si]; REPLAY.t = s.a; REPLAY.cam = replayPickCam(s); REPLAY.lookInit = false; replayLabel(s);\n}\nfunction replayLabel(s) {")
rep("  $('rpCam').textContent = REPLAY.cam.kind === 'team' ? 'Kamera ' + (TV.cams.indexOf(REPLAY.cam.p) + 1) : REPLAY.cam.kind === 'heli' ? 'Hubschrauber' : 'Drohne';",
    "  $('rpCam').textContent = REPLAY.cam.kind === 'team' ? 'Kamera ' + (TV.cams.indexOf(REPLAY.cam.p) + 1) : REPLAY.cam.kind === 'heli' ? 'Hubschrauber' : REPLAY.cam.kind === 'ground' ? 'Bodenkamera' : REPLAY.cam.kind === 'chase' ? 'Verfolgerkamera' : 'Drohne';")
rep("  if (REPLAY.t >= S.b) { replayNextSeg(); return; }",
    """  if (REPLAY.t >= S.b) { replayNextSeg(); return; }
  if (!S.cut && S.b - S.a > 100 && REPLAY.t > (S.a + S.b) / 2) { S.cut = true; REPLAY.cam = replayPickCam(S, REPLAY.cam, REPLAY.t); REPLAY.lookInit = false; replayLabel(S); }""")
rep("  else if (C.kind === 'drone') {",
"""  else if (C.kind === 'ground') REPLAY.camP.copy(C.pos);
  else if (C.kind === 'chase') { const hd = REPLAY.focusYaw; const want = _rpV2.set(REPLAY.focusPos.x - Math.sin(hd) * 5.5, 0, REPLAY.focusPos.z - Math.cos(hd) * 5.5); want.y = Math.max(REPLAY.focusPos.y + 2.2, hAt(want.x, want.z) + 1.2); if (C.pos.lengthSq() === 0) C.pos.copy(want); else C.pos.lerp(want, 1 - Math.exp(-4 * dt)); REPLAY.camP.copy(C.pos); }
  else if (C.kind === 'drone') {""")
rep('<div class="eyebrow">Vorabversion v28 · Lebendige Fahrer und Zuschauer · Browser</div>',
    '<div class="eyebrow">Vorabversion v29 · Sprungtechnik, Regen, TV-Werbung · Browser</div>')
# Schirmhand bei den echten Figuren und Kapselfiguren
rep("      j = exciteLayer(POSES[p.pose](t, p.e, p.ph), t, p.e, p);\n      fillJoints(j);", "      j = umbHand(exciteLayer(POSES[p.pose](t, p.e, p.ph), t, p.e, p), p);\n      fillJoints(j);")
rep("      j = exciteLayer(POSES[p.pose](t, p.e, p.ph), t, p.e, p);\n      let look = 0;", "      j = umbHand(exciteLayer(POSES[p.pose](t, p.e, p.ph), t, p.e, p), p);\n      let look = 0;")
