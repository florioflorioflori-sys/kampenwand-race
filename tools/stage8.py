# v23: natürliche Kleidung mit Details, Event-Trubel, mehrere Hubschrauber, Gämsenrudel
# --- Farben: gedeckt und natürlich, nur selten ein kräftiger Ton
rep("const JACKET_WINTER = [0x1d1f1a, 0x2a2f38, 0x3a3f46, 0x24344a, 0x2f3a2a, 0x4a3a2c, 0x5a2a2a, 0x6a6a6a, 0x8a8478, 0x1f2a3a, 0x3a2a22, 0x2a3a3a, 0x46402f, 0x2b2b30, 0x5a4a3a, 0x37474f];\nconst JACKET_BRIGHT = [0xb5452e, 0xb08a3a, 0x2a6a56, 0x8a3a4a, 0x2a5a8a];",
    "const JACKET_WINTER = [0x2b2e2a, 0x3b4148, 0x2c3a4e, 0x3d4a35, 0x55482f, 0x6b5640, 0x5c3b33, 0x6e6e6a, 0x8c8474, 0x253246, 0x4a3a2c, 0x2f3f3f, 0x5a5640, 0x2a2a2e, 0x7a6a52, 0x3e4c55, 0x8e9490, 0x6a3a32, 0x4e5a48, 0xcfccc2, 0x45403a, 0x33402e];\nconst JACKET_BRIGHT = [0x8a4a32, 0x9a7a3a, 0x3a5e52, 0x6a3a44, 0x3a5878];")
rep("const PANTS = [0x1d1f1a, 0x2a3442, 0x3a3020, 0x4a4a4a, 0x26364a, 0x5a4a3a, 0x3a4a2a, 0x2c2c3a];",
    "const PANTS = [0x1d1f1a, 0x2a3442, 0x3a3020, 0x4a4a4a, 0x26364a, 0x5a4a3a, 0x3a4a2a, 0x2c2c3a, 0x5e5848, 0x3a3632];")
rep("this.headS = 0.93 + rand() * 0.14;",
    "this.det = o.det ?? (Math.floor(this.fem * 104729) & 31); this.headS = 0.93 + rand() * 0.14;")
rep("...(fan ? { top: fan.jersey, scarf: rand() < 0.5, scarfCol: fan.accent } : {})",
    "...(fan ? { scarf: true, scarfCol: fan.jersey, ...(rand() < 0.3 ? { top: fan.jersey } : {}) } : {})")
# --- Details im Shader: Reißverschluss, Brusttasche, Bündchen, Steppung, Nähte, Taschen
rep("varying vec2 vSpPat;", "varying vec3 vSpPat;", 2)
rep("vSpPat = vec2(mod(iInfo.w, 8.0), floor(iInfo.w / 8.0));",
    "vSpPat = vec3(mod(iInfo.w, 8.0), mod(floor(iInfo.w / 8.0), 4.0), floor(iInfo.w / 32.0));")
rep("u.iInfo.value.w = h.topPat + 8 * h.pantsPat;", "u.iInfo.value.w = h.topPat + 8 * h.pantsPat + 32 * (h.det || 0);")
rep("cols[15] = p.h.topPat + 8 * p.h.pantsPat;", "cols[15] = p.h.topPat + 8 * p.h.pantsPat + 32 * (p.h.det || 0);")
rep("  // Stoff mit feiner Struktur, zum Boden hin etwas dunkler (Umgebungsverdeckung)", """  {
    float det = vSpPat.z;
    float b0 = mod(det, 2.0), b1 = mod(floor(det / 2.0), 2.0), b2 = mod(floor(det / 4.0), 2.0), b3 = mod(floor(det / 8.0), 2.0), b4 = mod(floor(det / 16.0), 2.0);
    vec3 q = vSpP; float ax = abs(q.x);
    float fine = 1.0 - smoothstep(0.004, 0.014, length(fwidth(q)));
    if (vSpSlot > 0.5 && vSpSlot < 1.5) {
      float torso = step(ax, 0.235) * step(0.92, q.y) * step(q.y, 1.47);
      float front = smoothstep(0.0, 0.05, q.z);
      // Daunensteppung
      if (b3 > 0.5 && vSpPat.x < 0.5) { float qy = fract(q.y * (ax > 0.24 ? 9.0 : 10.5)); diffuseColor.rgb *= 0.82 + 0.18 * smoothstep(0.0, 0.2, qy) * smoothstep(1.0, 0.8, qy); }
      // Reißverschluss mit Abdeckleiste und Zipper
      if (b0 > 0.5) {
        float zl = (1.0 - smoothstep(0.004, 0.008, ax)) * torso * front;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.3 + vec3(0.025), zl * mix(0.5, 1.0, fine));
        diffuseColor.rgb *= 1.0 - (smoothstep(0.012, 0.016, ax) - smoothstep(0.024, 0.028, ax)) * torso * front * 0.2 * fine;
        float tab = step(ax, 0.01) * step(1.36, q.y) * step(q.y, 1.4) * front;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.62, 0.6), tab * 0.8);
      }
      // Brusttasche mit Aufnäher
      if (b1 > 0.5) {
        vec2 c = vec2(q.x - 0.095, q.y - 1.33);
        float pk = step(abs(c.x), 0.036) * step(abs(c.y), 0.022) * front;
        float rim = pk * (1.0 - step(abs(c.x), 0.03) * step(abs(c.y), 0.016));
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vSpAcc, vec3(0.9, 0.88, 0.84), 0.35), pk * 0.85);
        diffuseColor.rgb *= 1.0 - rim * 0.3;
      }
      // Bündchen am Saum und an den Ärmeln
      if (b2 > 0.5) {
        float hem = step(q.y, 0.99) * step(0.91, q.y) * step(ax, 0.3);
        float cuff = smoothstep(0.445, 0.45, ax) * (1.0 - smoothstep(0.5, 0.505, ax)) * step(1.2, q.y);
        diffuseColor.rgb *= 1.0 - (hem + cuff) * (0.22 + 0.08 * sin(q.x * 900.0 + q.z * 900.0) * fine);
      }
      // Seitennähte, Schulterpasse, Taschenschlitze
      float seam = exp(-pow((ax - 0.2) / 0.003, 2.0)) * torso + exp(-pow((q.y - 1.43) / 0.003, 2.0)) * step(ax, 0.42);
      float slit = exp(-pow((q.y - 1.08 - (ax - 0.12) * 1.2) / 0.004, 2.0)) * step(0.09, ax) * step(ax, 0.17) * front;
      diffuseColor.rgb *= 1.0 - (seam * 0.25 + slit * 0.4) * fine;
    }
    if (vSpSlot > 2.5 && vSpSlot < 3.5 && vSpPat.y < 1.5) {
      float front = smoothstep(0.0, 0.04, q.z), back = smoothstep(0.0, 0.04, -q.z);
      vec3 stc = vSpPat.y > 0.5 ? vec3(0.62, 0.42, 0.18) : diffuseColor.rgb * 0.55;
      float pocket = exp(-pow((q.y - 0.97 + (ax - 0.09) * 1.6) / 0.004, 2.0)) * step(0.09, ax) * step(ax, 0.17) * front * step(0.82, q.y);
      vec2 bq = vec2(ax - 0.09, q.y - 0.86);
      float bp = step(abs(bq.x), 0.05) * step(abs(bq.y), 0.05) * back * (1.0 - step(abs(bq.x), 0.044) * step(abs(bq.y), 0.044) * step(bq.y, 0.044));
      float side = exp(-pow(q.z / 0.004, 2.0)) * step(0.06, ax) * step(q.y, 0.95);
      float stitch = clamp(pocket + bp + side, 0.0, 1.0) * fine;
      diffuseColor.rgb = mix(diffuseColor.rgb, stc, stitch * 0.75);
      // Cargotasche am Oberschenkel
      if (b4 > 0.5 && vSpPat.y < 0.5) {
        float cg = step(0.1, ax) * step(abs(q.y - 0.6), 0.075) * step(abs(q.z), 0.07);
        float cgr = cg * (1.0 - step(abs(q.y - 0.6), 0.068) * step(abs(q.z), 0.063));
        diffuseColor.rgb *= 1.0 - cg * 0.06 - cgr * 0.3 * fine - step(0.1, ax) * exp(-pow((q.y - 0.655) / 0.004, 2.0)) * step(abs(q.z), 0.07) * 0.3 * fine;
      }
      // Kniefalten
      diffuseColor.rgb *= 1.0 - front * exp(-pow((q.y - 0.5) / 0.05, 2.0)) * 0.1 * (0.5 + 0.5 * sin(q.y * 170.0 + ax * 30.0));
    }
  }
  // Stoff mit feiner Struktur, zum Boden hin etwas dunkler (Umgebungsverdeckung)""")
# --- Gämsen: größere Rudel mit Kitzen, öfter auf der Strecke
rep("  for (const f of [0.2, 0.6]) {\n    const s = trail.L * f, side = rand() < 0.5 ? -1 : 1;",
    "  for (const f of [0.2, 0.4, 0.6, 0.79]) {\n    const s = trail.L * f, side = rand() < 0.5 ? -1 : 1;")
rep("    for (let i = 0; i < 3; i++) ev.herd.push({ q: new Quad('chamois', rand), delay: i * 0.45 + rand() * 0.2, off: (i - 1) * 2.2, x: a.x, z: a.z, y: a.y, yaw: 0 });",
    """    const nh = 7 + Math.floor(rand() * 4);
    for (let i = 0; i < nh; i++) {
      const q = new Quad('chamois', rand), kid = i >= nh - 3 && rand() < 0.8;
      if (kid) q.s = 0.6 + rand() * 0.08; else q.s = 0.92 + rand() * 0.16;
      ev.herd.push({ q, delay: i * 0.3 + rand() * 0.35 + (kid ? 0.25 : 0), off: (rand() - 0.5) * 7, x: a.x, z: a.z, y: a.y, yaw: 0 });
    }""")
# --- Hubschrauber: Kameramann in der offenen Schiebetür
rep("  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });\n  g.visible = false;",
    """  for (const sx of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.72), new THREE.MeshBasicMaterial({ color: 0x0a0b0c })); door.position.set(sx * 0.95, 1.45, 0.72); door.rotation.y = sx * Math.PI / 2; body.add(door);
    const op = new THREE.Group(); op.position.set(sx * 0.86, 1.08, 0.72); body.add(op);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 8), dark); torso.position.y = 0.34; op.add(torso);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.3 })); helm.position.y = 0.74; op.add(helm);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.18), dark); cam.position.set(sx * 0.24, 0.6, 0); op.add(cam);
    const lens2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.26).rotateZ(Math.PI / 2), glass); lens2.position.set(sx * 0.5, 0.6, 0); op.add(lens2);
  }
  body.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.visible = false;""")
_a = src.index("  // Hubschrauber: fliegt immer wieder eine Weile neben dem Fahrer her")
_b = src.index("  if (leave && h.t > h.dur + 12) { h.g.visible = false; TV.heli = null; TV.cd = 20 + Math.random() * 20; }\n}", _a)
_b += len("  if (leave && h.t > h.dur + 12) { h.g.visible = false; TV.heli = null; TV.cd = 20 + Math.random() * 20; }\n}")
src = src[:_a] + """  // Hubschrauber: drei Kamerateams gleichzeitig – seitlich mitfliegend, hoch kreisend, vorausfliegend
  const racing = race.state === 'race';
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  TV.helis.forEach((h, i) => {
    if (h.role === undefined) { h.role = ['side', 'high', 'lead'][i % 3]; h.cd = 3 + i * 6; h.on = false; }
    if (h.g.visible) { h.rotor.rotation.y += dt * 38; h.tr.rotation.x += dt * 60; }
    if (!h.on) {
      h.cd -= dt;
      if (!racing || h.cd > 0) return;
      h.on = true; h.t = 0; h.side = (i % 2 ? 1 : -1) * (Math.random() < 0.75 ? 1 : -1); h.a0 = Math.random() * 6.28;
      h.dur = h.role === 'high' ? 50 + Math.random() * 30 : 22 + Math.random() * 16;
      const back = h.role === 'lead' ? -260 : 170;
      h.pos.set(P.x - fx * back + rx * h.side * 70, P.y + (h.role === 'high' ? 150 : 60), P.z - fz * back + rz * h.side * 70); h.vel.set(0, 0, 0); h.g.visible = true;
    }
    h.t += dt;
    const leave = h.t > h.dur || !racing;
    let k = 1.4, c = 1.6;
    if (leave) _tvA.set(h.pos.x + rx * h.side * 80, P.y + 130, h.pos.z + rz * h.side * 80);
    else if (h.role === 'high') {
      const a = h.a0 + h.t * 0.09 * h.side, R = 115, x = P.x + fx * 35 + Math.sin(a) * R, z = P.z + fz * 35 + Math.cos(a) * R;
      _tvA.set(x, Math.max(P.y + 85, hAt(x, z) + 55), z); k = 0.8; c = 1.3;
    } else if (h.role === 'lead') {
      const ahead = 55 + Math.sin(h.t * 0.17) * 15, lat = h.side * (9 + Math.sin(h.t * 0.23) * 7), x = P.x + fx * ahead + rx * lat, z = P.z + fz * ahead + rz * lat;
      _tvA.set(x, Math.max(P.y + 20, hAt(x, z) + 17), z);
    } else {
      const lat = h.side * (22 + Math.sin(h.t * 0.3) * 6), ahead = 6 + Math.sin(h.t * 0.21) * 10, x = P.x + fx * ahead + rx * lat, z = P.z + fz * ahead + rz * lat;
      _tvA.set(x, Math.max(P.y + 14 + Math.sin(h.t * 0.5) * 3, hAt(x, z) + 12), z);
    }
    const ax = (_tvA.x - h.pos.x) * k - h.vel.x * c, ay = (_tvA.y - h.pos.y) * k - h.vel.y * c, az = (_tvA.z - h.pos.z) * k - h.vel.z * c;
    h.vel.x += ax * dt; h.vel.y += ay * dt; h.vel.z += az * dt;
    const sp = h.vel.length(); if (sp > 48) h.vel.multiplyScalar(48 / sp);
    h.pos.addScaledVector(h.vel, dt);
    const gy = hAt(h.pos.x, h.pos.z) + 9; if (h.pos.y < gy) { h.pos.y = gy; if (h.vel.y < 0) h.vel.y = 0; }
    const fwdYaw = sp > 3 ? Math.atan2(h.vel.x, h.vel.z) : Math.atan2(P.x - h.pos.x, P.z - h.pos.z);
    let dy = fwdYaw - h.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    h.yaw += dy * Math.min(1, dt * 1.5);
    const lx = ax * Math.cos(h.yaw) - az * Math.sin(h.yaw), lz = ax * Math.sin(h.yaw) + az * Math.cos(h.yaw);
    h.bank = damp(h.bank, clamp(-lx * 0.02, -0.5, 0.5), 2, dt); h.pitch = damp(h.pitch || 0, clamp(lz * 0.015, -0.3, 0.3), 2, dt);
    h.g.position.copy(h.pos); h.g.rotation.set(h.pitch, h.yaw, h.bank, 'YXZ');
    const dCam = h.pos.distanceTo(camera.position);
    if (typeof sfx === 'function' && Math.random() < dt * 3 && dCam < 160) sfx('heli', h.pos, dCam);
    if (leave && h.t > h.dur + 14) { h.on = false; h.g.visible = false; h.cd = 10 + Math.random() * 16; }
  });
  TV.heli = TV.helis.find((o) => o.on) || null;
}""" + src[_b:]
# --- Event-Modul einsetzen, aufbauen, aktualisieren
rep("const KW = { crest: [], cross: null, alm: null };", rd('event.js') + "\nconst KW = { crest: [], cross: null, alm: null };")
rep("world.add(buildTV(mulberry32(61))); world.add(buildCrowd());",
    "world.add(buildTV(mulberry32(61))); try { world.add(buildEvent(mulberry32(83))); } catch (err) { console.warn('Event nicht aufgebaut', err); } world.add(buildCrowd());")
rep("    updateTV(frameDt, uTime.value);", "    updateTV(frameDt, uTime.value);\n    updateEvent(frameDt, uTime.value);")
rep('<div class="eyebrow">Vorabversion v22 · Ton, Kamerateams, Zusammenfassung · Browser</div>',
    '<div class="eyebrow">Vorabversion v23 · Event-Trubel, Hubschrauber, Gämsen · Browser</div>')
rep("const a = spotOff(s, side * 34), b = spotOff(s + 14, -side * 40);", "const a = spotOff(s, side * 24), b = spotOff(s + 12, -side * 30);")
rep("if (ev.state === 'idle' && ds < 110 && ds > 45) { ev.state = 'run'; ev.t = 0; }", "if (ev.state === 'idle' && ds < 95 && ds > 40) { ev.state = 'run'; ev.t = 0; }")
rep("[0x6a3a44, 0x8a6a5a, 0xc8b8a6, 0x4a3a52, 0x7a4a3a, 0x3a4a5a, 0xa89a8a, 0x5a2a36]", "[0x6a3a44, 0x5a4a4a, 0xc9c6bc, 0x4a3a52, 0x6a3a2e, 0x3a4a5a, 0x8a8e94, 0x5a2a36]")
rep("ban.rotation.y = f[3] + (f[4] > 0 ? Math.PI / 2 : -Math.PI / 2) - Math.PI / 2;", "ban.rotation.y = f[3] + (f[4] > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI / 2;")
