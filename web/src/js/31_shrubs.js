// ------------------------------------------------------------------
// Büsche und Gewächse für mehr Abwechslung: Laubbüsche (Hasel, Holunder,
// teils herbstlich), Heidelbeer- und Moospolster im Wald, junge Fichten,
// blühende Stauden (Weidenröschen, Goldrute, Schafgarbe) an Waldrändern
// ------------------------------------------------------------------
function saplingGeo() {
  const parts = [];
  for (let k = 0; k < 4; k++) parts.push(new THREE.ConeGeometry(0.5 - k * 0.1, 0.55, 8).translate(0, 0.35 + k * 0.32, 0));
  parts.push(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 5).translate(0, 0.2, 0));
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()), false), pp = g.attributes.position;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); const k = 1 + 0.18 * (vnoise(x * 9 + y * 3, z * 9) - 0.5); pp.setXYZ(i, x * k, y, z * k); }
  g.computeVertexNormals();
  return g;
}
function buildShrubs(rand) {
  const grp = new THREE.Group(), tmp = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const spot = (minLat, maxLat) => {
    const k = Math.floor(rand() * trail.n), lat = (rand() < 0.5 ? -1 : 1) * (TRAIL_HALF + minLat + Math.pow(rand(), 1.3) * (maxLat - minLat));
    const pt = trailPoint(k * TRAIL_STEP, lat, {});
    if (trailDistAt(pt.x, pt.z) < TRAIL_HALF + minLat * 0.8 || scDistAt(pt.x, pt.z) < SC_HALF + 1.2 || nearStations(pt.x, pt.z)) return null;
    const y = hAt(pt.x, pt.z), ny = normalAt(pt.x, pt.z, tmp).y;
    return { x: pt.x, z: pt.z, y, f: forestAt(pt.x, pt.z, y, ny), d: trailDistAt(pt.x, pt.z) };
  };
  const inst = (geo, mat, list, put, shadow = true) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((r, i) => { put(r); im.setMatrixAt(i, m4.compose(p, q, sc)); im.setColorAt(i, col); });
    im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); grp.add(im);
  };
  const leafM = mugoMaterial();
  // Laubbüsche an Waldrändern und auf Lichtungen
  const LEAF = [[0.12, 0.22, 0.05], [0.16, 0.26, 0.06], [0.1, 0.17, 0.045], [0.2, 0.28, 0.07], [0.42, 0.33, 0.08], [0.36, 0.14, 0.05], [0.14, 0.2, 0.05]];
  const bushes = [];
  for (let i = 0; i < 16000 && bushes.length < 2600; i++) {
    const s = spot(2.5, 30); if (!s || s.f < 0.12 || s.f > 0.85) continue;
    const w = 0.8 + rand() * 1.6;
    bushes.push([s.x, s.y, s.z, w, rand(), LEAF[Math.floor(rand() * LEAF.length)]]);
    if (w > 1.2 && s.d < 25) addObstacle(s.x, s.z, w * 0.5);
  }
  for (const [gi, geo] of [mugoGeo(3.3), mugoGeo(8.8)].entries()) {
    inst(geo, leafM, bushes.filter((_, i) => i % 2 === gi), (b) => {
      q.setFromAxisAngle(_UP, b[4] * 6.28); sc.set(b[3], b[3] * (1.8 + b[4] * 0.9), b[3] * (0.8 + b[4] * 0.4)); p.set(b[0], b[1] - 0.15, b[2]);
      const k = 0.85 + b[4] * 0.3; col.setRGB(b[5][0] * k, b[5][1] * k, b[5][2] * k);
    });
  }
  // Heidelbeer- und Moospolster im Wald
  const moss = [];
  for (let i = 0; i < 20000 && moss.length < 4500; i++) { const s = spot(1.2, 30); if (!s || s.f < 0.5) continue; moss.push([s.x, s.y, s.z, 0.35 + rand() * 0.55, rand()]); }
  inst(mugoGeo(12.1), leafM, moss, (b) => {
    q.setFromAxisAngle(_UP, b[4] * 6.28); sc.set(b[3], b[3] * (0.9 + b[4] * 0.6), b[3]); p.set(b[0], b[1] - 0.05, b[2]);
    col.setRGB(0.035 + b[4] * 0.02, 0.07 + b[4] * 0.03, 0.03);
  }, false);
  // junge Fichten
  const sap = [];
  for (let i = 0; i < 12000 && sap.length < 1600; i++) {
    const s = spot(3, 32); if (!s || s.f < 0.2) continue;
    const h = 0.6 + Math.pow(rand(), 1.5) * 2.4; sap.push([s.x, s.y, s.z, h, rand()]);
    if (h > 1.2 && s.d < 25) addObstacle(s.x, s.z, 0.35);
  }
  inst(saplingGeo(), new THREE.MeshStandardMaterial({ roughness: 0.9 }), sap, (b) => {
    q.setFromAxisAngle(_UP, b[4] * 6.28); sc.set(b[3] * (0.75 + b[4] * 0.3), b[3], b[3] * (0.75 + b[4] * 0.3)); p.set(b[0], b[1] - 0.05, b[2]);
    col.setRGB(0.05 + b[4] * 0.03, 0.12 + b[4] * 0.04, 0.05);
  });
  // blühende Stauden: Stängel und Blütenstand getrennt gefärbt
  const FLOW = [[0.78, 0.25, 0.55], [0.6, 0.3, 0.7], [0.9, 0.75, 0.15], [0.92, 0.9, 0.85], [0.85, 0.35, 0.5]];
  const herbs = [];
  for (let i = 0; i < 16000 && herbs.length < 2400; i++) { const s = spot(1.5, 24); if (!s || s.f > 0.65) continue; herbs.push([s.x, s.y, s.z, 0.5 + rand() * 0.8, rand(), FLOW[Math.floor(rand() * FLOW.length)]]); }
  const stalk = new THREE.CylinderGeometry(0.01, 0.015, 1, 4).translate(0, 0.5, 0);
  const bloom = mergeGeometries([new THREE.ConeGeometry(0.06, 0.32, 6).translate(0, 0.98, 0), new THREE.ConeGeometry(0.05, 0.24, 6).translate(0.08, 0.86, 0.03), new THREE.ConeGeometry(0.05, 0.22, 6).translate(-0.06, 0.82, -0.05)].map((g) => g.toNonIndexed()));
  const put = (b) => { q.setFromAxisAngle(_UP, b[4] * 6.28); sc.set(b[3], b[3], b[3]); p.set(b[0], b[1] - 0.03, b[2]); };
  inst(stalk, new THREE.MeshStandardMaterial({ roughness: 0.9 }), herbs, (b) => { put(b); col.setRGB(0.12, 0.2, 0.06); }, false);
  inst(bloom, new THREE.MeshStandardMaterial({ roughness: 0.8 }), herbs, (b) => { put(b); col.setRGB(...b[5]); }, false);
  return grp;
}
// halb umgestürzte Bäume: Wurzelteller auf der einen Seite, die Krone hängt
// auf der anderen Seite des Wegs in einer stehenden Fichte; man fährt darunter durch
function buildLeaningTrees(rand) {
  const grp = new THREE.Group();
  treeMats = treeMats || treeMaterials();
  const snag = [snagGeo(41), snagGeo(77), snagGeo(123)], spruce = spruceGeo(SPRUCE_VARIANTS[0]);
  const dirt = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1, side: THREE.DoubleSide });
  const rootM = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 });
  const placed = [];
  for (let s = 300; s < trail.L - 150; s += 70 + rand() * 60) {
    if (trail.kickers.some((k) => Math.abs(k - s) < 45)) continue;
    const c = trailPoint(s, 0, {}), y0 = hAt(c.x, c.z);
    if (forestAt(c.x, c.z, y0, normalAt(c.x, c.z).y) < 0.55) continue;
    const side = rand() < 0.5 ? -1 : 1, rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    const dBase = TRAIL_HALF + 3.5 + rand() * 1.5;
    const bx = c.x - rx * side * dBase, bz = c.z - rz * side * dBase, by = hAt(bx, bz);
    // Neigung so wählen, dass über der ganzen Fahrbahn genug Platz bleibt
    let th = 0.95, ok = false;
    for (; th > 0.45; th -= 0.05) {
      let minClr = 1e9;
      for (let l = -TRAIL_HALF - 0.5; l <= TRAIL_HALF + 0.5; l += 0.5) {
        const hd = dBase + l * side * 1, yy = by + hd / Math.tan(th);
        const px = c.x + rx * l, pz = c.z + rz * l; minClr = Math.min(minClr, yy - hAt(px, pz));
      }
      if (minClr > 4.6) { ok = true; break; }
    }
    if (!ok) continue;
    const ax = rx * side * Math.sin(th), az = rz * side * Math.sin(th), ay = Math.cos(th);
    const dir = V(ax, ay, az).normalize();
    // Stützbaum dort, wo der Stamm auf ~65 % seiner Länge anliegt
    const L = 19 * (0.92 + rand() * 0.15), cl = L * 0.62;
    const sx = bx + dir.x * cl + rx * side * 0.45, sz = bz + dir.z * cl + rz * side * 0.45;
    if (trailDistAt(sx, sz) < TRAIL_HALF + 1.2 || scDistAt(sx, sz) < 2) continue;
    const tree = new THREE.Mesh(snag[placed.length % 3], treeMats.snag);
    tree.position.set(bx, by - 0.25, bz); tree.scale.setScalar(L / 19);
    tree.quaternion.setFromUnitVectors(_UP, dir).multiply(new THREE.Quaternion().setFromAxisAngle(_UP, rand() * 6.28));
    tree.castShadow = true; grp.add(tree);
    const sup = new THREE.Mesh(spruce, treeMats.spruce); sup.position.set(sx, hAt(sx, sz) - 0.2, sz); sup.rotation.y = rand() * 6.28; sup.scale.setScalar(0.95 + rand() * 0.2); sup.castShadow = true; grp.add(sup);
    // aufgestellter Wurzelteller mit Erde und Wurzeln
    const plate = new THREE.Mesh(new THREE.CircleGeometry(1.5, 14), dirt);
    plate.position.set(bx - dir.x * 0.25, by + 0.9, bz - dir.z * 0.25); plate.lookAt(plate.position.clone().sub(dir)); plate.castShadow = true; grp.add(plate);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 6.28, r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, 1.4, 5), rootM);
      const o = V(Math.cos(a) * 1.1, Math.sin(a) * 1.1 + 0.9, 0);
      r.position.set(bx + rz * side * o.x - dir.x * 0.4, by + o.y, bz - rx * side * o.x - dir.z * 0.4); r.rotation.set(rand() * 3, rand() * 3, rand() * 3); grp.add(r);
    }
    const hole = new THREE.Mesh(new THREE.CircleGeometry(1.3, 12).rotateX(-Math.PI / 2), dirt); hole.position.set(bx + dir.x * 0.3, by + 0.03, bz + dir.z * 0.3); grp.add(hole);
    addObstacle(bx, bz, 1.4); addObstacle(sx, sz, 0.6);
    placed.push(s);
  }
  return grp;
}
