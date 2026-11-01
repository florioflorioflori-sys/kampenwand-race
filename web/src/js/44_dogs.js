// ------------------------------------------------------------------
// Hunde in der Nähe: in Blender gebautes Modell mit Skelett (assets/blender/dog.py).
// Laufen, Sitzen, Schwanzwedeln und Kopfdrehen werden pro Bild aus Knochenwinkeln gesetzt.
// Fellfarben je Rasse über Vertex-Farben, weiter weg bleiben die einfachen Hunde.
// ------------------------------------------------------------------
const DOGS = { ready: false, tpl: null, pool: [], N: 12, RANGE: 65 };
const DOG_PART = { Fur: 0, Nose: 1, Eye: 2, Collar: 3, EarFlop: 4, EarUp: 5, Tongue: 6 };
const DOG_BREEDS = [
  { fur: [0.04, 0.035, 0.032], light: [0.06, 0.05, 0.045], mid: [0.05, 0.04, 0.035], ear: 0, s: 1 },            // Labrador schwarz
  { fur: [0.74, 0.54, 0.3], light: [0.88, 0.75, 0.52], mid: [0.68, 0.48, 0.25], ear: 0, s: 1 },                   // Labrador/Golden
  { fur: [0.035, 0.03, 0.03], light: [0.92, 0.9, 0.86], mid: [0.56, 0.27, 0.1], ear: 0, s: 1.12 },              // Berner Sennen
  { fur: [0.04, 0.038, 0.038], light: [0.92, 0.91, 0.88], mid: [0.04, 0.038, 0.038], ear: 1, s: 0.9 },          // Border Collie
  { fur: [0.6, 0.4, 0.18], light: [0.7, 0.52, 0.3], mid: [0.62, 0.42, 0.2], ear: 1, s: 1.05, saddle: [0.06, 0.05, 0.04] }, // Schäferhund
  { fur: [0.38, 0.23, 0.12], light: [0.9, 0.86, 0.78], mid: [0.32, 0.19, 0.1], ear: 0, s: 0.86 },               // Mischling
  { fur: [0.9, 0.88, 0.84], light: [0.96, 0.95, 0.92], mid: [0.86, 0.84, 0.8], ear: 1, s: 0.78 },               // Spitz
];
// Fellzonen aus der Ruhelage (Blender-Koordinaten: vorne -y, oben z)
function dogZones(x, by, bz) {
  const ax = Math.abs(x);
  const paw = smooth(0.1, 0.055, bz);
  const muzzle = smooth(-0.49, -0.53, by) * smooth(0.82, 0.76, bz);
  const chest = (1 - smooth(0.045, 0.085, ax)) * smooth(0.6, 0.48, bz) * smooth(-0.42, -0.34, by) * smooth(0.0, -0.1, by);
  const tail = smooth(0.58, 0.61, by);
  const L = Math.max(paw, muzzle, chest, tail);
  const legs = smooth(0.33, 0.26, bz) * smooth(0.035, 0.06, ax) * (1 - paw);
  const cheek = smooth(-0.44, -0.47, by) * smooth(-0.56, -0.53, by) * smooth(0.82, 0.78, bz) * smooth(0.025, 0.045, ax) * (1 - muzzle * 0.6);
  const brow = Math.max(0, 1 - Math.hypot((by + 0.47) / 0.018, (bz - 0.83) / 0.012, (ax - 0.042) / 0.016));
  const Mz = Math.max(legs, cheek, brow);
  const S = smooth(0.62, 0.7, bz) * smooth(-0.32, -0.2, by) * smooth(0.36, 0.24, by);
  return [L, Mz, S];
}
async function loadDogs() {
  const bin = Uint8Array.from(atob(document.getElementById('dogData').textContent.trim()), (c) => c.charCodeAt(0));
  const g = await new GLTFLoader().parseAsync(bin.buffer, '');
  const sc = g.scene; sc.updateMatrixWorld(true);
  const parts = []; let skel = null;
  sc.traverse((o) => { if (o.isSkinnedMesh) { parts.push(o); skel = o.skeleton; } });
  const geos = parts.map((o) => {
    const gg = floatGeo(o.geometry, ['position', 'normal', 'skinIndex', 'skinWeight']), n = gg.attributes.position.count;
    gg.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(DOG_PART[o.material.name.replace(/\.\d+$/, '')] ?? 0), 1));
    return gg;
  });
  const geo = mergeGeometries(geos, false);
  // Zonen je Vertex vorberechnen
  const pos = geo.attributes.position, part = geo.attributes.aPart, n = pos.count, Z = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const pt = part.getX(i);
    if (pt === 0 || pt === 4 || pt === 5) Z.set(dogZones(pos.getX(i), -pos.getZ(i), pos.getY(i)), i * 3);
  }
  const m0 = parts[0], body = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial());
  body.name = 'dogBody'; m0.parent.add(body); body.bind(m0.skeleton, m0.bindMatrix);
  for (const o of parts) o.parent.remove(o);
  sc.updateMatrixWorld(true);
  const rest = {};
  for (const b of skel.bones) {
    const q = new THREE.Quaternion(); b.getWorldQuaternion(q);
    const qi = q.clone().invert();
    rest[b.name] = { lq: b.quaternion.clone(), lp: b.position.clone(), ax: V(1, 0, 0).applyQuaternion(qi), ay: V(0, 1, 0).applyQuaternion(qi) };
  }
  DOGS.tpl = { scene: sc, rest, zones: Z, part };
  const grp = new THREE.Group();
  for (let i = 0; i < DOGS.N; i++) {
    const holder = cloneSkinned(sc), bones = {}; let mesh = null;
    holder.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.name === 'dogBody') mesh = o; });
    // eigene Farben je Hund, Rest der Geometrie geteilt
    const gq = new THREE.BufferGeometry();
    for (const k in geo.attributes) gq.setAttribute(k, geo.attributes[k]);
    gq.setIndex(geo.index); gq.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    gq.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 1.2);
    const u = { uEar: { value: 0 } };
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.82, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0.5, 0.48, 0.44), envMapIntensity: 0.4 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uEar = u.uEar;
      sh.vertexShader = 'attribute float aPart; uniform float uEar; varying float vPart; varying vec3 vDP;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vPart = aPart; vDP = position;
        if ((aPart > 3.5 && aPart < 4.5 && uEar > 0.5) || (aPart > 4.5 && aPart < 5.5 && uEar < 0.5)) transformed = vec3(0.0);`);
      sh.fragmentShader = 'varying float vPart; varying vec3 vDP;\n' + GLSL_NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        if (vPart < 0.5 || (vPart > 3.5 && vPart < 5.5)) {
          // Fell: feine Strähnen entlang des Körpers, dunklere Unterwolle
          float st = vnoise(vec2(vDP.x * 140.0 + vDP.y * 30.0, vDP.z * 22.0)) * vnoise(vec2(vDP.y * 90.0, vDP.z * 160.0 + vDP.x * 50.0));
          diffuseColor.rgb *= 0.78 + 0.45 * st + 0.08 * vnoise(vDP.xz * 40.0);
        }`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        if (vPart > 0.5 && vPart < 2.5) roughnessFactor = 0.25; if (vPart > 5.5) roughnessFactor = 0.4;`).replace('#include <lights_fragment_begin>', `
        if (vPart > 0.5 && vPart < 3.5 || vPart > 5.5) material.sheenColor = vec3(0.0);
        #include <lights_fragment_begin>`);
    };
    mat.customProgramCacheKey = () => 'dogfur';
    mesh.geometry = gq; mesh.material = mat; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    holder.visible = false; grp.add(holder);
    DOGS.pool.push({ holder, bones, mesh, u, dog: null });
  }
  DOGS.ready = true;
  return grp;
}
// Farben einer Rasse in die Vertex-Farben schreiben
const _dc = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
function dogColorize(e, d) {
  const br = DOG_BREEDS[d.breed], Z = DOGS.tpl.zones, part = DOGS.tpl.part, col = e.mesh.geometry.attributes.color, a = col.array;
  const f = _dc[0].setRGB(...br.fur, THREE.SRGBColorSpace), l = _dc[1].setRGB(...br.light, THREE.SRGBColorSpace), m = _dc[2].setRGB(...br.mid, THREE.SRGBColorSpace);
  const s = br.saddle ? _dc[3].setRGB(...br.saddle, THREE.SRGBColorSpace) : null;
  const fixed = [null, [0.012, 0.01, 0.01], [0.02, 0.012, 0.008], null, null, null, [0.6, 0.18, 0.2]];
  const cc = d.collar || [0.6, 0.05, 0.05];
  for (let i = 0; i < part.count; i++) {
    const p = part.getX(i);
    let r, g, b;
    if (p === 3) { r = cc[0]; g = cc[1]; b = cc[2]; }
    else if (fixed[p]) [r, g, b] = fixed[p];
    else {
      const L = Z[i * 3], M = Z[i * 3 + 1], S = s ? Z[i * 3 + 2] : 0;
      r = f.r; g = f.g; b = f.b;
      r += (m.r - r) * M; g += (m.g - g) * M; b += (m.b - b) * M;
      if (s) { r += (s.r - r) * S; g += (s.g - g) * S; b += (s.b - b) * S; }
      r += (l.r - r) * L; g += (l.g - g) * L; b += (l.b - b) * L;
    }
    a[i * 3] = r; a[i * 3 + 1] = g; a[i * 3 + 2] = b;
  }
  col.needsUpdate = true;
  e.u.uEar.value = br.ear;
}
function dogUpdatePool(camX, camZ) {
  if (!DOGS.ready) return;
  const near = [];
  for (const d of life.dogs) { const dd = Math.hypot(d.x - camX, d.z - camZ); if (dd < DOGS.RANGE + (d.real ? 6 : 0)) near.push([dd, d]); }
  near.sort((a, b) => a[0] - b[0]);
  const want = new Set(near.slice(0, DOGS.N).map((x) => x[1]));
  for (const e of DOGS.pool) if (e.dog && !want.has(e.dog)) { e.dog.real = null; e.dog = null; e.holder.visible = false; }
  for (const d of want) {
    if (d.real) continue;
    const e = DOGS.pool.find((q) => !q.dog); if (!e) break;
    if (d.breed === undefined) { const h = Math.floor(d.ph * 977) % 1000 / 1000; d.breed = Math.floor(h * DOG_BREEDS.length); d.collar = [[0.65, 0.05, 0.05], [0.05, 0.2, 0.6], [0.08, 0.45, 0.12], [0.8, 0.45, 0.02]][Math.floor(h * 37) % 4]; }
    e.dog = d; d.real = e; dogColorize(e, d); e.holder.visible = true;
  }
}
const _dq = new THREE.Quaternion(), _dq2 = new THREE.Quaternion();
// Knochen drehen: Ruhelage * Drehung um Körper-Querachse (x) und Hochachse (y)
function dogRot(e, name, ax, ay) {
  const b = e.bones[name], r = DOGS.tpl.rest[name]; if (!b) return;
  b.quaternion.copy(r.lq);
  if (ax) b.quaternion.multiply(_dq.setFromAxisAngle(r.ax, ax));
  if (ay) b.quaternion.multiply(_dq2.setFromAxisAngle(r.ay, ay));
}
// P: gait (0..1 Phase), move (0 steht .. 1 trabt), run (Galopp), sit (0..1), turn (Kopf), wag, tailUp, hop
function dogPose(e, d, P, x, y, z) {
  const sc = DOG_BREEDS[d.breed].s * (0.9 + (d.ph % 1) * 0.15) * 0.85;
  const ph = P.gait * Math.PI * 2, mv = P.move, run = P.run, sit = P.sit;
  const A = (0.32 + run * 0.4) * mv;
  const offs = run > 0.5 ? { fl: 0, fr: 0.12, hl: 0.5, hr: 0.62 } : { hl: 0, fl: 0.25, hr: 0.5, fr: 0.75 };
  const leg = (k, s) => {
    const o = (ph + offs[k] * Math.PI * 2), sw = Math.sin(o) * A, lift = Math.max(0, Math.cos(o)) * mv * (0.9 + run * 0.5);
    if (k[0] === 'f') {
      dogRot(e, 'fup_' + s, sw + 0.7 * sit, 0); dogRot(e, 'flo_' + s, lift * 1.1, 0); dogRot(e, 'fpaw_' + s, lift * 0.6, 0);
    } else {
      dogRot(e, 'hup_' + s, sw - 1.15 * sit, 0); dogRot(e, 'hlo_' + s, -lift * 0.7 + 1.9 * sit, 0); dogRot(e, 'hpaw_' + s, lift * 0.5 - 0.9 * sit, 0);
    }
  };
  leg('fl', 'l'); leg('fr', 'r'); leg('hl', 'l'); leg('hr', 'r');
  // Rumpf: beim Sitzen vorne hoch, beim Galopp leichtes Wiegen
  dogRot(e, 'pelvis', -0.68 * sit + Math.sin(ph * 2) * 0.04 * run * mv, 0);
  dogRot(e, 'chest', Math.sin(ph * 2 + 1) * 0.05 * run * mv, Math.sin(ph) * 0.05 * mv);
  const hd = P.headDown || 0;
  dogRot(e, 'neck', 0.25 * sit + hd * 0.5 + run * mv * 0.25, P.turn * 0.5);
  dogRot(e, 'head', hd * 0.3 - run * mv * 0.15 + Math.sin(P.t * 1.3 + d.ph) * 0.04, P.turn * 0.5);
  const wg = Math.sin(P.wag), tu = P.tailUp;
  dogRot(e, 'tail1', 0.25 + tu * 0.55 - sit * 0.6, wg * (0.35 + tu * 0.25));
  dogRot(e, 'tail2', tu * 0.2 - sit * 0.3, Math.sin(P.wag - 0.7) * (0.35 + tu * 0.2));
  dogRot(e, 'tail3', -0.1, Math.sin(P.wag - 1.4) * 0.3);
  for (const s of ['l', 'r']) dogRot(e, 'ear_' + s, run * mv * 0.5 + Math.sin(ph * 2) * 0.15 * mv, 0);
  const bob = Math.abs(Math.sin(ph * 2)) * (0.012 + run * 0.04) * mv;
  e.holder.position.set(x, y + (bob - sit * 0.17 + (P.hop || 0)) * sc, z);
  e.holder.rotation.set(0, d.yaw, 0);
  e.holder.scale.setScalar(sc);
}
