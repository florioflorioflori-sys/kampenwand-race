// ------------------------------------------------------------------
// Siegerehrung (v31): Podest im Auslauf hinter dem Ziel, die drei Besten
// kommen nacheinander aufs Treppchen, Medaillen, Pokal, Konfetti, Fanfare,
// Zuschauer laufen zusammen, eigene Kamerafahrt mit Bauchbinden
// ------------------------------------------------------------------
const CERE = { on: false, built: false, t: 0, g: null, grp: null, top: [], crowd: [], conf: null, fov: 40, end: 27, said: {}, medals: [], trophy: null };
const CERE_SLOT = [[0, 1.05], [1.65, 0.75], [-1.65, 0.5]];   // Platz 1, 2, 3: Versatz quer, Höhe des Blocks
const _ceV = new THREE.Vector3(), _ceL = new THREE.Vector3();
function cereSpot() {
  const L = trail.L, b = trailPoint(L, 0, {}), tb = trail.yaw[trail.n - 1];
  const fx = Math.sin(tb), fz = Math.cos(tb), rx = Math.cos(tb), rz = -Math.sin(tb);
  let best = null, bs = 1e9;
  for (let d = 8; d <= 60; d += 4) for (const side of [1, -1]) for (const off of [6, 9, 12, 16]) {
    const lat = side * (TRAIL_HALF + off), x = b.x + fx * d + rx * lat, z = b.z + fz * d + rz * lat;
    const yaw = Math.atan2(-rx * side, -rz * side);   // Vorderseite zur Auslaufmitte
    const c = Math.cos(yaw), s = Math.sin(yaw); let lo = 1e9, hi = -1e9, bad = false;
    for (const [lx, lz] of [[-4, -2.5], [4, -2.5], [-4, 6], [4, 6], [0, 0], [0, 3]]) {
      const px = x + c * lx + s * lz, pz = z - s * lx + c * lz, h = hAt(px, pz);
      if (trailDistAt(px, pz) < TRAIL_HALF + 1.2) { bad = true; break; }
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    if (bad) continue;
    let occ = 0; for (const t of EV.taken) if (Math.hypot(t[0] - x, t[1] - z) < t[2] + 4.5) occ += 5;
    const sc = (hi - lo) * 3 + occ + d * 0.03;
    if (sc < bs) { bs = sc; best = { x, z, yaw, y: hi + 0.02 }; }
  }
  return best || { x: b.x + fx * 15 + rx * 9, z: b.z + fz * 15 + rz * 9, yaw: tb + Math.PI, y: hAt(b.x + fx * 15 + rx * 9, b.z + fz * 15 + rz * 9) };
}
function cereBuild() {
  const g = CERE.g = cereSpot(), grp = CERE.grp = new THREE.Group();
  grp.position.set(g.x, g.y, g.z); grp.rotation.y = g.yaw; scene.add(grp);
  const std = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const add = (geo, mat, x, y, z, sh = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = sh; o.receiveShadow = true; grp.add(o); return o; };
  // Bühne mit rotem Teppich
  add(new THREE.BoxGeometry(7.6, 0.25, 4.2), std(0x2a2c2e, 0.8), 0, -0.1, 0.2);
  for (const sx of [-3.6, 3.6]) for (const sz of [-1.7, 2.1]) add(new THREE.BoxGeometry(0.15, 2, 0.15), std(0x3a3c3e), sx, -1.1, sz, false);
  add(new THREE.BoxGeometry(1.6, 0.02, 6), std(0xa8141c, 0.95), 0, 0.035, 3.6, false);
  // Treppchen mit Zahlen
  const nums = ['1', '2', '3'];
  CERE_SLOT.forEach(([lx, h], i) => {
    add(new THREE.BoxGeometry(1.5, h, 1.2), std(0xf4f1ec, 0.45), lx, h / 2 + 0.03, 0.4);
    add(new THREE.BoxGeometry(1.52, 0.08, 1.22), std(i === 0 ? 0xd4a32a : i === 1 ? 0xb8bcc0 : 0xa0643a, 0.35, 0.6), lx, h + 0.05, 0.4);
    const tx = textTexture([[nums[i], `800 150px ${AD_FONT}`]], 256, 256, '#f4f1ec', '#1d1f1a');
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6 }));
    pl.position.set(lx, Math.max(0.38, h * 0.55), 1.005); grp.add(pl);
  });
  // Rückwand mit Titel und Sponsoren
  const wall = canvasTex(1024, 384, (x) => {
    const gr = x.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, '#173a26'); gr.addColorStop(1, '#0c2016'); x.fillStyle = gr; x.fillRect(0, 0, 1024, 384);
    x.fillStyle = 'rgba(255,255,255,0.08)'; x.beginPath(); x.moveTo(0, 384); for (const [u, v] of [[0.12, 0.62], [0.24, 0.48], [0.33, 0.58], [0.45, 0.3], [0.52, 0.42], [0.6, 0.26], [0.7, 0.5], [0.82, 0.4], [1, 0.66]]) x.lineTo(u * 1024, v * 384); x.lineTo(1024, 384); x.fill();
    x.fillStyle = '#f2c230'; x.fillRect(0, 300, 1024, 10);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffffff'; x.font = `800 96px ${AD_FONT}`; x.fillText('DOWNHILL KAMPENWAND', 512, 120);
    x.fillStyle = '#f2c230'; x.font = `700 46px ${AD_FONT}`; x.fillText('SIEGEREHRUNG · TALSTATION ASCHAU', 512, 215);
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.font = `600 30px ${AD_FONT}`; x.fillText('E-WERK PRIEN · WASSERWERK PRIEN · KAMPENWANDBAHN · CHIEMGAU', 512, 345);
  });
  const wm = new THREE.MeshStandardMaterial({ map: wall, roughness: 0.7 });
  add(new THREE.BoxGeometry(7.4, 2.8, 0.08), [std(0x1d1f1a), std(0x1d1f1a), std(0x1d1f1a), std(0x1d1f1a), wm, std(0x1d1f1a)], 0, 1.65, -1.2);
  for (const sx of [-3.7, 3.7]) add(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), std(0xcfd2d4, 0.35, 0.6), sx, 1.6, -1.25);
  // Fahnen in den Teamfarben
  TEAMS.slice(0, 4).forEach((tm, i) => {
    const sx = (i < 2 ? -1 : 1) * (4.3 + (i % 2) * 0.9);
    add(new THREE.CylinderGeometry(0.035, 0.035, 4.2, 6), std(0xcfd2d4, 0.35, 0.6), sx, 2.0, -0.6, false);
    const fl = add(new THREE.PlaneGeometry(0.75, 1.5), new THREE.MeshStandardMaterial({ color: tm.jersey, side: THREE.DoubleSide, roughness: 0.8 }), sx + 0.4, 3.3, -0.6, false);
    fl.userData.flag = true;
  });
  // Pokal und Medaillen
  const gold = std(0xd4a32a, 0.25, 0.85), silver = std(0xc8ccd0, 0.25, 0.85), bronze = std(0xa86a3a, 0.3, 0.8);
  const tro = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.LatheGeometry([[0.02, 0], [0.09, 0.01], [0.09, 0.03], [0.025, 0.05], [0.02, 0.16], [0.06, 0.19], [0.12, 0.26], [0.13, 0.36], [0.12, 0.37]].map(([a, b]) => new THREE.Vector2(a, b)), 20), gold);
  tro.add(cup); for (const s of [-1, 1]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), gold); hd.position.set(s * 0.13, 0.3, 0); hd.rotation.z = -s * Math.PI / 2; tro.add(hd); }
  tro.traverse((o) => { o.castShadow = true; }); tro.visible = false; scene.add(tro); CERE.trophy = tro;
  CERE.medals = [gold, silver, bronze].map((m) => {
    const md = new THREE.Group(); const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.008, 18).rotateX(Math.PI / 2), m); md.add(disc);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.004), std(0xd4141c, 0.8)); rib.position.y = 0.11; md.add(rib); md.visible = false; scene.add(md); return md;
  });
  // Konfetti
  const N = 700, cg = new THREE.PlaneGeometry(0.035, 0.055), cm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const im = new THREE.InstancedMesh(cg, cm, N); im.frustumCulled = false; im.count = 0;
  const cols = [0xf2c230, 0xe30613, 0x0a6fd8, 0xffffff, 0x2a9a4a, 0xf47a20], col = new THREE.Color();
  for (let i = 0; i < N; i++) im.setColorAt(i, col.setHex(cols[i % cols.length]));
  scene.add(im); CERE.conf = { im, N, p: new Float32Array(N * 3), v: new Float32Array(N * 3), r: new Float32Array(N * 2), n: 0, live: 0, M: new THREE.Matrix4(), Q: new THREE.Quaternion(), E: new THREE.Euler(), S: new THREE.Vector3(1, 1, 1), P: new THREE.Vector3() };
  CERE.built = true;
}
// lokaler Punkt am Podest -> Welt
function cereW(lx, ly, lz, out) { const g = CERE.g, c = Math.cos(g.yaw), s = Math.sin(g.yaw); return out.set(g.x + c * lx + s * lz, g.y + ly, g.z - s * lx + c * lz); }
function cereConfetti(n) {
  const C = CERE.conf; if (!C) return;
  for (let k = 0; k < n; k++) {
    const i = C.n % C.N; C.n++; const side = k % 2 ? 1 : -1;
    cereW(side * 3.2, 0.6, 0.6, _ceV); C.p.set([_ceV.x, _ceV.y, _ceV.z], i * 3);
    const g = CERE.g, c = Math.cos(g.yaw), s = Math.sin(g.yaw), ix = -side * (1.2 + Math.random() * 1.6), iz = 0.6 + Math.random() * 1.6;
    C.v.set([c * ix + s * iz + (Math.random() - 0.5), 6 + Math.random() * 4, -s * ix + c * iz + (Math.random() - 0.5)], i * 3);
    C.r[i * 2] = Math.random() * 6.28; C.r[i * 2 + 1] = 4 + Math.random() * 8;
  }
  C.live = Math.min(C.N, C.n);
}
function cereConfStep(dt) {
  const C = CERE.conf; if (!C || !C.live) return;
  for (let i = 0; i < C.live; i++) {
    const v = C.v, p = C.p, j = i * 3;
    v[j + 1] -= 4.5 * dt; const drag = Math.max(0, 1 - 2.2 * dt); v[j] *= drag; v[j + 2] *= drag; if (v[j + 1] < -0.9) v[j + 1] = -0.9 + Math.sin(C.r[i * 2] * 3) * 0.15;
    p[j] += (v[j] + Math.sin(C.r[i * 2] * 1.7) * 0.4) * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += (v[j + 2] + Math.cos(C.r[i * 2] * 1.3) * 0.4) * dt;
    const gy = hAt(p[j], p[j + 2]) + 0.02; if (p[j + 1] < gy) { p[j + 1] = gy; v[j] = v[j + 1] = v[j + 2] = 0; }
    else C.r[i * 2] += C.r[i * 2 + 1] * dt;
    C.E.set(C.r[i * 2], C.r[i * 2] * 0.7, C.r[i * 2] * 1.3); C.Q.setFromEuler(C.E); C.M.compose(C.P.set(p[j], p[j + 1], p[j + 2]), C.Q, C.S); C.im.setMatrixAt(i, C.M);
  }
  C.im.count = C.live; C.im.instanceMatrix.needsUpdate = true;
}
function cereSay(text) { MUS.duckT = 3; announce(text); }
function cereStart() {
  try { if (!CERE.built) cereBuild(); } catch (e) { kwReport(e); return; }
  const rk = ranking().slice(0, 3);
  CERE.on = true; CERE.t = 0; CERE.said = {}; CERE.top = []; CERE.crowd = [];
  $('results').hidden = true; document.body.classList.add('replaying'); $('cereUI').hidden = false; $('cereLow').classList.remove('show');
  // Platz für das Podest frei machen
  for (let i = life.people.length - 1; i >= 0; i--) { const p = life.people[i]; if (Math.hypot(p.x - CERE.g.x, p.z - CERE.g.z) < 7 && !p.ev) { if (p.real) realRelease(p.real); life.people.splice(i, 1); } }
  const winT = rk[0] ? (rk[0].isPlayer ? rk[0].finishT : rk[0].ai.finishT) : 0;
  rk.forEach((r, i) => {
    const team = TEAMS.find((tm) => tm.jersey === r.cfg.jersey) || TEAMS[i % TEAMS.length];
    const [lx, h] = CERE_SLOT[i];
    cereW(lx + (lx >= 0 ? 4.5 : -4.5), 0, 3.2, _ceV);
    const p = addPerson(Math.random, 'walk', _ceV.x, _ceV.z, 0, { react: false, look: false, backpack: false, scarf: false, glasses: false, top: team.jersey, pants: team.pants, hat: 'cap', hatCol: team.accent, kid: false });
    p.noReal = false; p.ev = true; p.y = hAt(p.x, p.z);
    const fin = r.isPlayer ? r.finished : r.ai.finished, ft = r.isPlayer ? r.finishT : r.ai.finishT;
    CERE.top.push({ p, r, i, lx, h, team, call: [17.2, 9.6, 4.2][i], up: false, time: fin ? (i === 0 ? fmtTime(ft) : `+${(ft - winT).toFixed(2).replace('.', ',')} s`) : '' });
  });
  // Zuschauer laufen vor dem Podest zusammen
  for (let k = 0; k < 26; k++) {
    const a = (k / 26 - 0.5) * 1.6, rad = 8.5 + (k % 3) * 1.2 + Math.random() * 0.8;
    const tx = Math.sin(a) * rad, tz = 1 + Math.cos(a) * rad;
    cereW(tx * 1.25, 0, tz + 3 + Math.random() * 4, _ceV); const sx = _ceV.x, sz = _ceV.z; cereW(tx, 0, tz, _ceL);
    const pose = ['cheer', 'clap', 'clap', 'phone', 'film', 'cheer', 'cowbell'][k % 7];
    const p = addPerson(Math.random, 'walk', sx, sz, Math.atan2(_ceL.x - sx, _ceL.z - sz), { react: true, look: true, kid: Math.random() < 0.12 });
    p.noReal = false; p.ev = true; p.y = hAt(sx, sz);
    CERE.crowd.push({ p, tx: _ceL.x, tz: _ceL.z, pose, delay: Math.random() * 1.2, spd: 1.3 + Math.random() * 0.6 });
  }
  cereSay('Meine Damen und Herren, wir kommen zur Siegerehrung der Downhill Kampenwand!');
}
function cereEnd() {
  if (!CERE.on) return;
  CERE.on = false; window.__camOverride = null; camInit = false;
  document.body.classList.remove('replaying'); $('cereUI').hidden = true;
  for (const e of [...CERE.top.map((x) => x.p), ...CERE.crowd.map((x) => x.p)]) { const i = life.people.indexOf(e); if (i >= 0) life.people.splice(i, 1); if (e.real) realRelease(e.real); }
  CERE.top = []; CERE.crowd = []; for (const m of CERE.medals) m.visible = false; if (CERE.trophy) CERE.trophy.visible = false;
  if (CERE.conf) { CERE.conf.live = 0; CERE.conf.n = 0; CERE.conf.im.count = 0; }
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* egal */ }
  showResults(); $('results').hidden = false;
}
function cereLower(place, name, team, time) {
  $('cereLowP').textContent = place; $('cereLowN').textContent = name; $('cereLowT').textContent = team + (time ? ' · ' + time : '');
  const l = $('cereLow'); l.classList.remove('show'); void l.offsetWidth; l.classList.add('show');
}
function cereStep(dt) {
  if (!CERE.on) return;
  const T = CERE.t += dt, g = CERE.g;
  // Fahnen flattern
  CERE.grp.children.forEach((o, k) => { if (o.userData.flag) o.rotation.y = Math.sin(T * 3 + k) * 0.25; });
  // Fahrer aufrufen: gehen zum Treppchen und steigen hinauf
  for (const m of CERE.top) {
    const p = m.p;
    if (T < m.call) { cereW(m.lx + (m.lx >= 0 ? 4.5 : -4.5), 0, 3.2, _ceV); p.x = _ceV.x; p.z = _ceV.z; p.y = hAt(p.x, p.z) - 3; p.pose = 'stand'; continue; }
    if (!CERE.said[m.i]) {
      CERE.said[m.i] = true;
      const pl = ['Platz eins', 'Platz zwei', 'Platz drei'][m.i];
      cereLower(`${m.i + 1}. PLATZ`, m.r.cfg.name, m.r.cfg.team || m.team.team, m.time);
      cereSay(m.i === 0 ? `Und der Sieger der Downhill Kampenwand: ${m.r.cfg.name}, ${m.team.team}!` : `${pl}: ${m.r.cfg.name}, ${m.team.team}!`);
      if (audio.ctx) { cereW(0, 0, 6, _ceV); sfx('horn', _ceV, 10); sfx('clap', _ceV, 6); if (m.i === 0) { setTimeout(() => sfx('horn', _ceV, 8), 500); setTimeout(() => sfx('clap', _ceV, 5), 900); } }
    }
    const k = T - m.call;
    cereW(m.lx + (m.lx >= 0 ? 4.5 : -4.5), 0, 3.2, _ceV); const sx = _ceV.x, sz = _ceV.z;
    cereW(m.lx, 0, 1.9, _ceL); const fx = _ceL.x, fz = _ceL.z;
    if (k < 2.2) { const e = k / 2.2; p.x = lerp(sx, fx, e); p.z = lerp(sz, fz, e); p.y = hAt(p.x, p.z); p.pose = 'walk'; p.yaw = Math.atan2(fx - sx, fz - sz); }
    else if (k < 2.8) { const e = (k - 2.2) / 0.6; cereW(m.lx, 0, lerp(1.9, 0.45, e), _ceV); p.x = _ceV.x; p.z = _ceV.z; p.y = g.y + 0.08 + m.h * Math.min(1, e * 1.3) + Math.sin(e * Math.PI) * 0.15; p.pose = 'walk'; p.yaw = g.yaw + Math.PI; }
    else {
      cereW(m.lx, 0, 0.45, _ceV); p.x = _ceV.x; p.z = _ceV.z; p.y = g.y + 0.09 + m.h;
      p.yaw = g.yaw; p.pose = m.i === 0 ? 'cheer' : (k < 5 ? 'cheer' : 'clap'); p.e = 1;
      if (!m.up) { m.up = true; if (m.i === 0) { cereConfetti(500); p.trophy = true; } }
    }
    // Medaille vor der Brust
    const md = CERE.medals[m.i]; md.visible = k > 2.8; if (md.visible) { const sc = p.h.scale || 1, c = Math.cos(p.yaw), s = Math.sin(p.yaw); md.position.set(p.x + s * 0.14 * sc, p.y + 1.24 * sc, p.z + c * 0.14 * sc); md.rotation.y = p.yaw; }
    if (m.i === 0 && CERE.trophy) { CERE.trophy.visible = !!p.trophy; if (p.trophy) { const sc = p.h.scale || 1, c = Math.cos(p.yaw), s = Math.sin(p.yaw); CERE.trophy.position.set(p.x + s * 0.12 * sc, p.y + (1.92 + Math.sin(T * 4) * 0.04) * sc, p.z + c * 0.12 * sc); CERE.trophy.rotation.y = p.yaw; } }
  }
  if (T > 20 && T < 20.1) cereConfetti(200);
  cereConfStep(dt);
  // Zuschauer
  for (const m of CERE.crowd) {
    const p = m.p; m.delay -= dt; if (m.delay > 0) continue;
    const dx = m.tx - p.x, dz = m.tz - p.z, d = Math.hypot(dx, dz);
    if (d > 0.15) { const st = Math.min(d, m.spd * dt); p.x += dx / d * st; p.z += dz / d * st; p.y = hAt(p.x, p.z); p.pose = 'walk'; p.yaw += wrapAngle(Math.atan2(dx, dz) - p.yaw) * Math.min(1, dt * 6); }
    else { p.pose = m.pose; p.e = 0.7 + Math.sin(T * 2 + p.ph) * 0.3; p.yaw += wrapAngle(Math.atan2(g.x - p.x, g.z - p.z) - p.yaw) * Math.min(1, dt * 3); }
  }
  // Kamera: Totale, dann je Platz eine nahe Einstellung, zum Schluss Kranfahrt mit Konfetti
  const look = _ceL, pos = _ceV; let fov = 42;
  const focus = (i, dist, h, side) => { const m = CERE.top.find((q) => q.i === i); if (!m) return false; const p = m.p, sc = p.h.scale || 1; cereW(m.lx + side, 0, dist, pos); pos.y = p.y + h; look.set(p.x, p.y + 1.45 * sc, p.z); return true; };
  if (T < 4.2) { const a = -0.9 + T * 0.16; cereW(Math.sin(a) * 15, 0, Math.cos(a) * 15 + 1, pos); pos.y = g.y + 5 - T * 0.4; cereW(0, 1.6, 0, look); fov = 46; }
  else if (T < 9.6) { if (!focus(2, 4.2 - (T - 4.2) * 0.12, 1.5, -1.6)) cereW(0, 1.6, 0, look); fov = 36; }
  else if (T < 17.2) { if (!focus(1, 4.4 - (T - 9.6) * 0.1, 1.6, 1.8)) cereW(0, 1.6, 0, look); fov = 36; }
  else if (T < 22.5) { if (!focus(0, 5.2 - (T - 17.2) * 0.25, 0.6, 0.6)) cereW(0, 1.6, 0, look); fov = 40; }
  else { const e = Math.min(1, (T - 22.5) / 4.5), s = e * e * (3 - 2 * e); cereW(Math.sin(0.4 - s * 0.7) * lerp(6, 19, s), 0, Math.cos(0.4 - s * 0.7) * lerp(6, 19, s) + 1, pos); pos.y = g.y + lerp(2.2, 8, s); cereW(0, 1.7, 0, look); fov = lerp(44, 50, s); }
  pos.y = Math.max(pos.y, groundAt(pos.x, pos.z) + 0.9);
  window.__camOverride = { pos: [pos.x, pos.y, pos.z], look: [look.x, look.y, look.z] }; CERE.fov = fov;
  if (T > CERE.end) cereEnd();
}
