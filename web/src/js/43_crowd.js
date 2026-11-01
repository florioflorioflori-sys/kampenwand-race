// ------------------------------------------------------------------
// Zuschauermassen: dieselben Blender-Figuren, je Pose zweimal fertig gestellt
// (zwei Schlüsselbilder) und als Instanzen gezeichnet. Der Shader blendet
// zwischen den Schlüsselbildern, so jubeln, klatschen und winken auch
// Tausende Leute gleichzeitig. Die nächsten Leute bleiben voll animiert
// (Pool in 42_people.js).
// ------------------------------------------------------------------
const CROWD = { ready: false, poses: ['stand', 'hips', 'cheer', 'clap', 'phone', 'film', 'cowbell', 'flag', 'drink', 'sit'], bake: {}, groups: [], list: [] };
const CROWD_E = { cheer: 1, clap: 1, cowbell: 1, flag: 1 };
const CROWD_SPD = { stand: 0.9, hips: 0.4, cheer: 10, clap: 10, phone: 0.7, film: 0.5, cowbell: 8, flag: 3.5, drink: 0.6, sit: 0.5 };
const CROWD_LOD0 = 90, CROWD_FAR = 900;
// zwei möglichst verschiedene Momente der Pose
function crowdFrames(pose) {
  const e = CROWD_E[pose] || 0, keys = ['haL', 'haR', 'ftL', 'ftR', 'pelvis', 'head'];
  const ja = POSES[pose](0, e, 0);
  let best = -1, tb = 0;
  for (let t = 0.05; t < 4; t += 0.05) {
    const j = POSES[pose](t, e, 0); let d = 0;
    for (const k of keys) d += j[k].distanceTo(ja[k]);
    if (d > best) { best = d; tb = t; }
  }
  const jb = POSES[pose](tb, e, 0);
  fillJoints(ja); fillJoints(jb);
  return [ja, jb];
}
// Pose auf das Skelett, dann jeden Vertex per Skinning in den Figurraum
function crowdBakeMesh(e, mesh, frames) {
  const g = mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal, n = pos.count;
  const out = [], hands = [], v = new THREE.Vector3(), w = new THREE.Vector3(), nn = new THREE.Vector3();
  for (const j of frames) {
    realPose(e, j, 0, new THREE.Vector3(), 0);
    const M = mesh.matrixWorld, P = new Float32Array(n * 3), N = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i); nn.fromBufferAttribute(nrm, i);
      w.copy(v).addScaledVector(nn, 0.02);
      mesh.applyBoneTransform(i, v).applyMatrix4(M); mesh.applyBoneTransform(i, w).applyMatrix4(M);
      w.sub(v).normalize();
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; N[i * 3] = w.x; N[i * 3 + 1] = w.y; N[i * 3 + 2] = w.z;
    }
    out.push([P, N]);
    hands.push([realHand(e, 'l', new THREE.Vector3()), realHand(e, 'r', new THREE.Vector3())]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(g.index);
  geo.setAttribute('position', new THREE.BufferAttribute(out[0][0], 3)); geo.setAttribute('normal', new THREE.BufferAttribute(out[0][1], 3));
  geo.setAttribute('aPos2', new THREE.BufferAttribute(out[1][0], 3)); geo.setAttribute('aNrm2', new THREE.BufferAttribute(out[1][1], 3));
  for (const k of ['aSlot', 'aBit', 'color']) geo.setAttribute(k, g.attributes[k]);
  return { geo, hands };
}
function buildCrowd() {
  const grp = new THREE.Group();
  // wer in die Massen kommt: Leute in einfachen Posen
  const want = {};
  for (const p of life.people) {
    if (p.noReal || p.flash || !CROWD.poses.includes(p.pose)) continue;
    const k = p.h.sex + p.pose; want[k] = (want[k] || 0) + 1;
    CROWD.list.push(p);
  }
  const mats = [specMaterials(true, true), specMaterials(true, true)];
  for (const sex of ['M', 'F']) {
    const tpl = REAL.tpl[sex], holder = cloneSkinned(tpl.scene), bones = {}, mesh = [];
    holder.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.name === 'spec0') mesh[0] = o; if (o.name === 'spec1') mesh[1] = o; });
    const e = { holder, bones, rest: tpl.rest, tpl, sex };
    for (const pose of CROWD.poses) {
      const cap = want[sex + pose]; if (!cap) continue;
      const frames = crowdFrames(pose), B = { frames, lods: [], hands: null, jw: crowdScratch(frames[0]) };
      for (let l = 0; l < 2; l++) {
        const src = mesh[l] || mesh[0], { geo, hands } = crowdBakeMesh(e, src, frames);
        if (l === 0) B.hands = hands;
        const im = new THREE.InstancedMesh(geo, mats[l].m, cap);
        im.customDepthMaterial = mats[l].d;
        for (const [k, n] of [['iCol0', 4], ['iCol1', 4], ['iCol2', 4], ['iInfo', 4]]) {
          const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a);
        }
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.count = 0; im.frustumCulled = false; im.castShadow = l === 0; im.receiveShadow = true;
        grp.add(im); CROWD.groups.push(im); B.lods.push(im);
      }
      CROWD.bake[sex + pose] = B;
    }
  }
  // feste Daten je Person
  const q = new THREE.Quaternion(), m = new THREE.Matrix4(), sv = new THREE.Vector3();
  for (const p of CROWD.list) {
    const sc = specScale(p.h, p.h.sex);
    q.setFromAxisAngle(_UP, p.yaw);
    m.compose(new THREE.Vector3(p.x, p.y, p.z), q, sv.setScalar(sc));
    const cols = specColors(p.h, new Float32Array(16));
    cols[12] = specMask(p.h); cols[13] = p.ph; cols[14] = CROWD_SPD[p.pose] * (0.85 + (p.ph % 1) * 0.3); cols[15] = 0;
    p.cr = { B: CROWD.bake[p.h.sex + p.pose], M: m.toArray(new Float32Array(16)), c: cols, sc, r: p.pose === 'flag' ? 2.8 : 1.6 };
  }
  CROWD.ready = true;
  return grp;
}
// Arbeitskopie einer Pose für die Requisiten (Fahne, Handy, Glocke …)
function crowdScratch(j) {
  const o = { haL: j.haL.clone(), haR: j.haR.clone() };
  if (j.props) o.props = j.props.map((pp) => ({ ...pp, a: pp.a.clone(), b: (pp.b || pp.a).clone() }));
  return o;
}
const _cfr = new THREE.Frustum(), _cpm = new THREE.Matrix4(), _csp = new THREE.Sphere(), _csL = new THREE.Vector3(), _csR = new THREE.Vector3(), _cq = new THREE.Quaternion();
function updateCrowd(cam) {
  if (!CROWD.ready) return;
  camera.updateMatrixWorld();
  _cfr.setFromProjectionMatrix(_cpm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  for (const g of CROWD.groups) g.count = 0;
  const far2 = CROWD_FAR * CROWD_FAR, l02 = CROWD_LOD0 * CROWD_LOD0;
  for (const p of CROWD.list) {
    if (p.real) continue;
    const dx = p.x - cam.x, dz = p.z - cam.z, d2 = dx * dx + dz * dz;
    if (d2 > far2) continue;
    _csp.center.set(p.x, p.y + 1, p.z); _csp.radius = p.cr.r;
    if (!_cfr.intersectsSphere(_csp)) continue;
    const im = p.cr.B.lods[d2 < l02 ? 0 : 1], i = im.count++, a = im.geometry.attributes, c = p.cr.c;
    im.instanceMatrix.array.set(p.cr.M, i * 16);
    a.iCol0.array.set(c.subarray(0, 4), i * 4); a.iCol1.array.set(c.subarray(4, 8), i * 4); a.iCol2.array.set(c.subarray(8, 12), i * 4); a.iInfo.array.set(c.subarray(12, 16), i * 4);
  }
  for (const g of CROWD.groups) {
    if (!g.count) continue;
    const up = (attr) => { attr.clearUpdateRanges(); attr.addUpdateRange(0, g.count * attr.itemSize); attr.needsUpdate = true; };
    up(g.instanceMatrix); const a = g.geometry.attributes; up(a.iCol0); up(a.iCol1); up(a.iCol2); up(a.iInfo);
  }
}
// Requisiten der Massen-Leute passend zum Schlüsselbild-Mix
function crowdProps(p, t, M) {
  const B = p.cr.B, [ja, jb] = B.frames, jw = B.jw, c = p.cr.c;
  if (!jw.props) return;
  const w = 0.5 + 0.5 * Math.sin(t * c[14] + c[13]);
  jw.haL.lerpVectors(ja.haL, jb.haL, w); jw.haR.lerpVectors(ja.haR, jb.haR, w);
  jw.props.forEach((pp, k) => { const A = ja.props[k], Bq = jb.props[k]; pp.a.lerpVectors(A.a, Bq.a, w); pp.b.lerpVectors(A.b || A.a, Bq.b || Bq.a, w); });
  const s = p.h.scale, sc = p.cr.sc, H = B.hands;
  _cq.setFromAxisAngle(_UP, p.yaw);
  _csL.lerpVectors(H[0][0], H[1][0], w).multiplyScalar(sc).addScaledVector(jw.haL, -s).applyQuaternion(_cq);
  _csR.lerpVectors(H[0][1], H[1][1], w).multiplyScalar(sc).addScaledVector(jw.haR, -s).applyQuaternion(_cq);
  p.h.Q.copy(_cq);
  p.h.drawProps(jw, M, _csL, _csR);
}
