// ------------------------------------------------------------------
// Echte Figuren in der Nähe: Quaternius „Universal Base Characters" (CC0).
// Kleidung entsteht im Shader aus den Knochengewichten, bewegt werden die
// Figuren von denselben Posen wie die Kapselfiguren (Ausrichtung je Knochen).
// Weiter entfernte Zuschauer bleiben Kapselfiguren.
// ------------------------------------------------------------------
const REAL = { ready: false, pool: [], N: 32, RANGE: 60, tpl: {}, hair: {}, tex: {} };
// beim Zusammenführen bekamen die Knochen der Frau die Endung „_1"
const suffixOf = (skel) => skel.bones[0].name.slice(4);
const baseFn = (suf) => (n) => (suf && n.endsWith(suf) ? n.slice(0, -suf.length) : n);
function boneRegion(n) {
  if (n === 'Head' || n === 'neck_01' || /^(hand|index|middle|pinky|ring|thumb)/.test(n)) return 0;
  if (n.startsWith('lowerarm')) return 4;
  if (/^(spine|clavicle|upperarm)/.test(n)) return 1;
  if (/^(pelvis|thigh|calf|root)/.test(n)) return 2;
  if (/^(foot|ball)/.test(n)) return 3;
  return 0;
}
const GET = ['getX', 'getY', 'getZ', 'getW'], comp = (a, i, k) => a[GET[k]](i);
// quantisierte Attribute in Float32 umwandeln (für eigene Transformationen)
function floatGeo(g, names) {
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const a = g.attributes[n]; if (!a) continue;
    const arr = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) arr[i * a.itemSize + k] = comp(a, i, k);
    out.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize));
  }
  out.setIndex(g.index ? Array.from(g.index.array) : null);
  return out;
}
function bodyMaterial(skinTex) {
  const u = { uTop: { value: new THREE.Color() }, uPants: { value: new THREE.Color() }, uShoe: { value: new THREE.Color() }, uSleeve: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) } };
  const m = new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.78, envMapIntensity: 0.45 });
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute float aRegion;\nuniform float uSleeve;\nvarying float vRegion;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vRegion = aRegion;
      float infl = aRegion > 3.5 ? 0.016 * uSleeve : aRegion > 2.5 ? 0.014 : aRegion > 1.5 ? 0.014 : aRegion > 0.5 ? 0.03 : 0.0;
      transformed += normalize(objectNormal) * infl;`);
    sh.fragmentShader = 'uniform vec3 uTop; uniform vec3 uPants; uniform vec3 uShoe; uniform float uSleeve; uniform vec3 uTint;\nvarying float vRegion;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        float r = vRegion;
        if (r > 3.5) r = uSleeve > 0.5 ? 1.0 : 0.0;
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        if (r > 0.5) {
          vec3 c = r < 1.5 ? uTop : r < 2.5 ? uPants : uShoe;
          // Muskelzeichnung der Haut nur schwach durchscheinen lassen, damit es nach Stoff aussieht
          diffuseColor.rgb = c * mix(1.0, clamp(lum / 0.42, 0.7, 1.2), r < 1.5 ? 0.22 : 0.4);
        } else diffuseColor.rgb *= uTint;
      }`);
  };
  m.customProgramCacheKey = () => 'realBody';
  return m;
}
function hairMaterial(tex) {
  const u = { uHair: { value: new THREE.Color() } };
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, envMapIntensity: 0.4, side: THREE.DoubleSide });
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = 'uniform vec3 uHair;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb = uHair * clamp(dot(diffuseColor.rgb, vec3(0.333)) / 0.3, 0.4, 1.6);`);
  };
  m.customProgramCacheKey = () => 'realHair';
  return m;
}

async function loadRealPeople() {
  const b64 = document.getElementById('peopleData').textContent.trim();
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bin.buffer, '');
  const texSrc = JSON.parse(document.getElementById('peopleTex').textContent);
  const tl = new THREE.TextureLoader();
  for (const [k, url] of Object.entries(texSrc)) {
    const t = await tl.loadAsync(url); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; REAL.tex[k] = t;
  }
  const byName = {}; for (const sc of gltf.scenes) byName[sc.name] = sc;
  // Frisuren: alle Gewichte liegen auf dem Kopfknochen -> als feste Geometrie im Kopfsystem
  for (const name of ['Hair_SimpleParted', 'Hair_Long', 'Hair_Buns', 'Hair_Buzzed', 'Hair_Beard']) {
    const sc = byName[name]; if (!sc) continue;
    sc.updateMatrixWorld(true);
    let sm = null; sc.traverse((o) => { if (o.isSkinnedMesh) sm = o; });
    if (!sm) continue;
    const hi = sm.skeleton.bones.findIndex((b) => b.name.startsWith('Head'));
    const g = floatGeo(sm.geometry, ['position', 'normal', 'uv']);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(sm.skeleton.boneInverses[hi], sm.bindMatrix));
    REAL.hair[name] = g;
  }
  for (const sex of ['M', 'F']) {
    const sc = byName[sex];
    sc.updateMatrixWorld(true);
    let body = null, skel = null;
    sc.traverse((o) => { if (o.isSkinnedMesh && /Superhero|SuperHero/.test(o.name)) { body = o; skel = o.skeleton; } });
    // Kleidungsregion je Vertex aus dem stärksten Knochen
    const suf = suffixOf(skel), BASE = baseFn(suf);
    const si = body.geometry.attributes.skinIndex, sw = body.geometry.attributes.skinWeight;
    const reg = new Float32Array(si.count);
    for (let i = 0; i < si.count; i++) {
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = comp(sw, i, k); if (w > bw) { bw = w; best = comp(si, i, k); } }
      reg[i] = boneRegion(BASE(skel.bones[best].name));
    }
    body.geometry.setAttribute('aRegion', new THREE.BufferAttribute(reg, 1));
    // Ruhelage der Knochen im Modellraum
    const rest = {};
    for (const b of skel.bones) {
      const m = b.matrixWorld.clone(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      m.decompose(p, q, s);
      rest[BASE(b.name)] = { p, q, M: m, lq: b.quaternion.clone(), lp: b.position.clone() };
    }
    REAL.tpl[sex] = { scene: sc, rest, BASE, pelvisY: rest.pelvis.p.y, footY: rest.foot_l.p.y };
  }
  // Pool aus geklonten Figuren
  const mats = { eyes: new THREE.MeshStandardMaterial({ map: REAL.tex.eye, roughness: 0.3 }), brow: new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.9 }) };
  const grp = new THREE.Group();
  for (let i = 0; i < REAL.N; i++) {
    const sex = i % 2 ? 'F' : 'M', tpl = REAL.tpl[sex];
    const holder = cloneSkinned(tpl.scene);
    const bones = {}; let body = null;
    holder.traverse((o) => {
      if (o.isBone) bones[tpl.BASE(o.name)] = o;
      if (o.isSkinnedMesh) {
        o.frustumCulled = false; o.castShadow = true; o.receiveShadow = true;
        if (/Superhero|SuperHero/.test(o.name)) { body = o; o.material = bodyMaterial(REAL.tex[sex === 'M' ? 'male_light' : 'female_light']); }
        else if (/Eyes/.test(o.name)) o.material = mats.eyes;
        else o.material = mats.brow;
      }
    });
    const hairMat = hairMaterial(REAL.tex[sex === 'M' ? 'hair1' : 'hair2']);
    const hairs = {};
    for (const [name, g] of Object.entries(REAL.hair)) {
      const h = new THREE.Mesh(g, hairMat); h.castShadow = true; h.visible = false;
      if (sex === 'F') h.scale.setScalar(0.96);
      bones.Head.add(h); hairs[name] = h;
    }
    holder.visible = false;
    grp.add(holder);
    REAL.pool.push({ sex, holder, bones, body, hairs, hairMat, person: null, rest: tpl.rest, tpl });
  }
  REAL.ready = true;
  return grp;
}

// Figur auf eine Person einstellen (Haut, Kleidung, Frisur)
function realAssign(e, p) {
  const h = p.h;
  e.person = p; p.real = e;
  const u = e.body.material.userData.u;
  u.uTop.value.copy(h.top); u.uPants.value.copy(h.pants); u.uShoe.value.copy(h.shoe); u.uSleeve.value = h.short ? 0 : 1;
  const dark = h.skin.r < 0.55;
  e.body.material.map = REAL.tex[(e.sex === 'M' ? 'male_' : 'female_') + (dark ? 'dark' : 'light')];
  const lum = h.skin.r * 0.6 + h.skin.g * 0.4;
  u.uTint.value.setScalar(dark ? clamp(lum / 0.45, 0.8, 1.15) : clamp(lum / 0.82, 0.85, 1.1));
  e.hairMat.userData.u.uHair.value.copy(h.hairCol);
  for (const k in e.hairs) e.hairs[k].visible = false;
  const st = h.hairStyle, hat = h.hat;
  let hair = null;
  if (e.sex === 'M') hair = hat ? (hat === 'helmet' ? null : 'Hair_Buzzed') : st === 'bald' ? null : st === 'long' ? 'Hair_SimpleParted' : (h.pompom ? 'Hair_Buzzed' : 'Hair_SimpleParted');
  else hair = hat ? (hat === 'helmet' ? null : 'Hair_Long') : st === 'pony' || st === 'short' ? 'Hair_Buns' : 'Hair_Long';
  if (hair && e.hairs[hair]) e.hairs[hair].visible = true;
  if (e.sex === 'M' && h.beard && e.hairs.Hair_Beard) e.hairs.Hair_Beard.visible = true;
  e.holder.scale.setScalar(h.kid ? 0.66 : (e.sex === 'M' ? 0.97 : 0.98) * (h.scale / 0.99));
  e.holder.visible = true;
}
function realRelease(e) { if (e.person) e.person.real = null; e.person = null; e.holder.visible = false; }

// Ausrichtung: dreht die Ruhe-Basis (d0, s0) eines Knochens auf die Ziel-Basis (d, s)
const _rm0 = new THREE.Matrix4(), _rm1 = new THREE.Matrix4(), _rq = new THREE.Quaternion(), _rx = new THREE.Vector3(), _rz = new THREE.Vector3(), _ry = new THREE.Vector3();
function frameQuat(d0, s0, d, s, out) {
  const basis = (dd, ss, m) => {
    _ry.copy(dd).normalize();
    _rx.copy(ss).addScaledVector(_ry, -ss.dot(_ry));
    if (_rx.lengthSq() < 1e-8) _rx.set(1, 0, 0).addScaledVector(_ry, -_ry.x);
    _rx.normalize(); _rz.crossVectors(_rx, _ry);
    return m.makeBasis(_rx, _ry, _rz);
  };
  basis(d0, s0, _rm0); basis(d, s, _rm1);
  return out.setFromRotationMatrix(_rm1.multiply(_rm0.transpose()));
}
const REST_DIR = {
  pelvis: ['spine_02', [1, 0, 0]], spine_01: ['spine_02', [1, 0, 0]], spine_02: ['spine_03', [1, 0, 0]], spine_03: ['neck_01', [1, 0, 0]], neck_01: ['Head', [1, 0, 0]],
  upperarm_l: ['lowerarm_l', [0, -1, 0]], lowerarm_l: ['hand_l', [0, -1, 0]], hand_l: ['middle_01_l', [0, -1, 0]],
  upperarm_r: ['lowerarm_r', [0, 1, 0]], lowerarm_r: ['hand_r', [0, 1, 0]], hand_r: ['middle_01_r', [0, 1, 0]],
  thigh_l: ['calf_l', [1, 0, 0]], calf_l: ['foot_l', [1, 0, 0]], thigh_r: ['calf_r', [1, 0, 0]], calf_r: ['foot_r', [1, 0, 0]],
};
const _rv = Array.from({ length: 24 }, () => new THREE.Vector3());
const _mq = {}, _tq = new THREE.Quaternion(), _iq = new THREE.Quaternion();
// Pose j (lokale Gelenke, wie bei den Kapselfiguren) auf das Skelett übertragen
function realPose(e, j, yaw, pos, lookYaw) {
  const R = e.rest, B = e.bones, v = _rv, k = e.tpl.pelvisY / 0.98;
  const fwd = v[0].set(0, 0, 1), up = v[1].set(0, 1, 0);
  const sub = (a, b, o) => o.subVectors(a, b).normalize();
  const up1 = sub(j.chest, j.pelvis, v[2]), up2 = sub(j.neck, j.chest, v[3]);
  const right = sub(j.shL, j.shR, v[4]), hipR = sub(j.hpL, j.hpR, v[5]);
  const tgt = {};
  tgt.pelvis = [up1, hipR];
  tgt.spine_01 = [up1, v[6].copy(hipR).lerp(right, 0.4)];
  tgt.spine_02 = [v[7].addVectors(up1, up2).normalize(), right];
  tgt.spine_03 = [up2, right];
  tgt.neck_01 = [sub(j.head, j.neck, v[8]), right];
  // Arme und Beine: Beugeachse aus den beiden Segmenten, sonst aus der Blickrichtung
  const limb = (a, b, c, fb, iD, iS) => {
    const d1 = sub(b, a, v[iD]), d2 = sub(c, b, v[iD + 1]);
    const s = v[iS].crossVectors(d1, d2), f = _rx.crossVectors(d1, fb);
    if (f.lengthSq() < 0.01) f.crossVectors(d1, up);
    s.addScaledVector(f.normalize(), 0.15);
    return [d1, d2, s];
  };
  const back = v[9].set(0, 0, -1);
  const [uaL, faL, sL] = limb(j.shL, j.elL, j.haL, fwd, 10, 12);
  const [uaR, faR, sR] = limb(j.shR, j.elR, j.haR, fwd, 13, 15);
  const [thL, shL, kL] = limb(j.hpL, j.knL, j.ftL, back, 16, 18);
  const [thR, shR, kR] = limb(j.hpR, j.knR, j.ftR, back, 19, 21);
  tgt.upperarm_l = [uaL, sL]; tgt.lowerarm_l = [faL, sL]; tgt.hand_l = [faL, sL];
  tgt.upperarm_r = [uaR, sR]; tgt.lowerarm_r = [faR, sR]; tgt.hand_r = [faR, sR];
  tgt.thigh_l = [thL, kL]; tgt.calf_l = [shL, kL]; tgt.thigh_r = [thR, kR]; tgt.calf_r = [shR, kR];
  // Kopf: Ruhe-Basis (oben, rechts) auf die Kopfdrehung der Pose
  const hq = _iq.identity(); if (j.headQ) hq.copy(j.headQ);
  if (lookYaw) hq.premultiply(_tq.setFromAxisAngle(up, lookYaw));
  // Reihenfolge Eltern vor Kindern
  const order = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'];
  const parentOf = { pelvis: 'root', spine_01: 'pelvis', spine_02: 'spine_01', spine_03: 'spine_02', neck_01: 'spine_03', Head: 'neck_01', clavicle_l: 'spine_03', upperarm_l: 'clavicle_l', lowerarm_l: 'upperarm_l', hand_l: 'lowerarm_l', clavicle_r: 'spine_03', upperarm_r: 'clavicle_r', lowerarm_r: 'upperarm_r', hand_r: 'lowerarm_r', thigh_l: 'pelvis', calf_l: 'thigh_l', foot_l: 'calf_l', thigh_r: 'pelvis', calf_r: 'thigh_r', foot_r: 'calf_r' };
  (_mq.root || (_mq.root = new THREE.Quaternion())).copy(R.root.q);
  for (const n of order) {
    const r = R[n], bone = B[n]; if (!r || !bone) continue;
    const pq = _mq[parentOf[n]];
    const mq = _mq[n] || (_mq[n] = new THREE.Quaternion());
    const t = tgt[n];
    if (t) {
      const rd = REST_DIR[n], d0 = _rx.subVectors(R[rd[0]].p, r.p).normalize().clone(), s0 = new THREE.Vector3(...rd[1]);
      frameQuat(d0, s0, t[0], t[1], mq).multiply(r.q);
    } else if (n === 'Head') {
      // Kopf folgt der Halsrichtung plus Kopfdrehung
      mq.copy(_mq.neck_01).multiply(_tq.copy(R.neck_01.q).invert()).multiply(r.q);
      mq.premultiply(hq);
    } else if (n === 'foot_l' || n === 'foot_r') {
      mq.copy(r.q); if (j.footQ) mq.premultiply(j.footQ);
    } else mq.copy(pq).multiply(r.lq);
    bone.quaternion.copy(_tq.copy(pq).invert().multiply(mq));
  }
  // Becken an die Pose setzen, danach Füße auf den Boden
  const holder = e.holder;
  holder.position.copy(pos); holder.rotation.set(0, yaw, 0);
  const rootInv = _rm0.copy(R.root.M).invert();
  const pp = v[22].copy(j.pelvis).multiplyScalar(k).applyMatrix4(rootInv);
  B.pelvis.position.copy(pp);
  holder.updateMatrixWorld(true);
  const minFt = Math.min(j.ftL.y, j.ftR.y);
  if (minFt < 0.3) {
    const inv = _rm1.copy(holder.matrixWorld).invert();
    const fl = v[23].setFromMatrixPosition(B.foot_l.matrixWorld).applyMatrix4(inv).y, fr = _rx.setFromMatrixPosition(B.foot_r.matrixWorld).applyMatrix4(inv).y;
    const want = minFt * k + e.tpl.footY - 0.08 * k;
    const shift = want - Math.min(fl, fr);
    v[22].copy(j.pelvis).multiplyScalar(k); v[22].y += shift;
    B.pelvis.position.copy(v[22].applyMatrix4(rootInv));
    holder.updateMatrixWorld(true);
  }
}
// Kopfmitte und -achsen in Weltkoordinaten (für Mützen und Brillen)
function realHead(e, out) {
  const m = e.bones.Head.matrixWorld, s = e.holder.scale.x;
  const H = out.H.setFromMatrixPosition(m);
  const q = _tq.setFromRotationMatrix(_rm0.extractRotation(m)).multiply(_iq.copy(e.rest.Head.q).invert());
  out.hU.set(0, 1, 0).applyQuaternion(q); out.hF.set(0, 0, 1).applyQuaternion(q); out.hR.set(1, 0, 0).applyQuaternion(q);
  H.addScaledVector(out.hU, (e.sex === 'M' ? 0.1 : 0.095) * s).addScaledVector(out.hF, 0.012 * s);
  return out;
}
function realHand(e, side, out) {
  const h = e.bones['hand_' + side], m = e.bones['middle_01_' + side];
  return out.setFromMatrixPosition(h.matrixWorld).lerp(_rx.setFromMatrixPosition(m.matrixWorld), 0.7);
}
