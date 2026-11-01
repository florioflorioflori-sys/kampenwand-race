// ------------------------------------------------------------------
// Werbung der Prien-Teams: Banden an der Strecke, Banner über der Strecke
// und große Fahnen hinter den Zuschauern
// ------------------------------------------------------------------
const hexOf = (n) => '#' + n.toString(16).padStart(6, '0');
const AD_FONT = '"Saira Condensed", "Arial Narrow", sans-serif';
// Schriftzug eines Teams; vertical = für hohe Fahnen
function teamTex(t, w, h, vertical = false) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = hexOf(t.jersey); x.fillRect(0, 0, w, h);
    if (vertical) { x.translate(w / 2, h / 2); x.rotate(-Math.PI / 2); x.translate(-h / 2, -w / 2); [w, h] = [h, w]; }
    // Streifen in der Akzentfarbe
    x.fillStyle = hexOf(t.accent);
    if (t.short === 'BAUHOF') { for (let i = 0; i < 3; i++) x.fillRect(0, h * (0.06 + i * 0.05), w, h * 0.025); for (let i = 0; i < 3; i++) x.fillRect(0, h * (0.82 + i * 0.05), w, h * 0.025); }
    else { x.fillRect(0, 0, w, h * 0.1); x.fillRect(0, h * 0.9, w, h * 0.1); }
    if (t.short === 'E-WERK') { x.beginPath(); x.moveTo(w * 0.06, h * 0.2); x.lineTo(w * 0.1, h * 0.2); x.lineTo(w * 0.075, h * 0.48); x.lineTo(w * 0.11, h * 0.48); x.lineTo(w * 0.05, h * 0.82); x.lineTo(w * 0.07, h * 0.55); x.lineTo(w * 0.04, h * 0.55); x.fill(); }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const name = t.team.toUpperCase().replace(' PRIEN', '');
    let fs = h * 0.5; x.font = `800 ${fs}px ${AD_FONT}`;
    while (x.measureText(name).width > w * 0.8 && fs > 8) { fs -= 2; x.font = `800 ${fs}px ${AD_FONT}`; }
    x.fillStyle = t.text; x.fillText(name, w / 2, h * 0.43);
    x.font = `600 ${h * 0.2}px Barlow, sans-serif`; x.fillStyle = t.jersey === 0xf6f6f2 ? '#1d1f1a' : '#ffffff';
    x.fillText('PRIEN AM CHIEMSEE', w / 2, h * 0.73);
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
  const nT = TEAMS.length;
  // Orte mit Banden: Start, Ziel, Sprünge, Kehren
  const spots = [[8, 95], [trail.L - 115, trail.L - 6]];
  for (const k of trail.kickers) spots.push([k - 18, k + 26]);
  for (const s of life.rallySpots || []) spots.push([s - 28, s + 28]);
  const boards = Array.from({ length: nT }, () => []), poles = [], flags = Array.from({ length: nT }, () => []);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  let ti = 0;
  for (const [a, b] of spots) {
    for (const side of [-1, 1]) {
      for (let s = a; s < b; s += 2.55) {
        const lat = side * (TRAIL_HALF + 0.45), pt = trailPoint(s, lat, {});
        if (trailDistAt(pt.x, pt.z) < TRAIL_HALF + 0.25 || scDistAt(pt.x, pt.z) < SC_HALF + 0.6) continue;
        q.setFromAxisAngle(_UP, pt.yaw - Math.PI / 2);
        m.compose(new THREE.Vector3(pt.x, hAt(pt.x, pt.z) + 0.36, pt.z), q, sc);
        boards[ti++ % nT].push(m.clone());
      }
      // große Fahnen hinter den Leuten
      for (let s = a + 6; s < b; s += 13 + rand() * 8) {
        const lat = side * (TRAIL_HALF + 9 + rand() * 6), pt = trailPoint(s, lat, {});
        if (trailDistAt(pt.x, pt.z) < TRAIL_HALF + 4 || scDistAt(pt.x, pt.z) < SC_HALF + 2) continue;
        const y = hAt(pt.x, pt.z);
        poles.push(new THREE.Vector3(pt.x, y, pt.z));
        q.setFromAxisAngle(_UP, pt.yaw + Math.PI / 2 + (rand() - 0.5) * 0.8);
        m.compose(new THREE.Vector3(pt.x, y + 7.3, pt.z), q, sc);
        flags[Math.floor(rand() * nT)].push(m.clone());
        reservedSpots.push([pt.x, pt.z, 1.5]);
      }
    }
  }
  const edge = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.6 });
  const boardGeo = new THREE.BoxGeometry(2.45, 0.72, 0.05);
  const flagGeo = new THREE.PlaneGeometry(1.1, 4.4, 8, 16).translate(0.6, 0, 0);
  const poleM = new THREE.MeshStandardMaterial({ color: 0xcfd2d4, roughness: 0.35, metalness: 0.6 });
  TEAMS.forEach((t, i) => {
    const face = new THREE.MeshStandardMaterial({ map: teamTex(t, 512, 150), roughness: 0.55 });
    if (boards[i].length) {
      const im = new THREE.InstancedMesh(boardGeo, [edge, edge, edge, edge, face, face], boards[i].length);
      boards[i].forEach((mm, k) => im.setMatrixAt(k, mm)); im.castShadow = true; im.receiveShadow = true; grp.add(im);
    }
    if (flags[i].length) {
      const fm = flagWave(new THREE.MeshStandardMaterial({ map: teamTex(t, 128, 512, true), roughness: 0.8, side: THREE.DoubleSide }));
      const im = new THREE.InstancedMesh(flagGeo, fm, flags[i].length);
      flags[i].forEach((mm, k) => im.setMatrixAt(k, mm)); im.castShadow = true; grp.add(im);
    }
  });
  if (poles.length) {
    const pg = new THREE.CylinderGeometry(0.05, 0.07, 9.6, 6).translate(0, 4.8, 0);
    const im = new THREE.InstancedMesh(pg, poleM, poles.length);
    poles.forEach((p, k) => im.setMatrixAt(k, m.makeTranslation(p.x, p.y, p.z))); im.castShadow = true; grp.add(im);
  }
  // Banner quer über die Strecke vor jedem Sprung und in den Kehren
  const postM = new THREE.MeshStandardMaterial({ color: 0x1d1f1a, roughness: 0.5, metalness: 0.4 });
  const archAt = [...trail.kickers.map((k) => k - 30), ...(life.rallySpots || []).map((s) => s - 20), 140, trail.L - 140];
  archAt.forEach((s, i) => {
    if (s < 20 || s > trail.L - 20) return;
    const t = TEAMS[i % nT], pt = trailPoint(s, 0, {}), y = hAt(pt.x, pt.z);
    const g = new THREE.Group(), w = TRAIL_HALF * 2 + 3.2;
    for (const sx of [-1, 1]) {
      const px = pt.x + Math.cos(pt.yaw) * sx * w / 2, pz = pt.z - Math.sin(pt.yaw) * sx * w / 2;
      const dy = hAt(px, pz) - y - 0.3, hh = 5.35 - dy;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, hh, 0.22), postM); p.position.set(sx * w / 2, dy + hh / 2, 0); p.castShadow = true; g.add(p);
    }
    const face = new THREE.MeshStandardMaterial({ map: teamTex(t, 1024, 256), roughness: 0.6 });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(w, 1.25, 0.08), [postM, postM, postM, postM, face, face]);
    banner.position.set(0, 4.7, 0); banner.castShadow = true; g.add(banner);
    g.position.set(pt.x, y, pt.z); g.rotation.y = pt.yaw;
    grp.add(g);
  });
  return grp;
}
