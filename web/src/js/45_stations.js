
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
  // Stationsgebäude: Betonsockel, Holzfassade mit Fensterband, offene Einfahrt mit Umlenkrad
  const M = {
    concrete: new THREE.MeshStandardMaterial({ color: 0x8e8a82, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.8 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x40302a, roughness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x223646, roughness: 0.08, metalness: 0.7, envMapIntensity: 1.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x7d8a86, roughness: 0.45, metalness: 0.65 }),
    red: new THREE.MeshStandardMaterial({ color: 0xd4141c, roughness: 0.35, metalness: 0.25 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf2c418, roughness: 0.35, metalness: 0.2 }),
    green: new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.5, metalness: 0.4 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }),
  };
  const box = (w, h, d, m, x, y, z, parent, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const bavTex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = '#1e7fd0'; for (let i = -4; i < 12; i++) for (let j = -2; j < 6; j++) { const cx = i * 32 + (j % 2) * 16, cy = j * 24; x.beginPath(); x.moveTo(cx, cy - 12); x.lineTo(cx + 16, cy); x.lineTo(cx, cy + 12); x.lineTo(cx - 16, cy); x.fill(); } });
  const bavM = flagWave(new THREE.MeshStandardMaterial({ map: bavTex, side: THREE.DoubleSide, roughness: 0.8 }));
  for (const [st, label, top] of [[stationA, 'BERGSTATION', true], [stationB, 'TALSTATION', false]]) {
    // Höhe: Mittel über die Grundfläche, bergseitig steckt das Haus im Hang
    let y = 0; for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) y += hAt(st.x + i * 9, st.z + k * 13) / 9;
    const g = new THREE.Group();
    g.position.set(st.x, y - 1.2, st.z); g.rotation.y = dirAB + (top ? 0 : Math.PI); grp.add(g);
    // Sockel, Halle, Fensterband
    box(18, 17.2, 26, M.concrete, 0, 3.2 - 8.6, 0, g); // Sockel reicht bis in den Hang
    box(9, 14, 6, M.concrete, 0, 5.1 - 7, 14.2, g);
    box(17.6, 4.6, 25.6, M.wood, 0, 5.5, -2, g);
    for (const sx of [-1, 1]) {
      box(0.1, 1.5, 22, M.glass, sx * 8.85, 5.8, -2.5, g);
      for (let k = 0; k < 12; k++) box(0.14, 1.6, 0.14, M.white, sx * 8.88, 5.8, -13.3 + k * 1.9, g);
      box(0.2, 0.15, 22.2, M.white, sx * 8.88, 6.65, -2.5, g); box(0.2, 0.15, 22.2, M.white, sx * 8.88, 5.0, -2.5, g);
    }
    // Dach mit weitem Überstand
    const rs = new THREE.Shape(); rs.moveTo(-10.6, 0); rs.lineTo(0, 3.6); rs.lineTo(10.6, 0); rs.lineTo(-10.6, 0);
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 29, bevelEnabled: false }), M.roof); roof.position.set(0, 7.8, -16.5); roof.castShadow = true; g.add(roof);
    box(21.4, 0.25, 29.2, M.wood, 0, 7.85, -2, g);
    // offene Einfahrt zur Seilseite mit großem Umlenkrad
    const hall = new THREE.Group(); hall.position.set(0, 0, 11.6); g.add(hall);
    box(9, 0.3, 6, M.concrete, 0, 5.1, 2.6, hall);
    for (const sx of [-1, 1]) for (const sz of [5.4, 0]) box(0.4, 4.2, 0.4, M.steel, sx * 4.2, 7.1, sz, hall);
    box(9.4, 0.5, 6.2, M.steel, 0, 9.2, 2.6, hall);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.18, 8, 40).rotateX(Math.PI / 2), M.red); wheel.position.set(0, 7.4, 2.6); hall.add(wheel);
    for (let k = 0; k < 6; k++) { const sp = box(5.2, 0.12, 0.12, M.steel, 0, 7.4, 2.6, hall); sp.rotation.y = k * Math.PI / 6; }
    // Schild und Bayernfahnen
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.7), new THREE.MeshStandardMaterial({ map: textTexture([[label + ' · KAMPENWANDBAHN', '700 64px "Saira Condensed", Arial Narrow, sans-serif']], 1024, 150, '#d4141c', '#ffffff'), roughness: 0.6 }));
    sign.position.set(8.92, 9.0, -2); sign.rotation.y = Math.PI / 2; g.add(sign);
    const sign2 = sign.clone(); sign2.position.x = -8.92; sign2.rotation.y = -Math.PI / 2; g.add(sign2);
    for (let k = 0; k < 3; k++) {
      const fx = 11 + k * 2.4, fz = -12;
      box(0.1, 9, 0.1, M.white, fx, 4.5 + 1.2, fz, g);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3, 6, 10).translate(0.62, 0, 0), bavM); fl.position.set(fx, 8.4, fz); fl.castShadow = true; g.add(fl);
    }
    if (top) {
      // Sonnenterrasse mit Tischen und roten Schirmen
      box(16, 0.3, 9, M.wood, 0, 3.35, -17.6, g);
      for (let k = 0; k < 6; k++) {
        const tx = -6 + (k % 3) * 6, tz = -15.2 - Math.floor(k / 3) * 4.6;
        box(1.6, 0.08, 0.8, M.wood, tx, 4.25, tz, g); box(0.1, 0.8, 0.1, M.dark, tx, 3.85, tz, g);
        for (const bz of [-0.75, 0.75]) box(1.6, 0.06, 0.3, M.wood, tx, 3.95, tz + bz, g);
        const um = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.6, 8, 1, true), M.red); um.position.set(tx, 6.1, tz); um.castShadow = true; g.add(um);
        box(0.06, 2.6, 0.06, M.white, tx, 5, tz, g);
      }
      const alm = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.2), new THREE.MeshStandardMaterial({ map: textTexture([['SONNENALM', '700 90px "Saira Condensed", Arial Narrow, sans-serif']], 512, 90, '#5a3a1e', '#f4e6c8'), roughness: 0.7 }));
      alm.position.set(0, 6.6, -14.85); alm.rotation.y = Math.PI; g.add(alm);
    } else buildTalstationDetails(g, M, box, y, trailPoint(trail.L, 0, {}));
    st.y = y + 6.5;
  }
  // Seilbahn mit Gitterstützen
  const N = 9;
  const tops = [[stationA.x, stationA.y, stationA.z]];
  const beams = [];
  const beam = (a, b, r) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); const g = new THREE.BoxGeometry(r, L, r); g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); beams.push(g); };
  const ca = Math.cos(dirAB), sa = Math.sin(dirAB);
  const W = (x, y, z, u, v, h) => new THREE.Vector3(x + ca * u + sa * v, y + h, z - sa * u + ca * v); // u quer, v längs
  const wheels = [];
  for (let i = 1; i < N; i++) {
    const t = i / N, x = lerp(stationA.x, stationB.x, t), z = lerp(stationA.z, stationB.z, t);
    let y = Infinity; for (const [du, dv] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) y = Math.min(y, hAt(x + ca * du + sa * dv, z - sa * du + ca * dv));
    const H0 = 17, rings = 6;
    const corner = (k, h) => { const f = 1.7 - (h / H0) * 1.05, cu = k & 1 ? f : -f, cv = k & 2 ? f : -f; return W(x, y - 0.5, z, cu, cv, h); };
    for (let k = 0; k < 4; k++) beam(corner(k, 0), corner(k, H0), 0.16);
    const ring = [0, 1, 3, 2, 0];
    for (let r = 0; r <= rings; r++) {
      const h0 = (r / rings) * H0, h1 = ((r + 1) / rings) * H0;
      for (let e = 0; e < 4; e++) {
        beam(corner(ring[e], h0), corner(ring[e + 1], h0), 0.08);
        if (r < rings) beam(corner(ring[e], h0), corner(ring[e + 1], h1), 0.06);
      }
    }
    // Querträger mit Rollenbatterien, Leiter
    beam(W(x, y - 0.5, z, -3.6, 0, H0), W(x, y - 0.5, z, 3.6, 0, H0), 0.4);
    for (const u of [-3, 3]) {
      beam(W(x, y - 0.5, z, u, -1.5, H0 - 0.35), W(x, y - 0.5, z, u, 1.5, H0 - 0.35), 0.18);
      for (let k = 0; k < 4; k++) wheels.push(W(x, y - 0.5, z, u, -1.2 + k * 0.8, H0 - 0.1));
    }
    for (let h = 0.5; h < H0; h += 0.45) beam(W(x, y - 0.5, z, -1.85 + h * 0.06, -1.95 + (h / H0) * 1.0, h), W(x, y - 0.5, z, -1.35 + h * 0.06, -1.95 + (h / H0) * 1.0, h), 0.04);
    tops.push([x, y - 0.5 + H0 + 0.25, z]);
  }
  const towerGeo = mergeGeometries(beams, false);
  const towers = new THREE.Mesh(towerGeo, M.steel); towers.castShadow = true; towers.receiveShadow = true; grp.add(towers);
  const wg = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 14).rotateZ(Math.PI / 2);
  const wim = new THREE.InstancedMesh(wg, M.dark, wheels.length); const wm = new THREE.Matrix4(), wq = new THREE.Quaternion().setFromAxisAngle(_UP, dirAB);
  wheels.forEach((p, k) => wim.setMatrixAt(k, wm.compose(p, wq, new THREE.Vector3(1, 1, 1)))); grp.add(wim);
  tops.push([stationB.x, stationB.y, stationB.z]);
  const lines = [];
  const ropeM = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.8 });
  for (const off of [-3, 3]) {
    const path = [];
    for (let i = 0; i < tops.length - 1; i++) {
      const [ax, ay, az] = tops[i], [bx, by, bz] = tops[i + 1];
      for (let k = 0; k < 12; k++) {
        const t = k / 12, sag = Math.sin(t * Math.PI) * Math.hypot(bx - ax, bz - az) * 0.025;
        path.push(new THREE.Vector3(lerp(ax, bx, t) + ca * off, lerp(ay, by, t) - sag, lerp(az, bz, t) - sa * off));
      }
    }
    path.push(new THREE.Vector3(tops.at(-1)[0] + ca * off, tops.at(-1)[1], tops.at(-1)[2] - sa * off));
    lines.push(path);
    const curve = new THREE.CatmullRomCurve3(path);
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, path.length * 3, 0.045, 5, false), ropeM));
  }
  cablePath = lines.map((p) => new THREE.CatmullRomCurve3(p));
  // Kabinen: rot mit weißem Dach, Fensterband rundum, Tür, Bügel und Klemme am Seil
  const numTex = (n) => textTexture([[String(n), '800 100px "Saira Condensed", Arial Narrow, sans-serif']], 128, 128, '#ffffff', '#d4141c');
  const NG = 24;
  for (let i = 0; i < NG; i++) {
    const g = new THREE.Group(), cab = new THREE.Group(); g.add(cab);
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; cab.add(o); return o; };
    const CM = i % 3 === 1 ? M.yellow : M.red;
    add(new THREE.BoxGeometry(1.5, 1.0, 1.4), CM, 0, -3.25, 0);
    add(new THREE.BoxGeometry(1.52, 0.62, 1.42), M.glass, 0, -2.45, 0);
    for (const sx of [-0.74, 0.74]) for (const sz of [-0.68, 0.68]) add(new THREE.BoxGeometry(0.07, 0.64, 0.07), CM, sx, -2.45, sz);
    add(new THREE.BoxGeometry(1.54, 0.1, 1.44), M.white, 0, -2.78, 0);
    add(new THREE.BoxGeometry(1.5, 0.22, 1.4), CM, 0, -2.03, 0);
    add(new THREE.CylinderGeometry(0.62, 0.78, 0.22, 16).scale(1.05, 1, 0.95), M.white, 0, -1.82, 0);
    add(new THREE.BoxGeometry(0.02, 0.9, 0.62), M.dark, 0.76, -3.2, 0);
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshStandardMaterial({ map: numTex(i + 1) })); nm.position.set(0, -3.35, 0.705); cab.add(nm);
    add(new THREE.CylinderGeometry(0.05, 0.05, 1.5), M.green, 0, -0.95, 0);
    add(new THREE.BoxGeometry(0.5, 0.08, 0.08), M.green, 0, -1.68, 0);
    add(new THREE.BoxGeometry(0.22, 0.28, 0.5), M.dark, 0, -0.12, 0);
    grp.add(g);
    gondolas.push({ g, cab, line: i % 2, t: (i >> 1) / (NG / 2), dir: dirAB });
  }
  // Alm-Hütten auf Lichtungen neben der Strecke
  const rand = mulberry32(7);
  for (const s of [420, 1180, 1900]) {
    const side = rand() < 0.5 ? -1 : 1, pt = trailPoint(s, side * 30, {});
    const h = hut(9, 12, 4.5, 0x6b4a32, 0x4a4038); h.position.set(pt.x, hAt(pt.x, pt.z) - 0.6, pt.z); h.rotation.y = pt.yaw; grp.add(h);
    addObstacle(pt.x, pt.z, 8); reservedSpots.push([pt.x, pt.z, 13]);
  }
  return grp;
}

// Talstation: weiß verputztes Erdgeschoss mit Sprossenfenstern und grünen Läden,
// umlaufender Holzbalkon mit Geranien, Kasse mit Vordach, Uhr am Giebel,
// gepflasterter Vorplatz mit Bänken, Blumenkübeln, Radständer und Biergarten
function buildTalstationDetails(g, M, box, y0, fin) {
  // Eingang und Vorplatz auf der Seite, die zum Ziel schaut
  const S = ((fin.x - g.position.x) * Math.cos(g.rotation.y) - (fin.z - g.position.z) * Math.sin(g.rotation.y)) >= 0 ? 1 : -1;
  const plaster = new THREE.MeshStandardMaterial({ color: 0xeee8dc, roughness: 0.92 });
  const shutter = new THREE.MeshStandardMaterial({ color: 0x2f5a34, roughness: 0.7 });
  const frame = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.6 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.85 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.95 });
  // verputztes Erdgeschoss über dem Sockel
  box(18.3, 3.3, 26.3, plaster, 0, 1.75, 0, g);
  box(18.5, 0.5, 26.5, stone, 0, 0.25, 0, g);
  const win = (x, z, ry) => {
    const w = new THREE.Group(); w.position.set(x, 1.9, z); w.rotation.y = ry; g.add(w);
    box(1.2, 1.5, 0.08, M.glass, 0, 0, 0.02, w); box(1.36, 0.1, 0.12, frame, 0, 0.78, 0.04, w); box(1.36, 0.1, 0.16, frame, 0, -0.78, 0.06, w);
    box(0.06, 1.5, 0.1, frame, 0, 0, 0.05, w); box(1.2, 0.06, 0.1, frame, 0, 0.15, 0.05, w);
    for (const sx of [-1, 1]) { const sh = box(0.6, 1.6, 0.05, shutter, sx * 0.94, 0, 0.06, w); for (let k = 0; k < 6; k++) box(0.56, 0.03, 0.03, darkWood, sx * 0.94, -0.65 + k * 0.26, 0.1, w); }
    return w;
  };
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) if (!(sx === S && k === 2)) win(sx * 9.18, -10.5 + k * 4, sx * Math.PI / 2);
  for (let k = 0; k < 3; k++) win(-5 + k * 5, -13.18, Math.PI);
  // Eingang mit Kasse und Vordach auf der Talseite
  const door = new THREE.Group(); door.position.set(9.2 * S, 1.1, -2.5); door.rotation.y = S * Math.PI / 2; g.add(door);
  box(2.4, 2.1, 0.1, M.glass, 0, 1.05, 0.02, door); box(2.7, 0.15, 0.2, darkWood, 0, 2.15, 0.06, door);
  box(0.12, 2.1, 0.2, darkWood, 0, 1.05, 0.06, door);
  box(4.6, 0.18, 2.4, darkWood, 0, 2.6, 1.2, door);
  for (const sx of [-1, 1]) box(0.16, 3.4, 0.16, darkWood, sx * 2.1, 0.9, 2.25, door);
  const kasse = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.6), new THREE.MeshStandardMaterial({ map: textTexture([['KASSE · TICKETS · BERGFAHRT', '700 56px "Saira Condensed", Arial Narrow, sans-serif']], 1024, 170, '#5a3a1e', '#f4e6c8'), roughness: 0.7 }));
  kasse.position.set(0, 3.0, 2.43); door.add(kasse);
  // Holzbalkon mit Geranien rundum am Obergeschoss
  const geran = [], leafG = [];
  const balcony = (len, x, z, ry) => {
    const b = new THREE.Group(); b.position.set(x, 3.35, z); b.rotation.y = ry; g.add(b);
    box(len, 0.16, 1.3, darkWood, 0, 0, 0.65, b);
    box(len, 0.1, 0.1, darkWood, 0, 1.0, 1.25, b);
    for (let u = -len / 2 + 0.1; u <= len / 2; u += 0.16) box(0.12, 0.9, 0.035, M.wood, u, 0.5, 1.27, b);
    box(len, 0.28, 0.3, darkWood, 0, 1.18, 1.38, b);
    for (let u = -len / 2 + 0.2; u < len / 2; u += 0.22) { geran.push(b, u, 1.4); }
    for (let u = -len / 2 + 1; u < len / 2; u += 2.6) box(0.1, 0.9, 1.3, darkWood, u, -0.5, 0.65, b);   // Konsolen
  };
  balcony(25.4, 9.15, -2, Math.PI / 2); balcony(25.4, -9.15, -2, -Math.PI / 2); balcony(17.6, 0, -13.15, Math.PI);
  const gN = geran.length / 3, flowerG = new THREE.IcosahedronGeometry(0.13, 0), leafGeo = new THREE.IcosahedronGeometry(0.15, 0);
  const fl = new THREE.InstancedMesh(flowerG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), gN * 2), lv = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x2a5a22, roughness: 0.9 }), gN);
  const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), c = new THREE.Color(), GC = [0xd01a2a, 0xe0306a, 0xc8102e, 0xf06a8a];
  g.updateMatrixWorld(true);
  for (let i = 0; i < gN; i++) {
    const b = geran[i * 3], u = geran[i * 3 + 1];
    b.updateMatrixWorld(true);
    v.set(u, 1.42, 1.38); lv.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z).premultiply(b.matrix).premultiply(g.matrix));
    for (let k = 0; k < 2; k++) {
      v.set(u + (k - 0.5) * 0.1, 1.5 + Math.random() * 0.08, 1.38 + (Math.random() - 0.5) * 0.15);
      fl.setMatrixAt(i * 2 + k, m4.makeTranslation(v.x, v.y, v.z).premultiply(b.matrix).premultiply(g.matrix)); fl.setColorAt(i * 2 + k, c.setHex(GC[(i + k) % 4]));
    }
  }
  // Instanzen liegen in Weltkoordinaten, also an die Gruppe des Ganzen hängen
  g.parent.add(fl, lv);
  // Uhr am Giebel
  const clockTex = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#f6f3ec'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill(); x.strokeStyle = '#1a1a1a'; x.lineWidth = 5; x.stroke();
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; x.fillStyle = '#1a1a1a'; x.fillRect(64 + Math.sin(a) * 50 - 2, 64 - Math.cos(a) * 50 - 5, 4, 10); }
    x.lineWidth = 6; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + 28, 64 - 16); x.stroke(); x.lineWidth = 4; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 - 6, 64 - 46); x.stroke(); });
  const clock = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshStandardMaterial({ map: clockTex, roughness: 0.5 }));
  clock.position.set(0, 9.3, -16.56); clock.rotation.y = Math.PI; g.add(clock);
  // Vorplatz: gepflastert, folgt dem Gelände
  const PW = 34, PD = 30, pg = new THREE.PlaneGeometry(PW, PD, 24, 22).rotateX(-Math.PI / 2), pp = pg.attributes.position;
  const pav = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#8a857c'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const l = 118 + Math.floor(Math.random() * 30); x.fillStyle = `rgb(${l},${l - 4},${l - 10})`; x.fillRect(i * 16 + (j % 2) * 8 + 1, j * 16 + 1, 14, 14); } });
  pav.wrapS = pav.wrapT = THREE.RepeatWrapping; pav.repeat.set(PW / 4, PD / 4);
  const plaza = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: pav, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }));
  plaza.position.set(0, 0, 0); plaza.rotation.y = g.rotation.y;
  const ox = g.position.x, oz = g.position.z, ca = Math.cos(g.rotation.y), sa = Math.sin(g.rotation.y);
  // Platz liegt vor der Talseite des Hauses (lokal +x)
  for (let i = 0; i < pp.count; i++) {
    const lx = S * (pp.getX(i) + 9.5 + PW / 2), lz = pp.getZ(i) - 2;
    const wx = ox + lx * ca + lz * sa, wz = oz - lx * sa + lz * ca;
    pp.setXYZ(i, wx, hAt(wx, wz) + 0.06, wz);
  }
  pg.computeVertexNormals(); plaza.rotation.y = 0; plaza.receiveShadow = true; g.parent.add(plaza);
  const L = (lx, lz) => { const wx = ox + lx * ca + lz * sa, wz = oz - lx * sa + lz * ca; return [wx, hAt(wx, wz), wz]; };
  const place = (o, lx, lz, ry = 0) => { const [x, yy, z] = L(lx * S, lz); o.position.set(x, yy, z); o.rotation.y = g.rotation.y + ry * S; g.parent.add(o); return o; };
  // Bänke, Blumenkübel, Radständer, Biergarten mit Schirmen
  const bench = () => { const o = new THREE.Group(); box(1.8, 0.06, 0.45, M.wood, 0, 0.45, 0, o); box(1.8, 0.4, 0.06, M.wood, 0, 0.75, -0.22, o); for (const sx of [-0.75, 0.75]) box(0.06, 0.45, 0.4, M.dark, sx, 0.22, 0, o); return o; };
  const tub = () => { const o = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.6, 12), darkWood); t.position.y = 0.3; t.castShadow = true; o.add(t);
    for (let k = 0; k < 9; k++) { const f = new THREE.Mesh(flowerG, new THREE.MeshStandardMaterial({ color: GC[k % 4], roughness: 0.8 })); f.position.set(Math.cos(k * 2.4) * 0.3, 0.68 + (k % 3) * 0.05, Math.sin(k * 2.4) * 0.3); o.add(f); }
    const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshStandardMaterial({ color: 0x2a5a22, roughness: 0.9 })); l.position.y = 0.62; l.scale.y = 0.5; o.add(l); return o; };
  for (let k = 0; k < 4; k++) place(bench(), 10.5, -12 + k * 6.5, Math.PI / 2);
  for (let k = 0; k < 5; k++) place(tub(), 10.6, -14.5 + k * 6.5 + 3.2);
  const rack = new THREE.Group();
  for (let k = 0; k < 8; k++) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 6, 16, Math.PI), M.steel); h.position.set(k * 0.7, 0, 0); h.castShadow = true; rack.add(h); }
  place(rack, 12, 10, Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const t = new THREE.Group();
    box(2.2, 0.06, 0.7, M.wood, 0, 0.78, 0, t); box(0.1, 0.78, 0.6, M.dark, -0.9, 0.39, 0, t); box(0.1, 0.78, 0.6, M.dark, 0.9, 0.39, 0, t);
    for (const bz of [-0.65, 0.65]) box(2.2, 0.05, 0.28, M.wood, 0, 0.45, bz, t);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.6, 8, 1, true), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xf4efe6 : 0x2f5a34, roughness: 0.7, side: THREE.DoubleSide })); um.position.y = 2.7; um.castShadow = true; t.add(um);
    box(0.06, 2.6, 0.06, M.white, 0, 1.3, 0, t);
    place(t, 22 + (k % 2) * 5, -15 + Math.floor(k / 2) * 5);
  }
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), new THREE.MeshStandardMaterial({ map: textTexture([['BIERGARTEN · Augustiner', '700 64px "Saira Condensed", Arial Narrow, sans-serif']], 1024, 220, '#2f5a34', '#f4e6c8'), roughness: 0.7, side: THREE.DoubleSide }));
  const bgp = new THREE.Group(); box(0.1, 2.6, 0.1, darkWood, -1.6, 1.3, 0, bgp); box(0.1, 2.6, 0.1, darkWood, 1.6, 1.3, 0, bgp); bg.position.y = 2.3; bgp.add(bg); place(bgp, 19, -18, Math.PI / 2);
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
  arch(13, 'KAMPENWAND', 'START · BERGSTATION 1437 m');
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
