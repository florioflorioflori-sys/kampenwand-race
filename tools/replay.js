// ------------------------------------------------------------------
// Fotograf mit Spiegelreflex und Teleobjektiv
// ------------------------------------------------------------------
POSES.photog = (t, e, ph) => {
  const j = baseSkel(0.05), b = Math.sin(t * 1.1 + ph) * 0.006;
  j.haR.set(-0.06, 1.6 + b, 0.2); j.haL.set(0.02, 1.54 + b, 0.36);
  j.elbowPoleR = V(-1, -0.6, -0.2); j.elbowPole = V(1, -0.8, 0);
  j.headQ = E(0.08, -0.05, 0);
  j.props = [
    { a: V(-0.03, 1.63 + b, 0.1), b: V(-0.03, 1.63 + b, 0.2), r: 0.06, right: V(1, 0, 0), flat: 1.4, col: 0x151515 },
    { a: V(-0.03, 1.62 + b, 0.2), b: V(-0.03, 1.62 + b, 0.52), r: 0.042, r1: 0.05, col: 0xe8e4da },
    { a: V(-0.03, 1.62 + b, 0.5), b: V(-0.03, 1.62 + b, 0.56), r: 0.052, col: 0x111111 },
  ];
  return j;
};
// ------------------------------------------------------------------
// TV-Drohne: verfolgt das Rennen von hinten oben
// ------------------------------------------------------------------
function tvDrone() {
  const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.45, metalness: 0.4 }), red = new THREE.MeshStandardMaterial({ color: 0xd2102a, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.42), dark); g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.3), red); top.position.y = 0.08; g.add(top);
  const rotors = [];
  for (const [x, z] of [[-0.36, 0.36], [0.36, 0.36], [-0.36, -0.36], [0.36, -0.36]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.55), dark); arm.position.set(x / 2, 0.02, z / 2); arm.rotation.y = Math.atan2(x, z); g.add(arm);
    const mot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10), dark); mot.position.set(x, 0.04, z); g.add(mot);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
    disc.position.set(x, 0.08, z); g.add(disc); rotors.push(disc);
  }
  const gim = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), dark); gim.position.set(0, -0.1, 0.16); g.add(gim);
  for (const sx of [-0.12, 0.12]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.3), dark); leg.position.set(sx, -0.12, 0); g.add(leg); }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return { g, rotors, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, on: false };
}
function updateDrone(dt, t) {
  const D = TV.drone; if (!D || !player) return;
  const racing = race.state === 'race' || race.state === 'done' || race.state === 'replay';
  const F = REPLAY.on ? REPLAY.focusPos : player.pos, fy = REPLAY.on ? REPLAY.focusYaw : player.yaw;
  if (!racing) { D.g.visible = false; D.on = false; return; }
  if (!D.on) { D.on = true; D.pos.set(F.x, F.y + 20, F.z); D.vel.set(0, 0, 0); }
  D.g.visible = true;
  const fx = Math.sin(fy), fz = Math.cos(fy);
  const tx = F.x - fx * 9 + Math.sin(t * 0.4) * 3 * fz, tz = F.z - fz * 9 - Math.sin(t * 0.4) * 3 * fx;
  const ty = Math.max(F.y + 6.5 + Math.sin(t * 0.6) * 1.2, hAt(tx, tz) + 4);
  D.vel.x += ((tx - D.pos.x) * 4 - D.vel.x * 3) * dt; D.vel.y += ((ty - D.pos.y) * 4 - D.vel.y * 3) * dt; D.vel.z += ((tz - D.pos.z) * 4 - D.vel.z * 3) * dt;
  D.pos.addScaledVector(D.vel, dt);
  D.yaw = Math.atan2(F.x - D.pos.x, F.z - D.pos.z);
  D.g.position.copy(D.pos); D.g.rotation.set(clamp(D.vel.length() * 0.02, 0, 0.35), D.yaw, 0, 'YXZ');
  for (const r of D.rotors) r.rotation.y += dt * 80;
  if (audio.droneG) audio.droneG.gain.setTargetAtTime(audio.muted ? 0 : sfxGain(D.pos) * 0.05, audio.ctx.currentTime, 0.2);
}

// ------------------------------------------------------------------
// Aufzeichnung und Zusammenfassung aus Sicht der Kamerateams
// ------------------------------------------------------------------
const REPLAY = { frames: [], acc: 0, on: false, segs: [], si: 0, t: 0, cam: null, fov: 30, focusPos: new THREE.Vector3(), focusYaw: 0, look: new THREE.Vector3(), camP: new THREE.Vector3() };
const REC_DT = 1 / 30;
function recReset() { REPLAY.frames = []; REPLAY.acc = 0; }
function recFrame(dt) {
  if (REPLAY.on || (race.state !== 'race' && race.state !== 'done')) return;
  REPLAY.acc += dt; if (REPLAY.acc < REC_DT) return; REPLAY.acc = 0;
  if (REPLAY.frames.length > 30 * 60 * 8) return;
  REPLAY.frames.push({ t: race.t, r: riders.map((r) => {
    const m = r.model, u = m.userData;
    return { p: m.position.toArray(), q: m.quaternion.toArray(), tilt: u.tilt.rotation.z, st: r._stIn ? Object.assign({}, r._stIn) : null,
      s: r.isPlayer ? r.s : r.ai.s, fin: r.isPlayer ? r.finished : r.ai.finished };
  }) });
}
// Höhepunkte: Start, Sprünge, Stürze, Überholmanöver, Zieleinlauf
function replayPlan() {
  const F = REPLAY.frames, n = F.length; if (n < 30) return [];
  const pi = riders.findIndex((r) => r.isPlayer);
  const ev = [];
  for (let i = 1; i < n; i++) {
    const a = F[i - 1].r[pi], b = F[i].r[pi]; if (!a.st || !b.st) continue;
    if (b.st.air && (b.st.airT || 0) > 0.45 && !(a.st.airT > 0.45)) ev.push({ i, k: 'Sprung', w: 3 });
    if ((b.st.crashT || 0) > 0 && !((a.st.crashT || 0) > 0)) ev.push({ i, k: 'Sturz', w: 4 });
    // Überholen: Reihenfolge des Spielers ändert sich
    const rk = (fr) => fr.r.filter((x) => x.s > fr.r[pi].s).length;
    if (i % 15 === 0 && i >= 15 && rk(F[i]) < rk(F[i - 15])) ev.push({ i, k: 'Überholt', w: 2 });
  }
  const segs = [{ a: 0, b: Math.min(n - 1, 6 * 30), k: 'Start' }];
  ev.sort((x, y) => y.w - x.w);
  const used = [0];
  for (const e of ev) {
    if (segs.length >= 8) break;
    if (used.some((u) => Math.abs(u - e.i) < 9 * 30)) continue;
    used.push(e.i); segs.push({ a: Math.max(0, e.i - 2.5 * 30), b: Math.min(n - 1, e.i + 3.5 * 30), k: e.k, slow: e.k === 'Sprung' });
  }
  // Lücken mit gleichmäßig verteilten Szenen auffüllen
  for (let f = 0.2; f < 0.9 && segs.length < 8; f += 0.17) { const i = Math.floor(n * f); if (used.some((u) => Math.abs(u - i) < 9 * 30)) continue; used.push(i); segs.push({ a: i, b: Math.min(n - 1, i + 5 * 30), k: '' }); }
  const fi = F.findIndex((fr) => fr.r[pi].fin);
  const end = fi > 0 ? fi : n - 1; segs.push({ a: Math.max(0, end - 7 * 30), b: Math.min(n - 1, end + 2 * 30), k: 'Ziel' });
  segs.sort((x, y) => x.a - y.a);
  const out = [];
  for (const sg of segs) { const pv = out[out.length - 1]; if (pv && sg.a < pv.b) { if (sg.b - pv.b < 60) { if (sg.k) pv.k = sg.k; pv.b = Math.max(pv.b, sg.b); continue; } sg.a = pv.b; } out.push(sg); }
  return out;
}
// Kamera für eine Szene: nächstgelegenes Team mit freier Sicht, sonst Hubschrauber oder Drohne
function replayPickCam(seg) {
  const F = REPLAY.frames, pi = riders.findIndex((r) => r.isPlayer), mid = F[Math.floor((seg.a + seg.b) / 2)].r[pi].p;
  let best = null, bd = 1e9;
  for (const p of TV.cams) {
    if (p.pose === 'reporter') continue;
    const y = (p.y ?? hAt(p.x, p.z)), cy = (p.pose === 'tvtripod' ? 1.45 : 1.65) + y;
    const d = Math.hypot(p.x - mid[0], p.z - mid[2]);
    if (d > 110 || d < 4) continue;
    // freie Sicht: Gelände zwischen Kamera und Fahrer
    let ok = true; for (let k = 1; k < 8; k++) { const f = k / 8, x = p.x + (mid[0] - p.x) * f, z = p.z + (mid[2] - p.z) * f; if (hAt(x, z) > cy + (mid[1] + 1 - cy) * f + 0.3) { ok = false; break; } }
    if (!ok) continue;
    if (d < bd) { bd = d; best = { kind: 'team', p, pos: new THREE.Vector3(p.x, cy, p.z), brand: p.tv }; }
  }
  if (best && seg.k !== 'Start' && seg.k !== 'Ziel' && Math.random() < 0.25) best = null;
  if (!best) return Math.random() < 0.5 ? { kind: 'heli', brand: TV_BRANDS[Math.floor(Math.random() * 3)] } : { kind: 'drone', brand: TV_BRANDS[1] };
  return best;
}
function replayStart() {
  const segs = replayPlan(); if (!segs.length) return;
  REPLAY.on = true; REPLAY.segs = segs; REPLAY.si = -1; REPLAY.prevState = race.state; race.state = 'replay';
  $('results').hidden = true; $('replayUI').hidden = false; document.body.classList.add('replaying');
  for (const r of riders) r.posedOnce = false;
  replayNextSeg();
}
function replayNextSeg() {
  REPLAY.si++;
  if (REPLAY.si >= REPLAY.segs.length) { replayStop(); return; }
  const s = REPLAY.segs[REPLAY.si]; REPLAY.t = s.a; REPLAY.cam = replayPickCam(s); REPLAY.lookInit = false;
  const b = REPLAY.cam.brand || TV_BRANDS[0];
  const bug = $('rpBug'); bug.textContent = b.name; bug.style.background = b.bg; bug.style.color = b.fg;
  $('rpTag').textContent = s.k ? 'REPLAY · ' + s.k.toUpperCase() : 'REPLAY';
  $('rpCam').textContent = REPLAY.cam.kind === 'team' ? 'Kamera ' + (TV.cams.indexOf(REPLAY.cam.p) + 1) : REPLAY.cam.kind === 'heli' ? 'Hubschrauber' : 'Drohne';
  if (REPLAY.cam.kind === 'heli') { REPLAY.camP.set(0, 0, 0); REPLAY.heliA = Math.random() * 6.28; }
}
function replayStop() {
  REPLAY.on = false; race.state = REPLAY.prevState === 'replay' ? 'done' : (REPLAY.prevState || 'done');
  $('replayUI').hidden = true; document.body.classList.remove('replaying'); window.__camOverride = null; camInit = false;
  for (const r of riders) r.posedOnce = false;
  showResults(); $('results').hidden = false;
}
function replayStep(dt) {
  const S = REPLAY.segs[REPLAY.si]; if (!S) return;
  const F = REPLAY.frames, pi = riders.findIndex((r) => r.isPlayer);
  REPLAY.t += dt * 30 * (S.slow ? 0.5 : 1);
  if (REPLAY.t >= S.b) { replayNextSeg(); return; }
  const i0 = Math.floor(REPLAY.t), i1 = Math.min(F.length - 1, i0 + 1), f = REPLAY.t - i0, A = F[i0], B = F[i1];
  POSE_DT = dt * (S.slow ? 0.5 : 1);
  riders.forEach((r, k) => {
    const a = A.r[k], b = B.r[k], m = r.model, u = m.userData;
    m.position.set(a.p[0] + (b.p[0] - a.p[0]) * f, a.p[1] + (b.p[1] - a.p[1]) * f, a.p[2] + (b.p[2] - a.p[2]) * f);
    m.quaternion.fromArray(a.q).slerp(_rpQ.fromArray(b.q), f);
    u.tilt.rotation.z = a.tilt + (b.tilt - a.tilt) * f;
    m.visible = m.position.distanceTo(camera.position) < 450;
    if (a.st) { const st = Object.assign({}, a.st); st.wheelRot = a.st.wheelRot + wrapAngle((b.st ? b.st.wheelRot : a.st.wheelRot) - a.st.wheelRot) * f; poseRider(m, riderDyn(r, st)); }
  });
  const fp = A.r[pi];
  REPLAY.focusPos.set(...fp.p); REPLAY.focusYaw = new THREE.Euler().setFromQuaternion(_rpQ.fromArray(fp.q), 'YXZ').y;
  const tgt = _rpV.copy(REPLAY.focusPos); tgt.y += 1.0;
  if (!REPLAY.lookInit) { REPLAY.look.copy(tgt); REPLAY.lookInit = true; }
  REPLAY.look.lerp(tgt, 1 - Math.exp(-8 * dt));
  const C = REPLAY.cam;
  if (C.kind === 'team') { // vor dem Objektiv, nicht im Kopf des Kameramanns
    const dx = REPLAY.focusPos.x - C.pos.x, dz = REPLAY.focusPos.z - C.pos.z, dl = Math.hypot(dx, dz) || 1, fw = C.p.pose === 'tvtripod' ? 1.15 : 0.75;
    REPLAY.camP.set(C.pos.x + dx / dl * fw, C.pos.y, C.pos.z + dz / dl * fw); }
  else if (C.kind === 'drone') { const D = TV.drone; REPLAY.camP.copy(D.pos).add(_rpV2.set(0, -0.15, 0)); }
  else { // Hubschrauber: weit oben seitlich, Tele
    REPLAY.heliA += dt * 0.12;
    const want = _rpV2.set(REPLAY.focusPos.x + Math.sin(REPLAY.heliA) * 70, Math.max(REPLAY.focusPos.y + 35, hAt(REPLAY.focusPos.x + Math.sin(REPLAY.heliA) * 70, REPLAY.focusPos.z + Math.cos(REPLAY.heliA) * 70) + 25), REPLAY.focusPos.z + Math.cos(REPLAY.heliA) * 70);
    if (REPLAY.camP.lengthSq() === 0) REPLAY.camP.copy(want); else REPLAY.camP.lerp(want, 1 - Math.exp(-2 * dt));
  }
  // Brennweite: Fahrer füllt etwa ein Drittel der Bildhöhe, leicht verzögert wie von Hand gezoomt
  const d = REPLAY.camP.distanceTo(REPLAY.look);
  const fov = clamp(2 * Math.atan(2.6 / Math.max(1, d)) * 180 / Math.PI, 6, 60);
  REPLAY.fov = REPLAY.fov ? damp(REPLAY.fov, fov, 2.5, dt) : fov;
  // leichtes Handwackeln bei Schulterkameras
  const hand = C.kind === 'team' && C.p.pose === 'tvcam' ? 1 : 0, tt = uTime.value;
  window.__camOverride = { pos: [REPLAY.camP.x, REPLAY.camP.y, REPLAY.camP.z],
    look: [REPLAY.look.x + Math.sin(tt * 1.7) * 0.03 * hand * d * 0.05, REPLAY.look.y + Math.sin(tt * 2.3 + 1) * 0.02 * hand * d * 0.05, REPLAY.look.z] };
  // Kameramann schwenkt mit
  if (C.kind === 'team') C.p.yaw = Math.atan2(REPLAY.focusPos.x - C.p.x, REPLAY.focusPos.z - C.p.z);
  const r0 = riders[pi];
  $('rpName').textContent = `${r0.cfg.name} #${r0.cfg.num}`; $('rpTime').textContent = fmtTime(A.t);
  $('rpBar').style.width = `${((REPLAY.si + (REPLAY.t - S.a) / (S.b - S.a)) / REPLAY.segs.length * 100).toFixed(1)}%`;
}
const _rpQ = new THREE.Quaternion(), _rpV = new THREE.Vector3(), _rpV2 = new THREE.Vector3();
