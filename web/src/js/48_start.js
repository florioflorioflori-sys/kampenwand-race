// ------------------------------------------------------------------
// Startbereich: Zelte, Zeitnahme, Material, Betreuer an den Rädern,
// streunender Hund, Fotoblitze und Sonnenreflexe
// ------------------------------------------------------------------
const START = { crew: [], dog: null, clock: null, clockCtx: null, clockTex: null, lastTxt: '', fx: [], fxCd: 0 };
// Betreuer: kniet am Rad und schraubt
POSES.mechanic = (t, e, ph) => {
  const j = baseSkel(0);
  j.pelvis.set(0, 0.52, -0.1); j.hpL.set(0.1, 0.5, -0.1); j.hpR.set(-0.1, 0.5, -0.1);
  j.ftL.set(0.16, 0.08, 0.22); j.ftR.set(-0.14, 0.06, -0.42); j.kneePole = V(0.1, 0.3, 1); j.kneePoleR = V(-0.1, -1, 0.2);
  j.chest.set(0, 0.86, 0.12); j.neck.set(0, 1.0, 0.2); j.head.set(0, 1.12, 0.27);
  j.shL.set(0.18, 0.92, 0.14); j.shR.set(-0.18, 0.92, 0.14);
  const w = Math.sin(t * 7 + ph) * 0.04;
  j.haL.set(0.08, 0.5, 0.52); j.haR.set(-0.06, 0.55 + w, 0.5 + w * 0.5);
  j.elbowPole = V(1, -0.3, 0); j.elbowPoleR = V(-1, -0.3, 0);
  j.headQ = E(0.45, 0, 0);
  j.props = [{ a: j.haR.clone(), b: j.haR.clone().add(V(0.05, 0.02, 0.17)), r: 0.012, col: 0x9a9a9a }];
  return j;
};
// Betreuer: redet mit Händen und Füßen auf den Fahrer ein
POSES.talk = (t, e, ph) => {
  const j = baseSkel(0.04), g = Math.sin(t * 3.1 + ph), g2 = Math.sin(t * 4.3 + ph * 2);
  j.haL.set(0.2, 1.18 + g * 0.12, 0.3 + g2 * 0.06); j.haR.set(-0.22, 1.05 + Math.max(0, g2) * 0.25, 0.25);
  j.elbowPole = V(1, -0.5, -0.4); j.elbowPoleR = V(-1, -0.5, -0.4);
  j.headQ = E(0.1 * Math.sin(t * 2 + ph), 0.25 * Math.sin(t * 1.3 + ph), 0);
  return j;
};
function buildStartArea(rand) {
  const grp = new THREE.Group();
  const clearAt = (x, z, r) => { for (let i = life.people.length - 1; i >= 0; i--) { const p = life.people[i]; if (Math.hypot(p.x - x, p.z - z) < r) life.people.splice(i, 1); } reservedSpots.push([x, z, r]); };
  const M = {
    alu: new THREE.MeshStandardMaterial({ color: 0xc9cdd1, roughness: 0.3, metalness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1d1f1a, roughness: 0.6 }),
    hay: new THREE.MeshStandardMaterial({ color: 0xc9a85a, roughness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }),
  };
  const box = (w, h, d, m, x, y, z, ry = 0, parent = grp) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const ads = adSpecs(), spon = (name) => ads.find((a) => a.name === name) || ads[0];
  // Faltpavillon mit Dach in Sponsorfarbe und bedrucktem Volant
  const tent = (s, lat, w, d, ad, label) => {
    const pt = trailPoint(s, lat, {}), y = hAt(pt.x, pt.z), g = new THREE.Group();
    g.position.set(pt.x, y, pt.z); g.rotation.y = pt.yaw + (lat > 0 ? -Math.PI / 2 : Math.PI / 2); grp.add(g);
    const roofM = new THREE.MeshStandardMaterial({ color: new THREE.Color(ad.bg), roughness: 0.7, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const gy = hAt(pt.x, pt.z) - y; box(0.05, 2.4, 0.05, M.alu, sx * w / 2, 1.2 + gy, sz * d / 2, 0, g); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2, 0.9, 4, 1, true).rotateY(Math.PI / 4).scale(w / Math.hypot(w, d) * Math.SQRT2, 1, d / Math.hypot(w, d) * Math.SQRT2), roofM);
    roof.position.y = 2.85; roof.castShadow = true; g.add(roof);
    const vt = adTex({ ...ad, sub: label }, 512, 96);
    const vm = new THREE.MeshStandardMaterial({ map: vt, roughness: 0.7, side: THREE.DoubleSide });
    for (const [px, pz, ry, L] of [[0, d / 2, 0, w], [0, -d / 2, Math.PI, w], [w / 2, 0, Math.PI / 2, d], [-w / 2, 0, -Math.PI / 2, d]]) { const v = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.3), vm); v.position.set(px, 2.25, pz); v.rotation.y = ry; g.add(v); }
    // Rückwand
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.1), roofM); back.position.set(0, 1.1, -d / 2); g.add(back);
    clearAt(pt.x, pt.z, Math.hypot(w, d) / 2 + 0.6);
    return g;
  };
  // Zeitnahme mit Tisch, Laptop, Uhr
  const tz = tent(2, -(TRAIL_HALF + 6.5), 3, 3, spon('Rathaus'), 'ZEITNAHME');
  box(1.6, 0.05, 0.7, M.wood, 0, 0.75, 0.3, 0, tz); for (const sx of [-0.7, 0.7]) box(0.05, 0.75, 0.6, M.alu, sx, 0.37, 0.3, 0, tz);
  box(0.35, 0.02, 0.25, M.dark, -0.3, 0.79, 0.3, 0.2, tz); box(0.35, 0.22, 0.02, M.dark, -0.3, 0.9, 0.2, 0.2, tz);
  // Bierzelt mit Garnituren
  const bz = tent(-6, TRAIL_HALF + 9, 6, 4, spon('Augustiner'), 'BIERAUSSCHANK');
  for (const sz of [-0.9, 0.9]) { box(2.2, 0.05, 0.5, M.wood, 0, 0.76, sz, 0, bz); for (const sb of [-0.45, 0.45]) box(2.2, 0.04, 0.25, M.wood, 0, 0.46, sz + sb, 0, bz); }
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.18, 10), new THREE.MeshStandardMaterial({ color: 0xd99a22, roughness: 0.2, transparent: true, opacity: 0.85 })); m.position.set(-0.8 + k * 0.5, 0.88, (k % 2 ? 0.9 : -0.9)); bz.add(m); }
  tent(16, TRAIL_HALF + 8.5, 3, 3, spon('Red Bull'), 'ENERGY');
  tent(-14, -(TRAIL_HALF + 8), 4.5, 3, spon('Bauhof'), 'RACE OFFICE');
  // Zeituhr am Starttor
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  START.clockCtx = c.getContext('2d'); START.clockTex = new THREE.CanvasTexture(c); START.clockTex.colorSpace = THREE.SRGBColorSpace;
  { const pt = trailPoint(13, -(TRAIL_HALF + 2.4), {}), y = hAt(pt.x, pt.z);
    box(0.12, 3.2, 0.12, M.alu, pt.x, y + 1.6, pt.z);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.52), new THREE.MeshBasicMaterial({ map: START.clockTex, toneMapped: false }));
    face.position.set(pt.x, y + 3.25, pt.z); face.rotation.y = pt.yaw + Math.PI; grp.add(face);
    const bk = box(1.5, 0.6, 0.1, M.dark, pt.x, y + 3.25, pt.z, pt.yaw); bk.position.addScaledVector(V(Math.sin(pt.yaw), 0, Math.cos(pt.yaw)), 0.06);
    // Lichtschranke
    for (const sx of [-1, 1]) { const q = trailPoint(13, sx * (TRAIL_HALF + 0.3), {}); box(0.08, 1.0, 0.08, M.dark, q.x, hAt(q.x, q.z) + 0.5, q.z); box(0.12, 0.12, 0.12, new THREE.MeshStandardMaterial({ color: 0xe8102e, emissive: 0x500000 }), q.x, hAt(q.x, q.z) + 0.9, q.z); }
  }
  // Material: Ersatzreifen, Werkzeugkisten, Bierkisten, Strohballen, Fässer
  const props = [];
  for (let i = 0; i < 26; i++) {
    const s = -16 + rand() * 32, side = rand() < 0.5 ? -1 : 1, lat = side * (TRAIL_HALF + 2.8 + rand() * 4);
    const pt = trailPoint(s, lat, {}); if (trailDistAt(pt.x, pt.z) < TRAIL_HALF + 1.5) continue;
    props.push([pt.x, hAt(pt.x, pt.z), pt.z, rand() * 6.28, Math.floor(rand() * 5)]);
  }
  const crateM = [0xe2a33a, 0x1f5a2e, 0xc23a22].map((c2) => new THREE.MeshStandardMaterial({ color: c2, roughness: 0.6 }));
  for (const [x, y, z, ry, k] of props) {
    if (k === 0) { const tr = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.06, 8, 20), M.rubber); tr.position.set(x, y + 0.36, z); tr.rotation.set(0.15, ry, 0); tr.castShadow = true; grp.add(tr); }
    else if (k === 1) { box(0.6, 0.35, 0.35, crateM[2], x, y + 0.17, z, ry); box(0.3, 0.05, 0.05, M.dark, x, y + 0.37, z, ry); }
    else if (k === 2) { const n = 1 + Math.floor(Math.random() * 3); for (let h = 0; h < n; h++) box(0.4, 0.3, 0.3, crateM[h % 2], x, y + 0.15 + h * 0.3, z, ry + h * 0.1); }
    else if (k === 3) { const hb = box(1.1, 0.45, 0.5, M.hay, x, y + 0.22, z, ry); hb.rotation.z = 0.02; }
    else { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14), crateM[1]); b.position.set(x, y + 0.45, z); b.castShadow = true; grp.add(b); }
    clearAt(x, z, 0.7);
  }
  // Betreuer an den Startplätzen (Startraster in setupRace: s 10/6, Querabstand 1,6 m)
  const crewSpots = [[10.4, -2.35, 'mechanic', 1], [6.2, 2.35, 'mechanic', -1], [9.2, 2.5, 'talk', -1], [5.4, -0.8, 'talk', 0]];
  for (const [s, lat, pose, face] of crewSpots) {
    const pt = trailPoint(s, lat, {});
    const yaw = pt.yaw + (face === 0 ? Math.PI : face * -Math.PI / 2);
    const p = addPerson(rand, pose, pt.x, pt.z, yaw, { react: false, top: [0x1d1f1a, 0xe30613, 0x0a6fd8, 0x12a538][START.crew.length], hat: 'cap', backpack: false });
    p.look = false; p.crew = { x: pt.x, z: pt.z, pose, out: lat > 0 ? 1 : -1, s, gone: 0 };
    START.crew.push(p);
  }
  // streunender Hund
  { const pt = trailPoint(14, 3, {}); const d = { q: new Quad('dog', rand), x: pt.x, z: pt.z, yaw: 0, ph: 1, e: 0, sit: false, stray: true, tx: pt.x, tz: pt.z, run: 0 }; d.q.s = 0.62; life.dogs.push(d); START.dog = d; }
  // Blitze und Reflexe
  const flashTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,252,235,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  const starTex = canvasTex(64, 64, (x) => { x.translate(32, 32); for (const a of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) { x.save(); x.rotate(a); const g = x.createLinearGradient(-32, 0, 32, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,240,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; const w = a % (Math.PI / 2) ? 1.2 : 2.2; x.fillRect(-32, -w, 64, w * 2); x.restore(); } const r = x.createRadialGradient(0, 0, 0, 0, 0, 10); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(-10, -10, 20, 20); });
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: i < 5 ? flashTex : starTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, toneMapped: false }));
    sp.visible = false; grp.add(sp); START.fx.push({ sp, t: 0, kind: i < 5 ? 'flash' : 'glint', dur: 0 });
  }
  return grp;
}
function resetStartCrew() {
  for (const p of START.crew) { p.x = p.crew.x; p.z = p.crew.z; p.y = hAt(p.x, p.z); p.pose = p.crew.pose; p.crew.gone = 0; }
}
const _sfV = new THREE.Vector3();
function updateStart(dt, t) {
  // Startuhr
  if (START.clockCtx) {
    const txt = race.state === 'countdown' ? (race.pan > 0 ? '0:00.0' : '-' + Math.max(0, race.countdown).toFixed(1)) : race.state === 'race' || race.state === 'finished' ? (Math.floor(race.t / 60) + ':' + (race.t % 60).toFixed(1).padStart(4, '0')) : '0:00.0';
    if (txt !== START.lastTxt) {
      const x = START.clockCtx; START.lastTxt = txt;
      x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, 256, 96); x.fillStyle = race.state === 'countdown' && race.pan <= 0 ? '#ff3b2a' : '#ffcf3a';
      x.font = '700 70px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, 50);
      START.clockTex.needsUpdate = true;
    }
  }
  // Betreuer räumen nach dem Startschuss das Feld
  for (const p of START.crew) {
    if (race.state === 'race' && p.crew.gone < 5) {
      p.pose = 'stand';
      const pt = trailPoint(p.crew.s, 0, {}), k = Math.min(5 - p.crew.gone, dt * 2.2);
      p.x += Math.cos(pt.yaw) * p.crew.out * k; p.z -= Math.sin(pt.yaw) * p.crew.out * k; p.y = hAt(p.x, p.z);
      p.crew.gone += k;
      if (p.crew.gone >= 5) { p.pose = 'cheer'; p.react = true; p.look = true; }
    }
  }
  // streunender Hund: läuft im Startbereich herum, vor dem Start auch über die Strecke
  const d = START.dog;
  if (d) {
    const dist = Math.hypot(d.tx - d.x, d.tz - d.z);
    if (dist < 0.5) {
      if (Math.random() < dt * 0.6) {
        const racing = race.state === 'race';
        const lat = racing ? (Math.random() < 0.5 ? -1 : 1) * (TRAIL_HALF + 2 + Math.random() * 5) : (Math.random() - 0.5) * 14;
        const pt = trailPoint(-6 + Math.random() * 34, lat, {}); d.tx = pt.x; d.tz = pt.z;
      }
      d.run = 0;
    } else {
      const sp = dist > 3 ? 4.5 : 2, a = Math.atan2(d.tx - d.x, d.tz - d.z);
      d.yaw = a; d.x += Math.sin(a) * sp * dt; d.z += Math.cos(a) * sp * dt; d.run = sp > 3 ? 1 : 0.4;
    }
  }
  // Fotoblitze im Publikum und kurze Sonnenreflexe
  START.fxCd -= dt;
  if (START.fxCd <= 0 && (race.state === 'race' || race.state === 'countdown')) {
    START.fxCd = 0.12 + Math.random() * 0.4;
    const cam = camera.position;
    for (let tries = 0; tries < 25; tries++) {
      const p = life.people[Math.floor(Math.random() * life.people.length)];
      const dc = Math.hypot(p.x - cam.x, p.z - cam.z);
      if (dc > 70 || dc < 4) continue;
      const glint = Math.random() < 0.4;
      if (!glint && !/phone|film|photographer|cheer/.test(p.pose)) continue;
      if (glint && !p.h.glasses && Math.random() < 0.7) continue;
      const f = START.fx.find((q) => q.kind === (glint ? 'glint' : 'flash') && q.t <= 0); if (!f) break;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), hy = (p.h.kid ? 1.05 : 1.62) * (p.h.scale || 1);
      f.sp.position.set(p.x + fx * 0.25, p.y + hy - (glint ? 0.02 : 0.08), p.z + fz * 0.25);
      f.dur = f.t = glint ? 0.18 : 0.08; f.size = glint ? 0.5 + Math.random() * 0.4 : 1.1 + Math.random() * 0.6; f.sp.visible = true;
      break;
    }
  }
  for (const f of START.fx) {
    if (f.t <= 0) { f.sp.visible = false; continue; }
    f.t -= dt; const k = clamp(f.t / f.dur, 0, 1);
    f.sp.material.opacity = f.kind === 'flash' ? k : Math.sin(k * Math.PI);
    f.sp.material.rotation = f.kind === 'glint' ? (1 - k) * 0.8 : 0;
    f.sp.scale.setScalar(f.size * (f.kind === 'glint' ? 0.6 + Math.sin(k * Math.PI) * 0.6 : 1));
  }
}
