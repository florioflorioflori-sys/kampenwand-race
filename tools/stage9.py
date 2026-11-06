# v24: Fahrer und Bike federn sichtbar – Gabel/Dämpfer arbeiten auf Wurzeln und Steinen,
# der Fahrer fängt das mit Beinen und Armen ab, wiegt beim Treten, zieht im Sprung an, streckt vor der Landung
# --- Fahrbahnunebenheiten je Rad (Meter), Federweg reagiert darauf
rep("""  const ch = air ? 0 : Math.min(1, sp / 12) * 0.35;
  const tf = air ? -0.05 : comp + ch * (vnoise(s * 1.9, 0.5) - 0.35), tr = air ? -0.05 : comp * 0.9 + ch * (vnoise((s - 1.3) * 1.9, 0.5) - 0.35);""",
"""  const ch = air ? 0 : Math.min(1, sp / 12) * 0.35;
  // Bodenwellen, Steinfeld-Rattern und einzelne Wurzeln; vorne und hinten zeitversetzt
  const bump = (x) => 0.045 * (vnoise(x * 0.8, 3.1) - 0.5) + 0.036 * (vnoise(x * 4.6, 7.7) - 0.5) + 0.09 * Math.pow(Math.max(0, vnoise(x * 2.3, 11.3) - 0.62) / 0.38, 2);
  const bk = air ? 0 : clamp((sp - 1) / 9, 0, 1.25);
  S.bF = damp(S.bF || 0, bump(s + 0.62) * bk, 30, dt); S.bR = damp(S.bR || 0, bump(s - 0.62) * bk, 30, dt);
  const tf = air ? -0.05 : 0.22 + comp + ch * (vnoise(s * 1.9, 0.5) - 0.35) + S.bF * 5.5, tr = air ? -0.05 : 0.22 + comp * 0.9 + ch * (vnoise((s - 1.3) * 1.9, 0.5) - 0.35) + S.bR * 5;""")
rep("S.vf += (220 * (tf - S.f) - 18 * S.vf) * dt; S.f = clamp(S.f + S.vf * dt, -0.1, 1);",
    "S.vf += (260 * (tf - S.f) - 17 * S.vf) * dt; S.f = clamp(S.f + S.vf * dt, -0.1, 1);")
# Status an die Pose weitergeben: Unebenheiten und Vertikalgeschwindigkeit
rep("compF: sus.f, compR: sus.r, steer: r.steerVis,", "compF: sus.f, compR: sus.r, bF: sus.bF || 0, bR: sus.bR || 0, vy: r.vel.y, steer: r.steerVis,")
rep("compF: sus.f, compR: sus.r, steer: A.steerVis || 0,", "compF: sus.f, compR: sus.r, bF: sus.bF || 0, bR: sus.bR || 0, vy: A.air ? A.vy || 0 : 0, steer: A.steerVis || 0,")
# --- Körperfeder: Landung tiefer, Rahmenbewegung kommt gedämpft im Becken an
rep("if (D.wasAir && !st.air && !(st.crashT > 0)) D.vy -= 0.8 + 1.8 * Math.min(1, st.comp || 0);",
    "if (D.wasAir && !st.air && !(st.crashT > 0)) D.vy -= 1.3 + 2.8 * Math.min(1, st.comp || 0);")
rep("const ty = -0.05 * c - 0.05 * b - sag * 0.1 + (st.air ? 0.03 : 0) + ped * 0.02;",
    "const frameY = 0.45 * ((st.bF || 0) + (st.bR || 0)) / 2;\n  const ty = -0.05 * c - 0.05 * b - sag * 0.14 + (st.air ? 0.03 : 0) + ped * 0.02 + frameY * 0.3;")
rep("D.x = clamp(D.x + D.vx * dt, -0.14, 0.14); D.y = clamp(D.y + D.vy * dt, -0.2, 0.1);",
    "D.x = clamp(D.x + D.vx * dt, -0.14, 0.14); D.y = clamp(D.y + D.vy * dt, -0.32, 0.1);")
# --- Bike: Rahmen hebt und kippt mit den Unebenheiten (Fahrer bleibt ruhiger -> Beine und Arme arbeiten)
rep("  if (ped && !st.air) roll += Math.sin(st.crankA) * 0.075 * (1 - c * 0.4);",
    """  if (ped && !st.air) roll += Math.sin(st.crankA) * 0.13 * (1 - c * 0.35);
  if (!st.air && !(st.crashT > 0)) { const fF = 0.6 * (st.bF || 0), fR = 0.6 * (st.bR || 0); pitch -= (fF - fR) / 1.25; oy += (fF + fR) / 2; }""")
rep("""  oy += D.airK * 0.07;
  pitch += D.airK * -0.06;""",
"""  // in der Luft: steigend Bike anziehen, fallend Beine strecken und Vorderrad zur Landung absenken
  const vy = st.vy || 0, falling = clamp((-vy - 1) / 4, 0, 1);
  oy += D.airK * (0.15 - 0.16 * falling);
  pitch += D.airK * (-0.09 + 0.14 * falling);""")
# --- Federweg sichtbar größer (Downhill: ~200 mm)
rep("u.bike.userData.sagY = -(cf + cr) * 0.5 * 0.1;", "u.bike.userData.sagY = -(cf + cr) * 0.5 * 0.12;")
rep("u.sus.fork.position.copy(u.sus.ax).multiplyScalar(-0.11 * cf);", "u.sus.fork.position.copy(u.sus.ax).multiplyScalar(-0.16 * clamp(cf, -0.1, 1));")
rep("u.sus.swing.rotation.x = Math.asin(clamp(cr * 0.1 / 0.6, -0.5, 0.5));", "u.sus.swing.rotation.x = Math.asin(clamp(cr * 0.14 / 0.6, -0.5, 0.5));")
rep("u.sus.shock.scale.y = 1 - 0.28 * cr;", "u.sus.shock.scale.y = 1 - 0.36 * clamp(cr, -0.1, 1);")
# --- Treten: Wiegetritt mit Hüftschwung, Druck nach unten bei jedem Tritt
rep("const ped = st.pedal ? 1 : 0, rock = ped * Math.sin(st.crankA) * 0.05;",
    "const ped = st.pedal ? 1 : 0, rock = ped * Math.sin(st.crankA) * 0.085, push = ped * Math.abs(Math.cos(st.crankA)) * 0.03;")
rep("RP.hip.set((st.bodyX || 0) + rock, 1.0 - 0.13 * c - sag * 0.2 + lift + ped * 0.04 - 0.04 * b,",
    "RP.hip.set((st.bodyX || 0) + rock, 1.0 - 0.13 * c - sag * 0.24 + lift + ped * 0.04 - 0.04 * b - push,")
rep('<div class="eyebrow">Vorabversion v23 · Event-Trubel, Hubschrauber, Gämsen · Browser</div>',
    '<div class="eyebrow">Vorabversion v24 · Federung und lebendige Fahrer · Browser</div>')
rep("  const sag = Math.max(cf, cr);", "  const sag = Math.max(0, Math.max(cf, cr) - 0.22);")
rep("const sag = Math.max(st.compF || 0, st.compR || 0);", "const sag = Math.max(0, Math.max(st.compF || 0, st.compR || 0) - 0.22);")
