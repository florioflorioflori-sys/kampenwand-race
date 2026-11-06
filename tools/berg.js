// ------------------------------------------------------------------
// Baustoffe als Texturen (Kachel = 4 m): Bruchstein, Rauputz, Bretter,
// Schalbeton, Blechdach mit Falzen, Holzschindeln, Kies
// ------------------------------------------------------------------
const BT = {};
function bldTex() {
  if (BT.ok) return BT;
  const R = mulberry32(911), N = 512;
  const tile = (draw) => canvasTex(N, N, draw, { repeat: true });
  const wrapDraw = (fn) => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) fn(ox, oy); };
  const noise = (x, n, a, lo, hi) => { for (let i = 0; i < n; i++) { const l = lo + R() * (hi - lo); x.fillStyle = `rgba(${l},${l},${l},${a})`; x.fillRect(R() * N, R() * N, 1 + R() * 2.5, 1 + R() * 2.5); } };
  // Bruchstein in unregelmäßigen Lagen mit Mörtelfugen
  BT.stone = tile((x) => {
    x.fillStyle = '#6a645b'; x.fillRect(0, 0, N, N);
    let y = 0;
    while (y < N - 8) {
      const rh = 34 + R() * 30; let xx = R() * 30;
      while (xx < N + 40) {
        const w = 44 + R() * 70, h = rh - 4 - R() * 8, cx = xx + w / 2, cy = y + rh / 2;
        const base = [[150, 144, 132], [128, 124, 116], [160, 150, 128], [118, 112, 104], [142, 134, 118], [170, 164, 150]][Math.floor(R() * 6)];
        const v = 0.85 + R() * 0.3, pts = [];
        for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283, rr = 0.82 + R() * 0.18; pts.push([cx + Math.cos(a) * w / 2 * rr, cy + Math.sin(a) * h / 2 * rr]); }
        wrapDraw((ox, oy) => {
          if (cx + ox < -80 || cx + ox > N + 80 || cy + oy < -80 || cy + oy > N + 80) return;
          const gr = x.createLinearGradient(cx + ox - w / 2, cy + oy - h / 2, cx + ox + w / 3, cy + oy + h / 2);
          gr.addColorStop(0, rgb(base[0] * v * 1.12, base[1] * v * 1.12, base[2] * v * 1.12)); gr.addColorStop(1, rgb(base[0] * v * 0.78, base[1] * v * 0.78, base[2] * v * 0.78));
          x.fillStyle = gr; x.beginPath(); pts.forEach(([px, py], k) => k ? x.lineTo(px + ox, py + oy) : x.moveTo(px + ox, py + oy)); x.closePath(); x.fill();
          x.strokeStyle = 'rgba(40,36,30,0.35)'; x.lineWidth = 2; x.stroke();
        });
        xx += w + 3 + R() * 4;
      }
      y += rh;
    }
    noise(x, 9000, 0.18, 40, 220);
    // Flechten und Feuchte
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${90 + R() * 40},${100 + R() * 30},60,0.12)`; x.beginPath(); x.arc(R() * N, R() * N, 4 + R() * 14, 0, 7); x.fill(); }
  });
  // Rauputz, leicht verschmutzt
  BT.plaster = tile((x) => {
    x.fillStyle = '#efe9dd'; x.fillRect(0, 0, N, N);
    noise(x, 26000, 0.16, 150, 255);
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(120,110,95,${0.03 + R() * 0.04})`; x.beginPath(); x.ellipse(R() * N, R() * N, 10 + R() * 50, 6 + R() * 30, R() * 3, 0, 7); x.fill(); }
  });
  // senkrechte Bretter mit Maserung und dunklen Fugen
  BT.boards = tile((x) => {
    const bw = N / 20;
    for (let i = 0; i < 20; i++) {
      const v = 0.8 + R() * 0.35, l = [122 * v, 80 * v, 46 * v];
      x.fillStyle = rgb(...l); x.fillRect(i * bw, 0, bw, N);
      for (let k = 0; k < 14; k++) { x.strokeStyle = `rgba(${50 + R() * 40},${30 + R() * 20},15,${0.15 + R() * 0.25})`; x.lineWidth = 0.6 + R(); x.beginPath(); const px = i * bw + R() * bw; x.moveTo(px, 0); for (let y = 0; y <= N; y += 32) x.lineTo(px + Math.sin(y * 0.02 + k) * 1.6, y); x.stroke(); }
      if (R() < 0.5) { x.fillStyle = 'rgba(50,28,12,0.55)'; x.beginPath(); x.ellipse(i * bw + bw / 2, R() * N, 2.5, 4.5, 0, 0, 7); x.fill(); }
      x.fillStyle = 'rgba(25,14,6,0.85)'; x.fillRect(i * bw, 0, 2, N);
      // Nägel an den Riegeln
      for (const y of [N * 0.25, N * 0.75]) { x.fillStyle = 'rgba(30,30,30,0.7)'; x.fillRect(i * bw + bw / 2 - 1, y, 2, 2); }
    }
    // unten verwittert, grauer
    const g = x.createLinearGradient(0, N, 0, N * 0.6); g.addColorStop(0, 'rgba(110,100,90,0.18)'); g.addColorStop(1, 'rgba(110,100,90,0)'); x.fillStyle = g; x.fillRect(0, 0, N, N);
  });
  // Schalbeton: Brettabdrücke, Ankerlöcher
  BT.concrete = tile((x) => {
    x.fillStyle = '#9a958c'; x.fillRect(0, 0, N, N);
    for (let j = 0; j < 8; j++) { const l = 140 + R() * 25; x.fillStyle = `rgba(${l},${l - 3},${l - 8},0.5)`; x.fillRect(0, j * 64, N, 64); x.fillStyle = 'rgba(70,66,60,0.35)'; x.fillRect(0, j * 64, N, 2); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = 'rgba(60,56,50,0.6)'; x.beginPath(); x.arc(64 + i * 128, 32 + j * 128, 4, 0, 7); x.fill(); }
    noise(x, 22000, 0.15, 60, 230);
    for (let i = 0; i < 30; i++) { const xx = R() * N; const g = x.createLinearGradient(0, 0, 0, N); g.addColorStop(0, 'rgba(60,55,45,0.12)'); g.addColorStop(1, 'rgba(60,55,45,0)'); x.fillStyle = g; x.fillRect(xx, 0, 4 + R() * 10, N * (0.3 + R() * 0.6)); }
  });
  // Blechdach: Stehfalze laufen hangab (konstantes v), etwas Rost an den Falzen
  BT.sheet = tile((x) => {
    x.fillStyle = '#4b4f4a'; x.fillRect(0, 0, N, N);
    noise(x, 9000, 0.1, 30, 140);
    for (let j = 0; j < 8; j++) { const y = j * 64; x.fillStyle = 'rgba(150,155,150,0.6)'; x.fillRect(0, y, N, 3); x.fillStyle = 'rgba(15,15,15,0.5)'; x.fillRect(0, y + 3, N, 3);
      for (let k = 0; k < 6; k++) { x.fillStyle = `rgba(120,70,40,${0.08 + R() * 0.1})`; x.fillRect(R() * N, y - 4, 10 + R() * 40, 12); } }
  });
  // Holzschindeln: Reihen parallel zum First (konstantes u)
  BT.shingle = tile((x) => {
    x.fillStyle = '#3b2e24'; x.fillRect(0, 0, N, N);
    const rw = N / 16;
    for (let i = 0; i < 16; i++) { let y = -R() * 30; while (y < N) { const h = 16 + R() * 26, v = 0.7 + R() * 0.5; x.fillStyle = rgb(92 * v, 80 * v, 70 * v); x.fillRect(i * rw, y, rw - 2, h - 2); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(i * rw + rw - 7, y, 5, h - 2); y += h; } }
    noise(x, 6000, 0.12, 40, 160);
    for (let i = 0; i < 50; i++) { x.fillStyle = `rgba(90,110,60,${0.06 + R() * 0.08})`; x.beginPath(); x.arc(R() * N, R() * N, 5 + R() * 18, 0, 7); x.fill(); }
  });
  // Kies und getretene Erde
  BT.gravel = tile((x) => {
    x.fillStyle = '#8c8272'; x.fillRect(0, 0, N, N);
    for (let i = 0; i < 9000; i++) { const l = 90 + R() * 110; x.fillStyle = rgb(l, l * 0.96, l * 0.88, 0.8); x.beginPath(); x.arc(R() * N, R() * N, 0.8 + R() * 2.4, 0, 7); x.fill(); }
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(80,70,50,${0.08 + R() * 0.08})`; x.beginPath(); x.ellipse(R() * N, R() * N, 20 + R() * 50, 8 + R() * 20, R() * 3, 0, 7); x.fill(); }
  });
  BT.ok = true;
  return BT;
}
// Box mit UVs in Metern (Texturkachel 4 m), damit Mauern nicht verzerrt werden
function mBox(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
  const S = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * S[f][0] / 4, uv.getY(i) * S[f][1] / 4); }
  return geo;
}
// Bodenfläche, die dem Gelände folgt und zum Rand hin ausblendet
function groundPatch(parent, cx, cz, rot, W, D, mat, fade = 4) {
  const nx = Math.ceil(W / 1.5), nz = Math.ceil(D / 1.5);
  const pg = new THREE.PlaneGeometry(W, D, nx, nz).rotateX(-Math.PI / 2), pp = pg.attributes.position, uv = pg.attributes.uv;
  const col = new Float32Array(pp.count * 4), ca = Math.cos(rot), sa = Math.sin(rot);
  for (let i = 0; i < pp.count; i++) {
    const lx = pp.getX(i), lz = pp.getZ(i);
    const wx = cx + lx * ca + lz * sa, wz = cz - lx * sa + lz * ca;
    pp.setXYZ(i, wx, hAt(wx, wz) + 0.07, wz);
    uv.setXY(i, wx / 4, wz / 4);
    const e = Math.min(W / 2 - Math.abs(lx), D / 2 - Math.abs(lz)) / fade;
    const n = Math.sin(wx * 0.7) * Math.sin(wz * 0.6) * 0.25;
    const sl = Math.hypot(hAt(wx + 1, wz) - hAt(wx - 1, wz), hAt(wx, wz + 1) - hAt(wx, wz - 1)) / 2;
    col.set([1, 1, 1, Math.max(0, Math.min(1, e + n)) * (1 - Math.min(1, Math.max(0, (sl - 0.3) / 0.25)))], i * 4);
  }
  pg.setAttribute('color', new THREE.BufferAttribute(col, 4));
  pg.computeVertexNormals();
  const m = new THREE.Mesh(pg, mat); m.receiveShadow = true; m.renderOrder = 1; parent.add(m);
  return m;
}
// Geranien als Instanzen in lokalen Koordinaten einer Gruppe
function geraniums(parent, pts) {
  const fg = new THREE.IcosahedronGeometry(0.11, 0), lg = new THREE.IcosahedronGeometry(0.16, 0);
  const fl = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ roughness: 0.8 }), pts.length * 3);
  const lv = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: 0x2c5e24, roughness: 0.9 }), pts.length * 2);
  const m4 = new THREE.Matrix4(), c = new THREE.Color(), GC = [0xd01a2a, 0xe0306a, 0xc8102e, 0xf06a8a, 0xe8e2f0];
  pts.forEach(([x, y, z], i) => {
    for (let k = 0; k < 2; k++) lv.setMatrixAt(i * 2 + k, m4.makeTranslation(x + (k - 0.5) * 0.14, y, z + (Math.random() - 0.5) * 0.1));
    for (let k = 0; k < 3; k++) { fl.setMatrixAt(i * 3 + k, m4.makeTranslation(x + (k - 1) * 0.11, y + 0.1 + Math.random() * 0.12, z + (Math.random() - 0.5) * 0.2)); fl.setColorAt(i * 3 + k, c.setHex(GC[(i + (k === 2 ? 4 : 0)) % 5])); }
  });
  parent.add(fl, lv);
}

// ------------------------------------------------------------------
// Bergstation: Bruchsteinsockel, Holzaufbau, Blechdach (Bauweise 1957),
// daneben der Berggasthof Sonnenalm mit großer Südwestterrasse
// ------------------------------------------------------------------
function buildBergDetails(g, M, box, y0, fin) {
  const T = bldTex();
  const S = ((fin.x - g.position.x) * Math.cos(g.rotation.y) - (fin.z - g.position.z) * Math.sin(g.rotation.y)) >= 0 ? 1 : -1;
  // Bruchsteinmauer am Erdgeschoss, Betonband als Abschluss
  box(18.3, 3.3, 26.3, M.stoneW, 0, 1.75, 0, g);
  box(18.6, 0.35, 26.6, M.concrete, 0, 3.45, 0, g);
  // kleine Fenster im Sockel mit Gittern
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    const w = new THREE.Group(); w.position.set(sx * 9.17, 2.1, -9 + k * 5.5); w.rotation.y = sx * Math.PI / 2; g.add(w);
    box(1.0, 0.8, 0.06, M.glass, 0, 0, 0.0, w); box(1.2, 0.12, 0.22, M.concrete, 0, -0.46, 0.06, w); box(1.2, 0.1, 0.12, M.concrete, 0, 0.45, 0.04, w);
    for (let b = -2; b <= 2; b++) box(0.025, 0.8, 0.025, M.dark, b * 0.18, 0, 0.09, w);
  }
  // Tür zur Betriebsseite, Treppe
  const door = new THREE.Group(); door.position.set(S * 9.18, 0.0, 4); door.rotation.y = S * Math.PI / 2; g.add(door);
  box(1.4, 2.3, 0.08, M.wood, 0, 1.25, 0.02, door); box(1.7, 0.18, 0.4, M.concrete, 0, 2.5, 0.15, door);
  for (let k = 0; k < 4; k++) box(2.2, 0.18, 0.35, M.concrete, 0, 0.0 - k * 0.18 + 0.05, 0.3 + k * 0.35, door);
  // Antennenmast und Windmesser auf dem Dach
  box(0.12, 6, 0.12, M.steel, -3, 11.5, -10, g); box(1.4, 0.06, 0.06, M.steel, -3, 14.2, -10, g);
  for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6, 0, 6.3, 0, 1.6), M.white); c.position.set(-3 + Math.cos(k * 2.1) * 0.35, 14.55, -10 + Math.sin(k * 2.1) * 0.35); g.add(c); }
  // Kiesvorplatz rund um die Station und den Gasthof
  const gravelM = new THREE.MeshStandardMaterial({ map: T.gravel, color: 0x8a8070, roughness: 1, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  groundPatch(g.parent, g.position.x, g.position.z, g.rotation.y, 34, 40, gravelM, 5);

  // ---------------- Sonnenalm ----------------
  // Platz für den Gasthof: möglichst flach, abseits von Strecke und Seiltrasse, Terrasse zum Tal
  const W = 13, D = 11;
  const spread = (x, z, r) => { let hi = -1e9, lo = 1e9; const c = Math.cos(r), s = Math.sin(r);
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0], [0, 2.2], [-1, 2.2], [1, 2.2]]) { const wx = x + u * W / 2 * c + v * D / 2 * s, wz = z - u * W / 2 * s + v * D / 2 * c, h = hAt(wx, wz); hi = Math.max(hi, h); lo = Math.min(lo, h); }
    return [hi, lo]; };
  const dir = (x, z) => { const e = 2, gx = hAt(x + e, z) - hAt(x - e, z), gz = hAt(x, z + e) - hAt(x, z - e); return Math.atan2(-gx, -gz); };
  let best = null;
  for (let r = 30; r <= 62; r += 4) for (let k = 0; k < 24; k++) {
    const a = k / 24 * 6.283, x = g.position.x + Math.sin(a) * r, z = g.position.z + Math.cos(a) * r;
    if (trailDistAt(x, z) < 22) continue;
    const bx = stationB.x - stationA.x, bz = stationB.z - stationA.z, t = clamp(((x - stationA.x) * bx + (z - stationA.z) * bz) / (bx * bx + bz * bz), -0.1, 1);
    if (Math.hypot(x - stationA.x - bx * t, z - stationA.z - bz * t) < 20) continue;
    const ry = dir(x, z), [hi, lo] = spread(x, z, ry), sc = hi - lo + r * 0.03;
    if (!best || sc < best.sc) best = { x, z, ry, hi, lo, sc };
  }
  const ax = best.x, az = best.z, hi = best.hi, lo = best.lo;
  const alm = new THREE.Group(); alm.position.set(ax, hi + 0.2, az); alm.rotation.y = best.ry; g.parent.add(alm);
  addObstacle(ax, az, 9); reservedSpots.push([ax, az, 18]);
  const drop = hi - lo + 1.5;
  // Sockel aus Bruchstein bis ins Gelände, Erdgeschoss weiß verputzt
  box(W + 0.4, drop + 0.6, D + 0.4, M.stoneW, 0, -drop / 2 + 0.3, 0, alm);
  box(W, 3.0, D, M.plasterW, 0, 2.1, 0, alm);
  // Obergeschoss aus Holz, Fensterbänder mit Läden
  box(W + 0.1, 2.7, D + 0.1, M.wood, 0, 4.95, 0, alm);
  const shutter = new THREE.MeshStandardMaterial({ color: 0x2f5a34, roughness: 0.7 });
  const win = (x, y, z, ry, wood) => {
    const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.y = ry; alm.add(w);
    box(1.0, 1.25, 0.06, M.glass, 0, 0, 0.02, w); box(1.14, 0.08, 0.1, M.white, 0, 0.66, 0.04, w); box(1.18, 0.08, 0.18, wood ? M.wood : M.white, 0, -0.66, 0.07, w);
    box(0.05, 1.25, 0.08, M.white, 0, 0, 0.05, w); box(1.0, 0.05, 0.08, M.white, 0, 0.14, 0.05, w);
    for (const sx of [-1, 1]) { box(0.5, 1.32, 0.04, shutter, sx * 0.8, 0, 0.05, w); for (let k = 0; k < 5; k++) box(0.46, 0.025, 0.03, M.dark, sx * 0.8, -0.5 + k * 0.25, 0.08, w); }
  };
  for (let k = 0; k < 4; k++) { win(-4.5 + k * 3, 2.1, D / 2 + 0.02, 0, false); win(-4.5 + k * 3, 5.0, D / 2 + 0.07, 0, true); }
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { win(sx * (W / 2 + 0.02), 2.1, -3 + k * 3, sx * Math.PI / 2, false); win(sx * (W / 2 + 0.07), 5.0, -3 + k * 3, sx * Math.PI / 2, true); }
  // Eingang mit Vordach seitlich zur Bergstation
  const ed = new THREE.Group(); ed.position.set(S * (W / 2 + 0.02), 0.6, 3.6); ed.rotation.y = S * Math.PI / 2; alm.add(ed);
  box(1.4, 2.3, 0.08, M.wood, 0, 1.15, 0.03, ed); box(2.4, 0.12, 1.4, M.wood, 0, 2.6, 0.7, ed);
  // Balkon umlaufend vorne und seitlich mit Geranien
  const gpts = [];
  const balcony = (len, x, z, ry) => {
    const b = new THREE.Group(); b.position.set(x, 3.65, z); b.rotation.y = ry; alm.add(b);
    box(len, 0.14, 1.25, M.wood, 0, 0, 0.62, b);
    box(len, 0.1, 0.12, M.wood, 0, 1.0, 1.2, b);
    for (let u = -len / 2 + 0.1; u <= len / 2; u += 0.15) box(0.11, 0.88, 0.03, M.wood, u, 0.5, 1.22, b);
    box(len, 0.24, 0.28, M.wood, 0, 1.16, 1.32, b);
    for (let u = -len / 2 + 0.6; u < len / 2; u += 2.4) box(0.1, 0.8, 1.2, M.wood, u, -0.45, 0.6, b);
    b.updateMatrix();
    for (let u = -len / 2 + 0.25; u < len / 2; u += 0.3) gpts.push(new THREE.Vector3(u, 1.38, 1.32).applyMatrix4(b.matrix).toArray());
  };
  balcony(W + 2.6, 0, D / 2 + 0.06, 0);
  balcony(D, -W / 2 - 0.06, 0, -Math.PI / 2); balcony(D, W / 2 + 0.06, 0, Math.PI / 2);
  geraniums(alm, gpts);
  // flaches Satteldach mit weitem Überstand, Schindeln; Giebel zum Tal
  const pitch = 0.4, half = W / 2 + 1.8, sl = half / Math.cos(pitch), ridgeY = 6.3 + Math.tan(pitch) * half;
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(mBox(sl, 0.28, D + 3.6), M.shingle);
    r.position.set(sx * half / 2, 6.3 + Math.tan(pitch) * half / 2 + 0.14, 0); r.rotation.z = -sx * pitch; r.castShadow = r.receiveShadow = true; alm.add(r);
    const f = new THREE.Mesh(mBox(sl, 0.32, 0.22), M.wood); f.position.set(sx * half / 2, 6.3 + Math.tan(pitch) * half / 2 + 0.05, D / 2 + 1.8); f.rotation.z = -sx * pitch; alm.add(f);
    const f2 = f.clone(); f2.position.z = -D / 2 - 1.8; alm.add(f2);
  }
  box(0.4, 0.22, D + 3.6, M.dark, 0, ridgeY + 0.3, 0, alm);
  // Giebeldreieck in Brettern, Pfetten
  const gs = new THREE.Shape(); gs.moveTo(-W / 2, 0); gs.lineTo(0, Math.tan(pitch) * W / 2); gs.lineTo(W / 2, 0); gs.lineTo(-W / 2, 0);
  for (const sz of [-1, 1]) { const gg = new THREE.Mesh(new THREE.ShapeGeometry(gs), M.wood); gg.position.set(0, 6.3, sz * (D / 2 + 0.05)); gg.rotation.y = sz > 0 ? 0 : Math.PI; alm.add(gg);
    const uv = gg.geometry.attributes.uv, p = gg.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 4, p.getY(i) / 4); }
  for (const u of [-W / 2 + 0.4, -W / 4, 0, W / 4, W / 2 - 0.4]) box(0.22, 0.26, D + 3.4, M.wood, u, 6.3 + Math.tan(pitch) * (W / 2 - Math.abs(u)) - 0.05, 0, alm);
  // Schriftzug am Giebel
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.0), new THREE.MeshStandardMaterial({ map: textTexture([['BERGGASTHOF SONNENALM', '700 64px "Saira Condensed", Arial Narrow, sans-serif']], 1024, 150, '#5a3a1e', '#f4e6c8'), roughness: 0.7 }));
  sign.position.set(0, 7.0, D / 2 + 0.12); alm.add(sign);
  // Kamin
  box(0.8, 2.4, 0.8, M.stoneW, W / 4, ridgeY + 0.2, -1.5, alm); box(1.0, 0.12, 1.0, M.concrete, W / 4, ridgeY + 1.45, -1.5, alm);
  // Brennholzstapel an der Rückwand
  const logG = new THREE.CylinderGeometry(0.11, 0.11, 0.45, 7).rotateX(Math.PI / 2), logs = new THREE.InstancedMesh(logG, new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.9 }), 160);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 160; i++) logs.setMatrixAt(i, m4.makeTranslation(-5 + (i % 40) * 0.24 + ((i / 40 | 0) % 2) * 0.12, 0.75 + (i / 40 | 0) * 0.21, -D / 2 - 0.35));
  logs.castShadow = true; alm.add(logs);
  // große Terrasse talseitig auf Bruchsteinmauer
  const TD = 11, TW = W + 6;
  box(TW, drop + 0.6, TD, M.stoneW, 0, -drop / 2 + 0.3, D / 2 + TD / 2, alm);
  box(TW + 0.3, 0.18, TD + 0.3, M.wood, 0, 0.7, D / 2 + TD / 2, alm);
  // Geländer
  for (const [len, x, z, ry] of [[TW, 0, D / 2 + TD, 0], [TD, -TW / 2, D / 2 + TD / 2, Math.PI / 2], [TD, TW / 2, D / 2 + TD / 2, Math.PI / 2]]) {
    const r = new THREE.Group(); r.position.set(x, 0.8, z); r.rotation.y = ry; alm.add(r);
    box(len, 0.08, 0.1, M.wood, 0, 1.0, 0, r); box(len, 0.08, 0.08, M.wood, 0, 0.5, 0, r);
    for (let u = -len / 2; u <= len / 2 + 0.01; u += 1.6) box(0.12, 1.05, 0.12, M.wood, u, 0.5, 0, r);
  }
  // Tische, Bänke, Schirme (rot-weiß), Liegestühle
  const umM = [new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.7, side: THREE.DoubleSide }), new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.7, side: THREE.DoubleSide })];
  for (let k = 0; k < 8; k++) {
    const tx = -7.5 + (k % 4) * 5, tz = D / 2 + 2.6 + Math.floor(k / 4) * 4.6;
    const t = new THREE.Group(); t.position.set(tx, 0.8, tz); t.rotation.y = (k % 3 - 1) * 0.05; alm.add(t);
    box(2.0, 0.07, 0.75, M.wood, 0, 0.78, 0, t); for (const sx of [-0.8, 0.8]) box(0.08, 0.76, 0.6, M.wood, sx, 0.38, 0, t);
    for (const bz of [-0.68, 0.68]) { box(2.0, 0.06, 0.3, M.wood, 0, 0.46, bz, t); for (const sx of [-0.8, 0.8]) box(0.07, 0.45, 0.26, M.wood, sx, 0.22, bz, t); }
    if (k % 2 === 0) {
      const um = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.55, 12, 1, true), umM[(k / 2) % 2]); um.position.y = 2.75; um.castShadow = true; t.add(um);
      box(0.06, 2.75, 0.06, M.white, 0, 1.38, 0, t); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.12, 10), M.dark); base.position.y = 0.06; t.add(base);
    }
    // Krüge und Teller
    for (let j = 0; j < 3; j++) { const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 8), M.glass); mug.position.set(-0.6 + j * 0.55, 0.9, (j % 2 - 0.5) * 0.3); t.add(mug); }
  }
  const lounge = (x, z, ry) => { const l = new THREE.Group(); l.position.set(x, 0.8, z); l.rotation.y = ry; alm.add(l);
    box(0.62, 0.06, 1.3, M.wood, 0, 0.3, 0.2, l); const bk = box(0.62, 0.06, 0.8, M.wood, 0, 0.55, -0.6, l); bk.rotation.x = 0.85;
    for (const sx of [-0.28, 0.28]) for (const sz of [-0.3, 0.8]) box(0.05, 0.3, 0.05, M.wood, sx, 0.15, sz, l); };
  for (let k = 0; k < 4; k++) lounge(TW / 2 - 1.0, D / 2 + 1.6 + k * 2.4, -Math.PI / 2 - 0.4);
  // Schild am Weg und Bayernfahne
  const pole = box(0.14, 8, 0.14, M.white, -TW / 2 + 0.6, 4.8, D / 2 + TD - 0.6, alm);
  const bav = g.userData.bavM;
  if (bav) { const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3, 6, 10).translate(0.62, 0, 0), bav); fl.position.set(-TW / 2 + 0.6, 7.3, D / 2 + TD - 0.6); fl.castShadow = true; alm.add(fl); }
  // Kies um den Gasthof
  groundPatch(g.parent, ax + Math.sin(best.ry) * 4, az + Math.cos(best.ry) * 4, best.ry, W + 14, D + TD + 12, gravelM, 4);
}
