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
open(out, 'w', encoding='utf-8').write(src)
print('ok', len(src))
