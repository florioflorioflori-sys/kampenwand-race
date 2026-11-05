# ================= Etappe 5: Kamera wählbar, Wind, Gegenlicht
# --- Gegenlicht: ganzer Block ersetzt
i0 = src.index('      // Sonne: Glanz, Strahl und Geisterbilder, verdeckt durch Bäume und Berge')
i1 = src.index('      gl_FragColor = vec4(col, 1.0);\n    }`,', i0)
src = src[:i0] + rd('flare.glsl') + src[i1:]

# --- Wind: gemeinsame Werte (Richtung, Stärke), Böen ziehen als Wellen über die Wiese
rep("const uTime = { value: 0 };", "const uTime = { value: 0 };\nconst uWind = { value: new THREE.Vector4(0.83, 0.56, 1.0, 0.0) }; // Richtung x/z, Stärke, -")
rep("""        float gust = sin(uTime * 1.6 + cell.x * 0.21 + cell.y * 0.13) * 0.5 + 0.5;
        transformed.x += aH * aH * (0.10 + 0.12 * gust) * s;
        transformed.z += aH * aH * sin(uTime * 2.3 + cell.y * 0.4) * 0.03 * s;""",
"""        // Böen: Wellen laufen in Windrichtung über die Wiese, dazu feines Flattern
        vec2 wd = uWind.xy; float ws = uWind.z;
        float along = dot(cell, wd), across = dot(cell, vec2(-wd.y, wd.x));
        float wave = sin(along * 0.16 - uTime * 2.1 + sin(across * 0.05) * 2.0) * 0.5 + 0.5;
        float wave2 = sin(along * 0.43 - uTime * 3.4 + across * 0.11) * 0.5 + 0.5;
        float gust = pow(wave, 2.2) * 0.75 + wave2 * 0.25;
        float flut = sin(uTime * 7.0 + aRnd.x * 30.0 + cell.x) * 0.5;
        vec2 bend = wd * (0.05 + 0.26 * gust) * ws + vec2(-wd.y, wd.x) * flut * 0.03 * ws;
        transformed.xz += aH * aH * bend * s * 1.6;
        transformed.y -= aH * aH * gust * 0.12 * ws * s;
        vGust = gust * ws;""")
rep("attribute vec2 aOff; attribute vec3 aRnd; attribute float aH; varying float vGH; varying vec3 vGCol;",
    "attribute vec2 aOff; attribute vec3 aRnd; attribute float aH; varying float vGH; varying vec3 vGCol; varying float vGust; uniform vec4 uWind;")
rep("const uni = { uH: { value: heightTex }, uMask: { value: maskTex }, uCam: { value: new THREE.Vector3() }, uTile: { value: tile }, uDens: { value: 1 }, uTime };",
    "const uni = { uH: { value: heightTex }, uMask: { value: maskTex }, uCam: { value: new THREE.Vector3() }, uTile: { value: tile }, uDens: { value: 1 }, uTime, uWind };")
rep("""    sh.fragmentShader = 'varying float vGH; varying vec3 vGCol;\\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = vGCol * (0.45 + 0.85 * vGH * vGH) * vec3(1.0, 1.0 + 0.15 * vGH, 1.0);`);""",
"""    sh.fragmentShader = 'varying float vGH; varying vec3 vGCol; varying float vGust;\\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = vGCol * (0.45 + 0.85 * vGH * vGH) * vec3(1.0, 1.0 + 0.15 * vGH, 1.0);
      // umgelegte Halme zeigen ihre helle Unterseite: die Böe wird als heller Streifen sichtbar
      diffuseColor.rgb *= 1.0 + vGust * vGH * 0.55;`);""")
# Bäume, Farne, Büsche: Wind stärker und mit Böen gekoppelt
rep("""    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float hh""", """    sh.uniforms.uTime = uTime; sh.uniforms.uWind = uWind;
    sh.vertexShader = 'uniform float uTime; uniform vec4 uWind;\\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        float hh""")
rep("""        float g = sin(uTime * 0.31 + ph * 0.3) * 0.4 + 0.75;
        float sway = hh * hh * ${strength.toFixed(3)} * g;
        transformed.x += sin(uTime * 0.9 + ph) * sway * 0.6;
        transformed.z += cos(uTime * 0.75 + ph * 1.3) * sway * 0.45;
        float fl = ${(strength * 0.05).toFixed(4)} * min(hh * 4.0, 1.0) * g;""",
"""        float along = dot(ip, uWind.xy);
        float gw = pow(sin(along * 0.05 - uTime * 0.9) * 0.5 + 0.5, 2.0);
        float g = (sin(uTime * 0.31 + ph * 0.3) * 0.3 + 0.7 + gw * 1.1) * uWind.z;
        float sway = hh * hh * ${(strength * 1.8).toFixed(3)} * g;
        transformed.xz += uWind.xy * sway * (0.9 + 0.5 * sin(uTime * 1.3 + ph));
        transformed.x += sin(uTime * 0.9 + ph) * sway * 0.35;
        transformed.z += cos(uTime * 0.75 + ph * 1.3) * sway * 0.3;
        float fl = ${(strength * 0.09).toFixed(4)} * min(hh * 4.0, 1.0) * g;""")
rep("mat.customProgramCacheKey = () => 'wind' + strength;", "mat.customProgramCacheKey = () => 'wind2' + strength;")

# --- Kamera: Verfolger nah, Verfolger weit, Ego (Helmkamera); Abstand und Höhe einstellbar, gespeichert
rep("let camMode = 0;", """let camMode = 0;
const CAM = { zoom: 1, h: 0 };
try { const c = JSON.parse(localStorage.getItem('kw_cam') || 'null'); if (c) { camMode = c.m | 0; CAM.zoom = +c.z || 1; CAM.h = +c.h || 0; } } catch (e) { /* kein Speicher */ }
const CAM_NAMES = ['Verfolger', 'Verfolger weit', 'Ego'];
function camSave() { try { localStorage.setItem('kw_cam', JSON.stringify({ m: camMode, z: CAM.zoom, h: CAM.h })); } catch (e) { /* kein Speicher */ } camButtons(); }
function camToast(t) {
  let el = document.getElementById('camToast');
  if (!el) { el = document.createElement('div'); el.id = 'camToast'; el.style.cssText = 'position:fixed;left:50%;top:18%;transform:translateX(-50%);padding:8px 16px;background:rgba(10,12,14,.72);color:#fff;font:600 15px/1.2 system-ui,sans-serif;border-radius:6px;pointer-events:none;transition:opacity .4s;z-index:50'; document.body.appendChild(el); }
  el.textContent = t; el.style.opacity = '1'; clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; }, 1400);
}
function setCam(m) { camMode = ((m % 3) + 3) % 3; camInit = false; camSave(); camToast('Kamera: ' + CAM_NAMES[camMode]); }
function camAdj(dz, dh) {
  if (camMode === 2) return;
  CAM.zoom = Math.min(2.4, Math.max(0.55, CAM.zoom + dz)); CAM.h = Math.min(3, Math.max(-1.2, CAM.h + dh)); camSave();
  camToast('Abstand ' + Math.round(CAM.zoom * 100) + ' % · Höhe ' + (CAM.h >= 0 ? '+' : '') + CAM.h.toFixed(1) + ' m');
}
function camButtons() { document.querySelectorAll('#camSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.c === camMode))); }
document.querySelectorAll('#camSeg button').forEach((b) => { b.onclick = () => { camMode = +b.dataset.c; camSave(); }; });
camButtons();
addEventListener('wheel', (e) => { if (!race || race.state === 'menu') return; if (e.shiftKey) camAdj(0, e.deltaY > 0 ? -0.15 : 0.15); else camAdj(e.deltaY > 0 ? 0.06 : -0.06, 0); }, { passive: true });""")
rep("  if (e.code === 'KeyC') camMode = (camMode + 1) % 3;", """  if (e.code === 'KeyC') setCam(camMode + 1);
  if (e.code === 'KeyV') setCam(camMode === 2 ? 0 : 2);
  if (e.code === 'Equal' || e.code === 'NumpadAdd') camAdj(-0.1, 0);
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') camAdj(0.1, 0);
  if (e.code === 'PageUp') camAdj(0, 0.25);
  if (e.code === 'PageDown') camAdj(0, -0.25);
  if (e.code === 'Digit0' || e.code === 'Numpad0') { CAM.zoom = 1; CAM.h = 0; camSave(); camToast('Kamera zurückgesetzt'); }""")
rep("""  if (camMode === 2) {
    want = _x.copy(P.pos).addScaledVector(P.pitchUp, 1.75).addScaledVector(heading, 0.25);
    look = _y.copy(P.pos).addScaledVector(heading, 12).add(_z.set(0, 0.4, 0));
    camPos.copy(want); camLook.copy(look);
  } else {
    const dist = camMode === 0 ? 4.6 + sp * 0.06 : 9 + sp * 0.08, ht = camMode === 0 ? 1.9 : 3.8;""",
"""  const egoRe = P.model && P.model.userData.real;
  if (camMode === 2) {
    // Helmkamera: sitzt am Kopf des Fahrers, Blick über den Lenker
    // Helmkamera im Rad-System: knapp hinter und über dem Kopf, Blick schräg nach unten über Lenker und Vorderrad
    P.model.updateMatrixWorld(true);
    want = _x.set(0, 1.68, 0.3).applyMatrix4(P.model.matrixWorld);
    if (egoRe && egoRe.bones.Head && P.crashT <= 0) { const hp = egoRe.bones.Head.getWorldPosition(_z); want.lerp(hp.addScaledVector(P.pitchUp, 0.1).addScaledVector(heading, 0.12), 0.25); }
    look = _y.copy(want).addScaledVector(heading, 10).addScaledVector(P.pitchUp, -6.0);
    if (!camInit) { camPos.copy(want); camLook.copy(look); camInit = true; }
    camPos.lerp(want, 1 - Math.exp(-40 * dt)); camLook.lerp(look, 1 - Math.exp(-14 * dt));
  } else {
    const dist = (camMode === 0 ? 4.6 + sp * 0.06 : 9 + sp * 0.08) * CAM.zoom, ht = (camMode === 0 ? 1.9 : 3.8) * (0.6 + 0.4 * CAM.zoom) + CAM.h;""")
rep("  if (!ov && camMode !== 2) camera.rotateZ(-P.lean * 0.12);", """  if (!ov && camMode !== 2) camera.rotateZ(-P.lean * 0.12);
  if (!ov && camMode === 2) camera.rotateZ(-P.lean * 0.55);
  // im Ego-Modus Kopf, Helm und Brille des eigenen Fahrers ausblenden, Nahebene näher
  const egoOn = camMode === 2 && !ov && P.crashT <= 0;
  if (P.model && P.model.userData.egoHide) { const eh = P.model.userData.egoHide; if (eh.on !== egoOn) { eh.on = egoOn; for (const m of eh.mats) m.visible = !egoOn; for (const o of eh.objs) o.visible = !egoOn; } }
  const nr = egoOn ? 0.06 : 0.25; if (camera.near !== nr) { camera.near = nr; camera.updateProjectionMatrix(); }""")
rep("  if (root.userData.real && root.userData.real.blender) helmetVariant(root.userData.real, cfg);\n  return root;",
"""  if (root.userData.real && root.userData.real.blender) helmetVariant(root.userData.real, cfg);
  if (cfg.player && root.userData.real && root.userData.real.blender) {
    const eh = { mats: [], objs: [], on: false }, cl = new Map();
    root.userData.real.holder.traverse((o) => {
      if (o.name === 'Ponytail') { eh.objs.push(o); return; }
      if (!o.isMesh) return;
      const f = (m) => { if (!/^(Skin|Helmet|HelmetAccent|HelmetTrim|Lens|GoggleFrame|Pad|Hair)/.test(m.name)) return m; if (!cl.has(m)) { const c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; cl.set(m, c); eh.mats.push(c); } return cl.get(m); };
      o.material = Array.isArray(o.material) ? o.material.map(f) : f(o.material);
    });
    const hb = root.userData.real.bones.Head; if (hb) for (const c of hb.children) if (!c.isBone) eh.objs.push(c);
    root.userData.egoHide = eh;
  }
  return root;""")
# Menü: Kamera wählen, Tastenhilfe
rep('<div class="teams" id="teams" role="radiogroup" aria-label="Team wählen"></div>',
    '<div class="teams" id="teams" role="radiogroup" aria-label="Team wählen"></div>\n    <div class="teamsLbl">Kamera</div>\n    <div class="seg" id="camSeg" role="group" aria-label="Kamera" style="margin-bottom:14px"><button data-c="0">Verfolger</button><button data-c="1">Verfolger weit</button><button data-c="2">Ego</button></div>')
rep("<dt>R · C · M · Esc</dt><dd>Zurück auf die Strecke · Kamera · Ton · Pause</dd>",
    "<dt>R · C · M · Esc</dt><dd>Zurück auf die Strecke · Kamera wechseln · Ton · Pause</dd>\n      <dt>V · Mausrad · + −</dt><dd>Ego-Perspektive · Kamera-Abstand (Shift + Mausrad, Bild ↑↓: Höhe, 0: zurücksetzen)</dd>")

# --- Fahrer unterschiedlich: Trikot- und Hosenmuster je Fahrer (im Shader auf der Ruhelage), Helmform A/B/C
rep("""function clothFlutter(m, cache) {
  const w = cache.__wind || (cache.__wind = { value: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = w; sh.uniforms.uTime = uTime;""", """function clothFlutter(m, cache) {
  const w = cache.__wind || (cache.__wind = { value: 0 });
  const cfg = cache.__cfg || {}, vi = Math.max(0, [1, 7, 12, 23, 31, 44].indexOf(cfg.num));
  const isP = /^Pants/.test(m.name), isAcc = /Accent$/.test(m.name);
  const jc = new THREE.Color(cfg.jersey || 0xffffff), ac = new THREE.Color(cfg.accent || 0x222222);
  const third = new THREE.Color(jc.getHSL({}).l > 0.5 ? 0x15171a : 0xf2f2ee);
  const pu = { uPat: { value: new THREE.Vector4(isAcc ? 0 : isP ? 10 + (vi % 3) : 1 + vi, vi * 13.7, 0, 0) },
    uPA: { value: isP ? new THREE.Color(cfg.jersey || 0xffffff) : ac }, uPB: { value: third } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, pu);
    sh.vertexShader = 'varying vec3 vRP;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\n  vRP = position;');
    sh.fragmentShader = 'varying vec3 vRP; uniform vec4 uPat; uniform vec3 uPA; uniform vec3 uPB;\\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 p = vRP; float ax = abs(p.x); float pt = uPat.x; float arm = smoothstep(0.2, 0.26, ax);
    float k = 0.0; vec3 c2 = uPA;
    if (pt > 0.5 && pt < 1.5) { float d = p.y - 1.26 + ax * 0.7; k = step(0.0, d) * step(d, 0.075) + step(0.11, d) * step(d, 0.135); k *= 1.0 - arm; k = max(k, arm * step(0.62, ax) * step(ax, 0.66)); }
    else if (pt > 1.5 && pt < 2.5) { k = step(0.5, fract(p.y * 6.5)) * step(p.y, 1.42) * (1.0 - arm); k = max(k, arm * step(0.45, ax)); }
    else if (pt > 2.5 && pt < 3.5) { float d = p.x * 0.9 + p.y - 1.25; k = step(abs(d), 0.07) * (1.0 - arm); c2 = mix(uPA, uPB, step(abs(d), 0.025)); k = max(k, step(abs(d), 0.07)); }
    else if (pt > 3.5 && pt < 4.5) { k = step(0.13, ax) * step(p.y, 1.36) * (1.0 - arm); c2 = uPB; if (p.y > 1.4 && ax < 0.3) { k = 1.0; c2 = uPA; } k = max(k, arm * step(0.36, ax) * step(ax, 0.5) * step(0.0, p.z) * 0.0 + arm * step(0.36, ax) * step(ax, 0.48)); }
    else if (pt > 4.5 && pt < 5.5) { k = smoothstep(1.05, 1.5, p.y + sin(p.x * 18.0) * 0.03) * (1.0 - arm) + arm * smoothstep(0.3, 0.6, ax);
      float sp = fract(sin(dot(floor(p.xy * 90.0 + p.z * 30.0), vec2(12.9, 78.2))) * 43758.5); k = clamp(k + step(0.93, sp) * 0.8 * (1.0 - k), 0.0, 1.0); }
    else if (pt > 5.5 && pt < 6.5) { vec2 g = vec2(p.x * 9.0 + p.z * 4.0, p.y * 9.0); vec2 id = floor(g), f = fract(g);
      float h = fract(sin(dot(id, vec2(12.9, 78.2)) + uPat.y) * 43758.5); k = step(0.55, h) * step(f.x, f.y); c2 = mix(uPA, uPB, step(0.8, h)); }
    else if (pt > 10.5 && pt < 11.5) { k = step(0.32, p.y) * step(p.y, 0.62) * step(0.02, p.z) * 0.9; c2 = uPA; }
    else if (pt > 11.5 && pt < 12.5) { float d = abs(p.x) - 0.15; k = step(abs(abs(p.x) - 0.17), 0.018) * step(0.1, p.y); c2 = uPA; }
    diffuseColor.rgb = mix(diffuseColor.rgb, c2, clamp(k, 0.0, 1.0));
  }`);""")
rep("""    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nuniform float uWind; uniform float uTime;')""",
    """    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\\nuniform float uWind; uniform float uTime;')""")
rep("""function tintRiderMats(root, cfg, cache) {""", """function tintRiderMats(root, cfg, cache) {
  cache.__cfg = cfg;""")
rep("""    holder.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) o.frustumCulled = false; if (o.name === 'Ponytail') o.visible = !!female; });""",
"""    const hv = 'ABC'[[1, 7, 12, 23, 31, 44].indexOf(cfg.num) % 3] || 'A';
    holder.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isSkinnedMesh) o.frustumCulled = false; if (o.name === 'Ponytail') o.visible = !!female; if (/^Helm[ABC]$/.test(o.name)) o.visible = o.name === 'Helm' + hv; });""")
# Rahmenform je Fahrer
rep("    put(Bk.Frame, bike);", "    const fv = [1, 7, 12, 23, 31, 44].indexOf(cfg.num); put([Bk.Frame, Bk.Frame2 || Bk.Frame, Bk.Frame3 || Bk.Frame][(fv < 0 ? cfg.num : fv) % 3], bike);")
rep('<div class="eyebrow">Vorabversion v19 · Zuschauer · Browser</div>', '<div class="eyebrow">Vorabversion v20 · Kameras, Wind, Gegenlicht · Browser</div>')
# Kampenwandbahn: kleine, bunte Vierer-Kabinen (Markenzeichen der Bahn, seit 1957)
rep("    const CM = i % 3 === 1 ? M.yellow : M.red;",
    "    const CM = (gondolas.CM || (gondolas.CM = [0xd4141c, 0xf2c418, 0x1d7fd0, 0x2f9e44, 0xf07a1a, 0x8a3fb8, 0xe8458b, 0x14a6a6].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.25 }))))[(i * 5) % 8];")
rep("  const NG = 24;\n", "  const NG = 48;\n")
rep("  const fov = 66 + clamp(sp - 8, 0, 18) * 0.7;", "  const fov = 66 + clamp(sp - 8, 0, 18) * 0.7 + (camMode === 2 && !ov ? 16 : 0);")

# --- Zuschauer: Stoffstruktur, Hautporen, Haarsträhnen als feines Relief; glänzende Augen, Haar mit Schimmer, Haut mit Rotschimmer im Streiflicht
rep("varying vec3 vSpP; varying vec3 vSpAcc; varying vec2 vSpPat; varying float vSpSlot; varying vec3 vSpQ; varying vec4 vSpF; varying float vSpMo;\nfloat spG(",
    "varying vec3 vSpP; varying vec3 vSpAcc; varying vec2 vSpPat; varying float vSpSlot; varying vec3 vSpQ; varying vec4 vSpF; varying float vSpMo; varying float vSpBit;\nfloat spG(")
rep("vSpP = spModel(transformed); vSpSlot = aSlot;", "vSpP = spModel(transformed); vSpSlot = aSlot; vSpBit = aBit;")
SPEC_DETAIL = r"""
  // Feinrelief je Teil: Strick/Webstoff, Hautporen und Fältchen, Haarsträhnen
  {
    vec3 p = vSpP; float hb = 0.0;
    if (vSpSlot > 0.5 && vSpSlot < 4.5) {
      float w1 = sin(p.x * 1150.0 + p.z * 900.0 + sin(p.y * 380.0) * 2.0), w2 = sin(p.y * 1250.0 + sin(p.x * 420.0 + p.z * 300.0) * 2.0);
      hb = (w1 * 0.5 + 0.5) * (w2 * 0.5 + 0.5) * 0.00045 + sin(p.y * 90.0 + sin(p.x * 30.0) * 3.0) * 0.0006;
    } else if (vSpSlot > -0.5 && vSpSlot < 0.5) {
      float n1 = fract(sin(dot(floor(p * 2200.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      hb = n1 * 0.00006 + sin(p.y * 2400.0 + p.x * 900.0) * 0.00002;
    } else if (vSpSlot > 4.5 && vSpSlot < 5.5) {
      float st = sin(p.x * 1500.0 + sin(p.y * 160.0 + p.z * 120.0) * 4.0 + p.z * 600.0);
      hb = st * 0.00035; diffuseColor.rgb *= 0.86 + 0.24 * (st * 0.5 + 0.5);
    }
    if (hb != 0.0) {
      vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
      vec3 R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1);
      vec3 grad = sign(det) * (dFdx(hb) * R1 + dFdy(hb) * R2);
      normal = normalize(abs(det) * normal - grad * 1.0);
    }
  }
"""
rep("""    if (!depth) sh.fragmentShader = 'varying vec3 vSpP; varying vec3 vSpAcc; varying vec2 vSpPat; varying float vSpSlot; varying vec3 vSpQ; varying vec4 vSpF; varying float vSpMo;\\nfloat spGf(vec3 p, vec3 c, float r) { vec3 d = (p - c) / r; return exp(-dot(d, d)); }\\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n' + SPEC_FRAG);""",
"""    if (!depth) sh.fragmentShader = 'varying vec3 vSpP; varying vec3 vSpAcc; varying vec2 vSpPat; varying float vSpSlot; varying vec3 vSpQ; varying vec4 vSpF; varying float vSpMo; varying float vSpBit;\\nfloat spGf(vec3 p, vec3 c, float r) { vec3 d = (p - c) / r; return exp(-dot(d, d)); }\\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\\n' + SPEC_FRAG)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  if (vSpSlot > -0.5 && vSpSlot < 0.5) roughnessFactor = 0.52;
  if (vSpSlot > 4.5 && vSpSlot < 5.5) roughnessFactor = 0.42;
  if (vSpBit > 12.5) roughnessFactor = 0.08;`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\\n' + SPEC_DETAIL_GLSL)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  if (vSpSlot > -0.5 && vSpSlot < 0.5) { float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0); totalEmissiveRadiance += diffuseColor.rgb * vec3(0.9, 0.35, 0.25) * fr * 0.07; }`);""")
rep("function specPatch(mat, blend, depth) {", "const SPEC_DETAIL_GLSL = `" + SPEC_DETAIL.replace('`', '') + "`;\nfunction specPatch(mat, blend, depth) {")
rep("mat.customProgramCacheKey = () => 'spec' + (blend ? 'B' : '') + (depth ? 'D' : '');", "mat.customProgramCacheKey = () => 'spec2' + (blend ? 'B' : '') + (depth ? 'D' : '');")
# Rückennummer mit Teamname auf dem Trikot (Aufdruck am Brustkorb-Knochen)
rep("""  if (v.cam && e.bones.Head) {
    // kleine Actionkamera oben auf dem Helm""", """  if (e.bones.spine_03) {
    e.holder.updateMatrixWorld(true);
    const hex = (c) => '#' + new THREE.Color(c).getHexString();
    const tex = canvasTex(256, 320, (x, w, h) => {
      x.clearRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineJoin = 'round'; x.strokeStyle = '#111'; x.fillStyle = '#fff';
      x.font = '800 54px "Saira Condensed", Arial Narrow, sans-serif'; x.lineWidth = 8; x.strokeText(cfg.short || '', w / 2, 40); x.fillText(cfg.short || '', w / 2, 40);
      x.font = '800 200px "Saira Condensed", Arial Narrow, sans-serif'; x.lineWidth = 14; x.strokeText(String(cfg.num), w / 2, 200); x.fillText(String(cfg.num), w / 2, 200);
    });
    const dm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3, 6, 6), dm);
    { const pa = dec.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); const y = pa.getY(i); pa.setZ(i, -x * x * 1.6 - y * y * 1.2); } dec.geometry.computeVertexNormals(); }
    dec.position.set(0, 1.25, -0.142); dec.rotation.y = Math.PI; dec.updateMatrix();
    dec.matrix.premultiply(new THREE.Matrix4().copy(e.bones.spine_03.matrixWorld).invert().multiply(e.holder.matrixWorld));
    dec.matrix.decompose(dec.position, dec.quaternion, dec.scale); dec.castShadow = false;
    e.bones.spine_03.add(dec);
  }
  if (v.cam && e.bones.Head) {
    // kleine Actionkamera oben auf dem Helm""")
