
// ------------------------------------------------------------------
// Partikel (Staub, Sägemehl)
// ------------------------------------------------------------------
const DUST_N = 700;
const dust = { pos: new Float32Array(DUST_N * 3), vel: new Float32Array(DUST_N * 3), life: new Float32Array(DUST_N), size: new Float32Array(DUST_N), col: new Float32Array(DUST_N), head: 0 };
let dustPoints;
function buildDust() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(dust.pos, 3));
  g.setAttribute('aLife', new THREE.BufferAttribute(dust.life, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(dust.size, 1));
  g.setAttribute('aCol', new THREE.BufferAttribute(dust.col, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 400 } },
    vertexShader: `attribute float aLife; attribute float aSize; attribute float aCol; varying float vL; varying float vC; uniform float uScale;
      void main(){ vL = aLife; vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aLife > 0.0 ? aSize * (1.8 - aLife*0.8) * uScale / -mv.z : 0.0; }`,
    fragmentShader: `varying float vL; varying float vC; void main(){ vec2 p = gl_PointCoord*2.0-1.0; float d = dot(p,p); if(d>1.0) discard;
      vec3 c = mix(vec3(0.42,0.34,0.25), vec3(0.85,0.72,0.5), vC); gl_FragColor = vec4(c, (1.0-d) * vL * mix(0.32, 0.8, vC)); }`,
  });
  dustPoints = new THREE.Points(g, mat); dustPoints.frustumCulled = false;
  return dustPoints;
}
function emitDust(x, y, z, vx, vy, vz, size, col = 0) {
  const i = dust.head; dust.head = (dust.head + 1) % DUST_N;
  dust.pos[i * 3] = x; dust.pos[i * 3 + 1] = y; dust.pos[i * 3 + 2] = z;
  dust.vel[i * 3] = vx; dust.vel[i * 3 + 1] = vy; dust.vel[i * 3 + 2] = vz;
  dust.life[i] = 1; dust.size[i] = size; dust.col[i] = col;
}
function updateDust(dt) {
  for (let i = 0; i < DUST_N; i++) {
    if (dust.life[i] <= 0) continue;
    dust.life[i] -= dt * (dust.col[i] > 0.5 ? 1.6 : 0.8);
    dust.pos[i * 3] += dust.vel[i * 3] * dt; dust.pos[i * 3 + 1] += dust.vel[i * 3 + 1] * dt; dust.pos[i * 3 + 2] += dust.vel[i * 3 + 2] * dt;
    dust.vel[i * 3] *= 0.97; dust.vel[i * 3 + 1] = dust.vel[i * 3 + 1] * 0.97 + (dust.col[i] > 0.5 ? -2.5 : 0.15) * dt; dust.vel[i * 3 + 2] *= 0.97;
  }
  const a = dustPoints.geometry.attributes;
  a.position.needsUpdate = a.aLife.needsUpdate = a.aSize.needsUpdate = a.aCol.needsUpdate = true;
}

// ------------------------------------------------------------------
// Fahrer & Downhill-Bike
// ------------------------------------------------------------------
const WHEEL_R = 0.37;
const unitTaper = (r0, r1, seg = 10) => new THREE.CylinderGeometry(r1, r0, 1, seg, 1).translate(0, 0.5, 0);
function tubeBetween(a, b, r, seg = 10, sx = 1) {
  const g = new THREE.CylinderGeometry(r, r, 1, seg, 1).scale(sx, 1, 1).translate(0, 0.5, 0);
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  g.scale(1, len, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
function helix(a, b, r, turns, tube) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const pts = [];
  for (let i = 0; i <= turns * 16; i++) { const t = i / (turns * 16), an = t * turns * Math.PI * 2; pts.push(V(Math.cos(an) * r, t * len, Math.sin(an) * r)); }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 16, tube, 5, false);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z);
  return g;
}
function setLimb(m, a, b) {
  const d = _pd.subVectors(b, a), len = d.length() || 1e-4;
  m.position.copy(a); m.quaternion.setFromUnitVectors(_UP, d.multiplyScalar(1 / len)); m.scale.set(1, len, 1);
}
function makeRider(cfg) {
  const root = new THREE.Group();
  const tilt = new THREE.Group(); root.add(tilt);
  const paint = new THREE.MeshPhysicalMaterial({ color: cfg.frame, roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 });
  const black = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.45, metalness: 0.5 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 0.25, metalness: 0.95 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a84a, roughness: 0.18, metalness: 1 });
  const spring = new THREE.MeshStandardMaterial({ color: cfg.accent, roughness: 0.35, metalness: 0.4 });
  const tTex = tireTex(); tTex.repeat.set(3, 1);
  const rubber = new THREE.MeshStandardMaterial({ map: tTex, bumpMap: tTex, bumpScale: 3, roughness: 0.95 });
  const R = WHEEL_R;
  const rear = V(0, R, -0.66), front = V(0, R, 0.66), bb = V(0, 0.34, -0.04), seat = V(0, 0.78, -0.25), htTop = V(0, 0.99, 0.45), htBot = V(0, 0.84, 0.5);
  const bike = new THREE.Group(); tilt.add(bike);
  // Rahmen (eine Geometrie je Material)
  const frameG = mergeGeometries([
    tubeBetween(bb, htBot, 0.036, 12, 0.75), tubeBetween(V(0, 0.74, -0.2), htTop, 0.028, 10, 0.8), tubeBetween(bb, seat, 0.03), tubeBetween(htBot, htTop, 0.04, 14),
    ...[-0.065, 0.065].flatMap((sx) => [tubeBetween(V(sx * 0.6, 0.34, -0.04), V(sx, R, -0.66), 0.018), tubeBetween(V(sx * 0.7, 0.62, -0.18), V(sx, R + 0.01, -0.66), 0.016)]),
    new THREE.BoxGeometry(0.1, 0.07, 0.24).rotateX(-0.5).translate(0, 0.62, -0.14),
  ]);
  const frame = new THREE.Mesh(frameG, paint); frame.castShadow = true; bike.add(frame);
  const blackG = mergeGeometries([
    tubeBetween(V(0, 0.46, 0.02), V(0, 0.66, -0.16), 0.024), tubeBetween(seat, V(0, 0.84, -0.26), 0.016),
    new THREE.SphereGeometry(1, 12, 8).scale(0.07, 0.03, 0.14).translate(0, 0.86, -0.24),
    tubeBetween(V(0.065, R, -0.66), V(-0.065, R, -0.66), 0.012),
    new THREE.BoxGeometry(0.03, 0.06, 0.08).translate(-0.07, R + 0.08, -0.6),
  ]);
  const blk = new THREE.Mesh(blackG, black); blk.castShadow = true; bike.add(blk);
  const coil = new THREE.Mesh(helix(V(0, 0.48, 0.0), V(0, 0.64, -0.15), 0.033, 7, 0.006), spring); coil.castShadow = true; bike.add(coil);
  const drive = mergeGeometries([
    new THREE.TorusGeometry(0.075, 0.006, 6, 24).rotateY(Math.PI / 2).translate(0.06, 0.34, -0.04),
    new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16).rotateZ(Math.PI / 2).translate(0.07, R, -0.66),
    new THREE.BoxGeometry(0.02, 0.07, 0.05).translate(0.09, R - 0.08, -0.66),
  ]);
  bike.add(new THREE.Mesh(drive, metal));
  const chainPts = [V(0.065, 0.415, -0.04), V(0.07, R + 0.06, -0.66), V(0.07, R - 0.07, -0.66), V(0.065, 0.265, -0.04), V(0.065, 0.415, -0.04)];
  bike.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(chainPts), new THREE.LineBasicMaterial({ color: 0x444444 })));
  // Kurbel und Pedale drehen sich
  const crank = new THREE.Group(); crank.position.copy(bb); bike.add(crank);
  const crankG = mergeGeometries([new THREE.BoxGeometry(0.02, 0.03, 0.17).translate(0.09, 0, 0.085), new THREE.BoxGeometry(0.02, 0.03, 0.17).translate(-0.09, 0, -0.085)]);
  crank.add(new THREE.Mesh(crankG, black));
  const pedals = [V(0.14, 0, 0.17), V(-0.14, 0, -0.17)].map((p) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.1), black); m.position.copy(p); crank.add(m); return m; });
  // Lenkung: Gabel, Vorbau, Lenker
  const steer = new THREE.Group(); steer.position.set(0, 0, 0.47); bike.add(steer);
  const S = (v) => v.clone().add(V(0, 0, -0.47));
  const fGold = mergeGeometries([-0.078, 0.078].map((sx) => tubeBetween(S(V(sx, 0.86, 0.49)), S(V(sx, 0.6, 0.55)), 0.019)));
  const fBlack = mergeGeometries([
    ...[-0.078, 0.078].map((sx) => tubeBetween(S(V(sx, 0.64, 0.545)), S(V(sx, R, 0.66)), 0.027)),
    new THREE.BoxGeometry(0.22, 0.05, 0.07).translate(0, 0.86, 0.02), new THREE.BoxGeometry(0.22, 0.05, 0.07).translate(0, 1.0, -0.02),
    new THREE.BoxGeometry(0.05, 0.05, 0.08).translate(0, 1.04, -0.06),
    tubeBetween(S(V(-0.39, 1.075, 0.4)), S(V(0.39, 1.075, 0.4)), 0.012),
    ...[-1, 1].map((sx) => tubeBetween(S(V(sx * 0.3, 1.075, 0.4)), S(V(sx * 0.39, 1.075, 0.4)), 0.017)),
    ...[-1, 1].map((sx) => tubeBetween(S(V(sx * 0.22, 1.08, 0.41)), S(V(sx * 0.32, 1.06, 0.5)), 0.006)),
    new THREE.BoxGeometry(0.03, 0.06, 0.08).translate(0.1, R + 0.08 - 0, 0.13),
  ]);
  const fg = new THREE.Mesh(fGold, gold), fb = new THREE.Mesh(fBlack, black); fg.castShadow = fb.castShadow = true; steer.add(fg, fb);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.18), new THREE.MeshStandardMaterial({ map: textTexture([[String(cfg.num), '800 150px "Saira Condensed", Arial Narrow, sans-serif']], 256, 192, '#f4efe6', '#1d1f1a'), roughness: 0.6 }));
  plate.position.set(0, 1.0, 0.07); steer.add(plate);
  // Räder
  const makeWheel = () => {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(R - 0.058, 0.058, 12, 40).rotateY(Math.PI / 2), rubber); tire.castShadow = true;
    const rim = new THREE.Mesh(mergeGeometries([new THREE.TorusGeometry(R - 0.1, 0.018, 6, 40).rotateY(Math.PI / 2), new THREE.CylinderGeometry(0.03, 0.03, 0.15, 10).rotateZ(Math.PI / 2)]), black);
    const rotor = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.012, 3, 24).rotateY(Math.PI / 2).translate(-0.06, 0, 0), metal);
    const sp = [];
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, sd = i % 2 ? 0.035 : -0.035; sp.push(sd, Math.cos(a + 0.15) * 0.025, Math.sin(a + 0.15) * 0.025, 0, Math.cos(a) * (R - 0.11), Math.sin(a) * (R - 0.11)); }
    const spokes = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)), new THREE.LineBasicMaterial({ color: 0x8a8a8a }));
    w.add(tire, rim, rotor, spokes);
    return w;
  };
  const wF = makeWheel(), wR = makeWheel();
  wF.position.copy(front).add(V(0, 0, -0.47)); steer.add(wF);
  wR.position.copy(rear); bike.add(wR);
  // Fahrer
  const jersey = new THREE.MeshStandardMaterial({ map: jerseyTex(cfg), roughness: 0.82 });
  const pants = new THREE.MeshStandardMaterial({ map: pantsTex(cfg), roughness: 0.9 });
  const sleeve = new THREE.MeshStandardMaterial({ color: cfg.jersey, roughness: 0.82 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.8 });
  const pad = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
  const helmetM = new THREE.MeshPhysicalMaterial({ color: cfg.helmet, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const lens = new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.05, metalness: 1, envMapIntensity: 1.6 });
  const body = new THREE.Group(); tilt.add(body);
  const mk = (g, m) => { const x = new THREE.Mesh(g, m); x.castShadow = true; body.add(x); return x; };
  const torsoProfile = [[0.12, 0], [0.145, 0.1], [0.15, 0.25], [0.165, 0.38], [0.155, 0.45], [0.09, 0.53], [0.05, 0.56]].map(([r, y]) => new THREE.Vector2(r, y));
  const torsoG = new THREE.LatheGeometry(torsoProfile, 20).scale(1, 1 / 0.56, 0.72);
  const parts = {
    torso: mk(torsoG, jersey),
    pelvis: mk(new THREE.SphereGeometry(1, 14, 10).scale(0.15, 0.12, 0.13), pants),
    neck: mk(new THREE.TorusGeometry(0.075, 0.035, 8, 16).rotateX(Math.PI / 2), pad),
    helmet: mk(new THREE.SphereGeometry(1, 20, 14).scale(0.15, 0.155, 0.18), helmetM),
    chin: mk(new THREE.TorusGeometry(0.12, 0.04, 8, 16, Math.PI).rotateX(Math.PI / 2 + 0.25).rotateY(Math.PI), helmetM),
    peak: mk(new THREE.BoxGeometry(0.2, 0.012, 0.1).rotateX(-0.25), helmetM),
    goggle: mk(new THREE.BoxGeometry(0.17, 0.055, 0.04), lens),
    strap: mk(new THREE.TorusGeometry(0.152, 0.012, 4, 24, Math.PI * 1.3).rotateX(Math.PI / 2).rotateY(Math.PI * 0.85), glove),
  };
  for (const s of ['L', 'R']) {
    parts['ua' + s] = mk(unitTaper(0.055, 0.047), sleeve);
    parts['fa' + s] = mk(unitTaper(0.047, 0.04), sleeve);
    parts['hand' + s] = mk(new THREE.SphereGeometry(1, 10, 8).scale(0.045, 0.045, 0.06), glove);
    parts['th' + s] = mk(unitTaper(0.088, 0.068, 12), pants);
    parts['sh' + s] = mk(unitTaper(0.064, 0.048, 12), pants);
    parts['knee' + s] = mk(new THREE.SphereGeometry(1, 10, 8).scale(0.07, 0.1, 0.06), pad);
    parts['shoe' + s] = mk(new THREE.BoxGeometry(0.11, 0.08, 0.28), glove);
  }
  root.userData = { tilt, bike, body, parts, crank, pedals, steer, wheels: [wF, wR], frame };
  return root;
}
// Pose des Fahrers aus Fahrzustand (alles im Rad-Koordinatensystem)
const RP = {}; for (const k of ['bb', 'hip', 'chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'gL', 'gR', 'pL', 'pR', 'kL', 'kR', 'hpL', 'hpR', 'tmp']) RP[k] = new THREE.Vector3();
function poseRider(model, st) {
  const u = model.userData, p = u.parts;
  const c = st.crouch, b = st.brake, comp = st.comp || 0;
  u.crank.rotation.x = -st.crankA;
  u.pedals.forEach((m) => { m.rotation.x = st.crankA; });
  u.steer.rotation.y = st.steer * 0.35;
  u.wheels[0].rotation.x = st.wheelRot; u.wheels[1].rotation.x = st.wheelRot;
  u.bike.position.y = -comp * 0.04;
  // Pedale -> Füße
  const ca = st.crankA;
  RP.pL.set(0.14, 0.34 + Math.sin(ca) * 0.17 + 0.05, -0.04 + Math.cos(ca) * 0.17);
  RP.pR.set(-0.14, 0.34 - Math.sin(ca) * 0.17 + 0.05, -0.04 - Math.cos(ca) * 0.17);
  RP.pL.y -= comp * 0.04; RP.pR.y -= comp * 0.04;
  const lift = st.air ? 0.06 : 0;
  RP.hip.set(st.bodyX || 0, 1.0 - 0.13 * c - comp * 0.12 + lift, -0.26 - 0.13 * b + 0.05 * c);
  const ta = 0.75 + 0.3 * c - 0.25 * b;
  RP.chest.set(RP.hip.x * 0.6, RP.hip.y + Math.cos(ta) * 0.5, RP.hip.z + Math.sin(ta) * 0.5);
  // Griffe mit Lenkeinschlag
  const sa = st.steer * 0.35, cs = Math.cos(sa), sn = Math.sin(sa);
  for (const [k, sx] of [['gL', 0.35], ['gR', -0.35]]) { const lx = sx, lz = -0.07; RP[k].set(lx * cs + lz * sn, 1.075 - comp * 0.04, 0.47 - lx * sn + lz * cs); }
  RP.shL.set(RP.chest.x + 0.19, RP.chest.y - 0.04, RP.chest.z - 0.02);
  RP.shR.set(RP.chest.x - 0.19, RP.chest.y - 0.04, RP.chest.z - 0.02);
  RP.neck.set(RP.chest.x, RP.chest.y + 0.05, RP.chest.z + 0.04);
  RP.head.set(RP.chest.x, RP.chest.y + 0.17, RP.chest.z + 0.1);
  RP.hpL.set(RP.hip.x + 0.1, RP.hip.y - 0.02, RP.hip.z); RP.hpR.set(RP.hip.x - 0.1, RP.hip.y - 0.02, RP.hip.z);
  ik2(RP.hpL, RP.pL, 0.46, 0.45, V(0.25, 0, 1), RP.kL); ik2(RP.hpR, RP.pR, 0.46, 0.45, V(-0.25, 0, 1), RP.kR);
  ik2(RP.shL, RP.gL, 0.3, 0.29, V(0.9, -0.1, -0.4), RP.elL); ik2(RP.shR, RP.gR, 0.3, 0.29, V(-0.9, -0.1, -0.4), RP.elR);
  setLimb(p.torso, RP.hip, RP.chest.clone().addScaledVector(RP.tmp.subVectors(RP.chest, RP.hip).normalize(), 0.08));
  p.pelvis.position.copy(RP.hip); p.pelvis.rotation.x = ta - 0.4;
  p.neck.position.copy(RP.neck); p.neck.rotation.x = ta * 0.5;
  const hq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15 + (st.look || 0), 0, 0));
  for (const k of ['helmet', 'chin', 'peak', 'goggle', 'strap']) p[k].quaternion.copy(hq);
  p.helmet.position.copy(RP.head);
  p.chin.position.copy(RP.head).add(V(0, -0.07, 0.07).applyQuaternion(hq));
  p.peak.position.copy(RP.head).add(V(0, 0.12, 0.16).applyQuaternion(hq));
  p.goggle.position.copy(RP.head).add(V(0, 0.02, 0.17).applyQuaternion(hq));
  p.strap.position.copy(RP.head).add(V(0, 0.02, 0).applyQuaternion(hq));
  for (const [s, sh, el, g, hp, kn, pd] of [['L', RP.shL, RP.elL, RP.gL, RP.hpL, RP.kL, RP.pL], ['R', RP.shR, RP.elR, RP.gR, RP.hpR, RP.kR, RP.pR]]) {
    setLimb(p['ua' + s], sh, el); setLimb(p['fa' + s], el, g); p['hand' + s].position.copy(g);
    setLimb(p['th' + s], hp, kn); setLimb(p['sh' + s], kn, pd);
    p['knee' + s].position.copy(kn).add(RP.tmp.subVectors(pd, kn).normalize().multiplyScalar(0.06)).add(V(0, 0, 0.05));
    p['knee' + s].quaternion.setFromUnitVectors(_UP, RP.tmp);
    p['shoe' + s].position.copy(pd).add(V(0, -0.01, 0.03));
  }
}

let skidMarks = null;
