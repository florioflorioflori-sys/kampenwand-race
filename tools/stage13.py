# v28: Sprechblasen weg, Stämme im Wind, Zuschauer lebendiger und schauen allen Fahrern nach,
# Fahrer lockerer (Hände, Kopf, Körper), Bike folgt dem Gelände weicher
# --- Sprechblasen ausblenden (Rufe bleiben hörbar)
rep("s.scale.set(3.2, 0.8, 1); s.renderOrder = 5;", "s.scale.set(3.2, 0.8, 1); s.renderOrder = 5; s.visible = false;", 2)
# --- Baumstämme schwingen wie die Krone mit (gleiche Formel, ohne Blattflattern)
rep("function noInstanceColor(mat) {",
"""function barkWind(mat, strength) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uWind = uWind;
    sh.vertexShader = 'uniform float uTime; uniform vec4 uWind;\\n' + sh.vertexShader.replace('#include <color_vertex>', '#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\\n vColor = vec3( 1.0 );\\n#endif').replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float hh = max(0.0, position.y - 1.5) / 20.0;
        #ifdef USE_INSTANCING
          vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 ip = vec2(0.0);
        #endif
        float ph = ip.x * 0.07 + ip.y * 0.05;
        float along = dot(ip, uWind.xy);
        float gw = pow(sin(along * 0.05 - uTime * 0.9) * 0.5 + 0.5, 2.0);
        float g = (sin(uTime * 0.31 + ph * 0.3) * 0.3 + 0.7 + gw * 1.1) * uWind.z;
        float sway = hh * hh * ${(strength * 1.8).toFixed(3)} * g;
        transformed.xz += uWind.xy * sway * (0.9 + 0.5 * sin(uTime * 1.3 + ph));
        transformed.x += sin(uTime * 0.9 + ph) * sway * 0.35;
        transformed.z += cos(uTime * 0.75 + ph * 1.3) * sway * 0.3;
      }`);
  };
  mat.customProgramCacheKey = () => 'barkw' + strength;
  return mat;
}
function noInstanceColor(mat) {""")
rep("  const bark = (c) => noInstanceColor(new THREE.MeshStandardMaterial({ map: TEX.bark, color: c, roughness: 0.95, envMapIntensity: 0.3 }));",
    "  const bark = (c, w = 0.6) => barkWind(new THREE.MeshStandardMaterial({ map: TEX.bark, color: c, roughness: 0.95, envMapIntensity: 0.3 }), w);")
rep("larch: [bark(new THREE.Color(0.6, 0.42, 0.34)), foliage(TEX.larch, 0.7)],", "larch: [bark(new THREE.Color(0.6, 0.42, 0.34), 0.7), foliage(TEX.larch, 0.7)],")
rep("snag: [bark(new THREE.Color(0.68, 0.66, 0.64))],", "snag: [bark(new THREE.Color(0.68, 0.66, 0.64), 0.35)],")
rep("beech: [bark(new THREE.Color(0.62, 0.62, 0.6)), foliage(TEX.leaf, 0.9)],", "beech: [bark(new THREE.Color(0.62, 0.62, 0.6), 0.9), foliage(TEX.leaf, 0.9)],")
# --- Zuschauer: schauen dem nächsten Fahrer nach (nicht nur dem Spieler), drehen den Körper mit
rep("function updateLife(dt, t, cam, P) {",
"""let _lifeR = [];
// Reaktionen und kleine Gesten über allen Stehposen
const EXC_FREE = new Set(['stand', 'hips', 'pockets', 'crossed', 'behind', 'clap', 'cheer', 'dab']);
const _exA = new THREE.Vector3(), _exB = new THREE.Vector3();
function exciteLayer(j, t, e, p) {
  if (!j || !j.haL || !j.pelvis || j.pelvis.y < 0.75 || p.h.kid && p.pose === 'kidrun') return j;
  const free = EXC_FREE.has(p.pose), w = e * e * (3 - 2 * e);
  const kind = Math.floor(Math.abs(Math.sin(p.ph * 7.31)) * 7), f = t * (5.5 + (p.ph % 1) * 3) + p.ph;
  if (w < 0.2 && free) {
    // ruhige Momente: am Kopf kratzen, Hand über die Augen, gestikulieren, strecken, auf die Uhr schauen
    if (p.gs === undefined) p.gs = t + Math.random() * 12;
    if (t > p.gs + 2.4) p.gs = t + 5 + Math.random() * 14;
    const u = (t - p.gs) / 2.4;
    if (u > 0 && u < 1) {
      const g = Math.sin(Math.PI * u) * (1 - w * 4), gk = Math.floor(Math.abs(Math.sin(p.ph * 3.7 + Math.floor(p.gs) * 1.3)) * 5);
      if (gk === 0) { j.haR.lerp(_exA.set(-0.11, 1.7, 0.04), g); j.elbowPoleR = V(-1, 0.3, -0.2); }
      else if (gk === 1) { j.haR.lerp(_exA.set(-0.04, 1.71, 0.17), g); j.elbowPoleR = V(-1, -0.2, 0.1); j.headQ = E(-0.12 * g, 0, 0); }
      else if (gk === 2) { j.haR.lerp(_exA.set(-0.17, 1.18 + Math.sin(t * 5 + p.ph) * 0.07, 0.32), g); j.haL.lerp(_exB.set(0.15, 1.12 + Math.cos(t * 4 + p.ph) * 0.05, 0.28), g * 0.6); }
      else if (gk === 3) { j.haL.lerp(_exA.set(0.12, 1.74, -0.06), g); j.haR.lerp(_exB.set(-0.12, 1.74, -0.06), g); j.elbowPole = V(1, 0.6, 0); j.elbowPoleR = V(-1, 0.6, 0); }
      else { j.haL.lerp(_exA.set(0.04, 1.24, 0.26), g); j.elbowPole = V(1, -0.6, -0.2); j.headQ = E(0.35 * g, 0, 0); }
    }
    return j;
  }
  if (w < 0.02) return j;
  if (!free) { shiftY(j, Math.abs(Math.sin(f)) * 0.035 * w); return j; }
  const L = j.haL, R = j.haR, s = Math.sin(f);
  if (kind === 0) { R.lerp(_exA.set(-0.33 + s * 0.14, 1.88, 0.1), w); j.elbowPoleR = V(-1, 0, -0.2); }
  else if (kind === 1) { R.lerp(_exA.set(-0.22, 1.5 + Math.max(0, s) * 0.38, 0.2), w); L.lerp(_exB.set(0.21, 1.02, 0.12), w * 0.5); j.elbowPoleR = V(-1, -0.4, -0.2); }
  else if (kind === 2 || kind === 6) { L.lerp(_exA.set(0.33 + s * 0.05, 1.9, 0.1), w); R.lerp(_exB.set(-0.33 - s * 0.05, 1.9, 0.1), w); j.elbowPole = V(1, 0, -0.2); j.elbowPoleR = V(-1, 0, -0.2); }
  else if (kind === 3) { const c = Math.sin(f * 1.5) * 0.5 + 0.5; L.lerp(_exA.set(0.03 + c * 0.12, 1.86, 0.12), w); R.lerp(_exB.set(-0.03 - c * 0.12, 1.86, 0.12), w); j.elbowPole = V(1, 0.2, -0.2); j.elbowPoleR = V(-1, 0.2, -0.2); }
  else if (kind === 4) { L.lerp(_exA.set(0.07, 1.6, 0.2), w); R.lerp(_exB.set(-0.07, 1.6, 0.2), w); j.elbowPole = V(1, -0.3, 0); j.elbowPoleR = V(-1, -0.3, 0); for (const k of ['chest', 'neck', 'head', 'shL', 'shR']) j[k].z += 0.06 * w; }
  else { R.lerp(_exA.set(-0.14, 1.5, 0.56), w); L.lerp(_exB.set(0.2, 1.0, 0.1), w * 0.5); j.elbowPoleR = V(-1, -0.5, 0); for (const k of ['chest', 'neck', 'head', 'shL', 'shR']) j[k].z += 0.03 * w; }
  const jump = kind === 2 || kind === 6 ? Math.max(0, Math.sin(f * 0.8)) * 0.1 : Math.abs(s) * 0.025;
  return shiftY(j, jump * w);
}
function updateLife(dt, t, cam, P) {
  _lifeR = typeof riders !== 'undefined' && riders && riders.length ? riders.filter((r) => r.model && r.model.visible).map((r) => r.model.position) : [];
  if (!_lifeR.length) _lifeR = [P.pos];""")
rep("    const dp = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);",
    "    let dp = 1e9, NR = P.pos; for (const q of _lifeR) { const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < dp) { dp = d; NR = q; } }")
rep("let a = Math.atan2(P.pos.x - p.x, P.pos.z - p.z) - p.yaw;", "let a = Math.atan2(NR.x - p.x, NR.z - p.z) - p.yaw;", 2)
rep("      j = POSES[p.pose](t, p.e, p.ph);\n      fillJoints(j);", "      j = exciteLayer(POSES[p.pose](t, p.e, p.ph), t, p.e, p);\n      fillJoints(j);")
rep("      j = POSES[p.pose](t, p.e, p.ph);\n      let look = 0;", "      j = exciteLayer(POSES[p.pose](t, p.e, p.ph), t, p.e, p);\n      let look = 0;")
rep("      realPose(e, j, p.yaw, _lv.set(p.x, p.y, p.z), p.lookS);", "      realPose(e, j, p.yaw + p.lookS * 0.35, _lv.set(p.x, p.y, p.z), p.lookS * 0.65);")
# Massen drehen sich zum vorbeifahrenden Fahrer
rep("    im.instanceMatrix.array.set(p.cr.M, i * 16);",
"""    let MM = p.cr.M;
    { let bd = 1e9, bq = null; for (const q of _lifeR) { const d = (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z); if (d < bd) { bd = d; bq = q; } }
      let want = 0; if (bq && bd < 1600 && p.react !== false) want = clamp(wrapAngle(Math.atan2(bq.x - p.x, bq.z - p.z) - p.yaw), -1.3, 1.3) * smooth(40, 18, Math.sqrt(bd));
      p.cty = (p.cty || 0) + (want - (p.cty || 0)) * 0.05;
      if (Math.abs(p.cty) > 0.004) { const gr = specGirth(p.h); _cmQ.setFromAxisAngle(_UP, p.yaw + p.cty); _cmM.compose(_cmV.set(p.x, p.y, p.z), _cmQ, _cmS.set(p.cr.sc * gr, p.cr.sc, p.cr.sc * gr)); MM = _cmM.toArray(_cmA); } }
    im.instanceMatrix.array.set(MM, i * 16);""")
rep("function updateCrowd(cam) {", "const _cmQ = new THREE.Quaternion(), _cmM = new THREE.Matrix4(), _cmV = new THREE.Vector3(), _cmS = new THREE.Vector3(), _cmA = new Float32Array(16);\nfunction updateCrowd(cam) {")
# --- Fahrer lockerer: Körperfeder weicher, leichtes Eigenleben, öfter Kopf drehen
rep("const tx = lean * 0.08;", "const tx = lean * 0.08 + (vnoise(D.t * 0.55, D.seed) - 0.5) * 0.06 * (1 - D.idle);")
rep("const tz = -0.11 * b - 0.03 * c + 0.05 * ped - (st.air ? 0.03 : 0);", "const tz = -0.11 * b - 0.03 * c + 0.05 * ped - (st.air ? 0.03 : 0) + (vnoise(D.t * 0.4, D.seed + 5.1) - 0.5) * 0.05 * (1 - D.idle);")
rep("const K = 75, C = 10,", "const K = 58, C = 8.5,")
rep("st.look = (st.look || 0) - D.vy * 0.05 + D.idle * (0.25 + Math.sin(D.t * 0.31 + D.seed) * 0.12) + D.cele * 0.3;",
    "st.look = (st.look || 0) - D.vy * 0.05 + D.idle * (0.25 + Math.sin(D.t * 0.31 + D.seed) * 0.12) + D.cele * 0.3 + (vnoise(D.t * 0.5, D.seed + 9.7) - 0.5) * 0.14;")
rep("S.glD = 0.5 + Math.random() * 0.5; S.glT = 2.5 + Math.random() * 5;", "S.glD = 0.45 + Math.random() * 0.6; S.glT = 1.4 + Math.random() * 3.2;")
# Arme: Ellbogen arbeiten, Schultern locker, ab und zu eine Hand kurz ausschütteln
rep("  bikeXform(u, pitch, yaw, roll, 0, py, 0.05, 0, oy, 0);",
"""  bikeXform(u, pitch, yaw, roll, 0, py, 0.05, 0, oy, 0);
  if (!tk && !(st.crashT > 0)) {
    const lz = 1 - D.idle;
    RP.epL.y += (vnoise(D.t * 0.9, D.seed + 1.3) - 0.5) * 0.7 * lz; RP.epR.y += (vnoise(D.t * 0.9, D.seed + 2.9) - 0.5) * 0.7 * lz;
    RP.shL.y += (vnoise(D.t * 0.7, D.seed + 4.1) - 0.5) * 0.03 * lz; RP.shR.y += (vnoise(D.t * 0.7, D.seed + 6.3) - 0.5) * 0.03 * lz;
    if (D.gN === undefined) D.gN = D.t + 3 + Math.random() * 6;
    const calm = !st.air && Math.abs(lean) < 0.12 && !(st.brake > 0) && !st.pedal && (st.sp || 0) < 15 && (st.sp || 0) > 3;
    if (D.t > D.gN && calm && !(D.gS > D.t - 1)) { D.gS = D.t; D.gSide = Math.random() < 0.5 ? 1 : -1; D.gN = D.t + 6 + Math.random() * 9; }
    const gu = (D.t - (D.gS ?? -9)) / 0.95;
    if (gu > 0 && gu < 1) {
      const fh = Math.sin(Math.PI * gu), key = D.gSide > 0 ? 'gL' : 'gR';
      RP[key].lerp(_ra.t.set(D.gSide * 0.4, 1.0 + Math.sin(D.t * 26) * 0.035 * fh, 0.12), fh * 0.85);
    }
  }""")
# --- Bike folgt dem Gelände über beide Radaufstandspunkte, geglättet
rep("function poseAllRiders(inp) {",
"""const _wuA = new THREE.Vector3(), _wuB = new THREE.Vector3(), _wuC = new THREE.Vector3();
function wheelUp(x, z, yaw, out) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const hf = hAt(x + fx * 0.62, z + fz * 0.62), hb = hAt(x - fx * 0.62, z - fz * 0.62), hl = hAt(x + rx * 0.3, z + rz * 0.3), hr = hAt(x - rx * 0.3, z - rz * 0.3);
  _wuA.set(fx * 1.24, hf - hb, fz * 1.24); _wuB.set(rx * 0.6, hl - hr, rz * 0.6);
  return out.crossVectors(_wuA, _wuB).normalize();
}
function poseAllRiders(inp) {""")
rep("    if (r.isPlayer) poseModel(r.model, r.pos.x, r.pos.y, r.pos.z, r.yaw, r.pitchUp, r.lean + wob, riderState(r, inp), r.crashT);",
"""    if (!r.upS) r.upS = new THREE.Vector3(0, 1, 0);
    if (r.isPlayer) { if (!r.air && !(r.crashT > 0)) r.upS.lerp(wheelUp(r.pos.x, r.pos.z, r.yaw, _wuC), 1 - Math.exp(-9 / 60)).normalize(); else r.upS.lerp(r.pitchUp, 1 - Math.exp(-10 / 60)).normalize();
      poseModel(r.model, r.pos.x, r.pos.y, r.pos.z, r.yaw, r.upS, r.lean + wob, riderState(r, inp), r.crashT); }""")
rep("      const A = r.ai; _n.set(0, 1, 0); const nn = normalAt(A.x, A.z, _tmp.clone()); if (!A.air) _n.lerp(nn, 0.85);",
    "      const A = r.ai; if (!A.air) r.upS.lerp(wheelUp(A.x, A.z, A.yaw, _wuC), 1 - Math.exp(-9 / 60)).normalize(); else r.upS.lerp(_wuC.set(0, 1, 0), 1 - Math.exp(-3 / 60)).normalize(); _n.copy(r.upS);")
rep('<div class="eyebrow">Vorabversion v27 · Zuschauer, Gesichter, Werbung · Browser</div>',
    '<div class="eyebrow">Vorabversion v28 · Lebendige Fahrer und Zuschauer · Browser</div>')
