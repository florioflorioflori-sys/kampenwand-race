// ------------------------------------------------------------------
// Werbung an der Strecke: Prien-Teams und Sponsoren. Wenige, dafür
// unterschiedlich aufgestellte Werbeträger: Planen am Bauzaun, Tafeln auf
// Holzpflöcken, Aufsteller, Banner an Seilen, große Fahnen.
// ------------------------------------------------------------------
const hexOf = (n) => '#' + n.toString(16).padStart(6, '0');
const AD_FONT = '"Saira Condensed", "Arial Narrow", sans-serif';
// Sponsoren nur als Schriftzug (keine Logos)
const SPONSORS = [
  { name: 'Red Bull', bg: '#0c1f4a', fg: '#e8102e', fg2: '#ffcf00', sub: 'ENERGY DRINK', font: `900 {S}px ${AD_FONT}`, upper: true },
  { name: 'Coca-Cola', bg: '#e4001b', fg: '#ffffff', fg2: '#ffffff', sub: 'EISKALT', font: 'italic 700 {S}px Georgia, "Times New Roman", serif' },
  { name: 'Augustiner', bg: '#f1e7cf', fg: '#7a1414', fg2: '#2a4a2a', sub: 'BRÄU · MÜNCHEN', font: '700 {S}px Georgia, "Times New Roman", serif', upper: true },
  { name: 'Fötziger', bg: '#1f5a2e', fg: '#f6eed8', fg2: '#e2b23a', sub: 'AUS DEM CHIEMGAU', font: `800 {S}px ${AD_FONT}`, upper: true },
  { name: 'Rottmoser', bg: '#f7f3ea', fg: '#a3161a', fg2: '#1d1f1a', sub: 'SEIT GENERATIONEN', font: `800 {S}px ${AD_FONT}`, upper: true },
];
function adSpecs() {
  const teams = TEAMS.map((t) => ({ name: t.team.replace(' Prien', ''), bg: hexOf(t.jersey), fg: t.text, fg2: hexOf(t.accent), sub: 'PRIEN AM CHIEMSEE', font: `800 {S}px ${AD_FONT}`, upper: true, stripes: t.short === 'BAUHOF', bolt: t.short === 'E-WERK', dark: t.jersey === 0xf6f6f2 }));
  return [...teams, ...SPONSORS];
}
// Schriftzug; vertical = für hohe Fahnen
function adTex(a, w, h, vertical = false) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = a.bg; x.fillRect(0, 0, w, h);
    if (vertical) { x.translate(w / 2, h / 2); x.rotate(-Math.PI / 2); x.translate(-h / 2, -w / 2); [w, h] = [h, w]; }
    x.fillStyle = a.fg2;
    if (a.stripes) { for (let i = 0; i < 3; i++) { x.fillRect(0, h * (0.05 + i * 0.05), w, h * 0.025); x.fillRect(0, h * (0.83 + i * 0.05), w, h * 0.025); } }
    else { x.fillRect(0, 0, w, h * 0.07); x.fillRect(0, h * 0.93, w, h * 0.07); }
    if (a.bolt) { x.beginPath(); x.moveTo(w * 0.06, h * 0.2); x.lineTo(w * 0.1, h * 0.2); x.lineTo(w * 0.075, h * 0.48); x.lineTo(w * 0.11, h * 0.48); x.lineTo(w * 0.05, h * 0.82); x.lineTo(w * 0.07, h * 0.55); x.lineTo(w * 0.04, h * 0.55); x.fill(); }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const name = a.upper ? a.name.toUpperCase() : a.name;
    let fs = h * 0.52; const f = (n) => a.font.replace('{S}', Math.round(n));
    x.font = f(fs); while (x.measureText(name).width > w * 0.8 && fs > 8) { fs -= 2; x.font = f(fs); }
    x.fillStyle = a.fg; x.fillText(name, w / 2, h * 0.44);
    x.font = `600 ${Math.round(h * 0.17)}px Barlow, sans-serif`; x.fillStyle = a.dark ? '#1d1f1a' : a.fg2;
    x.fillText(a.sub, w / 2, h * 0.76);
  });
}
const flagWave = (mat) => {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { float ph = 0.0;
#ifdef USE_INSTANCING
        ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
#endif
        float k = uv.x; transformed.z += sin(uTime * 3.1 + uv.x * 5.0 - uv.y * 2.0 + ph) * 0.18 * k + sin(uTime * 5.3 + uv.y * 7.0 + ph) * 0.05 * k; }`);
    // Rückseite nicht spiegelverkehrt
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n  diffuseColor *= texture2D(map, gl_FrontFacing ? vMapUv : vec2(1.0 - vMapUv.x, vMapUv.y));\n#endif');
  };
  mat.customProgramCacheKey = () => 'flagWave';
  return mat;
};
function buildAds(rand) {
  const grp = new THREE.Group();
  const ads = adSpecs(), nA = ads.length;
  const faces = Array.from({ length: nA }, () => []), wood = [], steel = [], concrete = [], mesh = [];
  const pickAd = () => Math.floor(rand() * nA);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S1 = new THREE.Vector3(1, 1, 1);
  // Geometrie im Elementsystem (x längs, y hoch, z zur Strecke) in die Welt legen
  const put = (list, geo, frame, x, y, z, rx = 0, ry = 0, rz = 0) => {
    E.set(rx, ry, rz); Q.setFromEuler(E);
    geo.applyMatrix4(M4.compose(new THREE.Vector3(x, y, z), Q, S1)).applyMatrix4(frame);
    list.push(geo);
  };
  const panel = (w, h) => mergeGeometries([new THREE.PlaneGeometry(w, h), new THREE.PlaneGeometry(w, h).rotateY(Math.PI)]);
  // Platz freimachen: Zuschauer, die im Werbeträger stehen würden, treten zur Seite
  const clear = (x0, z0, x1, z1, r) => {
    for (let i = life.people.length - 1; i >= 0; i--) {
      const p = life.people[i], dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1;
      const t = clamp(((p.x - x0) * dx + (p.z - z0) * dz) / L2, 0, 1), d = Math.hypot(p.x - (x0 + dx * t), p.z - (z0 + dz * t));
      if (d < r && !p.flash) life.people.splice(i, 1);
    }
  };
  const types = ['stakes', 'fence', 'fence', 'aframe', 'rope', 'stakes'];
  const place = (s, side, type) => {
    const lat = side * (TRAIL_HALF + 0.55 + rand() * 0.9), pt = trailPoint(s, lat, {});
    if (trailDistAt(pt.x, pt.z) < TRAIL_HALF + 0.35 || scDistAt(pt.x, pt.z) < SC_HALF + 0.8) return 0;
    const y = hAt(pt.x, pt.z), yaw = pt.yaw - Math.PI / 2 + (rand() - 0.5) * 0.25 + (side > 0 ? Math.PI : 0);
    const frame = new THREE.Matrix4().compose(new THREE.Vector3(pt.x, y, pt.z), new THREE.Quaternion().setFromAxisAngle(_UP, yaw), S1);
    const ad = pickAd(), lean = (rand() - 0.5) * 0.12;
    let len = 0;
    if (type === 'stakes') {
      // Tafel auf zwei Holzpflöcken, leicht schief eingeschlagen
      const w = 2 + rand() * 1, h = 0.6 + rand() * 0.3, b = 0.12 + rand() * 0.25;
      put(faces[ad], panel(w, h), frame, 0, b + h / 2, 0, lean, 0, (rand() - 0.5) * 0.05);
      for (const sx of [-1, 1]) put(wood, new THREE.BoxGeometry(0.07, b + h + 0.15, 0.07), frame, sx * (w / 2 - 0.15), (b + h + 0.15) / 2 - 0.1, -0.05, lean * 0.8);
      len = w;
    } else if (type === 'fence') {
      // Bauzaun-Felder mit Plane, Betonfüße
      const n = 1 + Math.floor(rand() * 3), fw = 3.4;
      for (let k = 0; k < n; k++) {
        const cx = (k - (n - 1) / 2) * fw, gy = hAt(pt.x + Math.cos(yaw) * cx, pt.z - Math.sin(yaw) * cx) - y;
        for (const sx of [-1, 1]) { put(steel, new THREE.CylinderGeometry(0.02, 0.02, 2), frame, cx + sx * fw / 2, gy + 1.05, 0); put(concrete, new THREE.BoxGeometry(0.6, 0.15, 0.2), frame, cx + sx * fw / 2, gy + 0.07, 0); }
        put(steel, new THREE.BoxGeometry(fw, 0.03, 0.03), frame, cx, gy + 2.05, 0); put(steel, new THREE.BoxGeometry(fw, 0.03, 0.03), frame, cx, gy + 0.1, 0);
        put(mesh, new THREE.PlaneGeometry(fw, 1.95), frame, cx, gy + 1.07, 0);
        if (k === 0 || rand() < 0.6) put(faces[k === 0 ? ad : pickAd()], panel(fw - 0.2, 0.85 + rand() * 0.15), frame, cx, gy + 0.65 + rand() * 0.3, 0.03, 0, 0, (rand() - 0.5) * 0.02);
      }
      len = n * fw;
    } else if (type === 'aframe') {
      // Kundenstopper: zwei Tafeln als Dach
      const w = 0.75, h = 1.0;
      for (const sz of [-1, 1]) put(faces[ad], panel(w, h), frame, 0, h / 2 * 0.96, sz * 0.14, sz * 0.27, 0, 0);
      len = 1;
    } else {
      // Banner zwischen zwei Stangen, mit Seil abgespannt
      const w = 3 + rand() * 1.5, h = 0.9, top = 1.6 + rand() * 0.6;
      for (const sx of [-1, 1]) { put(wood, new THREE.CylinderGeometry(0.04, 0.05, top + 0.4), frame, sx * (w / 2 + 0.1), (top + 0.4) / 2 - 0.2, 0, 0, 0, sx * 0.04); put(steel, new THREE.CylinderGeometry(0.006, 0.006, 1.8).rotateX(0.9), frame, sx * (w / 2 + 0.1), top * 0.55, -0.75); }
      const g = new THREE.PlaneGeometry(w, h, 12, 1), pa = g.attributes.position;
      for (let i = 0; i < pa.count; i++) { const u = pa.getX(i) / w + 0.5; pa.setY(i, pa.getY(i) - Math.sin(u * Math.PI) * 0.08); pa.setZ(i, Math.sin(u * Math.PI * 3 + ad) * 0.03); }
      g.computeVertexNormals();
      put(faces[ad], mergeGeometries([g, g.clone().rotateY(Math.PI)]), frame, 0, top - h / 2, 0);
      len = w + 0.3;
    }
    const ex = Math.cos(yaw) * len / 2, ez = -Math.sin(yaw) * len / 2;
    clear(pt.x - ex, pt.z - ez, pt.x + ex, pt.z + ez, 0.55);
    reservedSpots.push([pt.x, pt.z, len / 2 + 0.6]);
    return len;
  };
  // Orte: Start, Ziel, Sprünge, Kehren – je Seite ein paar Gruppen mit Lücken
  const spots = [[10, 95], [trail.L - 115, trail.L - 8]];
  for (const k of trail.kickers) spots.push([k - 16, k + 22]);
  for (const s of life.rallySpots || []) spots.push([s - 26, s + 26]);
  const flags = Array.from({ length: nA }, () => []), poles = [];
  for (const [a, b] of spots) {
    for (const side of [-1, 1]) {
      let s = a + rand() * 8;
      while (s < b) {
        const len = place(s, side, types[Math.floor(rand() * types.length)]);
        s += Math.max(len, 2) + 4 + rand() * 14;
      }
      // ein paar große Fahnen hinter den Leuten
      for (let s2 = a + 8 + rand() * 10; s2 < b; s2 += 22 + rand() * 20) {
        const lat = side * (TRAIL_HALF + 9 + rand() * 6), pt = trailPoint(s2, lat, {});
        if (trailDistAt(pt.x, pt.z) < TRAIL_HALF + 4 || scDistAt(pt.x, pt.z) < SC_HALF + 2) continue;
        const y = hAt(pt.x, pt.z), hgt = 0.85 + rand() * 0.3;
        poles.push([pt.x, y, pt.z, hgt]);
        M4.compose(new THREE.Vector3(pt.x, y + 7.3 * hgt, pt.z), Q.setFromAxisAngle(_UP, pt.yaw + Math.PI / 2 + (rand() - 0.5) * 0.8), new THREE.Vector3(1, hgt, 1));
        flags[pickAd()].push(M4.clone());
        reservedSpots.push([pt.x, pt.z, 1.5]);
      }
    }
  }
  const norm = (g) => { if (g.index) g = g.toNonIndexed(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; };
  const addMerged = (list, mat, shadow = true) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list.map(norm), false), mat); m.castShadow = shadow; m.receiveShadow = true; grp.add(m); };
  addMerged(wood, new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.9 }));
  addMerged(steel, new THREE.MeshStandardMaterial({ color: 0xb8bcbf, roughness: 0.35, metalness: 0.7 }));
  addMerged(concrete, new THREE.MeshStandardMaterial({ color: 0x8e8a82, roughness: 0.95 }));
  // Bauzaun-Gitter als Alpha-Textur
  const meshTex = canvasTex(64, 64, (x) => { x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(0, 0, 64, 64); x.beginPath(); x.moveTo(32, 0); x.lineTo(32, 64); x.stroke(); }, { srgb: false, repeat: true });
  meshTex.repeat.set(17, 10);
  addMerged(mesh, new THREE.MeshStandardMaterial({ color: 0xc8ccd0, alphaMap: meshTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.6 }), false);
  const flagGeo = new THREE.PlaneGeometry(1.1, 4.4, 8, 16).translate(0.6, 0, 0);
  ads.forEach((a, i) => {
    addMerged(faces[i], new THREE.MeshStandardMaterial({ map: adTex(a, 512, 150), roughness: 0.6 }));
    if (flags[i].length) {
      const fm = flagWave(new THREE.MeshStandardMaterial({ map: adTex(a, 128, 512, true), roughness: 0.8, side: THREE.DoubleSide }));
      const im = new THREE.InstancedMesh(flagGeo, fm, flags[i].length);
      flags[i].forEach((mm, k) => im.setMatrixAt(k, mm)); im.castShadow = true; grp.add(im);
    }
  });
  if (poles.length) {
    const pg = new THREE.CylinderGeometry(0.05, 0.07, 9.6, 6).translate(0, 4.8, 0);
    const im = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0xcfd2d4, roughness: 0.35, metalness: 0.6 }), poles.length);
    poles.forEach((p, k) => im.setMatrixAt(k, M4.compose(new THREE.Vector3(p[0], p[1], p[2]), Q.identity(), new THREE.Vector3(1, p[3], 1)))); im.castShadow = true; grp.add(im);
  }
  // Banner quer über die Strecke: vor jedem zweiten Sprung, in den Kehren, am Start und vor dem Ziel
  const postM = new THREE.MeshStandardMaterial({ color: 0x1d1f1a, roughness: 0.5, metalness: 0.4 });
  const archAt = [...trail.kickers.filter((_, i) => i % 2 === 0).map((k) => k - 30), ...(life.rallySpots || []).map((s) => s - 20), 140, trail.L - 140];
  archAt.forEach((s, i) => {
    if (s < 20 || s > trail.L - 20) return;
    const a = ads[(i * 7 + 3) % nA], pt = trailPoint(s, 0, {}), y = hAt(pt.x, pt.z);
    const g = new THREE.Group(), w = TRAIL_HALF * 2 + 3.2;
    for (const sx of [-1, 1]) {
      const px = pt.x + Math.cos(pt.yaw) * sx * w / 2, pz = pt.z - Math.sin(pt.yaw) * sx * w / 2;
      const dy = hAt(px, pz) - y - 0.3, hh = 5.35 - dy;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, hh, 0.22), postM); p.position.set(sx * w / 2, dy + hh / 2, 0); p.castShadow = true; g.add(p);
    }
    const face = new THREE.MeshStandardMaterial({ map: adTex(a, 1024, 256), roughness: 0.6 });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(w, 1.25, 0.08), [postM, postM, postM, postM, face, face]);
    banner.position.set(0, 4.7, 0); banner.castShadow = true; g.add(banner);
    g.position.set(pt.x, y, pt.z); g.rotation.y = pt.yaw;
    grp.add(g);
  });
  return grp;
}
