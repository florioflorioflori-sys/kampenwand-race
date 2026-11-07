# v26: Sprünge mit den Beinen abfedern, Landung nach echter Aufprallgeschwindigkeit, Gondeln halten vor der Stationswand
# --- Aufprallgeschwindigkeit messen (Spieler: Normalgeschwindigkeit, KI: gegen die Bodenneigung)
rep("      P.comp = Math.min(1, -vn * 0.14);", "      P.comp = Math.min(1, -vn * 0.14); P.landV = Math.max(0, -vn);")
rep("    if (A.y <= h) { A.y = h; A.air = false; A.comp = 0.7;",
    "    if (A.y <= h) { const k0 = trailIdx(A.s - 1.5), k1 = trailIdx(A.s + 1.5), gvy = k1 > k0 ? A.v * (trail.y[k1] - trail.y[k0]) / ((k1 - k0) * TRAIL_STEP) : 0; A.landV = Math.max(0, gvy - A.vy); A.y = h; A.air = false; A.comp = clamp(A.landV * 0.14, 0.25, 1);")
rep("bF: sus.bF || 0, bR: sus.bR || 0, vy: r.vel.y,", "bF: sus.bF || 0, bR: sus.bR || 0, vy: r.vel.y, landV: r.landV || 0,")
rep("bF: sus.bF || 0, bR: sus.bR || 0, vy: A.air ? A.vy || 0 : 0,", "bF: sus.bF || 0, bR: sus.bR || 0, vy: A.air ? A.vy || 0 : 0, landV: A.landV || 0,")
# --- Körper: Landung federt mit Beinen und Armen, je härter desto tiefer und länger
rep("if (D.wasAir && !st.air && !(st.crashT > 0)) D.vy -= 1.3 + 2.8 * Math.min(1, st.comp || 0);",
    """if (D.wasAir && !st.air && !(st.crashT > 0)) { const lv = st.landV || 3 + 3 * Math.min(1, st.comp || 0); D.vy -= clamp(0.6 + lv * 0.5, 0.8, 5); D.land = Math.max(D.land || 0, clamp(lv / 7, 0.25, 1)); }
  D.land = damp(D.land || 0, 0, 3.2, dt);""")
rep("const K = 75, C = 10;\n  D.vx += (K * (tx - D.x) - C * D.vx) * dt;\n  D.vy += (K * 1.3 * (ty - D.y) - C * D.vy) * dt;",
    "const K = 75, C = 10, Ky = K * 1.3 * (1 - 0.35 * D.land), Cy = C + 6 * D.land;\n  D.vx += (K * (tx - D.x) - C * D.vx) * dt;\n  D.vy += (Ky * (ty - D.y) - Cy * D.vy) * dt;")
rep("D.y = clamp(D.y + D.vy * dt, -0.32, 0.1);", "D.y = clamp(D.y + D.vy * dt, -0.36, 0.1);")
# Oberkörper klappt bei der Landung nach vorn, Ellbogen beugen sich mit
rep("const ta = 0.75 + 0.3 * c - 0.3 * b + ped * 0.2 + sag * 0.25 - (st.air ? 0.08 : 0);",
    "const _ld = st.dyn ? st.dyn.land || 0 : 0, _dy = st.dyn ? Math.min(0, st.dyn.y) : 0;\n  const ta = 0.75 + 0.3 * c - 0.3 * b + ped * 0.2 + sag * 0.25 - (st.air ? 0.08 : 0) + _ld * 0.22 - _dy * 0.9;")
# Unebenheiten: Rahmen arbeitet stärker, der Körper bleibt ruhiger
rep("const fF = 0.6 * (st.bF || 0), fR = 0.6 * (st.bR || 0);", "const fF = 0.95 * (st.bF || 0), fR = 0.95 * (st.bR || 0);")
rep("+ ped * 0.02 + frameY * 0.3;", "+ ped * 0.02 + frameY * 0.18;")
# Vor der Landung Beine strecken und Rad zum Boden drücken
rep("oy += D.airK * (0.15 - 0.16 * falling);", "oy += D.airK * (0.15 - 0.25 * falling);")
# --- Gondeln verschwinden in der offenen Einfahrt am Umlenkrad, nicht erst in der Wand
rep("Math.hypot(_p.x - st.x, _p.z - st.z) < 9.5;", "Math.hypot(_p.x - st.x, _p.z - st.z) < 15.6;")
rep("0.65 * Math.min(1, _ge / 0.02)", "0.65 * Math.min(1, Math.max(0, _ge - 0.008) / 0.025)")
rep('<div class="eyebrow">Vorabversion v25 · Fahrtechnik, Kamerateams, Natur · Browser</div>',
    '<div class="eyebrow">Vorabversion v26 · Sprünge abfedern, Gondeln · Browser</div>')
