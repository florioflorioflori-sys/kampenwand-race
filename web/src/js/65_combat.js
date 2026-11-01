// ------------------------------------------------------------------
// Zweikampf wie bei Downhill Domination: Schläge links/rechts und Tritte.
// Getroffene Fahrer wackeln, verlieren Tempo und stürzen manchmal.
// ------------------------------------------------------------------
const ATK = {
  punchL: { side: 1, dur: 0.42, hitAt: 0.17, reach: 1.9, power: 1, arm: true },
  punchR: { side: -1, dur: 0.42, hitAt: 0.17, reach: 1.9, power: 1, arm: true },
  kickL: { side: 1, dur: 0.6, hitAt: 0.25, reach: 2.1, power: 1.45, arm: false },
  kickR: { side: -1, dur: 0.6, hitAt: 0.25, reach: 2.1, power: 1.45, arm: false },
};
const combatPress = { punchL: false, punchR: false, kick: false };
// Lage eines Fahrers in der Welt
function riderFrame(r, out) {
  if (r.isPlayer) { out.x = r.pos.x; out.y = r.pos.y; out.z = r.pos.z; out.yaw = r.yaw; out.down = r.crashT > 0; out.s = r.s; }
  else { const A = r.ai; out.x = A.x; out.y = A.y; out.z = A.z; out.yaw = A.yaw; out.down = (A.crashT || 0) > 0; out.s = A.s; }
  return out;
}
const _fa = {}, _fb = {};
// relative Lage von o aus Sicht von r: lat > 0 links, lon > 0 vorne
function relTo(r, o) {
  riderFrame(r, _fa); riderFrame(o, _fb);
  const dx = _fb.x - _fa.x, dz = _fb.z - _fa.z;
  return { lat: dx * Math.cos(_fa.yaw) - dz * Math.sin(_fa.yaw), lon: dx * Math.sin(_fa.yaw) + dz * Math.cos(_fa.yaw), dy: _fb.y - _fa.y, d: Math.hypot(dx, dz) };
}
function nearestFoe(r) {
  let best = null, bd = 3.5;
  for (const o of riders) { if (o === r) continue; const q = relTo(r, o); if (q.d < bd && Math.abs(q.lon) < 1.6) { bd = q.d; best = { o, q }; } }
  return best;
}
function startAttack(r, type) {
  if (r.atk || (r.atkCd || 0) > 0 || race.state !== 'race') return;
  if (r.isPlayer ? r.crashT > 0 : (r.ai.crashT || 0) > 0) return;
  r.atk = { type, t: 0, done: false }; r.atkCd = 0.75;
  if (r.isPlayer || r.model.position.distanceTo(camera.position) < 40) sfx('whoosh', r.model.position);
}
function applyHit(v, a, def) {
  riderFrame(a, _fa);
  const lx = Math.cos(_fa.yaw) * def.side, lz = -Math.sin(_fa.yaw) * def.side; // Stoßrichtung
  v.hitT = 1; v.hitSide = def.side; v.hitPow = def.power;
  const nearCam = v.model.position.distanceTo(camera.position) < 60;
  if (nearCam) thump(0.35 * def.power);
  if (v.isPlayer) {
    v.vel.multiplyScalar(0.84); v.vel.x += lx * 1.4 * def.power; v.vel.z += lz * 1.4 * def.power;
    camShake.k = Math.max(camShake.k, 0.8 * def.power);
    if (Math.random() < 0.12 * def.power) crash(v, a.cfg.rider + ' hat dich abgeräumt');
    else flash(def.arm ? 'Autsch!' : 'Tritt!', a.cfg.rider + ' · ' + a.cfg.short, 1, true);
  } else {
    const A = v.ai;
    A.v *= 0.74;
    trailPoint(A.s, 0, _pt);
    A.lat = clamp(A.lat + (lx * Math.cos(_pt.yaw) - lz * Math.sin(_pt.yaw)) * 0.8 * def.power, -TRAIL_HALF + 0.4, TRAIL_HALF - 0.4);
    if (Math.random() < 0.28 * def.power) A.crashT = 1.7;
    if (a.isPlayer) { flash(A.crashT > 0 ? 'Abgeräumt!' : 'Treffer!', v.cfg.rider, 0.9, true); a.boost = Math.min(1, a.boost + 0.08); }
  }
  // die Leute an der Strecke reagieren
  if (nearCam && typeof cheerShout === 'function') cheerShout(['Foul!', 'Uiii!', 'Au weh!', 'Des war a Foul!', 'Hau eam oane!'][Math.floor(Math.random() * 5)]);
}
function stepCombat(dt) {
  // Spieler-Eingaben (Tastendruck, nicht Halten)
  if (player) {
    if (input.punchL && !combatPress.punchL) startAttack(player, 'punchL');
    if (input.punchR && !combatPress.punchR) startAttack(player, 'punchR');
    if (input.kick && !combatPress.kick) { const f = nearestFoe(player); startAttack(player, f && f.q.lat < 0 ? 'kickR' : 'kickL'); }
    combatPress.punchL = input.punchL; combatPress.punchR = input.punchR; combatPress.kick = input.kick;
  }
  for (const r of riders) {
    r.atkCd = Math.max(0, (r.atkCd || 0) - dt);
    r.hitT = Math.max(0, (r.hitT || 0) - dt * 1.8);
    // Gegner greifen an, wenn jemand neben ihnen fährt
    if (!r.isPlayer && !r.atk && race.state === 'race' && !r.ai.finished) {
      const f = nearestFoe(r);
      if (f && f.q.d < 1.8 && Math.abs(f.q.lat) > 0.4 && Math.random() < dt * (f.o.isPlayer ? 0.7 : 0.25) * (0.6 + r.cfg.skill * 0.6)) {
        const left = f.q.lat > 0;
        startAttack(r, Math.random() < 0.4 ? (left ? 'kickL' : 'kickR') : (left ? 'punchL' : 'punchR'));
      }
    }
    if (!r.atk) continue;
    const a = r.atk, def = ATK[a.type];
    a.t += dt;
    if (!a.done && a.t >= def.hitAt) {
      a.done = true;
      let best = null, bd = def.reach;
      for (const o of riders) {
        if (o === r) continue;
        const q = relTo(r, o);
        if (q.d < bd && Math.sign(q.lat) === def.side && Math.abs(q.lat) > 0.3 && Math.abs(q.lon) < 1.3 && Math.abs(q.dy) < 1.2 && !_fb.down) { bd = q.d; best = o; }
      }
      if (best) applyHit(best, r, def);
    }
    if (a.t >= def.dur) r.atk = null;
  }
}
// Pose-Zusatz für Angriff und Treffer (im Rad-System, +x = links)
function combatPose(st) {
  if (st.atk) {
    const def = ATK[st.atk.type], f = Math.sin(Math.PI * clamp(st.atk.t / def.dur, 0, 1)), sd = def.side;
    const k = sd > 0 ? 'L' : 'R';
    if (def.arm) {
      // Arm vom Lenker weg zur Seite schwingen, Oberkörper dreht mit
      RP['g' + k].lerp(_cbV.set(sd * 0.85, RP.chest.y - 0.02, RP.chest.z + 0.25), f);
      for (const n of ['chest', 'neck', 'head', 'shL', 'shR']) RP[n].x += sd * 0.1 * f;
    } else {
      // Bein vom Pedal zur Seite treten, Hüfte kippt zur Gegenseite
      RP['p' + k].lerp(_cbV.set(sd * 0.85, 0.62, 0.15), f);
      for (const n of ['hip', 'hpL', 'hpR', 'chest', 'neck', 'head', 'shL', 'shR']) RP[n].x -= sd * 0.08 * f;
    }
  }
  if (st.hit > 0) {
    // Treffer: Oberkörper und Kopf schnappen von der Schlagseite weg
    const h = st.hit * st.hit, sd = -st.hitSide;
    for (const n of ['chest', 'neck', 'head', 'shL', 'shR']) { RP[n].x += sd * 0.16 * h; RP[n].y -= 0.05 * h; }
    RP.head.x += sd * 0.08 * h; RP.head.z -= 0.05 * h;
  }
}
const _cbV = new THREE.Vector3();
