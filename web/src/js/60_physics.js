
// ------------------------------------------------------------------
// Fahrer: Zustand und Physik
// ------------------------------------------------------------------
const RIDERS_CFG = [
  { name: 'Du', jersey: 0xe8462b, accent: 0xf4efe6, pants: 0x1d1f1a, helmet: 0xf4efe6, frame: 0x1d1f1a, num: 1, player: true },
  { name: 'Sepp Huber', jersey: 0x2f6a3a, accent: 0xe2a33a, pants: 0x233024, helmet: 0x2f6a3a, frame: 0xd8d2c4, num: 7, skill: 0.97 },
  { name: 'Vroni Maier', jersey: 0x2a5a9a, accent: 0xf4efe6, pants: 0x1a2436, helmet: 0xe2a33a, frame: 0x2a5a9a, num: 12, skill: 0.95 },
  { name: 'Toni Gruber', jersey: 0xe2a33a, accent: 0x1d1f1a, pants: 0x3a2a1a, helmet: 0x1d1f1a, frame: 0xe2a33a, num: 23, skill: 0.92 },
  { name: 'Resi Brandl', jersey: 0x7a3a8a, accent: 0x7fc46a, pants: 0x221a26, helmet: 0xf4efe6, frame: 0x7a3a8a, num: 31, skill: 0.9 },
  { name: 'Maxl Steiner', jersey: 0xdedede, accent: 0xc7392a, pants: 0x444444, helmet: 0xc7392a, frame: 0x444444, num: 44, skill: 0.87 },
];
let riders = [];
let player;
let requestReset = false;
let camMode = 0;
const race = { state: 'menu', t: 0, countdown: 0, finishOrder: [], best: null };
try { const b = localStorage.getItem('kw_best'); if (b) race.best = parseFloat(b); } catch (e) { /* kein Speicher */ }

function makePlayerState(s, lat) {
  const pt = trailPoint(s, lat, {});
  return { pos: new THREE.Vector3(pt.x, hAt(pt.x, pt.z), pt.z), vel: new THREE.Vector3(), yaw: pt.yaw, yawRate: 0, air: false, airT: 0, lean: 0, pitchUp: new THREE.Vector3(0, 1, 0), crashT: 0, idx: trailIdx(s), s, offT: 0, boost: 0.35, hopCd: 0, slip: 0, finished: false, finishT: 0, wheelRot: 0, crankA: 0, comp: 0, steerVis: 0, sc: null };
}
const _f = new THREE.Vector3(), _side = new THREE.Vector3(), _g = new THREE.Vector3(), _tmp = new THREE.Vector3(), _n2 = new THREE.Vector3();
function stepPlayer(P, dt, inp) {
  if (P.crashT > 0) {
    P.crashT -= dt;
    P.vel.multiplyScalar(Math.exp(-3 * dt)); P.pos.addScaledVector(P.vel, dt); P.pos.y = hAt(P.pos.x, P.pos.z);
    if (P.crashT <= 0) respawn(P);
    return;
  }
  if (P.finished) { inp = { steer: 0, pedal: 0, brake: 0.7, hop: false, boost: false }; }
  P.hopCd -= dt;
  const td = trailDistAt(P.pos.x, P.pos.z), sd = scDistAt(P.pos.x, P.pos.z);
  const onTrail = td < TRAIL_HALF + 0.4, onSc = !onTrail && sd < SC_HALF + 0.35;
  // Abkürzung: loser Waldboden, wenig Grip; daneben Gras bzw. Waldboden
  const mu = onTrail ? 1.0 : onSc ? 0.78 : 0.8;
  const roll = onTrail ? 0.012 : onSc ? 0.03 : 0.05 + (td > 8 && sd > 4 ? 0.03 : 0);
  if (!P.air) {
    const n = normalAt(P.pos.x, P.pos.z, _n2);
    _f.set(Math.sin(P.yaw), 0, Math.cos(P.yaw)); _f.addScaledVector(n, -_f.dot(n)).normalize();
    _side.crossVectors(n, _f).normalize();         // zeigt nach links
    _g.set(0, -GRAV, 0); _g.addScaledVector(n, GRAV * n.y);
    let vF = P.vel.dot(_f), vS = P.vel.dot(_side);
    let aF = _g.dot(_f);
    if (inp.pedal > 0 && vF < 13) aF += 3.2 * inp.pedal * (1 - Math.max(0, vF) / 13);
    if (inp.boost && P.boost > 0) { aF += 5; P.boost = Math.max(0, P.boost - dt * 0.28); }
    if (inp.brake > 0) aF -= Math.sign(vF) * Math.min(7.5 * mu * inp.brake, Math.abs(vF) / dt);
    aF -= Math.sign(vF) * roll * GRAV * n.y;
    aF -= 0.005 * vF * Math.abs(vF);
    vF += aF * dt;
    if (vF < -1.5) vF = -1.5;
    // Seitenhaftung
    vS += _g.dot(_side) * dt;
    const grip = mu * GRAV * n.y * 1.6 * dt;
    P.slip = Math.max(0, Math.abs(vS) - 0.4);
    vS = Math.abs(vS) <= grip ? 0 : vS - Math.sign(vS) * grip;
    // Lenken: begrenzt durch Haftung
    const sp = Math.abs(vF);
    const maxYaw = Math.min(2.6, (mu * GRAV * 1.15) / Math.max(sp, 1.2)) * (inp.brake > 0 ? 1.12 : 1);
    P.yawRate = -inp.steer * maxYaw * (sp < 0.3 ? 0.3 : 1);
    P.yaw = wrapAngle(P.yaw + P.yawRate * dt);
    P.vel.copy(_f).multiplyScalar(vF).addScaledVector(_side, vS);
    if (inp.hop && P.hopCd <= 0) { P.vel.addScaledVector(n, 4.2); P.air = true; P.airT = 0; P.hopCd = 0.6; P.comp = 0.6; }
    if (inp.pedal > 0 && sp < 14) P.crankA += dt * (4 + sp * 0.5);
    else P.crankA = damp(P.crankA, Math.round(P.crankA / Math.PI) * Math.PI, 5, dt);
    P.pos.addScaledVector(P.vel, dt);
    if (!P.air) {
      // Kuppe/Kicker: fällt der Boden schneller weg, als die Schwerkraft zieht, hebt das Rad ab
      const n2 = normalAt(P.pos.x, P.pos.z, _tmp);
      const vn = P.vel.dot(n2);
      if (vn > GRAV * n2.y * dt + 0.45 && sp > 5) { P.air = true; P.airT = 0; }
      else { P.pos.y = hAt(P.pos.x, P.pos.z); P.vel.addScaledVector(n2, -vn); P.comp = Math.min(1, P.comp + Math.max(0, -vn) * 0.12); }
    }
    if (P.slip > 1.5 || (inp.brake > 0 && sp > 4)) {
      const k = Math.min(1, P.slip * 0.2 + (inp.brake > 0 ? 0.4 : 0)) * (onTrail ? 1 : 0.4);
      if (Math.random() < k) emitDust(P.pos.x - _f.x * 0.6, P.pos.y + 0.15, P.pos.z - _f.z * 0.6, -P.vel.x * 0.2 + (Math.random() - 0.5), 0.6 + Math.random(), -P.vel.z * 0.2 + (Math.random() - 0.5), 0.5 + Math.random() * 0.5);
    }
    P.pitchUp.lerp(n, 1 - Math.exp(-12 * dt));
  } else {
    P.airT += dt;
    P.vel.y -= GRAV * dt;
    P.vel.multiplyScalar(1 - 0.0015 * P.vel.length() * dt);
    if (inp.boost && P.boost > 0) { /* in der Luft kein Boost */ }
    P.yawRate = -inp.steer * 1.6;
    P.yaw = wrapAngle(P.yaw + P.yawRate * dt);
    P.pos.addScaledVector(P.vel, dt);
    const h = hAt(P.pos.x, P.pos.z);
    if (P.pos.y <= h) {
      const n = normalAt(P.pos.x, P.pos.z, _n2);
      const vn = P.vel.dot(n);
      P.vel.addScaledVector(n, -vn);
      P.pos.y = h; P.air = false;
      const horiz = Math.hypot(P.vel.x, P.vel.z);
      const misalign = horiz > 4 ? Math.abs(wrapAngle(Math.atan2(P.vel.x, P.vel.z) - P.yaw)) : 0;
      if (-vn > 10.5 || misalign > 1.1) { crash(P, -vn > 10.5 ? 'Zu hart gelandet!' : 'Quer gelandet!'); return; }
      P.vel.multiplyScalar(1 - clamp(-vn * 0.02, 0, 0.25));
      P.comp = Math.min(1, -vn * 0.14);
      if (P.airT > 0.45) { P.boost = Math.min(1, P.boost + P.airT * 0.22); if (P.isPlayer) flash(`Airtime ${P.airT.toFixed(1)} s`, '', 1.2, true); }
      if (P.isPlayer) thump(-vn * 0.06);
      for (let i = 0; i < 8; i++) emitDust(P.pos.x, P.pos.y + 0.1, P.pos.z, (Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 3, 1.4);
    }
    // Nase folgt der Flugbahn
    _tmp.copy(P.vel).normalize();
    _f.set(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    const pitch = Math.asin(clamp(_tmp.y, -0.8, 0.8));
    _n2.set(0, Math.cos(pitch), 0).addScaledVector(_f, -Math.sin(pitch));
    P.pitchUp.lerp(_n2, 1 - Math.exp(-4 * dt));
  }
  // Hindernisse
  const hit = hitObstacle(P.pos.x, P.pos.z, 0.35);
  if (hit) {
    const sp = P.vel.length();
    if (sp > 7) { crash(P, hit[2] > 0.55 ? 'Gegen den Felsen!' : 'Baum erwischt!'); return; }
    const dx = P.pos.x - hit[0], dz = P.pos.z - hit[1], l = Math.hypot(dx, dz) || 1;
    P.pos.x = hit[0] + dx / l * (hit[2] + 0.36); P.pos.z = hit[1] + dz / l * (hit[2] + 0.36);
    P.vel.multiplyScalar(0.3);
  }
  // Rand der Karte
  if (Math.abs(P.pos.x) > HALF - 10 || Math.abs(P.pos.z) > HALF - 10) { crash(P, 'Außerhalb der Karte'); return; }
  // Fortschritt entlang der Strecke
  let best = 1e18, bi = P.idx;
  for (let k = Math.max(0, P.idx - 15); k < Math.min(trail.n, P.idx + 60); k++) { const d = (P.pos.x - trail.x[k]) ** 2 + (P.pos.z - trail.z[k]) ** 2; if (d < best) { best = d; bi = k; } }
  P.trailDist = Math.sqrt(best);
  // auf einer Abkürzung zählt der Fortschritt anteilig zwischen Ein- und Ausstieg
  const ns = P.trailDist > TRAIL_HALF + 1 ? nearestShortcut(P.pos.x, P.pos.z, 6) : null;
  if (ns) {
    const sMapped = ns.sc.sA + (ns.i / (ns.sc.n - 1)) * (ns.sc.sB - ns.sc.sA);
    if (!P.sc && P.isPlayer && ns.i < 15) flash('Abkürzung!', 'steil, eng und rutschig', 1.2, true);
    P.sc = ns.sc; P.idx = trailIdx(Math.max(P.s, sMapped)); P.trailDist = Math.min(P.trailDist, ns.d);
  } else { P.sc = null; P.idx = bi; }
  P.s = P.idx * TRAIL_STEP;
  P.onTrail = onTrail || onSc;
  P.comp = damp(P.comp, 0, 6, dt);
  P.steerVis = damp(P.steerVis, inp.steer, 10, dt);
  if (P.trailDist > 40) { P.offT += dt; if (P.offT > 2.5) { P.offT = 0; respawn(P); if (P.isPlayer) flash('Zurück auf der Strecke', '', 1.2, true); } }
  else P.offT = 0;
  // Schräglage
  const sp = Math.hypot(P.vel.x, P.vel.z);
  P.lean = damp(P.lean, clamp(Math.atan2(-P.yawRate * sp, GRAV), -0.75, 0.75), 8, dt);
  P.wheelRot += sp * dt / WHEEL_R;
}
function crash(P, why) {
  P.crashT = 1.8; P.air = false; P.vel.multiplyScalar(0.4); P.crashWhy = why;
  if (P.isPlayer) { flash('Sturz!', why, 1.6); thump(0.6); }
}
function respawn(P) {
  const k = clamp(P.idx - 2, 0, trail.n - 2);
  const pt = trailPoint(k * TRAIL_STEP, 0, {});
  P.pos.set(pt.x, hAt(pt.x, pt.z), pt.z); P.vel.set(0, 0, 0); P.yaw = pt.yaw; P.air = false; P.crashT = 0; P.lean = 0; P.pitchUp.set(0, 1, 0); P.idx = k;
}

// ------------------------------------------------------------------
// KI-Fahrer: folgen der Ideallinie mit Kurvengeschwindigkeit
// ------------------------------------------------------------------
function makeAI(cfg, s, lat) {
  const pt = trailPoint(s, lat, {});
  return { cfg, s, v: 0, lat, latT: lat, latTimer: 0, y: hAt(pt.x, pt.z), vy: 0, air: false, airT: 0, yaw: pt.yaw, x: pt.x, z: pt.z, lean: 0, wheelRot: 0, finished: false, finishT: 0, skill: cfg.skill, mistakeT: 0, prevYaw: pt.yaw };
}
const _pt = {};
function stepAI(A, dt, playerS) {
  if (A.finished) { A.v = Math.max(0, A.v - 6 * dt); }
  const k = trailIdx(A.s);
  const dy = (trail.y[Math.min(trail.n - 1, k + 2)] - trail.y[Math.max(0, k - 2)]) / (4 * TRAIL_STEP);
  const sinT = dy / Math.sqrt(1 + dy * dy);
  let a = -GRAV * sinT - 0.012 * GRAV - 0.005 * A.v * A.v;
  if (A.v < 12.5) a += 2.8 * A.skill;
  // Kurven vorausschauen
  let vAllow = 99;
  const brakeDec = 6.5 * A.skill;
  for (let o = 1; o < 30; o++) {
    const kk = Math.min(trail.n - 1, k + o * 2);
    const c = Math.abs(trail.curv[kk]) + 1e-4;
    const vc = Math.sqrt(GRAV * 1.02 * A.skill / c);
    const dist = o * 2 * TRAIL_STEP;
    vAllow = Math.min(vAllow, Math.sqrt(vc * vc + 2 * brakeDec * dist));
  }
  // Gummiband: knapp am Spieler bleiben
  const gap = A.s - playerS;
  const band = gap > 40 ? Math.max(0.8, 1 - (gap - 40) * 0.0016) : gap < -80 ? Math.min(1.08, 1 + (-gap - 80) * 0.0008) : 1;
  vAllow = Math.min(vAllow, 23.5 * A.skill) * band * (0.97 + 0.04 * A.skill);
  if (A.mistakeT > 0) { A.mistakeT -= dt; vAllow = Math.min(vAllow, 6); }
  else if (Math.random() < dt * 0.012 * (1.05 - A.skill) * 10) A.mistakeT = 0.8 + Math.random();
  A.braking = A.v > vAllow;
  if (A.v > vAllow) a = Math.min(a, -brakeDec);
  if (!A.finished && race.state === 'race') A.v = Math.max(0.5, A.v + a * dt); else if (race.state !== 'race') A.v = 0;
  A.prevS = A.s; A.s = Math.min(trail.L, A.s + A.v * dt);
  // seitliche Linie
  A.latTimer -= dt;
  if (A.latTimer <= 0) { A.latTimer = 1 + Math.random() * 2; A.latT = (Math.random() - 0.5) * 2.4; }
  const kk = trailIdx(A.s + 10);
  const inside = clamp(trail.curv[kk] * 40, -1.4, 1.4);
  A.lat = damp(A.lat, clamp(A.latT + inside, -TRAIL_HALF + 0.6, TRAIL_HALF - 0.6), 1.5, dt);
  trailPoint(A.s, A.lat, _pt);
  const prevYaw = A.yaw;
  A.x = _pt.x; A.z = _pt.z; A.yaw = _pt.yaw;
  const yawRate = wrapAngle(A.yaw - prevYaw) / Math.max(dt, 1e-4);
  const h = hAt(A.x, A.z);
  // Sprünge: einfache Ballistik
  if (A.air) {
    A.vy -= GRAV * dt; A.y += A.vy * dt; A.airT += dt;
    if (A.y <= h) { A.y = h; A.air = false; A.comp = 0.7; }
  } else {
    A.y = h;
    for (const sk of trail.kickers) if (A.prevS < sk && A.s >= sk && A.v > 6) {
      const kb = trailIdx(sk - 3), ka = trailIdx(sk - 1);
      A.air = true; A.airT = 0; A.vy = A.v * (trail.y[ka] - trail.y[kb]) / ((ka - kb) * TRAIL_STEP); A.y += A.vy * dt;
    }
  }
  A.lean = damp(A.lean, clamp(Math.atan2(-yawRate * A.v, GRAV), -0.7, 0.7), 6, dt);
  A.wheelRot += A.v * dt / WHEEL_R;
  A.crankA = A.v < 11 && !A.air ? (A.crankA || 0) + dt * (4 + A.v * 0.5) : damp(A.crankA || 0, Math.round((A.crankA || 0) / Math.PI) * Math.PI, 5, dt);
  A.comp = damp(A.comp || 0, 0, 6, dt); A.steerVis = damp(A.steerVis || 0, clamp(-yawRate * 0.8, -1, 1), 8, dt);
}

// ------------------------------------------------------------------
// Modelle der Fahrer positionieren
// ------------------------------------------------------------------
const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _q = new THREE.Quaternion();
function poseModel(model, x, y, z, yaw, up, lean, st, crashT) {
  _z.set(Math.sin(yaw), 0, Math.cos(yaw));
  _y.copy(up).normalize();
  _z.addScaledVector(_y, -_z.dot(_y)).normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  model.position.set(x, y, z);
  model.quaternion.setFromRotationMatrix(_m);
  const u = model.userData;
  u.tilt.rotation.z = crashT > 0 ? lerp(0, 1.45, clamp((1.8 - crashT) * 3, 0, 1)) : lean;
  poseRider(model, st);
}
