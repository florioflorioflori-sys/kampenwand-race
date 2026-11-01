// ------------------------------------------------------------------
// Kampenwand nach Fotos: weiße Kalkfelstürme auf dem Grat, Latschenfelder,
// Gipfelkreuz aus dunklem Stahl mit Gittersockel und Abspannseilen,
// Steinlingalm mit weißer Kapelle
// ------------------------------------------------------------------
const KW = { crest: [], cross: null, alm: null };
// Felsturm: zerklüftete Säule mit senkrechten Rinnen, mehreren Zacken oben
function spireGeo(seed) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 28, 22, false).translate(0, 0.5, 0);
  const p = g.attributes.position;
  const lean = (vnoise(seed, 3.1) - 0.5) * 0.25;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), r0 = Math.hypot(x, z);
    // Zacken: die Oberkante läuft je Richtung unterschiedlich hoch
    const top = 0.62 + 0.38 * Math.pow(Math.abs(Math.sin(a * 1.5 + seed) * Math.cos(a * 2.5 + seed * 1.7)), 0.6);
    const yy = y * (y > 0.97 && r0 > 0.01 ? top : y > 0.97 ? 0.92 : 1 - (1 - top) * Math.pow(y, 6));
    const taper = 1 - 0.55 * Math.pow(yy, 1.4);
    const ridge = 1 + 0.12 * Math.sin(a * 7 + fbm(a + seed, yy * 2, 2) * 6) + 0.05 * Math.sin(a * 17 + seed);
    const lump = 0.72 + 0.55 * fbm(Math.cos(a) * 1.4 + seed, Math.sin(a) * 1.4 + yy * 3.5, 3);
    // waagrechte Bänke wie geschichteter Kalk
    const bank = 1 + 0.06 * Math.max(0, Math.sin(yy * 22 + seed));
    const r = r0 * taper * ridge * lump * bank;
    p.setXYZ(i, Math.cos(a) * r + lean * yy, yy, Math.sin(a) * r * 0.75);
  }
  g.computeVertexNormals();
  return g;
}
// Latschenbusch: flacher, buckliger Polster
function mugoGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.75 + 0.45 * (fbm(x * 2.2 + seed, z * 2.2 + y * 1.7, 3) + 0.3) + 0.1 * vnoise(x * 9 + seed, y * 9 + z * 7);
    p.setXYZ(i, x * k, Math.max(-0.25, y) * k * 0.45, z * k);
  }
  g.computeVertexNormals();
  return g;
}
function mugoMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.95 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vMW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vMW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = 'varying vec3 vMW;\n' + GLSL_NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float nn = vnoise(vMW.xz * 3.1 + vMW.y * 2.3), nb = vnoise(vMW.xz * 11.0 - vMW.y * 7.0);
      diffuseColor.rgb *= 0.55 + 0.6 * nn * nb + 0.25 * nb;`);
  };
  return m;
}
function buildKampenwand(rand) {
  const grp = new THREE.Group();
  // Gipfel (fürs Kreuz frei halten)
  let best = -1, bi = 0;
  for (let id = 0; id < G * G; id += 3) if (H[id] > best) { best = H[id]; bi = id; }
  const sx0 = (bi % G) * CELL - HALF, sz0 = Math.floor(bi / G) * CELL - HALF;
  // Gratlinie: je x die höchste Stelle
  const crest = KW.crest;
  for (let x = 1290; x <= 1996; x += 6) {
    let bz = 0, bh = -1;
    for (let z = 250; z <= 760; z += 4) { const h = hAt(x, z); if (h > bh) { bh = h; bz = z; } }
    if (bh > 1470) crest.push([x, bz, bh]);
  }
  // Felstürme in Gruppen entlang des Grats, kleinere an den Flanken
  const list = [];
  const ok = (x, z) => Math.hypot(x - sx0, z - sz0) > 22 && Math.abs(x) < HALF - 4 && Math.abs(z) < HALF - 4 && coarseDistAt(x, z) > 32 && scDistAt(x, z) > 14 && !nearStations(x, z);
  for (const [x, z, h] of crest) {
    const cl = fbm(x * 0.011, 3.3, 2) + 0.25 + (h - 1500) / 260;
    if (cl < 0.32 || rand() < 0.4) continue;
    for (let k = 0; k < 2; k++) {
      const px = x + (rand() - 0.5) * 6, pz = z + (rand() - 0.5) * 14;
      if (!ok(px, pz)) continue;
      const big = clamp(cl, 0.2, 1);
      const w = 3 + rand() * 9 * big, ht = 6 + Math.pow(rand(), 1.5) * 34 * big;
      list.push([px, pz, w, ht, rand() * 6.28, 0.7 + rand() * 0.1]);
    }
  }
  // Flanken: einzelne Zacken und Wandstufen unterhalb des Grats
  for (let i = 0; i < 260; i++) {
    const c = crest[Math.floor(rand() * crest.length)]; if (!c) break;
    const side = rand() < 0.6 ? 1 : -1, d = 12 + Math.pow(rand(), 1.6) * 120;
    const px = c[0] + (rand() - 0.5) * 10, pz = c[1] + side * d;
    if (!ok(px, pz)) continue;
    const y = hAt(px, pz); if (y < 1380) continue;
    const ny = normalAt(px, pz, _kwN).y;
    if (ny > 0.9 && rand() < 0.7) continue;
    list.push([px, pz, 2 + rand() * 4, 3 + rand() * 12 * (1 - ny + 0.3), rand() * 6.28, 0.72 + rand() * 0.14]);
  }
  const geos = [spireGeo(1.3), spireGeo(4.7), spireGeo(9.1), spireGeo(15.2)];
  const mat = rockMaterial(), ob = mat.onBeforeCompile;
  // weniger Moos an den steilen Kalkwänden
  mat.onBeforeCompile = (sh) => { ob(sh); sh.fragmentShader = sh.fragmentShader.replace('moss*0.85', 'moss*0.3'); };
  mat.customProgramCacheKey = () => 'kwspire';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  geos.forEach((geo, gi) => {
    const sub = list.filter((_, i) => i % geos.length === gi);
    const im = new THREE.InstancedMesh(geo, mat, sub.length);
    sub.forEach((r, i) => {
      // Fuß unter den tiefsten Punkt der Grundfläche
      let lo = 1e9; for (let a = 0; a < 6.28; a += 1.05) lo = Math.min(lo, hAt(r[0] + Math.cos(a) * r[2], r[1] + Math.sin(a) * r[2] * 0.75));
      q.setFromAxisAngle(_UP, r[4]); sc.set(r[2], r[3], r[2]); p.set(r[0], lo - 1.5, r[1]);
      im.setMatrixAt(i, m4.compose(p, q, sc));
      const g = r[5]; col.setRGB(g, g * 0.985, g * 0.94); im.setColorAt(i, col);
      if (r[2] > 3) addObstacle(r[0], r[1], r[2] * 0.8);
    });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
    grp.add(im);
  });
  // Latschenfelder (Bergkiefern) zwischen den Felsen
  const bush = [];
  for (let i = 0; i < 40000 && bush.length < 7000; i++) {
    const x = 1150 + rand() * 850, z = 150 + rand() * 800;
    if (!ok(x, z) || coarseDistAt(x, z) < 40) continue;
    const y = hAt(x, z); if (y < 1360 || y > 1590) continue;
    const ny = normalAt(x, z, _kwN).y;
    const dens = smooth(-0.05, 0.15, fbm(x * 0.012, z * 0.012, 3)) * smooth(0.5, 0.7, ny);
    if (rand() > dens) continue;
    bush.push([x, y, z, 2.4 + rand() * 3.4, rand()]);
  }
  const bgeo = [mugoGeo(2.2), mugoGeo(6.6)], bmat = mugoMaterial();
  bgeo.forEach((geo, gi) => {
    const sub = bush.filter((_, i) => i % 2 === gi);
    const im = new THREE.InstancedMesh(geo, bmat, sub.length);
    sub.forEach((b, i) => {
      q.setFromAxisAngle(_UP, b[4] * 6.28); sc.set(b[3], b[3] * (0.8 + b[4] * 0.5), b[3] * (0.8 + b[4] * 0.3)); p.set(b[0], b[1] - 0.2, b[2]);
      im.setMatrixAt(i, m4.compose(p, q, sc));
      col.setRGB(0.055 + b[4] * 0.03, 0.12 + b[4] * 0.05, 0.035); im.setColorAt(i, col);
    });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
    grp.add(im);
  });
  grp.add(buildSummitCross());
  grp.add(buildSteinlingAlm(rand));
  return grp;
}
const _kwN = new THREE.Vector3();
// Gipfelkreuz wie auf dem Foto: dunkler Stahl, Gittersockel, Lampen, Abspannseile
function buildSummitCross() {
  let best = -1, bi = 0;
  for (let id = 0; id < G * G; id += 3) if (H[id] > best) { best = H[id]; bi = id; }
  const gx = (bi % G) * CELL - HALF, gz = Math.floor(bi / G) * CELL - HALF;
  const g = new THREE.Group();
  // Gipfelfels unter dem Kreuz
  const rg = rockGeo(21.7); rg.computeBoundingBox();
  const rock = new THREE.Mesh(rg, rockMaterial()); rock.scale.set(7, 6, 6); rock.position.set(gx, best - 3, gz);
  rock.material.color.setRGB(0.8, 0.79, 0.75); rock.castShadow = rock.receiveShadow = true; g.add(rock);
  const top = best - 3 + rg.boundingBox.max.y * 6 - 0.4;
  const steel = new THREE.MeshStandardMaterial({ color: 0x26282a, roughness: 0.45, metalness: 0.7 });
  const c = new THREE.Group(); c.position.set(gx, top, gz); c.rotation.y = 0.5; g.add(c);
  const bar = (a, b, r) => {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 6), steel);
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(_UP, d.normalize()); m.castShadow = true; c.add(m); return m;
  };
  // Gittersockel: vier Beine, Querstreben, Diagonalen
  const S = 0.9, HB = 2.6, s2 = 0.22;
  const leg = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = leg[k], [bx, bz] = leg[(k + 1) % 4];
    bar(V(ax * S, 0, az * S), V(ax * s2, HB, az * s2), 0.05);
    for (const f of [0, 0.5]) {
      const w = S + (s2 - S) * f, w2 = S + (s2 - S) * (f + 0.5);
      bar(V(ax * w, HB * f, az * w), V(bx * w, HB * f, bz * w), 0.03);
      bar(V(ax * w, HB * f, az * w), V(bx * w2, HB * (f + 0.5), bz * w2), 0.022);
    }
  }
  // Stamm und Querbalken als Kastenprofil
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, 9.5, 0.3), steel); post.position.y = HB + 4.75; post.castShadow = true; c.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.32, 0.28), steel); arm.position.y = HB + 6.6; arm.castShadow = true; c.add(arm);
  // Lampen an den Enden und oben
  const lampM = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffe9b0, emissiveIntensity: 0.6, roughness: 0.3 });
  for (const [x, y] of [[2.42, HB + 6.6], [-2.42, HB + 6.6], [0, HB + 9.62]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.26, 10), lampM); l.position.set(x, y, 0);
    if (x) l.rotation.z = Math.PI / 2; c.add(l);
  }
  // Gedenktafel
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), new THREE.MeshStandardMaterial({ map: textTexture([['GEWIDMET DEN GEFALLENEN', '700 34px Barlow, sans-serif'], ['DES CHIEMGAUS', '700 34px Barlow, sans-serif']], 512, 240, '#2b2d2f', '#e8e2d2'), roughness: 0.6, metalness: 0.4 }));
  plate.position.set(0, HB + 1.2, 0.17); c.add(plate);
  // Abspannseile zu Ankern im Fels
  c.updateMatrixWorld(true);
  const wires = [];
  for (const [ax, az, py] of [[5.5, 3, HB + 6.4], [-5.5, 3, HB + 6.4], [4, -5, HB + 8], [-4, -5, HB + 8]]) {
    const wx = gx + ax * Math.cos(0.5) + az * Math.sin(0.5), wz = gz - ax * Math.sin(0.5) + az * Math.cos(0.5);
    const anchor = c.worldToLocal(V(wx, Math.max(hAt(wx, wz), top - 4), wz));
    wires.push(0, py, 0, anchor.x, anchor.y, anchor.z);
  }
  c.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(wires, 3)), new THREE.LineBasicMaterial({ color: 0x3a3c3e })));
  KW.cross = { x: gx, z: gz, y: top };
  addObstacle(gx, gz, 6); reservedSpots.push([gx, gz, 10]);
  return g;
}
// Steinlingalm: weiße Almgebäude mit grauen Dächern und eine kleine weiße Kapelle
function buildSteinlingAlm(rand) {
  const g = new THREE.Group();
  let best = null, bs = -1e9;
  for (let i = 0; i < 4000; i++) {
    const x = 1250 + rand() * 600, z = 450 + rand() * 450;
    if (coarseDistAt(x, z) < 60 || scDistAt(x, z) < 20 || nearStations(x, z)) continue;
    const y = hAt(x, z); if (y < 1400 || y > 1520) continue;
    let flat = 0; for (const [dx, dz] of [[-14, 0], [14, 0], [0, -14], [0, 14]]) flat += Math.abs(hAt(x + dx, z + dz) - y);
    const sc = -flat * 3 + y * 0.05;
    if (sc > bs) { bs = sc; best = [x, z, y]; }
  }
  if (!best) return g;
  const [ax, az] = best;
  const white = new THREE.MeshStandardMaterial({ color: 0xece8de, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.85 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x5c5f62, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1f2326, roughness: 0.4, metalness: 0.3 });
  const place = (o, x, z, yaw) => { let lo = 1e9; for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5], [0, 0]]) lo = Math.min(lo, hAt(x + dx, z + dz)); o.position.set(x, lo, z); o.rotation.y = yaw; g.add(o); addObstacle(x, z, 7); reservedSpots.push([x, z, 12]); };
  // Almgebäude: gemauertes Erdgeschoss, Holz oben, flaches Satteldach mit Steinen
  const almHouse = (w, d, h) => {
    const o = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.55, d), white); base.position.y = h * 0.275 - 0.4; o.add(base);
    const up = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.45, d), wood); up.position.y = h * 0.775 - 0.4; o.add(up);
    const shp = new THREE.Shape(); shp.moveTo(-w / 2 - 1, 0); shp.lineTo(0, w * 0.22); shp.lineTo(w / 2 + 1, 0); shp.lineTo(-w / 2 - 1, 0);
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: d + 1.6, bevelEnabled: false }), slate); roof.position.set(0, h - 0.4, -d / 2 - 0.8); o.add(roof);
    for (let k = 0; k < 4; k++) for (const sz of [-1, 1]) { const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.05), dark); win.position.set(-w / 2 + 1.6 + k * (w - 3.2) / 3, h * 0.3, sz * (d / 2 + 0.02)); o.add(win); }
    o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return o;
  };
  const yaw = rand() * 6.28;
  place(almHouse(14, 9, 5.5), ax, az, yaw);
  place(almHouse(10, 7, 4.6), ax + Math.cos(yaw) * 19, az - Math.sin(yaw) * 19, yaw + 0.1);
  // Kapelle etwas abseits, wie auf dem Foto
  const ch = new THREE.Group();
  const nave = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4, 6.5), white); nave.position.y = 1.6; ch.add(nave);
  const apse = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 4, 16, 1, false, 0, Math.PI), white); apse.position.set(0, 1.6, 3.25); apse.rotation.y = -Math.PI / 2; ch.add(apse);
  const shp = new THREE.Shape(); shp.moveTo(-2.6, 0); shp.lineTo(0, 2.6); shp.lineTo(2.6, 0); shp.lineTo(-2.6, 0);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: 7.4, bevelEnabled: false }), slate); roof.position.set(0, 3.6, -3.7); ch.add(roof);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1, 1.3, 1), white); tower.position.set(0, 6.4, -2.4); ch.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 4).rotateY(Math.PI / 4), slate); spire.position.set(0, 8.15, -2.4); ch.add(spire);
  const xc = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), dark); xc.position.set(0, 9.55, -2.4); ch.add(xc);
  const xa = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), dark); xa.position.set(0, 9.65, -2.4); ch.add(xa);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.08), wood); door.position.set(0, 0.6, -3.27); ch.add(door);
  ch.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  place(ch, ax - Math.cos(yaw) * 26 + Math.sin(yaw) * 18, az + Math.sin(yaw) * 26 + Math.cos(yaw) * 18, yaw + Math.PI);
  KW.alm = { x: ax, z: az };
  return g;
}
