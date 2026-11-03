// ------------------------------------------------------------------
// Wetter: strahlende Sonne an der Bergstation, nach rund einem Viertel der
// Strecke zieht schlagartig ein Gewitter mit Starkregen auf, kurz vor dem
// Ziel in Aschau reißt es auf und die Sonne kommt zurück (mit Regenbogen).
// ------------------------------------------------------------------
const WX = {
  cloud: 0.06, rain: 0, wet: 0, flash: 0, rainbow: 0, force: null, nextBolt: 4, envCloud: -1, envT: 0,
  uCloud: { value: 0.06 }, uRain: { value: 0 }, uWet: { value: 0 }, uFlash: { value: 0 }, uRainbow: { value: 0 },
  uFogCol: { value: new THREE.Color() }, uSunDir: { value: sunDir }, uCamVel: { value: new THREE.Vector3() },
  lastCam: new THREE.Vector3(), rainMesh: null, splashMesh: null, dome: null, bow: null, pm: null, envScene: null, envRT: null,
};
const GLSL_FBM5 = `
float wh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float wn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), u.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), u.x), u.y); }
float wfbm(vec2 p){ float s = 0.0, a = 0.5; mat2 R = mat2(0.8, -0.6, 0.6, 0.8); for (int i = 0; i < 6; i++) { s += a * wn(p); p = R * p * 2.03 + 11.7; a *= 0.5; } return s; }
`;
// Wolkendecke als Kuppel um die Kamera: Haufenwolken bei Sonne, tiefe Gewitterbasis bei Regen
function makeCloudDomeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uCloud: WX.uCloud, uFlash: WX.uFlash, uTime, uSunDir: WX.uSunDir, uFogCol: WX.uFogCol, uRain: WX.uRain },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform float uCloud; uniform float uFlash; uniform float uTime; uniform vec3 uSunDir; uniform vec3 uFogCol; uniform float uRain; varying vec3 vDir;
      ${GLSL_FBM5}
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.035);
        vec2 p = d.xz / y;
        vec2 wind = vec2(0.010, 0.004) * uTime * (1.0 + 2.5 * uCloud);
        // Haufenwolken (hoch) und Gewitterbasis (tief, schnell ziehend)
        vec2 q = p * 0.55 + wind;
        float n = wfbm(q), nl = wfbm(q + uSunDir.xz * 0.06);
        float cov = mix(0.70, 0.18, uCloud);
        float dens = smoothstep(cov, cov + mix(0.22, 0.35, uCloud), n);
        float base = wfbm(p * 0.9 + wind * 2.2 + 40.0);
        float storm = smoothstep(0.35, 0.95, uCloud);
        dens = max(dens, storm);
        // Licht: zur Sonne hin dünner -> heller Rand, dicke Bäuche dunkel
        float lit = clamp(0.55 + (n - nl) * 6.0, 0.0, 1.0);
        float mu = max(dot(d, uSunDir), 0.0);
        vec3 sunC = vec3(1.0, 0.95, 0.86) * (1.55 + 1.2 * pow(mu, 12.0));
        vec3 shadeC = vec3(0.52, 0.58, 0.70);
        vec3 col = mix(shadeC, sunC, lit) * mix(1.0, 0.75, smoothstep(0.75, 1.0, dens));
        // Gewitterwolken: schiefergrau mit helleren Fetzen
        vec3 stormC = mix(vec3(0.085, 0.095, 0.11), vec3(0.20, 0.22, 0.25), smoothstep(0.35, 0.75, base)) * (0.8 + 0.4 * wn(p * 3.0 + wind * 5.0));
        col = mix(col, stormC, storm);
        col *= 1.0 + uFlash * 5.0 * (0.6 + 0.4 * wn(p * 0.5 + uTime));
        // Horizont: in Dunst auflösen
        float hz = smoothstep(0.0, 0.16, d.y);
        col = mix(uFogCol, col, mix(hz, 1.0, storm * 0.4));
        float a = dens * smoothstep(-0.01, 0.07, d.y);
        a = max(a, storm * (1.0 - smoothstep(0.0, 0.05, d.y)) * 0.0);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, depthTest: true, fog: false, side: THREE.BackSide,
  });
}
// Regenbogen gegenüber der Sonne (42 Grad um den Gegenpunkt), nur nach dem Schauer
function makeRainbowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uRainbow: WX.uRainbow, uSunDir: WX.uSunDir },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform float uRainbow; uniform vec3 uSunDir; varying vec3 vDir;
      vec3 spec(float x){ return clamp(vec3(1.5 - abs(x - 0.85) * 4.0, 1.5 - abs(x - 0.5) * 4.0, 1.5 - abs(x - 0.15) * 4.0) - 0.5, 0.0, 1.0); }
      void main(){
        vec3 d = normalize(vDir);
        vec3 anti = normalize(vec3(-uSunDir.x, -0.26 * length(uSunDir.xz), -uSunDir.z));
        float ang = degrees(acos(clamp(dot(d, anti), -1.0, 1.0)));
        float x = (ang - 40.4) / 2.4;
        float x2 = (ang - 50.2) / 3.4;
        vec3 c = spec(clamp(x, 0.0, 1.0)) * smoothstep(-0.05, 0.12, x) * smoothstep(1.05, 0.88, x);
        c += spec(clamp(1.0 - x2, 0.0, 1.0)) * smoothstep(-0.05, 0.12, x2) * smoothstep(1.05, 0.88, x2) * 0.35;
        c += vec3(0.05) * smoothstep(40.6, 30.0, ang) * smoothstep(20.0, 34.0, ang);
        float h = smoothstep(0.0, 0.06, d.y) * (0.45 + 0.55 * smoothstep(0.02, 0.25, d.y));
        gl_FragColor = vec4(c * uRainbow * h * 0.55, 1.0);
      }`,
    transparent: true, depthWrite: false, depthTest: true, fog: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
  });
}
// Regenschnüre: viele Streifen in einem Kasten um die Kamera, im Shader bewegt und
// entlang der Fallrichtung relativ zur Kamera gestreckt (Bewegungsunschärfe)
function buildRain(N) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const r = mulberry32(5150), a = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { a[i * 4] = r(); a[i * 4 + 1] = r(); a[i * 4 + 2] = r(); a[i * 4 + 3] = r(); }
  g.setAttribute('aR', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime, uRain: WX.uRain, uCamVel: WX.uCamVel, uFlash: WX.uFlash, uFogCol: WX.uFogCol },
    vertexShader: `attribute vec4 aR; uniform float uTime; uniform float uRain; uniform vec3 uCamVel; varying float vA; varying float vX; varying float vY;
      void main(){
        vec3 box = vec3(44.0, 24.0, 44.0);
        float sp = 8.5 + aR.w * 3.5;
        vec3 vel = vec3(1.6 + aR.w * 0.6, -sp, 0.7);
        vec3 p = aR.xyz * box + vel * uTime;
        p = cameraPosition + mod(p - cameraPosition, box) - box * 0.5;
        p.y += 6.0;
        vec4 c = viewMatrix * vec4(p, 1.0);
        vec3 dv = (viewMatrix * vec4(vel - uCamVel, 0.0)).xyz * 0.045;
        float dist = -c.z;
        vec3 side = normalize(cross(dv, c.xyz)) * (0.009 + dist * 0.0026);
        c.xyz += dv * position.y + side * position.x;
        float on = step(aR.w, uRain * 1.02) * step(0.2, dist);
        vA = on * (1.0 - smoothstep(14.0, 24.0, dist)) * smoothstep(0.2, 1.2, dist);
        vX = position.x; vY = position.y;
        gl_Position = projectionMatrix * c;
        if (on < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `uniform float uFlash; uniform vec3 uFogCol; varying float vA; varying float vX; varying float vY;
      void main(){
        float a = vA * (1.0 - abs(vX)) * smoothstep(0.0, 0.3, vY) * smoothstep(1.0, 0.7, vY) * 0.9;
        vec3 c = mix(vec3(0.85, 0.9, 0.98), uFogCol * 2.2, 0.35) * (1.0 + uFlash * 4.0);
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, fog: false,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 5;
  return m;
}
// Einschläge am Boden: kleine Ringe und Spritzer, auf das Gelände gesetzt
function buildSplashes(N) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  const r = mulberry32(777), a = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { a[i * 4] = r(); a[i * 4 + 1] = r(); a[i * 4 + 2] = r(); a[i * 4 + 3] = r(); }
  g.setAttribute('aR', new THREE.InstancedBufferAttribute(a, 4));
  g.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime, uRain: WX.uRain, uH: { value: heightTex }, uFogCol: WX.uFogCol },
    vertexShader: `attribute vec4 aR; uniform float uTime; uniform float uRain; uniform sampler2D uH; varying vec2 vUv; varying float vT; varying float vA;
      float hFetch(vec2 w){ vec2 gg = clamp((w + ${HALF.toFixed(1)}) / ${CELL.toFixed(6)}, vec2(0.0), vec2(${(G - 2).toFixed(1)})); ivec2 i = ivec2(floor(gg)); vec2 f = fract(gg);
        float a = texelFetch(uH, i, 0).r, b = texelFetch(uH, i + ivec2(1,0), 0).r, c = texelFetch(uH, i + ivec2(0,1), 0).r, d = texelFetch(uH, i + ivec2(1,1), 0).r;
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      void main(){
        float rate = 1.6 + aR.z;
        float cyc = uTime * rate + aR.w * 17.0;
        float k = floor(cyc); vT = fract(cyc);
        float h1 = fract(sin(k * 12.9898 + aR.x * 78.233) * 43758.5453), h2 = fract(sin(k * 39.346 + aR.y * 11.135) * 24634.6345);
        vec2 tile = vec2(26.0);
        vec2 w = (vec2(aR.x, aR.y) + vec2(h1, h2) * 0.37) * tile;
        w = cameraPosition.xz + mod(w - cameraPosition.xz, tile) - tile * 0.5;
        float y = hFetch(w) + 0.035;
        float s = 0.015 + vT * (0.05 + aR.z * 0.05);
        vec3 p = vec3(w.x, y, w.y) + position * s;
        vUv = position.xz;
        float on = step(aR.z, uRain);
        vA = on * (1.0 - smoothstep(5.0, 12.0, length(w - cameraPosition.xz)));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        if (on < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: `uniform vec3 uFogCol; varying vec2 vUv; varying float vT; varying float vA;
      void main(){
        float r = length(vUv);
        float ring = smoothstep(0.7, 0.88, r) * smoothstep(1.0, 0.9, r) * 0.6;
        float dot0 = smoothstep(0.35, 0.0, r) * (1.0 - smoothstep(0.0, 0.25, vT)) * 1.5;
        float a = (ring + dot0) * (1.0 - vT) * vA * 0.32;
        gl_FragColor = vec4(vec3(0.75, 0.78, 0.82), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 4;
  return m;
}
// Nässe für alle übrigen Materialien: dunkler und glänzender, Oberseiten am stärksten
const WET_CHUNK = `{ vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float wk = uWet * (0.5 + 0.5 * clamp(dot(normal, upV), 0.0, 1.0));
  diffuseColor.rgb *= 1.0 - 0.3 * wk;
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.62 + 0.14, wk); }
#include <lights_physical_fragment>`;
function wetPatch(root) {
  const base = THREE.Material.prototype.customProgramCacheKey;
  root.traverse((o) => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) {
      if (!m.isMeshStandardMaterial || m.userData.wetP || m.userData.noWet) continue;
      m.userData.wetP = true;
      const ob = m.onBeforeCompile, ok = m.customProgramCacheKey;
      const key0 = ok === base ? ob.toString() : null;
      m.onBeforeCompile = function (sh, r) {
        ob.call(this, sh, r);
        sh.uniforms.uWet = WX.uWet;
        sh.fragmentShader = 'uniform float uWet;\n' + sh.fragmentShader.replace('#include <lights_physical_fragment>', WET_CHUNK);
      };
      m.customProgramCacheKey = function () { return (key0 ?? ok.call(this)) + '|wet'; };
      m.needsUpdate = true;
    }
  });
}
function buildWeather() {
  const grp = new THREE.Group();
  WX.dome = new THREE.Mesh(new THREE.SphereGeometry(30000, 48, 24), makeCloudDomeMaterial());
  WX.dome.renderOrder = -1; WX.dome.frustumCulled = false;
  WX.bow = new THREE.Mesh(new THREE.SphereGeometry(29000, 64, 32), makeRainbowMaterial());
  WX.bow.renderOrder = 0; WX.bow.frustumCulled = false; WX.bow.visible = false;
  WX.rainMesh = buildRain(QUALITY === 'high' ? 16000 : 6000);
  WX.splashMesh = buildSplashes(QUALITY === 'high' ? 2600 : 900);
  grp.add(WX.dome, WX.bow, WX.rainMesh, WX.splashMesh);
  // Umgebungslicht für Spiegelungen: Himmel samt Wolkendecke, wird bei Wetterwechsel neu gerechnet
  WX.pm = new THREE.PMREMGenerator(renderer);
  WX.envScene = new THREE.Scene(); WX.envScene.add(makeSky(1000));
  const ed = new THREE.Mesh(new THREE.SphereGeometry(950, 32, 16), makeCloudDomeMaterial()); WX.envScene.add(ed);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.10, 0.12, 0.06) }));
  ground.position.y = -40; WX.envScene.add(ground);
  return grp;
}
function weatherTarget() {
  if (WX.force) return WX.force;
  if (!player || race.state === 'menu' || race.state === 'loading' || race.state === 'countdown') return [0.06, 0];
  const s = player.s, L = trail.L;
  if (player.finished || s > L - 170) return [0.1, 0];
  if (s > L * 0.235) return [1, 1];
  if (s > L * 0.2) return [0.62, 0];
  return [0.06, 0];
}
function resetWeather() { WX.cloud = 0.06; WX.rain = 0; WX.wet = 0; WX.flash = 0; WX.rainbow = 0; WX.nextBolt = 4; }
const STORM_FOG = new THREE.Color(0.22, 0.245, 0.275), _wc = new THREE.Color();
const SKY_HEMI = new THREE.Color(0.5, 0.65, 0.95), GND_HEMI = new THREE.Color(0.20, 0.18, 0.10), STORM_HEMI = new THREE.Color(0.55, 0.6, 0.68);
function updateWeather(dt) {
  const [tc, tr] = weatherTarget();
  const clearing = tc < WX.cloud;
  // aufziehen: schnell und düster; aufreißen: Regen hört zuerst auf, dann bricht die Sonne durch
  WX.cloud = clearing ? (WX.rain > 0.15 ? WX.cloud : Math.max(tc, WX.cloud - dt * 0.11)) : Math.min(tc, WX.cloud + dt * 0.16);
  const rt = tr > 0 && WX.cloud > 0.8 ? tr : 0;
  WX.rain = rt > WX.rain ? Math.min(rt, WX.rain + dt * 0.3) : Math.max(rt, WX.rain - dt * 0.3);
  WX.wet = WX.rain > WX.wet ? Math.min(WX.rain, WX.wet + dt * 0.09) : Math.max(0, WX.wet - dt * 0.006);
  // Regenbogen: wenn die Sonne in den abziehenden Schauer scheint
  const bowT = tc < 0.5 && WX.cloud < 0.55 && WX.rain < 0.05 && WX.wet > 0.3 ? 1 : 0;
  WX.rainbow = damp(WX.rainbow, bowT, bowT ? 0.5 : 0.08, dt);
  // Blitze
  if (WX.rain > 0.75) {
    WX.nextBolt -= dt;
    if (WX.nextBolt <= 0) { WX.flash = 1; WX.nextBolt = 6 + Math.random() * 10; thunder(0.5 + Math.random() * 2.2); }
  }
  WX.flash = Math.max(0, WX.flash - dt * 4.5);
  const fl = WX.flash > 0 ? WX.flash * (0.55 + 0.45 * Math.sin(uTime.value * 61) * Math.sin(uTime.value * 23)) : 0;
  const k = WX.cloud, st = smooth(0.3, 1, k);
  WX.uCloud.value = k; WX.uRain.value = WX.rain; WX.uWet.value = WX.wet; WX.uFlash.value = Math.max(0, fl); WX.uRainbow.value = WX.rainbow;
  // Licht und Dunst
  sun.intensity = 3.25 * (1 - 0.9 * st) + fl * 2;
  hemi.intensity = 0.55 + 0.5 * st + fl * 3.5;
  hemi.color.copy(SKY_HEMI).lerp(STORM_HEMI, st); hemi.groundColor.copy(GND_HEMI).multiplyScalar(1 - 0.3 * st);
  _wc.copy(FOG_COL).lerp(STORM_FOG, st); scene.fog.color.copy(_wc); WX.uFogCol.value.copy(_wc);
  scene.fog.density = 0.00002 + 0.0011 * st * st + 0.0026 * WX.rain;
  renderer.toneMappingExposure = 1.06 + 0.32 * st;
  if (clouds) for (const c of clouds.children) c.material.opacity = (c.userData.op ??= c.material.opacity) * (1 - st);
  FX.storm = st;
  // Regen und Kamera-Bewegung (für die Schrägstellung der Tropfen)
  if (dt > 0) WX.uCamVel.value.copy(camera.position).sub(WX.lastCam).divideScalar(dt).clampLength(0, 40);
  WX.lastCam.copy(camera.position);
  if (WX.rainMesh) { WX.rainMesh.visible = WX.rain > 0.01; WX.splashMesh.visible = WX.rain > 0.01; }
  if (WX.dome) { WX.dome.position.copy(camera.position); WX.bow.position.copy(camera.position); WX.bow.visible = WX.rainbow > 0.01; }
  // Spiegelungen nachziehen
  WX.envT -= dt;
  if (WX.pm && Math.abs(k - WX.envCloud) > 0.05 && WX.envT <= 0) {
    WX.envCloud = k; WX.envT = 0.4;
    const old = WX.envRT; WX.envRT = WX.pm.fromScene(WX.envScene, 0, 0.1, 2000); scene.environment = WX.envRT.texture; if (old) old.dispose();
  }
  updateRainAudio();
}
function thunder(delay) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx, t = ctx.currentTime + delay;
  const src = ctx.createBufferSource(); src.buffer = audio.noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(90, t + 2.5);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.05); g.gain.setValueAtTime(0.5, t + 0.4);
  g.gain.linearRampToValueAtTime(0.7, t + 0.9); g.gain.exponentialRampToValueAtTime(0.001, t + 4.2);
  src.connect(f).connect(g).connect(audio.master); src.start(t); src.stop(t + 4.5);
}
function updateRainAudio() {
  if (!audio.ctx) return;
  if (!audio.rain) {
    const ctx = audio.ctx, src = ctx.createBufferSource(); src.buffer = audio.noiseBuf; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(hp).connect(lp).connect(g).connect(audio.master); src.start();
    audio.rain = g;
  }
  audio.rain.gain.setTargetAtTime(audio.muted ? 0 : WX.rain * 0.28, audio.ctx.currentTime, 0.3);
}
