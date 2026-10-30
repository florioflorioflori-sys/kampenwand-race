

// ------------------------------------------------------------------
// HUD
// ------------------------------------------------------------------
const fmtTime = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
let msgTimer = 0;
function flash(text, sub = '', dur = 1.5, small = false) {
  const m = $('msg'); m.textContent = text; m.style.fontSize = small ? 'clamp(28px, 5vw, 56px)' : ''; m.classList.add('show');
  const s = $('sub'); s.textContent = sub; s.classList.toggle('show', !!sub);
  msgTimer = dur;
}
const profileCtx = $('profile').getContext('2d'), miniCtx = $('minimap').getContext('2d');
let profileBg, miniBg, miniXf;
function prepHudCanvases() {
  const pc = document.createElement('canvas'); pc.width = 840; pc.height = 108; const x = pc.getContext('2d');
  let ymin = 1e9, ymax = -1e9; for (let k = 0; k < trail.n; k++) { ymin = Math.min(ymin, trail.y[k]); ymax = Math.max(ymax, trail.y[k]); }
  const px = (k) => k / (trail.n - 1) * 840, py = (y) => 10 + (1 - (y - ymin) / (ymax - ymin)) * 88;
  x.beginPath(); x.moveTo(0, 108); for (let k = 0; k < trail.n; k += 2) x.lineTo(px(k), py(trail.y[k])); x.lineTo(840, 108); x.closePath();
  x.fillStyle = 'rgba(244,239,230,0.16)'; x.fill();
  x.beginPath(); for (let k = 0; k < trail.n; k += 2) x.lineTo(px(k), py(trail.y[k])); x.strokeStyle = 'rgba(244,239,230,0.85)'; x.lineWidth = 3; x.stroke();
  x.fillStyle = '#e2a33a'; for (const s of trail.kickers) { const k = s / TRAIL_STEP; x.fillRect(px(k) - 2, py(trail.y[Math.round(k)]) - 10, 4, 8); }
  profileBg = { c: pc, px, py };
  const mc = document.createElement('canvas'); mc.width = 480; mc.height = 240; const y = mc.getContext('2d');
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let k = 0; k < trail.n; k++) { x0 = Math.min(x0, trail.x[k]); x1 = Math.max(x1, trail.x[k]); z0 = Math.min(z0, trail.z[k]); z1 = Math.max(z1, trail.z[k]); }
  const pad = 40, sc = Math.min((480 - 2 * pad) / (x1 - x0), (240 - 2 * pad) / (z1 - z0));
  const ox = (480 - (x1 - x0) * sc) / 2, oz = (240 - (z1 - z0) * sc) / 2;
  miniXf = (wx, wz) => [ox + (wx - x0) * sc, oz + (wz - z0) * sc];
  // Höhenschattierung
  const img = y.createImageData(480, 240);
  for (let j = 0; j < 240; j++) for (let i = 0; i < 480; i++) {
    const wx = x0 + (i - ox) / sc, wz = z0 + (j - oz) / sc;
    const hh = hAt(wx, wz), e = 6, sh = clamp(0.5 + (hAt(wx - e, wz - e) - hh) * 0.08, 0, 1);
    const t = clamp((hh - 600) / 1000, 0, 1);
    const p = (j * 480 + i) * 4; img.data[p] = 30 + sh * 60 + t * 40; img.data[p + 1] = 40 + sh * 60 + t * 30; img.data[p + 2] = 28 + sh * 40 + t * 30; img.data[p + 3] = 200;
  }
  y.putImageData(img, 0, 0);
  y.beginPath(); for (let k = 0; k < trail.n; k += 2) { const [a, b] = miniXf(trail.x[k], trail.z[k]); y.lineTo(a, b); }
  y.strokeStyle = '#f4efe6'; y.lineWidth = 4; y.stroke();
  y.fillStyle = '#7fc46a'; { const [a, b] = miniXf(trail.x[0], trail.z[0]); y.beginPath(); y.arc(a, b, 7, 0, 7); y.fill(); }
  y.fillStyle = '#e8462b'; { const [a, b] = miniXf(trail.x[trail.n - 1], trail.z[trail.n - 1]); y.fillRect(a - 7, b - 7, 14, 14); }
  y.fillStyle = 'rgba(244,239,230,.8)'; y.font = '600 20px Barlow, sans-serif'; y.fillText('N ↑', 12, 28);
  miniBg = mc;
}
const hexCss = (h) => '#' + h.toString(16).padStart(6, '0');
function drawHud() {
  const P = player;
  profileCtx.clearRect(0, 0, 840, 108); profileCtx.drawImage(profileBg.c, 0, 0);
  miniCtx.clearRect(0, 0, 480, 240); miniCtx.drawImage(miniBg, 0, 0);
  const all = riders.map((r) => ({ r, s: r.isPlayer ? r.s : r.ai.s, x: r.isPlayer ? r.pos.x : r.ai.x, z: r.isPlayer ? r.pos.z : r.ai.z }));
  for (const o of all.sort((a, b) => (a.r.isPlayer ? 1 : 0) - (b.r.isPlayer ? 1 : 0))) {
    const k = clamp(o.s / TRAIL_STEP, 0, trail.n - 1);
    const col = hexCss(o.r.cfg.jersey);
    const px = profileBg.px(k), py = profileBg.py(trail.y[Math.round(k)]);
    profileCtx.fillStyle = col; profileCtx.strokeStyle = '#12140f'; profileCtx.lineWidth = 3;
    profileCtx.beginPath(); profileCtx.arc(px, py, o.r.isPlayer ? 10 : 7, 0, 7); profileCtx.fill(); profileCtx.stroke();
    const [mx, my] = miniXf(o.x, o.z);
    miniCtx.fillStyle = col; miniCtx.beginPath(); miniCtx.arc(mx, my, o.r.isPlayer ? 9 : 6, 0, 7); miniCtx.fill(); miniCtx.stroke();
  }
  const rank = ranking().findIndex((r) => r.isPlayer) + 1;
  $('pos').innerHTML = `${rank}<small>/${riders.length}</small>`;
  const t = P.finished ? P.finishT : race.t;
  $('time').textContent = fmtTime(Math.max(0, t));
  $('best').textContent = race.best ? `Bestzeit ${fmtTime(race.best)}` : '';
  $('speed').innerHTML = `${Math.round(P.vel.length() * 3.6)}<small>KM/H</small>`;
  $('alt').textContent = `${Math.round(P.pos.y)} m ü. NN · ${Math.max(0, Math.round(trail.L - P.s))} m bis Ziel`;
  $('boost').style.width = `${Math.round(P.boost * 100)}%`;
}
function ranking() {
  return riders.slice().sort((a, b) => {
    const fa = a.isPlayer ? a.finished : a.ai.finished, fb = b.isPlayer ? b.finished : b.ai.finished;
    if (fa && fb) return (a.isPlayer ? a.finishT : a.ai.finishT) - (b.isPlayer ? b.finishT : b.ai.finishT);
    if (fa !== fb) return fa ? -1 : 1;
    return (b.isPlayer ? b.s : b.ai.s) - (a.isPlayer ? a.s : a.ai.s);
  });
}
function showResults() {
  const rk = ranking();
  const me = rk.findIndex((r) => r.isPlayer) + 1;
  $('resTitle').textContent = `Platz ${me} von ${rk.length}`;
  const winT = rk[0].isPlayer ? rk[0].finishT : rk[0].ai.finishT;
  $('resBody').innerHTML = rk.map((r, i) => {
    const fin = r.isPlayer ? r.finished : r.ai.finished, ft = r.isPlayer ? r.finishT : r.ai.finishT;
    const tt = fin ? (i === 0 ? fmtTime(ft) : `+${(ft - winT).toFixed(2)} s`) : 'fährt noch';
    return `<tr class="${r.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td><span class="sw" style="background:${hexCss(r.cfg.jersey)}"></span>${r.cfg.name} <span style="color:var(--ink-dim)">#${r.cfg.num}</span></td><td>${tt}</td></tr>`;
  }).join('');
}

// ------------------------------------------------------------------
// Kamera
// ------------------------------------------------------------------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let camInit = false;
function updateCamera(dt) {
  const P = player;
  const sp = P.vel.length();
  const vdir = _tmp.set(P.vel.x, 0, P.vel.z);
  const heading = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
  if (vdir.length() > 3 && !P.air) heading.lerp(vdir.normalize(), 0.35).normalize();
  let want, look;
  if (camMode === 2) {
    want = _x.copy(P.pos).addScaledVector(P.pitchUp, 1.75).addScaledVector(heading, 0.25);
    look = _y.copy(P.pos).addScaledVector(heading, 12).add(_z.set(0, 0.4, 0));
    camPos.copy(want); camLook.copy(look);
  } else {
    const dist = camMode === 0 ? 4.6 + sp * 0.06 : 9 + sp * 0.08, ht = camMode === 0 ? 1.9 : 3.8;
    want = _x.copy(P.pos).addScaledVector(heading, -dist); want.y = Math.max(P.pos.y, hAt(want.x, want.z)) + ht;
    look = _y.copy(P.pos).addScaledVector(heading, 3.5); look.y += 1.0;
    if (!camInit) { camPos.copy(want); camLook.copy(look); camInit = true; }
    camPos.lerp(want, 1 - Math.exp(-7 * dt)); camLook.lerp(look, 1 - Math.exp(-10 * dt));
    camPos.y = Math.max(camPos.y, hAt(camPos.x, camPos.z) + 0.8);
  }
  const ov = window.__camOverride;
  if (ov) { camPos.set(...ov.pos); camLook.set(...ov.look); }
  camera.position.copy(camPos); camera.lookAt(camLook);
  const fov = 66 + clamp(sp - 8, 0, 18) * 0.7;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = damp(camera.fov, fov, 3, dt); camera.updateProjectionMatrix(); }
  // Kamerawackeln bei hoher Geschwindigkeit auf Wurzeln & Steinen
  if (!P.air && sp > 10) { const a = (sp - 10) * 0.0016; camera.rotation.z += (Math.random() - 0.5) * a; camera.rotation.x += (Math.random() - 0.5) * a; }
}

// ------------------------------------------------------------------
// Spielablauf
// ------------------------------------------------------------------
let forest, world, clouds;
function setupRace() {
  for (const r of riders) scene.remove(r.model);
  riders = [];
  const grid = [[10, -1.6], [10, 0], [10, 1.6], [6, -1.6], [6, 1.6], [6, 0]];
  RIDERS_CFG.forEach((cfg, i) => {
    const [s, lat] = cfg.player ? grid[5] : grid[i - 1];
    const model = makeRider(cfg); scene.add(model);
    if (cfg.player) {
      const P = makePlayerState(s, lat); P.isPlayer = true; P.cfg = cfg; P.model = model;
      riders.push(P); player = P;
    } else {
      riders.push({ isPlayer: false, cfg, model, ai: makeAI(cfg, s, lat) });
    }
  });
  race.t = 0; race.countdown = 3.5; race.state = 'countdown'; race.finishOrder = []; camInit = false;
  $('results').hidden = true;
  flash('3', 'Bergstation Kampenwand', 1);
  lastCount = 4;
}
let lastCount = 4;
function togglePause() {
  if (race.state === 'race' || race.state === 'countdown') { race.prev = race.state; race.state = 'paused'; $('pause').hidden = false; }
  else if (race.state === 'paused') { race.state = race.prev; $('pause').hidden = true; clock.getDelta(); }
}
$('resumeBtn').onclick = togglePause;
$('restartBtn2').onclick = () => { $('pause').hidden = true; setupRace(); };
$('againBtn').onclick = () => setupRace();
$('watchBtn').onclick = () => { $('results').hidden = true; };

function stepRace() {
  race.t += DT;
  stepPlayer(player, DT, input);
  for (const r of riders) if (!r.isPlayer) stepAI(r.ai, DT, player.s);
  // Rempeln mit Gegnern
  for (const r of riders) if (!r.isPlayer) {
    const dx = player.pos.x - r.ai.x, dz = player.pos.z - r.ai.z, d = Math.hypot(dx, dz);
    if (d < 0.9 && d > 0.001 && Math.abs(player.pos.y - r.ai.y) < 1.2) { player.pos.x += dx / d * (0.9 - d) * 0.6; player.pos.z += dz / d * (0.9 - d) * 0.6; player.vel.multiplyScalar(0.995); r.ai.lat -= (dx * Math.cos(r.ai.yaw) - dz * Math.sin(r.ai.yaw)) / d * 0.03; }
  }
  // Ziel
  if (!player.finished && player.s >= trail.L - 4) { player.finished = true; player.finishT = race.t; onPlayerFinish(); }
  for (const r of riders) if (!r.isPlayer && !r.ai.finished && r.ai.s >= trail.L - 4) { r.ai.finished = true; r.ai.finishT = race.t; if (!$('results').hidden) showResults(); }
}
const clock = new THREE.Clock();
let acc = 0;
const DT = 1 / 120;
function tick() {
  requestAnimationFrame(tick);
  const frameDt = Math.min(0.05, clock.getDelta());
  if (race.state === 'menu' || race.state === 'loading') return;
  if (race.state !== 'paused') {
    readInput(frameDt);
    if (requestReset) { requestReset = false; if (race.state === 'race' && !player.finished) { respawn(player); flash('Zurück auf der Strecke', '', 1, true); } }
    if (race.state === 'countdown') {
      race.countdown -= frameDt;
      const c = Math.ceil(race.countdown);
      if (c !== lastCount && c >= 0) { lastCount = c; if (c > 0 && c <= 3) { flash(String(c), 'Bergstation Kampenwand', 1); beep(440, 0.15); } }
      if (race.countdown <= 0) { race.state = 'race'; flash('Los!', '', 0.8); beep(880, 0.4); }
    } else if (race.state === 'race' || race.state === 'done') {
      acc += frameDt;
      while (acc >= DT) {
        acc -= DT; stepRace();
      }
    }
  }
  // Darstellung
  poseAllRiders(input);
  if (race.state !== 'paused') {
    uTime.value += frameDt;
    updateDust(frameDt);
    updateLife(frameDt, uTime.value, camera.position, player);
    for (const c of clouds.children) c.position.x += c.userData.drift * frameDt;
    for (const gd of gondolas) { gd.t = (gd.t + frameDt * 0.004) % 1; const tt = gd.line ? 1 - gd.t : gd.t; gd.g.position.copy(cablePath[gd.line].getPointAt(tt)); }
    if (msgTimer > 0) { msgTimer -= frameDt; if (msgTimer <= 0) { $('msg').classList.remove('show'); $('sub').classList.remove('show'); } }
  }
  updateCamera(frameDt);
  // Schatten & Sichtweite um den Spieler
  sun.target.position.copy(player.pos);
  sun.position.copy(player.pos).addScaledVector(sunDir, 300);
  updateTreeLod(camera.position);
  if (grassField) grassField.uni.uCam.value.copy(camera.position);
  updateAudio(player.vel.length(), !player.air && player.crashT <= 0, player.slip, player.onTrail);
  drawHud();
  renderFrame();
}
function riderState(r, inp) {
  if (r.isPlayer) return { crouch: clamp(r.vel.length() / 14, 0, 1), brake: inp.brake || 0, crankA: r.crankA, comp: r.comp, steer: r.steerVis, wheelRot: r.wheelRot, air: r.air, bodyX: -r.lean * 0.12 };
  const A = r.ai;
  return { crouch: clamp(A.v / 14, 0, 1), brake: A.braking ? 1 : 0, crankA: A.crankA || 0, comp: A.comp || 0, steer: A.steerVis || 0, wheelRot: A.wheelRot, air: A.air, bodyX: -A.lean * 0.12 };
}
function poseAllRiders(inp) {
  for (const r of riders) {
    const far = r.model.position.distanceTo(camera.position) > 450;
    r.model.visible = !far;
    if (far && r.posedOnce) continue;
    r.posedOnce = true;
    if (r.isPlayer) poseModel(r.model, r.pos.x, r.pos.y, r.pos.z, r.yaw, r.pitchUp, r.lean, riderState(r, inp), r.crashT);
    else {
      const A = r.ai; _n.set(0, 1, 0); const nn = normalAt(A.x, A.z, _tmp.clone()); if (!A.air) _n.lerp(nn, 0.85);
      poseModel(r.model, A.x, A.y, A.z, A.yaw, _n.clone(), A.lean, riderState(r, inp), 0);
    }
  }
}
function onPlayerFinish() {
  const t = player.finishT;
  let rec = false;
  if (!race.best || t < race.best) { race.best = t; rec = true; try { localStorage.setItem('kw_best', String(t)); } catch (e) { /* kein Speicher */ } }
  const rank = ranking().findIndex((r) => r.isPlayer) + 1;
  flash('Ziel!', `${fmtTime(t)} · Platz ${rank}${rec ? ' · neue Bestzeit' : ''}`, 3);
  beep(660, 0.2); setTimeout(() => beep(990, 0.4), 200);
  setTimeout(() => { showResults(); $('results').hidden = false; }, 2200);
}

// ------------------------------------------------------------------
// Aufbau
// ------------------------------------------------------------------
const setLoad = (t) => { $('loading').textContent = t; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
async function init() {
  resize();
  race.state = 'loading';
  await loadHeights();
  setLoad('Strecke wird in den Hang gebaut …'); await nextFrame();
  buildTrail(); coarseDist(); buildShortcuts(); carveTerrain();
  maskTex = (() => {
    // R: Abstand Hauptstrecke, G: Wald, B: Abstand Abkürzung, A: Querversatz zur Streckenmitte
    const data = new Uint8Array(G * G * 4);
    const tmp = new THREE.Vector3();
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const id = j * G + i, x = i * CELL - HALF, z = j * CELL - HALF;
      data[id * 4] = Math.min(255, Math.round(DIST[id] * 10));
      if ((i & 1) === 0 && (j & 1) === 0) {
        const y = H[id]; const ny = normalAt(x, z, tmp).y;
        data[id * 4 + 1] = Math.round(forestAt(x, z, y, ny) * 255);
      } else data[id * 4 + 1] = data[((j - (j & 1)) * G + (i - (i & 1))) * 4 + 1];
      data[id * 4 + 2] = Math.min(255, Math.round(SDIST[id] * 10));
      data[id * 4 + 3] = clamp(Math.round(TLAT[id] * 10 + 128), 0, 255);
    }
    const t = new THREE.DataTexture(data, G, G, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
    return t;
  })();
  heightTex = new THREE.DataTexture(H, G, G, THREE.RedFormat, THREE.FloatType);
  heightTex.magFilter = heightTex.minFilter = THREE.NearestFilter; heightTex.needsUpdate = true;
  setLoad('Gelände wird modelliert …'); await nextFrame();
  const tmat = makeTerrainMaterial();
  world = new THREE.Group(); scene.add(world);
  world.add(buildTerrain(tmat));
  world.add(buildOuter(tmat));
  setLoad('Bergstation & Seilbahn …'); await nextFrame();
  world.add(buildStationsAndLift());
  clouds = buildClouds(); scene.add(clouds);
  setLoad('Zuschauer, Tiere & Gleitschirme …'); await nextFrame();
  const rand = mulberry32(1234);
  treeMats = treeMaterials();
  world.add(buildLife(rand));
  try { world.add(await loadRealPeople()); } catch (err) { console.warn('Figuren nicht geladen', err); }
  setLoad('Wald wächst …'); await nextFrame();
  forest = buildForest(rand); world.add(forest);
  world.add(buildRocks(rand));
  world.add(buildUndergrowth(rand));
  world.add(buildGrassField(QUALITY === 'high' ? 30000 : 12000, 56));
  world.add(buildCourse());
  scene.add(buildDust());
  prepHudCanvases();
  setupRace(); race.state = 'menu'; msgTimer = 0; $('msg').classList.remove('show'); $('sub').classList.remove('show');
  applyQuality();
  // Vorschau hinter dem Menü
  updateCamera(0.016); sun.target.position.copy(player.pos); sun.position.copy(player.pos).addScaledVector(sunDir, 300);
  poseAllRiders(input);
  updateLife(0.016, 0, camera.position, player);
  updateTreeLod(camera.position);
  grassField.uni.uCam.value.copy(camera.position);
  renderFrame();
  setLoad(`${forest.userData.total.toLocaleString('de-DE')} Bäume · ${trail.kickers.length} Sprünge · ${shortcuts.length} Abkürzungen · ${(trail.L / 1000).toFixed(2).replace('.', ',')} km Strecke`);
  const b = $('startBtn'); b.disabled = false; b.textContent = 'Rennen starten';
  window.__kw = { trail, player: () => player, riders: () => riders, race, input, keys, setupRace, stepRace, readInput, resetCam: () => { camInit = false; }, shortcuts, life };
  window.__hAt = hAt;
}
$('startBtn').onclick = () => {
  initAudio();
  $('menu').hidden = true;
  for (const id of ['hudTL', 'hudTR', 'profileWrap', 'minimap']) $(id).hidden = false;
  $('touch').hidden = !isTouch;
  setupRace();
  clock.getDelta();
};
requestAnimationFrame(tick);
init().catch((e) => { setLoad('Fehler beim Laden: ' + e.message); console.error(e); });
