
// ------------------------------------------------------------------
// Figuren-System: Menschen und Tiere aus instanzierten Grundformen
// ------------------------------------------------------------------
const PUP = { n: { seg: 0, sph: 0, box: 0 } };
const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _ps = new THREE.Vector3(), _pd = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
function buildPuppetSystem() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.78, envMapIntensity: 0.4 });
  PUP.seg = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.82, 1, 1, 10, 1).translate(0, 0.5, 0), mat, 6000);
  PUP.sph = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), mat, 4000);
  PUP.box = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, 1500);
  for (const k of ['seg', 'sph', 'box']) {
    const im = PUP[k]; im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(im.instanceMatrix.count * 3), 3);
  }
  const g = new THREE.Group(); g.add(PUP.seg, PUP.sph, PUP.box); return g;
}
function pAlloc(type, color) {
  const im = PUP[type], i = PUP.n[type]++;
  im.count = PUP.n[type];
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  im.instanceColor.setXYZ(i, c.r, c.g, c.b);
  im.setMatrixAt(i, _pm.makeScale(0, 0, 0));
  return i;
}
function pSeg(i, a, b, r) {
  _pd.subVectors(b, a); const len = _pd.length() || 1e-4;
  _pq.setFromUnitVectors(_UP, _pd.multiplyScalar(1 / len));
  PUP.seg.setMatrixAt(i, _pm.compose(a, _pq, _ps.set(r, len, r)));
}
function pSph(i, p, rx, ry, rz, q) { PUP.sph.setMatrixAt(i, _pm.compose(p, q || _pq.identity(), _ps.set(rx, ry ?? rx, rz ?? rx))); }
function pBox(i, p, q, sx, sy, sz) { PUP.box.setMatrixAt(i, _pm.compose(p, q, _ps.set(sx, sy, sz))); }
function pHide(type, i) { PUP[type].setMatrixAt(i, _pm.makeScale(0, 0, 0)); }
function pFlush() { for (const k of ['seg', 'sph', 'box']) { PUP[k].instanceMatrix.needsUpdate = true; } }

// Zwei-Gelenk-IK: Knie/Ellbogen zwischen a und c, Richtung pole
function ik2(a, c, l1, l2, pole, out) {
  const d = new THREE.Vector3().subVectors(c, a);
  let L = clamp(d.length(), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
  d.normalize();
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const p = pole.clone().addScaledVector(d, -pole.dot(d)).normalize();
  return out.copy(a).addScaledVector(d, x).addScaledVector(p, h);
}

const SKIN = [0xe0b090, 0xc99a74, 0xa87050, 0x7a4e34, 0xf0c8a8];
const HAIR = [0x2a1d14, 0x5a3a1e, 0xb08040, 0x111111, 0x8a8a8a, 0xc23a22];
const CLOTH = [0x2f4a2a, 0xe8462b, 0x24456b, 0xe2a33a, 0x5b3a6b, 0xdedede, 0x1d1f1a, 0x7a2a2a, 0x3a6b8a, 0xd8c070, 0x2a8a6a];

// Mensch: Gelenke werden pro Pose lokal berechnet und in die Welt transformiert
class Human {
  constructor(rand, opts = {}) {
    const pick = (a) => a[Math.floor(rand() * a.length)];
    this.skin = new THREE.Color(opts.skin ?? pick(SKIN));
    this.top = new THREE.Color(opts.top ?? pick(CLOTH));
    this.pants = new THREE.Color(opts.pants ?? pick([0x1d1f1a, 0x2a3442, 0x3a3020, 0x4a4a4a, 0x26364a]));
    this.hair = new THREE.Color(opts.hair ?? pick(HAIR));
    this.scale = opts.scale ?? (0.92 + rand() * 0.14);
    this.hat = opts.hat ?? (rand() < 0.35);
    this.props = opts.props || [];
    const shoe = new THREE.Color(0x1a1a1a);
    this.i = {
      pelvis: pAlloc('sph', this.pants), abd: pAlloc('seg', this.top), chest: pAlloc('seg', this.top), neck: pAlloc('seg', this.skin),
      head: pAlloc('sph', this.skin), hair: pAlloc('sph', this.hat ? new THREE.Color(pick(CLOTH)) : this.hair),
      uaL: pAlloc('seg', this.top), uaR: pAlloc('seg', this.top), faL: pAlloc('seg', opts.shortSleeve ? this.skin : this.top), faR: pAlloc('seg', opts.shortSleeve ? this.skin : this.top),
      haL: pAlloc('sph', opts.gloves ?? this.skin), haR: pAlloc('sph', opts.gloves ?? this.skin),
      thL: pAlloc('seg', this.pants), thR: pAlloc('seg', this.pants), shL: pAlloc('seg', this.pants), shR: pAlloc('seg', this.pants),
      ftL: pAlloc('box', shoe), ftR: pAlloc('box', shoe),
    };
    this.propIdx = this.props.map((p) => pAlloc(p.type, p.color));
    this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion();
    this.w = {}; for (const k of ['pelvis', 'chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'hpL', 'hpR', 'knL', 'knR', 'ftL', 'ftR', 'fwd', 'up']) this.w[k] = new THREE.Vector3();
  }
  // j: lokale Gelenke (Meter, Blick +z). Fehlende Knie/Ellbogen werden per IK ergänzt.
  apply(j, M) {
    const s = this.scale, w = this.w;
    const T = (src, dst) => dst.copy(src).multiplyScalar(s).applyMatrix4(M);
    this.Q.setFromRotationMatrix(M);
    const fwdL = j.fwd || V(0, 0, 1);
    if (!j.knL) j.knL = ik2(j.hpL, j.ftL, 0.46, 0.45, j.kneePole || V(0.15, 0, 1), new THREE.Vector3());
    if (!j.knR) j.knR = ik2(j.hpR, j.ftR, 0.46, 0.45, j.kneePole || V(-0.15, 0, 1), new THREE.Vector3());
    if (!j.elL) j.elL = ik2(j.shL, j.haL, 0.3, 0.28, j.elbowPole || V(0.6, -0.3, -0.6), new THREE.Vector3());
    if (!j.elR) j.elR = ik2(j.shR, j.haR, 0.3, 0.28, j.elbowPoleR || V(-0.6, -0.3, -0.6), new THREE.Vector3());
    for (const k of ['pelvis', 'chest', 'neck', 'head', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR', 'hpL', 'hpR', 'knL', 'knR', 'ftL', 'ftR']) T(j[k], w[k]);
    w.fwd.copy(fwdL).transformDirection(M);
    const I = this.i;
    pSph(I.pelvis, w.pelvis, 0.15 * s, 0.12 * s, 0.12 * s, this.Q);
    const mid = w.pelvis.clone().lerp(w.chest, 0.45);
    pSeg(I.abd, w.pelvis, mid, 0.135 * s);
    pSeg(I.chest, mid, w.chest, 0.165 * s);
    pSeg(I.neck, w.chest, w.neck, 0.05 * s);
    const hq = j.headQ ? this.Q.clone().multiply(j.headQ) : this.Q;
    pSph(I.head, w.head, 0.1 * s, 0.12 * s, 0.11 * s, hq);
    const hairOff = V(0, 0.03, -0.015).multiplyScalar(s).applyQuaternion(hq);
    pSph(I.hair, w.head.clone().add(hairOff), (this.hat ? 0.112 : 0.106) * s, (this.hat ? 0.1 : 0.095) * s, (this.hat ? 0.115 : 0.112) * s, hq);
    pSeg(I.uaL, w.shL, w.elL, 0.052 * s); pSeg(I.uaR, w.shR, w.elR, 0.052 * s);
    pSeg(I.faL, w.elL, w.haL, 0.042 * s); pSeg(I.faR, w.elR, w.haR, 0.042 * s);
    pSph(I.haL, w.haL, 0.045 * s); pSph(I.haR, w.haR, 0.045 * s);
    pSeg(I.thL, w.hpL, w.knL, 0.075 * s); pSeg(I.thR, w.hpR, w.knR, 0.075 * s);
    pSeg(I.shL, w.knL, w.ftL, 0.058 * s); pSeg(I.shR, w.knR, w.ftR, 0.058 * s);
    for (const [k, f] of [['ftL', w.ftL], ['ftR', w.ftR]]) {
      const fq = j.footQ ? this.Q.clone().multiply(j.footQ) : this.Q;
      const p = f.clone().add(V(0, -0.03, 0.06).multiplyScalar(s).applyQuaternion(fq));
      pBox(I[k], p, fq, 0.1 * s, 0.08 * s, 0.26 * s);
    }
    if (j.props) j.props.forEach((pp, k) => {
      const idx = this.propIdx[k]; if (idx === undefined) return;
      const p = pp.p.clone().multiplyScalar(s).applyMatrix4(M), q = pp.q ? this.Q.clone().multiply(pp.q) : this.Q;
      if (pp.type === 'box') pBox(idx, p, q, pp.s[0], pp.s[1], pp.s[2]);
      else if (pp.type === 'seg') pSeg(idx, p, pp.b.clone().multiplyScalar(s).applyMatrix4(M), pp.r);
      else pSph(idx, p, pp.s[0], pp.s[1], pp.s[2], q);
    });
  }
}
// Standard-Skelett (lokal)
function baseSkel(lean = 0) {
  return {
    pelvis: V(0, 0.98, 0), chest: V(0, 1.36, lean), neck: V(0, 1.5, lean * 1.1), head: V(0, 1.63, 0.02 + lean * 1.2),
    shL: V(0.19, 1.43, lean), shR: V(-0.19, 1.43, lean), hpL: V(0.1, 0.95, 0), hpR: V(-0.1, 0.95, 0),
    haL: V(0.25, 0.92, 0.05), haR: V(-0.25, 0.92, 0.05), ftL: V(0.12, 0.06, 0), ftR: V(-0.12, 0.06, 0),
  };
}
const shiftY = (j, dy) => { for (const k in j) if (j[k] && j[k].isVector3 && k !== 'fwd' && k !== 'kneePole' && k !== 'elbowPole' && k !== 'elbowPoleR') j[k].y += dy; return j; };
const POSES = {
  stand(t, e, ph) { const j = baseSkel(0.02); j.haL.set(0.24, 0.93 + Math.sin(t + ph) * 0.01, 0.05); return j; },
  cheer(t, e, ph) {
    const j = baseSkel(0.03), w = Math.sin(t * (6 + e * 5) + ph);
    j.haL.set(0.32 + w * 0.08, 1.95 + e * 0.1, 0.12); j.haR.set(-0.32 - w * 0.08, 1.95 + e * 0.1, 0.12);
    j.elbowPole = V(1, 0, -0.2); j.elbowPoleR = V(-1, 0, -0.2);
    return shiftY(j, e * Math.abs(Math.sin(t * 7 + ph)) * 0.16);
  },
  clap(t, e, ph) {
    const j = baseSkel(0.04), c = Math.sin(t * (8 + e * 4) + ph) * 0.5 + 0.5;
    j.haL.set(0.04 + c * 0.14, 1.3 + e * 0.25, 0.3); j.haR.set(-0.04 - c * 0.14, 1.3 + e * 0.25, 0.3);
    return j;
  },
  phone(t, e, ph) {
    const j = baseSkel(0.03);
    j.haR.set(-0.06, 1.56, 0.36); j.haL.set(0.22, 1.0, -0.02); j.elbowPole = V(1, 0, -1);
    j.headQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, Math.sin(t * 0.7 + ph) * 0.1, 0));
    j.props = [{ type: 'box', p: V(-0.05, 1.6, 0.38), s: [0.075, 0.15, 0.012], q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 0, 0)) }];
    return j;
  },
  cowbell(t, e, ph) {
    const j = baseSkel(0.04), sw = Math.sin(t * (5 + e * 6) + ph);
    j.haR.set(-0.3, 1.25 + sw * 0.2, 0.25 + Math.cos(t * (5 + e * 6) + ph) * 0.15);
    j.haL.set(0.3, 1.9, 0.1); j.elbowPole = V(1, 0, -0.3);
    j.props = [{ type: 'box', p: j.haR.clone().add(V(0, -0.12, 0.02)), s: [0.14, 0.18, 0.11] }];
    return shiftY(j, e * Math.abs(Math.sin(t * 6 + ph)) * 0.08);
  },
  photographer(t, e, ph) {
    return {
      pelvis: V(0, 0.52, -0.05), chest: V(0, 0.9, 0.12), neck: V(0, 1.02, 0.16), head: V(0, 1.13, 0.2),
      shL: V(0.18, 0.97, 0.12), shR: V(-0.18, 0.97, 0.12), hpL: V(0.1, 0.5, -0.05), hpR: V(-0.1, 0.5, -0.05),
      knL: V(0.12, 0.5, 0.4), ftL: V(0.12, 0.06, 0.4), knR: V(-0.12, 0.06, 0.02), ftR: V(-0.12, 0.08, -0.42), footQ: null,
      haL: V(0.08, 1.12, 0.36), haR: V(-0.09, 1.12, 0.34),
      props: [{ type: 'box', p: V(0, 1.13, 0.36), s: [0.15, 0.11, 0.09] }, { type: 'seg', p: V(0, 1.12, 0.4), b: V(0, 1.11, 0.56), r: 0.045 }],
    };
  },
  handstand(t, e, ph) {
    const sw = Math.sin(t * 2.1 + ph) * 0.05;
    return {
      pelvis: V(sw, 1.12, 0), chest: V(sw * 0.4, 0.72, 0), neck: V(0, 0.56, 0.02), head: V(0, 0.42, 0.05),
      shL: V(0.2, 0.66, 0), shR: V(-0.2, 0.66, 0), haL: V(0.22, 0.05, 0.02), haR: V(-0.22, 0.05, 0.02),
      elL: V(0.22, 0.36, 0.02), elR: V(-0.22, 0.36, 0.02),
      hpL: V(0.1 + sw, 1.15, 0), hpR: V(-0.1 + sw, 1.15, 0),
      knL: V(0.2 + sw * 1.5, 1.55, 0.05), ftL: V(0.32 + sw * 2, 1.95, 0.0), knR: V(-0.16 + sw * 1.5, 1.58, -0.1), ftR: V(-0.2 + sw * 2, 1.96, -0.3),
      footQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
    };
  },
  superman(t, e, ph) {
    const b = Math.sin(t * 1.5 + ph) * 0.03;
    return {
      pelvis: V(0, 0.16, 0), chest: V(0, 0.22 + b, 0.42), neck: V(0, 0.28 + b, 0.58), head: V(0, 0.34 + b, 0.7),
      shL: V(0.19, 0.24 + b, 0.5), shR: V(-0.19, 0.24 + b, 0.5), haL: V(0.22, 0.42 + b * 2, 1.1), haR: V(-0.3, 0.38 + b * 2, 1.05),
      elL: V(0.22, 0.32, 0.8), elR: V(-0.26, 0.3, 0.78),
      hpL: V(0.1, 0.16, -0.04), hpR: V(-0.1, 0.16, -0.04), knL: V(0.12, 0.2, -0.5), knR: V(-0.12, 0.2, -0.5), ftL: V(0.14, 0.38 + b, -0.9), ftR: V(-0.14, 0.38 + b, -0.9),
      footQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
    };
  },
  yoga(t, e, ph) {
    const j = baseSkel(0); const sw = Math.sin(t * 1.7 + ph) * 0.02;
    j.ftR.set(-0.06, 0.55, 0.02); j.knR = V(-0.4, 0.62, 0.05);
    j.haL.set(0.02 + sw, 2.05, 0.05); j.haR.set(-0.02 + sw, 2.05, 0.05); j.elbowPole = V(1, 0, 0); j.elbowPoleR = V(-1, 0, 0);
    j.ftL.set(0.04, 0.06, 0);
    return j;
  },
  dab(t, e, ph) {
    const j = baseSkel(0.05), k = Math.sin(t * 3 + ph) > 0 ? 1 : -1;
    j.haL.set(0.65 * k, 1.85, 0.1); j.haR.set(0.05 * k, 1.62, 0.28); j.elR = V(-0.12 * k + 0.1 * k, 1.55, 0.32);
    j.head.set(0.06 * k, 1.58, 0.12);
    return j;
  },
  lyingBack(t, e, ph) {
    return {
      pelvis: V(0, 0.14, 0), chest: V(0, 0.2, 0.45), neck: V(0, 0.24, 0.6), head: V(0, 0.28, 0.72),
      shL: V(0.19, 0.2, 0.52), shR: V(-0.19, 0.2, 0.52), haL: V(0.08, 0.32, 0.8), haR: V(-0.08, 0.32, 0.8), elL: V(0.32, 0.32, 0.66), elR: V(-0.32, 0.32, 0.66),
      hpL: V(0.1, 0.14, -0.04), hpR: V(-0.1, 0.14, -0.04), knL: V(0.12, 0.45, -0.35), ftL: V(0.12, 0.08, -0.72), knR: V(-0.05, 0.2, -0.5), ftR: V(0.06 + Math.sin(t + ph) * 0.05, 0.5, -0.8),
    };
  },
  carryBase(t, e, ph) { const j = baseSkel(0.02); j.haL.set(0.24, 1.42, 0.22); j.haR.set(-0.24, 1.42, 0.22); return j; },
  carryTop(t, e, ph) {
    const w = Math.sin(t * 6 + ph) * 0.1;
    return {
      pelvis: V(0, 1.62, -0.02), chest: V(0, 2.0, 0), neck: V(0, 2.12, 0), head: V(0, 2.25, 0.02),
      shL: V(0.19, 2.06, 0), shR: V(-0.19, 2.06, 0), haL: V(0.38 + w, 2.55, 0.1), haR: V(-0.38 - w, 2.55, 0.1), elbowPole: V(1, 0, 0), elbowPoleR: V(-1, 0, 0),
      hpL: V(0.11, 1.62, 0.02), hpR: V(-0.11, 1.62, 0.02), knL: V(0.2, 1.55, 0.36), ftL: V(0.2, 1.15, 0.3), knR: V(-0.2, 1.55, 0.36), ftR: V(-0.2, 1.15, 0.3),
    };
  },
  sawing(t, e, ph) {
    const jit = Math.sin(t * 90) * 0.006;
    return {
      pelvis: V(0, 0.68, -0.1), chest: V(0, 1.02, 0.18), neck: V(0, 1.12, 0.26), head: V(0, 1.22, 0.33),
      shL: V(0.18, 1.06, 0.18), shR: V(-0.18, 1.06, 0.18), haL: V(0.14 + jit, 0.58, 0.5), haR: V(-0.1 + jit, 0.55, 0.42),
      hpL: V(0.1, 0.66, -0.1), hpR: V(-0.1, 0.66, -0.1), ftL: V(0.2, 0.06, 0.25), ftR: V(-0.18, 0.06, -0.2), kneePole: V(0.3, 0, 1),
      props: [{ type: 'box', p: V(0.02 + jit, 0.55, 0.52), s: [0.16, 0.2, 0.36] }, { type: 'box', p: V(0.02 + jit, 0.5, 0.95), s: [0.03, 0.08, 0.62] }],
    };
  },
  radio(t, e, ph) {
    const j = baseSkel(0.02);
    j.haL.set(0.12, 1.6, 0.06); j.elbowPole = V(1, 0, -0.2);
    j.haR.set(-0.45, 1.45, 0.45 + Math.sin(t * 0.8) * 0.05);
    j.props = [{ type: 'box', p: V(0.11, 1.63, 0.08), s: [0.05, 0.13, 0.04] }];
    return j;
  },
  pilot(t, e, ph) {
    const b = Math.sin(t * 1.3 + ph) * 0.05;
    return {
      pelvis: V(0, 0, 0), chest: V(0, 0.42, -0.06), neck: V(0, 0.54, -0.04), head: V(0, 0.67, 0),
      shL: V(0.2, 0.48, -0.05), shR: V(-0.2, 0.48, -0.05), haL: V(0.3, 0.85 + b, 0.02), haR: V(-0.3, 0.85 - b, 0.02), elbowPole: V(1, -0.5, 0), elbowPoleR: V(-1, -0.5, 0),
      hpL: V(0.1, -0.02, 0.02), hpR: V(-0.1, -0.02, 0.02), knL: V(0.12, 0.02, 0.45), ftL: V(0.12, -0.32, 0.6), knR: V(-0.12, 0.02, 0.45), ftR: V(-0.12, -0.32, 0.6),
      props: [{ type: 'box', p: V(0, -0.08, 0.05), s: [0.42, 0.22, 0.75] }],
    };
  },
};
const POSE_PROPS = {
  phone: [{ type: 'box', color: 0x111111 }],
  cowbell: [{ type: 'box', color: 0xc9a43a }],
  photographer: [{ type: 'box', color: 0x151515 }, { type: 'seg', color: 0x222222 }],
  sawing: [{ type: 'box', color: 0xe86a12 }, { type: 'box', color: 0x9a9a9a }],
  radio: [{ type: 'box', color: 0x222222 }],
  pilot: [{ type: 'box', color: 0x2a2a2a }],
};

// ------------------------------------------------------------------
// Tiere: Gämse, Kühe, Alpendohlen
// ------------------------------------------------------------------
class Quad {
  constructor(kind, rand) {
    this.kind = kind;
    const cow = kind === 'cow';
    this.c = cow
      ? { body: new THREE.Color(0.32 + rand() * 0.08, 0.25 + rand() * 0.05, 0.19), light: new THREE.Color(0.78, 0.72, 0.62), horn: new THREE.Color(0.85, 0.8, 0.65), hoof: new THREE.Color(0.1, 0.1, 0.1) }
      : { body: new THREE.Color(0.17, 0.11, 0.07), light: new THREE.Color(0.78, 0.72, 0.6), horn: new THREE.Color(0.06, 0.05, 0.05), hoof: new THREE.Color(0.08, 0.07, 0.06) };
    const c = this.c;
    this.i = {
      body: pAlloc('sph', c.body), rump: pAlloc('sph', c.body), neck: pAlloc('seg', c.body), head: pAlloc('sph', c.body), face: pAlloc('sph', c.light),
      hornL: pAlloc('seg', c.horn), hornR: pAlloc('seg', c.horn), hookL: pAlloc('seg', c.horn), hookR: pAlloc('seg', c.horn),
      earL: pAlloc('seg', c.body), earR: pAlloc('seg', c.body), tail: pAlloc('seg', c.body),
      legs: [0, 1, 2, 3].map(() => [pAlloc('seg', c.body), pAlloc('seg', cow ? c.body : c.body), pAlloc('sph', c.hoof)]),
    };
    if (cow) { this.i.udder = pAlloc('sph', new THREE.Color(0.85, 0.6, 0.55)); this.i.bell = pAlloc('box', new THREE.Color(0.8, 0.62, 0.2)); }
    this.s = cow ? 1.55 : 1;
    this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion();
  }
  // gait: Phase 0..1, run: 0 steht, 1 rennt; tuck: Beine angezogen (Sprung); headDown: 0..1
  pose(pos, yaw, pitch, gait, run, tuck, headDown, headTurn) {
    const s = this.s, cow = this.kind === 'cow';
    this.Q.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    this.M.compose(pos, this.Q, _ps.set(s, s, s));
    const W = (x, y, z) => V(x, y, z).applyMatrix4(this.M);
    const I = this.i;
    const bh = cow ? 0.68 : 0.7;
    pSph(I.body, W(0, bh, 0.12), (cow ? 0.27 : 0.17) * s, (cow ? 0.3 : 0.2) * s, (cow ? 0.42 : 0.34) * s, this.Q);
    pSph(I.rump, W(0, bh + 0.02, -0.25), (cow ? 0.27 : 0.16) * s, (cow ? 0.29 : 0.19) * s, (cow ? 0.3 : 0.22) * s, this.Q);
    const nb = W(0, bh + 0.1, 0.38);
    const hd = headDown, ht = headTurn || 0;
    const headL = V(Math.sin(ht) * 0.15, bh + 0.42 - hd * 0.75, 0.62 + hd * 0.05);
    if (cow) { headL.y = bh + 0.18 - hd * 0.62; headL.z = 0.66 + hd * 0.1; }
    const hw = headL.clone().applyMatrix4(this.M);
    pSeg(I.neck, nb, hw, (cow ? 0.13 : 0.07) * s);
    const hq = this.Q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5 + hd * 0.9, ht, 0)));
    pSph(I.head, hw, (cow ? 0.11 : 0.065) * s, (cow ? 0.11 : 0.07) * s, (cow ? 0.2 : 0.13) * s, hq);
    pSph(I.face, hw.clone().add(V(0, -0.02, cow ? 0.14 : 0.09).multiplyScalar(s).applyQuaternion(hq)), (cow ? 0.09 : 0.045) * s, (cow ? 0.08 : 0.05) * s, (cow ? 0.08 : 0.07) * s, hq);
    const hp = (x, y, z) => hw.clone().add(V(x, y, z).multiplyScalar(s).applyQuaternion(hq));
    if (cow) {
      pSeg(I.hornL, hp(0.08, 0.08, -0.05), hp(0.17, 0.14, -0.02), 0.018 * s); pSeg(I.hornR, hp(-0.08, 0.08, -0.05), hp(-0.17, 0.14, -0.02), 0.018 * s);
      pSeg(I.hookL, hp(0.17, 0.14, -0.02), hp(0.18, 0.2, 0.02), 0.012 * s); pSeg(I.hookR, hp(-0.17, 0.14, -0.02), hp(-0.18, 0.2, 0.02), 0.012 * s);
      pSeg(I.earL, hp(0.1, 0.05, -0.08), hp(0.2, 0.02, -0.1), 0.03 * s); pSeg(I.earR, hp(-0.1, 0.05, -0.08), hp(-0.2, 0.02, -0.1), 0.03 * s);
    } else {
      pSeg(I.hornL, hp(0.025, 0.06, -0.02), hp(0.03, 0.17, -0.02), 0.011 * s); pSeg(I.hornR, hp(-0.025, 0.06, -0.02), hp(-0.03, 0.17, -0.02), 0.011 * s);
      pSeg(I.hookL, hp(0.03, 0.17, -0.02), hp(0.03, 0.17, -0.07), 0.008 * s); pSeg(I.hookR, hp(-0.03, 0.17, -0.02), hp(-0.03, 0.17, -0.07), 0.008 * s);
      pSeg(I.earL, hp(0.04, 0.05, -0.05), hp(0.09, 0.09, -0.07), 0.015 * s); pSeg(I.earR, hp(-0.04, 0.05, -0.05), hp(-0.09, 0.09, -0.07), 0.015 * s);
    }
    pSeg(I.tail, W(0, bh + 0.08, -0.48), W(0, bh - (cow ? 0.45 : 0.05), cow ? -0.55 : -0.56), (cow ? 0.025 : 0.03) * s);
    // Beine: 0 vorne links, 1 vorne rechts, 2 hinten links, 3 hinten rechts (Galopp/Sprung: Paare gemeinsam)
    const legLen = bh - 0.02;
    [[0.09, 0.3, 0], [-0.09, 0.3, 0.08], [0.09, -0.3, 0.5], [-0.09, -0.3, 0.58]].forEach(([x, z, off], k) => {
      const front = k < 2;
      const phs = (gait + (run > 0.5 ? (front ? 0 : 0.5) : off)) * Math.PI * 2;
      const swing = Math.sin(phs) * (0.12 + run * 0.18), lift = Math.max(0, Math.cos(phs)) * (0.05 + run * 0.12);
      const top = W(x * (cow ? 1.6 : 1), bh - 0.05, z * (cow ? 1.3 : 1));
      let footL = V(x * (cow ? 1.6 : 1), 0.02 + lift, z * (cow ? 1.3 : 1) + swing);
      if (tuck > 0) footL = footL.lerp(V(x, bh * 0.45, z + (front ? -0.05 : 0.12)), tuck);
      const foot = footL.applyMatrix4(this.M);
      const pole = V(0, 0, front ? -1 : 1).applyQuaternion(this.Q);
      const knee = ik2(top, foot, legLen * 0.52 * s, legLen * 0.52 * s, pole, new THREE.Vector3());
      pSeg(I.legs[k][0], top, knee, (cow ? 0.07 : 0.035) * s);
      pSeg(I.legs[k][1], knee, foot, (cow ? 0.045 : 0.022) * s);
      pSph(I.legs[k][2], foot, (cow ? 0.05 : 0.025) * s);
    });
    if (cow) {
      pSph(I.udder, W(0, bh - 0.3, -0.2), 0.12 * s, 0.08 * s, 0.12 * s, this.Q);
      pBox(I.bell, hw.clone().add(V(0, -0.2, -0.2).multiplyScalar(s).applyQuaternion(this.Q)), this.Q, 0.1 * s, 0.13 * s, 0.07 * s);
    }
  }
}

// ------------------------------------------------------------------
// Leben am Berg: Zuschauer, Holzarbeiter, Tiere, Gleitschirme, Dohlen
// ------------------------------------------------------------------
const life = { people: [], cows: [], chamois: [], events: [], gliders: [], birds: [], flashes: [], workers: null, sounds: [] };
function spotOff(s, lat) { const pt = trailPoint(s, lat, {}); return { x: pt.x, z: pt.z, y: hAt(pt.x, pt.z), yaw: pt.yaw }; }
function addPerson(rand, pose, x, z, yaw, opts = {}) {
  const h = new Human(rand, { ...opts, props: POSE_PROPS[pose] || [] });
  const p = { h, pose, x, z, y: opts.y ?? hAt(x, z), yaw, ph: rand() * 6.28, e: 0, react: opts.react ?? true, base: opts.base };
  life.people.push(p); return p;
}
function facingTrail(s, lat) { const pt = trailPoint(s, lat, {}); return pt.yaw + (lat > 0 ? -Math.PI / 2 : Math.PI / 2); }
function crowd(rand, s, n, poses, spread = 24, sideBias = 0) {
  for (let i = 0; i < n; i++) {
    const side = sideBias || (rand() < 0.5 ? -1 : 1);
    const lat = side * (TRAIL_HALF + 2.2 + rand() * 3.5), ss = s + (rand() - 0.5) * spread;
    const pt = trailPoint(ss, lat, {});
    if (trailDistAt(pt.x, pt.z) < TRAIL_HALF + 1.6) continue;
    const pose = poses[Math.floor(rand() * poses.length)];
    addPerson(rand, pose, pt.x, pt.z, facingTrail(ss, lat) + (rand() - 0.5) * 0.5);
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
  for (const k of trail.kickers) { crowd(rand, k + 10, 5, ['cheer', 'clap', 'phone', 'cowbell', 'dab'], 16); const side = rand() < 0.5 ? -1 : 1; const pt = trailPoint(k + 14, side * (TRAIL_HALF + 2.5), {}); const p = addPerson(rand, 'photographer', pt.x, pt.z, facingTrail(k + 14, side * 3) - side * 0.7, { react: false }); p.flash = true; }
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
  // Alpendohlen
  for (let i = 0; i < 14; i++) {
    const b = { i: { body: pAlloc('sph', 0x111111), wl: pAlloc('box', 0x141414), wr: pAlloc('box', 0x141414), beak: pAlloc('box', 0xe8c020) }, cx: stationA.x + (rand() - 0.5) * 200, cz: stationA.z + (rand() - 0.5) * 200, R: 20 + rand() * 50, a: rand() * 6.28, w: (rand() < 0.5 ? 1 : -1) * (0.4 + rand() * 0.3), alt: hAt(stationA.x, stationA.z) + 25 + rand() * 40, ph: rand() * 6 };
    life.birds.push(b);
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
  const mesh = new THREE.Mesh(spruceGeo(23), treeMats.spruce); mesh.castShadow = true; mesh.receiveShadow = true; mesh.position.y = 0.45; mesh.scale.setScalar(0.85);
  pivot.add(mesh);
  const stump = new THREE.Mesh(barkCylinder(0.36, 0.32, 0.45, 10, 1), new THREE.MeshStandardMaterial({ map: TEX.bark, color: new THREE.Color(0.55, 0.4, 0.33), roughness: 0.95 }));
  stump.castShadow = true; tree.add(stump);
  grp.add(tree);
  // Arbeiter
  const side2 = V(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(side);
  const wOpts = { top: 0x2f6a3a, pants: 0x2a2a2a, hat: true, gloves: 0x3a3a3a };
  const sawPos = V(pt.x, 0, pt.z).addScaledVector(fallDir, -0.95);
  const sawyer = addPerson(rand, 'sawing', sawPos.x, sawPos.z, Math.atan2(fallDir.x, fallDir.z), { ...wOpts, react: false });
  sawyer.h.hair = null;
  const helmetCol = new THREE.Color(0xf07a12);
  PUP.sph.instanceColor.setXYZ(sawyer.h.i.hair, helmetCol.r, helmetCol.g, helmetCol.b);
  const spot = V(pt.x, 0, pt.z).addScaledVector(fallDir, -10).addScaledVector(side2, 6);
  const watcher = addPerson(rand, 'radio', spot.x, spot.z, Math.atan2(pt.x - spot.x, pt.z - spot.z), { ...wOpts, top: 0xe86a12, react: false });
  PUP.sph.instanceColor.setXYZ(watcher.h.i.hair, helmetCol.r, helmetCol.g, helmetCol.b);
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
  const pilot = new Human(rand, { top: 0x1d1f1a + Math.floor(rand() * 0x30303), pants: 0x222222, hat: true, props: POSE_PROPS.pilot });
  return { group, pilot, roll: 0, yaw: 0, pos: new THREE.Vector3(), ph: rand() * 6 };
}

// ------------------------------------------------------------------
// Aktualisierung pro Bild
// ------------------------------------------------------------------
const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _lv = new THREE.Vector3();
function updateLife(dt, t, cam, P) {
  const camX = cam.x, camZ = cam.z;
  // Zuschauer
  for (const p of life.people) {
    const dc = Math.hypot(p.x - camX, p.z - camZ);
    if (dc > 260 && p.posed) continue;
    p.posed = true;
    const dp = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);
    p.e = damp(p.e, p.react && dp < 35 ? 1 : 0, 3, dt);
    const j = POSES[p.pose](t, p.e, p.ph);
    _lq.setFromAxisAngle(_UP, p.yaw);
    _lm.compose(_lv.set(p.x, p.y, p.z), _lq, V(1, 1, 1));
    p.h.apply(j, _lm);
    if (p.flashSprite) {
      p.flashCd -= dt; p.flashT -= dt;
      if (dp < 14 && p.flashCd <= 0) { p.flashT = 0.09; p.flashCd = 0.6 + Math.random() * 0.4; if (dp < 9 && P.air && P.isPlayer) { flash('Schnappschuss!', '', 1, true); P.boost = Math.min(1, P.boost + 0.1); } }
      const camPt = j.props ? j.props[0].p.clone().multiplyScalar(p.h.scale).applyMatrix4(_lm) : _lv;
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
    if (Math.hypot(c.x - camX, c.z - camZ) > 300 && c.posed) continue;
    c.posed = true;
    const tt = t + c.ph;
    const look = Math.sin(tt * 0.13) > 0.6;
    let gait = 0, run = 0;
    if (Math.sin(tt * 0.07) > 0.85) { c.yaw += dt * 0.1; c.x += Math.sin(c.yaw) * dt * 0.5; c.z += Math.cos(c.yaw) * dt * 0.5; gait = (tt * 0.8) % 1; run = 0.1; }
    const head = look ? 0.1 : 0.9 + Math.sin(tt * 3) * 0.04;
    c.q.pose(_lv.set(c.x, hAt(c.x, c.z), c.z), c.yaw, 0, gait, run, 0, head, look ? Math.sin(tt * 0.5) * 0.6 : 0);
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
      if (Math.hypot(c.x - camX, c.z - camZ) > 300 && c.posed) continue;
      c.posed = true;
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
      c.q.pose(_lv.set(x, g + hop, z), running ? yaw : yaw + Math.sin(t * 0.4 + c.off) * 0.6, running ? -Math.cos(cyc * Math.PI) * 0.25 : 0, running ? cyc : 0, running ? 1 : 0, running ? Math.sin(cyc * Math.PI) * 0.7 : 0, running ? 0 : 0.15, running ? 0 : Math.sin(t * 0.7 + c.off) * 0.8);
    }
  }
  for (const c of life.chamois) {
    if (Math.hypot(c.x - camX, c.z - camZ) > 300 && c.posed) continue;
    c.posed = true;
    c.q.pose(_lv.set(c.x, hAt(c.x, c.z), c.z), c.yaw, 0, 0, 0, 0, Math.sin(t * 0.2 + c.ph) > 0.5 ? 0.8 : 0.1, Math.sin(t * 0.5 + c.ph) * 0.7);
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
    gl.pilot.apply(POSES.pilot(t, 0, gl.ph), _lm);
  }
  // Dohlen
  for (const b of life.birds) {
    b.a += b.w * dt;
    const x = b.cx + Math.cos(b.a) * b.R, z = b.cz + Math.sin(b.a) * b.R, y = b.alt + Math.sin(b.a * 2 + b.ph) * 4;
    const yaw = Math.atan2(-Math.sin(b.a) * b.w, Math.cos(b.a) * b.w);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, -Math.sign(b.w) * 0.4, 'YXZ'));
    const flap = Math.sin(t * 9 + b.ph) * 0.6 * (Math.sin(t * 0.7 + b.ph) > 0 ? 1 : 0.15);
    const p = V(x, y, z);
    pSph(b.i.body, p, 0.07, 0.065, 0.17, q);
    for (const [k, sd] of [['wl', 1], ['wr', -1]]) {
      const wq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), flap * sd));
      pBox(b.i[k], p.clone().add(V(sd * 0.2, 0, 0).applyQuaternion(wq)), wq, 0.36, 0.012, 0.13);
    }
    pBox(b.i.beak, p.clone().add(V(0, 0, 0.19).applyQuaternion(q)), q, 0.02, 0.02, 0.05);
  }
  pFlush();
}
