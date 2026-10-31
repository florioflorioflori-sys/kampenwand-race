import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// ------------------------------------------------------------------
// Konstanten & Hilfsfunktionen
// ------------------------------------------------------------------
const LAT0 = 47.76024328732481, LON0 = 12.340135239064693;
const MX = Math.cos(LAT0 * Math.PI / 180) * 111320, MY = 110574;
const SIZE = 4000, HALF = 2000;
const SRC_N = 1025;            // übertragenes Raster (3,9 m)
const G = 2049;                // Laufzeit-Raster (1,95 m)
const CELL = SIZE / (G - 1);
const GRAV = 9.81;
const TRAIL_STEP = 2;          // Abstand der Streckenpunkte in m
const TRAIL_HALF = 2.4;        // halbe Fahrbahnbreite
const CARVE_R = 14;            // Radius, in dem das Gelände an die Strecke angeglichen wird
const SC_HALF = 0.9;           // halbe Breite der Abkürzungen
const DMAX = 25.5;

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
function wrapAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(i, j) { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * vnoise(x * f + k * 17.3, y * f - k * 9.1); f *= 2.03; a *= 0.5; } return s; }

const ll2w = (lon, lat) => [(lon - LON0) * MX, -(lat - LAT0) * MY];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------
// Qualität
// ------------------------------------------------------------------
const isTouch = matchMedia('(pointer: coarse)').matches;
let QUALITY = isTouch ? 'low' : 'high';
function setQualityButtons() { $('qHigh').setAttribute('aria-pressed', QUALITY === 'high'); $('qLow').setAttribute('aria-pressed', QUALITY === 'low'); }
setQualityButtons();
$('qHigh').onclick = () => { QUALITY = 'high'; setQualityButtons(); applyQuality(); };
$('qLow').onclick = () => { QUALITY = 'low'; setQualityButtons(); applyQuality(); };

// ------------------------------------------------------------------
// Höhenmodell laden
// ------------------------------------------------------------------
const H = new Float32Array(G * G);
async function loadHeights() {
  const b64 = $('hmData').textContent.trim();
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  const d = new Int16Array(await new Response(stream).arrayBuffer());
  const src = new Float32Array(SRC_N * SRC_N);
  for (let r = 0; r < SRC_N; r++) { let acc = 0; for (let c = 0; c < SRC_N; c++) { acc += d[r * SRC_N + c]; src[r * SRC_N + c] = acc * 0.1; } }
  for (let j = 0; j < G; j++) {
    const sy = j >> 1, oy = j & 1;
    for (let i = 0; i < G; i++) {
      const sx = i >> 1, ox = i & 1;
      const a = src[sy * SRC_N + sx];
      const b = ox ? src[sy * SRC_N + sx + 1] : a;
      const c = oy ? src[(sy + 1) * SRC_N + sx] : a;
      const e = ox && oy ? src[(sy + 1) * SRC_N + sx + 1] : (ox ? b : c);
      H[j * G + i] = (a + b + c + e) * 0.25;
    }
  }
  blur(H, 1);
  // feine Unebenheiten, die das 4-m-Modell nicht kennt
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const x = i * CELL - HALF, z = j * CELL - HALF;
    H[j * G + i] += fbm(x * 0.045, z * 0.045, 3) * 0.9;
  }
}
function blur(A, passes) {
  const T = new Float32Array(G * G);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(G - 1, i + 1);
      T[j * G + i] = (A[j * G + i0] + 2 * A[j * G + i] + A[j * G + i1]) * 0.25;
    }
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const j0 = Math.max(0, j - 1), j1 = Math.min(G - 1, j + 1);
      A[j * G + i] = (T[j0 * G + i] + 2 * T[j * G + i] + T[j1 * G + i]) * 0.25;
    }
  }
}
function hAt(x, z) {
  let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
  fx = clamp(fx, 0, G - 1.001); fz = clamp(fz, 0, G - 1.001);
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * G + i;
  const a = H[k], b = H[k + 1], c = H[k + G], d = H[k + G + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const _n = new THREE.Vector3();
function normalAt(x, z, out = _n) {
  const e = 1.2;
  const dx = hAt(x + e, z) - hAt(x - e, z), dz = hAt(x, z + e) - hAt(x, z - e);
  return out.set(-dx, 2 * e, -dz).normalize();
}

// ------------------------------------------------------------------
// Strecke
// ------------------------------------------------------------------
const trail = { x: null, z: null, y: null, s: null, yaw: null, curv: null, n: 0, L: 0, kickers: [] };
function buildTrail() {
  const raw = JSON.parse($('trailData').textContent).map(([lon, lat]) => ll2w(lon, lat));
  let px = [], pz = [];
  for (let k = 0; k < raw.length - 1; k++) {
    const [ax, az] = raw[k], [bx, bz] = raw[k + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 1));
    for (let t = 0; t < n; t++) { px.push(ax + (bx - ax) * t / n); pz.push(az + (bz - az) * t / n); }
  }
  px.push(raw[raw.length - 1][0]); pz.push(raw[raw.length - 1][1]);
  for (let pass = 0; pass < 3; pass++) {
    const W = 9, nx = px.slice(), nz = pz.slice();
    for (let k = 0; k < px.length; k++) {
      let sx = 0, sz = 0, c = 0;
      for (let o = -W; o <= W; o++) { const q = clamp(k + o, 0, px.length - 1); sx += px[q]; sz += pz[q]; c++; }
      nx[k] = sx / c; nz[k] = sz / c;
    }
    px = nx; pz = nz;
  }
  const cum = [0];
  for (let k = 1; k < px.length; k++) cum.push(cum[k - 1] + Math.hypot(px[k] - px[k - 1], pz[k] - pz[k - 1]));
  const L = cum[cum.length - 1], n = Math.floor(L / TRAIL_STEP) + 1;
  const X = new Float32Array(n), Z = new Float32Array(n), Y = new Float32Array(n), S = new Float32Array(n);
  let q = 0;
  for (let k = 0; k < n; k++) {
    const s = k * TRAIL_STEP;
    while (q < cum.length - 2 && cum[q + 1] < s) q++;
    const t = (s - cum[q]) / Math.max(1e-6, cum[q + 1] - cum[q]);
    X[k] = lerp(px[q], px[q + 1], t); Z[k] = lerp(pz[q], pz[q + 1], t); S[k] = s;
  }
  const raw_y = new Float32Array(n);
  for (let k = 0; k < n; k++) raw_y[k] = hAt(X[k], Z[k]);
  for (let k = 0; k < n; k++) { let s = 0, c = 0; for (let o = -8; o <= 8; o++) { const qq = clamp(k + o, 0, n - 1); s += raw_y[qq]; c++; } Y[k] = s / c; }
  const YAW = new Float32Array(n), CURV = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1);
    YAW[k] = Math.atan2(X[b] - X[a], Z[b] - Z[a]);
  }
  for (let k = 0; k < n; k++) {
    const a = Math.max(0, k - 3), b = Math.min(n - 1, k + 3);
    CURV[k] = wrapAngle(YAW[b] - YAW[a]) / Math.max(1, (b - a) * TRAIL_STEP);
  }
  Object.assign(trail, { x: X, z: Z, y: Y, s: S, yaw: YAW, curv: CURV, n, L: (n - 1) * TRAIL_STEP });
  const kick = [];
  for (let s = 170; s < trail.L - 160; s += 10) {
    if (kick.length && s - kick[kick.length - 1] < 190) continue;
    const k = Math.round(s / TRAIL_STEP);
    let mx = 0; for (let o = -12; o <= 10; o++) mx = Math.max(mx, Math.abs(CURV[clamp(k + o, 0, n - 1)]));
    if (mx < 0.03) kick.push(s);
  }
  trail.kickers = kick;
  for (const sk of kick) {
    for (let k = 0; k < n; k++) {
      const u = S[k] - sk;
      if (u > -8 && u <= 0) Y[k] += 1.1 * Math.pow((u + 8) / 8, 1.7);
      else if (u > 0 && u < 1.5) Y[k] += 1.1 * (1 - u / 1.5) * 0.25;
    }
  }
  // Bremswellen und Wurzeln: kleine Wellen im Fahrbahnprofil
  for (let k = 0; k < n; k++) Y[k] += Math.sin(S[k] * 0.9) * 0.05 + Math.max(0, vnoise(S[k] * 0.12, 3.3)) * 0.18;
}
function trailIdx(s) { return clamp(Math.round(s / TRAIL_STEP), 0, trail.n - 1); }
function trailPoint(s, lat, out) {
  const f = clamp(s / TRAIL_STEP, 0, trail.n - 1.001), k = f | 0, t = f - k;
  const x = lerp(trail.x[k], trail.x[k + 1], t), z = lerp(trail.z[k], trail.z[k + 1], t);
  const yaw = trail.yaw[k] + wrapAngle(trail.yaw[k + 1] - trail.yaw[k]) * t;
  out.x = x + Math.cos(yaw) * lat; out.z = z - Math.sin(yaw) * lat; out.yaw = yaw;
  return out;
}

// ------------------------------------------------------------------
// Abkürzungen: steile, schmale Direttissimas über Kehren hinweg
// ------------------------------------------------------------------
const shortcuts = [];
function buildShortcuts() {
  const cands = [];
  const scan = (maxRatio, minDrop, clear) => {
    for (let a = 200; a < trail.L - 300; a += 8) {
      const ka = trailIdx(a);
      for (let b = a + 110; b < Math.min(trail.L - 120, a + 400); b += 8) {
        const kb = trailIdx(b);
        const dx = trail.x[kb] - trail.x[ka], dz = trail.z[kb] - trail.z[ka], d = Math.hypot(dx, dz);
        if (d < 40 || d > 220 || d / (b - a) > maxRatio) continue;
        if (trail.y[ka] - trail.y[kb] < d * minDrop) continue;
        let ok = true, maxG = 0, prevH = trail.y[ka], low = trail.y[ka];
        for (let t = 4; t < d - 4; t += 4) {
          const x = trail.x[ka] + dx * t / d, z = trail.z[ka] + dz * t / d;
          if (t > 18 && t < d - 18 && coarseDistAt(x, z) < clear) { ok = false; break; }
          const h = hAt(x, z);
          if (h > low + 2.5) { ok = false; break; }
          low = Math.min(low, h); maxG = Math.max(maxG, (prevH - h) / 4); prevH = h;
        }
        if (!ok || maxG > 1.3) continue;
        cands.push({ a, b, d, gain: (b - a) - d });
      }
    }
  };
  for (const [r, m, c] of [[0.5, 0.25, 15], [0.7, 0.15, 12], [0.85, 0.08, 9], [0.93, 0.05, 7]]) { if (new Set(cands.map((c) => Math.round(c.a / 300))).size >= 2) break; scan(r, m, c); }
  cands.sort((p, q) => q.gain - p.gain);
  for (const c of cands) {
    if (shortcuts.length >= 2) break;
    if (shortcuts.some((s) => !(c.b < s.sA - 100 || c.a > s.sB + 100))) continue;
    shortcuts.push(makeShortcut(c, shortcuts.length));
  }
  shortcuts.sort((p, q) => p.sA - q.sA);
}
function makeShortcut(c, id) {
  const ka = trailIdx(c.a), kb = trailIdx(c.b);
  const ax = trail.x[ka], az = trail.z[ka], bx = trail.x[kb], bz = trail.z[kb];
  const d = c.d, n = Math.ceil(d) + 1;
  const nx = -(bz - az) / d, nz = (bx - ax) / d;
  const amp = Math.min(9, d * 0.06) * (id % 2 ? 1 : -1);
  const X = new Float32Array(n), Z = new Float32Array(n), Y = new Float32Array(n), YAW = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), w = Math.sin(t * Math.PI * 2) * amp + Math.sin(t * Math.PI * 5) * 1.2;
    X[i] = ax + (bx - ax) * t + nx * w; Z[i] = az + (bz - az) * t + nz * w;
  }
  const raw = Array.from(X, (x, i) => hAt(x, Z[i]));
  for (let i = 0; i < n; i++) { let s = 0, cnt = 0; for (let o = -3; o <= 3; o++) { s += raw[clamp(i + o, 0, n - 1)]; cnt++; } Y[i] = s / cnt; }
  // Anschluss an die Hauptstrecke
  for (let i = 0; i < Math.min(8, n); i++) { const w = 1 - i / 8; Y[i] = lerp(Y[i], trail.y[ka], w); Y[n - 1 - i] = lerp(Y[n - 1 - i], trail.y[kb], w); }
  // Wurzelteppich und zwei Drops
  const drops = [0.32, 0.68].map((f) => f * (n - 1));
  for (let i = 0; i < n; i++) {
    Y[i] += Math.max(0, Math.sin(i * 1.3)) * 0.22 * smooth(6, 14, i) * smooth(6, 14, n - 1 - i);
    for (const sd of drops) { const u = i - sd; if (u > -4 && u <= 0) Y[i] += 0.95 * Math.pow((u + 4) / 4, 1.3); }
  }
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); YAW[i] = Math.atan2(X[b] - X[a], Z[b] - Z[a]); }
  return { id, X, Z, Y, YAW, n, sA: c.a, sB: c.b, len: n - 1, drops };
}
function nearestShortcut(x, z, maxD) {
  let best = null;
  for (const sc of shortcuts) {
    const bx0 = Math.min(sc.X[0], sc.X[sc.n - 1]) - maxD - 20, bx1 = Math.max(sc.X[0], sc.X[sc.n - 1]) + maxD + 20;
    const bz0 = Math.min(sc.Z[0], sc.Z[sc.n - 1]) - maxD - 20, bz1 = Math.max(sc.Z[0], sc.Z[sc.n - 1]) + maxD + 20;
    if (x < bx0 || x > bx1 || z < bz0 || z > bz1) continue;
    for (let i = 0; i < sc.n; i++) {
      const d = (x - sc.X[i]) ** 2 + (z - sc.Z[i]) ** 2;
      if (d < maxD * maxD && (!best || d < best.d2)) best = { sc, i, d2: d };
    }
  }
  if (best) best.d = Math.sqrt(best.d2);
  return best;
}

// Distanzfelder zur Strecke + Angleichen des Geländes
const DIST = new Float32Array(G * G).fill(DMAX);
const SDIST = new Float32Array(G * G).fill(DMAX);
const TIDX = new Int32Array(G * G).fill(-1);
const TLAT = new Float32Array(G * G);
function rasterPath(X, Z, n, yawArr, distArr, idxArr, latArr, radius) {
  const R = Math.ceil(radius / CELL) + 1;
  for (let k = 0; k < n; k++) {
    const cx = X[k], cz = Z[k];
    const lx = Math.cos(yawArr[k]), lz = -Math.sin(yawArr[k]);
    const ci = Math.round((cx + HALF) / CELL), cj = Math.round((cz + HALF) / CELL);
    for (let j = cj - R; j <= cj + R; j++) {
      if (j < 0 || j >= G) continue;
      for (let i = ci - R; i <= ci + R; i++) {
        if (i < 0 || i >= G) continue;
        const x = i * CELL - HALF, z = j * CELL - HALF;
        const d = Math.hypot(x - cx, z - cz), id = j * G + i;
        if (d < distArr[id]) { distArr[id] = d; idxArr[id] = k; if (latArr) latArr[id] = (x - cx) * lx + (z - cz) * lz; }
      }
    }
  }
}
function carveTerrain() {
  rasterPath(trail.x, trail.z, trail.n, trail.yaw, DIST, TIDX, TLAT, CARVE_R);
  for (let id = 0; id < G * G; id++) {
    const k = TIDX[id];
    if (k < 0) continue;
    const d = DIST[id];
    if (d > CARVE_R) continue;
    const lat = TLAT[id];
    const bank = clamp(-trail.curv[k] * 6, -0.22, 0.22);
    // leicht ausgefahrene Rinne: Mitte etwas tiefer als der Rand
    const rut = -0.12 * (1 - smooth(0, TRAIL_HALF, Math.abs(lat)));
    const target = trail.y[k] + bank * clamp(lat, -TRAIL_HALF - 1, TRAIL_HALF + 1) - 0.05 + rut;
    const w = 1 - smooth(TRAIL_HALF + 0.6, CARVE_R, d);
    H[id] = lerp(H[id], target, w);
  }
  const SIDX = new Int32Array(G * G).fill(-1);
  for (const sc of shortcuts) {
    const tmpD = new Float32Array(G * G).fill(DMAX), tmpI = new Int32Array(G * G).fill(-1);
    rasterPath(sc.X, sc.Z, sc.n, sc.YAW, tmpD, tmpI, null, 7);
    for (let id = 0; id < G * G; id++) {
      if (tmpI[id] < 0 || tmpD[id] >= SDIST[id]) continue;
      SDIST[id] = tmpD[id]; SIDX[id] = tmpI[id];
      const w = (1 - smooth(SC_HALF + 0.4, 6.5, tmpD[id])) * smooth(TRAIL_HALF + 0.3, TRAIL_HALF + 4, DIST[id]);
      H[id] = lerp(H[id], sc.Y[tmpI[id]] - 0.06, w);
    }
  }
}
function trailDistAt(x, z) {
  const i = Math.round((x + HALF) / CELL), j = Math.round((z + HALF) / CELL);
  if (i < 0 || j < 0 || i >= G || j >= G) return DMAX;
  return DIST[j * G + i];
}
function scDistAt(x, z) {
  const i = Math.round((x + HALF) / CELL), j = Math.round((z + HALF) / CELL);
  if (i < 0 || j < 0 || i >= G || j >= G) return DMAX;
  return SDIST[j * G + i];
}

// grobe Entfernung zur Strecke (20-m-Raster) für Baumdichte & LOD
const CG = 201, CCELL = SIZE / (CG - 1);
const CDIST = new Float32Array(CG * CG);
function coarseDist() {
  for (let j = 0; j < CG; j++) for (let i = 0; i < CG; i++) {
    const x = i * CCELL - HALF, z = j * CCELL - HALF;
    let m = 1e9;
    for (let k = 0; k < trail.n; k += 4) { const d = (x - trail.x[k]) ** 2 + (z - trail.z[k]) ** 2; if (d < m) m = d; }
    CDIST[j * CG + i] = Math.sqrt(m);
  }
}
function coarseDistAt(x, z) {
  const i = clamp(Math.round((x + HALF) / CCELL), 0, CG - 1), j = clamp(Math.round((z + HALF) / CCELL), 0, CG - 1);
  return CDIST[j * CG + i];
}

function forestAt(x, z, y, ny) {
  const n = fbm(x * 0.0032, z * 0.0032, 4);
  const altLimit = 1330 + fbm(x * 0.01, z * 0.01, 2) * 90;
  return smooth(-0.18, 0.05, n) * (1 - smooth(altLimit - 60, altLimit + 40, y)) * smooth(0.55, 0.7, ny);
}
