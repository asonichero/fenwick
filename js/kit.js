// Fenwick Hall — the kit rooms are built from (after Project Meridian's SuitBay.kit and Quarters.kit): painted canvas textures, merging meshes
// for low-CPU mode, and which wall each thing in a room belongs to (so the camera can come through a wall and that side is hidden). The textures
// here are the Hall's: limewashed plaster, oak panelling and boards, stone and brick, a faded Turkey rug, linen, a patchwork quilt, dust sheets,
// leaded windows onto the Fenwood.
//
//   const K = root.Kit · K.canvasTex(w, h, draw, repeat) · K.merged(meshes) · K.roomSides(group, bounds, skip) → { sideOf, sidesAt }
(function (root) {
'use strict';
const THREE = root.THREE, V3 = THREE.Vector3;

function canvasTex(w, h, draw, rep) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (rep) t.repeat.set(rep[0], rep[1]); return t;
}
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(11);
function speckle(c, w, h, n, col, a, r) { for (let i = 0; i < n; i++) { c.fillStyle = col; c.globalAlpha = a * rnd(); c.beginPath(); c.arc(rnd() * w, rnd() * h, r * (0.3 + rnd()), 0, 7); c.fill(); } c.globalAlpha = 1; }
const strokes = (c, w, h, n, light, dark) => { for (let i = 0; i < n; i++) { c.strokeStyle = rnd() < 0.5 ? light : dark; c.lineWidth = 6 + rnd() * 14; c.beginPath(); const x = rnd() * w, y = rnd() * h; c.moveTo(x, y); c.lineTo(x + 30 + rnd() * 70, y + (rnd() - 0.5) * 30); c.stroke(); } };

// Limewashed plaster: soft, uneven, brushed; grime gathers low and in the corners.
const plasterTex = (base, rep) => canvasTex(512, 512, (c, w, h) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  speckle(c, w, h, 1400, '#5a4a3a', 0.05, 7); speckle(c, w, h, 900, '#fff8ea', 0.05, 6);
  strokes(c, w, h, 160, 'rgba(255,250,235,0.04)', 'rgba(60,40,20,0.04)');
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,28,16,0.14)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
}, rep);
// Wood grain, long and wavering; `col` its colour.
const grain = (col, rep, w0, h0) => canvasTex(w0 || 256, h0 || 64, (c, w, h) => {
  c.fillStyle = col; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) { c.strokeStyle = `rgba(${rnd() < 0.55 ? '40,22,10' : '190,140,90'},${0.12 + rnd() * 0.16})`; c.lineWidth = 0.8 + rnd() * 2; c.beginPath(); let y = rnd() * h; c.moveTo(0, y); for (let x = 0; x <= w; x += 16) { y += (rnd() - 0.5) * 2.4; c.lineTo(x, y); } c.stroke(); }
  speckle(c, w, h, 60, '#2a160a', 0.15, 1.6);
}, rep);
// Floorboards: oak boards of uneven width, butt joints staggered, worn paler down the middle of the room.
const boardsTex = (col, rep) => canvasTex(512, 512, (c, w, h) => {
  c.fillStyle = col; c.fillRect(0, 0, w, h); let x = 0;
  while (x < w) {
    const bw = 44 + Math.floor(rnd() * 26), k = 0.88 + rnd() * 0.24;
    c.fillStyle = `rgba(${k > 1 ? '255,235,200' : '30,18,8'},${Math.abs(k - 1) * 0.5})`; c.fillRect(x, 0, bw, h);
    for (let i = 0; i < 18; i++) { c.strokeStyle = `rgba(${rnd() < 0.6 ? '40,22,10' : '200,150,100'},${0.1 + rnd() * 0.12})`; c.lineWidth = 0.8 + rnd() * 1.6; c.beginPath(); let gx = x + rnd() * bw; c.moveTo(gx, 0); for (let y = 0; y <= h; y += 24) { gx += (rnd() - 0.5) * 1.6; c.lineTo(Math.min(x + bw - 2, Math.max(x + 2, gx)), y); } c.stroke(); }
    c.fillStyle = 'rgba(20,10,4,0.75)'; c.fillRect(x, 0, 2, h);
    for (let y = rnd() * 200; y < h; y += 180 + rnd() * 200) { c.fillRect(x, y, bw, 2); c.fillStyle = 'rgba(20,10,4,0.6)'; c.beginPath(); c.arc(x + 8, y + 10, 2, 0, 7); c.arc(x + bw - 8, y + 10, 2, 0, 7); c.fill(); c.fillStyle = 'rgba(20,10,4,0.75)'; }
    x += bw;
  }
  speckle(c, w, h, 500, '#1a0e06', 0.12, 2.5);
}, rep);
// Oak panelling for the wainscot: raised fields in their frames.
const panelTex = (col, rep) => canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = col; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i++) { c.strokeStyle = `rgba(${rnd() < 0.6 ? '30,16,6' : '200,150,100'},0.14)`; c.lineWidth = 1 + rnd() * 2; c.beginPath(); let y = rnd() * h; c.moveTo(0, y); for (let x = 0; x <= w; x += 16) { y += (rnd() - 0.5) * 2; c.lineTo(x, y); } c.stroke(); }
  c.strokeStyle = 'rgba(20,10,4,0.55)'; c.lineWidth = 6; c.strokeRect(26, 26, w - 52, h - 52);
  c.strokeStyle = 'rgba(255,220,170,0.16)'; c.lineWidth = 3; c.strokeRect(34, 34, w - 68, h - 68);
  c.strokeStyle = 'rgba(20,10,4,0.3)'; c.lineWidth = 2; c.strokeRect(40, 40, w - 80, h - 80);
}, rep);
const stoneTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#8a8274'; c.fillRect(0, 0, w, h);
  for (let y = 0, row = 0; y < h; y += 42, row++) for (let x = -(row % 2) * 40; x < w; x += 80) {
    const k = 0.85 + rnd() * 0.3; c.fillStyle = `rgb(${Math.round(138 * k)},${Math.round(130 * k)},${Math.round(116 * k)})`; c.fillRect(x + 2, y + 2, 76, 38);
  }
  speckle(c, w, h, 900, '#3a342c', 0.18, 2); speckle(c, w, h, 500, '#d8d0c0', 0.12, 1.6);
}, [1, 1]);
const brickTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#2a1a14'; c.fillRect(0, 0, w, h);
  for (let y = 0, row = 0; y < h; y += 16, row++) for (let x = -(row % 2) * 16; x < w; x += 32) { c.fillStyle = `rgba(${90 + rnd() * 40},${40 + rnd() * 20},${30},${0.8})`; c.fillRect(x + 1, y + 1, 30, 14); }
  speckle(c, w, h, 400, '#000', 0.35, 2.5);
}, [2, 1]);
// A Turkey rug, faded: a madder field, an indigo border, a medallion; `fade` 0–1 how sun-worn it is.
const rugTex = fade => canvasTex(256, 256, (c, w, h) => {
  const f = fade || 0, mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * f));
  const field = mix([138, 44, 36], [168, 120, 96]), border = mix([38, 46, 82], [96, 98, 110]), gold = mix([200, 154, 82], [190, 170, 130]);
  const rgb = a => `rgb(${a[0]},${a[1]},${a[2]})`;
  c.fillStyle = rgb(border); c.fillRect(0, 0, w, h); c.fillStyle = rgb(field); c.fillRect(22, 22, w - 44, h - 44);
  c.strokeStyle = rgb(gold); c.lineWidth = 3; c.strokeRect(16, 16, w - 32, h - 32); c.strokeRect(26, 26, w - 52, h - 52);
  c.save(); c.translate(w / 2, h / 2); c.rotate(Math.PI / 4); c.fillStyle = rgb(border); c.fillRect(-46, -46, 92, 92); c.fillStyle = rgb(gold); c.fillRect(-26, -26, 52, 52); c.fillStyle = rgb(field); c.fillRect(-12, -12, 24, 24); c.restore();
  for (let i = 0; i < 12; i++) { c.fillStyle = rgb(gold); c.fillRect(30 + i * 17, 6, 6, 6); c.fillRect(30 + i * 17, h - 12, 6, 6); }
  speckle(c, w, h, 900, '#000', 0.08, 2); speckle(c, w, h, 400, '#fff', 0.05 + 0.08 * f, 2);
});
// Woven cloth (linen, wool): `col` and a thread colour.
const weave = (col, thread, rep) => canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = col; c.fillRect(0, 0, w, h);
  for (let i = 0; i < w; i += 3) { c.fillStyle = thread; c.fillRect(i, 0, 1, h); c.fillRect(0, i, w, 1); }
  speckle(c, w, h, 300, '#000', 0.06, 1.6);
}, rep || [3, 3]);
const quiltTex = canvasTex(256, 256, (c, w, h) => {
  const cols = ['#8a3a2e', '#d8c8a4', '#3e5a4a', '#c8a050', '#5a4a6a', '#e8dcc0', '#a85a3a'];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.fillRect(x * 32, y * 32, 32, 32); if (rnd() < 0.4) { c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.beginPath(); c.moveTo(x * 32, y * 32); c.lineTo(x * 32 + 32, y * 32 + 32); c.lineTo(x * 32, y * 32 + 32); c.fill(); } }
  c.strokeStyle = 'rgba(255,245,220,0.35)'; c.setLineDash([3, 3]); c.lineWidth = 1; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, h); c.moveTo(0, i * 32); c.lineTo(w, i * 32); c.stroke(); }
  speckle(c, w, h, 600, '#000', 0.08, 2);
}, [1.5, 1.5]);
const dustSheetTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#cfc6b2'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { const g = c.createLinearGradient(0, 0, w, 0), x = rnd() * w; g.addColorStop(Math.max(0, x / w - 0.06), 'rgba(0,0,0,0)'); g.addColorStop(x / w, 'rgba(60,50,30,0.12)'); g.addColorStop(Math.min(1, x / w + 0.06), 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
  speckle(c, w, h, 1600, '#6a5a40', 0.12, 2.4);
}, [1, 1]);
// The view through a leaded window: the Fenwood by day, or at dusk, behind diamond quarries.
const windowTex = night => canvasTex(256, 384, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  if (night) { g.addColorStop(0, '#1a2440'); g.addColorStop(0.55, '#3a3a5a'); g.addColorStop(0.7, '#8a5a4a'); } else { g.addColorStop(0, '#a8c4d8'); g.addColorStop(0.6, '#dfe6e0'); g.addColorStop(0.7, '#e8e0c8'); }
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { const x = rnd() * w, tw = 30 + rnd() * 50, th = 120 + rnd() * 140; c.fillStyle = night ? `rgba(10,14,20,${0.7 + rnd() * 0.3})` : `rgba(${50 + rnd() * 30},${70 + rnd() * 30},${44 + rnd() * 20},${0.75 + rnd() * 0.25})`; c.beginPath(); c.moveTo(x, h - th - 60); c.lineTo(x - tw / 2, h); c.lineTo(x + tw / 2, h); c.fill(); }
  c.fillStyle = night ? '#0a0c10' : '#4a5a38'; c.fillRect(0, h * 0.86, w, h * 0.14);
  if (night) { c.fillStyle = '#f2ead0'; c.beginPath(); c.arc(w * 0.7, h * 0.18, 12, 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(40,40,44,0.9)'; c.lineWidth = 2;
  for (let k = -h; k < w + h; k += 34) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + h, h); c.stroke(); c.beginPath(); c.moveTo(k + h, 0); c.lineTo(k, h); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, 0, w, h);
});
const cobwebTex = canvasTex(128, 128, (c, w, h) => {
  c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(230,230,220,0.55)'; c.lineWidth = 0.8;
  for (let a = 0; a < 7; a++) { const t = a / 6 * Math.PI / 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(t) * w, Math.sin(t) * h); c.stroke(); }
  for (let r = 12; r < w; r += 13) { c.beginPath(); for (let a = 0; a <= 6; a++) { const t = a / 6 * Math.PI / 2, rr = r * (0.92 + 0.08 * Math.sin(a * 2.3)); if (a === 0) c.moveTo(Math.cos(t) * rr, Math.sin(t) * rr); else c.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); } c.stroke(); }
});

function merged(meshes) {
  const byM = new Map(); for (const m of meshes) { if (!byM.has(m.material)) byM.set(m.material, []); byM.get(m.material).push(m); }
  const out = [];
  for (const [mat, ms] of byM) {
    const pos = [], nrm = [], uv = [], idx = []; let base = 0;
    for (const m of ms) {
      m.updateMatrix(); const g = m.geometry.clone().applyMatrix4(m.matrix), P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nrm.push(N.getX(i), N.getY(i), N.getZ(i)); if (U) uv.push(U.getX(i), U.getY(i)); else uv.push(0, 0); }
      const I = g.index ? g.index.array : Array.from({ length: P.count }, (_, i) => i); for (const i of I) idx.push(base + i); base += P.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const mm = new THREE.Mesh(g, mat); mm.receiveShadow = true; out.push(mm);
  }
  return out;
}
// Which wall (or the ceiling) each thing in a room belongs to, and which sides the camera is in or beyond (Meridian's, unchanged).
function roomSides(G, b, skip) {
  const REACH = 0.75, sideOf = new Map(), _bx = new THREE.Box3(), _c = new V3();
  for (const o of G.children) {
    if (o.isLight || (skip && skip.includes(o))) continue;
    _bx.setFromObject(o); if (_bx.isEmpty()) continue; _bx.getCenter(_c);
    const d = { N: _c.z - b.minZ, S: b.maxZ - _c.z, W: _c.x - b.minX, E: b.maxX - _c.x }; let best = null;
    for (const k in d) if (d[k] < REACH && (!best || d[k] < d[best])) best = k;
    if (!best && b.ht - _c.y < REACH) best = 'C';
    if (best) sideOf.set(o, best);
  }
  const IN = 0.45;
  const sidesAt = p => { const s = new Set(); if (p.z < b.minZ + IN) s.add('N'); if (p.z > b.maxZ - IN) s.add('S'); if (p.x < b.minX + IN) s.add('W'); if (p.x > b.maxX - IN) s.add('E'); if (p.y > b.ht - 0.3) s.add('C'); return s; };
  return { sideOf, sidesAt };
}

root.Kit = { canvasTex, rnd, speckle, plasterTex, grain, boardsTex, panelTex, stoneTex, brickTex, rugTex, weave, quiltTex, dustSheetTex, windowTex, cobwebTex, merged, roomSides };
})(typeof window !== 'undefined' ? window : globalThis);
