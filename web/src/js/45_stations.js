
// ------------------------------------------------------------------
// Bergstation, Talstation, Seilbahn, Almhütten
// ------------------------------------------------------------------
function hut(w, d, h, wallCol, roofCol) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: wallCol, roughness: 0.85 }));
  wall.position.y = h / 2; wall.castShadow = wall.receiveShadow = true; g.add(wall);
  const roofShape = new THREE.Shape(); roofShape.moveTo(-w / 2 - 0.8, 0); roofShape.lineTo(0, h * 0.45); roofShape.lineTo(w / 2 + 0.8, 0); roofShape.lineTo(-w / 2 - 0.8, 0);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: d + 1.6, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: roofCol, roughness: 0.75 }));
  roof.position.set(0, h, -d / 2 - 0.8); roof.castShadow = true; g.add(roof);
  return g;
}
const gondolas = [];
let cablePath = null;
function buildStationsAndLift() {
  const grp = new THREE.Group();
  const a = trailPoint(0, 0, {}), b = trailPoint(trail.L, 0, {});
  const ta = trail.yaw[0], tb = trail.yaw[trail.n - 1];
  stationA = { x: a.x - Math.sin(ta) * 22 + Math.cos(ta) * 14, z: a.z - Math.cos(ta) * 22 - Math.sin(ta) * 14 };
  stationB = { x: b.x + Math.sin(tb) * 34 - Math.cos(tb) * 18, z: b.z + Math.cos(tb) * 34 + Math.sin(tb) * 18 };
  const dirAB = Math.atan2(stationB.x - stationA.x, stationB.z - stationA.z);
  for (const [st, label] of [[stationA, 'BERGSTATION'], [stationB, 'TALSTATION']]) {
    const y = hAt(st.x, st.z);
    const h = hut(16, 24, 8, 0xb7b1a5, 0x3b2a20);
    h.position.set(st.x, y - 1.2, st.z); h.rotation.y = dirAB; grp.add(h);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.6), new THREE.MeshStandardMaterial({ map: textTexture([[label + ' KAMPENWANDBAHN', '700 64px "Saira Condensed", Arial Narrow, sans-serif']], 1024, 160, '#1d1f1a', '#f4efe6'), roughness: 0.7 }));
    sign.position.set(st.x + Math.cos(dirAB) * 8.05, y + 5, st.z - Math.sin(dirAB) * 8.05); sign.rotation.y = dirAB + Math.PI / 2; grp.add(sign);
    st.y = y + 6.5;
  }
  // Seilbahn mit Stützen
  const N = 9, pts = [];
  const pyM = new THREE.MeshStandardMaterial({ color: 0x8b8f93, roughness: 0.4, metalness: 0.7 });
  const tops = [[stationA.x, stationA.y, stationA.z]];
  for (let i = 1; i < N; i++) {
    const t = i / N, x = lerp(stationA.x, stationB.x, t), z = lerp(stationA.z, stationB.z, t), y = hAt(x, z);
    const py = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 16, 6), pyM); py.position.set(x, y + 8, z); py.castShadow = true; grp.add(py);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 0.6), pyM); arm.position.set(x, y + 16, z); arm.rotation.y = dirAB + Math.PI / 2; grp.add(arm);
    tops.push([x, y + 16, z]);
  }
  tops.push([stationB.x, stationB.y, stationB.z]);
  const lines = [];
  for (const off of [-3, 3]) {
    const path = [];
    for (let i = 0; i < tops.length - 1; i++) {
      const [ax, ay, az] = tops[i], [bx, by, bz] = tops[i + 1];
      for (let k = 0; k < 12; k++) {
        const t = k / 12, sag = Math.sin(t * Math.PI) * Math.hypot(bx - ax, bz - az) * 0.025;
        path.push(new THREE.Vector3(lerp(ax, bx, t) + Math.cos(dirAB) * off, lerp(ay, by, t) - sag, lerp(az, bz, t) - Math.sin(dirAB) * off));
      }
    }
    path.push(new THREE.Vector3(tops.at(-1)[0] + Math.cos(dirAB) * off, tops.at(-1)[1], tops.at(-1)[2] - Math.sin(dirAB) * off));
    lines.push(path);
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path), new THREE.LineBasicMaterial({ color: 0x2a2a2a })));
  }
  cablePath = lines.map((p) => new THREE.CatmullRomCurve3(p));
  const cabM = new THREE.MeshStandardMaterial({ color: 0xc7392a, roughness: 0.4, metalness: 0.3 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x1b2630, roughness: 0.1, metalness: 0.6 });
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.7, 1.6), cabM); cab.position.y = -2.6; cab.castShadow = true;
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.6, 1.3), glassM); win.position.y = -2.3;
    const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8), pyM); hanger.position.y = -0.9;
    g.add(cab, win, hanger); grp.add(g);
    gondolas.push({ g, line: i % 2, t: (i >> 1) / 8 });
  }
  // Alm-Hütten auf Lichtungen neben der Strecke
  const rand = mulberry32(7);
  for (const s of [420, 1180, 1900]) {
    const side = rand() < 0.5 ? -1 : 1, pt = trailPoint(s, side * 30, {});
    const h = hut(9, 12, 4.5, 0x6b4a32, 0x4a4038); h.position.set(pt.x, hAt(pt.x, pt.z) - 0.6, pt.z); h.rotation.y = pt.yaw; grp.add(h);
    addObstacle(pt.x, pt.z, 8); reservedSpots.push([pt.x, pt.z, 13]);
  }
  // Gipfelkreuz auf dem höchsten Punkt
  let best = -1, bi = 0;
  for (let id = 0; id < G * G; id += 3) if (H[id] > best) { best = H[id]; bi = id; }
  const gx = (bi % G) * CELL - HALF, gz = Math.floor(bi / G) * CELL - HALF;
  const crossM = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.7 });
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 0.4), crossM); c1.position.set(gx, best + 4, gz);
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 0.4), crossM); c2.position.set(gx, best + 6.5, gz);
  grp.add(c1, c2);
  return grp;
}

// Start- und Zielbogen, Schilder an den Abkürzungen
function buildCourse() {
  const grp = new THREE.Group();
  const arch = (s, label, sub) => {
    const pt = trailPoint(s, 0, {}), y = hAt(pt.x, pt.z);
    const g = new THREE.Group();
    const postM = new THREE.MeshStandardMaterial({ color: 0x1d1f1a, roughness: 0.5, metalness: 0.4 });
    const w = TRAIL_HALF * 2 + 3.4;
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.6, 0.35), postM); p.position.set(sx * w / 2, 2.3, 0); p.castShadow = true; g.add(p); }
    const tex = textTexture([[label, '800 120px "Saira Condensed", Arial Narrow, sans-serif'], [sub, '600 54px Barlow, sans-serif']], 1024, 256, '#e8462b', '#f4efe6');
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, 0.12), [postM, postM, postM, postM, face, face]);
    banner.position.set(0, 4.1, 0); banner.castShadow = true; g.add(banner);
    g.position.set(pt.x, y, pt.z); g.rotation.y = pt.yaw;
    grp.add(g);
  };
  arch(4, 'KAMPENWAND', 'START · BERGSTATION 1437 m');
  arch(trail.L - 2, 'ZIEL', 'TALSTATION ASCHAU 624 m');
  const dtex = signTex('diamond');
  for (const sc of shortcuts) {
    const k = 6, side = 1;
    const x = sc.X[k] + Math.cos(sc.YAW[k]) * (SC_HALF + 1.2) * side, z = sc.Z[k] - Math.sin(sc.YAW[k]) * (SC_HALF + 1.2) * side;
    const ka = trailIdx(sc.sA);
    grp.add(makeSign(dtex, { x, y: hAt(x, z), z }, trail.yaw[ka] + Math.PI));
  }
  return grp;
}
