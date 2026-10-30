
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
// Ast als zwei gekreuzte Karten (flach + hochkant), Normalen nach außen/oben für weiches Licht
function branchCard(cb, base, dir, len, wd, yRef, sag = 0.1) {
  const side = V(-dir.z, 0, dir.x).normalize();
  const up = new THREE.Vector3().crossVectors(side, dir).normalize();
  const tip = base.clone().addScaledVector(dir, len); tip.y -= len * sag;
  const nf = (p) => V(p.x, (p.y - yRef) * 0.4 + len * 0.55, p.z).normalize();
  cb.quad(base.clone().addScaledVector(side, -wd / 2), base.clone().addScaledVector(side, wd / 2), tip.clone().addScaledVector(side, wd / 2), tip.clone().addScaledVector(side, -wd / 2), nf);
  const w2 = wd * 0.45;
  cb.quad(base.clone().addScaledVector(up, -w2 / 2), base.clone().addScaledVector(up, w2 / 2), tip.clone().addScaledVector(up, w2 / 2), tip.clone().addScaledVector(up, -w2 / 2), nf);
  return tip;
}
// Fichte mit Parametern: Höhe, Kronenansatz, Breite, Kronenform, Hängezweige, Lücken, Wipfel
const SPRUCE_VARIANTS = [
  { seed: 5, H: 21, base: 0.07, W: 3.6, shape: 0.95, droop: 0.5, nb: 9, gaps: 0.04 },                       // Waldrand, voll beastet
  { seed: 8, H: 27, base: 0.42, W: 2.9, shape: 0.85, droop: 0.32, nb: 8, gaps: 0.1, stubs: 18, gap: 0.6 },          // Bestand: hoher, kahler Stamm
  { seed: 12, H: 17, base: 0.04, W: 2.1, shape: 0.6, droop: 0.95, nb: 9, gaps: 0.05, hang: true, gap: 0.6 },          // Gebirgsfichte, schmal mit Hängezweigen
  { seed: 15, H: 8.5, base: 0.02, W: 2.0, shape: 1.0, droop: 0.35, nb: 7, gaps: 0.02, gap: 0.42 },          // junge Fichte
  { seed: 19, H: 24, base: 0.22, W: 3.1, shape: 0.9, droop: 0.45, nb: 8, gaps: 0.25, stubs: 8, twin: true, gap: 0.65 }, // alt, lückig, Zwillingswipfel
];
function spruceGeo(o) {
  const r = mulberry32(o.seed), H = o.H, y0 = Math.max(0.6, o.base * H);
  const trunkParts = [barkCylinder(0.018 * H + 0.06, 0.025, H - 0.2, 8, Math.round(H / 4))];
  // tote Aststummel am kahlen Stamm
  for (let i = 0; i < (o.stubs || 0); i++) {
    const y = 2 + r() * (y0 - 2), a = r() * 6.28, l = 0.3 + r() * 0.7;
    const p0 = V(0, y, 0), p1 = V(Math.cos(a) * l, y - l * 0.35, Math.sin(a) * l);
    trunkParts.push(orientGeo(barkCylinder(0.03, 0.008, l, 4, 1), p0, p1));
  }
  const cb = new CardBuilder(), lb = new CardBuilder();
  const gap = o.gap || 0.75;
  const topY = o.twin ? H - 2.2 : H - 1.1;
  for (let y = y0; y < topY; y += gap * (0.75 + r() * 0.5)) {
    const t = (y - y0) / (H - y0);
    let R = 0.25 + o.W * Math.pow(1 - t, o.shape);
    if (o.base > 0.2) R *= 0.7 + 0.3 * smooth(0, 0.12, t); // untere Schattenäste kürzer
    const nb = Math.max(3, Math.round(o.nb * (1 - t * 0.45)));
    const off = r() * 6.28;
    for (let b = 0; b < nb; b++) {
      if (r() < o.gaps * (1 - t)) continue;
      const ang = off + b / nb * Math.PI * 2 + (r() - 0.5) * 0.9;
      // oben streben die Äste nach oben, unten hängen sie
      let pitch = -(o.droop * 0.55 * (1 - t) + 0.06) + (r() - 0.5) * 0.18;
      if (t > 0.78) pitch = lerp(pitch, 0.55, smooth(0.78, 1, t));
      const dir = V(Math.cos(ang) * Math.cos(pitch), Math.sin(pitch), Math.sin(ang) * Math.cos(pitch));
      const len = R * (0.65 + r() * 0.5), wd = len * (1.0 + r() * 0.35);
      const tip = branchCard(cb, V(0, y, 0).addScaledVector(dir, 0.06), dir, len, wd, y, t > 0.78 ? 0.0 : 0.1);
      if (o.hang && t < 0.8 && len > 0.6) {
        // Vorhang aus Hängezweigen an der Astspitze
        const hd = V(dir.x * 0.25, -1, dir.z * 0.25).normalize();
        branchCard(cb, tip.clone().addScaledVector(dir, -len * 0.45), hd, len * 0.7, wd * 0.55, y, 0);
      }
    }
    // Zwischenquirl: ein paar kurze Äste
    if (t < 0.85) for (let k = 0; k < 2; k++) {
      const ang = r() * 6.28, pitch = -0.1 - o.droop * 0.3 * (1 - t);
      const dir = V(Math.cos(ang) * Math.cos(pitch), Math.sin(pitch), Math.sin(ang) * Math.cos(pitch));
      branchCard(cb, V(0, y + gap * 0.5, 0), dir, R * 0.45, R * 0.4, y);
    }
  }
  // Wipfel: Leittrieb aus drei gekreuzten schmalen Karten
  const leader = (bx, bz, h0, h1, wd) => {
    const nf = (p) => V(p.x - bx, 0.8, p.z - bz).normalize();
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * Math.PI, s = V(Math.cos(a), 0, Math.sin(a));
      const b = V(bx, h0, bz), tp = V(bx * 1.05, h1, bz * 1.05);
      lb.quad(b.clone().addScaledVector(s, -wd / 2), b.clone().addScaledVector(s, wd / 2), tp.clone().addScaledVector(s, wd / 2), tp.clone().addScaledVector(s, -wd / 2), nf);
    }
  };
  // oberster Quirl mit kurzen, steil aufwärts gerichteten Trieben
  for (let k = 0; k < 4; k++) {
    const ang = k / 4 * 6.28 + r(), dir = V(Math.cos(ang) * 0.6, 0.8, Math.sin(ang) * 0.6).normalize();
    branchCard(cb, V(0, topY - 0.15, 0), dir, 0.7, 0.45, topY, 0);
  }
  if (o.twin) {
    for (const s of [-1, 1]) {
      const bx = s * 0.55, d = V(bx, 2.3, 0).normalize();
      trunkParts.push(orientGeo(barkCylinder(0.07, 0.02, 2.4, 6, 1), V(0, H - 2.4, 0), V(bx, H - 0.1, 0)));
      leader(bx, 0, H - 1.2, H + (s > 0 ? 0.1 : -0.5), 0.5);
      for (let k = 0; k < 3; k++) { const a = k / 3 * 6.28 + r(); branchCard(cb, V(bx * 0.6, H - 1.6, 0), V(Math.cos(a) * 0.7, 0.65, Math.sin(a) * 0.7).normalize(), 0.8, 0.5, H, 0); }
    }
  } else leader(0, 0, H - 1.25, H + 0.05, 0.5);
  return mergeGeometries([mergeGeometries(trunkParts), cb.geometry(), lb.geometry()], true);
}
// Lärche: lockere, waagrechte Äste mit leicht aufgebogenen Enden
function larchGeo(seed = 31) {
  const r = mulberry32(seed), H = 22;
  const trunkParts = [barkCylinder(0.38, 0.03, H - 0.2, 8, 5)];
  const cb = new CardBuilder();
  for (let y = 3.5; y < H - 1; y += 0.9 + r() * 0.6) {
    const t = (y - 3.5) / (H - 4.5), R = 0.4 + 3.6 * Math.pow(1 - t, 1.1);
    const nb = 4 + Math.round(r() * 2);
    for (let b = 0; b < nb; b++) {
      const ang = r() * 6.28, pitch = (r() - 0.6) * 0.3 + t * 0.4;
      const dir = V(Math.cos(ang) * Math.cos(pitch), Math.sin(pitch), Math.sin(ang) * Math.cos(pitch));
      const len = R * (0.6 + r() * 0.5);
      if (len > 1.2) trunkParts.push(orientGeo(barkCylinder(0.05, 0.015, len * 0.8, 4, 1), V(0, y, 0), V(0, y, 0).addScaledVector(dir, len * 0.8)));
      branchCard(cb, V(0, y, 0), dir, len, len * 0.85, y, -0.08);
    }
  }
  for (let k = 0; k < 3; k++) { const a = k / 3 * 6.28; branchCard(cb, V(0, H - 1.4, 0), V(Math.cos(a) * 0.5, 0.85, Math.sin(a) * 0.5).normalize(), 1.4, 0.6, H, 0); }
  return mergeGeometries([mergeGeometries(trunkParts), cb.geometry()], true);
}
// abgestorbene Fichte (Käferholz): grauer Stamm mit kahlen Ästen
function snagGeo(seed = 41) {
  const r = mulberry32(seed), H = 19;
  const parts = [barkCylinder(0.34, 0.04, H, 7, 5)];
  for (let i = 0; i < 34; i++) {
    const y = 3 + r() * (H - 4), a = r() * 6.28, l = (0.4 + r() * 1.6) * (1 - (y / H) * 0.6);
    parts.push(orientGeo(barkCylinder(0.035, 0.008, l, 4, 1), V(0, y, 0), V(Math.cos(a) * l, y - l * 0.3, Math.sin(a) * l)));
  }
  return mergeGeometries([mergeGeometries(parts)], true);
}
function beechGeo(seed = 9, o = {}) {
  const r = mulberry32(seed);
  const trunkH = o.trunk ?? 7.5, cy = o.cy ?? 11.2, rad = V(o.rx ?? 4.6, o.ry ?? 4.0, o.rx ?? 4.6);
  const parts = [barkCylinder(0.4, 0.2, trunkH, 9, 3)];
  const center = V(0, cy, 0);
  const nLimb = o.limbs ?? 5;
  for (let i = 0; i < nLimb; i++) {
    const a = i / nLimb * Math.PI * 2 + r() * 0.5;
    const end = V(Math.cos(a) * rad.x * 0.7, cy - 0.7 + r() * 3, Math.sin(a) * rad.z * 0.7);
    parts.push(orientGeo(barkCylinder(0.2, 0.06, V(0, trunkH - 0.5, 0).distanceTo(end), 6, 2), V(0, trunkH - 0.5, 0), end));
  }
  const cb = new CardBuilder();
  const n = o.cards ?? 80;
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const dir = V(s * Math.cos(th), u * 0.9, s * Math.sin(th));
    const k = 0.5 + 0.5 * Math.pow(r(), 0.5);
    // unregelmäßige Krone: einzelne Partien stehen weiter heraus
    const bulge = 0.85 + 0.3 * vnoise(dir.x * 2 + seed, dir.z * 2 + dir.y * 2);
    const p = center.clone().add(V(dir.x * rad.x * k * bulge, dir.y * rad.y * k, dir.z * rad.z * k * bulge));
    if (p.y < trunkH) p.y = trunkH + r();
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
  return mergeGeometries([mergeGeometries(parts), cb.geometry()], true);
}

// Materialien
const TEX = {};
// gegen ausdünnende Kronen in der Ferne: Alpha mit der Mip-Stufe anheben
const ALPHA_BOOST = `
  #ifdef USE_MAP
  { vec2 dd = max(abs(dFdx(vMapUv)), abs(dFdy(vMapUv))) * 256.0;
    diffuseColor.a *= 1.0 + max(0.0, log2(max(dd.x, dd.y))) * 0.35; }
  #endif
`;
// Wind: ganzer Baum schwingt langsam, Zweige flattern leicht
function windify(mat, strength) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float hh = max(0.0, position.y - 1.5) / 20.0;
        #ifdef USE_INSTANCING
          vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 ip = vec2(0.0);
        #endif
        float ph = ip.x * 0.07 + ip.y * 0.05;
        float g = sin(uTime * 0.31 + ph * 0.3) * 0.4 + 0.75;
        float sway = hh * hh * ${strength.toFixed(3)} * g;
        transformed.x += sin(uTime * 0.9 + ph) * sway * 0.6;
        transformed.z += cos(uTime * 0.75 + ph * 1.3) * sway * 0.45;
        float fl = ${(strength * 0.05).toFixed(4)} * min(hh * 4.0, 1.0) * g;
        transformed += vec3(sin(uTime * 3.1 + position.x * 1.7 + position.y), sin(uTime * 2.7 + position.z * 1.9), cos(uTime * 3.3 + position.y * 1.3)) * fl;
      }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', ALPHA_BOOST + '#include <alphatest_fragment>');
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
  TEX.needle = spruceBranchTex(); TEX.leader = spruceLeaderTex(); TEX.larch = larchBranchTex(); TEX.leaf = leafClusterTex(); TEX.bark = barkTex();
  const bark = (c) => noInstanceColor(new THREE.MeshStandardMaterial({ map: TEX.bark, color: c, roughness: 0.95, envMapIntensity: 0.3 }));
  const foliage = (map, wind) => windify(new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.35 }), wind);
  const needles = foliage(TEX.needle, 0.6);
  return {
    spruce: [bark(new THREE.Color(0.55, 0.40, 0.33)), needles, foliage(TEX.leader, 0.6)],
    larch: [bark(new THREE.Color(0.6, 0.42, 0.34)), foliage(TEX.larch, 0.7)],
    snag: [bark(new THREE.Color(0.68, 0.66, 0.64))],
    beech: [bark(new THREE.Color(0.62, 0.62, 0.6)), foliage(TEX.leaf, 0.9)],
  };
}

// Impostor: Baum einmal von der Seite in eine Textur rendern
function makeImpostor(geo, mats, w, h) {
  const rt = new THREE.WebGLRenderTarget(256, 512, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const sc = new THREE.Scene();
  sc.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(0.4, 1, 1); sc.add(dl);
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
    const ww = w * 0.65; // in der Ferne etwas breiter, damit der Wald geschlossen wirkt
    cb.quad(V(0, 0, 0).addScaledVector(s, -ww), V(0, 0, 0).addScaledVector(s, ww), V(0, h, 0).addScaledVector(s, ww), V(0, h, 0).addScaledVector(s, -ww), nf, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  const mat = new THREE.MeshStandardMaterial({ map: rt.texture, color: new THREE.Color(0.8, 0.8, 0.8), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, envMapIntensity: 0.25 });
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', ALPHA_BOOST + '#include <alphatest_fragment>'); };
  mat.customProgramCacheKey = () => 'imp';
  return { geo: cb.geometry(), mat };
}

// ------------------------------------------------------------------
// Wald mit LOD: nahe Blöcke detailliert, Rest als Impostor
// ------------------------------------------------------------------
const treeLod = { dirty: true, near: [], far: [], key: '' };
let treeMats;
function buildForest(rand) {
  treeMats = treeMats || treeMaterials();
  const group = new THREE.Group();
  const imp = (W) => 2 * (W + 0.35) * 1.08;
  const types = [
    ...SPRUCE_VARIANTS.map((o) => ({ geo: spruceGeo(o), mats: treeMats.spruce, w: imp(o.W), h: o.H + 0.6, r0: 0.018 * o.H + 0.06 })),
    { geo: larchGeo(), mats: treeMats.larch, w: 9.5, h: 23, r0: 0.38 },
    { geo: snagGeo(), mats: treeMats.snag, w: 4.5, h: 19.5, r0: 0.34 },
    { geo: beechGeo(9), mats: treeMats.beech, w: 11, h: 16, r0: 0.4 },
    { geo: beechGeo(17, { trunk: 9, cy: 13.2, rx: 3.7, ry: 4.8, limbs: 4, cards: 76 }), mats: treeMats.beech, w: 9.4, h: 18.6, r0: 0.4 },
  ];
  types.forEach((t) => { t.list = []; t.imp = makeImpostor(t.geo, t.mats, t.w, t.h); });
  const SPRUCE_TONES = [[0.78, 0.86, 0.82], [0.9, 0.95, 0.8], [1.0, 1.02, 0.76], [0.72, 0.82, 0.9], [0.86, 0.9, 0.7], [0.95, 0.92, 0.78]];
  const LARCH_TONES = [[1.15, 0.85, 0.35], [1.1, 0.72, 0.25], [1.02, 0.9, 0.45], [0.92, 0.95, 0.55]];
  const autumn = [[1.0, 0.45, 0.12], [1.0, 0.62, 0.15], [0.9, 0.78, 0.25], [0.62, 0.7, 0.22], [0.85, 0.32, 0.1], [0.75, 0.55, 0.2]];
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
    let t, c;
    const k = rand();
    if (rand() < beechP) { t = rand() < 0.55 ? 7 : 8; c = autumn[Math.floor(k * autumn.length)]; }
    else if (rand() < 0.015) { t = 6; c = [1, 1, 1]; }
    else if (rand() < 0.1 + 0.18 * smooth(1150, 1450, y) + (vnoise(x * 0.004 + 7, z * 0.004) > 0.45 ? 0.25 : 0)) { t = 5; c = LARCH_TONES[Math.floor(k * LARCH_TONES.length)]; }
    else {
      const edge = td < 22 || f < 0.5, high = smooth(1250, 1450, y), q = rand();
      if (q < high * 0.55) t = 2;
      else if (q < 0.14) t = 3;
      else if (q < 0.26) t = 4;
      else t = edge ? (rand() < 0.75 ? 0 : 1) : (rand() < 0.6 ? 1 : 0);
      const tone = SPRUCE_TONES[Math.floor(k * SPRUCE_TONES.length)], br = 0.92 + rand() * 0.38;
      c = rand() < 0.015 ? [1.5, 0.9, 0.45] : tone.map((v) => v * br);
    }
    const s = t === 3 ? 0.6 + rand() * 0.7 : 0.72 + rand() * 0.48;
    types[t].list.push([x, y - 0.25, z, s, rand() * Math.PI * 2, 0.88 + rand() * 0.24, 0.85 + rand() * 0.3, c]);
    if (td < 60 || sd < 30) addObstacle(x, z, types[t].r0 * s + 0.15);
  };
  for (let z = -HALF; z < HALF; z += 5) for (let x = -HALF; x < HALF; x += 5) {
    const cd = coarseDistAt(x, z);
    const p = cd < 140 ? 0.9 : cd < 400 ? 0.42 : 0.14;
    if (rand() < p) tryTree(x + (rand() - 0.5) * 4.5, z + (rand() - 0.5) * 4.5);
  }
  const B = 125, NB = Math.round(SIZE / B);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  let total = 0;
  types.forEach((ty, t) => {
    const n = ty.list.length;
    const mats = new Float32Array(n * 16), cols = new Float32Array(n * 3), blockOf = new Int32Array(n), xs = new Float32Array(n * 2);
    const buckets = new Map();
    ty.list.forEach((tr, i) => {
      q.setFromAxisAngle(up, tr[4]); sc.set(tr[3] * tr[6], tr[3] * tr[5], tr[3] * tr[6]); p.set(tr[0], tr[1], tr[2]);
      m4.compose(p, q, sc); m4.toArray(mats, i * 16);
      col.setRGB(tr[7][0], tr[7][1], tr[7][2]).toArray(cols, i * 3);
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
