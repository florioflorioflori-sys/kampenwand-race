// ------------------------------------------------------------------
// Figuren-System: Menschen und Tiere aus weich verbundenen Kapseln.
// Jede Kapsel läuft von a nach b mit Radius r0..r1 und kann seitlich
// abgeflacht werden. Gelenke teilen sich Endpunkt und Radius, dadurch
// gibt es keine Lücken zwischen Körperteilen.
// ------------------------------------------------------------------
const PUP = { max: 26000, n: 0 };
const _ps = new THREE.Vector3(), _pd = new THREE.Vector3(), _pq = new THREE.Quaternion(), _pm = new THREE.Matrix4(), _UP = new THREE.Vector3(0, 1, 0);
const CAPSULE_GLSL = `
  attribute vec4 iA; attribute vec4 iB; attribute vec4 iR;
  void capsule(vec3 p, vec3 n, out vec3 P, out vec3 N) {
    vec3 d = iB.xyz - iA.xyz; float L = length(d);
    vec3 Y = L > 1e-5 ? d / L : vec3(0.0, 1.0, 0.0);
    vec3 X = iR.xyz - Y * dot(iR.xyz, Y);
    if (dot(X, X) < 1e-6) X = abs(Y.y) < 0.9 ? cross(Y, vec3(0.0, 1.0, 0.0)) : cross(Y, vec3(1.0, 0.0, 0.0));
    X = normalize(X); vec3 Z = cross(X, Y);
    vec3 c; float r; vec3 l = p;
    if (p.y > 0.5) { c = iB.xyz; r = iB.w; l.y -= 0.5; }
    else if (p.y < -0.5) { c = iA.xyz; r = iA.w; l.y += 0.5; }
    else { float t = p.y + 0.5; c = mix(iA.xyz, iB.xyz, t); r = mix(iA.w, iB.w, t); l.y = 0.0; }
    P = c + (X * l.x * iR.w + Y * l.y + Z * l.z) * r;
    N = normalize(X * n.x / iR.w + Y * n.y + Z * n.z);
  }
`;
function capsulize(mat, key) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + CAPSULE_GLSL)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal; { vec3 _p; capsule(position, normal, _p, objectNormal); }')
      .replace('#include <begin_vertex>', 'vec3 transformed; { vec3 _n; capsule(position, normal, transformed, _n); }');
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}
function buildPuppetSystem() {
  const src = new THREE.CapsuleGeometry(1, 1, 4, 12);
  const g = new THREE.InstancedBufferGeometry();
  g.index = src.index; g.setAttribute('position', src.attributes.position); g.setAttribute('normal', src.attributes.normal);
  const N = PUP.max;
  for (const [k, n] of [['iA', 4], ['iB', 4], ['iR', 4], ['color', 3]]) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(N * n), n); a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute(k, a); PUP[k] = a.array;
  }
  g.instanceCount = 0; PUP.geo = g;
  const mat = capsulize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, envMapIntensity: 0.45 }), 'capsule');
  const mesh = new THREE.Mesh(g, mat);
  mesh.customDepthMaterial = capsulize(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), 'capsuleDepth');
  mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
  PUP.mesh = mesh;
  return mesh;
}
const _cA = new THREE.Vector3(), _cB = new THREE.Vector3();
// Kapsel von a nach b; right = Richtung der Abflachung, flat = Breite/Tiefe
function cap(a, b, r0, r1, col, right, flat = 1) {
  if (PUP.n >= PUP.max) return;
  const i = PUP.n++, A = PUP.iA, B = PUP.iB, R = PUP.iR, C = PUP.color;
  A[i * 4] = a.x; A[i * 4 + 1] = a.y; A[i * 4 + 2] = a.z; A[i * 4 + 3] = r0;
  B[i * 4] = b.x; B[i * 4 + 1] = b.y; B[i * 4 + 2] = b.z; B[i * 4 + 3] = r1 ?? r0;
  if (right) { R[i * 4] = right.x; R[i * 4 + 1] = right.y; R[i * 4 + 2] = right.z; } else { R[i * 4] = 0; R[i * 4 + 1] = 0; R[i * 4 + 2] = 0; }
  R[i * 4 + 3] = flat;
  C[i * 3] = col.r; C[i * 3 + 1] = col.g; C[i * 3 + 2] = col.b;
}
function ball(p, r, col) { cap(p, p, r, r, col); }
// Ellipsoid-artige Kapsel um einen Mittelpunkt entlang einer Achse
function ell(p, axis, half, r, col, right, flat) { cap(_cA.copy(p).addScaledVector(axis, -half), _cB.copy(p).addScaledVector(axis, half), r, r, col, right, flat); }
// Ferne Figuren werden nicht jedes Bild neu gestellt, sondern aus dem Zwischenspeicher kopiert
const PUP_ANIM = 120, PUP_FAR = 380;
function pupDraw(ent, dist, fn) {
  if (dist > PUP_FAR) return;
  const n0 = PUP.n;
  if (dist < PUP_ANIM || !ent.cache) {
    fn();
    if (dist > PUP_ANIM * 0.75 || !ent.cache) {
      const n1 = PUP.n;
      ent.cache = { A: PUP.iA.slice(n0 * 4, n1 * 4), B: PUP.iB.slice(n0 * 4, n1 * 4), R: PUP.iR.slice(n0 * 4, n1 * 4), C: PUP.color.slice(n0 * 3, n1 * 3), n: n1 - n0 };
    }
  } else {
    const c = ent.cache; if (PUP.n + c.n > PUP.max) return;
    PUP.iA.set(c.A, n0 * 4); PUP.iB.set(c.B, n0 * 4); PUP.iR.set(c.R, n0 * 4); PUP.color.set(c.C, n0 * 3);
    PUP.n += c.n;
  }
}
function pBegin() { PUP.n = 0; }
function pFlush() {
  const g = PUP.geo; g.instanceCount = PUP.n;
  for (const k of ['iA', 'iB', 'iR', 'color']) { const a = g.attributes[k]; a.clearUpdateRanges(); a.addUpdateRange(0, PUP.n * a.itemSize); a.needsUpdate = true; }
}

// Zwei-Gelenk-IK: Knie/Ellbogen zwischen a und c, Richtung pole
function ik2(a, c, l1, l2, pole, out) {
  const d = new THREE.Vector3().subVectors(c, a);
  let L = clamp(d.length(), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
  d.normalize();
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const p = pole.clone().addScaledVector(d, -pole.dot(d)).normalize();
  return out.copy(a).addScaledVector(d, x).addScaledVector(p, h);
}

const SKIN = [0xe8b896, 0xd9a47e, 0xc48a66, 0x9a6446, 0x6e4430, 0xf2cdb0, 0xe0ae8a];
const HAIR = [0x2a1d14, 0x4a3020, 0x6b4a2a, 0xa07a48, 0xc9a66b, 0x111111, 0x2a1d14, 0x7a7a7a, 0x8a3a1e];
const JACKET = [0x2f4a2a, 0xe8462b, 0x24456b, 0xe2a33a, 0x5b3a6b, 0x1d1f1a, 0x7a2a2a, 0x3a6b8a, 0x2a8a6a, 0xd8d0c0, 0x4a5a3a, 0xc23a5a, 0x1f6fb2, 0xf0c020, 0x6a4a3a, 0x9a9a9a];
const PANTS = [0x1d1f1a, 0x2a3442, 0x3a3020, 0x4a4a4a, 0x26364a, 0x5a4a3a, 0x3a4a2a, 0x2c2c3a];
const SHOES = [0x1a1a1a, 0x3a2a1e, 0x5a3a22, 0x4a4a4a, 0x8a2a1a, 0x2a3a5a];
const HATS = [0xc23a22, 0x1d1f1a, 0x24456b, 0xe2a33a, 0x2f4a2a, 0x2a8a6a, 0x7a2a2a];
const col3 = (c) => c instanceof THREE.Color ? c : new THREE.Color(c);

// Mensch: Gelenke werden pro Pose lokal berechnet und in die Welt transformiert
class Human {
  constructor(rand, o = {}) {
    const pick = (a) => a[Math.floor(rand() * a.length)];
    this.kid = !!o.kid;
    this.skin = col3(o.skin ?? pick(SKIN));
    this.top = col3(o.top ?? pick(JACKET));
    this.pants = col3(o.pants ?? pick(PANTS));
    this.shoe = col3(o.shoe ?? pick(SHOES));
    this.hairCol = col3(o.hair ?? pick(this.kid ? HAIR.slice(0, 5) : HAIR));
    this.scale = o.scale ?? (this.kid ? 0.6 + rand() * 0.14 : 0.92 + rand() * 0.14);
    this.girth = o.girth ?? (this.kid ? 0.85 : 0.9 + rand() * 0.25);
    this.hairStyle = o.hairStyle ?? pick(['short', 'short', 'long', 'pony', 'short', 'bald', 'long']);
    this.sex = o.sex ?? (/long|pony/.test(this.hairStyle) ? (rand() < 0.85 ? 'F' : 'M') : (rand() < 0.8 ? 'M' : 'F'));
    this.beard = this.sex === 'M' && rand() < 0.3;
    this.hat = o.hat !== undefined ? o.hat : pick([null, null, null, 'beanie', 'beanie', 'cap', 'tyrol', null]);
    this.hatCol = col3(o.hatCol ?? (this.hat === 'tyrol' ? 0x3a4a32 : pick(HATS)));
    this.pompom = rand() < 0.5;
    this.short = o.shortSleeve ?? rand() < 0.12;
    this.glasses = o.glasses ?? rand() < 0.25;
    this.backpack = o.backpack ?? (!this.kid && rand() < 0.3);
    this.bpCol = col3(pick([0x2a2a2a, 0xc23a22, 0x24456b, 0x3a5a2a, 0xe2a33a]));
    this.glove = o.gloves !== undefined ? col3(o.gloves) : null;
    this.propCols = (o.props || []).map((p) => col3(p.color));
    this.dark = new THREE.Color(0x15110d); this.white = new THREE.Color(0xf0ece4);
    this.w = {}; for (const k of ['pelvis', 'chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'hpL', 'hpR', 'knL', 'knR', 'ftL', 'ftR']) this.w[k] = new THREE.Vector3();
    this.Q = new THREE.Quaternion();
    this.v = Array.from({ length: 16 }, () => new THREE.Vector3());
  }
  // j: lokale Gelenke (Meter, Blick +z). Fehlende Knie/Ellbogen werden per IK ergänzt.
  apply(j, M, lookYaw = 0) {
    const s = this.scale, g = this.girth, w = this.w, v = this.v;
    const T = (src, dst) => dst.copy(src).multiplyScalar(s).applyMatrix4(M);
    this.Q.setFromRotationMatrix(M);
    if (!j.knL) j.knL = ik2(j.hpL, j.ftL, 0.46, 0.45, j.kneePole || V(0.15, 0, 1), new THREE.Vector3());
    if (!j.knR) j.knR = ik2(j.hpR, j.ftR, 0.46, 0.45, j.kneePoleR || j.kneePole || V(-0.15, 0, 1), new THREE.Vector3());
    if (!j.elL) j.elL = ik2(j.shL, j.haL, 0.3, 0.28, j.elbowPole || V(0.6, -0.3, -0.6), new THREE.Vector3());
    if (!j.elR) j.elR = ik2(j.shR, j.haR, 0.3, 0.28, j.elbowPoleR || V(-0.6, -0.3, -0.6), new THREE.Vector3());
    for (const k in w) T(j[k], w[k]);
    const Q = this.Q;
    const fwd = v[0].set(0, 0, 1).applyQuaternion(Q);
    const right = v[1].subVectors(w.shL, w.shR).normalize();
    const upT = v[2].subVectors(w.chest, w.pelvis).normalize();
    let hq = j.headQ ? Q.clone().multiply(j.headQ) : Q.clone();
    if (lookYaw) hq.multiply(new THREE.Quaternion().setFromAxisAngle(_UP, lookYaw));
    const hU = v[3].set(0, 1, 0).applyQuaternion(hq), hF = v[4].set(0, 0, 1).applyQuaternion(hq), hR = v[5].set(1, 0, 0).applyQuaternion(hq);
    const H = w.head, P = (base, f, u, r, out) => out.copy(base).addScaledVector(hF, f * s).addScaledVector(hU, u * s).addScaledVector(hR, r * s);
    const top = this.top, skin = this.skin, pants = this.pants;
    // Becken und Rumpf (Jacke reicht über den Hosenbund)
    cap(v[6].copy(w.hpL).addScaledVector(upT, 0.03 * s), v[7].copy(w.hpR).addScaledVector(upT, 0.03 * s), 0.1 * s * g, 0.1 * s * g, pants);
    const waist = v[8].copy(w.pelvis).lerp(w.chest, 0.5);
    cap(v[6].copy(w.pelvis).addScaledVector(upT, 0.05 * s), waist, 0.122 * s * g, 0.118 * s * g, top, right, 1.3);
    cap(waist, w.chest, 0.118 * s * g, 0.132 * s * g, top, right, 1.32);
    cap(v[6].copy(w.shL).addScaledVector(right, -0.025 * s), v[7].copy(w.shR).addScaledVector(right, 0.025 * s), 0.06 * s * g, 0.06 * s * g, top);
    if (this.backpack) cap(v[6].copy(w.pelvis).lerp(w.chest, 0.35).addScaledVector(fwd, -0.16 * s * g), v[7].copy(w.chest).addScaledVector(fwd, -0.15 * s * g).addScaledVector(upT, -0.03 * s), 0.1 * s, 0.095 * s, this.bpCol, right, 1.4);
    // Hals und Kopf
    cap(v[6].copy(w.chest).addScaledVector(upT, 0.07 * s), P(H, -0.01, -0.07, 0, v[7]), 0.05 * s, 0.045 * s, skin);
    cap(P(H, 0, -0.02, 0, v[6]), P(H, 0, 0.022, 0, v[7]), 0.092 * s, 0.095 * s, skin, hR, 0.84);
    cap(P(H, 0.02, -0.05, 0, v[6]), P(H, 0.045, -0.083, 0, v[7]), 0.058 * s, 0.042 * s, skin, hR, 1.25);
    cap(P(H, 0.082, 0.0, 0, v[6]), P(H, 0.1, -0.03, 0, v[7]), 0.011 * s, 0.016 * s, skin);
    ball(P(H, -0.005, -0.005, 0.083, v[6]), 0.021 * s, skin); ball(P(H, -0.005, -0.005, -0.083, v[6]), 0.021 * s, skin);
    if (this.glasses) cap(P(H, 0.086, 0.018, 0.05, v[6]), P(H, 0.086, 0.018, -0.05, v[7]), 0.02 * s, 0.02 * s, this.dark, hU, 1.0);
    else { ball(P(H, 0.083, 0.018, 0.033, v[6]), 0.011 * s, this.dark); ball(P(H, 0.083, 0.018, -0.033, v[6]), 0.011 * s, this.dark); }
    // Haare und Mütze
    const hc = this.hairCol;
    if (this.hat !== 'helmet' && this.hairStyle !== 'bald') cap(P(H, -0.022, 0.04, 0, v[6]), P(H, -0.03, 0.025, 0, v[7]), 0.098 * s, 0.098 * s, hc, hR, 0.87);
    else if (this.hairStyle === 'bald' && !this.hat) cap(P(H, -0.04, -0.01, 0, v[6]), P(H, -0.035, -0.02, 0, v[7]), 0.094 * s, 0.094 * s, hc, hR, 0.86);
    if (this.hairStyle === 'long' && this.hat !== 'helmet') cap(P(H, -0.045, 0.0, 0, v[6]), P(H, -0.06, -0.19, 0, v[7]), 0.085 * s, 0.06 * s, hc, hR, 1.2);
    if (this.hairStyle === 'pony' && this.hat !== 'helmet') cap(P(H, -0.1, 0.03, 0, v[6]), P(H, -0.14, -0.12, 0, v[7]), 0.032 * s, 0.022 * s, hc);
    this.drawHat(P, H, hR);
    // Arme mit Handgelenk und Hand
    const sleeve = top, fore = this.short ? skin : top, hand = this.glove || skin;
    for (const [sh, el, ha] of [[w.shL, w.elL, w.haL], [w.shR, w.elR, w.haR]]) {
      cap(sh, el, 0.054 * s * g, 0.044 * s, sleeve);
      const d = v[9].subVectors(ha, el).normalize();
      const wrist = v[10].copy(ha).addScaledVector(d, -0.055 * s);
      cap(el, wrist, 0.044 * s, 0.033 * s, fore);
      cap(wrist, v[11].copy(ha).addScaledVector(d, 0.04 * s), 0.031 * s, 0.027 * s, hand, fwd, 1.35);
    }
    // Beine mit Schuhen
    const fq = j.footQ ? Q.clone().multiply(j.footQ) : Q;
    const fF = v[12].set(0, 0, 1).applyQuaternion(fq), fU = v[13].set(0, 1, 0).applyQuaternion(fq), fR = v[14].set(1, 0, 0).applyQuaternion(fq);
    for (const [hp, kn, ft] of [[w.hpL, w.knL, w.ftL], [w.hpR, w.knR, w.ftR]]) {
      cap(hp, kn, 0.084 * s * g, 0.058 * s, pants);
      cap(kn, ft, 0.056 * s, 0.04 * s, pants);
      cap(v[6].copy(ft).addScaledVector(fF, -0.05 * s).addScaledVector(fU, -0.02 * s), v[7].copy(ft).addScaledVector(fF, 0.15 * s).addScaledVector(fU, -0.035 * s), 0.046 * s, 0.04 * s, this.shoe, fR, 1.08);
    }
    this.drawProps(j, M);
  }
  // Mütze, Hut oder Helm; P(base, vor, hoch, seitlich, out) liefert Punkte im Kopfsystem
  drawHat(P, H, hR) {
    const s = this.scale, v = this.v;
    const hat = this.hat, hcol = this.hatCol;
    if (hat === 'beanie') { cap(P(H, -0.012, 0.05, 0, v[6]), P(H, -0.016, 0.07, 0, v[7]), 0.1 * s, 0.094 * s, hcol, hR, 0.89); if (this.pompom) ball(P(H, -0.02, 0.17, 0, v[6]), 0.032 * s, this.white); }
    else if (hat === 'cap') { cap(P(H, -0.012, 0.045, 0, v[6]), P(H, -0.016, 0.06, 0, v[7]), 0.1 * s, 0.095 * s, hcol, hR, 0.88); cap(P(H, 0.09, 0.048, 0, v[6]), P(H, 0.165, 0.04, 0, v[7]), 0.008 * s, 0.008 * s, hcol, hR, 9); }
    else if (hat === 'tyrol') {
      cap(P(H, -0.01, 0.06, 0, v[6]), P(H, -0.01, 0.13, 0, v[7]), 0.088 * s, 0.07 * s, hcol, hR, 0.9);
      cap(P(H, -0.12, 0.065, 0, v[6]), P(H, 0.11, 0.065, 0, v[7]), 0.011 * s, 0.011 * s, hcol, hR, 12);
      cap(P(H, -0.05, 0.12, 0.07, v[6]), P(H, -0.11, 0.24, 0.08, v[7]), 0.007 * s, 0.002 * s, new THREE.Color(0x7a6a52));
    } else if (hat === 'helmet') {
      cap(P(H, -0.005, 0.045, 0, v[6]), P(H, -0.01, 0.07, 0, v[7]), 0.112 * s, 0.106 * s, hcol, hR, 0.92);
      cap(P(H, 0.06, 0.04, 0, v[6]), P(H, 0.12, 0.03, 0, v[7]), 0.01 * s, 0.01 * s, hcol, hR, 9);
      ball(P(H, 0, -0.005, 0.1, v[6]), 0.04 * s, hcol); ball(P(H, 0, -0.005, -0.1, v[6]), 0.04 * s, hcol);
    }
  }
  // Requisiten (Kapseln in lokalen Koordinaten); shift verschiebt Dinge in der Hand an die echte Handposition
  drawProps(j, M, shiftL, shiftR) {
    if (!j.props) return;
    const s = this.scale, v = this.v, Q = this.Q;
    j.props.forEach((pp, k) => {
      const c = pp.col ? col3(pp.col) : this.propCols[k]; if (!c) return;
      const a = v[6].copy(pp.a).multiplyScalar(s).applyMatrix4(M), b = v[7].copy(pp.b || pp.a).multiplyScalar(s).applyMatrix4(M);
      if (shiftL || shiftR) {
        const dl = pp.a.distanceTo(j.haL), dr = pp.a.distanceTo(j.haR);
        const sh = dl < dr ? (dl < 0.35 ? shiftL : null) : (dr < 0.35 ? shiftR : null);
        if (sh) { a.add(sh); b.add(sh); }
      }
      const rt = pp.right ? v[15].copy(pp.right).applyQuaternion(Q) : null;
      cap(a, b, pp.r * s, (pp.r1 ?? pp.r) * s, c, rt, pp.flat || 1);
    });
  }
}
// Standard-Skelett (lokal)
function baseSkel(lean = 0) {
  return {
    pelvis: V(0, 0.98, 0), chest: V(0, 1.36, lean), neck: V(0, 1.5, lean * 1.1), head: V(0, 1.63, 0.02 + lean * 1.2),
    shL: V(0.18, 1.42, lean), shR: V(-0.18, 1.42, lean), hpL: V(0.1, 0.95, 0), hpR: V(-0.1, 0.95, 0),
    haL: V(0.22, 0.86, 0.06), haR: V(-0.22, 0.86, 0.06), ftL: V(0.12, 0.08, 0), ftR: V(-0.12, 0.08, 0),
  };
}
const shiftY = (j, dy) => { for (const k in j) if (j[k] && j[k].isVector3 && !/Pole|fwd/.test(k)) j[k].y += dy; if (j.props) for (const p of j.props) { p.a.y += dy; if (p.b) p.b.y += dy; } return j; };
const E = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const POSES = {
  stand(t, e, ph) {
    const j = baseSkel(0.02), b = Math.sin(t * 0.9 + ph);
    j.haL.set(0.22, 0.86 + b * 0.01, 0.07); j.pelvis.x += b * 0.01;
    if (e > 0.5) { j.haL.set(0.3, 1.9, 0.15); j.elbowPole = V(1, 0, -0.2); }
    return j;
  },
  hips(t, e, ph) {
    const j = baseSkel(0.0); j.haL.set(0.2, 1.0, -0.02); j.haR.set(-0.2, 1.0, -0.02); j.elbowPole = V(1, 0, -0.5); j.elbowPoleR = V(-1, 0, -0.5);
    j.pelvis.x = Math.sin(t * 0.4 + ph) * 0.02;
    if (e > 0.5) { j.haL.set(0.08, 1.2, 0.38); j.haR.set(-0.08, 1.2, 0.38); }
    return j;
  },
  cheer(t, e, ph) {
    const j = baseSkel(0.03), w = Math.sin(t * (6 + e * 5) + ph);
    j.haL.set(0.32 + w * 0.08, 1.88 + e * 0.12, 0.12); j.haR.set(-0.32 - w * 0.08, 1.88 + e * 0.12, 0.12);
    j.elbowPole = V(1, 0, -0.2); j.elbowPoleR = V(-1, 0, -0.2);
    return shiftY(j, e * Math.abs(Math.sin(t * 7 + ph)) * 0.16);
  },
  clap(t, e, ph) {
    const j = baseSkel(0.04), c = Math.sin(t * (8 + e * 4) + ph) * 0.5 + 0.5;
    j.haL.set(0.03 + c * 0.13, 1.25 + e * 0.25, 0.3); j.haR.set(-0.03 - c * 0.13, 1.25 + e * 0.25, 0.3);
    return j;
  },
  phone(t, e, ph) {
    const j = baseSkel(0.03);
    j.haR.set(-0.05, 1.52, 0.34); j.haL.set(0.22, 0.88, 0.04); j.elbowPoleR = V(-1, -0.3, -0.6);
    j.headQ = E(0.1, Math.sin(t * 0.7 + ph) * 0.1, 0);
    j.props = [{ a: V(-0.04, 1.49, 0.37), b: V(-0.04, 1.62, 0.36), r: 0.007, right: V(1, 0, 0), flat: 5 }];
    return j;
  },
  film(t, e, ph) {
    const j = baseSkel(0.04);
    j.haL.set(0.07, 1.47, 0.36); j.haR.set(-0.07, 1.47, 0.36); j.elbowPole = V(1, -0.5, -0.3); j.elbowPoleR = V(-1, -0.5, -0.3);
    j.props = [{ a: V(0.06, 1.5, 0.38), b: V(-0.06, 1.5, 0.38), r: 0.007, right: V(0, 1, 0), flat: 5 }];
    return j;
  },
  cowbell(t, e, ph) {
    const j = baseSkel(0.04), sw = Math.sin(t * (5 + e * 6) + ph);
    j.haR.set(-0.3, 1.2 + sw * 0.2, 0.25 + Math.cos(t * (5 + e * 6) + ph) * 0.15);
    j.haL.set(0.3, 1.86, 0.1); j.elbowPole = V(1, 0, -0.3);
    j.props = [{ a: j.haR.clone().add(V(0, -0.05, 0)), b: j.haR.clone().add(V(0, -0.19, 0.02)), r: 0.04, r1: 0.075, right: V(1, 0, 0), flat: 1.2 }];
    return shiftY(j, e * Math.abs(Math.sin(t * 6 + ph)) * 0.08);
  },
  flag(t, e, ph) {
    const j = baseSkel(0.03), sw = Math.sin(t * (1.5 + e * 3) + ph);
    j.haR.set(-0.22 - sw * 0.06, 1.5 + e * 0.15, 0.12); j.haL.set(-0.12, 1.15, 0.16); j.elbowPoleR = V(-1, -0.2, -0.3);
    const top = V(-0.26 - sw * 0.25, 2.75 + e * 0.15, 0.12);
    const wave = Math.sin(t * 6 + ph) * 0.12;
    j.props = [
      { a: j.haR.clone().add(V(0, -0.35, 0)), b: top, r: 0.013, col: 0x8a8a8a },
      { a: top.clone().add(V(0, -0.27, 0)), b: top.clone().add(V(0.6, -0.3 + wave, wave * 0.5)), r: 0.012, right: V(0, 1, 0), flat: 21 },
    ];
    return j;
  },
  drink(t, e, ph) {
    const j = baseSkel(0.02), c = Math.max(0, Math.sin(t * 0.6 + ph)) ** 3;
    j.haL.set(0.22, 0.88, 0.05);
    j.haR.set(lerp(-0.2, -0.05, c), lerp(1.08, 1.6, c), lerp(0.22, 0.14, c)); j.elbowPoleR = V(-1, -0.4, -0.3);
    j.headQ = E(-c * 0.35, 0, 0);
    const up = V(0, 1, 0).applyAxisAngle(V(1, 0, 0), -c * 1.6);
    j.props = [{ a: j.haR.clone().addScaledVector(up, -0.06), b: j.haR.clone().addScaledVector(up, 0.12), r: 0.032, r1: 0.014 }];
    if (e > 0.5) { j.haR.set(-0.28, 1.85, 0.12); j.props[0].a = j.haR.clone().add(V(0, -0.06, 0)); j.props[0].b = j.haR.clone().add(V(0, 0.12, 0)); j.elbowPoleR = V(-1, 0, -0.2); }
    return j;
  },
  sit(t, e, ph) {
    const lift = e * 0.5;
    const j = {
      pelvis: V(0, 0.16, -0.05), chest: V(0, 0.53, 0.04), neck: V(0, 0.66, 0.06), head: V(0, 0.79, 0.1),
      shL: V(0.18, 0.59, 0.04), shR: V(-0.18, 0.59, 0.04), hpL: V(0.1, 0.14, -0.04), hpR: V(-0.1, 0.14, -0.04),
      knL: V(0.14, 0.46, 0.32), knR: V(-0.14, 0.46, 0.32), ftL: V(0.14, 0.08, 0.52), ftR: V(-0.14, 0.08, 0.52),
      haL: V(0.13, 0.44 + lift * 1.5, 0.3 - lift * 0.2), haR: V(-0.13, 0.44 + lift * 1.5, 0.3 - lift * 0.2),
      elbowPole: V(1, -0.2, 0), elbowPoleR: V(-1, -0.2, 0),
    };
    if (lift) { j.haL.x = 0.3; j.haR.x = -0.3; }
    return j;
  },
  photographer(t, e, ph) {
    return {
      pelvis: V(0, 0.52, -0.05), chest: V(0, 0.9, 0.12), neck: V(0, 1.02, 0.16), head: V(0, 1.13, 0.2),
      shL: V(0.18, 0.97, 0.12), shR: V(-0.18, 0.97, 0.12), hpL: V(0.1, 0.5, -0.05), hpR: V(-0.1, 0.5, -0.05),
      knL: V(0.12, 0.5, 0.4), ftL: V(0.12, 0.08, 0.42), knR: V(-0.12, 0.08, 0.02), ftR: V(-0.12, 0.1, -0.4), footQ: null,
      haL: V(0.07, 1.1, 0.36), haR: V(-0.08, 1.12, 0.33),
      props: [{ a: V(-0.065, 1.13, 0.36), b: V(0.065, 1.13, 0.36), r: 0.045, right: V(0, 1, 0), flat: 1.15 }, { a: V(0, 1.12, 0.4), b: V(0, 1.11, 0.55), r: 0.04, r1: 0.042 }],
    };
  },
  handstand(t, e, ph) {
    const sw = Math.sin(t * 2.1 + ph) * 0.05;
    return {
      pelvis: V(sw, 1.12, 0), chest: V(sw * 0.4, 0.72, 0), neck: V(0, 0.56, 0.02), head: V(0, 0.42, 0.05), headQ: E(Math.PI, 0, 0),
      shL: V(0.19, 0.66, 0), shR: V(-0.19, 0.66, 0), haL: V(0.22, 0.05, 0.02), haR: V(-0.22, 0.05, 0.02),
      elL: V(0.22, 0.36, 0.02), elR: V(-0.22, 0.36, 0.02),
      hpL: V(0.1 + sw, 1.15, 0), hpR: V(-0.1 + sw, 1.15, 0),
      knL: V(0.2 + sw * 1.5, 1.57, 0.05), ftL: V(0.32 + sw * 2, 2.0, 0.0), knR: V(-0.16 + sw * 1.5, 1.58, -0.1), ftR: V(-0.2 + sw * 2, 1.98, -0.3),
      footQ: E(-Math.PI / 2, 0, 0),
    };
  },
  superman(t, e, ph) {
    const b = Math.sin(t * 1.5 + ph) * 0.03;
    return {
      pelvis: V(0, 0.16, 0), chest: V(0, 0.22 + b, 0.42), neck: V(0, 0.28 + b, 0.56), head: V(0, 0.34 + b, 0.68), headQ: E(-1.1, 0, 0),
      shL: V(0.18, 0.24 + b, 0.48), shR: V(-0.18, 0.24 + b, 0.48), haL: V(0.22, 0.42 + b * 2, 1.08), haR: V(-0.3, 0.38 + b * 2, 1.03),
      elbowPole: V(1, 0, 0), elbowPoleR: V(-1, 0, 0),
      hpL: V(0.1, 0.16, -0.04), hpR: V(-0.1, 0.16, -0.04), knL: V(0.12, 0.22, -0.5), knR: V(-0.12, 0.22, -0.5), ftL: V(0.14, 0.4 + b, -0.9), ftR: V(-0.14, 0.4 + b, -0.9),
      footQ: E(Math.PI / 2, 0, 0),
    };
  },
  yoga(t, e, ph) {
    const j = baseSkel(0); const sw = Math.sin(t * 1.7 + ph) * 0.02;
    j.ftR.set(-0.04, 0.55, 0.04); j.knR = V(-0.4, 0.62, 0.06);
    j.haL.set(0.03 + sw, 2.02, 0.05); j.haR.set(-0.03 + sw, 2.02, 0.05); j.elbowPole = V(1, 0, 0); j.elbowPoleR = V(-1, 0, 0);
    j.ftL.set(0.04, 0.08, 0); j.footQ = null;
    return j;
  },
  dab(t, e, ph) {
    const j = baseSkel(0.05), k = Math.sin(t * 3 + ph) > 0 ? 1 : -1;
    if (k > 0) { j.haL.set(0.62, 1.82, 0.12); j.haR.set(0.08, 1.6, 0.3); j.elbowPoleR = V(-0.3, 0.6, -0.6); }
    else { j.haR.set(-0.62, 1.82, 0.12); j.haL.set(-0.08, 1.6, 0.3); j.elbowPole = V(0.3, 0.6, -0.6); }
    j.head.set(0.05 * k, 1.58, 0.1); j.headQ = E(0.45, 0, 0.15 * k);
    return j;
  },
  lyingBack(t, e, ph) {
    return {
      pelvis: V(0, 0.14, 0), chest: V(0, 0.2, 0.45), neck: V(0, 0.24, 0.58), head: V(0, 0.28, 0.7), headQ: E(-1.2, 0, 0),
      shL: V(0.18, 0.2, 0.5), shR: V(-0.18, 0.2, 0.5), haL: V(0.08, 0.36, 0.8), haR: V(-0.08, 0.36, 0.8), elL: V(0.32, 0.3, 0.66), elR: V(-0.32, 0.3, 0.66),
      hpL: V(0.1, 0.14, -0.04), hpR: V(-0.1, 0.14, -0.04), knL: V(0.12, 0.45, -0.35), ftL: V(0.12, 0.08, -0.72), knR: V(-0.05, 0.22, -0.5), ftR: V(0.06 + Math.sin(t + ph) * 0.05, 0.5, -0.8),
    };
  },
  carryBase(t, e, ph) { const j = baseSkel(0.02); j.haL.set(0.17, 1.5, 0.12); j.haR.set(-0.17, 1.5, 0.12); j.elbowPole = V(1, 0, 0); j.elbowPoleR = V(-1, 0, 0); return j; },
  carryTop(t, e, ph) {
    const w = Math.sin(t * 6 + ph) * 0.1;
    return {
      pelvis: V(0, 1.6, -0.04), chest: V(0, 1.98, -0.02), neck: V(0, 2.1, 0), head: V(0, 2.23, 0.02),
      shL: V(0.18, 2.04, -0.02), shR: V(-0.18, 2.04, -0.02), haL: V(0.36 + w, 2.52, 0.1), haR: V(-0.36 - w, 2.52, 0.1), elbowPole: V(1, 0, 0), elbowPoleR: V(-1, 0, 0),
      hpL: V(0.11, 1.6, 0.0), hpR: V(-0.11, 1.6, 0.0), knL: V(0.19, 1.56, 0.3), ftL: V(0.17, 1.2, 0.24), knR: V(-0.19, 1.56, 0.3), ftR: V(-0.17, 1.2, 0.24),
    };
  },
  sawing(t, e, ph) {
    const jit = Math.sin(t * 90) * 0.006;
    return {
      pelvis: V(0, 0.68, -0.1), chest: V(0, 1.02, 0.18), neck: V(0, 1.12, 0.26), head: V(0, 1.22, 0.33), headQ: E(0.5, 0, 0),
      shL: V(0.18, 1.06, 0.18), shR: V(-0.18, 1.06, 0.18), haL: V(0.12 + jit, 0.6, 0.5), haR: V(-0.08 + jit, 0.58, 0.42),
      hpL: V(0.1, 0.66, -0.1), hpR: V(-0.1, 0.66, -0.1), ftL: V(0.2, 0.08, 0.25), ftR: V(-0.18, 0.08, -0.2), kneePole: V(0.3, 0, 1),
      props: [{ a: V(0.02 + jit, 0.56, 0.4), b: V(0.02 + jit, 0.56, 0.66), r: 0.085, right: V(1, 0, 0), flat: 0.8 }, { a: V(0.02 + jit, 0.52, 0.7), b: V(0.02 + jit, 0.5, 1.25), r: 0.012, right: V(0, 1, 0), flat: 3 }],
    };
  },
  radio(t, e, ph) {
    const j = baseSkel(0.02);
    j.haL.set(0.1, 1.58, 0.07); j.elbowPole = V(1, 0, -0.2);
    j.haR.set(-0.42, 1.42, 0.42 + Math.sin(t * 0.8) * 0.05);
    j.props = [{ a: V(0.1, 1.56, 0.09), b: V(0.1, 1.7, 0.09), r: 0.022, right: V(1, 0, 0), flat: 1.3 }];
    return j;
  },
  pilot(t, e, ph) {
    const b = Math.sin(t * 1.3 + ph) * 0.05;
    return {
      pelvis: V(0, 0, 0), chest: V(0, 0.42, -0.06), neck: V(0, 0.54, -0.04), head: V(0, 0.67, 0),
      shL: V(0.19, 0.48, -0.05), shR: V(-0.19, 0.48, -0.05), haL: V(0.3, 0.85 + b, 0.02), haR: V(-0.3, 0.85 - b, 0.02), elbowPole: V(1, -0.5, 0), elbowPoleR: V(-1, -0.5, 0),
      hpL: V(0.1, -0.02, 0.02), hpR: V(-0.1, -0.02, 0.02), knL: V(0.12, 0.02, 0.45), ftL: V(0.12, -0.32, 0.6), knR: V(-0.12, 0.02, 0.45), ftR: V(-0.12, -0.32, 0.6),
      props: [{ a: V(0, -0.1, -0.25), b: V(0, -0.1, 0.38), r: 0.15, r1: 0.12, right: V(1, 0, 0), flat: 1.6 }, { a: V(0, 0.15, -0.28), b: V(0, 0.45, -0.25), r: 0.13, right: V(1, 0, 0), flat: 1.5 }],
    };
  },
};
const POSE_PROPS = {
  phone: [{ color: 0x111111 }], film: [{ color: 0x111111 }],
  cowbell: [{ color: 0xc9a43a }],
  flag: [{ color: 0x8a8a8a }, { color: 0xffffff }],
  drink: [{ color: 0x6a4214 }],
  photographer: [{ color: 0x151515 }, { color: 0x222222 }],
  sawing: [{ color: 0xe86a12 }, { color: 0x9a9a9a }],
  radio: [{ color: 0x222222 }],
  pilot: [{ color: 0x2a2a2a }, { color: 0x3a3a3a }],
};
const FLAG_COLS = [0x2a7ad8, 0xffffff, 0xe8462b, 0xf2c94c, 0x2fa36b, 0x1d1f1a];

// ------------------------------------------------------------------
// Tiere: Gämse, Kühe, Murmeltiere, Vögel
// ------------------------------------------------------------------
const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
class Quad {
  constructor(kind, rand) {
    this.kind = kind;
    const cow = kind === 'cow';
    this.c = cow
      ? { body: srgb(0.36 + rand() * 0.08, 0.28 + rand() * 0.05, 0.21), light: srgb(0.8, 0.74, 0.64), horn: srgb(0.85, 0.8, 0.65), hoof: srgb(0.1, 0.1, 0.1), nose: srgb(0.15, 0.13, 0.12), bell: srgb(0.8, 0.62, 0.2) }
      : { body: srgb(0.19, 0.12, 0.075), light: srgb(0.8, 0.74, 0.62), horn: srgb(0.06, 0.05, 0.05), hoof: srgb(0.08, 0.07, 0.06), nose: srgb(0.06, 0.05, 0.05), belly: srgb(0.28, 0.2, 0.13) };
    this.s = cow ? 1.55 : 1;
    this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion();
  }
  // gait: Phase 0..1, run: 0 steht, 1 rennt; tuck: Beine angezogen (Sprung); headDown: 0..1
  pose(pos, yaw, pitch, gait, run, tuck, headDown, headTurn) {
    const s = this.s, cow = this.kind === 'cow', c = this.c;
    this.Q.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    this.M.compose(pos, this.Q, _ps.set(s, s, s));
    const W = (x, y, z) => V(x, y, z).applyMatrix4(this.M);
    const right = V(1, 0, 0).applyQuaternion(this.Q);
    const bh = cow ? 0.7 : 0.7;
    // Rumpf
    if (cow) {
      cap(W(0, bh + 0.02, -0.34), W(0, bh + 0.02, 0.3), 0.29 * s, 0.31 * s, c.body, right, 0.86);
      ball(W(0, bh - 0.27, -0.22), 0.11 * s, srgb(0.86, 0.62, 0.56));
    } else {
      cap(W(0, bh, -0.26), W(0, bh + 0.03, 0.22), 0.16 * s, 0.18 * s, c.body, right, 0.82);
      cap(W(0, bh - 0.08, -0.12), W(0, bh - 0.06, 0.16), 0.11 * s, 0.11 * s, c.belly, right, 0.9);
    }
    const hd = headDown, ht = headTurn || 0;
    const headL = V(Math.sin(ht) * 0.15, bh + 0.42 - hd * 0.75, 0.58 + hd * 0.05);
    if (cow) { headL.y = bh + 0.2 - hd * 0.62; headL.z = 0.7 + hd * 0.1; }
    const hw = headL.clone().applyMatrix4(this.M);
    cap(W(0, bh + (cow ? 0.08 : 0.1), cow ? 0.32 : 0.26), hw, (cow ? 0.2 : 0.085) * s, (cow ? 0.13 : 0.06) * s, c.body, right, cow ? 0.75 : 0.85);
    const hq = this.Q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6 + hd * 0.9, ht, 0)));
    const hp = (x, y, z) => hw.clone().add(V(x, y, z).multiplyScalar(s).applyQuaternion(hq));
    const hR = V(1, 0, 0).applyQuaternion(hq);
    if (cow) {
      cap(hp(0, 0.04, -0.06), hp(0, -0.02, 0.2), 0.11 * s, 0.085 * s, c.body, hR, 0.9);
      ball(hp(0, -0.03, 0.24), 0.085 * s, c.light); ball(hp(0, -0.02, 0.3), 0.05 * s, c.nose);
      cap(hp(0.06, 0.08, -0.06), hp(0.17, 0.14, -0.03), 0.02 * s, 0.014 * s, c.horn); cap(hp(-0.06, 0.08, -0.06), hp(-0.17, 0.14, -0.03), 0.02 * s, 0.014 * s, c.horn);
      cap(hp(0.17, 0.14, -0.03), hp(0.18, 0.21, 0.01), 0.014 * s, 0.008 * s, c.horn); cap(hp(-0.17, 0.14, -0.03), hp(-0.18, 0.21, 0.01), 0.014 * s, 0.008 * s, c.horn);
      cap(hp(0.09, 0.03, -0.06), hp(0.2, 0.0, -0.08), 0.035 * s, 0.03 * s, c.body, V(0, 1, 0), 0.5); cap(hp(-0.09, 0.03, -0.06), hp(-0.2, 0.0, -0.08), 0.035 * s, 0.03 * s, c.body, V(0, 1, 0), 0.5);
      // Glocke am Lederband
      const nk = W(0, bh - 0.05, 0.52);
      cap(W(0.14, bh + 0.08, 0.5), W(-0.14, bh + 0.08, 0.5), 0.03 * s, 0.03 * s, srgb(0.2, 0.12, 0.07));
      cap(nk, W(0, bh - 0.2, 0.55), 0.05 * s, 0.08 * s, c.bell, right, 1.1);
    } else {
      cap(hp(0, 0.02, -0.04), hp(0, -0.01, 0.11), 0.06 * s, 0.035 * s, c.light, hR, 0.85);
      // dunkle Gesichtsstreifen der Gämse
      for (const sd of [1, -1]) cap(hp(sd * 0.035, 0.035, -0.04), hp(sd * 0.025, -0.0, 0.09), 0.016 * s, 0.012 * s, c.horn);
      ball(hp(0, -0.01, 0.125), 0.02 * s, c.nose);
      for (const sd of [1, -1]) {
        cap(hp(sd * 0.025, 0.06, -0.02), hp(sd * 0.03, 0.16, -0.02), 0.011 * s, 0.009 * s, c.horn);
        cap(hp(sd * 0.03, 0.16, -0.02), hp(sd * 0.03, 0.165, -0.07), 0.009 * s, 0.005 * s, c.horn);
        cap(hp(sd * 0.045, 0.05, -0.05), hp(sd * 0.095, 0.085, -0.07), 0.016 * s, 0.01 * s, c.body, V(0, 0, 1), 0.5);
      }
    }
    cap(W(0, bh + 0.06, cow ? -0.6 : -0.42), W(0, bh - (cow ? 0.5 : 0.04), cow ? -0.66 : -0.5), (cow ? 0.025 : 0.03) * s, (cow ? 0.02 : 0.02) * s, c.body);
    if (cow) ball(W(0, bh - 0.55, -0.66), 0.045 * s, srgb(0.15, 0.12, 0.1));
    // Beine: 0 vorne links, 1 vorne rechts, 2 hinten links, 3 hinten rechts (Galopp/Sprung: Paare gemeinsam)
    const legLen = bh - 0.02;
    [[0.09, 0.26, 0], [-0.09, 0.26, 0.08], [0.09, -0.24, 0.5], [-0.09, -0.24, 0.58]].forEach(([x, z, off], k) => {
      const front = k < 2;
      const phs = (gait + (run > 0.5 ? (front ? 0 : 0.5) : off)) * Math.PI * 2;
      const swing = Math.sin(phs) * (0.12 + run * 0.18), lift = Math.max(0, Math.cos(phs)) * (0.05 + run * 0.12);
      const xx = x * (cow ? 1.7 : 1), zz = z * (cow ? 1.45 : 1);
      const top = W(xx, bh - 0.02, zz);
      let footL = V(xx, 0.04 + lift, zz + swing);
      if (tuck > 0) footL = footL.lerp(V(xx, bh * 0.45, zz + (front ? -0.05 : 0.12)), tuck);
      const foot = footL.applyMatrix4(this.M);
      const pole = V(0, 0, front ? -1 : 1).applyQuaternion(this.Q);
      const knee = ik2(top, foot, legLen * 0.52 * s, legLen * 0.52 * s, pole, new THREE.Vector3());
      cap(top, knee, (cow ? 0.1 : 0.05) * s, (cow ? 0.055 : 0.028) * s, c.body, V(0, 0, 1).applyQuaternion(this.Q), front ? 0.8 : 0.7);
      cap(knee, foot, (cow ? 0.05 : 0.026) * s, (cow ? 0.042 : 0.02) * s, cow ? c.body : c.body);
      cap(foot, foot.clone().add(V(0, -0.025 * s, 0.035 * s).applyQuaternion(this.Q)), (cow ? 0.05 : 0.023) * s, (cow ? 0.045 : 0.02) * s, c.hoof);
    });
  }
}
// Murmeltier: steht als „Männchen" am Bau oder flitzt auf allen Vieren hinein
const MARMOT = { fur: srgb(0.42, 0.33, 0.23), back: srgb(0.3, 0.23, 0.16), face: srgb(0.6, 0.52, 0.4), dark: srgb(0.08, 0.06, 0.05), tail: srgb(0.18, 0.13, 0.09) };
function drawMarmot(pos, yaw, up, gait, look) {
  const S = 1.35, capS = (a, b, r0, r1, c, rt, fl) => cap(a, b, r0 * S, r1 * S, c, rt, fl), ballS = (p, r, c) => ball(p, r * S, c);
  const Q = new THREE.Quaternion().setFromAxisAngle(_UP, yaw);
  const W = (x, y, z) => V(x * S, y * S, z * S).applyQuaternion(Q).add(pos);
  const right = V(1, 0, 0).applyQuaternion(Q), c = MARMOT;
  if (up > 0.5) {
    // aufrecht
    const b = Math.sin(look * 3) * 0.01;
    capS(W(0, 0.1, -0.02), W(0, 0.3, 0.02), 0.115, 0.085, c.fur, right, 1.05);
    capS(W(0, 0.14, -0.06), W(0, 0.28, -0.04), 0.09, 0.07, c.back, right, 1.1);
    const hq = Q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.sin(look) * 0.9, 0)));
    const H = W(0, 0.38 + b, 0.03), hp = (x, y, z) => V(x * S, y * S, z * S).applyQuaternion(hq).add(H);
    capS(hp(0, 0, -0.02), hp(0, -0.005, 0.04), 0.058, 0.05, c.fur, V(1, 0, 0).applyQuaternion(hq), 1.1);
    ballS(hp(0, -0.015, 0.07), 0.032, c.face); ballS(hp(0, -0.005, 0.098), 0.012, c.dark);
    ballS(hp(0.028, 0.012, 0.06), 0.009, c.dark); ballS(hp(-0.028, 0.012, 0.06), 0.009, c.dark);
    ballS(hp(0.045, 0.035, -0.01), 0.015, c.back); ballS(hp(-0.045, 0.035, -0.01), 0.015, c.back);
    for (const sd of [1, -1]) {
      capS(W(sd * 0.06, 0.27, 0.05), W(sd * 0.035, 0.22, 0.11), 0.022, 0.017, c.fur);
      capS(W(sd * 0.06, 0.04, 0.02), W(sd * 0.06, 0.015, 0.09), 0.03, 0.022, c.back);
    }
    capS(W(0, 0.05, -0.1), W(0, 0.03, -0.28), 0.035, 0.03, c.tail);
  } else {
    // flach laufend
    const ph = gait * Math.PI * 2, bob = Math.abs(Math.sin(ph)) * 0.03;
    capS(W(0, 0.12 + bob, -0.15), W(0, 0.14 + bob, 0.12), 0.1, 0.085, c.fur, right, 1.15);
    const H = W(0, 0.15 + bob, 0.22);
    capS(H, W(0, 0.14 + bob, 0.28), 0.055, 0.045, c.fur, right, 1.1); ballS(W(0, 0.13 + bob, 0.31), 0.03, c.face);
    for (const [x, z, o] of [[0.06, 0.1, 0], [-0.06, 0.1, 0.5], [0.06, -0.12, 0.5], [-0.06, -0.12, 0]]) {
      const sw = Math.sin(ph + o * Math.PI) * 0.06;
      capS(W(x, 0.1 + bob, z), W(x, 0.02, z + sw), 0.03, 0.022, c.back);
    }
    capS(W(0, 0.13 + bob, -0.24), W(0, 0.1 + bob, -0.42), 0.033, 0.028, c.tail);
  }
}
// Vogel: Körper, zweigliedrige Flügel, Schwanzfächer. kind: 'chough' (Alpendohle) oder 'eagle'
const BIRD_COL = { chough: { body: srgb(0.05, 0.05, 0.055), beak: srgb(0.95, 0.78, 0.15), leg: srgb(0.85, 0.2, 0.12), s: 1 }, eagle: { body: srgb(0.25, 0.17, 0.1), beak: srgb(0.85, 0.72, 0.3), leg: srgb(0.85, 0.72, 0.3), head: srgb(0.55, 0.42, 0.22), s: 2.4 } };
function drawBird(kind, p, yaw, pitch, roll, flap, ground, peck = 0) {
  const c = BIRD_COL[kind], s = c.s;
  const Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
  const W = (x, y, z) => V(x * s, y * s, z * s).applyQuaternion(Q).add(p);
  const F = V(0, 0, 1).applyQuaternion(Q), U = V(0, 1, 0).applyQuaternion(Q);
  cap(W(0, 0, -0.1), W(0, 0.01, 0.08), 0.045 * s, 0.05 * s, c.body, V(1, 0, 0).applyQuaternion(Q), 0.95);
  const hy = ground ? 0.06 - peck * 0.08 : 0.02, hz = ground ? 0.13 + peck * 0.03 : 0.15;
  ball(W(0, hy, hz), 0.036 * s, c.head || c.body);
  cap(W(0, hy - 0.005, hz + 0.03), W(0, hy - 0.015 - peck * 0.01, hz + 0.07), 0.011 * s, 0.003 * s, c.beak);
  cap(W(0, 0.0, -0.12), W(0, ground ? 0.02 : -0.01, -0.24), 0.012 * s, 0.012 * s, c.body, V(1, 0, 0).applyQuaternion(Q), ground ? 3 : 4.5);
  if (ground) {
    // angelegte Flügel und Beine
    for (const sd of [1, -1]) cap(W(sd * 0.04, 0.02, 0.05), W(sd * 0.035, 0.03, -0.17), 0.012 * s, 0.01 * s, c.body, U, 3);
    for (const sd of [1, -1]) cap(W(sd * 0.02, -0.035, 0.0), W(sd * 0.025, -0.1, 0.01), 0.006 * s, 0.005 * s, c.leg);
    return;
  }
  for (const sd of [1, -1]) {
    const a1 = flap * 0.9, a2 = flap * 1.3;
    const sh = W(sd * 0.03, 0.02, 0.02);
    const el = sh.clone().add(V(sd * Math.cos(a1) * 0.2, Math.sin(a1) * 0.2, -0.02).multiplyScalar(s).applyQuaternion(Q));
    const tip = el.clone().add(V(sd * Math.cos(a2) * 0.22, Math.sin(a2) * 0.22, -0.06).multiplyScalar(s).applyQuaternion(Q));
    cap(sh, el, 0.012 * s, 0.01 * s, c.body, F, 6.5);
    cap(el, tip, 0.01 * s, 0.006 * s, c.body, F, 7.5);
  }
}

// ------------------------------------------------------------------
// Leben am Berg: Zuschauer, Holzarbeiter, Tiere, Gleitschirme, Dohlen
// ------------------------------------------------------------------
const life = { people: [], cows: [], chamois: [], events: [], gliders: [], birds: [], flocks: [], marmots: [], flashes: [], workers: null, sounds: [] };
function spotOff(s, lat) { const pt = trailPoint(s, lat, {}); return { x: pt.x, z: pt.z, y: hAt(pt.x, pt.z), yaw: pt.yaw }; }
function addPerson(rand, pose, x, z, yaw, opts = {}) {
  let props = POSE_PROPS[pose] || [];
  if (pose === 'flag') props = [props[0], { color: FLAG_COLS[Math.floor(rand() * FLAG_COLS.length)] }];
  const h = new Human(rand, { ...opts, props });
  const p = { h, pose, x, z, y: opts.y ?? hAt(x, z), yaw, ph: rand() * 6.28, e: 0, react: opts.react ?? true, base: opts.base, look: opts.look ?? true };
  life.people.push(p); return p;
}
function facingTrail(s, lat) { const pt = trailPoint(s, lat, {}); return pt.yaw + (lat > 0 ? -Math.PI / 2 : Math.PI / 2); }
function crowd(rand, s, n, poses, spread = 24, sideBias = 0) {
  for (let i = 0; i < n; i++) {
    const side = sideBias || (rand() < 0.5 ? -1 : 1);
    const lat = side * (TRAIL_HALF + 2.2 + rand() * 3.5), ss = s + (rand() - 0.5) * spread;
    const pt = trailPoint(ss, lat, {});
    if (trailDistAt(pt.x, pt.z) < TRAIL_HALF + 1.6 || scDistAt(pt.x, pt.z) < SC_HALF + 1.5) continue;
    const pose = poses[Math.floor(rand() * poses.length)];
    addPerson(rand, pose, pt.x, pt.z, facingTrail(ss, lat) + (rand() - 0.5) * 0.5, { kid: rand() < 0.12 && pose !== 'drink' });
    reservedSpots.push([pt.x, pt.z, 3]);
  }
}
function photoGroup(rand, s, side) {
  // Fotograf auf der einen Seite, verrückte Posen auf der Wiese dahinter
  const lat = side * (TRAIL_HALF + 4);
  const c = spotOff(s, lat);
  reservedSpots.push([c.x, c.z, 14]);
  const face = facingTrail(s, lat);
  const fx = Math.sin(face), fz = Math.cos(face), rx = Math.cos(face), rz = -Math.sin(face);
  const at = (f, r) => [c.x + fx * f + rx * r, c.z + fz * f + rz * r];
  const ph = addPerson(rand, 'photographer', ...at(-7, 0), face + Math.PI, { react: false });
  ph.flash = true;
  const p1 = at(-1.5, -2.5); addPerson(rand, 'handstand', p1[0], p1[1], face, { react: false });
  const p2 = at(-1.2, 0.2); const base = addPerson(rand, 'carryBase', p2[0], p2[1], face, { react: false });
  addPerson(rand, 'carryTop', p2[0], p2[1], face, { react: false, y: base.y });
  const p3 = at(-2.5, 2.6); addPerson(rand, 'superman', p3[0], p3[1], face + 0.3, { react: false });
  return ph;
}
function buildLife(rand) {
  const grp = new THREE.Group();
  grp.add(buildPuppetSystem());
  // Start und Ziel
  crowd(rand, 30, 9, ['cheer', 'cowbell', 'phone', 'clap', 'cheer']);
  crowd(rand, trail.L - 30, 16, ['cheer', 'cheer', 'clap', 'cowbell', 'phone', 'dab'], 40);
  crowd(rand, trail.L - 90, 8, ['cheer', 'clap', 'phone', 'cowbell'], 30);
  // Sprünge
  for (const k of trail.kickers) { crowd(rand, k + 10, 8, ['cheer', 'clap', 'phone', 'cowbell', 'dab'], 16); const side = rand() < 0.5 ? -1 : 1; const pt = trailPoint(k + 14, side * (TRAIL_HALF + 2.5), {}); const p = addPerson(rand, 'photographer', pt.x, pt.z, facingTrail(k + 14, side * 3) - side * 0.7, { react: false }); p.flash = true; }
  // Zuschauer entlang der ganzen Strecke, mal einzeln, mal in Gruppen
  const LINE_POSES = ['cheer', 'clap', 'phone', 'film', 'cowbell', 'stand', 'hips', 'flag', 'drink', 'sit', 'cheer', 'clap', 'flag'];
  for (let s = 70; s < trail.L - 120;) {
    crowd(rand, s, 1 + Math.floor(rand() * rand() * 8), LINE_POSES, 10, rand() < 0.5 ? -1 : 1);
    if (rand() < 0.3) crowd(rand, s + 5, 1 + Math.floor(rand() * 3), LINE_POSES, 8);
    s += 26 + rand() * 36;
  }
  // Foto-Gruppen mit komischen Posen
  photoGroup(rand, trail.L * 0.3, 1);
  const g2 = spotOff(trail.L * 0.78, -(TRAIL_HALF + 5));
  reservedSpots.push([g2.x, g2.z, 10]);
  { const f = facingTrail(trail.L * 0.78, -5); addPerson(rand, 'yoga', g2.x, g2.z, f); const q = spotOff(trail.L * 0.78 + 3, -(TRAIL_HALF + 6)); addPerson(rand, 'dab', q.x, q.z, f); const r2 = spotOff(trail.L * 0.78 - 4, -(TRAIL_HALF + 7.5)); addPerson(rand, 'lyingBack', r2.x, r2.z, f + 1.2, { react: false }); const pp = spotOff(trail.L * 0.78 - 2, TRAIL_HALF + 3); const ph = addPerson(rand, 'photographer', pp.x, pp.z, facingTrail(trail.L * 0.78, 4), { react: false }); ph.flash = true; }
  // Abkürzungen: Einheimische, die die Linie kennen
  for (const sc of shortcuts) {
    const e = sc.n - 6, side = 1;
    for (let i = 0; i < 3; i++) { const off = SC_HALF + 1.8 + i * 1.3; const x = sc.X[e] + Math.cos(sc.YAW[e]) * off * side, z = sc.Z[e] - Math.sin(sc.YAW[e]) * off * side; addPerson(rand, ['cheer', 'cowbell', 'clap'][i], x, z, sc.YAW[e] - Math.PI / 2); reservedSpots.push([x, z, 2]); }
  }
  // Holzarbeiter mit Baum, der gleich fällt
  buildWorkers(rand, grp);
  // Kühe auf den Almen
  for (const s of [420, 1180, 1900]) {
    if (s > trail.L - 50) continue;
    for (let i = 0; i < 4; i++) {
      for (let tries = 0; tries < 80; tries++) {
        const side = rand() < 0.5 ? -1 : 1, pt = spotOff(s + (rand() - 0.5) * 120, side * (14 + rand() * 50));
        const ny = normalAt(pt.x, pt.z, new THREE.Vector3()).y;
        if (ny < 0.82 || forestAt(pt.x, pt.z, pt.y, ny) > 0.45 || trailDistAt(pt.x, pt.z) < 10) continue;
        const q = new Quad('cow', rand);
        life.cows.push({ q, x: pt.x, z: pt.z, yaw: rand() * 6.28, ph: rand() * 50, walkT: 0 });
        reservedSpots.push([pt.x, pt.z, 3]);
        addObstacle(pt.x, pt.z, 1.0);
        break;
      }
    }
  }
  // Gämsen: springen bei Annäherung über die Strecke
  for (const f of [0.2, 0.6]) {
    const s = trail.L * f, side = rand() < 0.5 ? -1 : 1;
    const a = spotOff(s, side * 34), b = spotOff(s + 14, -side * 40);
    const ev = { s, a, b, state: 'idle', t: 0, herd: [] };
    for (let i = 0; i < 3; i++) ev.herd.push({ q: new Quad('chamois', rand), delay: i * 0.45 + rand() * 0.2, off: (i - 1) * 2.2, x: a.x, z: a.z, y: a.y, yaw: 0 });
    life.events.push(ev);
  }
  // ruhende Gämsen oben am Fels
  for (let i = 0; i < 3; i++) {
    const pt = spotOff(60 + i * 25, (i % 2 ? 1 : -1) * (40 + i * 6));
    life.chamois.push({ q: new Quad('chamois', rand), x: pt.x, z: pt.z, yaw: rand() * 6.28, ph: rand() * 10 });
  }
  // Gleitschirme
  const cols = [['#e8462b', '#f4efe6', '#1d1f1a'], ['#2a6ad8', '#f4d03f', '#f4efe6'], ['#2fa36b', '#1d1f1a', '#f4efe6'], ['#c23ad8', '#f4efe6', '#3a3a3a'], ['#f39c12', '#2c3e50', '#ecf0f1'], ['#1abc9c', '#e74c3c', '#f4efe6']];
  let peak = -1, pi = 0; for (let id = 0; id < G * G; id += 5) if (H[id] > peak) { peak = H[id]; pi = id; }
  const px = (pi % G) * CELL - HALF, pz = Math.floor(pi / G) * CELL - HALF;
  for (let i = 0; i < 6; i++) {
    const gl = makeGlider(cols[i], rand);
    grp.add(gl.group);
    if (i < 4) Object.assign(gl, { mode: 'thermal', cx: px - 300 + rand() * 900 - i * 350, cz: pz - 200 + rand() * 500, alt: peak + 120 + i * 90, R: 40 + rand() * 40, w: (rand() < 0.5 ? 1 : -1) * (0.2 + rand() * 0.06), a: rand() * 6.28 });
    else Object.assign(gl, { mode: 'glide', u: i === 4 ? 0.1 : 0.55, speed: 11 });
    life.gliders.push(gl);
  }
  // Alpendohlen kreisen am Gipfel
  for (let i = 0; i < 14; i++) {
    life.birds.push({ kind: 'chough', cx: stationA.x + (rand() - 0.5) * 160, cz: stationA.z + (rand() - 0.5) * 160, R: 15 + rand() * 40, a: rand() * 6.28, w: (rand() < 0.5 ? 1 : -1) * (0.45 + rand() * 0.3), alt: hAt(stationA.x, stationA.z) + 10 + rand() * 25, ph: rand() * 6 });
  }
  // Steinadler über den Almen
  for (const f of [0.12, 0.45]) {
    const c = spotOff(trail.L * f, 60);
    life.birds.push({ kind: 'eagle', cx: c.x, cz: c.z, R: 60 + rand() * 30, a: rand() * 6.28, w: 0.12 + rand() * 0.04, alt: c.y + 55 + rand() * 25, ph: rand() * 6 });
  }
  // Dohlen-Schwärme sitzen auf oder neben der Strecke und fliegen auf, wenn man kommt
  for (const f of [0.1, 0.27, 0.43, 0.58, 0.74, 0.9]) {
    const s0 = trail.L * f, side = rand() < 0.5 ? -1 : 1;
    const fl = { s: s0, state: 'ground', t: 0, birds: [], side };
    const n = 6 + Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      const pt = spotOff(s0 + (rand() - 0.5) * 10, side * (rand() * 7 - 1.5));
      fl.birds.push({ x: pt.x, y: pt.y, z: pt.z, x0: pt.x, z0: pt.z, yaw: rand() * 6.28, ph: rand() * 10, delay: rand() * 0.5, sp: 7 + rand() * 3, climb: 1.5 + rand() * 1.5, R: 8 + rand() * 12, w: 0.6 + rand() * 0.3, spread: (rand() - 0.5) * 0.8 });
    }
    life.flocks.push(fl);
  }
  // Murmeltiere an ihren Bauen auf den offenen Almwiesen
  {
    const mound = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 1 }), 40);
    const hole = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x120c08 }), 40);
    mound.count = hole.count = 0; mound.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    let lastS = -1e9, colonies = 0;
    for (let s0 = 40; s0 < trail.L * 0.75 && colonies < 6; s0 += 12) {
      if (s0 - lastS < 160) continue;
      for (const side of [1, -1]) {
        const lat = side * (8 + rand() * 10), pt = spotOff(s0, lat), ny = normalAt(pt.x, pt.z, new THREE.Vector3()).y;
        if (ny < 0.8 || forestAt(pt.x, pt.z, pt.y, ny) > 0.2 || nearStations(pt.x, pt.z) || trailDistAt(pt.x, pt.z) < 6 || scDistAt(pt.x, pt.z) < 6) continue;
        reservedSpots.push([pt.x, pt.z, 7]);
        const col = { s: s0, whistled: false, members: [] };
        const nb = 2 + Math.floor(rand() * 2);
        for (let k = 0; k < nb; k++) {
          const bx = pt.x + (rand() - 0.5) * 5, bz = pt.z + (rand() - 0.5) * 5, by = hAt(bx, bz);
          mound.setMatrixAt(mound.count++, m4.compose(V(bx, by - 0.05, bz), q, V(0.55, 0.18, 0.55)));
          hole.setMatrixAt(hole.count++, m4.compose(V(bx + 0.18, by + 0.1, bz), q, V(0.13, 1, 0.11)));
          const a = rand() * 6.28, d = 1.2 + rand() * 2.5;
          col.members.push({ bx: bx + 0.18, bz: bz, hx: bx + Math.cos(a) * d, hz: bz + Math.sin(a) * d, x: bx + Math.cos(a) * d, z: bz + Math.sin(a) * d, state: 'up', t: 0, ph: rand() * 10, yaw: facingTrail(s0, lat) + (rand() - 0.5) * 1.5, gait: 0 });
        }
        life.marmots.push(col); colonies++; lastS = s0;
        break;
      }
    }
    grp.add(mound, hole);
  }
  // Blitzlicht der Fotografen
  const flashTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,250,230,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  for (const p of life.people) if (p.flash) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    sp.scale.setScalar(1.6); grp.add(sp); p.flashSprite = sp; p.flashT = 0; p.flashCd = 0;
  }
  return grp;
}

function buildWorkers(rand, grp) {
  // Platz im Wald neben der Strecke suchen
  let best = null;
  for (let s = trail.L * 0.5; s < trail.L * 0.7; s += 10) {
    for (const side of [-1, 1]) {
      const pt = spotOff(s, side * 15), ny = normalAt(pt.x, pt.z, new THREE.Vector3()).y;
      const f = forestAt(pt.x, pt.z, pt.y, ny);
      const score = f + ny * 0.8 - (scDistAt(pt.x, pt.z) < 30 ? 5 : 0);
      if (!best || score > best.f) best = { s, side, f: score, pt };
    }
  }
  const { s, side, pt } = best;
  reservedSpots.push([pt.x, pt.z, 24]);
  const yaw = trail.yaw[trailIdx(s)];
  const fallDir = V(Math.sin(yaw), 0, Math.cos(yaw)); // Baum fällt parallel zur Strecke talwärts
  const tree = new THREE.Group(); tree.position.set(pt.x, pt.y - 0.2, pt.z);
  const pivot = new THREE.Group(); tree.add(pivot);
  const mesh = new THREE.Mesh(spruceGeo({ ...SPRUCE_VARIANTS[0], seed: 23 }), treeMats.spruce); mesh.castShadow = true; mesh.receiveShadow = true; mesh.position.y = 0.45; mesh.scale.setScalar(0.85);
  pivot.add(mesh);
  const stump = new THREE.Mesh(barkCylinder(0.36, 0.32, 0.45, 10, 1), new THREE.MeshStandardMaterial({ map: TEX.bark, color: new THREE.Color(0.55, 0.4, 0.33), roughness: 0.95 }));
  stump.castShadow = true; tree.add(stump);
  grp.add(tree);
  // Arbeiter
  const side2 = V(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(side);
  const wOpts = { top: 0x2f6a3a, pants: 0x2a2a2a, hat: 'helmet', hatCol: 0xf07a12, gloves: 0x3a3a3a, backpack: false, glasses: false };
  const sawPos = V(pt.x, 0, pt.z).addScaledVector(fallDir, -0.95);
  const sawyer = addPerson(rand, 'sawing', sawPos.x, sawPos.z, Math.atan2(fallDir.x, fallDir.z), { ...wOpts, react: false });
  const spot = V(pt.x, 0, pt.z).addScaledVector(fallDir, -10).addScaledVector(side2, 6);
  const watcher = addPerson(rand, 'radio', spot.x, spot.z, Math.atan2(pt.x - spot.x, pt.z - spot.z), { ...wOpts, top: 0xe86a12, react: false });
  // Rückezug und Holzpolter
  const mach = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: 0x3f6a2a, roughness: 0.5, metalness: 0.3 }), dark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 }), glass = new THREE.MeshStandardMaterial({ color: 0x1b2630, roughness: 0.1, metalness: 0.6 });
  const box = (m, w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; mach.add(b); return b; };
  box(green, 2.4, 1.0, 6.5, 0, 1.4, 0); box(green, 2.2, 1.6, 1.8, 0, 2.6, 2.0); box(glass, 2.25, 1.0, 1.4, 0, 2.8, 2.0);
  for (const z of [-2.2, -0.8, 2.3]) for (const x of [-1.25, 1.25]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.55, 16).rotateZ(Math.PI / 2), dark); w.position.set(x, 0.65, z); w.castShadow = true; mach.add(w); }
  const crane = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 4.5, 8), green); crane.position.set(0, 3.6, -0.5); crane.rotation.x = -0.9; mach.add(crane);
  const mp = V(pt.x, 0, pt.z).addScaledVector(fallDir, -14).addScaledVector(side2, 10);
  mach.position.set(mp.x, hAt(mp.x, mp.z) - 0.1, mp.z); mach.rotation.y = yaw + 0.4; grp.add(mach);
  reservedSpots.push([mp.x, mp.z, 6]); addObstacle(mp.x, mp.z, 3);
  const logGeo = barkCylinder(0.22, 0.2, 4, 10, 2).rotateX(Math.PI / 2).translate(0, 0, -2);
  const logs = new THREE.InstancedMesh(logGeo, stump.material, 14);
  const lp = V(pt.x, 0, pt.z).addScaledVector(fallDir, 6).addScaledVector(side2, 8);
  const ly = hAt(lp.x, lp.z), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(_UP, yaw);
  let li = 0;
  for (let row = 0; row < 4; row++) for (let k = 0; k < 4 - row; k++) { if (li >= 14) break; const off = (k - (3 - row) / 2) * 0.44; const pp = lp.clone().addScaledVector(side2, off); pp.y = ly + 0.22 + row * 0.38; logs.setMatrixAt(li++, m4.compose(pp, q, V(1, 1, 1))); }
  logs.count = li; logs.castShadow = true; grp.add(logs);
  addObstacle(lp.x, lp.z, 2);
  // Warnschild an der Strecke
  const sp = spotOff(s - 60, side * (TRAIL_HALF + 1.4));
  const sign = makeSign(signTex('warn'), sp, facingTrail(s - 60, side * 3) + Math.PI);
  grp.add(sign);
  life.workers = { tree, pivot, mesh, s, fallDir, axis: new THREE.Vector3().crossVectors(_UP, fallDir).normalize(), state: 'saw', ang: 0, vel: 0, t: 0, base: V(pt.x, pt.y, pt.z), sawyer };
}
function makeSign(tex, at, yaw) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9 }));
  post.position.y = 0.8; post.castShadow = true;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }));
  plate.position.set(0, 1.5, 0.06);
  g.add(post, plate); g.position.set(at.x, at.y, at.z); g.rotation.y = yaw;
  return g;
}

// Gleitschirm: gewölbte Kappe, Leinen, Pilot im Gurtzeug
function makeGlider(cols, rand) {
  const group = new THREE.Group();
  const span = 10.5, chord = 2.6, R = 7.5, nu = 28, nv = 6;
  const pos = [], uv = [], idx = [];
  for (const surf of [0, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const u = i / nu * 2 - 1, v = j / nv;
      const th = u * (span / 2) / R;
      const taper = 1 - 0.35 * u * u;
      const prof = Math.sin(v * Math.PI) * 0.22 * taper * (surf ? -0.6 : 1) + (1 - v) * 0.08;
      const rr = R + prof;
      pos.push(Math.sin(th) * rr, Math.cos(th) * rr - R, (0.45 - v) * chord * taper);
      uv.push(i / nu, v);
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = base + i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const canopy = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: canopyTex(...cols), side: THREE.DoubleSide, roughness: 0.6 }));
  canopy.castShadow = true; canopy.position.y = 7.2;
  group.add(canopy);
  const lp = [];
  for (let i = 1; i < nu; i += 3) for (const v of [0.15, 0.6]) {
    const u = i / nu * 2 - 1, th = u * (span / 2) / R, taper = 1 - 0.35 * u * u;
    const p = [Math.sin(th) * R * 0.98, Math.cos(th) * R - R + 7.2 - 0.1, (0.45 - v) * chord * taper];
    lp.push(...p, u < 0 ? -0.22 : 0.22, 0.6, 0.05);
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)), new THREE.LineBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.6 })));
  const pilot = new Human(rand, { top: [0x1d1f1a, 0xe8462b, 0x24456b, 0xe2a33a][Math.floor(rand() * 4)], pants: 0x222222, hat: 'helmet', hatCol: 0xf4efe6, backpack: false, props: POSE_PROPS.pilot });
  return { group, pilot, roll: 0, yaw: 0, pos: new THREE.Vector3(), ph: rand() * 6 };
}

// ------------------------------------------------------------------
// Aktualisierung pro Bild
// ------------------------------------------------------------------
const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _lv = new THREE.Vector3();
const _rhd = { H: new THREE.Vector3(), hU: new THREE.Vector3(), hF: new THREE.Vector3(), hR: new THREE.Vector3() };
const _rhL = new THREE.Vector3(), _rhR = new THREE.Vector3(), _rhA = new THREE.Vector3(), _rhB = new THREE.Vector3();
// fehlende Knie/Ellbogen wie bei den Kapselfiguren per IK ergänzen
function fillJoints(j) {
  if (!j.knL) j.knL = ik2(j.hpL, j.ftL, 0.46, 0.45, j.kneePole || V(0.15, 0, 1), new THREE.Vector3());
  if (!j.knR) j.knR = ik2(j.hpR, j.ftR, 0.46, 0.45, j.kneePoleR || j.kneePole || V(-0.15, 0, 1), new THREE.Vector3());
  if (!j.elL) j.elL = ik2(j.shL, j.haL, 0.3, 0.28, j.elbowPole || V(0.6, -0.3, -0.6), new THREE.Vector3());
  if (!j.elR) j.elR = ik2(j.shR, j.haR, 0.3, 0.28, j.elbowPoleR || V(-0.6, -0.3, -0.6), new THREE.Vector3());
}
// die nächsten Zuschauer bekommen echte Figuren, der Rest bleibt Kapselfigur
function realUpdatePool(camX, camZ) {
  const near = [];
  for (const p of life.people) { if (p.noReal) continue; const d = Math.hypot(p.x - camX, p.z - camZ); if (d < REAL.RANGE + (p.real ? 8 : 0)) near.push([d, p]); }
  near.sort((a, b) => a[0] - b[0]);
  const want = new Set(near.slice(0, REAL.N).map((x) => x[1]));
  for (const e of REAL.pool) if (e.person && !want.has(e.person)) realRelease(e);
  for (const p of want) {
    if (p.real) continue;
    const e = REAL.pool.find((q) => !q.person && q.sex === p.h.sex) || REAL.pool.find((q) => !q.person);
    if (e) realAssign(e, p);
  }
}
function updateLife(dt, t, cam, P) {
  const camX = cam.x, camZ = cam.z;
  pBegin();
  if (REAL.ready) realUpdatePool(camX, camZ);
  // Zuschauer: schauen dem Fahrer nach, wenn er vorbeikommt
  for (const p of life.people) {
    const dc = Math.hypot(p.x - camX, p.z - camZ);
    const dp = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);
    let j = null;
    if (p.real) {
      p.e = damp(p.e, p.react && dp < 35 ? 1 : 0, 3, dt);
      j = POSES[p.pose](t, p.e, p.ph);
      fillJoints(j);
      let look = 0;
      if (p.look && dp < 45) {
        let a = Math.atan2(P.pos.x - p.x, P.pos.z - p.z) - p.yaw;
        while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
        look = clamp(a, -1.1, 1.1) * smooth(45, 25, dp);
      }
      p.lookS = damp(p.lookS || 0, look, 5, dt);
      const e = p.real;
      realPose(e, j, p.yaw, _lv.set(p.x, p.y, p.z), p.lookS);
      // Mütze und Brille auf den echten Kopf, Requisiten in die echten Hände
      const hd = realHead(e, _rhd);
      const sc = e.holder.scale.x;
      p.h.drawHat((base, f, u, r, out) => out.copy(base).addScaledVector(hd.hF, f * sc).addScaledVector(hd.hU, u * sc).addScaledVector(hd.hR, r * sc), hd.H, hd.hR);
      _lq.setFromAxisAngle(_UP, p.yaw);
      _lm.compose(_lv.set(p.x, p.y, p.z), _lq, V(1, 1, 1));
      p.h.Q.setFromRotationMatrix(_lm);
      const pl = _rhL.copy(j.haL).multiplyScalar(p.h.scale).applyMatrix4(_lm), pr = _rhR.copy(j.haR).multiplyScalar(p.h.scale).applyMatrix4(_lm);
      p.h.drawProps(j, _lm, realHand(e, 'l', _rhA).sub(pl), realHand(e, 'r', _rhB).sub(pr));
      p.cache = null;
    } else pupDraw(p, dc, () => {
      p.e = damp(p.e, p.react && dp < 35 ? 1 : 0, 3, dt);
      j = POSES[p.pose](t, p.e, p.ph);
      let look = 0;
      if (p.look && dp < 45) {
        let a = Math.atan2(P.pos.x - p.x, P.pos.z - p.z) - p.yaw;
        while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
        look = clamp(a, -1.1, 1.1) * smooth(45, 25, dp);
      }
      p.lookS = damp(p.lookS || 0, look, 5, dt);
      _lq.setFromAxisAngle(_UP, p.yaw);
      _lm.compose(_lv.set(p.x, p.y, p.z), _lq, V(1, 1, 1));
      p.h.apply(j, _lm, p.lookS);
    });
    if (p.flashSprite && j && !p.real) {
      p.flashCd -= dt; p.flashT -= dt;
      if (dp < 14 && p.flashCd <= 0) { p.flashT = 0.09; p.flashCd = 0.6 + Math.random() * 0.4; if (dp < 9 && P.air && P.isPlayer) { flash('Schnappschuss!', '', 1, true); P.boost = Math.min(1, P.boost + 0.1); } }
      const camPt = j.props ? j.props[0].a.clone().multiplyScalar(p.h.scale).applyMatrix4(_lm) : _lv;
      p.flashSprite.position.copy(camPt);
      p.flashSprite.material.opacity = p.flashT > 0 ? 1 : 0;
    }
  }
  // Holzarbeiter
  const W = life.workers;
  if (W) {
    const ds = W.s - P.s;
    if (W.state === 'saw') {
      if (ds < 120 && ds > 20) { W.state = 'fall'; W.vel = 0.02; sfx('crack', W.base); }
      if (Math.random() < dt * 30 && Math.hypot(W.base.x - camX, W.base.z - camZ) < 200) emitDust(W.base.x, W.base.y + 0.5, W.base.z, (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, 0.6, 1);
    } else if (W.state === 'fall') {
      W.vel += (1.2 * Math.sin(W.ang) + 0.15) * dt * 1.6;
      W.ang += W.vel * dt;
      if (W.ang >= Math.PI / 2 - 0.02) {
        W.ang = Math.PI / 2 - 0.02; W.state = 'down'; W.bounce = 0.12; sfx('thud', W.base);
        for (let i = 0; i < 40; i++) { const d = 3 + Math.random() * 15; emitDust(W.base.x + W.fallDir.x * d, hAt(W.base.x + W.fallDir.x * d, W.base.z + W.fallDir.z * d) + 0.4, W.base.z + W.fallDir.z * d, (Math.random() - 0.5) * 4, Math.random() * 2.5, (Math.random() - 0.5) * 4, 2.2, 0); }
      }
    } else if (W.state === 'down') {
      W.bounce = damp(W.bounce, 0, 4, dt);
      if (ds < -250 || ds > 400) { W.state = 'saw'; W.ang = 0; }
    }
    const a = W.state === 'down' ? W.ang - Math.abs(Math.sin(t * 14)) * W.bounce * 0.15 : W.ang;
    W.pivot.quaternion.setFromAxisAngle(W.axis, a);
  }
  // Kühe
  for (const c of life.cows) {
    const tt = t + c.ph;
    const look = Math.sin(tt * 0.13) > 0.6;
    let gait = 0, run = 0;
    if (Math.sin(tt * 0.07) > 0.85) { c.yaw += dt * 0.1; c.x += Math.sin(c.yaw) * dt * 0.5; c.z += Math.cos(c.yaw) * dt * 0.5; gait = (tt * 0.8) % 1; run = 0.1; }
    const head = look ? 0.1 : 0.9 + Math.sin(tt * 3) * 0.04;
    pupDraw(c, Math.hypot(c.x - camX, c.z - camZ), () => c.q.pose(_lv.set(c.x, hAt(c.x, c.z), c.z), c.yaw, 0, gait, run, 0, head, look ? Math.sin(tt * 0.5) * 0.6 : 0));
    const dcow = Math.hypot(c.x - camX, c.z - camZ);
    if (dcow < 90 && Math.random() < dt * (look ? 0.6 : 0.25)) sfx('bell', _lv.set(c.x, 0, c.z), dcow);
  }
  // Gämsen-Ereignisse
  for (const ev of life.events) {
    const ds = ev.s - P.s;
    if (ev.state === 'idle' && ds < 110 && ds > 45) { ev.state = 'run'; ev.t = 0; }
    if (ev.state === 'run') ev.t += dt;
    const dx = ev.b.x - ev.a.x, dz = ev.b.z - ev.a.z, L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
    const nx = dz / L, nz = -dx / L;
    for (const c of ev.herd) {
      const tt = ev.state === 'run' ? Math.max(0, ev.t - c.delay) : 0;
      const dist = Math.min(L, tt * 8.5), u = dist / L;
      const x = ev.a.x + dx * u + nx * c.off, z = ev.a.z + dz * u + nz * c.off;
      const g = hAt(x, z);
      const running = tt > 0 && u < 1;
      const stride = 3.4, cyc = (dist / stride) % 1;
      let hop = running ? Math.sin(cyc * Math.PI) * 0.55 : 0;
      const tdist = trailDistAt(x, z);
      if (running && tdist < TRAIL_HALF + 3) hop += Math.sin(cyc * Math.PI) * 0.9;
      c.x = x; c.z = z;
      if (Math.hypot(x - camX, z - camZ) < PUP_FAR) c.q.pose(_lv.set(x, g + hop, z), running ? yaw : yaw + Math.sin(t * 0.4 + c.off) * 0.6, running ? -Math.cos(cyc * Math.PI) * 0.25 : 0, running ? cyc : 0, running ? 1 : 0, running ? Math.sin(cyc * Math.PI) * 0.7 : 0, running ? 0 : 0.15, running ? 0 : Math.sin(t * 0.7 + c.off) * 0.8);
    }
  }
  for (const c of life.chamois) {
    pupDraw(c, Math.hypot(c.x - camX, c.z - camZ), () => c.q.pose(_lv.set(c.x, hAt(c.x, c.z), c.z), c.yaw, 0, 0, 0, 0, Math.sin(t * 0.2 + c.ph) > 0.5 ? 0.8 : 0.1, Math.sin(t * 0.5 + c.ph) * 0.7));
  }
  // Murmeltiere: pfeifen bei Annäherung und verschwinden im Bau
  for (const col of life.marmots) {
    for (const m of col.members) {
      const dp = Math.hypot(m.x - P.pos.x, m.z - P.pos.z), ahead = col.s - P.s;
      if (m.state === 'up' && dp < 34) {
        m.state = 'run'; m.t = 0;
        if (!col.whistled) { col.whistled = true; sfx('whistle', _lv.set(m.x, 0, m.z)); }
      } else if (m.state === 'run') {
        const dx = m.bx - m.x, dz = m.bz - m.z, d = Math.hypot(dx, dz);
        m.yaw = Math.atan2(dx, dz); m.gait += dt * 5;
        if (d < 0.15) { m.state = 'hidden'; m.t = 0; } else { const st = Math.min(d, dt * 3.5); m.x += dx / d * st; m.z += dz / d * st; }
      } else if (m.state === 'hidden') {
        m.t += dt;
        if (m.t > 5 && (ahead < -60 || ahead > 250)) { m.state = 'up'; m.x = m.hx; m.z = m.hz; col.whistled = false; }
      }
      if (m.state === 'hidden') continue;
      const dc = Math.hypot(m.x - camX, m.z - camZ); if (dc > 200) continue;
      const y = hAt(m.x, m.z);
      drawMarmot(_lv.set(m.x, y - 0.02, m.z), m.yaw, m.state === 'up' ? 1 : 0, m.gait, t * 0.7 + m.ph);
    }
  }
  // Gleitschirme
  for (const gl of life.gliders) {
    let vx, vz, y;
    if (gl.mode === 'thermal') {
      gl.a += gl.w * dt;
      const x = gl.cx + Math.cos(gl.a) * gl.R, z = gl.cz + Math.sin(gl.a) * gl.R;
      vx = -Math.sin(gl.a) * gl.w; vz = Math.cos(gl.a) * gl.w;
      gl.alt += Math.sin(t * 0.05 + gl.ph) * dt * 0.8;
      gl.pos.set(x, gl.alt, z);
      gl.roll = damp(gl.roll, -Math.sign(gl.w) * 0.32, 1, dt);
    } else {
      gl.u += dt * gl.speed / trail.L; if (gl.u > 1) gl.u = 0;
      const s = gl.u * trail.L, lat = Math.sin(gl.u * 18) * 70;
      const pt = trailPoint(s, lat, {});
      const pt2 = trailPoint(s + 5, Math.sin((gl.u + 5 / trail.L) * 18) * 70, {});
      vx = pt2.x - pt.x; vz = pt2.z - pt.z;
      y = Math.max(hAt(pt.x, pt.z) + 35, trail.y[trailIdx(s)] + 90 - gl.u * 50);
      gl.pos.set(pt.x, y, pt.z);
      gl.roll = damp(gl.roll, -Math.cos(gl.u * 18) * 0.35, 1.5, dt);
    }
    gl.yaw = Math.atan2(vx, vz);
    gl.group.position.copy(gl.pos);
    gl.group.quaternion.setFromEuler(new THREE.Euler(0.05, gl.yaw, gl.roll, 'YXZ'));
    gl.group.updateMatrix();
    _lm.copy(gl.group.matrix).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0));
    if (Math.hypot(gl.pos.x - camX, gl.pos.z - camZ) < 1200) gl.pilot.apply(POSES.pilot(t, 0, gl.ph), _lm);
  }
  // kreisende Dohlen und Adler
  for (const b of life.birds) {
    if (Math.hypot(b.cx - camX, b.cz - camZ) > 900) continue;
    b.a += b.w * dt;
    const x = b.cx + Math.cos(b.a) * b.R, z = b.cz + Math.sin(b.a) * b.R, y = b.alt + Math.sin(b.a * 2 + b.ph) * 4;
    const yaw = Math.atan2(-Math.sin(b.a) * b.w, Math.cos(b.a) * b.w);
    const eagle = b.kind === 'eagle';
    const flap = eagle ? (Math.sin(t * 0.3 + b.ph) > 0.85 ? Math.sin(t * 5) * 0.4 : 0.08) : Math.sin(t * 9 + b.ph) * 0.6 * (Math.sin(t * 0.7 + b.ph) > 0 ? 1 : 0.1);
    drawBird(b.kind, _lv.set(x, y, z), yaw, 0, -Math.sign(b.w) * (eagle ? 0.25 : 0.4), flap, false);
  }
  // Dohlen-Schwärme auf der Strecke
  for (const fl of life.flocks) {
    const ahead = fl.s - P.s;
    if (fl.state === 'ground' && ahead < 32 && ahead > -5) { fl.state = 'fly'; fl.t = 0; fl.dir = Math.atan2(P.vel.x, P.vel.z); sfx('chirp', _lv.set(fl.birds[0].x, 0, fl.birds[0].z)); }
    if (fl.state === 'fly') { fl.t += dt; if (fl.t > 40 && (ahead < -300 || ahead > 300)) { fl.state = 'ground'; for (const b of fl.birds) { b.x = b.x0; b.z = b.z0; b.y = hAt(b.x0, b.z0); } } }
    for (const b of fl.birds) {
      if (Math.hypot(b.x - camX, b.z - camZ) > 500) continue;
      if (fl.state === 'ground') {
        const hop = Math.max(0, Math.sin(t * 1.3 + b.ph * 3)) ** 8 * 0.08, peck = Math.max(0, Math.sin(t * 4 + b.ph)) ** 4;
        b.yaw += Math.sin(t * 0.5 + b.ph) * dt * 0.8;
        drawBird('chough', _lv.set(b.x, b.y + 0.1 + hop, b.z), b.yaw, 0, 0, 0, true, peck);
        continue;
      }
      const tt = Math.max(0, fl.t - b.delay);
      // erst quer zur Fahrtrichtung weg und hoch, dann im Kreis segeln
      const away = fl.dir + fl.side * Math.PI / 2 + b.spread;
      const dx = Math.sin(away), dz = Math.cos(away);
      let x, y, z, yaw, flap;
      const T1 = 4;
      if (tt < T1) {
        const d = b.sp * tt;
        x = b.x0 + dx * d; z = b.z0 + dz * d; y = hAt(b.x0, b.z0) + 0.1 + b.climb * tt + 0.6 * Math.min(tt, 1);
        yaw = away; flap = Math.sin(t * 22 + b.ph) * 0.9;
      } else {
        const cx = b.x0 + dx * (b.sp * T1 + b.R), cz = b.z0 + dz * (b.sp * T1 + b.R);
        const a0 = Math.atan2(-dx, -dz), ang = a0 - (tt - T1) * b.w * 0.9;
        x = cx + Math.sin(ang) * b.R; z = cz + Math.cos(ang) * b.R;
        y = hAt(b.x0, b.z0) + 0.7 + b.climb * T1 + Math.min(12, (tt - T1) * 0.8);
        yaw = ang - Math.PI / 2; flap = Math.sin(t * 10 + b.ph) * 0.5 * (Math.sin(t * 0.9 + b.ph) > 0 ? 1 : 0.1);
      }
      b.x = x; b.z = z; b.y = y;
      drawBird('chough', _lv.set(x, y, z), yaw, tt < T1 ? -0.25 : 0, tt < T1 ? 0 : 0.35, flap, false);
    }
  }
  pFlush();
}
