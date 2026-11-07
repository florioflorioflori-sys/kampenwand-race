const adShade = (hex, k) => { const c = new THREE.Color(hex); c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k); return '#' + c.getHexString(); };
// Druckbild wie echte Banner: Verlauf, Gestaltungselement je Marke, Emblem, Schrift mit Schatten, Web-Adresse, Ösen, Gewebe
function adTex(a, w, h, vertical = false) {
  return canvasTex(w, h, (x) => {
    if (vertical) { x.translate(w / 2, h / 2); x.rotate(-Math.PI / 2); x.translate(-h / 2, -w / 2); [w, h] = [h, w]; }
    let seed = 0; for (const ch of a.name) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
    const rn = () => { seed = (seed * 16807) % 2147483647; return (seed % 10000) / 10000; };
    const gr = x.createLinearGradient(0, 0, w * 0.3, h);
    gr.addColorStop(0, adShade(a.bg, 1.1)); gr.addColorStop(1, adShade(a.bg, 0.84));
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    const deco = a.deco || (a.stripes ? 'stripes' : a.bolt ? 'bolt' : 'bars');
    x.save();
    if (deco === 'stripes') { x.fillStyle = a.fg2; for (let i = 0; i < 3; i++) { x.fillRect(0, h * (0.05 + i * 0.05), w, h * 0.025); x.fillRect(0, h * (0.83 + i * 0.05), w, h * 0.025); } }
    else if (deco === 'bars' || deco === 'bolt') { x.fillStyle = a.fg2; x.fillRect(0, 0, w, h * 0.07); x.fillRect(0, h * 0.93, w, h * 0.07); }
    else if (deco === 'sun') {
      const rg = x.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, h * 0.6);
      rg.addColorStop(0, a.fg2); rg.addColorStop(0.55, adShade(a.fg2, 0.9)); rg.addColorStop(0.56, 'rgba(0,0,0,0)');
      x.globalAlpha = 0.85; x.fillStyle = rg; x.beginPath(); x.arc(w * 0.5, h * 0.45, h * 0.34, 0, Math.PI * 2); x.fill();
      x.globalAlpha = 1; x.fillStyle = a.fg2; x.fillRect(0, h * 0.94, w, h * 0.06);
    } else if (deco === 'swoosh') {
      x.strokeStyle = a.fg2; x.lineCap = 'round';
      for (const [o, lw, al] of [[0, 0.07, 0.95], [0.12, 0.025, 0.7]]) {
        x.globalAlpha = al; x.lineWidth = h * lw; x.beginPath(); x.moveTo(-w * 0.05, h * (0.97 - o * 0.5));
        x.bezierCurveTo(w * 0.3, h * (0.84 - o * 0.5), w * 0.6, h * (1.04 - o * 0.5), w * 1.05, h * (0.86 - o * 0.5)); x.stroke();
      }
    } else if (deco === 'mountain') {
      x.globalAlpha = 0.28; x.fillStyle = a.fg2; x.beginPath(); x.moveTo(w * 0.52, h);
      let px = w * 0.52; const peaks = [[0.62, 0.42], [0.7, 0.62], [0.8, 0.28], [0.88, 0.55], [0.95, 0.4], [1.02, 0.7]];
      for (const [u, v] of peaks) { x.lineTo(w * u, h * v); px = w * u; }
      x.lineTo(w, h); x.closePath(); x.fill();
      x.globalAlpha = 0.5; x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(w * 0.76, h * 0.36); x.lineTo(w * 0.8, h * 0.28); x.lineTo(w * 0.84, h * 0.37); x.lineTo(w * 0.81, h * 0.34); x.closePath(); x.fill();
      x.globalAlpha = 1; x.fillStyle = a.fg2; x.fillRect(0, h * 0.94, w, h * 0.06);
    } else if (deco === 'wave') {
      x.fillStyle = a.fg2;
      for (let k = 0; k < 3; k++) { x.globalAlpha = 0.9 - k * 0.25; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= 40; i++) { const u = i / 40; x.lineTo(u * w, h * (0.86 - k * 0.06) + Math.sin(u * 12 + k) * h * 0.03); } x.lineTo(w, h); x.closePath(); x.fill(); }
    } else if (deco === 'frame') {
      x.strokeStyle = a.fg; x.lineWidth = h * 0.03; x.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h * 0.88);
      x.strokeStyle = a.fg2; x.lineWidth = h * 0.012; x.strokeRect(h * 0.11, h * 0.11, w - h * 0.22, h * 0.78);
    }
    x.restore();
    if (a.bolt) { x.fillStyle = a.fg2; x.beginPath(); x.moveTo(w * 0.06, h * 0.2); x.lineTo(w * 0.1, h * 0.2); x.lineTo(w * 0.075, h * 0.48); x.lineTo(w * 0.11, h * 0.48); x.lineTo(w * 0.05, h * 0.82); x.lineTo(w * 0.07, h * 0.55); x.lineTo(w * 0.04, h * 0.55); x.fill(); }
    // rundes Emblem mit Initiale
    const wide = w > h * 2.2;
    let cx = w / 2, maxW = w * 0.8;
    if (a.badge && wide) {
      const r = h * 0.3, bx = h * 0.2 + r, by = h * 0.46;
      x.fillStyle = a.fg; x.beginPath(); x.arc(bx, by, r, 0, Math.PI * 2); x.fill();
      x.strokeStyle = a.fg2; x.lineWidth = r * 0.12; x.beginPath(); x.arc(bx, by, r * 0.84, 0, Math.PI * 2); x.stroke();
      x.fillStyle = a.bg; x.font = a.font.replace('{S}', Math.round(r * 1.2)); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(a.badge, bx, by + r * 0.06);
      cx = (bx + r + w) / 2; maxW = w - (bx + r) - h * 0.25;
    }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const name = a.upper ? a.name.toUpperCase() : a.name;
    let fs = h * 0.52; const f = (n) => a.font.replace('{S}', Math.round(n));
    x.font = f(fs); while (x.measureText(name).width > maxW && fs > 8) { fs -= 2; x.font = f(fs); }
    x.save(); x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = h * 0.025; x.shadowOffsetY = h * 0.012;
    x.fillStyle = a.fg; x.fillText(name, cx, h * 0.42); x.restore();
    let ss = Math.round(h * 0.15); x.font = `600 ${ss}px Barlow, sans-serif`;
    while (x.measureText(a.sub).width > maxW && ss > 6) { ss -= 1; x.font = `600 ${ss}px Barlow, sans-serif`; }
    x.fillStyle = a.dark ? '#1d1f1a' : a.fg2; x.fillText(a.sub, cx, h * 0.71);
    if (a.url && wide) { x.font = `500 ${Math.round(h * 0.085)}px Barlow, sans-serif`; x.globalAlpha = 0.85; x.fillStyle = a.fg; x.textAlign = 'right'; x.fillText(a.url, w - h * 0.16, h * 0.86); x.globalAlpha = 1; }
    // Gewebe der Plane und leichte Verschmutzung unten
    const CW = x.canvas.width, CH = x.canvas.height, img = x.getImageData(0, 0, CW, CH), d = img.data;
    for (let yy = 0; yy < CH; yy++) for (let xx = 0; xx < CW; xx++) {
      const i = (yy * CW + xx) * 4, weave = ((xx & 1) ^ (yy & 1)) ? 0.97 : 1.02;
      const dv = vertical ? 1 - xx / CW : yy / CH, du = vertical ? yy : xx;
      const dirt = 1 - Math.max(0, (dv - 0.78) / 0.22) * 0.12 * (0.6 + 0.4 * Math.sin(du * 0.07 + dv * 30));
      const k = weave * dirt;
      d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k * 0.995);
    }
    x.putImageData(img, 0, 0);
    // Ösen in den Ecken und an den Kanten
    if (wide && !vertical) {
      const rr = Math.max(2, h * 0.028), n = Math.max(2, Math.round(w / (h * 1.6)));
      for (let i = 0; i <= n; i++) for (const yy of [h * 0.055, h * 0.945]) {
        const xx = h * 0.055 + (w - h * 0.11) * i / n;
        x.fillStyle = '#b8bcc0'; x.beginPath(); x.arc(xx, yy, rr, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#2a2c2e'; x.beginPath(); x.arc(xx, yy, rr * 0.5, 0, Math.PI * 2); x.fill();
      }
      x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 2; x.strokeRect(1, 1, w - 2, h - 2);
    }
    void rn;
  });
}
