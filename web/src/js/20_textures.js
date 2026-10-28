
// ------------------------------------------------------------------
// Prozedurale Texturen (Canvas)
// ------------------------------------------------------------------
function canvasTex(w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function textTexture(lines, w, h, bg, fg, font) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((l, i) => { x.font = l[1] || font; x.fillText(l[0], w / 2, h * (i + 0.5) / lines.length); });
  });
}
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

// Fichtenzweig: Ast mit Seitentrieben und dichten Nadeln, transparent
function spruceBranchTex() {
  return canvasTex(256, 256, (x, w, h) => {
    const r = mulberry32(11);
    const stemY = (t) => 128 + t * t * 26;
    const needle = (px, py, ang, len, shade) => {
      x.strokeStyle = rgb(18 + shade * 30, 42 + shade * 52, 20 + shade * 22, 0.95);
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len); x.stroke();
    };
    x.lineCap = 'round';
    // Seitentriebe
    for (let i = 0; i < 26; i++) {
      const t = 0.05 + i / 27, sx = 6 + t * 240, sy = stemY(t);
      const side = i % 2 ? 1 : -1, len = (78 * (1 - t * 0.75)) * (0.75 + r() * 0.35);
      const ang = side * (0.75 + r() * 0.3) + 0.15;
      const ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
      x.strokeStyle = rgb(70, 48, 30); x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo((sx + ex) / 2 + 6, (sy + ey) / 2 + 4, ex, ey); x.stroke();
      x.lineWidth = 1.5;
      const nn = Math.round(len / 2.2);
      for (let k = 0; k < nn; k++) {
        const u = k / nn, px = lerp(sx, ex, u), py = lerp(sy, ey, u) + u * u * 4;
        const l = 7 * (1 - u * 0.4) + r() * 3, sh = 0.2 + r() * 0.8 * (0.6 + u * 0.4);
        needle(px, py, ang - 0.9 + r() * 0.3 + Math.PI * 0.05, l, sh);
        needle(px, py, ang + 0.9 - r() * 0.3, l, sh * 0.9);
        needle(px, py, ang - Math.PI * 0.5 * side + r() * 0.6, l * 0.8, sh * 0.7);
      }
    }
    // Hauptast
    x.strokeStyle = rgb(80, 55, 35); x.lineWidth = 4;
    x.beginPath(); x.moveTo(0, stemY(0)); for (let t = 0; t <= 1; t += 0.05) x.lineTo(t * 250, stemY(t)); x.stroke();
    x.lineWidth = 1.6;
    for (let k = 0; k < 120; k++) { const t = k / 120; needle(t * 250, stemY(t), -Math.PI / 2 + (r() - 0.5) * 2.4, 8 + r() * 4, 0.3 + r() * 0.7); needle(t * 250, stemY(t), Math.PI / 2 + (r() - 0.5) * 2.4, 8 + r() * 4, 0.2 + r() * 0.6); }
  });
}
// Buchenlaub: Büschel heller Blätter, wird pro Baum herbstlich eingefärbt
function leafClusterTex() {
  return canvasTex(256, 256, (x) => {
    const r = mulberry32(21);
    x.strokeStyle = rgb(90, 70, 50); x.lineWidth = 2;
    for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); x.stroke(); }
    for (let i = 0; i < 95; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * 104;
      const px = 128 + Math.cos(a) * d, py = 128 + Math.sin(a) * d, rot = r() * Math.PI * 2, s = 9 + r() * 7;
      const k = 0.62 + r() * 0.38, warm = r();
      x.save(); x.translate(px, py); x.rotate(rot);
      x.fillStyle = rgb(235 * k, (215 - warm * 30) * k, (170 - warm * 60) * k);
      x.beginPath(); x.moveTo(-s, 0); x.quadraticCurveTo(-s * 0.2, -s * 0.75, s * 1.1, 0); x.quadraticCurveTo(-s * 0.2, s * 0.75, -s, 0); x.fill();
      x.strokeStyle = rgb(150 * k, 120 * k, 80 * k, 0.8); x.lineWidth = 1; x.beginPath(); x.moveTo(-s, 0); x.lineTo(s, 0); x.stroke();
      x.restore();
    }
  });
}
function barkTex() {
  return canvasTex(128, 512, (x, w, h) => {
    const r = mulberry32(31);
    x.fillStyle = rgb(150, 140, 130); x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const px = r() * w, py = r() * h, l = 10 + r() * 60, k = r();
      x.strokeStyle = k < 0.55 ? rgb(60 + r() * 30, 52 + r() * 25, 45 + r() * 20, 0.6) : rgb(190 + r() * 40, 180 + r() * 40, 168 + r() * 40, 0.35);
      x.lineWidth = 1 + r() * 3;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 6, py + l); x.stroke();
    }
  }, { repeat: true });
}
function fernTex() {
  return canvasTex(256, 256, (x) => {
    const r = mulberry32(41);
    for (let f = 0; f < 6; f++) {
      const a = -Math.PI / 2 + (f - 2.5) * 0.42 + (r() - 0.5) * 0.2, len = 100 + r() * 25;
      const bend = (f - 2.5) * 0.12;
      let px = 128, py = 250;
      for (let k = 0; k < 26; k++) {
        const t = k / 26, aa = a + bend * t * 3;
        const nx = px + Math.cos(aa) * len / 26, ny = py + Math.sin(aa) * len / 26;
        x.strokeStyle = rgb(60, 90, 30); x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke();
        const ll = 26 * Math.sin(Math.min(1, t * 1.2) * Math.PI) * (1 - t * 0.3);
        const shade = 0.6 + r() * 0.4;
        x.strokeStyle = rgb(55 * shade + t * 60, 105 * shade + t * 30, 30 * shade, 1); x.lineWidth = 3.2;
        for (const s of [-1, 1]) { x.beginPath(); x.moveTo(nx, ny); x.lineTo(nx + Math.cos(aa + s * 1.25) * ll, ny + Math.sin(aa + s * 1.25) * ll); x.stroke(); }
        px = nx; py = ny;
      }
    }
  });
}
function grassTuftTex() {
  return canvasTex(128, 128, (x) => {
    const r = mulberry32(51);
    for (let i = 0; i < 46; i++) {
      const bx = 20 + r() * 88, lean = (r() - 0.5) * 50, hgt = 60 + r() * 60, k = r();
      x.strokeStyle = k < 0.35 ? rgb(140 + r() * 40, 120 + r() * 30, 60) : rgb(50 + r() * 50, 85 + r() * 40, 25 + r() * 15);
      x.lineWidth = 1.5 + r() * 1.5;
      x.beginPath(); x.moveTo(bx, 128); x.quadraticCurveTo(bx + lean * 0.3, 128 - hgt * 0.6, bx + lean, 128 - hgt); x.stroke();
    }
  });
}
// Fahrer-Trikot: Grundfarbe, Brustband, Ärmelstreifen, Rückennummer
function jerseyTex(cfg) {
  const hx = (n) => '#' + n.toString(16).padStart(6, '0');
  return canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = hx(cfg.jersey); x.fillRect(0, 0, w, h);
    x.fillStyle = hx(cfg.accent);
    x.fillRect(0, h * 0.42, w, h * 0.12);
    x.globalAlpha = 0.5; for (let i = 0; i < 6; i++) x.fillRect(0, h * (0.62 + i * 0.05), w, 3); x.globalAlpha = 1;
    // Seitenpanele
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(w * 0.2, 0, w * 0.06, h); x.fillRect(w * 0.74, 0, w * 0.06, h);
    // Rücken (u = 0,5)
    x.fillStyle = '#f4efe6'; x.fillRect(w * 0.42, h * 0.08, w * 0.16, h * 0.3);
    x.fillStyle = '#1d1f1a'; x.font = '800 66px "Saira Condensed", Arial Narrow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(String(cfg.num), w * 0.5, h * 0.24);
    x.fillStyle = hx(cfg.accent); x.font = '700 26px "Saira Condensed", Arial Narrow, sans-serif';
    x.fillText(cfg.name.split(' ').pop().toUpperCase(), w * 0.5, h * 0.58 + 50);
    // Brust (u = 0 bzw. 1)
    x.fillStyle = '#f4efe6'; x.font = '800 30px "Saira Condensed", Arial Narrow, sans-serif';
    x.fillText('KAMPENWAND', w * 0.0 + 70, h * 0.25); x.fillText('KAMPENWAND', w + 0 - 70 + 0, h * 0.25);
  });
}
function pantsTex(cfg) {
  const hx = (n) => '#' + n.toString(16).padStart(6, '0');
  return canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = hx(cfg.pants); x.fillRect(0, 0, w, h);
    x.fillStyle = hx(cfg.accent); x.fillRect(w * 0.45, 0, w * 0.1, h);
    x.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 40; i++) x.fillRect(0, i * 6.4, w, 1);
  });
}
function tireTex() {
  return canvasTex(512, 64, (x, w, h) => {
    x.fillStyle = '#121212'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 64; i++) {
      const u = i * 8;
      x.fillStyle = '#262626';
      x.fillRect(u, h * 0.42, 5, h * 0.16);
      x.fillRect(u + 4, i % 2 ? h * 0.24 : h * 0.62, 4, h * 0.14);
      x.fillRect(u + 1, i % 2 ? h * 0.08 : h * 0.8, 4, h * 0.12);
    }
    x.fillStyle = '#8a7a3a'; x.font = '700 10px Arial'; for (let i = 0; i < 2; i++) x.fillText('MINION DHF', 80 + i * 256, h * 0.95);
  }, { srgb: true, repeat: true });
}
function canopyTex(colA, colB, colC) {
  return canvasTex(512, 128, (x, w, h) => {
    const cells = 32;
    for (let i = 0; i < cells; i++) {
      const t = i / cells, mid = Math.abs(t - 0.5);
      x.fillStyle = mid < 0.12 ? colC : mid < 0.3 ? colA : colB;
      x.fillRect(i * w / cells, 0, w / cells + 1, h);
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(i * w / cells, 0, 1.5, h);
    }
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.15)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
}
function signTex(kind) {
  return canvasTex(256, 256, (x, w, h) => {
    if (kind === 'diamond') {
      x.fillStyle = '#f4efe6'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#111';
      for (const ox of [-42, 42]) { x.beginPath(); x.moveTo(128 + ox, 40); x.lineTo(128 + ox + 40, 100); x.lineTo(128 + ox, 160); x.lineTo(128 + ox - 40, 100); x.fill(); }
      x.font = '800 40px "Saira Condensed", Arial Narrow, sans-serif'; x.textAlign = 'center';
      x.fillText('ABKÜRZUNG', 128, 200); x.font = '600 26px Barlow, sans-serif'; x.fillText('nur für Könner', 128, 236);
    } else {
      x.fillStyle = '#f4efe6'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#d42a1c'; x.beginPath(); x.moveTo(128, 18); x.lineTo(240, 210); x.lineTo(16, 210); x.fill();
      x.fillStyle = '#f4efe6'; x.beginPath(); x.moveTo(128, 58); x.lineTo(206, 192); x.lineTo(50, 192); x.fill();
      x.fillStyle = '#111'; x.font = '800 92px "Saira Condensed", Arial Narrow, sans-serif'; x.textAlign = 'center'; x.fillText('!', 128, 182);
      x.font = '700 30px "Saira Condensed", Arial Narrow, sans-serif'; x.fillText('FORSTARBEITEN', 128, 244);
    }
  });
}
