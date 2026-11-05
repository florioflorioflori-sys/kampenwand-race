// usage: node shot.js file.html out_prefix '[{"s":100,"lat":0,"js":"...","name":"a","frames":6}]' [w h]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const S = __dirname;
(async () => {
  const [file, prefix, specJson, W, Hh] = process.argv.slice(2);
  const specs = JSON.parse(specJson || '[{"s":30,"name":"start"}]');
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +(W || 1280), height: +(Hh || 720) }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(900000);
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 400)); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window); let q = []; window.__manual = false;
    window.requestAnimationFrame = (cb) => { if (window.__manual) { q.push(cb); return 1; } return raf(cb); };
    window.__step = (n) => { for (let i = 0; i < n; i++) { const c = q; q = []; const t = performance.now(); c.forEach((f) => f(t)); } };
  });
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (route) => {
    const rel = route.request().url().split('three@0.160.0/')[1];
    const p = path.join(S, 'three/package', rel);
    if (fs.existsSync(p)) route.fulfill({ path: p, contentType: 'application/javascript' }); else route.abort();
  });
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }));
  const t0 = Date.now();
  await page.goto(file.startsWith('http') ? file : 'file://' + path.resolve(file));
  await page.evaluate(() => { const b = document.getElementById('introSkip'); if (b) b.click(); });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 900000, polling: 1000 });
  console.log('loaded in', (Date.now() - t0) / 1000, 's');
  await page.evaluate(() => { window.__manual = true; });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('startBtn').click());
  for (const sp of specs) {
    await page.evaluate((sp) => {
      window.__kw.ev(`race.pan = 0; race.countdown = 0; race.state = 'race'; msgTimer = 0.01;
        { const s = ${sp.s}, lat = ${sp.lat || 0}; const P = player; const pt = trailPoint(s, lat, {});
          P.pos.set(pt.x, hAt(pt.x, pt.z), pt.z); P.vel.set(Math.sin(pt.yaw)*${sp.v ?? 8}, 0, Math.cos(pt.yaw)*${sp.v ?? 8}); P.yaw = pt.yaw; P.s = s; P.idx = trailIdx(s); camInit = false; P.finished = false;
          ${sp.ai ? "riders.forEach((r,i)=>{ if(!r.isPlayer){ r.ai.s = s + 6 + i*4; } });" : ''} }
        ${sp.js || ''}`);
    }, sp);
    for (let i = 0; i < (sp.frames || 5); i++) { await page.evaluate(() => window.__step(1)); }
    if (sp.js2) await page.evaluate((c) => window.__kw.ev(c), sp.js2);
    if (sp.js2) await page.evaluate(() => window.__step(1));
    if (sp.probe) console.log('probe', sp.name, await page.evaluate((c) => JSON.stringify(window.__kw.ev(c)), sp.probe));
    await page.screenshot({ path: `${prefix}_${sp.name}.png` });
    console.log('shot', sp.name, (Date.now() - t0) / 1000);
  }
  await browser.close();
})();
