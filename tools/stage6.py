# ================= Etappe 6: Gebäude originalgetreuer, ins Gelände eingebettet
rep("function buildStationsAndLift() {", rd('berg.js') + "\nfunction buildStationsAndLift() {")
rep("""    dark: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }),
  };
  const box = (w, h, d, m, x, y, z, parent, ry = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);""",
"""    dark: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }),
  };
  { const T = bldTex();
    M.concrete = new THREE.MeshStandardMaterial({ map: T.concrete, bumpMap: T.concrete, bumpScale: 0.6, roughness: 0.95 });
    M.wood = new THREE.MeshStandardMaterial({ map: T.boards, bumpMap: T.boards, bumpScale: 0.8, roughness: 0.82 });
    M.stoneW = new THREE.MeshStandardMaterial({ map: T.stone, bumpMap: T.stone, bumpScale: 2.2, roughness: 0.95 });
    M.plasterW = new THREE.MeshStandardMaterial({ map: T.plaster, bumpMap: T.plaster, bumpScale: 0.5, roughness: 0.95 });
    M.sheet = new THREE.MeshStandardMaterial({ map: T.sheet, bumpMap: T.sheet, bumpScale: 0.8, roughness: 0.5, metalness: 0.45 });
    M.shingle = new THREE.MeshStandardMaterial({ map: T.shingle, bumpMap: T.shingle, bumpScale: 1.4, roughness: 0.9 }); }
  const box = (w, h, d, m, x, y, z, parent, ry = 0) => { const o = new THREE.Mesh(mBox(w, h, d), m);""")
# Sockel aus Bruchstein statt glattem Beton
rep("    box(18, 17.2, 26, M.concrete, 0, 3.2 - 8.6, 0, g); // Sockel reicht bis in den Hang",
    "    box(18, 17.2, 26, M.stoneW, 0, 3.2 - 8.6, 0, g); // Sockel reicht bis in den Hang")
# Blechdach mit Falzen, Giebel in Brettern
rep("""    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(rs, { depth: 29, bevelEnabled: false }), M.roof); roof.position.set(0, 7.8, -16.5); roof.castShadow = true; g.add(roof);""",
"""    const rg = new THREE.ExtrudeGeometry(rs, { depth: 29, bevelEnabled: false }); { const uv = rg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4); }
    const roof = new THREE.Mesh(rg, M.wood); roof.position.set(0, 7.8, -16.5); roof.castShadow = true; g.add(roof);
    { const pitch = Math.atan2(3.6, 10.6), sl = Math.hypot(10.6, 3.6);
      for (const sx of [-1, 1]) { const r = new THREE.Mesh(mBox(sl + 0.3, 0.22, 29.4), M.sheet); r.position.set(sx * 5.3, 7.8 + 1.8 + 0.16, -2); r.rotation.z = -sx * pitch; r.castShadow = r.receiveShadow = true; g.add(r);
        const gut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 29.4, 8).rotateX(Math.PI / 2), M.steel); gut.position.set(sx * 10.75, 7.75, -2); g.add(gut); }
      box(0.5, 0.25, 29.4, M.steel, 0, 11.55, -2, g); }""")
rep("""    if (top) {
      // Sonnenterrasse mit Tischen und roten Schirmen""", """    g.userData.bavM = bavM;
    if (top) buildBergDetails(g, M, box, y, trailPoint(0, 0, {}));
    else if (false) {
      // Sonnenterrasse mit Tischen und roten Schirmen""")
# Talstation: Putz, Naturstein, Holz mit Textur
rep("""  const plaster = new THREE.MeshStandardMaterial({ color: 0xeee8dc, roughness: 0.92 });""",
    """  const plaster = M.plasterW;""")
rep("""  const darkWood = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.85 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.95 });""",
    """  const darkWood = new THREE.MeshStandardMaterial({ map: bldTex().boards, color: 0x9a7a66, roughness: 0.85 });
  const stone = M.stoneW;""")
# echte Höhen laut Seilbahn-Daten
rep("arch(13, 'KAMPENWAND', 'START · BERGSTATION 1437 m');", "arch(13, 'KAMPENWAND', 'START · BERGSTATION 1461 m');")
rep("arch(trail.L - 2, 'ZIEL', 'TALSTATION ASCHAU 624 m');", "arch(trail.L - 2, 'ZIEL', 'TALSTATION HOHENASCHAU 620 m');")

# ================= Zuschauer: Haarsträhnen als Karten (Alpha aus dem Shader), nur ohne Hut
rep("Lips: [10, -1], Eyes: [-1, 14], Iris: [-1, 13], Pupils: [-1, 13] };",
    "Lips: [10, -1], Eyes: [-1, 14], Iris: [-1, 13], Pupils: [-1, 13], HairShortC: [5, 15], HairLongC: [5, 16], HairPonyC: [5, 17] };")
rep("  b(13); b(14);\n  return m;", "  b(13); b(14);\n  if (!hat) { if (st === 'short') b(15); if (st === 'long') b(16); if (st === 'pony') b(17); }\n  return m;")
rep("""    g.setAttribute('aBit', new THREE.BufferAttribute(new Float32Array(n).fill(bit), 1));""",
"""    g.setAttribute('aBit', new THREE.BufferAttribute(new Float32Array(n).fill(bit), 1));
    const ac = new Float32Array(n * 2), ouv = o.geometry.attributes.uv;
    if (/^Hair\\w+C$/.test(o.material.name) && ouv) for (let i = 0; i < n; i++) { ac[i * 2] = ouv.getX(i); ac[i * 2 + 1] = ouv.getY(i); }
    g.setAttribute('aCard', new THREE.BufferAttribute(ac, 2));""")
rep("attribute float aSlot; attribute float aBit;\n#ifdef SPEC_BLEND", "attribute float aSlot; attribute float aBit; varying vec2 vSpCard;\n#ifndef USE_INSTANCING\nattribute vec2 aCard;\n#endif\n#ifdef SPEC_BLEND")
rep("vSpP = spModel(transformed); vSpSlot = aSlot; vSpBit = aBit;", "vSpP = spModel(transformed); vSpSlot = aSlot; vSpBit = aBit;\n#ifdef USE_INSTANCING\n  vSpCard = vec2(0.0);\n#else\n  vSpCard = aCard;\n#endif\n")
rep("varying float vSpMo; varying float vSpBit;\\nfloat spGf(", "varying float vSpMo; varying float vSpBit; varying vec2 vSpCard;\\nfloat spGf(")
rep("const SPEC_FRAG = `\n", r"""const SPEC_FRAG = `
  if (!gl_FrontFacing && vSpCard.x < 1.5) discard;
  if (vSpCard.x > 1.5) {
    // einzelne Haare je Karte: leicht gewellt, unterschiedlich lang, spitz zulaufend
    float u = vSpCard.x - 2.0, sd = floor(vSpCard.y / 4.0), v = vSpCard.y - sd * 4.0;
    float x = u * 6.0, id = floor(x), a = 0.0, sh = 0.0;
    for (int k = -1; k <= 1; k++) {
      float i = id + float(k);
      float h1 = fract(sin(i * 12.9898 + sd * 78.233) * 43758.5453), h2 = fract(sin(i * 39.346 + sd * 11.135) * 24634.6345);
      float c = i + 0.5 + (h1 - 0.5) * 0.6 + sin(v * 9.0 + h2 * 6.28) * 0.22;
      float len = 0.7 + 0.3 * h2;
      float w = (0.55 + 0.25 * h1) * (1.0 - smoothstep(len * 0.45, len, v) * 0.8);
      float s = (1.0 - smoothstep(w * 0.55, w, abs(x - c))) * step(v, len);
      if (s > a) { a = s; sh = h1; }
    }
    if (a < 0.5 || u < 0.02 || u > 0.98) discard;
    diffuseColor.rgb *= (0.5 + 0.5 * smoothstep(0.0, 0.4, v)) * (0.8 + 0.4 * sh);
  }
""")
rep("""    const M = specMaterials(false, false);
    body.material = M.m;""", """    const M = specMaterials(false, false); M.m.side = THREE.DoubleSide;
    body.material = M.m;""")

rep("map: textTexture([[label + ' · KAMPENWANDBAHN', '700 64px", "map: textTexture([[label + ' · KAMPENWANDBAHN', '700 52px")

# ================= Fahrer: Handschuhe, Schuhe, Protektoren je Fahrer; Stoffrelief mit Falten an Gelenken; Sponsor auf der Brust
rep("  if (cfg.bike) Object.assign(col, { Gold: cfg.bike.fork,", """  { const vi = Math.max(0, [1, 7, 12, 23, 31, 44].indexOf(cfg.num));
    col.Glove = [0x1c1d20, cfg.accent, 0xf2f2ee, cfg.jersey, 0x2b2f36, cfg.accent][vi];
    col.Shoe = [0x1a1a1a, 0x3b3f45, 0xf0efe8, 0x1a1a1a, 0x5a4632, 0x22324a][vi];
    col.Pad = [0x26282b, 0x1a1a1a, 0x3a3d42, 0x1f2a22, 0x26282b, 0x302a26][vi]; }
  if (cfg.bike) Object.assign(col, { Gold: cfg.bike.fork,""")
rep("if (/^(Jersey|JerseyAccent|Pants|PantsAccent)$/.test(k)) clothFlutter(cache[k], cache);",
    "if (/^(Jersey|JerseyAccent|Pants|PantsAccent)$/.test(k)) { clothFlutter(cache[k], cache); cache[k].roughness = /^Pants/.test(k) ? 0.78 : 0.58; }")
CLOTH_BUMP = r"""
  {
    // Stoff: feine Maschen, Falten an Ellbogen, Knien, Hüfte und Bauch, im Fahrtwind flatternd
    vec3 p = vRP; float ax = abs(p.x); float hb = 0.0;
    float knit = sin(p.x * 1400.0 + p.z * 700.0) * sin(p.y * 1500.0 + p.z * 500.0);
    hb += knit * 0.00012;
    float elbow = exp(-pow((ax - 0.5) / 0.07, 2.0)), shoulder = exp(-pow((ax - 0.25) / 0.05, 2.0));
    hb += sin(ax * 140.0 + sin(p.y * 60.0 + p.z * 40.0) * 1.5) * 0.0012 * (elbow + shoulder * 0.6);
    float waist = exp(-pow((p.y - 1.06) / 0.07, 2.0)) * (1.0 - smoothstep(0.18, 0.24, ax));
    hb += sin(p.y * 160.0 + sin(p.x * 25.0) * 2.0) * 0.0014 * waist;
    float knee = exp(-pow((p.y - 0.52) / 0.07, 2.0)) * step(p.y, 0.95), hip = exp(-pow((p.y - 0.86) / 0.06, 2.0)) * step(p.y, 1.0);
    hb += sin(p.y * 150.0 + sin(p.x * 50.0 + p.z * 30.0) * 2.0) * 0.0016 * (knee + hip * 0.7);
    hb += sin(p.y * 40.0 + p.x * 20.0 - uTime * 18.0) * 0.0007 * uWind;
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 R1 = cross(sy, normal), R2 = cross(normal, sx); float det = dot(sx, R1);
    vec3 grad = sign(det) * (dFdx(hb) * R1 + dFdy(hb) * R2);
    normal = normalize(abs(det) * normal - grad);
  }
"""
rep("""    sh.fragmentShader = 'varying vec3 vRP; uniform vec4 uPat; uniform vec3 uPA; uniform vec3 uPB;\\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>""",
    """    sh.fragmentShader = 'varying vec3 vRP; uniform vec4 uPat; uniform vec3 uPA; uniform vec3 uPB; uniform float uWind; uniform float uTime;\\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>""" + CLOTH_BUMP.replace('`', '') + """`).replace('#include <color_fragment>', `#include <color_fragment>""")
rep("  m.customProgramCacheKey = () => 'cloth';", "  m.customProgramCacheKey = () => 'cloth2';")
# Sponsor-Schriftzug vorn auf der Brust
rep("""    e.bones.spine_03.add(dec);
  }""", """    e.bones.spine_03.add(dec);
    const SP = ['ALPENSTROM', 'CHIEMGAU', 'GIPFEL', 'BERGWERK', 'KAMPEN', 'ASCHAUER'];
    const vi = Math.max(0, [1, 7, 12, 23, 31, 44].indexOf(cfg.num));
    const ft = canvasTex(512, 160, (x, w, h) => { x.clearRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      x.font = 'italic 800 92px "Saira Condensed", Arial Narrow, sans-serif'; x.lineWidth = 10; x.strokeStyle = '#111'; x.strokeText(SP[vi], w / 2, 70); x.fillStyle = '#fff'; x.fillText(SP[vi], w / 2, 70);
      x.font = '700 34px Barlow, sans-serif'; x.lineWidth = 6; x.strokeText((cfg.short || '') + ' RACING', w / 2, 135); x.fillText((cfg.short || '') + ' RACING', w / 2, 135); });
    const fm = new THREE.MeshStandardMaterial({ map: ft, transparent: true, alphaTest: 0.35, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
    const fd = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.081, 8, 3), fm);
    { const pa = fd.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setZ(i, -x * x * 1.6); } fd.geometry.computeVertexNormals(); }
    fd.position.set(0, 1.28, e.chestZ || 0.15); fd.updateMatrix();
    fd.matrix.premultiply(new THREE.Matrix4().copy(e.bones.spine_03.matrixWorld).invert().multiply(e.holder.matrixWorld));
    fd.matrix.decompose(fd.position, fd.quaternion, fd.scale); fd.castShadow = false; fd.name = 'chestLogo';
    e.bones.spine_03.add(fd);
  }""")
rep('<div class="eyebrow">Vorabversion v20 · Kameras, Wind, Gegenlicht · Browser</div>', '<div class="eyebrow">Vorabversion v21 · Sonnenalm, Haare, Fahrer · Browser</div>')
rep("      if (o.name === 'Ponytail') { eh.objs.push(o); return; }", "      if (o.name === 'Ponytail' || o.name === 'chestLogo') { eh.objs.push(o); return; }")
# Haut: weniger Rötung, etwas entsättigt (wirkte im Sonnenlicht orange)
rep("diffuseColor.rgb *= mix(vec3(1.0), vec3(1.1, 0.76, 0.72), clamp(", "diffuseColor.rgb *= mix(vec3(1.0), vec3(1.05, 0.86, 0.83), clamp(")
rep("    diffuseColor.rgb *= 0.965 + 0.07 * nz;\n  }`;", "    diffuseColor.rgb *= 0.965 + 0.07 * nz;\n  }\n  if (vSpSlot > -0.5 && vSpSlot < 0.5) { float lu = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(vec3(lu), diffuseColor.rgb, 0.72) * 1.06; }`;")
