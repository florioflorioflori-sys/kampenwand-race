import sys, re, os
S = os.path.dirname(os.path.abspath(__file__))
src = open(sys.argv[1], encoding='utf-8').read()
out = sys.argv[2]
def rep(old, new, count=1):
    global src
    n = src.count(old)
    if n != count:
        raise SystemExit(f'pattern count {n} != {count}: {old[:120]!r}')
    src = src.replace(old, new)
def rd(p): return open(os.path.join(S, 'src', p), encoding='utf-8').read()

# --- Licht-Referenz
rep("scene.add(new THREE.HemisphereLight(new THREE.Color(0.5, 0.65, 0.95), new THREE.Color(0.20, 0.18, 0.10), 0.55));",
    "const hemi = new THREE.HemisphereLight(new THREE.Color(0.5, 0.65, 0.95), new THREE.Color(0.20, 0.18, 0.10), 0.55);\nscene.add(hemi);")
# --- Wetter-Modul vor dem Geländematerial
rep("// ------------------------------------------------------------------\n// Gelände-Material (prozedurale Schichten im Shader)",
    rd('weather.js') + "\n// ------------------------------------------------------------------\n// Gelände-Material (prozedurale Schichten im Shader)")
# --- FX: Tropfen auf der Linse, Sonne hinter Wolken
rep("const FX = { blur: 0, flare: 0, sun: new THREE.Vector2(0.5, 0.5), ao: 0.55 };",
    "const FX = { blur: 0, flare: 0, sun: new THREE.Vector2(0.5, 0.5), ao: 0.55, storm: 0 };")
rep("uAO: { value: 0.55 }, uBlur: { value: 0 }, uSun: { value: new THREE.Vector3(0.5, 0.5, 0) }, uTime: { value: 0 } },",
    "uAO: { value: 0.55 }, uBlur: { value: 0 }, uSun: { value: new THREE.Vector3(0.5, 0.5, 0) }, uTime: { value: 0 }, uLens: { value: 0 } },")
rep("uniform float uAO; uniform float uBlur; uniform vec3 uSun; uniform float uTime; varying vec2 vUv;",
    "uniform float uAO; uniform float uBlur; uniform vec3 uSun; uniform float uTime; uniform float uLens; varying vec2 vUv;")
rep("""    void main(){
      vec3 col = texture2D(tDiffuse, vUv).rgb;""", """    void main(){
      vec2 uvS = vUv;
      // Regentropfen auf der Linse: brechen das Bild, rutschen teils nach unten
      float lensM = 0.0;
      if (uLens > 0.01) {
        for (int L = 0; L < 2; L++) {
          float sc = L == 0 ? 6.0 : 13.0;
          vec2 g = vec2(vUv.x * uAspect, vUv.y) * sc + float(L) * 7.3;
          vec2 id = floor(g), f = fract(g) - 0.5;
          float h = hash(id + float(L) * 3.1);
          float life = fract(uTime * (0.10 + 0.12 * h) + h * 7.0);
          vec2 c = vec2(hash(id + 1.7) - 0.5, hash(id + 4.3) - 0.5) * 0.55;
          c.y += 0.25 - life * life * step(0.65, h) * 0.9;
          float r = (0.06 + 0.09 * hash(id + 9.9)) * (L == 0 ? 1.0 : 0.7);
          vec2 dd = (f - c) * vec2(1.0, 0.85);
          float d = length(dd);
          float on = step(1.0 - uLens * 0.32, hash(id + 2.2)) * smoothstep(1.0, 0.75, life);
          float m = smoothstep(r, r * 0.72, d) * on;
          uvS -= dd / sc * m * 1.1 * vec2(1.0 / uAspect, 1.0);
          lensM = max(lensM, m);
        }
      }
      vec3 col = texture2D(tDiffuse, uvS).rgb;
      // Regenschleier: feine, schnell fallende Schnüre über dem ganzen Bild
      if (uLens > 0.01) {
        for (int L = 0; L < 2; L++) {
          float sc = L == 0 ? 160.0 : 90.0;
          vec2 q = vec2((vUv.x + vUv.y * 0.08) * uAspect * sc, vUv.y * (L == 0 ? 2.0 : 1.4) + uTime * (L == 0 ? 3.2 : 2.3));
          float h = hash(vec2(floor(q.x), float(L) * 5.0));
          float st = fract(q.y + h * 13.0);
          float ln = smoothstep(0.0, 0.03, st) * smoothstep(0.22, 0.03, st) * step(0.6, h) * (1.0 - abs(fract(q.x) - 0.5) * 2.0);
          col += vec3(0.75, 0.8, 0.88) * ln * uLens * (L == 0 ? 0.05 : 0.08);
        }
      }
      if (lensM > 0.0) col = mix(col, (col + texture2D(tDiffuse, uvS + vec2(0.004, 0.006)).rgb + texture2D(tDiffuse, uvS - vec2(0.005, 0.003)).rgb) / 3.0 * 1.08, lensM * 0.7);""")
rep("  const R = Math.random;\n  let n = sp * dt * (o.onTrail ? 2.4 : 0.8)", "  const R = Math.random;\n  // nasser Boden: statt Staub fliegt Schlamm vom Hinterrad\n  if (WX.wet > 0.3) {\n    let m = sp * dt * 2.6 * WX.wet * (o.lowFx ? 0.4 : 1) * (o.onTrail ? 1 : 0.5);\n    while (m > 0) { if (R() < m) emitDust(rx + (R() - 0.5) * 0.2, y + 0.35 + R() * 0.2, rz + (R() - 0.5) * 0.2, vx * 0.35 + (R() - 0.5) * 1.4, 1.6 + R() * 2.6, vz * 0.35 + (R() - 0.5) * 1.4, 0.03 + R() * 0.05, 2 + R() * 0.25); m -= 1; }\n    if (WX.wet > 0.55) return;\n  }\n  let n = sp * dt * (o.onTrail ? 2.4 : 0.8)")
rep("u.uBlur.value = FX.blur; u.uAO.value = FX.ao;", "u.uBlur.value = FX.blur; u.uAO.value = FX.ao; u.uLens.value = WX.rain;")
rep("u.uSun.value.set(_sunScr.x * 0.5 + 0.5, _sunScr.y * 0.5 + 0.5, inFront ? clamp((1.15 - edge) * 3, 0, 1) : 0);",
    "u.uSun.value.set(_sunScr.x * 0.5 + 0.5, _sunScr.y * 0.5 + 0.5, inFront ? clamp((1.15 - edge) * 3, 0, 1) * (1 - FX.storm) : 0);")
# --- Farblook: bei Unwetter entsättigt und kühl
rep("uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 } },", "uniforms: { tDiffuse: { value: null }, uVig: { value: 0.32 }, uStorm: { value: 0 } },")
rep("fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; varying vec2 vUv;", "fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig; uniform float uStorm; varying vec2 vUv;")
rep("col = mix(vec3(l), col, 1.42);                       // kräftigere Farben",
    "col = mix(vec3(l), col, mix(1.42, 1.08, uStorm));      // kräftigere Farben, bei Regen gedämpft\n      col = mix(col, col * vec3(0.92, 0.98, 1.08), uStorm);")
rep("  composer.addPass(new ShaderPass(GradeShader));", "  gradePass = new ShaderPass(GradeShader); composer.addPass(gradePass);")
rep("let composer = null, bloomPass = null;", "let composer = null, bloomPass = null, gradePass = null;")

# --- Gelände: Nässe, Pfützen mit Regenringen
rep("sh.uniforms.uNStone = { value: SURF.stones }; sh.uniforms.uNRock = { value: SURF.rock }; sh.uniforms.uNCrack = { value: SURF.cracked };",
    "sh.uniforms.uNStone = { value: SURF.stones }; sh.uniforms.uNRock = { value: SURF.rock }; sh.uniforms.uNCrack = { value: SURF.cracked };\n    sh.uniforms.uWet = WX.uWet; sh.uniforms.uRainT = WX.uRain; sh.uniforms.uTimeT = uTime;")
rep("sh.fragmentShader = 'uniform sampler2D uMask; uniform sampler2D uNStone; uniform sampler2D uNRock; uniform sampler2D uNCrack; varying vec3 vW; varying vec3 vNw;\\n'",
    "sh.fragmentShader = 'uniform sampler2D uMask; uniform sampler2D uNStone; uniform sampler2D uNRock; uniform sampler2D uNCrack; uniform float uWet; uniform float uRainT; uniform float uTimeT; varying vec3 vW; varying vec3 vNw;\\n'")
rep("""        diffuseColor.rgb = c;
        float vTrailM = max(trailM, scM);""", """        // Nässe: Erde wird dunkel und speckig, in Fahrspuren und Mulden stehen Pfützen
        float tmW = max(trailM, scM);
        float pudN = fbm3(vW.xz * 0.38 + 7.0) * 0.5 + 0.5;
        float pud = tmW * smoothstep(0.64, 0.72, pudN * 0.8 + ruts * 0.3 + n3 * 0.04) * smoothstep(0.25, 0.85, uWet) * (1.0 - smoothstep(0.25, 0.4, slope));
        c *= 1.0 - uWet * mix(0.3, 0.45, tmW);
        c = mix(c, c * vec3(0.8, 0.72, 0.62), uWet * tmW * 0.5);
        c = mix(c, vec3(0.035, 0.03, 0.022), pud * 0.85);
        diffuseColor.rgb = c;
        float vPud = pud;
        float vTrailM = max(trailM, scM);""")
rep("""        roughnessFactor = mix(0.97, 0.86, vTrailM) - 0.1*snow;`)""", """        roughnessFactor = mix(0.97, 0.86, vTrailM) - 0.1*snow;
        roughnessFactor = mix(roughnessFactor, mix(0.62, 0.34, vTrailM), uWet);
        roughnessFactor = mix(roughnessFactor, 0.025, vPud);`)""")
rep("""          normal = normalize(normal + (viewMatrix * vec4(bw, 0.0)).xyz);
        }`);""", """          normal = normalize(normal + (viewMatrix * vec4(bw, 0.0)).xyz * (1.0 - vPud));
        }
        if (vPud > 0.01) {
          // Wasser steht waagrecht; Regentropfen werfen Ringe
          vec2 rip = vec2(0.0);
          if (uRainT > 0.01) {
            vec2 rp = vW.xz * 2.4; vec2 ri = floor(rp); vec2 rf = fract(rp);
            for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
              vec2 o = vec2(float(x), float(y)); float h = hash12(ri + o); float t = fract(uTimeT * (0.9 + 0.5 * h) + h * 5.0);
              vec2 cc = rf - (o + vec2(hash12(ri + o + 3.7), hash12(ri + o + 9.1)));
              float dd = length(cc), rr = t * 0.55;
              float w = sin((dd - rr) * 55.0) * smoothstep(0.09, 0.0, abs(dd - rr)) * (1.0 - t) * step(h, uRainT);
              rip += cc / max(dd, 1e-3) * w;
            }
          }
          vec3 nUp = (viewMatrix * vec4(rip.x * 0.18, 1.0, rip.y * 0.18, 0.0)).xyz;
          normal = normalize(mix(normal, normalize(nUp), vPud));
        }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
        #if defined( RE_IndirectSpecular )
          radiance *= 1.0 + 2.4 * max(vPud, uWet * 0.3);
        #endif`);""")
rep("  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });\n  mat.onBeforeCompile = (sh) => {\n    sh.uniforms.uMask",
    "  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });\n  mat.userData.noWet = true;\n  mat.onBeforeCompile = (sh) => {\n    sh.uniforms.uMask")

# --- Ablauf
rep("  clouds = buildClouds(); scene.add(clouds);", "  clouds = buildClouds(); scene.add(clouds);\n  scene.add(buildWeather());")
rep("  updateCamera(frameDt);\n  // Schatten & Sichtweite um den Spieler",
    "  updateCamera(frameDt);\n  updateWeather(race.state === 'paused' ? 0 : frameDt);\n  if (gradePass) gradePass.uniforms.uStorm.value = FX.storm;\n  // Schatten & Sichtweite um den Spieler")
rep("  resetStartCrew();\n", "  resetStartCrew();\n  resetWeather(); wetPatch(scene);\n")
rep("  applyQuality();\n  // Vorschau hinter dem Menü", "  applyQuality();\n  wetPatch(scene); updateWeather(0);\n  // Vorschau hinter dem Menü")
rep('<div class="eyebrow">Vorabversion · Browser</div>', '<div class="eyebrow">Vorabversion v16 · Wetter · Browser</div>')

# ================= Etappe 2: hochaufgelöste Bodentexturen =================
import base64, json
MODE = sys.argv[3] if len(sys.argv) > 3 else 'embed'
HDK = ['trail_c', 'trail_n', 'meadow_c', 'meadow_n', 'rock_c', 'rock_n', 'forest_c', 'forest_n']
if MODE == 'embed':
    hd = {k: 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(S, 'tex', k + '.webp'), 'rb').read()).decode() for k in HDK}
else:
    hd = {k: 'tex/' + k + '.webp' for k in HDK}
rep('<script id="surfTex" type="application/json">', '<script id="hdTex" type="application/json">' + json.dumps(hd) + '</script>\n<script id="surfTex" type="application/json">')
rep("""const GLSL_TRIPLANAR_N = `""", """// Hochaufgelöste, kachelbare Böden (Strecke, Almwiese, Kalkfels, Waldboden): Farbe+Höhe und Normalen
const HD = (() => {
  const o = {}, tl = new THREE.TextureLoader();
  try {
    const src = JSON.parse(document.getElementById('hdTex').textContent);
    for (const k in src) { const t = tl.load(src[k]); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (k.endsWith('_c')) t.colorSpace = THREE.SRGBColorSpace; o[k] = t; }
  } catch (e) { /* ohne */ }
  return o;
})();
const GLSL_HD = `
vec4 hdTex(sampler2D t, vec2 uv){
  float m = smoothstep(0.3, 0.7, vnoise(uv * 0.31) * 0.5 + 0.5);
  vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.83 + 0.37;
  return mix(texture2D(t, uv), texture2D(t, uv2), m);
}
vec2 hdNrm(sampler2D t, vec2 uv){
  float m = smoothstep(0.3, 0.7, vnoise(uv * 0.31) * 0.5 + 0.5);
  vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.83 + 0.37;
  vec2 a = texture2D(t, uv).xy * 2.0 - 1.0, b = texture2D(t, uv2).xy * 2.0 - 1.0;
  b = mat2(0.8, 0.6, -0.6, 0.8) * b;
  return mix(a, b, m);
}
vec3 hdTint(vec3 proc, vec3 tex, vec3 avg, float k){ return mix(proc, tex * (proc / avg), k); }
vec4 triTex(sampler2D t, vec3 p, vec3 n, float sc){
  vec3 a = abs(n); a = pow(a, vec3(4.0)); a /= (a.x + a.y + a.z);
  return texture2D(t, p.zy * sc) * a.x + texture2D(t, p.xz * sc) * a.y + texture2D(t, p.xy * sc) * a.z;
}
`;
const GLSL_TRIPLANAR_N = `""")
rep("""    sh.uniforms.uWet = WX.uWet; sh.uniforms.uRainT = WX.uRain; sh.uniforms.uTimeT = uTime;""",
    """    sh.uniforms.uWet = WX.uWet; sh.uniforms.uRainT = WX.uRain; sh.uniforms.uTimeT = uTime;
    for (const k of ['trail_c', 'trail_n', 'meadow_c', 'meadow_n', 'rock_c', 'rock_n', 'forest_c', 'forest_n']) sh.uniforms['uHD_' + k] = { value: HD[k] || SURF.stones };""")
rep("""uniform float uWet; uniform float uRainT; uniform float uTimeT; varying vec3 vW; varying vec3 vNw;\\n' + GLSL_NOISE + GLSL_TRIPLANAR_N""",
    """uniform float uWet; uniform float uRainT; uniform float uTimeT; varying vec3 vW; varying vec3 vNw;\\n'
      + 'uniform sampler2D uHD_trail_c; uniform sampler2D uHD_trail_n; uniform sampler2D uHD_meadow_c; uniform sampler2D uHD_meadow_n; uniform sampler2D uHD_rock_c; uniform sampler2D uHD_rock_n; uniform sampler2D uHD_forest_c; uniform sampler2D uHD_forest_n;\\n'
      + GLSL_NOISE + GLSL_HD + GLSL_TRIPLANAR_N""")
# Farben
rep("""        float n1 = fbm3(vW.xz * 0.012), n2 = fbm3(vW.xz * 0.21), n3 = vnoise(vW.xz * 2.7) * detail, n4 = vnoise(vW.xz * 9.0) * detail;""",
    """        float n1 = fbm3(vW.xz * 0.012), n2 = fbm3(vW.xz * 0.21), n3 = vnoise(vW.xz * 2.7) * detail, n4 = vnoise(vW.xz * 9.0) * detail;
        float hdK = (1.0 - smoothstep(90.0, 300.0, camD)) * inside;
        vec4 tMead = hdTex(uHD_meadow_c, vW.xz / 3.2), tFor = hdTex(uHD_forest_c, vW.xz / 4.0), tTr = hdTex(uHD_trail_c, vW.xz / 4.0);""")
rep("""        grass *= 0.8 + 0.3*n2 + 0.1*n3;""", """        grass *= 0.8 + 0.3*n2 + 0.1*n3;
        grass = hdTint(grass, tMead.rgb, vec3(0.1223, 0.1414, 0.0517), hdK * 0.9);""")
rep("""        floorC *= 0.85 + 0.25*n4;""", """        floorC *= 0.85 + 0.25*n4;
        floorC = hdTint(floorC, tFor.rgb, vec3(0.1941, 0.1235, 0.0516), hdK * 0.9);""")
rep("""        rock = mix(rock, vec3(0.72,0.71,0.66) * (0.78 + 0.22*n2 + 0.08*n3), smoothstep(1330.0, 1450.0, vW.y) * 0.85);""",
    """        rock = mix(rock, vec3(0.72,0.71,0.66) * (0.78 + 0.22*n2 + 0.08*n3), smoothstep(1330.0, 1450.0, vW.y) * 0.85);
        vec4 tRk = triTex(uHD_rock_c, vW, normalize(vNw), 0.22) * 0.65 + triTex(uHD_rock_c, vW, normalize(vNw), 0.061) * 0.35;
        rock = hdTint(rock, tRk.rgb, vec3(0.5192, 0.5069, 0.4549), (1.0 - smoothstep(150.0, 600.0, camD)) * inside);""")
rep("""        float pebble = smoothstep(0.16, 0.05, cells(vW.xz*7.0)) * (1.0 - ruts) * detail;""",
    """        float pebble = smoothstep(0.16, 0.05, cells(vW.xz*7.0)) * (1.0 - ruts) * detail * (1.0 - hdK);""")
rep("""        float edge = (1.0 - smoothstep(${TRAIL_HALF.toFixed(2)}, 5.5, td)) * (1.0 - trailM);""",
    """        dirt = hdTint(dirt, tTr.rgb, vec3(0.2493, 0.1833, 0.1140), hdK);
        float edge = (1.0 - smoothstep(${TRAIL_HALF.toFixed(2)}, 5.5, td)) * (1.0 - trailM);""")
rep("""        humus = mix(humus, vec3(0.40,0.39,0.35), smoothstep(0.2, 0.08, cells(vW.xz*1.6)) * detail * 0.8);""",
    """        humus = mix(humus, vec3(0.40,0.39,0.35), smoothstep(0.2, 0.08, cells(vW.xz*1.6)) * detail * 0.8 * (1.0 - hdK));
        humus = hdTint(humus, mix(tFor.rgb, tTr.rgb, 0.5), vec3(0.222, 0.153, 0.083), hdK);""")
# Pfützen füllen Senken der Textur
rep("""smoothstep(0.64, 0.72, pudN * 0.8 + ruts * 0.3 + n3 * 0.04)""", """smoothstep(0.64, 0.72, pudN * 0.8 + ruts * 0.3 + n3 * 0.04 + (0.5 - tTr.a) * 0.18 * hdK)""")
# Normalen
rep("""          vec3 nT = vec3(nSt.x + nSt2.x * 0.6 + nCr.x * 0.5, 0.0, nSt.y + nSt2.y * 0.6 + nCr.y * 0.5);""",
    """          vec2 nTr = hdNrm(uHD_trail_n, vW.xz / 4.0);
          vec3 nT = mix(vec3(nSt.x + nSt2.x * 0.6 + nCr.x * 0.5, 0.0, nSt.y + nSt2.y * 0.6 + nCr.y * 0.5), vec3(nTr.x * 2.4 + nCr.x * 0.25, 0.0, nTr.y * 2.4 + nCr.y * 0.25), hdK);
          vec2 nGr = mix(hdNrm(uHD_meadow_n, vW.xz / 3.2), hdNrm(uHD_forest_n, vW.xz / 4.0), smoothstep(0.15, 0.75, forest));""")
rep("""          vec3 nRk = triN(uNRock, vW, vNw, 0.11) + triN(uNRock, vW, vNw, 0.37) * 0.5;""",
    """          vec3 nRk = triN(uHD_rock_n, vW, vNw, 0.22) * 1.3 + triN(uHD_rock_n, vW, vNw, 0.061) * 0.8 + triN(uNRock, vW, vNw, 0.37) * 0.3;""")
rep("""vec3(nCr.x, 0.0, nCr.y) * (1.0 - tm) * (1.0 - rk) * 0.35) * detail;""",
    """mix(vec3(nCr.x, 0.0, nCr.y) * 0.35, vec3(nGr.x, 0.0, nGr.y) * 0.9, hdK) * (1.0 - tm) * (1.0 - rk)) * detail;""")
rep("""          float cav = mix(1.0, smoothstep(0.35, 1.0, nSt.z * 0.6 + nSt2.z * 0.4) * 0.45 + 0.68, tm * detail);""",
    """          float cav = mix(1.0, smoothstep(0.35, 1.0, nSt.z * 0.6 + nSt2.z * 0.4) * 0.45 + 0.68, tm * detail * (1.0 - hdK));""")
rep('<div class="eyebrow">Vorabversion v16 · Wetter · Browser</div>', '<div class="eyebrow">Vorabversion v17 · Browser</div>')
rep("world.add(buildGrassField(QUALITY === 'high' ? 42000 : 14000, 56));", "world.add(buildGrassField(QUALITY === 'high' ? 72000 : 16000, 60));")

open(out, 'w', encoding='utf-8').write(src)
print('ok', len(src))
