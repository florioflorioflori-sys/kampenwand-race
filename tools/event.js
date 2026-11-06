// ------------------------------------------------------------------
// Rennveranstaltung: Verkaufsstände, Fahrerlager, Zeitmessung mit Kabeln,
// Lichtschranken und LED-Tafel, Stromaggregat, Lautsprecher, Trubel an
// Start und Ziel, spielende Kinder, Adler über Start und Ziel
// ------------------------------------------------------------------
const EV = { boards: [], kids: [], groups: [], smoke: [], taken: [], split: null, splitDone: false, boardT: 0 };
// Kinder rennen: Fangen spielen zwischen den Zuschauern
POSES.kidrun = (t, e, ph) => {
  const j = baseSkel(0.13), a = t * 10 + ph, s = Math.sin(a), c = Math.cos(a);
  j.pelvis.y = 0.95 + Math.abs(c) * 0.05; j.pelvis.z = 0.02;
  j.hpL.y = j.hpR.y = j.pelvis.y - 0.03;
  j.ftL.set(0.1, 0.08 + Math.max(0, c) * 0.26, s * 0.34); j.ftR.set(-0.1, 0.08 + Math.max(0, -c) * 0.26, -s * 0.34);
  j.kneePole = V(0.05, 0, 1); j.kneePoleR = V(-0.05, 0, 1);
  j.haL.set(0.2, 1.02 + Math.max(0, -s) * 0.14, 0.05 - s * 0.26); j.haR.set(-0.2, 1.02 + Math.max(0, s) * 0.14, 0.05 + s * 0.26);
  j.elbowPole = V(0.4, -0.3, -1); j.elbowPoleR = V(-0.4, -0.3, -1);
  j.headQ = E(-0.12, Math.sin(t * 1.3 + ph) * 0.3, 0);
  return shiftY(j, Math.abs(c) * 0.03);
};
// Standpersonal: bedient, reicht über die Theke, wischt
POSES.vendor = (t, e, ph) => {
  const j = baseSkel(0.06), k = Math.sin(t * 0.9 + ph), r = Math.max(0, Math.sin(t * 0.45 + ph * 2));
  j.haL.set(0.2, 1.03, 0.36 + Math.sin(t * 3 + ph) * 0.05); j.haR.set(-0.16, 1.05 + r * 0.25, 0.38 + r * 0.25);
  j.elbowPole = V(1, -0.4, -0.5); j.elbowPoleR = V(-1, -0.4, -0.5);
  j.headQ = E(0.2 - r * 0.2, k * 0.25, 0);
  j.props = r > 0.5 ? [{ a: j.haR.clone().add(V(0, 0.02, 0.03)), b: j.haR.clone().add(V(0, 0.15, 0.03)), r: 0.038, col: 0xf2ede2 }] : [];
  return j;
};
// am Grill: Zange wendet die Würste
POSES.griller = (t, e, ph) => {
  const j = baseSkel(0.1), w = Math.sin(t * 1.7 + ph);
  j.haL.set(0.22, 1.0, 0.3); j.haR.set(-0.12 + w * 0.06, 1.08 + Math.max(0, w) * 0.06, 0.42);
  j.elbowPole = V(1, -0.4, -0.5); j.elbowPoleR = V(-1, -0.4, -0.5);
  j.headQ = E(0.45, w * 0.1, 0);
  j.props = [{ a: j.haR.clone(), b: j.haR.clone().add(V(0.02, -0.05, 0.28)), r: 0.008, col: 0xb0b4b8 }];
  return j;
};
// isst eine Wurstsemmel am Stehtisch
POSES.eat = (t, e, ph) => {
  const j = baseSkel(0.05), bite = Math.pow(Math.max(0, Math.sin(t * 0.7 + ph)), 3);
  j.haL.set(0.16, 1.04, 0.3); j.elbowPole = V(1, -0.5, -0.4);
  j.haR.set(-0.08, 1.18 + bite * 0.36, 0.3 - bite * 0.12); j.elbowPoleR = V(-1, -0.6, -0.3);
  j.headQ = E(0.1 - bite * 0.12, Math.sin(t * 0.3 + ph) * 0.3, 0);
  j.props = [{ a: j.haR.clone().add(V(0.06, 0.02, 0.02)), b: j.haR.clone().add(V(-0.08, 0.02, 0.04)), r: 0.03, col: 0xc89a5a },
    { a: j.haL.clone(), b: j.haL.clone().add(V(0, 0.01, 0)), r: 0.09, col: 0xf4f2ec }];
  return j;
};

function buildEvent(rand) {
  const grp = new THREE.Group();
  const L = trail.L, T = TRAIL_HALF;
  const M = {
    wood: new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.85 }),
    plank: new THREE.MeshStandardMaterial({ color: 0x6f5232, roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.55 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.3, metalness: 0.85 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.4, metalness: 0.7 }),
    white: new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: 0.7 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.95, side: THREE.DoubleSide }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x18191a, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1a2630, roughness: 0.08, metalness: 0.6 }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffe2a0, toneMapped: false }),
    red: new THREE.MeshStandardMaterial({ color: 0xc23022, roughness: 0.5 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xe8b818, roughness: 0.55 }),
    beer: new THREE.MeshStandardMaterial({ color: 0xd99a22, roughness: 0.15, transparent: true, opacity: 0.88 }),
    foam: new THREE.MeshStandardMaterial({ color: 0xfaf6ea, roughness: 0.9 }),
    sausage: new THREE.MeshStandardMaterial({ color: 0x8a4424, roughness: 0.45 }),
    bread: new THREE.MeshStandardMaterial({ color: 0x9a5a22, roughness: 0.6 }),
  };
  const mesh = (geo, m, parent, x = 0, y = 0, z = 0, ry = 0, shadow = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; if (shadow) o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const box = (w, h, d, m, parent, x, y, z, ry = 0, shadow = true) => mesh(new THREE.BoxGeometry(w, h, d), m, parent, x, y, z, ry, shadow);
  const cyl = (r0, r1, h, m, parent, x, y, z, seg = 14, shadow = true) => mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m, parent, x, y, z, 0, shadow);
  const toW = (g, lx, lz) => { const c = Math.cos(g.yaw), s = Math.sin(g.yaw); return [g.x + c * lx + s * lz, g.z - s * lx + c * lz]; };
  const keep = (p) => p.ev || p.tv || p.crew || p.photog || p.flash || (life.dashers && life.dashers.some((d) => d.p === p)) || START.crew.includes(p);
  const clearR = (x, z, r) => { for (let i = life.people.length - 1; i >= 0; i--) { const p = life.people[i]; if (!keep(p) && Math.hypot(p.x - x, p.z - z) < r) life.people.splice(i, 1); } };
  const clearRect = (g, w, d, pad = 0.4) => {
    const c = Math.cos(g.yaw), s = Math.sin(g.yaw);
    for (let i = life.people.length - 1; i >= 0; i--) {
      const p = life.people[i]; if (keep(p)) continue;
      const dx = p.x - g.x, dz = p.z - g.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < w / 2 + pad && Math.abs(lz) < d / 2 + pad) life.people.splice(i, 1);
    }
  };
  const blocked = (x, z, r) => {
    if (stationA && Math.hypot(x - stationA.x, z - stationA.z) < 17) return true;
    if (stationB && Math.hypot(x - stationB.x, z - stationB.z) < 20) return true;
    for (const s of reservedSpots) if (s[2] >= 2 && Math.hypot(x - s[0], z - s[1]) < s[2] + r * 0.6) return true;
    for (const s of EV.taken) if (Math.hypot(x - s[0], z - s[1]) < s[2] + r) return true;
    return false;
  };
  const okGround = (x, z, margin) => trailDistAt(x, z) > T + margin && scDistAt(x, z) > SC_HALF + 1.2 && Math.abs(x) < HALF - 10 && Math.abs(z) < HALF - 10;
  // freien, halbwegs ebenen Platz suchen; Vorderseite zeigt zur Strecke (oder nach face)
  const findSpot = (s0, lat0, w, d, o = {}) => {
    const r = Math.hypot(w, d) / 2 + (o.pad ?? 0.6);
    for (let k = 0; k < (o.tries ?? 60); k++) {
      const ss = s0 + (k ? (rand() - 0.5) * (o.spanS ?? 24) : 0);
      const ll = lat0 + (k ? Math.sign(lat0) * (rand() - 0.25) * (o.spanL ?? 10) : 0);
      if (Math.abs(ll) < T + 2) continue;
      const pt = o.at ? o.at(ss, ll) : trailPoint(ss, ll, {});
      let yaw = o.face !== undefined ? o.face : facingTrail(ss, ll) + (o.yawOff || 0);
      // Vorderseite möglichst bergseitig, die Rückseite steht dann auf Stelzen
      if (o.uphill) {
        let best = -1e9;
        for (const dy of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
          const yy = yaw + dy, c = Math.cos(yy), sn = Math.sin(yy);
          const hf = hAt(pt.x + sn * d / 2, pt.z + c * d / 2), hb = hAt(pt.x - sn * d / 2, pt.z - c * d / 2);
          const sc = hf - hb - (dy ? 0.25 : 0);
          if (sc > best) { best = sc; o._y = yy; }
        }
        yaw = o._y;
      }
      const g = { x: pt.x, z: pt.z, yaw, s: ss, lat: ll };
      if (blocked(g.x, g.z, r)) continue;
      let lo = 1e9, hi = -1e9, bad = false;
      for (const [cx, cz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0], [0, d / 2 + (o.front ?? 0)]]) {
        const [x, z] = toW(g, cx, cz), h = hAt(x, z);
        if (!okGround(x, z, o.margin ?? 1.6)) { bad = true; break; }
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      if (bad || hi - lo > (o.maxDy ?? 2.0)) continue;
      g.lo = lo; g.hi = hi; g.y = hi + 0.02;
      EV.taken.push([g.x, g.z, r]); reservedSpots.push([g.x, g.z, r]);
      clearRect(g, w + 0.6, d + 0.6 + (o.front ?? 0) * 2);
      return g;
    }
    EV.miss = (EV.miss || 0) + 1;
    return null;
  };
  const place = (g, h = 0) => { const o = new THREE.Group(); o.position.set(g.x, g.y + h, g.z); o.rotation.y = g.yaw; grp.add(o); return o; };
  // Holzpodest gegen den Hang
  // Holzboden, am Hang auf Stelzen mit Querstreben
  const deck = (o, g, w, d) => {
    if (g.y - g.lo < 0.12) return;
    box(w, 0.1, d, M.plank, o, 0, -0.03, 0, 0, true);
    const nx = Math.max(2, Math.round(w / 1.6) + 1), nz = Math.max(2, Math.round(d / 1.6) + 1);
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      if (i > 0 && i < nx - 1 && k > 0 && k < nz - 1) continue;
      const lx = -w / 2 + 0.06 + i * (w - 0.12) / (nx - 1), lz = -d / 2 + 0.06 + k * (d - 0.12) / (nz - 1);
      const [x, z] = toW(g, lx, lz), h = g.y - hAt(x, z) + 0.05;
      if (h < 0.1) continue;
      box(0.1, h, 0.1, M.wood, o, lx, -h / 2, lz, 0, true);
    }
    for (const sz of [-1, 1]) { const [x, z] = toW(g, 0, sz * d / 2), h = g.y - hAt(x, z); if (h > 0.4) box(w, 0.06, 0.04, M.wood, o, 0, -h * 0.5, sz * (d / 2 - 0.06), 0, false); }
    for (const sx of [-1, 1]) { const [x, z] = toW(g, sx * w / 2, 0), h = g.y - hAt(x, z); if (h > 0.4) box(0.04, 0.06, d, M.wood, o, sx * (w / 2 - 0.06), -h * 0.5, 0, 0, false); }
  };
  const person = (pose, x, z, yaw, opts = {}) => { const p = addPerson(rand, pose, x, z, yaw, { backpack: false, ...opts }); p.ev = true; return p; };

  // ---------- Texturen
  const stripeTex = (c1, c2, scallop) => canvasTex(256, 64, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? c2 : c1; x.fillRect(i * 32, 0, 32, h); }
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 0, w, 3);
    if (scallop) { x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 8; i++) { x.beginPath(); x.ellipse(i * 32 + 32, h + 6, 16, 26, 0, 0, Math.PI * 2); x.fill(); } }
  });
  const signTex = (title, sub, c1, c2) => canvasTex(1024, 160, (x, w, h) => {
    x.fillStyle = c1; x.fillRect(0, 0, w, h);
    x.strokeStyle = c2; x.lineWidth = 6; x.strokeRect(14, 14, w - 28, h - 28);
    x.fillStyle = c2; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `800 78px ${AD_FONT}`; x.fillText(title, w / 2, sub ? 64 : h / 2);
    if (sub) { x.font = 'italic 600 32px Georgia, serif'; x.fillText(sub, w / 2, 118); }
  });
  const icon = (x, kind, cx, cy, s) => {
    x.save(); x.translate(cx, cy); x.scale(s, s); x.lineCap = 'round';
    if (kind === 'wurst') { x.fillStyle = '#e8c27a'; x.beginPath(); x.ellipse(0, 10, 46, 16, 0, 0, 6.29); x.fill(); x.fillStyle = '#8a3418'; x.beginPath(); x.ellipse(0, 0, 52, 11, -0.05, 0, 6.29); x.fill(); x.strokeStyle = '#e8c21a'; x.lineWidth = 3; x.beginPath(); x.moveTo(-36, -2); for (let i = 0; i < 7; i++) x.lineTo(-36 + i * 12, i % 2 ? 3 : -4); x.stroke(); }
    else if (kind === 'drinks') { x.fillStyle = '#e0a12a'; x.fillRect(-24, -26, 44, 58); x.fillStyle = '#fbf5e4'; x.beginPath(); x.ellipse(-2, -28, 26, 10, 0, 0, 6.29); x.fill(); x.strokeStyle = '#d6cdb6'; x.lineWidth = 6; x.beginPath(); x.arc(24, 4, 13, -1.4, 1.4); x.stroke(); }
    else if (kind === 'schmarrn') { x.fillStyle = '#2a2a2a'; x.beginPath(); x.ellipse(0, 8, 50, 16, 0, 0, 6.29); x.fill(); x.fillRect(46, 4, 34, 7); x.fillStyle = '#d8a04a'; for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(-30 + (i % 5) * 14, 2 - Math.floor(i / 5) * 8, 9, 6, i, 0, 6.29); x.fill(); } x.fillStyle = '#fff'; for (let i = 0; i < 12; i++) x.fillRect(-34 + i * 6, -8 + (i % 3) * 4, 2, 2); }
    else if (kind === 'kaffee') { x.fillStyle = '#f4efe6'; x.fillRect(-26, -16, 44, 40); x.strokeStyle = '#f4efe6'; x.lineWidth = 6; x.beginPath(); x.arc(20, 2, 11, -1.4, 1.4); x.stroke(); x.strokeStyle = 'rgba(240,235,225,0.7)'; x.lineWidth = 3; for (const o of [-14, 0, 12]) { x.beginPath(); x.moveTo(o, -22); x.bezierCurveTo(o - 8, -32, o + 8, -38, o, -48); x.stroke(); } }
    else { x.strokeStyle = '#8a4a1a'; x.lineWidth = 12; x.beginPath(); x.moveTo(-40, 20); x.bezierCurveTo(-60, -30, -10, -40, 0, 0); x.bezierCurveTo(10, -40, 60, -30, 40, 20); x.moveTo(-40, 20); x.lineTo(20, -4); x.moveTo(40, 20); x.lineTo(-20, -4); x.stroke(); x.fillStyle = '#fff'; for (let i = 0; i < 10; i++) x.fillRect(-40 + i * 9, -18 + (i % 3) * 10, 3, 3); }
    x.restore();
  };
  const counterTex = (st) => canvasTex(1024, 320, (x, w, h) => {
    x.fillStyle = st.c2; x.fillRect(0, 0, w, h);
    // Holzoptik unten, Farbbalken oben
    x.fillStyle = st.c1; x.fillRect(0, 0, w, 54); x.fillRect(0, h - 40, w, 40);
    x.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 26; i++) x.fillRect(i * 40, h - 40, 2, 40);
    x.fillStyle = st.c2; x.font = `700 30px Barlow, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(st.sub.toUpperCase(), w / 2, 28);
    x.save(); x.beginPath(); x.arc(160, 170, 92, 0, 6.29); x.fillStyle = st.c1; x.fill(); x.restore();
    icon(x, st.k, 160, 172, 1.35);
    x.fillStyle = st.c1; x.textAlign = 'left'; x.font = `800 92px ${AD_FONT}`;
    let fs = 92; while (x.measureText(st.title).width > 700 && fs > 40) { fs -= 4; x.font = `800 ${fs}px ${AD_FONT}`; }
    x.fillText(st.title, 290, 150);
    x.font = 'italic 600 34px Georgia, serif'; x.fillStyle = '#4a4036'; x.fillText(st.claim, 292, 222);
  });
  const menuTex = (st) => canvasTex(256, 340, (x, w, h) => {
    x.fillStyle = '#6a4a2a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#20251f'; x.fillRect(10, 10, w - 20, h - 20);
    x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 40; i++) x.fillRect(10 + Math.random() * 230, 10 + Math.random() * 320, 30, 2);
    x.fillStyle = '#f2eee2'; x.textAlign = 'center'; x.font = 'italic 700 30px Georgia, serif'; x.fillText(st.board, w / 2, 44);
    x.strokeStyle = '#e8d27a'; x.lineWidth = 2; x.beginPath(); x.moveTo(40, 58); x.lineTo(w - 40, 58); x.stroke();
    x.font = '600 19px "Comic Sans MS", "Segoe Print", cursive'; x.textBaseline = 'middle';
    st.menu.forEach(([n, p], i) => { const y = 88 + i * 38; x.textAlign = 'left'; x.fillStyle = '#f2eee2'; x.fillText(n, 22, y); x.textAlign = 'right'; x.fillStyle = '#f0d070'; x.fillText(p + ' €', w - 20, y); });
  });

  // ---------- Verkaufsstand
  const STALLS = {
    wurst: { k: 'wurst', title: 'BRATWURST · LEBERKÄS', sub: 'vom Holzkohlegrill', claim: 'Metzgerei Hirschbichler · Aschau', board: 'Brotzeit', c1: '#7a1d16', c2: '#f3ece0', menu: [['Bratwurstsemmel', '4,50'], ['Leberkässemmel', '4,00'], ['Currywurst', '5,00'], ['Pommes', '3,50'], ['Senf · Ketchup', '0,00']] },
    drinks: { k: 'drinks', title: 'GETRÄNKE', sub: 'Bier · Radler · Spezi', claim: 'eiskalt vom Fass', board: 'Getränke', c1: '#1f4a2a', c2: '#efe6cf', menu: [['Helles 0,5 l', '5,20'], ['Radler 0,5 l', '5,00'], ['Spezi', '3,80'], ['Apfelschorle', '3,80'], ['Wasser', '3,00'], ['Pfand', '2,00']] },
    schmarrn: { k: 'schmarrn', title: 'KAISERSCHMARRN', sub: 'frisch aus der Pfanne', claim: 'mit Puderzucker & Apfelmus', board: 'Süßes', c1: '#8a5a1e', c2: '#f6efe2', menu: [['Kaiserschmarrn', '8,90'], ['mit Apfelmus', '9,50'], ['Germknödel', '7,50'], ['Apfelstrudel', '5,50']] },
    kaffee: { k: 'kaffee', title: 'KAFFEE & KUCHEN', sub: 'hausgemacht', claim: 'Café am Kampenwandweg', board: 'Kaffee', c1: '#3a2a24', c2: '#eadfcf', menu: [['Kaffee', '3,20'], ['Cappuccino', '3,80'], ['Kakao', '3,50'], ['Kuchen', '3,90'], ['Glühwein', '4,50']] },
    brezn: { k: 'brezn', title: 'BREZN & OBATZDA', sub: 'Bäckerei vom Tal', claim: 'resch und frisch gebacken', board: 'Brotzeit', c1: '#2a3a5a', c2: '#f1e8d6', menu: [['Butterbrezn', '2,90'], ['Obatzda + Brezn', '6,50'], ['Laugenstange', '2,20'], ['Weißwürste', '6,90']] },
  };
  const texCache = {};
  const stallMats = (st) => texCache[st.k] || (texCache[st.k] = {
    awn: new THREE.MeshStandardMaterial({ map: stripeTex(st.c1, '#f4efe4'), roughness: 0.85, side: THREE.DoubleSide }),
    val: new THREE.MeshStandardMaterial({ map: stripeTex(st.c1, '#f4efe4', true), roughness: 0.85, side: THREE.DoubleSide, alphaTest: 0.5 }),
    sign: new THREE.MeshStandardMaterial({ map: signTex(st.title, st.sub, st.c1, st.c2), roughness: 0.6 }),
    front: new THREE.MeshStandardMaterial({ map: counterTex(st), roughness: 0.65 }),
    menu: new THREE.MeshStandardMaterial({ map: menuTex(st), roughness: 0.9 }),
    wall: new THREE.MeshStandardMaterial({ color: new THREE.Color(st.c2), roughness: 0.8 }),
    col: new THREE.MeshStandardMaterial({ color: new THREE.Color(st.c1), roughness: 0.6 }),
  });
  const barTable = (x, z, nPeople) => {
    const y = hAt(x, z), o = new THREE.Group(); o.position.set(x, y, z); grp.add(o);
    cyl(0.03, 0.03, 1.08, M.alu, o, 0, 0.54, 0, 8);
    cyl(0.36, 0.36, 0.03, M.wood, o, 0, 1.09, 0, 18);
    mesh(new THREE.CylinderGeometry(0.37, 0.42, 1.04, 18, 1, true), M.cloth, o, 0, 0.56, 0);
    for (let k = 0; k < 2; k++) { cyl(0.04, 0.035, 0.16, M.beer, o, -0.12 + k * 0.22, 1.19, 0.08 - k * 0.15, 10, false); cyl(0.041, 0.041, 0.03, M.foam, o, -0.12 + k * 0.22, 1.28, 0.08 - k * 0.15, 10, false); }
    const pp = ['eat', 'beer', 'drink', 'talk', 'beer', 'eat'];
    for (let i = 0; i < nPeople; i++) {
      const a = (i / nPeople) * 6.28 + rand() * 0.5, px = x + Math.sin(a) * 0.62, pz = z + Math.cos(a) * 0.62;
      if (trailDistAt(px, pz) < T + 1) continue;
      person(pp[Math.floor(rand() * pp.length)], px, pz, a + Math.PI, { react: true });
    }
    addObstacle(x, z, 0.5);
  };
  const stall = (kind, s, lat, o = {}) => {
    const st = STALLS[kind], w = 3.4, d = 2.2;
    const g = findSpot(s, lat, w + 1.0, d + 1.0, { front: 0.8, maxDy: 2.6, uphill: true, ...o });
    if (!g) return null;
    const m = stallMats(st), S = place(g);
    deck(S, g, w + 0.8, d + 1.4);
    // Wände, Dach, Theke
    box(w, 2.3, 0.06, m.wall, S, 0, 1.15, -d / 2);
    for (const sx of [-1, 1]) { box(0.06, 2.3, d, m.wall, S, sx * w / 2, 1.15, 0); box(0.09, 2.5, 0.09, m.col, S, sx * w / 2, 1.25, d / 2); }
    box(w + 0.3, 0.08, d + 0.3, m.col, S, 0, 2.38, 0);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 1.0, 0.5), [m.wall, m.wall, m.wall, m.wall, m.front, m.wall]);
    counter.position.set(0, 0.5, d / 2 - 0.25); counter.castShadow = counter.receiveShadow = true; S.add(counter);
    box(w + 0.05, 0.05, 0.62, kind === 'kaffee' ? M.wood : M.steel, S, 0, 1.03, d / 2 - 0.22);
    box(w - 0.3, 0.9, 0.5, M.steel, S, 0, 0.45, -d / 2 + 0.3);
    // Markise mit Volant, Lichterkette, Kopfschild
    const awn = mesh(new THREE.PlaneGeometry(w + 0.3, 1.1), m.awn, S, 0, 2.26, d / 2 + 0.5);
    awn.rotation.x = -Math.PI / 2 + 0.38;
    const val = mesh(new THREE.PlaneGeometry(w + 0.3, 0.22), m.val, S, 0, 1.98, d / 2 + 1.0, 0, false);
    for (let i = 0; i < 9; i++) mesh(new THREE.SphereGeometry(0.03, 6, 4), M.bulb, S, -w / 2 + i * w / 8, 1.95 - Math.sin(i / 8 * Math.PI) * 0.06, d / 2 + 1.02, 0, false);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(w, 0.52, 0.08), [m.col, m.col, m.col, m.col, m.sign, m.col]); sign.position.set(0, 2.72, d / 2 - 0.02); sign.castShadow = true; S.add(sign);
    // Speisetafel innen und Kundenstopper davor
    mesh(new THREE.PlaneGeometry(0.9, 1.2), m.menu, S, -0.7, 1.65, -d / 2 + 0.04, 0, false);
    mesh(new THREE.PlaneGeometry(0.9, 1.2), m.menu, S, 0.6, 1.65, -d / 2 + 0.04, 0, false);
    { const ax = w / 2 + 0.55, az = d / 2 + 1.2; const [wx, wz] = toW(g, ax, az); const A = new THREE.Group(); A.position.set(wx, hAt(wx, wz), wz); A.rotation.y = g.yaw + 0.3; grp.add(A);
      const f1 = mesh(new THREE.PlaneGeometry(0.55, 0.75), m.menu, A, 0, 0.42, 0.1, 0); f1.rotation.x = -0.18; const f2 = mesh(new THREE.PlaneGeometry(0.55, 0.75), m.menu, A, 0, 0.42, -0.1, Math.PI); f2.rotation.x = 0.18; }
    // Ware
    const B = -d / 2 + 0.3, CT = d / 2 - 0.22;
    if (kind === 'wurst') {
      box(1.4, 0.16, 0.48, M.dark, S, -0.6, 0.98, B);
      for (let i = 0; i < 10; i++) { const s2 = mesh(new THREE.CapsuleGeometry(0.018, 0.13, 3, 6), M.sausage, S, -1.15 + i * 0.11, 1.08, B + (i % 2 ? 0.08 : -0.06), 0, false); s2.rotation.x = Math.PI / 2; }
      for (let i = 0; i < 5; i++) box(0.28, 0.07, 0.16, M.bread, S, 0.5 + (i % 3) * 0.12, 0.95 + Math.floor(i / 3) * 0.07, B, 0.2 * i, false);
      cyl(0.03, 0.03, 0.18, M.red, S, 0.9, 1.15, CT, 8); cyl(0.03, 0.03, 0.18, M.yellow, S, 1.0, 1.15, CT, 8);
      EV.smoke.push({ x: 0, y: 0, z: 0, wp: (() => { const [x, z] = toW(g, -0.6, B); return V(x, g.y + 1.15, z); })(), sp: [], cd: 0 });
    } else if (kind === 'drinks') {
      for (let i = 0; i < 3; i++) cyl(0.2, 0.2, 0.55, M.steel, S, -1.1 + i * 0.45, 0.28, B - 0.05, 16);
      for (let i = 0; i < 6; i++) box(0.4, 0.3, 0.3, i % 2 ? M.red : new THREE.MeshStandardMaterial({ color: 0x1f5a2e, roughness: 0.6 }), S, 0.4 + (i % 2) * 0.42, 0.15 + Math.floor(i / 2) * 0.3, B - 0.02, 0, true);
      cyl(0.04, 0.05, 0.4, M.steel, S, -0.6, 1.25, CT - 0.1, 10); box(0.3, 0.05, 0.05, M.steel, S, -0.6, 1.42, CT - 0.1);
      for (let i = 0; i < 7; i++) { cyl(0.04, 0.035, 0.18, M.beer, S, -0.2 + i * 0.13, 1.14, CT + (i % 2) * 0.1, 10, false); cyl(0.041, 0.041, 0.03, M.foam, S, -0.2 + i * 0.13, 1.24, CT + (i % 2) * 0.1, 10, false); }
    } else if (kind === 'schmarrn') {
      for (let i = 0; i < 2; i++) { cyl(0.32, 0.3, 0.07, M.dark, S, -0.8 + i * 0.75, 0.94, B, 20); cyl(0.29, 0.29, 0.02, M.bread, S, -0.8 + i * 0.75, 0.98, B, 20, false); }
      for (let i = 0; i < 5; i++) { cyl(0.12, 0.1, 0.02, M.white, S, -0.4 + i * 0.3, 1.07, CT, 14, false); cyl(0.08, 0.08, 0.03, M.bread, S, -0.4 + i * 0.3, 1.09, CT, 10, false); }
    } else if (kind === 'kaffee') {
      box(0.6, 0.45, 0.45, M.steel, S, -0.9, 1.15, B); box(0.5, 0.2, 0.02, M.dark, S, -0.9, 1.1, B + 0.23);
      for (let i = 0; i < 8; i++) cyl(0.04, 0.032, 0.08, M.white, S, 0.1 + (i % 4) * 0.11, 1.1 + Math.floor(i / 4) * 0.08, CT, 10, false);
      for (let i = 0; i < 2; i++) { cyl(0.16, 0.16, 0.1, M.bread, S, 0.9 + i * 0.4 - 0.2, 1.11, CT, 16); mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, 6.29, 0, 1.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.25 }), S, 0.7 + i * 0.4, 1.06, CT, 0, false); }
    } else {
      cyl(0.015, 0.015, 0.8, M.wood, S, 0.9, 1.45, CT, 6);
      for (let i = 0; i < 8; i++) { const a = i * 0.785, r2 = mesh(new THREE.TorusGeometry(0.075, 0.022, 6, 14), M.bread, S, 0.9 + Math.sin(a) * 0.13, 1.25 + (i % 3) * 0.2, CT + Math.cos(a) * 0.13, a, false); }
      for (let i = 0; i < 3; i++) { cyl(0.2, 0.16, 0.12, M.wood, S, -1.0 + i * 0.5, 1.1, CT, 12); for (let k = 0; k < 3; k++) { const b2 = mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12), M.bread, S, -1.05 + i * 0.5 + k * 0.05, 1.18, CT, 0, false); b2.rotation.x = Math.PI / 2 + 0.4; } }
    }
    // Personal hinter der Theke
    const staff = kind === 'wurst' ? ['griller', 'vendor'] : ['vendor', 'vendor'];
    staff.forEach((pose, i) => {
      const lx = pose === 'griller' ? -0.6 : (i ? 0.7 : -0.6), lz = pose === 'griller' ? B + 0.52 : d / 2 - 0.85;
      const [x, z] = toW(g, lx, lz);
      const p = person(pose, x, z, pose === 'griller' ? g.yaw + Math.PI : g.yaw, { react: false, look: false, y: g.y, top: [0xf0ece4, new THREE.Color(st.c1).getHex(), 0x2a2a2a][Math.floor(rand() * 3)], hat: rand() < 0.6 ? 'cap' : null, hatCol: new THREE.Color(st.c1).getHex(), glasses: false, scarf: false });
      p.noReal = false;
    });
    // Schlange vor der Theke
    const nq = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < nq; i++) {
      const [x, z] = toW(g, (rand() - 0.5) * 0.4 + (i ? 0 : -0.3), d / 2 + 0.75 + i * 0.68);
      if (trailDistAt(x, z) < T + 1.2) break;
      person(i === 0 ? 'stand' : ['pockets', 'phone', 'stand', 'crossed', 'hips'][Math.floor(rand() * 5)], x, z, g.yaw + Math.PI + (rand() - 0.5) * 0.4, { react: true });
    }
    // Stehtische und Mülltonne
    for (const sx of [-1, 1]) if (rand() < 0.85) { const [x, z] = toW(g, sx * (w / 2 + 1.3), d / 2 + 0.6 + rand() * 1.2); if (okGround(x, z, 2)) { clearR(x, z, 1.0); barTable(x, z, 2 + Math.floor(rand() * 3)); } }
    { const [x, z] = toW(g, -w / 2 - 0.45, -0.4); cyl(0.26, 0.24, 0.9, new THREE.MeshStandardMaterial({ color: 0x2a5a32, roughness: 0.6 }), grp, x, hAt(x, z) + 0.45, z, 14); }
    addObstacle(g.x, g.z, 2.2);
    (EV.stalls || (EV.stalls = [])).push(g); g.kind = kind;
    return g;
  };

  // ---------- Werbefahnen (Beachflags)
  const flagGeo = new THREE.PlaneGeometry(0.75, 3.0, 6, 12).translate(0.42, 0, 0), poleGeo = new THREE.CylinderGeometry(0.025, 0.03, 4.4, 6).translate(0, 2.2, 0);
  const featherFlag = (x, z, ad) => {
    const y = hAt(x, z); mesh(poleGeo, M.alu, grp, x, y, z, 0, false);
    const fm = new THREE.InstancedMesh(flagGeo, flagWave(new THREE.MeshStandardMaterial({ map: adTex(ad, 96, 384, true), roughness: 0.8, side: THREE.DoubleSide })), 1);
    fm.setMatrixAt(0, new THREE.Matrix4().compose(V(x + 0.02, y + 2.85, z), new THREE.Quaternion().setFromAxisAngle(_UP, rand() * 6.28), V(1, 1, 1))); fm.castShadow = true; grp.add(fm);
  };

  // ---------- Kabel am Boden (folgen dem Gelände)
  const cableGeos = [];
  const cable = (pts, r = 0.011) => {
    const P = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.45));
      for (let k = 0; k < n; k++) { const u = k / n, x = ax + (bx - ax) * u + (rand() - 0.5) * 0.05, z = az + (bz - az) * u + (rand() - 0.5) * 0.05; P.push(V(x, hAt(x, z) + r + 0.004, z)); }
    }
    const [lx, lz] = pts[pts.length - 1]; P.push(V(lx, hAt(lx, lz) + r + 0.004, lz));
    if (P.length < 2) return;
    cableGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P), P.length * 2, r, 5, false));
  };
  const tp = (s, lat) => { const p = trailPoint(s, lat, {}); return [p.x, p.z]; };
  // Kabelbrücke quer über die Strecke (gelb-schwarz)
  const bridgeTex = canvasTex(256, 32, (x, w, h) => { x.fillStyle = '#e8b818'; x.fillRect(0, 0, w, h); x.fillStyle = '#1a1a1a'; for (let i = -2; i < 18; i++) { x.beginPath(); x.moveTo(i * 16, h); x.lineTo(i * 16 + 8, h); x.lineTo(i * 16 + 24, 0); x.lineTo(i * 16 + 16, 0); x.fill(); } }, { repeat: true });
  const bridgeM = new THREE.MeshStandardMaterial({ map: bridgeTex, roughness: 0.75 });
  const cableBridge = (s) => {
    const n = Math.ceil((T * 2 + 1.2) / 0.9);
    for (let i = 0; i < n; i++) {
      const lat = -T - 0.6 + (i + 0.5) * 0.9, pt = trailPoint(s, lat, {});
      const o = new THREE.Group(); o.position.set(pt.x, hAt(pt.x, pt.z), pt.z); o.rotation.y = pt.yaw; grp.add(o);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.05, 0.34), bridgeM); seg.position.y = 0.025; seg.receiveShadow = true; o.add(seg);
      for (const sz of [-1, 1]) { const rp = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.012, 0.16), M.yellow); rp.position.set(0, 0.018, sz * 0.24); rp.rotation.x = sz * 0.3; o.add(rp); }
      const n0 = normalAt(pt.x, pt.z, new THREE.Vector3()); o.rotation.x = -Math.atan2(n0.z * Math.cos(pt.yaw) + n0.x * Math.sin(pt.yaw), n0.y) * 0.8;
    }
  };
  // Lichtschranke auf Stativ mit Reflektor gegenüber
  const photocell = (s, side, withCase) => {
    const pt = trailPoint(s, side * (T + 0.35), {}), y = hAt(pt.x, pt.z), o = new THREE.Group(); o.position.set(pt.x, y, pt.z); o.rotation.y = pt.yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2); grp.add(o);
    for (let i = 0; i < 3; i++) { const a = i * 2.09, lg = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), M.dark, o, Math.sin(a) * 0.16, 0.46, Math.cos(a) * 0.16, 0, false); lg.rotation.set(Math.cos(a) * 0.34, 0, -Math.sin(a) * 0.34); }
    box(0.1, 0.14, 0.12, withCase ? M.red : M.dark, o, 0, 0.95, 0); box(0.07, 0.07, 0.02, M.glass, o, 0, 0.96, 0.065, 0, false);
    if (withCase) { box(0.42, 0.3, 0.18, M.dark, o, 0.3, 0.15, -0.25); box(0.05, 0.03, 0.05, M.bulb, o, 0.4, 0.31, -0.2, 0, false); }
    return pt;
  };
  // Lautsprecher am Mast
  const speakerPole = (x, z, yaw) => {
    const y = hAt(x, z), o = new THREE.Group(); o.position.set(x, y, z); o.rotation.y = yaw; grp.add(o);
    cyl(0.045, 0.06, 5.0, M.alu, o, 0, 2.5, 0, 8); box(1.1, 0.06, 0.06, M.alu, o, 0, 4.7, 0);
    for (const sx of [-0.45, 0.45]) { const h = mesh(new THREE.CylinderGeometry(0.2, 0.06, 0.42, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8dad8, roughness: 0.5, side: THREE.DoubleSide }), o, sx, 4.62, 0.18); h.rotation.x = Math.PI / 2 + 0.25; h.rotation.z = sx * 0.4; }
    box(0.3, 0.2, 0.15, M.dark, o, 0, 1.2, 0.08);
    addObstacle(x, z, 0.3); clearR(x, z, 0.5);
  };
  // LED-Anzeigetafel auf Traversen
  const ledBoard = (g, kind) => {
    const o = place(g, 0); deck(o, g, 4.6, 1.2);
    for (const sx of [-2.05, 2.05]) { box(0.28, 4.6, 0.28, M.alu, o, sx, 2.3, 0); for (let k = 0; k < 9; k++) box(0.3, 0.02, 0.02, M.alu, o, sx, 0.3 + k * 0.5, 0.15, 0, false); }
    box(4.4, 0.28, 0.28, M.alu, o, 0, 4.7, 0);
    box(4.2, 2.45, 0.22, M.dark, o, 0, 3.15, -0.05);
    const c = document.createElement('canvas'); c.width = 640; c.height = 352;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); face.position.set(0, 3.15, 0.07); o.add(face);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.2), new THREE.MeshStandardMaterial({ map: adTex(SPONSORS[0], 512, 280), roughness: 0.6 })); back.position.set(0, 3.15, -0.17); back.rotation.y = Math.PI; o.add(back);
    // Gitter für LED-Optik
    const grid = canvasTex(64, 64, (x) => { x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, 64, 64); x.fillStyle = 'rgba(0,0,0,0.55)'; for (let i = 0; i < 64; i += 4) { x.fillRect(i, 0, 1, 64); x.fillRect(0, i, 64, 1); } }, { srgb: false, repeat: true });
    grid.repeat.set(10, 5.5);
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.2), new THREE.MeshBasicMaterial({ map: grid, transparent: true, depthWrite: false })); gm.position.set(0, 3.15, 0.075); o.add(gm);
    addObstacle(g.x, g.z, 2.4);
    EV.boards.push({ ctx: c.getContext('2d'), tex, kind, last: '' });
    return o;
  };
  // Zeitnehmerkabine mit Fenster, Laptops und Antenne
  const timingBooth = (g) => {
    const o = place(g); deck(o, g, 2.8, 2.4);
    const wallM = new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.6 });
    box(2.6, 0.95, 2.2, wallM, o, 0, 0.475, 0); box(2.6, 2.4, 0.08, wallM, o, 0, 1.2, -1.06);
    for (const sx of [-1, 1]) box(0.08, 2.4, 2.2, wallM, o, sx * 1.26, 1.2, 0);
    box(2.8, 0.12, 2.4, M.dark, o, 0, 2.46, 0);
    mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x9ab0c0, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.3 }), o, 0, 1.6, 1.08, 0, false);
    const sg = mesh(new THREE.PlaneGeometry(2.6, 0.4), new THREE.MeshStandardMaterial({ map: textTexture([['ZEITNAHME · TIMING', `800 70px ${AD_FONT}`]], 768, 118, '#1d1f1a', '#ffcf3a'), roughness: 0.6 }), o, 0, 2.2, 1.12, 0, false);
    box(2.3, 0.04, 0.6, M.wood, o, 0, 0.99, 0.7);
    for (const lx of [-0.6, 0.35]) { box(0.36, 0.02, 0.25, M.dark, o, lx, 1.02, 0.7, 0, false); const sc = box(0.36, 0.24, 0.015, new THREE.MeshBasicMaterial({ color: 0x9fd0ff, toneMapped: false }), o, lx, 1.14, 0.58, 0, false); sc.rotation.x = -0.25; }
    box(0.35, 0.25, 0.3, M.dark, o, 0.95, 1.12, 0.7);
    cyl(0.012, 0.012, 1.6, M.alu, o, 1.0, 3.3, -0.8, 6, false);
    const [px, pz] = toW(g, -0.2, 0.15); const p = person('crossed', px, pz, g.yaw, { react: true, y: g.y, top: 0x2a2f38, hat: null }); p.noReal = true;
    const [qx, qz] = toW(g, 0.7, -0.1); const q = person('phone', qx, qz, g.yaw + 0.4, { react: false, y: g.y, top: 0xe86a12, hat: 'cap', hatCol: 0x1d1f1a }); q.noReal = true;
    addObstacle(g.x, g.z, 1.8);
    return g;
  };
  // Stromaggregat mit Rahmen, Tankkanister
  const generator = (g) => {
    const o = place(g); deck(o, g, 1.6, 1.0);
    box(1.3, 0.75, 0.75, new THREE.MeshStandardMaterial({ color: 0xd8a018, roughness: 0.5 }), o, 0, 0.5, 0);
    box(1.0, 0.45, 0.02, M.dark, o, 0.05, 0.5, 0.385, 0, false);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.025, 0.025, 0.95, M.dark, o, sx * 0.67, 0.5, sz * 0.4, 6, false);
    for (const sx of [-0.5, 0.5]) { const wh = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), M.rubber, o, sx, 0.12, 0.42); wh.rotation.x = Math.PI / 2; }
    cyl(0.03, 0.03, 0.3, M.dark, o, 0.5, 1.0, -0.2, 6);
    box(0.22, 0.3, 0.14, M.red, o, 0.95, 0.15, 0.25, 0.3);
    mesh(new THREE.PlaneGeometry(0.6, 0.12), new THREE.MeshStandardMaterial({ map: textTexture([['STROMERZEUGER 8 kVA', `700 36px Barlow, sans-serif`]], 256, 52, '#1d1f1a', '#e8e4dc'), roughness: 0.6 }), o, -0.25, 0.8, 0.39, 0, false);
    addObstacle(g.x, g.z, 1.0);
    EV.gens = EV.gens || []; EV.gens.push(V(g.x, g.y + 1, g.z));
    return g;
  };
  // Teamzelt im Fahrerlager
  const teamTent = (ti, g) => {
    const tm = TEAMS[ti], ad = adSpecs()[ti];
    const o = place(g); deck(o, g, 3.3, 3.3);
    const roofM = new THREE.MeshStandardMaterial({ color: tm.jersey, roughness: 0.7, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, 2.4, 0.05, M.alu, o, sx * 1.5, 1.2, sz * 1.5, 0, false);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.12, 0.85, 4, 1, true).rotateY(Math.PI / 4), roofM); roof.position.y = 2.82; roof.castShadow = true; o.add(roof);
    const vm = new THREE.MeshStandardMaterial({ map: adTex({ ...ad, sub: 'RACING TEAM' }, 512, 96), roughness: 0.7, side: THREE.DoubleSide });
    for (const [px, pz, ry] of [[0, 1.5, 0], [0, -1.5, Math.PI], [1.5, 0, Math.PI / 2], [-1.5, 0, -Math.PI / 2]]) mesh(new THREE.PlaneGeometry(3, 0.3), vm, o, px, 2.25, pz, ry, false);
    mesh(new THREE.PlaneGeometry(3, 2.1), roofM, o, 0, 1.1, -1.5, 0, false);
    // Montageständer, Laufräder, Werkzeugwagen, Klappstühle
    box(0.04, 1.3, 0.04, M.alu, o, -0.7, 0.65, 0.2, 0, false); box(0.6, 0.04, 0.04, M.alu, o, -0.7, 1.3, 0.2, 0, false); box(0.5, 0.03, 0.5, M.dark, o, -0.7, 0.02, 0.2, 0, false);
    for (let i = 0; i < 3; i++) { const wh = mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 22), M.rubber, o, 1.0 + i * 0.07, 0.36, -1.2, 0.2); wh.rotation.z = 0.12; mesh(new THREE.CircleGeometry(0.3, 18), new THREE.MeshStandardMaterial({ color: 0x8a8e92, roughness: 0.4, metalness: 0.7, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), o, 1.0 + i * 0.07, 0.36, -1.2, 0.2, false); }
    box(0.55, 0.8, 0.45, M.red, o, 0.9, 0.4, 0.2); for (let k = 0; k < 4; k++) box(0.5, 0.01, 0.01, M.dark, o, 0.9, 0.2 + k * 0.17, 0.43, 0, false);
    for (const sx of [-1.0, -0.3]) { box(0.45, 0.03, 0.42, M.dark, o, sx, 0.45, -0.9, 0, false); box(0.45, 0.4, 0.03, M.dark, o, sx, 0.68, -1.1, 0, false); }
    for (let k = 0; k < 4; k++) cyl(0.035, 0.035, 0.22, new THREE.MeshStandardMaterial({ color: tm.accent, roughness: 0.4 }), o, -1.2 + k * 0.08, 0.11, 1.1, 8, false);
    const [fx, fz] = toW(g, 1.9, 1.3); featherFlag(fx, fz, ad);
    // Mechaniker und Betreuer im Teamoutfit
    const roles = [['mechanic', -0.7, 0.75, Math.PI], ['talk', 0.2, 0.9, 0.4], ['phone', 1.1, -0.5, 0.2], ['crossed', -0.3, -0.2, 0]].slice(0, 2 + Math.floor(rand() * 3));
    for (const [pose, lx, lz, ry] of roles) {
      const [x, z] = toW(g, lx, lz);
      const p = person(pose, x, z, g.yaw + ry, { react: pose !== 'mechanic', look: pose !== 'mechanic', y: g.y, top: tm.jersey, pants: 0x1d1f1a, hat: rand() < 0.6 ? 'cap' : null, hatCol: tm.accent, scarf: false, glasses: false });
      p.noReal = false;
    }
    addObstacle(g.x, g.z, 1.8);
    (EV.tents || (EV.tents = [])).push(g);
  };

  // ---------- Kinder spielen Fangen
  const kidGroup = (x, z, n) => {
    const R = 2.0 + rand() * 1.3;
    clearR(x, z, R + 0.9); EV.taken.push([x, z, R + 0.5]); reservedSpots.push([x, z, R + 1.5]);
    const g = { cx: x, cz: z, R, A: rand() * 6.28, w: (rand() < 0.5 ? -1 : 1) * (0.75 + rand() * 0.3), rot: rand() * 6.28, st: 'run', t: 0, next: 5 + rand() * 8, kids: [] };
    for (let i = 0; i < n; i++) {
      const p = person('kidrun', x, z, 0, { kid: true, react: true, look: false, scarf: rand() < 0.5 });
      p.noReal = false; g.kids.push({ p, i, r: R * (0.7 + rand() * 0.35), wob: rand() * 6.28 });
    }
    EV.groups.push(g);
  };
  const kidSpot = (cands) => {
    for (const [x, z] of cands) {
      if (!okGround(x, z, 6) || blocked(x, z, 3.5) || normalAt(x, z, new THREE.Vector3()).y < 0.86) continue;
      return [x, z];
    }
    return null;
  };
  // ---------- Leute, die in kleinen Gruppen herumstehen und reden
  const MILL = ['beer', 'beer', 'drink', 'stand', 'pockets', 'crossed', 'hips', 'phone', 'behind', 'talk', 'eat'];
  const milling = (cx, cz, rx, rz, yaw, n) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    let placed = 0;
    for (let tries = 0; placed < n && tries < n * 6; tries++) {
      const lx = (rand() - 0.5) * rx * 2, lz = (rand() - 0.5) * rz * 2;
      const x = cx + c * lx + s * lz, z = cz - s * lx + c * lz;
      if (!okGround(x, z, 2.2) || blocked(x, z, 1.2)) continue;
      const k = 2 + Math.floor(rand() * 3);
      let ok = true;
      for (const p of life.people) if (Math.abs(p.x - x) < 1.3 && Math.abs(p.z - z) < 1.3) { ok = false; break; }
      if (!ok) continue;
      for (let i = 0; i < k; i++) {
        const a = (i / k) * 6.28 + rand() * 0.6, px = x + Math.sin(a) * 0.5, pz = z + Math.cos(a) * 0.5;
        person(MILL[Math.floor(rand() * MILL.length)], px, pz, a + Math.PI + (rand() - 0.5) * 0.5, { react: true, kid: rand() < 0.08 });
      }
      placed++;
    }
  };

  // ================= START =================
  const sKinds = ['wurst', 'drinks', 'kaffee', 'brezn', 'schmarrn'];
  [[30, T + 13], [36, -(T + 13)], [-20, T + 15], [-26, -(T + 14)], [46, T + 12]].forEach(([s, lat], i) => stall(sKinds[i], s, lat, { spanS: 18, spanL: 10 }));
  // Fahrerlager: Teamzelte hinter dem Start
  TEAMS.forEach((tm, i) => {
    const side = i % 2 ? 1 : -1, s = 58 + Math.floor(i / 2) * 9;
    const g = findSpot(s, side * (T + 10), 3.6, 3.6, { spanS: 34, spanL: 16, front: 0.5, maxDy: 2.8, tries: 160, uphill: true });
    if (g) teamTent(i, g);
  });
  // Zeitmessung am Start: Kabel von Lichtschranke und Startuhr zur Zeitnahme
  cableBridge(11.6);
  { const z0 = tp(2, -(T + 6.0));
    cable([tp(13, T + 0.35), tp(13, T + 0.8), tp(11.6, T + 0.8), tp(11.6, -(T + 0.8)), tp(9, -(T + 0.9)), tp(5, -(T + 3)), z0]);
    cable([tp(13, -(T + 0.35)), tp(12.6, -(T + 0.95)), tp(9.2, -(T + 1.0)), tp(5.2, -(T + 3.1)), z0]);
    cable([tp(13, -(T + 2.4)), tp(12, -(T + 2.8)), tp(6, -(T + 4.2)), z0]);
    cable([tp(6, T + 8.5), tp(4, T + 6), tp(3.2, T + 1.0), tp(-2, T + 0.9), tp(-2, -(T + 0.9)), tp(1, -(T + 4)), z0]); cableBridge(-2);
  }
  { const g = findSpot(-8, -(T + 9), 1.6, 1.0, { spanS: 10, spanL: 6 }); if (g) { generator(g); cable([[g.x, g.z], tp(-2, -(T + 5)), tp(2, -(T + 6))], 0.016); } }
  for (const [s, side] of [[24, 1], [24, -1], [40, 1]]) { const [x, z] = tp(s, side * (T + 1.9)); speakerPole(x, z, facingTrail(s, side)); cable([[x, z], tp(s - 2, side * (T + 0.85)), tp(13, side * (T + 0.85))]); }
  { const g = findSpot(22, -(T + 7.5), 4.6, 1.2, { spanS: 14, spanL: 6, maxDy: 2.4, pad: 0.4 }); if (g) { ledBoard(g, 'start'); cable([[g.x, g.z], tp(10, -(T + 4)), tp(2, -(T + 6))]); } }
  // Streckenposten in Warnwesten
  for (const [s, lat] of [[14.5, T + 1.4], [15.5, -(T + 1.5)], [3, T + 1.6]]) { const [x, z] = tp(s, lat); clearR(x, z, 0.6); person('stand', x, z, facingTrail(s, lat), { top: 0xe86a12, hat: 'cap', hatCol: 0x1d1f1a, react: true }); }
  // Trubel: Grüppchen im Startgelände
  milling(...tp(10, T + 11), 26, 7, trailPoint(10, 0, {}).yaw + Math.PI / 2, 26);
  milling(...tp(10, -(T + 11)), 26, 7, trailPoint(10, 0, {}).yaw + Math.PI / 2, 26);
  milling(...tp(-24, 0), 9, 14, trailPoint(-24, 0, {}).yaw + Math.PI / 2, 14);
  for (const s of [8, 26, -14]) for (const side of [-1, 1]) { const c = kidSpot([tp(s, side * (T + 10)), tp(s + 6, side * (T + 12)), tp(s - 6, side * (T + 9)), tp(s, side * (T + 15))]); if (c && EV.groups.length < 4) kidGroup(c[0], c[1], 3 + Math.floor(rand() * 3)); }
  for (const s of [6, 34]) for (const side of [-1, 1]) { const [x, z] = tp(s, side * (T + 7.5)); if (okGround(x, z, 3) && !blocked(x, z, 0.6)) featherFlag(x, z, SPONSORS[Math.floor(rand() * SPONSORS.length)]); }

  // ================= ZIEL =================
  const b = trailPoint(L, 0, {}), tb = trail.yaw[trail.n - 1];
  const fx = Math.sin(tb), fz = Math.cos(tb), rx = Math.cos(tb), rz = -Math.sin(tb);
  const FP = (d, lat) => [b.x + fx * d + rx * lat, b.z + fz * d + rz * lat];
  const fin = (s, lat) => s <= L ? tp(s, lat) : FP(s - L, lat);
  // Zeitnahme, Lichtschranken, Kabelbrücke, LED-Tafel, Lautsprecher
  photocell(L - 2, 1, false); photocell(L - 2, -1, true);
  cableBridge(L - 5);
  const booth = findSpot(L - 9, -(T + 7), 2.8, 2.4, { spanS: 10, spanL: 6, front: 0.8 });
  const bxz = booth ? [booth.x, booth.z] : tp(L - 9, -(T + 7));
  if (booth) timingBooth(booth);
  cable([tp(L - 2, -(T + 0.35)), tp(L - 2.4, -(T + 0.9)), tp(L - 6, -(T + 2.5)), bxz]);
  cable([tp(L - 2, T + 0.35), tp(L - 2.4, T + 0.85), tp(L - 5, T + 0.85), tp(L - 5, -(T + 0.85)), tp(L - 6.5, -(T + 2.6)), bxz]);
  { const g = findSpot(L - 15, T + 6.5, 4.6, 1.2, { face: trailPoint(L - 15, 0, {}).yaw + Math.PI + 0.45, spanS: 10, spanL: 5, maxDy: 2.4, pad: 0.4, margin: 2.4 });
    if (g) { ledBoard(g, 'finish'); cable([[g.x, g.z], tp(L - 9, T + 3), tp(L - 5.4, T + 0.85), tp(L - 5.4, -(T + 0.85)), tp(L - 7, -(T + 3)), bxz]); } }
  { const g = findSpot(L - 18, -(T + 11), 1.6, 1.0, { spanS: 10, spanL: 6 }); if (g) { generator(g); cable([[g.x, g.z], tp(L - 14, -(T + 9)), bxz], 0.016); } }
  for (const [s, side] of [[L - 28, 1], [L - 28, -1], [L + 6, 1]]) { const [x, z] = fin(s, side * (T + 2.0 + (s > L ? 3 : 0))); speakerPole(x, z, s > L ? tb + Math.PI : facingTrail(s, side)); cable(side > 0 ? [[x, z], s > L ? FP(0.5, T + 0.9) : tp(s, T + 0.9), tp(L - 5.8, T + 0.9), tp(L - 5.8, -(T + 0.9)), tp(L - 7, -(T + 2.8)), bxz] : [[x, z], tp(s + 2, -(T + 1.4)), tp(L - 8, -(T + 2.6)), bxz]); }
  // Zwischenzeit auf halber Strecke
  { const s = Math.round(L * 0.5); photocell(s, 1, false); const pc = photocell(s, -1, true); cableBridge(s + 2);
    const g = findSpot(s - 3, -(T + 4.5), 2.2, 2.2, { spanS: 14, spanL: 5, front: 0.5 });
    if (g) {
      const o = place(g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 2.2, 0.04, M.alu, o, sx, 1.1, sz, 0, false);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.6, 4, 1, true).rotateY(Math.PI / 4), new THREE.MeshStandardMaterial({ color: 0x1d1f1a, roughness: 0.7, side: THREE.DoubleSide })); rf.position.y = 2.5; rf.castShadow = true; o.add(rf);
      mesh(new THREE.PlaneGeometry(2, 0.28), new THREE.MeshStandardMaterial({ map: textTexture([['ZWISCHENZEIT', `800 60px ${AD_FONT}`]], 512, 72, '#1d1f1a', '#ffcf3a'), side: THREE.DoubleSide }), o, 0, 2.08, 1.0, 0, false);
      box(1.2, 0.04, 0.6, M.alu, o, 0, 0.75, 0.2); for (const sx of [-0.5, 0.5]) box(0.03, 0.75, 0.5, M.alu, o, sx, 0.37, 0.2, 0, false);
      box(0.34, 0.02, 0.24, M.dark, o, -0.2, 0.78, 0.2, 0, false); const sc = box(0.34, 0.22, 0.012, new THREE.MeshBasicMaterial({ color: 0x9fd0ff, toneMapped: false }), o, -0.2, 0.89, 0.09, 0, false); sc.rotation.x = -0.25;
      const [px, pz] = toW(g, -0.2, -0.45); const p = person('crossed', px, pz, g.yaw, { react: true, y: g.y, top: 0xe86a12, hat: 'beanie', hatCol: 0x1d1f1a }); p.noReal = false;
      cable([tp(s, -(T + 0.35)), tp(s + 1, -(T + 1.0)), [g.x, g.z]]); cable([tp(s, T + 0.35), tp(s + 2, T + 0.85), tp(s + 2, -(T + 0.85)), [g.x, g.z]]);
    }
    EV.split = s; }
  // Verkaufsstände am Ziel
  const fKinds = ['wurst', 'drinks', 'schmarrn', 'kaffee', 'brezn', 'drinks'];
  [[L - 40, T + 13], [L - 48, -(T + 13)], [L - 64, T + 13], [L - 70, -(T + 14)], [L - 24, -(T + 16)], [L - 30, T + 17]].forEach(([s, lat], i) => stall(fKinds[i], s, lat, { spanS: 18, spanL: 10 }));
  // Teambetreuer warten im Auslauf, Fotografen knien an der Gasse
  TEAMS.forEach((tm, i) => {
    const side = i % 2 ? 1 : -1;
    for (let k = 0; k < 2; k++) {
      const [x, z] = FP(5 + i * 1.6 + k * 0.7, side * (5.2 + rand() * 1.6));
      if (!okGround(x, z, 1.5)) continue; clearR(x, z, 0.55);
      const p = person(['cheer', 'clap', 'hips', 'phone', 'stand'][Math.floor(rand() * 5)], x, z, tb + Math.PI + side * 0.5, { top: tm.jersey, hat: rand() < 0.5 ? 'cap' : null, hatCol: tm.accent, react: true, scarf: false });
      p.noReal = false;
    }
  });
  for (let k = 0; k < 5; k++) {
    const side = k % 2 ? 1 : -1, [x, z] = FP(1.5 + k * 1.3, side * (4.7 + rand() * 0.4));
    if (!okGround(x, z, 1.2)) continue; clearR(x, z, 0.55);
    const p = person('photog', x, z, tb + Math.PI + side * 0.25, { react: false, look: false, top: [0x1d1f1a, 0x3a3f46, 0x4a4a3a][k % 3], hat: 'beanie', hatCol: 0x1d1f1a }); p.photog = true; p.noReal = false;
  }
  for (const [d, lat] of [[3, 4.4], [3.4, -4.4]]) { const [x, z] = FP(d, lat); clearR(x, z, 0.6); person('stand', x, z, tb + Math.PI, { top: 0xe86a12, hat: 'cap', hatCol: 0x1d1f1a, react: true }); }
  // Trubel und Kinder am Zielgelände
  milling(...FP(30, 0), 12, 18, tb, 34);
  milling(...tp(L - 40, T + 9), 24, 4, tb + Math.PI / 2, 18);
  milling(...tp(L - 40, -(T + 9)), 24, 4, tb + Math.PI / 2, 18);
  for (const [d, lat] of [[24, 12], [26, -12], [10, 14], [-30, 12], [-36, -12], [40, 4], [-20, -14]]) { if (EV.groups.length >= 9) break; const c = kidSpot([d > 0 ? FP(d, lat) : tp(L + d, lat), d > 0 ? FP(d + 4, lat * 0.8) : tp(L + d - 5, lat * 1.2)]); if (c) kidGroup(c[0], c[1], 3 + Math.floor(rand() * 3)); }
  for (const s of [L - 20, L - 56]) for (const side of [-1, 1]) { const [x, z] = tp(s, side * (T + 7.5)); if (okGround(x, z, 3) && !blocked(x, z, 0.6)) featherFlag(x, z, SPONSORS[Math.floor(rand() * SPONSORS.length)]); }

  // ================= STRECKE =================
  (life.rallySpots || []).forEach((s, i) => {
    if (s < 80 || s > L - 90) return;
    const side = i % 2 ? 1 : -1;
    stall(['drinks', 'brezn', 'wurst', 'kaffee'][i % 4], s + 8, side * (T + 12), { spanS: 26, spanL: 10 });
    if (i % 2 === 0) { const c = kidSpot([tp(s, side * (T + 10)), tp(s - 10, side * (T + 12)), tp(s + 14, side * (T + 11)), tp(s, -side * (T + 11))]); if (c) kidGroup(c[0], c[1], 3 + Math.floor(rand() * 2)); }
  });

  // Kabel zusammenführen
  if (cableGeos.length) { const cm = new THREE.Mesh(mergeGeometries(cableGeos), M.cable); cm.receiveShadow = true; grp.add(cm); }
  // Adler kreisen über Start und Ziel
  for (const c of [trailPoint(10, 0, {}), trailPoint(L - 10, 0, {})]) {
    const y = hAt(c.x, c.z);
    life.birds.push({ kind: 'eagle', cx: c.x + (rand() - 0.5) * 40, cz: c.z + (rand() - 0.5) * 40, R: 45 + rand() * 25, a: rand() * 6.28, w: (rand() < 0.5 ? 1 : -1) * (0.13 + rand() * 0.04), alt: y + 45 + rand() * 20, ph: rand() * 6 });
  }
  // Rauch über den Grills
  EV.smokeTex = canvasTex(64, 64, (x) => { const g2 = x.createRadialGradient(32, 32, 0, 32, 32, 32); g2.addColorStop(0, 'rgba(225,225,222,0.55)'); g2.addColorStop(1, 'rgba(225,225,222,0)'); x.fillStyle = g2; x.fillRect(0, 0, 64, 64); });
  for (const sm of EV.smoke) for (let i = 0; i < 10; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: EV.smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.visible = false; grp.add(sp); sm.sp.push({ sp, t: 0, life: 0 });
  }
  return grp;
}

// LED-Tafel zeichnen: Rennzeit und Rangliste
function drawBoard(B) {
  const x = B.ctx, W = 640, H = 352;
  const rk = typeof ranking === 'function' && riders && riders.length ? ranking() : [];
  const tStr = race.state === 'countdown' ? (race.pan > 0 ? 'GLEICH GEHT ES LOS' : 'START IN ' + Math.max(0, Math.ceil(race.countdown))) : race.state === 'race' || race.state === 'finished' ? fmtTime(Math.max(0, race.t)) : '0:00.00';
  const rows = rk.slice(0, 6).map((r, i) => {
    const fin = r.isPlayer ? r.finished : r.ai.finished, ft = r.isPlayer ? r.finishT : r.ai.finishT;
    return `${i + 1}|${r.cfg.num}|${r.cfg.rider || r.cfg.name}|${fin ? fmtTime(ft) : race.state === 'race' ? 'unterwegs' : '–'}|${r.isPlayer ? 1 : 0}|${hexOf(r.cfg.jersey)}`;
  });
  const key = tStr + rows.join();
  if (key === B.last) return; B.last = key;
  x.fillStyle = '#050505'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#e8462b'; x.fillRect(0, 0, W, 50);
  x.fillStyle = '#fff'; x.font = `800 34px ${AD_FONT}`; x.textBaseline = 'middle'; x.textAlign = 'left';
  x.fillText(B.kind === 'start' ? 'KAMPENWAND DOWNHILL · START' : 'KAMPENWAND DOWNHILL · ZIEL', 16, 27);
  x.textAlign = 'right'; x.fillStyle = '#ffd84a'; x.font = '700 22px "Courier New", monospace'; x.fillText('LIVE', W - 16, 27);
  x.textAlign = 'center'; x.fillStyle = '#ffcf3a'; x.font = '700 64px "Courier New", monospace'; x.fillText(tStr, W / 2, 96);
  x.font = '700 24px "Courier New", monospace';
  rows.forEach((row, i) => {
    const [pos, num, name, tm, me, col] = row.split('|'), y = 150 + i * 33;
    if (me === '1') { x.fillStyle = 'rgba(255,207,58,0.18)'; x.fillRect(10, y - 15, W - 20, 30); }
    x.fillStyle = col; x.fillRect(18, y - 11, 8, 22);
    x.textAlign = 'left'; x.fillStyle = '#f2f2f2'; x.fillText(pos + '.', 36, y); x.fillStyle = '#9fd0ff'; x.fillText('#' + num, 80, y);
    x.fillStyle = me === '1' ? '#ffcf3a' : '#f2f2f2'; x.fillText(name.toUpperCase().slice(0, 20), 160, y);
    x.textAlign = 'right'; x.fillStyle = tm.includes(':') ? '#7dff8a' : '#888'; x.fillText(tm, W - 18, y);
  });
  B.tex.needsUpdate = true;
}

const _evV = new THREE.Vector3();
function updateEvent(dt, t) {
  if (!player) return;
  const P = player.pos, racing = race.state === 'race';
  // Anzeigetafeln (4× pro Sekunde)
  EV.boardT -= dt;
  if (EV.boardT <= 0) { EV.boardT = 0.25; for (const B of EV.boards) drawBoard(B); }
  // Zwischenzeit
  const prevS = EV.prevS ?? player.s; EV.prevS = player.s;
  if (EV.split && racing && !EV.splitDone && prevS <= EV.split && player.s > EV.split && player.s - prevS < 5) {
    EV.splitDone = true;
    const rk = ranking(), pos = rk.indexOf(player) + 1;
    flash('Zwischenzeit ' + fmtTime(race.t), 'Platz ' + pos + ' von ' + rk.length, 1.6, true);
    if (typeof beep === 'function') beep(1500, 0.12);
  }
  if (!racing && race.t < 1) EV.splitDone = false;
  // Kinder: Fangen spielen, beim Vorbeifahren stehen bleiben und anfeuern
  for (const g of EV.groups) {
    const dc = Math.hypot(g.cx - camera.position.x, g.cz - camera.position.z);
    if (dc > 260) continue;
    const dP = Math.hypot(g.cx - P.x, g.cz - P.z), watch = racing && dP < 38;
    g.t += dt;
    if (g.st === 'run') { g.A += g.w * dt; if (g.t > g.next) { g.st = 'pause'; g.t = 0; g.next = 2 + Math.random() * 3; } }
    else if (g.t > g.next && !watch) { g.st = 'run'; g.t = 0; g.next = 6 + Math.random() * 10; }
    const c = Math.cos(g.rot), s = Math.sin(g.rot);
    for (const k of g.kids) {
      const p = k.p;
      if (g.st === 'run' && !watch) {
        const a = g.A - k.i * 0.6 * Math.sign(g.w), r = k.r * (1 + 0.12 * Math.sin(g.A * 1.7 + k.wob));
        const lx = Math.cos(a) * r, lz = Math.sin(2 * a) * r * 0.5;
        const nx = g.cx + c * lx + s * lz, nz = g.cz - s * lx + c * lz;
        const dx = nx - p.x, dz = nz - p.z;
        if (dx * dx + dz * dz > 1e-6) p.yaw = Math.atan2(dx, dz);
        p.x = nx; p.z = nz; p.y = hAt(nx, nz); p.pose = 'kidrun';
      } else {
        p.pose = watch || k.i % 2 ? 'cheer' : 'stand';
        if (watch) { let dy = Math.atan2(P.x - p.x, P.z - p.z) - p.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; p.yaw += dy * Math.min(1, dt * 4); }
      }
    }
  }
  // Grillrauch
  for (const sm of EV.smoke) {
    const dc = sm.wp.distanceTo(camera.position);
    sm.cd -= dt;
    if (dc < 140 && sm.cd <= 0) {
      sm.cd = 0.35;
      const f = sm.sp.find((q) => q.t <= 0);
      if (f) { f.t = f.life = 3.5; f.sp.visible = true; f.sp.position.copy(sm.wp).add(_evV.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.3)); }
    }
    for (const f of sm.sp) {
      if (f.t <= 0) { f.sp.visible = false; continue; }
      f.t -= dt; const k = 1 - f.t / f.life;
      f.sp.position.y += dt * 0.55; f.sp.position.x += dt * 0.25; f.sp.position.z += dt * 0.1;
      f.sp.material.opacity = Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.4; f.sp.scale.setScalar(0.4 + k * 1.6);
    }
  }
}
