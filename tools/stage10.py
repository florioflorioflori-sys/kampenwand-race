# v25: Fahrer vom Rad getrennt: Rad kippt unter dem Körper (Wiegetritt, Kurven), Körper bleibt lotrecht am Hang
rep("function poseModel(model, x, y, z, yaw, up, lean, st, crashT) {",
    """// Wann treten die Fahrer? Beim Beschleunigen und immer wieder in kurzen Antritten aus den Kurven
function aiPedals(A) {
  if (A.air || A.finished || A.braking) return false;
  if (A.v < 12.5) return true;
  const ph = (A.s * 0.021 + (A.seedP || (A.seedP = Math.random() * 10))) % 1;
  return ph < 0.22 && A.v < 17;
}
function poseModel(model, x, y, z, yaw, up, lean, st, crashT) {""")
rep("  A.crankA = A.v < 11 && !A.air ? (A.crankA || 0) + dt * (4 + A.v * 0.5)", "  A.crankA = aiPedals(A) ? (A.crankA || 0) + dt * (4 + A.v * 0.42)")
rep("pedal: A.v < 11 && !A.air && !idleRace,", "pedal: aiPedals(A) && !idleRace,")
rep("pedal: inp.pedal > 0 && sp < 14 && !r.air && !idleRace,", "pedal: inp.pedal > 0 && sp < 17 && !r.air && !idleRace,")
# Hangneigung an die Pose geben
rep("  u.tilt.rotation.z = crashT > 0 ?", "  st.slope = Math.asin(clamp(_z.y, -0.9, 0.9)); st.tiltZ = lean * 1.18;\n  u.tilt.rotation.z = crashT > 0 ?")
# Wiegetritt: Rad schwingt deutlich von Seite zu Seite
rep("  if (ped && !st.air) roll += Math.sin(st.crankA) * 0.13 * (1 - c * 0.35);",
    "  if (ped && !st.air) roll += Math.sin(st.crankA) * 0.2 * (1 - c * 0.25);\n  // Kurven: Rad legt sich stärker als der Fahrer\n  if (!st.air) roll += 0.32 * (st.tiltZ || 0);")
rep("  else if (D) riderAnimate(u, st, D);", """  else if (D) {
    riderAnimate(u, st, D);
    // Körper vom Rad lösen: am Steilhang Becken zurück und Oberkörper lotrecht, in Kurven aufrechter als das Rad
    const k = (1 - D.idle) * (st.trick ? 0.4 : 1);
    if (k > 0.01) {
      const phi = clamp(st.slope || 0, -0.6, 0.4) * 0.65 * k, cp = Math.cos(phi), sp2 = Math.sin(phi);
      const rz = -0.3 * (st.tiltZ || 0) * k - (st.pedal ? Math.sin(st.crankA) * 0.06 : 0) * k, cz = Math.cos(rz), sz = Math.sin(rz);
      for (const key of ['hip', 'hpL', 'hpR', 'chest', 'neck', 'head', 'shL', 'shR']) {
        const v = RP[key], w = key === 'hip' || key === 'hpL' || key === 'hpR' ? 0.75 : 1;
        let yy = v.y - 0.36, zz = v.z + 0.04, xx = v.x;
        const y1 = yy * cp - zz * sp2 * w, z1 = yy * sp2 * w + zz * cp; yy = y1; zz = z1;
        const x2 = xx * cz - yy * sz, y2 = xx * sz + yy * cz;
        v.set(x2, y2 + 0.36, zz - 0.04);
      }
      RP.roll += -rz * 0.5;
    }
  }""")
rep('<div class="eyebrow">Vorabversion v24 · Federung und lebendige Fahrer · Browser</div>',
    '<div class="eyebrow">Vorabversion v25 · Fahrtechnik, Kamerateams, Natur · Browser</div>')
# --- ausgeblendete Kleidungsteile: Dreiecke nicht zu den Füßen ziehen, sondern verwerfen
rep("varying vec3 vSpPat;", "varying vec3 vSpPat; varying float vSpHide;", 2)
rep("  vSpP = spModel(transformed); vSpSlot = aSlot; vSpBit = aBit;", "  vSpP = spModel(transformed); vSpSlot = aSlot; vSpBit = aBit; vSpHide = 0.0;")
rep("  if (aBit > -0.5 && ((int(iInfo.x + 0.5) >> int(aBit + 0.5)) & 1) == 0) transformed = vec3(0.0);",
    "  if (aBit > -0.5 && ((int(iInfo.x + 0.5) >> int(aBit + 0.5)) & 1) == 0) { transformed = vec3(0.0); vSpHide = 1.0; }")
rep("  if (!gl_FrontFacing && vSpCard.x < 1.5) discard;", "  if (vSpHide > 0.001) discard;\n  if (!gl_FrontFacing && vSpCard.x < 1.5) discard;")
# --- Gondeln verschwinden in der Station statt durch Wände zu fahren, bremsen vor der Einfahrt
rep("for (const gd of gondolas) { gd.t = (gd.t + frameDt * 0.004) % 1;",
    "for (const gd of gondolas) { const _ge = Math.min(gd.t, 1 - gd.t); gd.t = (gd.t + frameDt * 0.004 * (0.35 + 0.65 * Math.min(1, _ge / 0.02))) % 1;")
rep("gd.g.rotation.y = gd.dir;", "gd.g.rotation.y = gd.dir; { const _p = gd.g.position, _in = (st) => st && Math.hypot(_p.x - st.x, _p.z - st.z) < 9.5; gd.g.visible = !(_in(stationA) || _in(stationB)); }")
# --- Steinchen: unregelmäßig, beleuchtet, flacher geworfen, springen am Boden auf
rep("      if (vC > 1.5) { gl_FragColor = vec4(vec3(0.17, 0.12, 0.08) * (0.8 + 0.4 * fract(vC)), min(1.0, vL * 2.5)); return; }",
    """      if (vC > 1.5) {
        float c = cos(vRot), s = sin(vRot); vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
        float an = atan(q.y, q.x), h = fract(vC);
        float rr = 0.78 + 0.14 * sin(an * 3.0 + h * 20.0) + 0.08 * sin(an * 5.0 + h * 9.0);
        if (length(q) > rr) discard;
        vec3 base = mix(vec3(0.36, 0.33, 0.3), vec3(0.24, 0.18, 0.12), step(0.5, h));
        float lit = 0.55 + 0.6 * clamp(-p.y * 0.7 + 0.35, 0.0, 1.0);
        gl_FragColor = vec4(base * lit * uSunCol, min(1.0, vL * 4.0)); return;
      }""")
rep("""    } else if (k > 1.5) {
      dust.life[i] -= dt * 1.3;
      dust.vel[i3 + 1] -= 9.8 * dt;""", """    } else if (k > 1.5) {
      dust.life[i] -= dt * 0.9;
      dust.vel[i3 + 1] -= 9.8 * dt;
      const gy = hAt(dust.pos[i3], dust.pos[i3 + 2]) + 0.02;
      if (dust.pos[i3 + 1] < gy && dust.vel[i3 + 1] < 0) { dust.pos[i3 + 1] = gy; dust.vel[i3 + 1] *= -0.28; dust.vel[i3] *= 0.45; dust.vel[i3 + 2] *= 0.45; if (Math.abs(dust.vel[i3 + 1]) < 0.3) { dust.vel[i3 + 1] = 0; dust.life[i] -= dt * 2; } }""")
rep("for (let i = 0; i < 3; i++) emitDust(rx, y + 0.08, rz, -fx * sp * 0.25 + (R() - 0.5) * 2, 1.2 + R() * 2.2, -fz * sp * 0.25 + (R() - 0.5) * 2, 0.05 + R() * 0.05, 2 + R() * 0.9);",
    "for (let i = 0; i < 3; i++) emitDust(rx + (R() - 0.5) * 0.1, y + 0.05, rz + (R() - 0.5) * 0.1, -fx * sp * 0.16 + (R() - 0.5) * 1.4, 0.5 + R() * 1.2, -fz * sp * 0.16 + (R() - 0.5) * 1.4, 0.022 + R() * 0.03, 2 + R() * 0.99);")
rep("for (let i = 0; i < 6 * k; i++) emitDust(x, y + 0.08, z, (R() - 0.5) * 4, 1.5 + R() * 2.5, (R() - 0.5) * 4, 0.05 + R() * 0.05, 2 + R() * 0.9);",
    "for (let i = 0; i < 6 * k; i++) emitDust(x, y + 0.06, z, (R() - 0.5) * 3, 0.8 + R() * 1.6, (R() - 0.5) * 3, 0.025 + R() * 0.035, 2 + R() * 0.99);")
# --- Vögel nur noch in der Luft (Dohlen kreisen, siehe event.js)
rep("  for (const fl of life.flocks) {\n    const ahead = fl.s - P.s;", "  for (const fl of []) {\n    const ahead = fl.s - P.s;")
# --- junge Fichten mit echten Zweigen statt gestapelter Kegel
rep("""  inst(saplingGeo(), new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), sap, (b) => {
    q.setFromAxisAngle(_UP, b[4] * 6.28); sc.set(b[3] * (0.75 + b[4] * 0.3), b[3], b[3] * (0.75 + b[4] * 0.3)); p.set(b[0], b[1] - 0.05, b[2]);
    col.setRGB(0.018 + b[4] * 0.012, 0.04 + b[4] * 0.02, 0.022);
  });""", """  {
    treeMats = treeMats || treeMaterials();
    const SH = 3.2, sg = [spruceGeo({ ...SPRUCE_VARIANTS[3], seed: 31, H: SH, W: 1.35, nb: 6 }), spruceGeo({ ...SPRUCE_VARIANTS[3], seed: 44, H: SH, W: 1.2, nb: 6, droop: 0.5 })];
    const near = sap.filter((b) => b[3] > 0.9).slice(0, 700);
    for (let gi = 0; gi < 2; gi++) inst(sg[gi], treeMats.spruce, near.filter((_, i) => i % 2 === gi), (b) => {
      const k = b[3] / SH; q.setFromAxisAngle(_UP, b[4] * 6.28); sc.set(k * (0.8 + b[4] * 0.35), k, k * (0.8 + b[4] * 0.35)); p.set(b[0], b[1] - 0.08, b[2]);
      col.setRGB(0.85 + b[4] * 0.25, 0.9 + b[4] * 0.2, 0.85);
    });
  }""")
rep("const h = 0.6 + Math.pow(rand(), 1.5) * 2.4; sap.push([s.x, s.y, s.z, h, rand()]);", "const h = 0.9 + Math.pow(rand(), 1.5) * 2.6; sap.push([s.x, s.y, s.z, h, rand()]);")
# --- Startschwenk: erst die Bergstation mit Startbogen und Publikum von unten, dann um das Fahrerfeld
rep("const PAN_T = 8;", "const PAN_T = 11;")
rep("""  const ph = 1 - race.pan / PAN_T, e = ph * ph * (3 - 2 * ph);
  _pc.set(0, 0, 0); for (const r of riders) _pc.add(r.model.position); _pc.multiplyScalar(1 / riders.length);""",
"""  const ph0 = 1 - race.pan / PAN_T;
  _pc.set(0, 0, 0); for (const r of riders) _pc.add(r.model.position); _pc.multiplyScalar(1 / riders.length);
  if (ph0 < 0.42 && stationA) {
    // Kranfahrt: von unterhalb des Starts auf Bergstation und Startbogen, dann hinunter zu den Fahrern
    const k = ph0 / 0.42, e2 = k * k * (3 - 2 * k), fx = Math.sin(player.yaw), fz = Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
    const sy = hAt(stationA.x, stationA.z);
    const p0x = _pc.x + fx * 55 + rx * 22, p0z = _pc.z + fz * 55 + rz * 22;
    const a1 = player.yaw + Math.PI * 0.85, p1x = _pc.x + Math.sin(a1) * 7.5, p1z = _pc.z + Math.cos(a1) * 7.5;
    camPos.set(lerp(p0x, p1x, e2), 0, lerp(p0z, p1z, e2));
    camPos.y = Math.max(lerp(_pc.y + 16, _pc.y + 2.2, e2), groundAt(camPos.x, camPos.z) + 1.5);
    camLook.set(lerp((stationA.x + _pc.x) / 2, _pc.x, e2), lerp(Math.max(sy, _pc.y) + 6, _pc.y + 1.0, e2), lerp((stationA.z + _pc.z) / 2, _pc.z, e2));
    camera.position.copy(camPos); camera.lookAt(camLook);
    camera.fov = lerp(50, 62, e2); camera.updateProjectionMatrix();
    updateFX(dt, 0); return;
  }
  const ph = (ph0 - 0.42) / 0.58, e = ph * ph * (3 - 2 * ph);""")
