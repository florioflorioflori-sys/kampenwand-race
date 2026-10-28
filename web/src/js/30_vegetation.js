
// ------------------------------------------------------------------
// Hindernisse (Bäume, Felsen, Stämme) für die Kollision
// ------------------------------------------------------------------
const obstacles = new Map(); // Raster 8 m -> [x,z,r]
function addObstacle(x, z, r) {
  const key = (Math.floor(x / 8) + 1000) * 4096 + (Math.floor(z / 8) + 1000);
  let a = obstacles.get(key); if (!a) obstacles.set(key, a = []); a.push(x, z, r);
}
function hitObstacle(x, z, rad) {
  const ix = Math.floor(x / 8), iz = Math.floor(z / 8);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const arr = obstacles.get((ix + a + 1000) * 4096 + (iz + b + 1000)); if (!arr) continue;
    for (let k = 0; k < arr.length; k += 3) { const dx = x - arr[k], dz = z - arr[k + 1], rr = arr[k + 2] + rad; if (dx * dx + dz * dz < rr * rr) return [arr[k], arr[k + 1], arr[k + 2]]; }
  }
  return null;
}

// ------------------------------------------------------------------
// Baum-Geometrie aus Zweig- und Laubkarten
// ------------------------------------------------------------------
class CardBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; }
  quad(p0, p1, p2, p3, nf, uvs = [[0, 0], [0, 1], [1, 1], [1, 0]]) {
    const b = this.pos.length / 3;
    for (const [p, t] of [[p0, uvs[0]], [p1, uvs[1]], [p2, uvs[2]], [p3, uvs[3]]]) {
      this.pos.push(p.x, p.y, p.z); const n = nf(p); this.nor.push(n.x, n.y, n.z); this.uv.push(t[0], t[1]);
    }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx); return g;
  }
}
function barkCylinder(r0, r1, len, seg, repeatV) {
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 3, true).translate(0, len / 2, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * repeatV);
  return g;
}
function orientGeo(g, a, b) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z);
  return g;
}
function spruceGeo(seed = 5) {
  const r = mulberry32(seed);
  const trunk = barkCylinder(0.36, 0.06, 20, 8, 5);
  const cb = new CardBuilder();
  const W = 19;
  for (let w = 0; w < W; w++) {
    const t = w / (W - 1), y = 1.7 + t * 17.4;
    const R = 0.35 + 3.5 * Math.pow(1 - t, 0.95);
    const nb = t > 0.85 ? 4 : t > 0.5 ? 6 : 7;
    for (let b = 0; b < nb; b++) {
      const ang = b / nb * Math.PI * 2 + w * 2.39 + r() * 0.35;
      const droop = -(0.12 + 0.5 * (1 - t)) + (r() - 0.5) * 0.15;
      const dir = V(Math.cos(ang) * Math.cos(droop), Math.sin(droop), Math.sin(ang) * Math.cos(droop));
      const side = V(-Math.sin(ang), 0, Math.cos(ang));
      const up = new THREE.Vector3().crossVectors(side, dir).normalize();
      const len = R * (0.8 + r() * 0.35), wd = len * 0.95;
      const base = V(0, y, 0).addScaledVector(dir, 0.08);
      const tip = base.clone().addScaledVector(dir, len); tip.y -= len * 0.1;
      const nf = (p) => V(p.x, (p.y - y) * 0.4 + len * 0.55, p.z).normalize();
      cb.quad(base.clone().addScaledVector(side, -wd / 2), base.clone().addScaledVector(side, wd / 2), tip.clone().addScaledVector(side, wd / 2), tip.clone().addScaledVector(side, -wd / 2), nf);
      const w2 = wd * 0.5;
      cb.quad(base.clone().addScaledVector(up, -w2 / 2), base.clone().addScaledVector(up, w2 / 2), tip.clone().addScaledVector(up, w2 / 2), tip.clone().addScaledVector(up, -w2 / 2), nf);
    }
  }
  for (const a of [0, Math.PI / 2]) {
    const s = V(Math.cos(a), 0, Math.sin(a)), nf = (p) => V(p.x, 1, p.z).normalize();
    cb.quad(V(0, 18.2, 0).addScaledVector(s, -0.55), V(0, 18.2, 0).addScaledVector(s, 0.55), V(0, 20.6, 0).addScaledVector(s, 0.55), V(0, 20.6, 0).addScaledVector(s, -0.55), nf, [[0, 0], [0, 1], [1, 1], [1, 0]]);
  }
  return mergeGeometries([trunk, cb.geometry()], true);
}
function beechGeo(seed = 9) {
  const r = mulberry32(seed);
  const parts = [barkCylinder(0.4, 0.2, 7.5, 9, 3)];
  const center = V(0, 11.2, 0), rad = V(4.6, 4.0, 4.6);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + r() * 0.5;
    const end = V(Math.cos(a) * 3.2, 10.5 + r() * 3, Math.sin(a) * 3.2);
    parts.push(orientGeo(barkCylinder(0.2, 0.06, V(0, 7, 0).distanceTo(end), 6, 2), V(0, 7, 0), end));
  }
  parts[0] = parts[0];
  const trunkGeo = mergeGeometries(parts);
  const cb = new CardBuilder();
  for (let i = 0; i < 80; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const dir = V(s * Math.cos(th), u * 0.9, s * Math.sin(th));
    const k = 0.5 + 0.5 * Math.pow(r(), 0.5);
    const p = center.clone().add(V(dir.x * rad.x * k, dir.y * rad.y * k, dir.z * rad.z * k));
    if (p.y < 7.5) p.y = 7.5 + r();
    const size = 2.4 + r() * 1.4;
    const a = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    const b = new THREE.Vector3().crossVectors(a, dir).normalize();
    const c = new THREE.Vector3().crossVectors(a, b).normalize();
    const nf = (q) => q.clone().sub(center).multiply(V(1, 1.3, 1)).normalize();
    for (const [e1, e2] of [[a, b], [a, c]]) {
      const h1 = e1.clone().multiplyScalar(size / 2), h2 = e2.clone().multiplyScalar(size / 2);
      cb.quad(p.clone().sub(h1).sub(h2), p.clone().sub(h1).add(h2), p.clone().add(h1).add(h2), p.clone().add(h1).sub(h2), nf);
    }
  }
  return mergeGeometries([trunkGeo, cb.geometry()], true);
}

// Materialien
const TEX = {};
function windify(mat, strength) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float hh = max(0.0, position.y - 1.5);
        #ifdef USE_INSTANCING
          vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 ip = vec2(0.0);
        #endif
        float ph = ip.x * 0.07 + ip.y * 0.05;
        float g = sin(uTime * 0.7 + ph * 0.3) * 0.5 + 0.7;
        transformed.x += sin(uTime * 1.3 + ph + position.y * 0.2 + position.z) * ${strength.toFixed(3)} * hh * hh * 0.01 * g;
        transformed.z += cos(uTime * 1.1 + ph + position.x) * ${(strength * 0.7).toFixed(3)} * hh * hh * 0.01 * g;
      }`);
  };
  mat.customProgramCacheKey = () => 'wind' + strength;
  return mat;
}
function noInstanceColor(mat) {
  mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', '#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\n vColor = vec3( 1.0 );\n#endif'); };
  mat.customProgramCacheKey = () => 'noic';
  return mat;
}
function treeMaterials() {
  TEX.needle = spruceBranchTex(); TEX.leaf = leafClusterTex(); TEX.bark = barkTex();
  return {
    spruce: [
      noInstanceColor(new THREE.MeshStandardMaterial({ map: TEX.bark, color: new THREE.Color(0.55, 0.40, 0.33), roughness: 0.95, envMapIntensity: 0.3 })),
      windify(new THREE.MeshStandardMaterial({ map: TEX.needle, alphaTest: 0.42, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.35 }), 0.5),
    ],
    beech: [
      noInstanceColor(new THREE.MeshStandardMaterial({ map: TEX.bark, color: new THREE.Color(0.62, 0.62, 0.6), roughness: 0.9, envMapIntensity: 0.3 })),
      windify(new THREE.MeshStandardMaterial({ map: TEX.leaf, alphaTest: 0.42, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.8, envMapIntensity: 0.35 }), 0.8),
    ],
  };
}

// Impostor: Baum einmal von der Seite in eine Textur rendern
function makeImpostor(geo, mats, w, h) {
  const rt = new THREE.WebGLRenderTarget(256, 512);
  const sc = new THREE.Scene();
  sc.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(0.4, 1, 1); sc.add(dl);
  const lm = mats.map((m) => new THREE.MeshLambertMaterial({ map: m.map, color: m.color, alphaTest: 0.4, side: THREE.DoubleSide }));
  const mesh = new THREE.Mesh(geo, lm); sc.add(mesh);
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h, 0, 0.1, 100); cam.position.set(0, 0, 50); cam.lookAt(0, 0, 0);
  cam.position.set(0, 0, 50); cam.updateProjectionMatrix();
  const prevClear = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
  renderer.setRenderTarget(null); renderer.setClearColor(prevClear, prevA);
  const cb = new CardBuilder(), nf = () => V(0, 1, 0);
  for (const a of [0, Math.PI / 2]) {
    const s = V(Math.cos(a), 0, Math.sin(a));
    cb.quad(V(0, 0, 0).addScaledVector(s, -w / 2), V(0, 0, 0).addScaledVector(s, w / 2), V(0, h, 0).addScaledVector(s, w / 2), V(0, h, 0).addScaledVector(s, -w / 2), nf, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  return { geo: cb.geometry(), mat: new THREE.MeshStandardMaterial({ map: rt.texture, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, envMapIntensity: 0.25 }) };
}

// ------------------------------------------------------------------
// Wald mit LOD: nahe Blöcke detailliert, Rest als Impostor
// ------------------------------------------------------------------
const treeLod = { dirty: true, near: [], far: [], key: '' };
let treeMats;
function buildForest(rand) {
  treeMats = treeMats || treeMaterials();
  const group = new THREE.Group();
  const types = [
    { geo: spruceGeo(), mats: treeMats.spruce, list: [], imp: null, w: 8, h: 21 },
    { geo: beechGeo(), mats: treeMats.beech, list: [], imp: null, w: 11, h: 16 },
  ];
  types.forEach((t) => { t.imp = makeImpostor(t.geo, t.mats, t.w, t.h); });
  const tmp = new THREE.Vector3();
  const tryTree = (x, z) => {
    if (Math.abs(x) > HALF - 5 || Math.abs(z) > HALF - 5) return;
    const td = trailDistAt(x, z), sd = scDistAt(x, z);
    if (td < 5.2 || sd < 2.0) return;
    const y = hAt(x, z), ny = normalAt(x, z, tmp).y;
    let f = forestAt(x, z, y, ny);
    if (sd < 25) f = Math.max(f, 0.75 * smooth(0.5, 0.65, ny));
    if (rand() > f) return;
    if (nearStations(x, z)) return;
    const beechP = smooth(1150, 900, y) * 0.7 + (vnoise(x * 0.01, z * 0.01) > 0.3 ? 0.2 : 0);
    const t = rand() < beechP ? 1 : 0;
    const s = 0.55 + rand() * 0.6;
    types[t].list.push([x, y - 0.25, z, s, rand() * Math.PI * 2, rand()]);
    if (td < 60 || sd < 30) addObstacle(x, z, t ? 0.4 * s + 0.15 : 0.35 * s + 0.15);
  };
  for (let z = -HALF; z < HALF; z += 5) for (let x = -HALF; x < HALF; x += 5) {
    const cd = coarseDistAt(x, z);
    const p = cd < 140 ? 0.9 : cd < 400 ? 0.42 : 0.14;
    if (rand() < p) tryTree(x + (rand() - 0.5) * 4.5, z + (rand() - 0.5) * 4.5);
  }
  const B = 125, NB = Math.round(SIZE / B);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const autumn = [[1.0, 0.45, 0.12], [1.0, 0.62, 0.15], [0.9, 0.78, 0.25], [0.62, 0.7, 0.22], [0.85, 0.32, 0.1], [0.75, 0.55, 0.2]];
  let total = 0;
  types.forEach((ty, t) => {
    const n = ty.list.length;
    const mats = new Float32Array(n * 16), cols = new Float32Array(n * 3), blockOf = new Int32Array(n), xs = new Float32Array(n * 2);
    const buckets = new Map();
    ty.list.forEach((tr, i) => {
      q.setFromAxisAngle(up, tr[4]); sc.set(tr[3], tr[3] * (0.9 + tr[5] * 0.25), tr[3]); p.set(tr[0], tr[1], tr[2]);
      m4.compose(p, q, sc); m4.toArray(mats, i * 16);
      if (t === 0) col.setRGB(0.78 + tr[5] * 0.3, 0.82 + tr[5] * 0.25, 0.75 + tr[5] * 0.2);
      else { const a = autumn[Math.floor(tr[5] * autumn.length)]; col.setRGB(a[0], a[1], a[2]); }
      col.toArray(cols, i * 3);
      const key = Math.floor((tr[0] + HALF) / B) * NB + Math.floor((tr[2] + HALF) / B);
      blockOf[i] = key; xs[i * 2] = tr[0]; xs[i * 2 + 1] = tr[2];
      let a = buckets.get(key); if (!a) buckets.set(key, a = []); a.push(i);
    });
    for (const [key, arr] of buckets) {
      const im = new THREE.InstancedMesh(ty.geo, ty.mats, arr.length);
      arr.forEach((i, k) => { m4.fromArray(mats, i * 16); im.setMatrixAt(k, m4); col.fromArray(cols, i * 3); im.setColorAt(k, col); });
      im.castShadow = true; im.receiveShadow = true; im.visible = false;
      im.computeBoundingSphere();
      im.userData.key = key;
      im.userData.center = new THREE.Vector3((Math.floor(key / NB) + 0.5) * B - HALF, 0, (key % NB + 0.5) * B - HALF);
      group.add(im); treeLod.near.push(im);
    }
    const far = new THREE.InstancedMesh(ty.imp.geo, ty.imp.mat, n);
    far.frustumCulled = false; far.count = 0;
    far.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    group.add(far);
    treeLod.far.push({ mesh: far, mats, cols, blockOf, xs, n });
    total += n;
  });
  group.userData.total = total;
  treeLod.geos = types.map((t) => t.geo);
  return group;
}
function updateTreeLod(cam) {
  const nearSet = new Set();
  for (const im of treeLod.near) {
    const d = Math.hypot(im.userData.center.x - cam.x, im.userData.center.z - cam.z);
    const vis = d < TREE_NEAR + 88;
    im.visible = vis; if (vis) nearSet.add(im.userData.key);
  }
  const key = [...nearSet].sort().join(',');
  const moved = !treeLod.lastCam || Math.hypot(treeLod.lastCam.x - cam.x, treeLod.lastCam.z - cam.z) > 150;
  if (key === treeLod.key && !treeLod.dirty && !moved) return;
  treeLod.key = key; treeLod.dirty = false; treeLod.lastCam = cam.clone();
  const v2 = TREE_VIEW * TREE_VIEW;
  for (const f of treeLod.far) {
    const im = f.mesh, dst = im.instanceMatrix.array, dc = im.instanceColor.array;
    let c = 0;
    for (let i = 0; i < f.n; i++) {
      if (nearSet.has(f.blockOf[i])) continue;
      const dx = f.xs[i * 2] - cam.x, dz = f.xs[i * 2 + 1] - cam.z;
      if (dx * dx + dz * dz > v2) continue;
      for (let k = 0; k < 16; k++) dst[c * 16 + k] = f.mats[i * 16 + k];
      dc[c * 3] = f.cols[i * 3]; dc[c * 3 + 1] = f.cols[i * 3 + 1]; dc[c * 3 + 2] = f.cols[i * 3 + 2];
      c++;
    }
    im.count = c; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
  }
}

let stationA, stationB;
function nearStations(x, z) {
  for (const s of [stationA, stationB]) if (s && Math.hypot(x - s.x, z - s.z) < 40) return true;
  if (stationA && stationB) {
    const ax = stationA.x, az = stationA.z, bx = stationB.x - ax, bz = stationB.z - az;
    const t = clamp(((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz), 0, 1);
    if (Math.hypot(x - (ax + bx * t), z - (az + bz * t)) < 9) return true;
  }
  for (const s of reservedSpots) if (Math.hypot(x - s[0], z - s[1]) < s[2]) return true;
  return false;
}
const reservedSpots = []; // [x, z, r] – Plätze für Hütten, Holzarbeiten, Zuschauer

// ------------------------------------------------------------------
// Felsen mit Moos, Farne, Stämme, Baumstümpfe
// ------------------------------------------------------------------
function rockGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.78 + 0.32 * (fbm(x * 1.7 + seed, z * 1.7 + y * 1.3, 3) + 0.5) + 0.12 * vnoise(x * 5 + seed, y * 5 + z * 3);
    p.setXYZ(i, x * k * 1.25, Math.max(-0.35, y * k * 0.72), z * k);
  }
  g.computeVertexNormals();
  return g;
}
function rockMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, envMapIntensity: 0.4 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vRW; varying vec3 vRN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      #ifdef USE_INSTANCING
        vRW = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz; vRN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);
      #else
        vRW = (modelMatrix * vec4(transformed,1.0)).xyz; vRN = normalize(mat3(modelMatrix) * objectNormal);
      #endif`);
    sh.fragmentShader = 'varying vec3 vRW; varying vec3 vRN;\n' + GLSL_NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 an = abs(vRN);
      float n = (fbm3(vRW.yz*2.0)*an.x + fbm3(vRW.xz*2.0)*an.y + fbm3(vRW.xy*2.0)*an.z) / (an.x+an.y+an.z);
      float n2 = vnoise(vRW.xz*9.0 + vRW.y*5.0);
      vec3 c = diffuseColor.rgb * (0.78 + 0.35*n + 0.1*n2);
      c = mix(c, c*0.55, smoothstep(0.25, 0.5, -n));            // dunkle Risse
      float moss = smoothstep(0.55, 0.9, vRN.y + n*0.4);
      c = mix(c, vec3(0.08,0.13,0.035)*(0.8+0.4*n2), moss*0.85);
      diffuseColor.rgb = c;`);
  };
  return mat;
}
function buildRocks(rand) {
  const list = [], tmp = new THREE.Vector3();
  for (let i = 0; i < 3200; i++) {
    let x, z, near = false;
    if (i < 1100) { const k = Math.floor(rand() * trail.n); const lat = (rand() < 0.5 ? -1 : 1) * (TRAIL_HALF + 2.0 + Math.pow(rand(), 1.5) * 18); const pt = trailPoint(k * TRAIL_STEP, lat, {}); x = pt.x; z = pt.z; near = true; }
    else if (i < 1400 && shortcuts.length) { const sc = shortcuts[i % shortcuts.length]; const k = Math.floor(rand() * sc.n); const side = rand() < 0.5 ? -1 : 1; const off = SC_HALF + 1.6 + rand() * 5; x = sc.X[k] + Math.cos(sc.YAW[k]) * off * side; z = sc.Z[k] - Math.sin(sc.YAW[k]) * off * side; near = true; }
    else { x = (rand() - 0.5) * SIZE * 0.98; z = (rand() - 0.5) * SIZE * 0.98; const ny = normalAt(x, z, tmp).y; if (ny > 0.8 && rand() > 0.15) continue; }
    if (trailDistAt(x, z) < TRAIL_HALF + 1.2 || scDistAt(x, z) < SC_HALF + 0.5 || nearStations(x, z)) continue;
    const s = near ? 0.2 + Math.pow(rand(), 2) * 1.2 : 0.6 + rand() * 2.8;
    if (near && scDistAt(x, z) < SC_HALF + 0.4 + s * 1.2) continue;
    list.push([x, hAt(x, z) - s * 0.22, z, s, rand() * 6.28, rand()]);
    if ((trailDistAt(x, z) < 40 || scDistAt(x, z) < 20) && s > 0.45) addObstacle(x, z, s * 0.9);
  }
  const grp = new THREE.Group(), mat = rockMaterial();
  const geos = [rockGeo(1.3), rockGeo(7.1), rockGeo(13.7)];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  geos.forEach((geo, gi) => {
    const sub = list.filter((_, i) => i % 3 === gi);
    const im = new THREE.InstancedMesh(geo, mat, sub.length);
    sub.forEach((r, i) => { e.set(r[5] * 0.4, r[4], r[5] * 0.3); q.setFromEuler(e); sc.set(r[3], r[3] * (0.8 + r[5] * 0.4), r[3]); p.set(r[0], r[1], r[2]); im.setMatrixAt(i, m4.compose(p, q, sc)); const g = 0.42 + r[5] * 0.14; col.setRGB(g, g * 0.97, g * 0.9); im.setColorAt(i, col); });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
    grp.add(im);
  });
  return grp;
}
function buildUndergrowth(rand) {
  const grp = new THREE.Group(), tmp = new THREE.Vector3();
  // Farne und Grasbüschel als gekreuzte Karten
  const cross = (w, h) => {
    const cb = new CardBuilder(), nf = (pp) => V(pp.x, 1.2, pp.z).normalize();
    for (const a of [0, Math.PI / 3, Math.PI * 2 / 3]) { const s = V(Math.cos(a), 0, Math.sin(a)); cb.quad(V(0, 0, 0).addScaledVector(s, -w / 2), V(0, 0, 0).addScaledVector(s, w / 2), V(0, h, 0).addScaledVector(s, w / 2), V(0, h, 0).addScaledVector(s, -w / 2), nf, [[0, 0], [1, 0], [1, 1], [0, 1]]); }
    return cb.geometry();
  };
  const kinds = [
    { geo: cross(1.6, 1.2), mat: windify(new THREE.MeshStandardMaterial({ map: fernTex(), alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85 }), 1.2), n: 6500, forest: true },
    { geo: cross(1.0, 0.75), mat: windify(new THREE.MeshStandardMaterial({ map: grassTuftTex(), alphaTest: 0.4, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.9 }), 2.0), n: 7000, forest: false },
  ];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = V(0, 1, 0), col = new THREE.Color();
  for (const kd of kinds) {
    const list = [];
    for (let i = 0; i < kd.n * 4 && list.length < kd.n; i++) {
      let x, z;
      if (shortcuts.length && i % 6 === 0) { const sc0 = shortcuts[i % shortcuts.length]; const k = Math.floor(rand() * sc0.n); const off = (rand() < 0.5 ? -1 : 1) * (SC_HALF + 0.4 + rand() * 6); x = sc0.X[k] + Math.cos(sc0.YAW[k]) * off; z = sc0.Z[k] - Math.sin(sc0.YAW[k]) * off; }
      else { const k = Math.floor(rand() * trail.n), lat = (rand() < 0.5 ? -1 : 1) * (TRAIL_HALF + 0.6 + Math.pow(rand(), 1.4) * 35); const pt = trailPoint(k * TRAIL_STEP, lat, {}); x = pt.x; z = pt.z; }
      if (trailDistAt(x, z) < TRAIL_HALF + 0.4 || scDistAt(x, z) < SC_HALF + 0.3) continue;
      const y = hAt(x, z), ny = normalAt(x, z, tmp).y, f = forestAt(x, z, y, ny);
      if (kd.forest ? (f < 0.35 && scDistAt(x, z) > 12) : f > 0.6) continue;
      list.push([x, y - 0.05, z, 0.6 + rand() * 0.8, rand() * 6.28, rand()]);
    }
    const im = new THREE.InstancedMesh(kd.geo, kd.mat, list.length);
    list.forEach((r, i) => { q.setFromAxisAngle(up, r[4]); sc.setScalar(r[3]); p.set(r[0], r[1], r[2]); im.setMatrixAt(i, m4.compose(p, q, sc)); const g = 0.75 + r[5] * 0.4; col.setRGB(g * (kd.forest ? 1 : 1.05), g, g * 0.9); im.setColorAt(i, col); });
    im.receiveShadow = true; im.computeBoundingSphere();
    grp.add(im);
  }
  // umgestürzte Stämme und Baumstümpfe
  const logGeo = barkCylinder(0.28, 0.24, 1, 10, 3); logGeo.rotateZ(Math.PI / 2); logGeo.translate(-0.5, 0, 0);
  const capGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.02, 10).rotateZ(Math.PI / 2);
  const stumpGeo = barkCylinder(0.38, 0.32, 0.55, 10, 1);
  const barkM = new THREE.MeshStandardMaterial({ map: TEX.bark, color: new THREE.Color(0.5, 0.42, 0.36), roughness: 0.95 });
  const logs = [], stumps = [];
  for (let i = 0; i < 900 && (logs.length < 70 || stumps.length < 160); i++) {
    const k = Math.floor(rand() * trail.n), lat = (rand() < 0.5 ? -1 : 1) * (TRAIL_HALF + 3 + rand() * 25);
    const pt = trailPoint(k * TRAIL_STEP, lat, {});
    const y = hAt(pt.x, pt.z), ny = normalAt(pt.x, pt.z, tmp).y;
    if (forestAt(pt.x, pt.z, y, ny) < 0.4 || trailDistAt(pt.x, pt.z) < TRAIL_HALF + 2.5 || scDistAt(pt.x, pt.z) < 3) continue;
    if (logs.length < 70 && rand() < 0.4) {
      const len = 3 + rand() * 5, a = rand() * Math.PI * 2;
      const ex = pt.x + Math.cos(a) * len, ez = pt.z + Math.sin(a) * len;
      if (trailDistAt(ex, ez) < TRAIL_HALF + 2 || scDistAt(ex, ez) < 2.5) continue;
      logs.push([pt.x, y + 0.2, pt.z, len, a, Math.atan2(hAt(ex, ez) - y, len)]);
      for (let t = 0; t <= len; t += 0.8) if (trailDistAt(pt.x, pt.z) < 40) addObstacle(pt.x + Math.cos(a) * t, pt.z + Math.sin(a) * t, 0.3);
    } else if (stumps.length < 160) { stumps.push([pt.x, y - 0.1, pt.z, 0.7 + rand() * 0.6]); if (trailDistAt(pt.x, pt.z) < 40) addObstacle(pt.x, pt.z, 0.35); }
  }
  const logIm = new THREE.InstancedMesh(logGeo, barkM, logs.length);
  const e = new THREE.Euler();
  logs.forEach((l, i) => { e.set(0, -l[4], l[5], 'YXZ'); q.setFromEuler(e); sc.set(l[3], 1, 1); p.set(l[0], l[1], l[2]); logIm.setMatrixAt(i, m4.compose(p, q, sc)); });
  const stumpIm = new THREE.InstancedMesh(stumpGeo, barkM, stumps.length);
  stumps.forEach((s, i) => { sc.set(s[3], s[3], s[3]); p.set(s[0], s[1], s[2]); q.identity(); stumpIm.setMatrixAt(i, m4.compose(p, q, sc)); });
  const ringM = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.4, 0.25), roughness: 0.8 });
  const stumpTop = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 10), ringM, stumps.length);
  stumps.forEach((s, i) => { sc.set(s[3], 1, s[3]); p.set(s[0], s[1] + 0.55 * s[3], s[2]); q.identity(); stumpTop.setMatrixAt(i, m4.compose(p, q, sc)); });
  for (const im of [logIm, stumpIm, stumpTop]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); grp.add(im); }
  void capGeo;
  return grp;
}

// ------------------------------------------------------------------
// Gras um die Kamera: Halme werden im Shader auf das Gelände gesetzt
// ------------------------------------------------------------------
let grassField = null;
function buildGrassField(N, tile) {
  const blades = new CardBuilder();
  const r = mulberry32(77);
  const pos = [], idx = [], hgt = [];
  for (let b = 0; b < 4; b++) {
    const a = r() * Math.PI * 2, ox = (r() - 0.5) * 0.25, oz = (r() - 0.5) * 0.25, bend = 0.15 + r() * 0.25, w = 0.025 + r() * 0.015, hh = 0.75 + r() * 0.5;
    const dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
    const base = pos.length / 3;
    const rows = [0, 0.4, 0.75];
    rows.forEach((t) => { const ww = w * (1 - t * 0.6), bx = ox + dx * bend * t * t, bz = oz + dz * bend * t * t; pos.push(bx - sx * ww, t * hh, bz - sz * ww, bx + sx * ww, t * hh, bz + sz * ww); hgt.push(t, t); });
    pos.push(ox + dx * bend, hh, oz + dz * bend); hgt.push(1);
    for (let k = 0; k < 2; k++) { const a0 = base + k * 2; idx.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2); }
    idx.push(base + 4, base + 5, base + 6);
  }
  void blades;
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hgt, 1));
  g.setIndex(idx);
  const off = new Float32Array(N * 2), rnd = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { off[i * 2] = r() * tile; off[i * 2 + 1] = r() * tile; rnd[i * 3] = r(); rnd[i * 3 + 1] = r(); rnd[i * 3 + 2] = r(); }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
  g.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 3));
  g.instanceCount = N;
  const uni = { uH: { value: heightTex }, uMask: { value: maskTex }, uCam: { value: new THREE.Vector3() }, uTile: { value: tile }, uDens: { value: 1 }, uTime };
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.3 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = `uniform sampler2D uH; uniform sampler2D uMask; uniform vec3 uCam; uniform float uTile; uniform float uDens; uniform float uTime;
      attribute vec2 aOff; attribute vec3 aRnd; attribute float aH; varying float vGH; varying vec3 vGCol;
      float hFetch(vec2 w){ vec2 gg = clamp((w + ${HALF.toFixed(1)}) / ${CELL.toFixed(6)}, vec2(0.0), vec2(${(G - 2).toFixed(1)})); ivec2 i = ivec2(floor(gg)); vec2 f = fract(gg);
        float a = texelFetch(uH, i, 0).r, b = texelFetch(uH, i + ivec2(1,0), 0).r, c = texelFetch(uH, i + ivec2(0,1), 0).r, d = texelFetch(uH, i + ivec2(1,1), 0).r;
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      ` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', `
        vec2 cell = aOff + uTile * floor((uCam.xz - aOff) / uTile + 0.5);
        vec4 mk = texture2D(uMask, (cell + ${HALF.toFixed(1)}) / ${SIZE.toFixed(1)} * ${((G - 1) / G).toFixed(6)} + ${(0.5 / G).toFixed(6)});
        float td = mk.r * 25.5, sd = mk.b * 25.5, forest = mk.g;
        float dc = length(cell - uCam.xz);
        float h0 = hFetch(cell), hx = hFetch(cell + vec2(1.5, 0.0)), hz = hFetch(cell + vec2(0.0, 1.5));
        float sl = length(vec2(hx - h0, hz - h0)) / 1.5;
        float s = (0.5 + aRnd.x * 0.9)
          * smoothstep(${(TRAIL_HALF - 0.1).toFixed(2)}, ${(TRAIL_HALF + 1.0).toFixed(2)}, td + aRnd.z * 0.5)
          * smoothstep(${(SC_HALF + 0.1).toFixed(2)}, ${(SC_HALF + 0.8).toFixed(2)}, sd)
          * (1.0 - smoothstep(0.45, 0.85, forest + aRnd.y * 0.3 - 0.15))
          * (1.0 - smoothstep(uTile * 0.3, uTile * 0.48, dc))
          * (1.0 - smoothstep(0.55, 0.85, sl))
          * step(aRnd.z, uDens);
        float ang = aRnd.y * 40.0;
        mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
        vec3 transformed = vec3(position);
        transformed.xz = R * transformed.xz;
        transformed *= s * vec3(1.0, 0.32, 1.0);
        float gust = sin(uTime * 1.6 + cell.x * 0.21 + cell.y * 0.13) * 0.5 + 0.5;
        transformed.x += aH * aH * (0.10 + 0.12 * gust) * s;
        transformed.z += aH * aH * sin(uTime * 2.3 + cell.y * 0.4) * 0.03 * s;
        transformed += vec3(cell.x, h0 - 0.03, cell.y);
        vGH = aH;
        vGCol = mix(vec3(0.07,0.13,0.03), vec3(0.22,0.24,0.07), aRnd.x);
        vGCol = mix(vGCol, vec3(0.36,0.30,0.13), step(0.78, aRnd.y) * 0.8);`);
    sh.fragmentShader = 'varying float vGH; varying vec3 vGCol;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = vGCol * (0.35 + 0.75 * vGH);`);
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false; mesh.receiveShadow = true;
  grassField = { mesh, uni, setDensity: (d) => { uni.uDens.value = d; } };
  return mesh;
}
