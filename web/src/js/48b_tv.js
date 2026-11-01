// ------------------------------------------------------------------
// Fernsehen: Übertragungswagen, Kameraleute, Reporter, Kameratürme an
// Start, Ziel und Strecke, TV-Hubschrauber fliegt mit.
// Außerdem viel mehr Betrieb am Startbogen.
// ------------------------------------------------------------------
const TV_BRANDS = [
  { name: 'ARD', bg: '#00327d', fg: '#ffffff', fg2: '#ffffff', sub: 'DAS ERSTE · SPORT', font: `900 {S}px ${AD_FONT}`, upper: true, heli: 0x00327d },
  { name: 'ORF 1', bg: '#d2102a', fg: '#ffffff', fg2: '#ffffff', sub: 'SPORT LIVE', font: `900 {S}px ${AD_FONT}`, upper: true, heli: 0xd2102a },
  { name: 'sky', bg: '#0b1446', fg: '#ffffff', fg2: '#e8102e', sub: 'SPORT · LIVE', font: `800 {S}px ${AD_FONT}`, upper: false, heli: 0x0b1446 },
];
const TV = { helis: [], cams: [], heli: null, cd: 18, mode: 'idle', t: 0 };
// Kameramann mit Schulterkamera
POSES.tvcam = (t, e, ph) => {
  const j = baseSkel(0.03), b = Math.sin(t * 0.8 + ph) * 0.01;
  j.haR.set(-0.13, 1.56 + b, 0.2); j.haL.set(0.03, 1.5 + b, 0.38);
  j.elbowPoleR = V(-1, -0.7, -0.1); j.elbowPole = V(1, -0.8, 0.1);
  j.headQ = E(0.05, -0.15, 0);
  j.props = [
    { a: V(-0.15, 1.66 + b, -0.14), b: V(-0.15, 1.66 + b, 0.34), r: 0.075, right: V(1, 0, 0), flat: 1.35, col: 0x1b1c1e },
    { a: V(-0.15, 1.64 + b, 0.34), b: V(-0.15, 1.64 + b, 0.48), r: 0.045, r1: 0.05, col: 0x0d0d0d },
    { a: V(-0.15, 1.75 + b, -0.05), b: V(-0.15, 1.75 + b, 0.2), r: 0.012, col: 0x555555 },
  ];
  return j;
};
// Kamera auf dem Stativ
POSES.tvtripod = (t, e, ph) => {
  const j = baseSkel(0.08);
  j.haR.set(-0.2, 1.22, 0.3); j.haL.set(0.07, 1.42, 0.42); j.elbowPoleR = V(-1, -0.5, -0.3); j.elbowPole = V(1, -0.5, 0);
  j.headQ = E(0.15, 0, 0);
  const top = V(0, 1.32, 0.62);
  j.props = [
    { a: top, b: V(0.32, 0.02, 0.5), r: 0.018, col: 0x222222 }, { a: top, b: V(-0.32, 0.02, 0.5), r: 0.018, col: 0x222222 }, { a: top, b: V(0, 0.02, 1.0), r: 0.018, col: 0x222222 },
    { a: V(0, 1.45, 0.38), b: V(0, 1.45, 0.86), r: 0.085, right: V(1, 0, 0), flat: 1.3, col: 0x1b1c1e },
    { a: V(0, 1.43, 0.86), b: V(0, 1.43, 1.02), r: 0.055, r1: 0.06, col: 0x0d0d0d },
    { a: V(-0.04, 1.4, 0.4), b: V(-0.2, 1.24, 0.28), r: 0.012, col: 0x444444 },
  ];
  return j;
};
// Reporterin/Reporter mit Mikrofon
POSES.reporter = (t, e, ph) => {
  const j = baseSkel(0.02), g = Math.sin(t * 2.3 + ph);
  j.haR.set(-0.07, 1.48, 0.22); j.elbowPoleR = V(-1, -0.8, -0.2);
  j.haL.set(0.24, 1.08 + Math.max(0, g) * 0.16, 0.24 + g * 0.05); j.elbowPole = V(1, -0.5, -0.4);
  j.headQ = E(0.04 * Math.sin(t * 1.7 + ph), 0.2 * Math.sin(t * 0.6 + ph), 0);
  j.props = [{ a: V(-0.07, 1.46, 0.22), b: V(-0.06, 1.57, 0.26), r: 0.013, col: 0x111111 }, { a: V(-0.06, 1.6, 0.27), r: 0.028, col: 0x2b2b2b }, { a: V(-0.065, 1.53, 0.24), b: V(-0.065, 1.55, 0.25), r: 0.024, col: 0xd2102a }];
  return j;
};
// Übertragungswagen mit Schriftzug und Satellitenschüssel
function obVan(brand) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.4, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1e2c38, roughness: 0.1, metalness: 0.7 });
  const side = new THREE.MeshStandardMaterial({ map: adTex(brand, 1024, 300), roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.7, 6.2), [side, side, white, white, white, white]); body.position.set(0, 1.85, -0.7); g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.1, 1.7), white); cab.position.set(0, 1.55, 3.2); g.add(cab);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.9, 0.05), glass); ws.position.set(0, 2.05, 4.06); ws.rotation.x = -0.15; g.add(ws);
  for (const [x, z] of [[1.05, 3.0], [-1.05, 3.0], [1.05, -2.4], [-1.05, -2.4], [1.05, -0.9], [-1.05, -0.9]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.32, 14).rotateZ(Math.PI / 2), dark); w.position.set(x, 0.45, z); g.add(w); }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8), dark); mast.position.set(0, 3.6, -2); g.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 8, 0, Math.PI * 2, 0, 0.7), white); dish.material = white.clone(); dish.material.side = THREE.DoubleSide;
  dish.rotation.x = -2.1; dish.position.set(0, 4.1, -2); g.add(dish);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9), dark); feed.position.set(0, 4.35, -1.65); feed.rotation.x = -0.6; g.add(feed);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
// Kameraturm aus Gerüst mit Plattform
function camTower(h) {
  const g = new THREE.Group(), alu = new THREE.MeshStandardMaterial({ color: 0xbfc4c8, roughness: 0.35, metalness: 0.75 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h + 1.1), alu); p.position.set(sx * 0.9, (h + 1.1) / 2, sz * 0.9); g.add(p); }
  for (let y = 0.8; y < h; y += 1.2) for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4).rotateZ(0.95), alu); b.position.set(Math.sin(r) * 0.9, y + 0.5, Math.cos(r) * 0.9); b.rotation.y = r + Math.PI / 2; g.add(b); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 2), new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.9 })); deck.position.y = h; g.add(deck);
  for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 0.04), alu); rl.position.set(Math.sin(r) * 0.95, h + 1.0, Math.cos(r) * 0.95); rl.rotation.y = r; g.add(rl); }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
// TV-Hubschrauber in Senderfarben
function tvHeli(brand) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color: brand.heli, roughness: 0.3, metalness: 0.3, clearcoat: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.4, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a36, roughness: 0.05, metalness: 0.8, envMapIntensity: 1.5 });
  const fus = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14).scale(0.95, 1.0, 2.0), paint); fus.position.set(0, 1.4, 0.4); body.add(fus);
  const can = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, 1.2).scale(0.85, 0.85, 1.2), glass); can.rotation.x = 1.3; can.position.set(0, 1.55, 1.5); body.add(can);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 4.6, 10).rotateX(Math.PI / 2), paint); boom.position.set(0, 1.75, -3.6); body.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.8), paint); fin.position.set(0, 2.3, -5.8); fin.rotation.x = -0.35; body.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.4), paint); stab.position.set(0, 1.8, -5.2); body.add(stab);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.5), dark); mast.position.set(0, 2.55, 0.3); body.add(mast);
  for (const sx of [-1, 1]) {
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2).rotateX(Math.PI / 2), dark); sk.position.set(sx * 0.85, 0.12, 0.4); body.add(sk);
    for (const z of [-0.4, 1.2]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8), dark); st.position.set(sx * 0.75, 0.5, z); st.rotation.z = sx * 0.3; body.add(st); }
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshStandardMaterial({ map: textTexture([[brand.name, `900 150px ${AD_FONT}`]], 512, 160, brand.bg, '#ffffff'), roughness: 0.4 }));
    lab.position.set(sx * 0.97, 1.35, -0.2); lab.rotation.y = sx * Math.PI / 2; body.add(lab);
  }
  // Kamerakugel unter der Nase
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshStandardMaterial({ color: 0xdadada, roughness: 0.3, metalness: 0.4 })); ball.position.set(0, 0.55, 2.0); body.add(ball);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1).rotateX(Math.PI / 2), glass); lens.position.set(0, 0.55, 2.27); body.add(lens);
  // Rotoren
  const rotor = new THREE.Group(); rotor.position.set(0, 2.82, 0.3); body.add(rotor);
  const bladeM = new THREE.MeshStandardMaterial({ color: 0x222426, roughness: 0.5, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 5.2).translate(0, 0, 2.6), bladeM); b.rotation.y = i * Math.PI / 2; rotor.add(b); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.2, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.12, depthWrite: false })); rotor.add(disc);
  const tr = new THREE.Group(); tr.position.set(0.12, 2.3, -5.9); body.add(tr);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.12), bladeM); b.rotation.x = i * Math.PI / 2; tr.add(b); }
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.visible = false;
  return { g, body, rotor, tr, brand, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, bank: 0 };
}
function buildTV(rand) {
  const grp = new THREE.Group();
  const free = (x, z, r) => !nearStations(x, z) && trailDistAt(x, z) > TRAIL_HALF + r && !life.people.some((p) => Math.abs(p.x - x) < r && Math.abs(p.z - z) < r);
  const clear = (x, z, r) => { for (let i = life.people.length - 1; i >= 0; i--) { const p = life.people[i]; if (Math.hypot(p.x - x, p.z - z) < r) life.people.splice(i, 1); } reservedSpots.push([x, z, r]); };
  const van = (s, lat, brand) => {
    const pt = trailPoint(s, lat, {}); if (trailDistAt(pt.x, pt.z) < TRAIL_HALF + 4) return null;
    const v = obVan(brand); let lo = 1e9; for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) lo = Math.min(lo, hAt(pt.x + dx, pt.z + dz));
    v.position.set(pt.x, lo, pt.z); v.rotation.y = pt.yaw + (lat > 0 ? 0.15 : -0.15); grp.add(v);
    clear(pt.x, pt.z, 5); addObstacle(pt.x, pt.z, 3.5); return v;
  };
  const crew = (pose, s, lat, brand, opts = {}) => {
    const pt = trailPoint(s, lat, {});
    if (!opts.force && trailDistAt(pt.x, pt.z) < TRAIL_HALF + 1.2) return null;
    const p = addPerson(rand, pose, pt.x, pt.z, facingTrail(s, lat) + (opts.yaw || 0), { react: false, look: false, top: [0x1d1f1a, 0x2a2f38, 0x24344a][Math.floor(rand() * 3)], hat: rand() < 0.5 ? 'beanie' : 'cap', hatCol: 0x1d1f1a, backpack: false, y: opts.y });
    p.tv = brand; p.noReal = !!opts.y; TV.cams.push(p); return p;
  };
  // Start: Übertragungswagen, Kameraleute am Startbogen, Interview
  const L = trail.L;
  van(-14, -(TRAIL_HALF + 16), TV_BRANDS[0]); van(-4, TRAIL_HALF + 18, TV_BRANDS[2]); van(-24, TRAIL_HALF + 14, TV_BRANDS[1]);
  crew('tvcam', 15, TRAIL_HALF + 1.4, TV_BRANDS[0], { yaw: 0.6 }); crew('tvcam', 18, -(TRAIL_HALF + 1.4), TV_BRANDS[2], { yaw: -0.6 });
  crew('tvtripod', 24, TRAIL_HALF + 2.0, TV_BRANDS[1]);
  crew('reporter', -2, -(TRAIL_HALF + 9), TV_BRANDS[1], { yaw: Math.PI / 2 }); crew('tvcam', -2, -(TRAIL_HALF + 11.5), TV_BRANDS[1], { yaw: -Math.PI / 2 });
  // Ziel
  van(L - 20, TRAIL_HALF + 14, TV_BRANDS[0]); van(L - 34, -(TRAIL_HALF + 15), TV_BRANDS[1]); van(L - 8, -(TRAIL_HALF + 18), TV_BRANDS[2]);
  crew('tvcam', L - 10, TRAIL_HALF + 1.5, TV_BRANDS[2], { yaw: -0.5 }); crew('tvcam', L - 14, -(TRAIL_HALF + 1.5), TV_BRANDS[0], { yaw: 0.5 });
  crew('reporter', L - 4, TRAIL_HALF + 9, TV_BRANDS[0], { yaw: -Math.PI / 2 }); crew('tvcam', L - 4, TRAIL_HALF + 11.5, TV_BRANDS[0], { yaw: Math.PI / 2 });
  for (const [s, lat, b] of [[L - 40, TRAIL_HALF + 5, 2], [32, -(TRAIL_HALF + 5), 0]]) {
    const pt = trailPoint(s, lat, {}); const tw = camTower(3.2); tw.position.set(pt.x, hAt(pt.x, pt.z), pt.z); grp.add(tw); clear(pt.x, pt.z, 2); addObstacle(pt.x, pt.z, 1.4);
    crew('tvtripod', s, lat, TV_BRANDS[b], { y: hAt(pt.x, pt.z) + 3.25, force: true, yaw: 0.3 });
  }
  // an der Strecke: an Sprüngen und Kehren
  const spots = [...trail.kickers.filter((_, i) => i % 3 === 1), ...(life.rallySpots || []).filter((_, i) => i % 2 === 0)];
  spots.forEach((s, i) => {
    if (s < 60 || s > L - 60) return;
    const side = i % 2 ? 1 : -1, b = TV_BRANDS[i % 3];
    if (i % 4 === 3) {
      const lat = side * (TRAIL_HALF + 5), pt = trailPoint(s, lat, {});
      if (!free(pt.x, pt.z, 2)) return;
      const tw = camTower(2.6); tw.position.set(pt.x, hAt(pt.x, pt.z), pt.z); grp.add(tw); clear(pt.x, pt.z, 2); addObstacle(pt.x, pt.z, 1.4);
      crew('tvtripod', s, lat, b, { y: hAt(pt.x, pt.z) + 2.65, force: true });
    } else crew(i % 2 ? 'tvcam' : 'tvtripod', s + 4, side * (TRAIL_HALF + 2.2), b, { yaw: -side * 0.5 });
  });
  // Startbogen: dichtes Publikum hinter Absperrgittern, Fahnen, Sprecher
  const poses = ['cheer', 'clap', 'cheer', 'phone', 'film', 'cowbell', 'flag', 'beer', 'clap', 'cheer', 'pockets', 'crossed'];
  for (let s = -6; s <= 46; s += 1.1) for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      if (rand() < 0.15) continue;
      const lat = side * (TRAIL_HALF + 2.0 + row * 0.85 + rand() * 0.4), ss = s + (rand() - 0.5) * 0.8, pt = trailPoint(ss, lat, {});
      if (nearStations(pt.x, pt.z) || trailDistAt(pt.x, pt.z) < TRAIL_HALF + 1.5) continue;
      if (life.people.some((p) => Math.abs(p.x - pt.x) < 0.55 && Math.abs(p.z - pt.z) < 0.55)) continue;
      addPerson(rand, poses[Math.floor(rand() * poses.length)], pt.x, pt.z, facingTrail(ss, lat) + (rand() - 0.5) * 0.6, { kid: row === 0 && rand() < 0.12 });
    }
  }
  // Absperrgitter mit Werbeplanen entlang der Startgeraden
  const ads = adSpecs(), steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.35, metalness: 0.7 });
  const fenceGeo = mergeGeometries([new THREE.BoxGeometry(0.04, 1.1, 0.04).translate(-1, 0.55, 0), new THREE.BoxGeometry(0.04, 1.1, 0.04).translate(1, 0.55, 0), new THREE.BoxGeometry(2, 0.04, 0.04).translate(0, 1.08, 0), new THREE.BoxGeometry(2, 0.04, 0.04).translate(0, 0.15, 0), new THREE.BoxGeometry(0.6, 0.03, 0.03).translate(-0.9, 0.0, 0), new THREE.BoxGeometry(0.6, 0.03, 0.03).translate(0.9, 0.0, 0)]);
  const fl = [];
  for (let s = -4; s <= 46; s += 2.05) for (const side of [-1, 1]) { const pt = trailPoint(s, side * (TRAIL_HALF + 1.15), {}); fl.push([pt.x, hAt(pt.x, pt.z), pt.z, pt.yaw + Math.PI / 2, side, s]); }
  const fim = new THREE.InstancedMesh(fenceGeo, steel, fl.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  fl.forEach((f, i) => { q.setFromAxisAngle(_UP, f[3]); fim.setMatrixAt(i, m4.compose(V(f[0], f[1], f[2]), q, one)); });
  fim.castShadow = true; grp.add(fim);
  fl.forEach((f, i) => {
    if (i % 3) return;
    const a = [...SPONSORS, ...TV_BRANDS][Math.floor(i / 3) % (SPONSORS.length + 3)];
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.85), new THREE.MeshStandardMaterial({ map: adTex(a, 512, 220), roughness: 0.6, side: THREE.DoubleSide }));
    ban.position.set(f[0], f[1] + 0.62, f[2]); ban.rotation.y = f[3] + (f[4] > 0 ? Math.PI / 2 : -Math.PI / 2) - Math.PI / 2; grp.add(ban);
  });
  // große Fahnen hinter dem Publikum
  const flagGeo = new THREE.PlaneGeometry(1.1, 4.4, 8, 16).translate(0.6, 0, 0), pole = new THREE.CylinderGeometry(0.05, 0.07, 7, 6).translate(0, 3.5, 0);
  const all = [...SPONSORS, ...TV_BRANDS, ...ads.slice(0, 6)];
  all.forEach((a, i) => {
    const side = i % 2 ? 1 : -1, s = -4 + i * 3.4, pt = trailPoint(s, side * (TRAIL_HALF + 6.5 + (i % 3)), {});
    if (nearStations(pt.x, pt.z)) return;
    const y = hAt(pt.x, pt.z), pm = new THREE.Mesh(pole, steel); pm.position.set(pt.x, y, pt.z); grp.add(pm);
    const fm = new THREE.InstancedMesh(flagGeo, flagWave(new THREE.MeshStandardMaterial({ map: adTex(a, 128, 512, true), roughness: 0.8, side: THREE.DoubleSide })), 1);
    fm.setMatrixAt(0, m4.compose(V(pt.x + 0.05, y + 4.7, pt.z), q.setFromAxisAngle(_UP, rand() * 6.28), one)); fm.castShadow = true; grp.add(fm);
  });
  // Sprecherpodest mit Lautsprechern
  {
    const pt = trailPoint(6, TRAIL_HALF + 8.5, {}), y = hAt(pt.x, pt.z), g = new THREE.Group(); g.position.set(pt.x, y, pt.z); g.rotation.y = facingTrail(6, TRAIL_HALF + 8.5); grp.add(g);
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 }), blk = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 2), wood); deck.position.y = 0.45; g.add(deck);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.9), new THREE.MeshStandardMaterial({ map: adTex(SPONSORS[0], 512, 150), roughness: 0.6 })); front.position.set(0, 0.45, 1.01); g.add(front);
    for (const sx of [-1.8, 1.8]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.55), blk); sp.position.set(sx, 0.7, 0.4); g.add(sp); const sp2 = sp.clone(); sp2.position.y = 2.1; sp2.scale.y = 0.7; g.add(sp2); }
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    clear(pt.x, pt.z, 2.6);
    const sp = addPerson(rand, 'reporter', pt.x, pt.z, g.rotation.y, { react: false, y: y + 0.9, top: 0xe8102e, hat: 'cap', hatCol: 0x0c1f4a });
    sp.noReal = true;
  }
  // Hubschrauber
  for (const b of TV_BRANDS) { const h = tvHeli(b); TV.helis.push(h); grp.add(h.g); }
  return grp;
}
const _tvA = new THREE.Vector3();
function updateTV(dt, t) {
  if (!player) return;
  const P = player.pos;
  // Kameraleute schwenken mit dem Fahrer mit
  for (const p of TV.cams) {
    const d = Math.hypot(P.x - p.x, P.z - p.z);
    if (d < 70 && p.pose !== 'reporter') { const want = Math.atan2(P.x - p.x, P.z - p.z); let dy = want - p.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; p.yaw += dy * Math.min(1, dt * 3); }
  }
  // Hubschrauber: fliegt immer wieder eine Weile neben dem Fahrer her
  const racing = race.state === 'race';
  TV.cd -= dt;
  if (!TV.heli && racing && TV.cd <= 0) {
    const h = TV.helis[Math.floor(Math.random() * TV.helis.length)];
    TV.heli = h; h.t = 0; h.side = Math.random() < 0.5 ? -1 : 1; h.dur = 14 + Math.random() * 10;
    const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    h.pos.set(P.x - fx * 160 + fz * h.side * 60, P.y + 60, P.z - fz * 160 - fx * h.side * 60); h.vel.set(0, 0, 0); h.g.visible = true;
  }
  const h = TV.heli;
  for (const o of TV.helis) if (o.g.visible) { o.rotor.rotation.y += dt * 38; o.tr.rotation.x += dt * 60; }
  if (!h) return;
  h.t += dt;
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  const leave = h.t > h.dur || !racing;
  const lat = h.side * (22 + Math.sin(h.t * 0.3) * 6), ahead = 6 + Math.sin(h.t * 0.21) * 10;
  const tgt = leave ? _tvA.set(h.pos.x + rx * h.side * 80, P.y + 120, h.pos.z + rz * h.side * 80)
    : _tvA.set(P.x + fx * ahead + rx * lat, Math.max(P.y + 14 + Math.sin(h.t * 0.5) * 3, hAt(P.x + rx * lat, P.z + rz * lat) + 12), P.z + fz * ahead + rz * lat);
  // gedämpfte Verfolgung, Neigung in Flugrichtung
  const ax = (tgt.x - h.pos.x) * 1.4 - h.vel.x * 1.6, ay = (tgt.y - h.pos.y) * 1.4 - h.vel.y * 1.6, az = (tgt.z - h.pos.z) * 1.4 - h.vel.z * 1.6;
  h.vel.x += ax * dt; h.vel.y += ay * dt; h.vel.z += az * dt;
  const sp = h.vel.length(); if (sp > 45) h.vel.multiplyScalar(45 / sp);
  h.pos.addScaledVector(h.vel, dt);
  // Kamera schaut zum Fahrer, Rumpf in Flugrichtung
  const fwdYaw = sp > 3 ? Math.atan2(h.vel.x, h.vel.z) : Math.atan2(P.x - h.pos.x, P.z - h.pos.z);
  let dy = fwdYaw - h.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  h.yaw += dy * Math.min(1, dt * 1.5);
  const lx = ax * Math.cos(h.yaw) - az * Math.sin(h.yaw), lz = ax * Math.sin(h.yaw) + az * Math.cos(h.yaw);
  h.bank = damp(h.bank, clamp(-lx * 0.02, -0.5, 0.5), 2, dt); h.pitch = damp(h.pitch || 0, clamp(lz * 0.015, -0.3, 0.3), 2, dt);
  h.g.position.copy(h.pos); h.g.rotation.set(h.pitch, h.yaw, h.bank, 'YXZ');
  const dCam = h.pos.distanceTo(camera.position);
  if (typeof sfx === 'function' && Math.random() < dt * 3 && dCam < 160) sfx('heli', h.pos, dCam);
  if (leave && h.t > h.dur + 12) { h.g.visible = false; TV.heli = null; TV.cd = 20 + Math.random() * 20; }
}
