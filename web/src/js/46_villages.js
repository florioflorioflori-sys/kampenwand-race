
// ------------------------------------------------------------------
// Dörfer im Tal und am Chiemsee: weiße Häuser mit Holzbalkon und flachem
// Satteldach, Kirchen mit Zwiebelturm, verstreute Höfe
// ------------------------------------------------------------------
function groundAt(x, z) { return Math.abs(x) < HALF - 2 && Math.abs(z) < HALF - 2 ? hAt(x, z) : outerHeight(x, z); }
function colGeo(g, c) {
  g = g.index ? g.toNonIndexed() : g;
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
function roofGeo(w, d, h, over) {
  // Satteldach, First entlang z
  const W = w / 2 + over, D = d / 2 + over;
  const v = [[-W, 0, -D], [W, 0, -D], [0, h, -D], [-W, 0, D], [W, 0, D], [0, h, D]];
  const f = [[0, 2, 1], [3, 4, 5], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4], [0, 1, 4], [0, 4, 3]];
  const pos = [];
  for (const t of f) for (const k of t) pos.push(...v[k]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
function houseParts() {
  const white = new THREE.Color(0.86, 0.84, 0.78), wood = new THREE.Color(0.32, 0.19, 0.1), win = new THREE.Color(0.08, 0.09, 0.1), shut = new THREE.Color(0.18, 0.32, 0.18);
  const walls = [colGeo(new THREE.BoxGeometry(10, 4, 12).translate(0, 2, 0), white), colGeo(new THREE.BoxGeometry(10.05, 2.2, 12.05).translate(0, 5.1, 0), wood),
    colGeo(new THREE.BoxGeometry(10.8, 0.25, 1.2).translate(0, 4.2, 6.5), wood), colGeo(new THREE.BoxGeometry(10.8, 0.9, 0.08).translate(0, 4.75, 7.05), wood)];
  for (const sx of [-3, 0, 3]) for (const z of [6.02, -6.02]) { walls.push(colGeo(new THREE.BoxGeometry(1.1, 1.3, 0.06).translate(sx, 2.3, z), win)); walls.push(colGeo(new THREE.BoxGeometry(0.4, 1.3, 0.07).translate(sx - 0.8, 2.3, z), shut), colGeo(new THREE.BoxGeometry(0.4, 1.3, 0.07).translate(sx + 0.8, 2.3, z), shut)); }
  for (const z of [-3.5, 0.5, 4]) for (const x of [5.02, -5.02]) walls.push(colGeo(new THREE.BoxGeometry(0.06, 1.3, 1.1).translate(x, 2.3, z), win));
  const roof = roofGeo(10, 12, 2.6, 1.3).translate(0, 6.2, 0);
  return { walls: mergeGeometries(walls), roof };
}
function churchParts() {
  const white = new THREE.Color(0.9, 0.88, 0.82), dome = new THREE.Color(0.2, 0.32, 0.26), win = new THREE.Color(0.1, 0.1, 0.12), gold = new THREE.Color(0.8, 0.65, 0.25);
  const g = [colGeo(new THREE.BoxGeometry(10, 9, 22).translate(0, 4.5, 0), white), colGeo(new THREE.BoxGeometry(5.5, 26, 5.5).translate(0, 13, -12), white),
    colGeo(new THREE.SphereGeometry(3.4, 12, 8).scale(1, 1.25, 1).translate(0, 29, -12), dome), colGeo(new THREE.CylinderGeometry(0.6, 1.8, 3, 10).translate(0, 32.5, -12), dome),
    colGeo(new THREE.SphereGeometry(1.3, 10, 6).translate(0, 34.5, -12), dome), colGeo(new THREE.CylinderGeometry(0.08, 0.08, 3, 4).translate(0, 37, -12), gold),
    colGeo(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 16).rotateX(Math.PI / 2).translate(0, 21, -9.2), gold),
    colGeo(roofGeo(10, 22, 4, 0.6).translate(0, 9, 0), new THREE.Color(0.35, 0.16, 0.12))];
  for (const z of [-6, -1, 4, 9]) for (const x of [5.03, -5.03]) g.push(colGeo(new THREE.BoxGeometry(0.06, 3.5, 1.4).translate(x, 5, z), win));
  return mergeGeometries(g);
}
const VILLAGES = [
  // x, z, Radius, Häuser, Kirche
  [-1350, -2450, 330, 70, 1], [-4500, -4450, 350, 60, 1], [2600, -5600, 480, 100, 1], [500, -10300, 750, 200, 1], [-1800, -12300, 420, 70, 1],
  [2000, -15500, 340, 50, 1], [5600, -15600, 300, 45, 1], [9000, -19000, 420, 70, 1], [14400, -13800, 450, 75, 1], [11600, -6200, 430, 75, 1],
  [15500, -3300, 480, 85, 1], [6730, -12570, 150, 28, 1], [-7600, -7800, 380, 60, 1], [-3200, -15800, 380, 55, 1], [18500, -9000, 400, 60, 1],
];
function buildVillages(rand) {
  const hp = houseParts(), church = churchParts();
  const spots = [], churches = [];
  const ok = (x, z) => {
    if (Math.abs(x) < HALF && Math.abs(z) < HALF && (trailDistAt(x, z) < 30 || scDistAt(x, z) < 15 || nearStations(x, z))) return false;
    const y = groundAt(x, z); if (y < 521) return false;
    const s = Math.max(Math.abs(groundAt(x + 8, z) - y), Math.abs(groundAt(x, z + 8) - y));
    return s < 2.4 && y < 820;
  };
  for (const [vx, vz, r, n, ch] of VILLAGES) {
    if (ch) for (let t = 0; t < 20; t++) { const x = vx + (rand() - 0.5) * r * 0.3, z = vz + (rand() - 0.5) * r * 0.3; if (ok(x, z)) { churches.push([x, groundAt(x, z), z, rand() * 6.28]); break; } }
    let placed = 0;
    for (let t = 0; t < n * 6 && placed < n; t++) {
      const a = rand() * 6.283, d = Math.sqrt(rand()) * r, x = vx + Math.cos(a) * d, z = vz + Math.sin(a) * d;
      if (!ok(x, z)) continue;
      if (spots.some((p) => Math.abs(p[0] - x) < 17 && Math.abs(p[2] - z) < 17)) continue;
      if (churches.some((c) => Math.hypot(c[0] - x, c[2] - z) < 22)) continue;
      // Häuser grob zur Straße bzw. zum Dorfkern ausgerichtet
      spots.push([x, groundAt(x, z), z, Math.round((Math.atan2(vx - x, vz - z) + (rand() - 0.5) * 0.4) / (Math.PI / 2)) * (Math.PI / 2) + (rand() - 0.5) * 0.25, 0.8 + rand() * 0.5]);
      placed++;
    }
  }
  // Einzelhöfe im Vorland
  for (let t = 0; t < 2500 && spots.length < 1500; t++) {
    const x = (rand() - 0.5) * 44000, z = -2500 - rand() * 21000;
    if (Math.abs(x) < HALF + 200 && Math.abs(z) < HALF + 200) continue;
    if (!ok(x, z)) continue;
    spots.push([x, groundAt(x, z), z, rand() * 6.28, 0.9 + rand() * 0.6]);
  }
  const grp = new THREE.Group();
  const wm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), rm = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const W = new THREE.InstancedMesh(hp.walls, wm, spots.length), Rf = new THREE.InstancedMesh(hp.roof, rm, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  const roofs = [[0.42, 0.17, 0.11], [0.36, 0.2, 0.14], [0.5, 0.22, 0.13], [0.22, 0.2, 0.2], [0.3, 0.16, 0.11]];
  spots.forEach((h, i) => {
    q.setFromAxisAngle(V(0, 1, 0), h[3]); p.set(h[0], h[1] - 0.6, h[2]); s.set(h[4], 0.9 + (h[4] - 0.8) * 0.5, h[4]);
    m4.compose(p, q, s); W.setMatrixAt(i, m4); Rf.setMatrixAt(i, m4);
    const rc = roofs[i % roofs.length]; Rf.setColorAt(i, col.setRGB(rc[0], rc[1], rc[2]));
  });
  for (const m of [W, Rf]) { m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); grp.add(m); }
  if (churches.length) {
    const C = new THREE.InstancedMesh(church, wm, churches.length);
    churches.forEach((c, i) => { q.setFromAxisAngle(V(0, 1, 0), c[3]); C.setMatrixAt(i, m4.compose(p.set(c[0], c[1] - 0.8, c[2]), q, s.set(1, 1, 1))); });
    C.castShadow = true; C.computeBoundingSphere(); grp.add(C);
  }
  // Schloss Herrenchiemsee auf der Herreninsel
  const pal = mergeGeometries([colGeo(new THREE.BoxGeometry(110, 22, 26).translate(0, 11, 0), new THREE.Color(0.88, 0.85, 0.78)),
    colGeo(new THREE.BoxGeometry(26, 22, 70).translate(-42, 11, 35), new THREE.Color(0.88, 0.85, 0.78)), colGeo(new THREE.BoxGeometry(26, 22, 70).translate(42, 11, 35), new THREE.Color(0.88, 0.85, 0.78)),
    colGeo(roofGeo(26, 110, 4, 0.5).rotateY(Math.PI / 2).translate(0, 22, 0), new THREE.Color(0.3, 0.3, 0.32))]);
  const pm = new THREE.Mesh(pal, wm); pm.position.set(4250, groundAt(4250, -11200) - 0.5, -11200); grp.add(pm);
  grp.userData.count = spots.length;
  return grp;
}
