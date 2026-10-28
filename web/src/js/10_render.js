
// ------------------------------------------------------------------
// Renderer, Himmel, Licht, Nachbearbeitung
// ------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.25, 60000);
const FOG_COL = new THREE.Color(0.60, 0.68, 0.78);
scene.fog = new THREE.FogExp2(FOG_COL, 0.00008);
const uTime = { value: 0 };

const sunDir = new THREE.Vector3();
{ const el = THREE.MathUtils.degToRad(26), az = THREE.MathUtils.degToRad(212); sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize(); }
function makeSky(scale) {
  const s = new Sky(); s.scale.setScalar(scale);
  const u = s.material.uniforms;
  u.turbidity.value = 4.5; u.rayleigh.value = 1.3; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(sunDir);
  return s;
}
scene.add(makeSky(50000));
{
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); envScene.add(makeSky(1000));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.10, 0.12, 0.06) }));
  ground.position.y = -40; envScene.add(ground);
  scene.environment = pm.fromScene(envScene, 0, 0.1, 2000).texture;
}
const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.88, 0.74), 2.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 800 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(new THREE.Color(0.55, 0.65, 0.85), new THREE.Color(0.20, 0.18, 0.10), 0.5));

// Nachbearbeitung: leichtes Bloom, Farblook, Vignette
let composer = null, bloomPass = null;
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(vec3(l), col, 1.08);                       // etwas mehr Sättigung
      col *= vec3(1.02, 1.0, 0.97);                        // warmer Herbstnachmittag
      col = mix(col, col*col*(3.0-2.0*col), 0.18);          // sanfter Kontrast
      vec2 p = vUv - 0.5; float v = 1.0 - dot(p,p) * uVig * 2.2;
      gl_FragColor = vec4(col * v, c.a); }`,
};
function buildComposer() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.12, 0.4, 0.95);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(GradeShader));
}

let TREE_VIEW = 2200, TREE_NEAR = 240;
function applyQuality() {
  const hi = QUALITY === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 1.75 : 1));
  const ms = hi ? 2048 : 1024;
  sun.shadow.mapSize.set(ms, ms);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  TREE_VIEW = hi ? 2200 : 1200; TREE_NEAR = hi ? 240 : 130;
  if (grassField) { grassField.mesh.visible = true; grassField.setDensity(hi ? 1 : 0.3); }
  treeLod.dirty = true;
  resize();
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (QUALITY === 'high') {
    if (!composer) buildComposer();
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
  }
}
addEventListener('resize', resize);
function renderFrame() {
  if (QUALITY === 'high' && composer) composer.render();
  else renderer.render(scene, camera);
}

// Wolken als weiche Sprites weit draußen
function cloudTexture(seed) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  const r = mulberry32(seed);
  for (let i = 0; i < 70; i++) {
    const px = 70 + r() * 372, py = 150 - Math.pow(r(), 0.7) * 100 * Math.sin((px - 40) / 432 * Math.PI), rad = 25 + r() * 55;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    const shade = 225 + r() * 30, base = py > 140 ? shade - 45 : shade;
    g.addColorStop(0, `rgba(${base},${base},${base + 6},0.55)`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, rad, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildClouds() {
  const grp = new THREE.Group(), r = mulberry32(42);
  const texs = [cloudTexture(1), cloudTexture(2), cloudTexture(3)];
  for (let i = 0; i < 26; i++) {
    const ang = r() * Math.PI * 2, dist = 9000 + r() * 22000;
    const m = new THREE.SpriteMaterial({ map: texs[i % 3], fog: false, depthWrite: false, transparent: true, opacity: 0.75 + r() * 0.25 });
    const s = new THREE.Sprite(m);
    const w = 3000 + r() * 5000;
    s.scale.set(w, w * 0.5, 1);
    s.position.set(Math.cos(ang) * dist, 2600 + r() * 1800, Math.sin(ang) * dist);
    s.userData.drift = 2 + r() * 3;
    grp.add(s);
  }
  return grp;
}

// ------------------------------------------------------------------
// Gelände-Material (prozedurale Schichten im Shader)
// ------------------------------------------------------------------
let maskTex, heightTex;
const GLSL_NOISE = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y)*2.0-1.0; }
float fbm3(vec2 p){ return 0.5*vnoise(p)+0.25*vnoise(p*2.03+17.1)+0.125*vnoise(p*4.01+31.7); }
float cells(vec2 p){ vec2 i=floor(p), f=fract(p); float m=1.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 o=vec2(x,y); vec2 r=o+vec2(hash12(i+o), hash12(i+o+7.7))-f; m=min(m,dot(r,r)); }
  return sqrt(m); }
`;
const MASK_UV = `((vW.xz + ${HALF.toFixed(1)}) / ${SIZE.toFixed(1)} * ${((G - 1) / G).toFixed(6)} + ${(0.5 / G).toFixed(6)})`;
function makeTerrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = { value: maskTex };
    sh.vertexShader = 'varying vec3 vW; varying vec3 vNw;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNw = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = 'uniform sampler2D uMask; varying vec3 vW; varying vec3 vNw;\n' + GLSL_NOISE + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec4 mk = texture2D(uMask, ${MASK_UV});
        float inside = step(abs(vW.x), ${HALF.toFixed(1)}) * step(abs(vW.z), ${HALF.toFixed(1)});
        float td = mix(25.5, mk.r * 25.5, inside);
        float sd = mix(25.5, mk.b * 25.5, inside);
        float lat = (mk.a * 255.0 - 128.0) / 10.0;
        float forest = mk.g * inside;
        float camD = length(vW - cameraPosition);
        float detail = 1.0 - smoothstep(60.0, 220.0, camD);
        float slope = 1.0 - normalize(vNw).y;
        float n1 = fbm3(vW.xz * 0.012), n2 = fbm3(vW.xz * 0.21), n3 = vnoise(vW.xz * 2.7) * detail, n4 = vnoise(vW.xz * 9.0) * detail;
        // Almwiese im Herbst: grün mit strohigen Flecken
        vec3 grass = mix(vec3(0.10,0.16,0.035), vec3(0.20,0.22,0.06), n1*0.5+0.5);
        grass = mix(grass, vec3(0.30,0.25,0.10), smoothstep(0.25, 0.6, fbm3(vW.xz*0.05+3.0)) * 0.55);
        grass *= 0.8 + 0.3*n2 + 0.1*n3;
        // Waldboden: Nadeln, Laub und Moos
        vec3 floorC = mix(vec3(0.09,0.07,0.04), vec3(0.20,0.11,0.04), smoothstep(-0.3,0.4,n2));
        floorC = mix(floorC, vec3(0.07,0.11,0.03), smoothstep(0.2,0.6,fbm3(vW.xz*0.09)) * 0.7);
        floorC *= 0.85 + 0.25*n4;
        vec3 rock = vec3(0.42,0.41,0.38) * (0.7 + 0.28*n2 + 0.12*n3 + 0.08*n4);
        rock = mix(rock, vec3(0.26,0.27,0.24), smoothstep(0.1,0.5,fbm3(vW.xz*0.3))*0.4);
        vec3 c = mix(grass, floorC, smoothstep(0.15, 0.75, forest) * 0.85);
        float rk = smoothstep(0.30, 0.48, slope + n1*0.12);
        rk = max(rk, smoothstep(1490.0, 1560.0, vW.y + n1*50.0) * 0.75);
        c = mix(c, rock, rk);
        // Schnee auf den hohen Gipfeln ringsum
        float snow = smoothstep(1720.0, 1820.0, vW.y + n1*90.0) * (1.0 - smoothstep(0.35, 0.6, slope));
        c = mix(c, vec3(0.85,0.87,0.9), snow);
        // Hauptstrecke: festgefahrene Erde mit zwei Fahrspuren und Schotter
        float edgeN = n2*0.5 + n3*0.25;
        float trailM = 1.0 - smoothstep(${(TRAIL_HALF - 0.5).toFixed(2)} + edgeN*0.4, ${(TRAIL_HALF + 0.5).toFixed(2)} + edgeN*0.6, td);
        vec3 dirt = mix(vec3(0.21,0.14,0.08), vec3(0.33,0.24,0.15), n3*0.5+0.5) * (0.88 + 0.2*n2);
        float al = abs(lat + n2*0.15);
        float ruts = exp(-pow((al - 0.55)/0.22, 2.0)) * detail;
        dirt = mix(dirt, dirt*0.62 + vec3(0.02,0.01,0.0), ruts*0.8);
        float pebble = smoothstep(0.16, 0.05, cells(vW.xz*7.0)) * (1.0 - ruts) * detail;
        dirt = mix(dirt, vec3(0.42,0.40,0.36)*(0.8+0.3*n4), pebble*0.5);
        float edge = (1.0 - smoothstep(${TRAIL_HALF.toFixed(2)}, 5.5, td)) * (1.0 - trailM);
        c = mix(c, c*0.65 + vec3(0.07,0.045,0.01), edge*0.75);
        c = mix(c, dirt, trailM);
        // Abkürzungen: dunkler Waldboden mit Wurzeln
        float scM = 1.0 - smoothstep(${(SC_HALF - 0.2).toFixed(2)} + edgeN*0.3, ${(SC_HALF + 0.5).toFixed(2)} + edgeN*0.5, sd);
        vec3 humus = mix(vec3(0.13,0.08,0.045), vec3(0.22,0.15,0.08), n3*0.5+0.5);
        float roots = pow(1.0 - abs(vnoise(vW.xz*vec2(0.9,1.4) + n2)), 14.0) * detail;
        humus = mix(humus, vec3(0.30,0.20,0.12), roots);
        humus = mix(humus, vec3(0.40,0.39,0.35), smoothstep(0.2, 0.08, cells(vW.xz*1.6)) * detail * 0.8);
        c = mix(c, humus, scM);
        float lake = 1.0 - smoothstep(517.0, 521.0, vW.y);
        c = mix(c, vec3(0.12,0.11,0.08), lake);
        diffuseColor.rgb = c;
        float vTrailM = max(trailM, scM); float vRock = rk; float vRuts = ruts * trailM; float vDetail = detail;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.97, 0.86, vTrailM) - 0.1*snow;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (vDetail > 0.0) {
          float e = 0.25; vec2 p = vW.xz;
          float k = (mix(0.16, 0.6, vRock) + vTrailM * 0.3) * vDetail;
          float h0 = fbm3(p*1.6), hx = fbm3((p+vec2(e,0.0))*1.6), hz = fbm3((p+vec2(0.0,e))*1.6);
          vec3 bw = vec3(-(hx-h0)/e, 0.0, -(hz-h0)/e) * k;
          normal = normalize(normal + (viewMatrix * vec4(bw, 0.0)).xyz);
        }`);
  };
  return mat;
}

// ------------------------------------------------------------------
// Gelände-Kacheln
// ------------------------------------------------------------------
const CH = 64; // Zellen je Kachel (125 m)
function buildTerrain(mat) {
  const group = new THREE.Group();
  const NC = (G - 1) / CH;
  for (let cj = 0; cj < NC; cj++) for (let ci = 0; ci < NC; ci++) {
    const cx = (ci + 0.5) * CH * CELL - HALF, cz = (cj + 0.5) * CH * CELL - HALF;
    const d = coarseDistAt(cx, cz) - 90;
    const step = d < 60 ? 1 : d < 300 ? 2 : d < 800 ? 4 : 8;
    const geo = chunkGeometry(ci * CH, cj * CH, step);
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true; m.castShadow = step <= 2;
    group.add(m);
  }
  return group;
}
function chunkGeometry(i0, j0, step) {
  const cells = CH / step, n = cells + 1;
  const vcount = n * n + 4 * n;
  const pos = new Float32Array(vcount * 3), nor = new Float32Array(vcount * 3);
  const idx = [];
  const hv = (i, j) => H[clamp(j, 0, G - 1) * G + clamp(i, 0, G - 1)];
  let v = 0;
  for (let jj = 0; jj < n; jj++) for (let ii = 0; ii < n; ii++) {
    const gi = i0 + ii * step, gj = j0 + jj * step;
    pos[v * 3] = gi * CELL - HALF; pos[v * 3 + 1] = hv(gi, gj); pos[v * 3 + 2] = gj * CELL - HALF;
    const dx = hv(gi + 1, gj) - hv(gi - 1, gj), dz = hv(gi, gj + 1) - hv(gi, gj - 1);
    const l = Math.hypot(dx, 2 * CELL, dz);
    nor[v * 3] = -dx / l; nor[v * 3 + 1] = 2 * CELL / l; nor[v * 3 + 2] = -dz / l;
    v++;
  }
  for (let jj = 0; jj < cells; jj++) for (let ii = 0; ii < cells; ii++) {
    const a = jj * n + ii, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const edges = [[], [], [], []];
  for (let t = 0; t < n; t++) { edges[0].push(t); edges[1].push((n - 1) * n + t); edges[2].push(t * n); edges[3].push(t * n + n - 1); }
  for (let e = 0; e < 4; e++) {
    const base = v;
    for (const src of edges[e]) {
      pos[v * 3] = pos[src * 3]; pos[v * 3 + 1] = pos[src * 3 + 1] - 6; pos[v * 3 + 2] = pos[src * 3 + 2];
      nor[v * 3] = nor[src * 3]; nor[v * 3 + 1] = nor[src * 3 + 1]; nor[v * 3 + 2] = nor[src * 3 + 2];
      v++;
    }
    for (let t = 0; t < n - 1; t++) {
      const a = edges[e][t], b = edges[e][t + 1], c = base + t, d = base + t + 1;
      idx.push(a, b, c, b, d, c, a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// Umland: Chiemgauer Alpen im Süden, Chiemsee-Becken im Norden
function outerHeight(x, z) {
  const dOut = Math.max(Math.abs(x) - HALF, Math.abs(z) - HALF, 0);
  const edge = hAt(clamp(x, -HALF, HALF), clamp(z, -HALF, HALF));
  const mtn = smooth(-3500, 1500, z);
  const ridge = 1 - Math.abs(fbm(x * 0.00028, z * 0.00045, 5));
  const far = smooth(8000, 25000, z);
  const peaks = 640 + Math.pow(ridge, 2.2) * (1250 + far * 900) + fbm(x * 0.0015, z * 0.0015, 3) * 120;
  let plain = Math.max(524, 548 + fbm(x * 0.0006, z * 0.0006, 4) * 70);
  const lx = (x - 7600) / 8200, lz = (z + 12300) / 4300;
  const lake = 1 - smooth(0.75, 1.0, Math.hypot(lx, lz));
  plain = lerp(plain, 495, lake);
  const proc = lerp(plain, peaks, mtn);
  return lerp(edge, proc, smooth(0, 2600, dOut));
}
function buildOuter(mat) {
  const EXT = 30000, STEP = 250, n = EXT * 2 / STEP + 1;
  const pos = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -EXT + i * STEP, z = -EXT + j * STEP, k = (j * n + i) * 3;
    const inside = Math.abs(x) < HALF && Math.abs(z) < HALF;
    pos[k] = x; pos[k + 2] = z; pos[k + 1] = inside ? hAt(x, z) - 40 : outerHeight(x, z);
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = false;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(26000, 14000), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.03, 0.08, 0.11), roughness: 0.06, metalness: 0.1, envMapIntensity: 1.0 }));
  water.rotation.x = -Math.PI / 2; water.position.set(7600, 518.5, -12300);
  const grp = new THREE.Group(); grp.add(m, water); return grp;
}
