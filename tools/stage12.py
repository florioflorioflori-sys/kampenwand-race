# v27: Banner-Seile weg von der Strecke, detailliertere Gesichter mit Make-up und Augenfarbe,
# modische Frauen, doppelt so viele Zuschauer, Werbung überarbeitet und dichter
# --- Abspannseile der Seilbanner zeigen von der Strecke weg
rep("rotateX(0.9), frame, sx * (w / 2 + 0.1), top * 0.55, -0.75)", "rotateX(-0.9), frame, sx * (w / 2 + 0.1), top * 0.55, 0.75)")
# --- Gesicht: neues Uniform uMo5 (Lippenstift, Lidstrich, Rouge, Augenfarbe)
rep("uMo4: { value: new THREE.Vector4() } };", "uMo4: { value: new THREE.Vector4() }, uMo5: { value: new THREE.Vector4() } };")
rep("uniform vec4 uMo3; uniform vec4 uMo4;", "uniform vec4 uMo3; uniform vec4 uMo4; uniform vec4 uMo5;")
rep("varying float vSpMo; varying float vSpBit;\nfloat spG(", "varying float vSpMo; varying float vSpBit; varying vec4 vSpG;\nfloat spG(")
rep("vSpQ = vec3(0.0, -9.0, 0.0); vSpF = vec4(0.0); vSpMo = 0.0;", "vSpQ = vec3(0.0, -9.0, 0.0); vSpF = vec4(0.0); vSpMo = 0.0; vSpG = vec4(0.0);")
rep("vSpF = uMo4; vSpMo = uMo2.w;", "vSpF = uMo4; vSpMo = uMo2.w; vSpG = uMo5;")
rep("varying float vSpBit; varying vec2 vSpCard;", "varying float vSpBit; varying vec2 vSpCard; varying vec4 vSpG;")
rep("u0.uMo4.value.set(mo.age, mo.ruddy, mo.stubble, mo.freckles);", "u0.uMo4.value.set(mo.age, mo.ruddy, mo.stubble, mo.freckles); if (u0.uMo5) u0.uMo5.value.set(mo.lip || 0, mo.liner || 0, mo.blush || 0, mo.eye || 0);")
rep("freckles: r() < 0.14 ? 0.5 + r() * 0.5 : 0,",
    """freckles: r() < 0.14 ? 0.5 + r() * 0.5 : 0,
    lip: !M && !h.kid ? (h.glam ? 0.55 + r() * 0.45 : r() < 0.4 ? r() * 0.5 : 0) : 0,
    liner: !M && !h.kid ? (h.glam ? 0.6 + r() * 0.4 : r() * 0.35) : 0,
    blush: !M && !h.kid ? (h.glam ? 0.35 + r() * 0.4 : r() * 0.25) : 0,
    eye: r() < 0.45 ? 0 : r() < 0.55 ? 1 : r() < 0.6 ? 2 : 3,""")
# Hautdetails: Lidschatten und Lidstrich, Rouge, Augenringe, Nasenflügel, Philtrum, Kinngrübchen, Lachfältchen
rep("    diffuseColor.rgb *= 0.965 + 0.07 * nz;",
"""    {
      float lid = spGf(qa, vec3(0.031, 1.689, 0.092), 0.011), lash = spGf(qa, vec3(0.033, 1.6835, 0.096), 0.0075);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.72, 0.62, 0.66), clamp(lid * (0.12 + vSpG.y * 0.6), 0.0, 0.65));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.035, 0.03), clamp(lash * (0.3 + vSpG.y * 0.55), 0.0, 0.8));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 0.78, 0.8), clamp(ck * vSpG.z * 0.8, 0.0, 0.5));
      diffuseColor.rgb *= 1.0 - spGf(qa, vec3(0.03, 1.667, 0.088), 0.011) * (0.1 + vSpF.x * 0.14);
      diffuseColor.rgb *= 1.0 - spGf(qa, vec3(0.016, 1.633, 0.104), 0.007) * 0.2;
      diffuseColor.rgb *= 1.0 - spGf(qa, vec3(0.03, 1.7, 0.085), 0.016) * 0.14;
      float ph = exp(-pow(q.x / 0.0035, 2.0)) * smoothstep(1.616, 1.62, q.y) * (1.0 - smoothstep(1.628, 1.632, q.y)) * fr;
      diffuseColor.rgb *= 1.0 - ph * 0.07;
      diffuseColor.rgb *= 1.0 - spGf(q, vec3(0.0, 1.592, 0.1), 0.012) * 0.06 + spGf(q, vec3(0.0, 1.585, 0.105), 0.01) * 0.04;
      diffuseColor.rgb *= 1.0 + spGf(q, vec3(0.0, 1.66, 0.12), 0.012) * 0.05 + spGf(qa, vec3(0.04, 1.715, 0.09), 0.02) * 0.03;
    }
    diffuseColor.rgb *= 0.965 + 0.07 * nz;""")
# Lippen: Farbe, Lippenstift, Mundspalte, Glanz der Unterlippe; Iris mit Augenfarbe und Struktur
rep("""  if (vSpSlot > -0.5 && vSpSlot < 0.5) { float lu = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(vec3(lu), diffuseColor.rgb, 0.72) * 1.06; }`;""",
"""  if (vSpSlot > -0.5 && vSpSlot < 0.5) { float lu = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(vec3(lu), diffuseColor.rgb, 0.72) * 1.06; }
  if (vSpSlot > 9.5 && vSpSlot < 10.5 && vSpQ.y > 1.5) {
    vec3 q = vSpQ;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 0.62, 0.62), 0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.06, 0.09), clamp(vSpG.x, 0.0, 1.0) * 0.75);
    float seam = exp(-pow((q.y - 1.6135) / 0.0013, 2.0)) * (1.0 - smoothstep(0.012, 0.021, abs(q.x)));
    diffuseColor.rgb *= 1.0 - seam * 0.55;
    diffuseColor.rgb *= 1.0 + spGf(q, vec3(0.0, 1.609, 0.112), 0.006) * (0.12 + vSpG.x * 0.25);
    diffuseColor.rgb *= 0.94 + 0.06 * sin(q.x * 1400.0);
  }
  if (vSpBit > 12.5 && vSpBit < 13.5 && vSpQ.y > 1.5) {
    float lu = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
    vec3 ec = vSpG.w < 0.5 ? vec3(0.16, 0.08, 0.03) : vSpG.w < 1.5 ? vec3(0.18, 0.34, 0.55) : vSpG.w < 2.5 ? vec3(0.2, 0.32, 0.16) : vec3(0.32, 0.36, 0.38);
    float nz = fract(sin(dot(floor(vSpQ.xy * 4000.0), vec2(12.9898, 78.233))) * 43758.5453);
    if (lu > 0.06) diffuseColor.rgb = ec * (0.75 + 0.5 * nz);
  }`;""")
# --- modische, junge Frauen an der Strecke
rep("    this.det = o.det ??",
"""    this.glam = !this.kid && this.sex === 'F' && (o.glam ?? rand() < 0.32);
    if (this.glam) {
      if (!o.hairStyle) this.hairStyle = pick(['long', 'long', 'pony']);
      if (o.hat === undefined) this.hat = pick([null, null, null, 'cap']);
      if (o.top === undefined) this.top = col3(pick([0xf4f1ec, 0x1a1a1c, 0xa8182a, 0x3a6a5a, 0x2a3f66, 0x6a4a8a, 0x5a1a2a, 0x8aa0b8]));
      if (o.pants === undefined) { this.pantsPat = 1; this.pants = col3(pick([0x1f2c48, 0x2a3f66, 0x1a1a1c, 0x45618a, 0xe8e2d6])); }
      if (o.glasses === undefined) this.glasses = rand() < 0.2;
      if (o.hair === undefined) this.hairCol = col3(pick([0xe0c890, 0xc8985a, 0x2a1a10, 0x4a2a18, 0x8a5a30, 0xd8b878, 0x6a3018]));
      this.short = o.shortSleeve ?? rand() < 0.3; this.scarf = o.scarf ?? rand() < 0.15; this.backpack = false; this.topPat = 0;
      this.girth = o.girth ?? 0.9 + rand() * 0.05; this.scale = o.scale ?? 0.97 + rand() * 0.08;
    }
    this.det = o.det ??""")
# --- doppelt so viele Zuschauer
rep("function crowd(rand, s, n, poses, spread = 24, sideBias = 0) {\n  for (let i = 0; i < n; i++) {",
    "function crowd(rand, s, n, poses, spread = 24, sideBias = 0) {\n  for (let i = 0; i < n * 2; i++) {")
rep("function rallyCrowd(rand, s0, len, n, depth = 10, side0 = 0) {\n  let placed = 0;",
    "function rallyCrowd(rand, s0, len, n, depth = 10, side0 = 0) {\n  n = Math.round(n * 2); depth = depth * 1.4; len = len * 1.1;\n  let placed = 0;")
# --- Werbung: mehr Marken, echter gestaltet, dichter
rep("  { name: 'Rottmoser', bg: '#f7f3ea', fg: '#a3161a', fg2: '#1d1f1a', sub: 'SEIT GENERATIONEN', font: `800 {S}px ${AD_FONT}`, upper: true },",
"""  { name: 'Rottmoser', bg: '#f7f3ea', fg: '#a3161a', fg2: '#1d1f1a', sub: 'SEIT GENERATIONEN', font: `800 {S}px ${AD_FONT}`, upper: true, deco: 'frame', url: 'rottmoser.de' },
  { name: 'Alpenmilch', bg: '#eef5fb', fg: '#1b4f8a', fg2: '#3a8fd0', sub: 'FRISCH VON DER CHIEMGAUER ALM', font: 'italic 700 {S}px Georgia, "Times New Roman", serif', deco: 'mountain', badge: 'A', url: 'chiemgauer-alpenmilch.de' },
  { name: 'Priental Bank', bg: '#0f5c3a', fg: '#ffffff', fg2: '#f39200', sub: 'IHRE BANK IN DER REGION', font: `800 {S}px ${AD_FONT}`, deco: 'swoosh', badge: 'P', url: 'priental-bank.de' },
  { name: 'Bergsport Aschau', bg: '#1d1f1a', fg: '#ff6a13', fg2: '#ffffff', sub: 'BIKE · SKI · OUTDOOR', font: `italic 900 {S}px ${AD_FONT}`, upper: true, deco: 'mountain', url: 'bergsport-aschau.de' },
  { name: 'Alpenwelle 104,2', bg: '#d8101a', fg: '#ffffff', fg2: '#ffd200', sub: 'DER SOUND DER BERGE', font: `900 {S}px ${AD_FONT}`, upper: true, deco: 'wave', url: 'alpenwelle.fm' },
  { name: 'Kampenwandbahn', bg: '#ffffff', fg: '#c8102e', fg2: '#1d1f1a', sub: 'SEIT 1957 · HOHENASCHAU', font: `800 {S}px ${AD_FONT}`, upper: true, deco: 'mountain', badge: 'K', url: 'kampenwand.de' },
  { name: 'Prientaler Brotzeit', bg: '#6a3e1c', fg: '#f6ead0', fg2: '#e2b23a', sub: 'METZGEREI · BÄCKEREI', font: '700 {S}px Georgia, "Times New Roman", serif', deco: 'frame', url: 'prientaler-brotzeit.de' },""")
# Marken-Gestaltung der Bestandsmarken
rep("sub: 'ENERGY DRINK', font: `900 {S}px ${AD_FONT}`, upper: true },", "sub: 'ENERGY DRINK', font: `900 {S}px ${AD_FONT}`, upper: true, deco: 'sun' },")
rep("sub: 'EISKALT', font: 'italic 700 {S}px Georgia, \"Times New Roman\", serif' },", "sub: 'EISKALT', font: 'italic 700 {S}px Georgia, \"Times New Roman\", serif', deco: 'swoosh' },")
rep("sub: 'BRÄU · MÜNCHEN', font: '700 {S}px Georgia, \"Times New Roman\", serif', upper: true },", "sub: 'BRÄU · MÜNCHEN', font: '700 {S}px Georgia, \"Times New Roman\", serif', upper: true, deco: 'frame' },")
rep("sub: 'AUS DEM CHIEMGAU', font: `800 {S}px ${AD_FONT}`, upper: true },", "sub: 'AUS DEM CHIEMGAU', font: `800 {S}px ${AD_FONT}`, upper: true, deco: 'mountain', badge: 'F' },")
# Druckbild: Verlauf, Gestaltungselement, Emblem, Schrift mit Schatten, Web-Adresse, Ösen, Gewebestruktur, leichter Schmutz
_ad = rd('adtex.js')
import re as _re
_m = _re.search(r"function adTex\(a, w, h, vertical = false\) \{.*?\n\}\n", src, _re.S)
assert _m, 'adTex'
src = src[:_m.start()] + _ad + src[_m.end():]
rep("        s += Math.max(len, 2) + 4 + rand() * 14;", "        s += Math.max(len, 2) + 2 + rand() * 7;")
rep("  const spots = [[10, 95], [trail.L - 115, trail.L - 8]];", "  const spots = [[10, 95], [trail.L - 115, trail.L - 8]];\n  for (let s = 130; s < trail.L - 160; s += 95 + rand() * 50) spots.push([s, s + 22]);")
rep('<div class="eyebrow">Vorabversion v26 · Sprünge abfedern, Gondeln · Browser</div>',
    '<div class="eyebrow">Vorabversion v27 · Zuschauer, Gesichter, Werbung · Browser</div>')
# --- Männer: Gesäß flacher, Hüfte schmaler (wirkte zu weiblich)
rep("  const m0 = list[0], sm = new THREE.SkinnedMesh(mergeGeometries(geos, false), specMaterials(false, false).m);",
"""  if (_specSex === 'M') specManlyHips(geos);
  const m0 = list[0], sm = new THREE.SkinnedMesh(mergeGeometries(geos, false), specMaterials(false, false).m);""")
rep("    specMerge(lods[0], 'spec0');", "    _specSex = sex; specMerge(lods[0], 'spec0');")
rep("function specMerge(list, name) {",
"""let _specSex = null;
function specManlyHips(geos) {
  // Mitte des Beckenquerschnitts aus der Hose bestimmen, dann nur die Rückseite und die Hüftbreite zurücknehmen
  let zmin = 1e9, zmax = -1e9;
  for (const g of geos) { const p = g.attributes.position, sl = g.attributes.aSlot; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (sl.getX(i) === 3 && y > 0.82 && y < 0.96 && Math.abs(p.getX(i)) < 0.08) { zmin = Math.min(zmin, p.getZ(i)); zmax = Math.max(zmax, p.getZ(i)); } } }
  if (!(zmax > zmin)) return;
  const zc = (zmin + zmax) / 2;
  for (const g of geos) {
    const p = g.attributes.position, sl = g.attributes.aSlot;
    for (let i = 0; i < p.count; i++) {
      const s = sl.getX(i); if (!(s === 0 || s === 1 || s === 2 || s === 3)) continue;
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const wy = Math.exp(-Math.pow((y - 0.9) / 0.1, 2));
      if (wy < 0.01) continue;
      const ax = Math.abs(x), wx = 1 - Math.min(1, Math.max(0, (ax - 0.15) / 0.07));
      if (z < zc) p.setZ(i, zc + (z - zc) * (1 - 0.32 * wy * wx));
      // Hüfte nur außen etwas schmaler
      const hw = Math.exp(-Math.pow((y - 0.93) / 0.08, 2)) * Math.min(1, Math.max(0, (ax - 0.08) / 0.08));
      p.setX(i, x * (1 - 0.07 * hw));
    }
    p.needsUpdate = true;
  }
}
function specMerge(list, name) {""")
# Haut weniger entsättigt und nicht überstrahlt
rep("diffuseColor.rgb = mix(vec3(lu), diffuseColor.rgb, 0.72) * 1.06; }", "diffuseColor.rgb = mix(vec3(lu), diffuseColor.rgb, 0.86) * 0.97; }")
# Rückseite der Werbetafeln nicht spiegelverkehrt
rep("  const panel = (w, h) => mergeGeometries([new THREE.PlaneGeometry(w, h), new THREE.PlaneGeometry(w, h).rotateY(Math.PI)]);",
    "  const panel = (w, h) => { const b = new THREE.PlaneGeometry(w, h), uv = b.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); return mergeGeometries([new THREE.PlaneGeometry(w, h), b.rotateY(Math.PI)]); };")
# Fahrer: Gesäß der Hose flacher, Hose fällt lockerer (Downhill-Hose statt Strumpfhose)
rep("  let skel = null; sc.traverse((o) => { if (o.isSkinnedMesh) skel = o.skeleton; });",
"""  let skel = null; sc.traverse((o) => { if (o.isSkinnedMesh) skel = o.skeleton; });
  { const pm = []; sc.traverse((o) => { if (o.isMesh && o.material && /^(Pants|PantsAccent|Jersey|Pad)$/.test(o.material.name)) pm.push(o); });
    let zmin = 1e9, zmax = -1e9;
    for (const o of pm) if (o.material.name === 'Pants') { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.84 && y < 0.98 && Math.abs(p.getX(i)) < 0.09) { zmin = Math.min(zmin, p.getZ(i)); zmax = Math.max(zmax, p.getZ(i)); } } }
    if (zmax > zmin) { const zc = (zmin + zmax) / 2; for (const o of pm) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); if (z >= zc) continue; const wy = Math.exp(-Math.pow((y - 0.9) / 0.11, 2)), wx = 1 - Math.min(1, Math.max(0, (Math.abs(p.getX(i)) - 0.15) / 0.07)); if (wy > 0.01) p.setZ(i, zc + (z - zc) * (1 - 0.45 * wy * wx)); } p.needsUpdate = true; o.geometry.computeBoundingSphere(); } } }""")
