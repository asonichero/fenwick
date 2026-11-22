// Fenwick Hall — Thornleigh's great hall: the prologue's opening scene (docs/gdd.md, "Prologue: The True Bride"). Evening, a feast finished:
// a long table down the middle of the hall, the master's high-backed chair at its head (north), his son at his right and Cicely beside him;
// an archway in the wall at the master's left (east), onto a stone passage, where Adela comes in; a great stone hearth in the west wall,
// behind the son and Cicely; the house's arms hung behind the master's chair. 9 m by 14 m, stone walls over an oak wainscot, a flagged floor,
// an open timber roof.
//   The free-standing furniture (the table and all that's on it, the chairs, the cupboard, the candle stands, the bench, the rug) and two
// marks (where Silas stands before them; where Adela stands in the archway) are laid out by Hall.ROOM: its layout here, as { x, z, ry } on
// the floor (metres; ry in radians, the way it faces: 0 toward the foot of the hall, +z), any draft of it kept in this browser by the room
// editor (rooms.html). The walls, the hearth, the archway and the passage, the windows, the doors and the tapestry stay put.
//
//   const hall = Hall.build(scene) → { group, pieces: { key: { g, label } }, keys, place(key, at), layout(), spots(), views, bounds, sideOf,
//     sidesAt, resides(), showMarks(on), setLow(on), tick(dt) } · Hall.ROOM: { KEY, LAYOUT, layout(), saveLayout(L), resetLayout() }
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3, K = root.Kit;
const X0 = -4.5, X1 = 4.5, Z0 = -7, Z1 = 7, HT = 6.2, T = 0.5;      // the walls (west, east, north: the head of the hall, south), their height and thickness
const ARCH = { z: -4.5, w: 1.8, spring: 2.3 }, PX1 = X1 + T + 2.6, PH = 3.6;      // the archway (its middle, width, where its round head springs); the passage beyond (its far wall, its height)
const HEARTH = { z: -2.6, w: 3.4, open: 2.1, openH: 1.55, depth: 0.85 };      // the chimneypiece in the west wall: its middle, breadth, the fire's opening

// ── The layout (rooms.html moves these): defaults, with any draft kept in this browser laid over them ──
const LAYOUT = {
  table: { x: 0, z: -1.0, ry: 0 },
  rug: { x: 0, z: -1.0, ry: 0 },
  lordChair: { x: 0, z: -4.55, ry: 0 },
  sonChair: { x: -0.85, z: -3.25, ry: Math.PI / 2 },
  cicelyChair: { x: -0.85, z: -2.45, ry: Math.PI / 2 },
  chairE1: { x: 0.85, z: -1.4, ry: -Math.PI / 2 },
  chairE2: { x: 0.85, z: -0.6, ry: -Math.PI / 2 },
  cupboard: { x: 2.4, z: -6.45, ry: 0 },
  standW: { x: -1.7, z: -6.2, ry: 0 },
  standE: { x: 1.7, z: -6.2, ry: 0 },
  bench: { x: -2.6, z: 6.5, ry: Math.PI },
  silasMark: { x: 1.3, z: -3.0, ry: -Math.PI / 2 },
  adelaMark: { x: 4.35, z: -4.5, ry: -Math.PI / 2 },
};
const LABELS = { table: 'The long table (and the feast on it)', rug: 'The rug under it', lordChair: 'The master’s chair, at the head', sonChair: 'His son’s chair, at his right',
  cicelyChair: 'Cicely’s chair, beside him', chairE1: 'A chair across from them', chairE2: 'Another across from them', cupboard: 'The court cupboard', standW: 'A candle stand (west)',
  standE: 'A candle stand (east)', bench: 'The bench by the doors', silasMark: 'Where Silas stands before them (a mark)', adelaMark: 'Where Adela stands in the archway (a mark)' };
const KEY = 'fenwick:room:hall';
const ROOM = {
  KEY, LAYOUT,
  layout(o) { let saved = o; if (!saved) try { saved = JSON.parse((root.localStorage && root.localStorage.getItem(KEY)) || '{}'); } catch (e) { saved = {}; }
    const L = {}; for (const k in LAYOUT) L[k] = Object.assign({}, LAYOUT[k], saved && saved[k]); return L; },
  saveLayout(L) { try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) {} },
  resetLayout() { try { root.localStorage && root.localStorage.removeItem(KEY); } catch (e) {} },
};

// ── Its own textures: the flags, the arms on the tapestry ──
const flagsTex = () => K.canvasTex(512, 512, (c, w, h) => {
  c.fillStyle = '#5e564c'; c.fillRect(0, 0, w, h);
  const rows = [0, 150, 280, 420, 512];
  for (let r = 0; r < rows.length - 1; r++) {
    let x = -K.rnd() * 120;
    while (x < w) {
      const fw = 120 + K.rnd() * 110, y0 = rows[r], y1 = rows[r + 1], tone = 0.85 + K.rnd() * 0.3;
      c.fillStyle = `rgb(${Math.round(132 * tone)},${Math.round(122 * tone)},${Math.round(106 * tone)})`; c.fillRect(x + 3, y0 + 3, fw - 6, y1 - y0 - 6);
      K.speckle(c, w, h, 0, '#000', 0, 1); x += fw;
    }
  }
  K.speckle(c, w, h, 1600, '#2a241c', 0.08, 5); K.speckle(c, w, h, 900, '#d8d0c0', 0.05, 4);
}, [2.2, 3.4]);
const armsTex = () => K.canvasTex(256, 384, (c, w, h) => {
  c.fillStyle = '#1e3a2a'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { c.fillStyle = K.rnd() < 0.5 ? 'rgba(200,170,90,0.35)' : 'rgba(150,40,40,0.3)'; c.beginPath(); c.arc(K.rnd() * w, K.rnd() * h, 1.5 + K.rnd() * 2, 0, 7); c.fill(); }      // (a field of small flowers)
  c.strokeStyle = '#b89448'; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14); c.strokeStyle = '#6a1e22'; c.lineWidth = 4; c.strokeRect(18, 18, w - 36, h - 36);
  // (the shield: azure, a chevron or between three hawthorn sprigs vert on gold roundels: Thornleigh's)
  const sx = w / 2, sy = h * 0.45, sw = 120, sh = 150;
  c.beginPath(); c.moveTo(sx - sw / 2, sy - sh / 2); c.lineTo(sx + sw / 2, sy - sh / 2); c.lineTo(sx + sw / 2, sy + sh * 0.1); c.quadraticCurveTo(sx + sw / 2, sy + sh / 2, sx, sy + sh / 2 + 10); c.quadraticCurveTo(sx - sw / 2, sy + sh / 2, sx - sw / 2, sy + sh * 0.1); c.closePath();
  c.fillStyle = '#24407a'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#d4ae58'; c.stroke();
  c.save(); c.clip(); c.fillStyle = '#d4ae58'; c.beginPath(); c.moveTo(sx - sw / 2, sy + 30); c.lineTo(sx, sy - 18); c.lineTo(sx + sw / 2, sy + 30); c.lineTo(sx + sw / 2, sy + 52); c.lineTo(sx, sy + 4); c.lineTo(sx - sw / 2, sy + 52); c.closePath(); c.fill(); c.restore();
  for (const [x, y] of [[sx - 32, sy - 45], [sx + 32, sy - 45], [sx, sy + 52]]) { c.fillStyle = '#d4ae58'; c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill(); c.fillStyle = '#2e5a2a'; for (let k = 0; k < 5; k++) { const a = k * 1.256; c.beginPath(); c.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 0, 7); c.fill(); } }
  c.fillStyle = '#d4ae58'; c.font = 'italic 22px Georgia'; c.textAlign = 'center'; c.fillText('Fidelis', sx, h - 44);
});

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const std = o => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.75, metalness: 0.02 }, o)), { grain: 0.05, scale: 8 });
  const tex = (t, r) => { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(r[0], r[1]); return c; };
  // (materials: stone, oak and its dark, the flags, plaster, pewter, iron, gold, wax, linen, the cushions' velvet)
  const stoneM = std({ map: tex(K.stoneTex, [0.6, 0.6]), roughness: 0.92 }), stoneDressed = std({ map: tex(K.stoneTex, [1.2, 1.2]), color: srgb('#d8d0c2'), roughness: 0.85 });
  const panelM = std({ map: K.panelTex('#5e3e26', [1, 1]), roughness: 0.55 }), oak = std({ map: K.grain('#6a4428', [1, 1]), roughness: 0.5 }), oakDark = std({ map: K.grain('#3e2616', [1, 1]), roughness: 0.5 });
  const flagsM = std({ map: flagsTex(), roughness: 0.8 }), roofM = std({ map: K.boardsTex('#3a2a1e', [4, 6]), roughness: 0.8 }), beamM = std({ map: K.grain('#3a2618', [1, 1]), roughness: 0.6 });
  const pewter = std({ color: srgb('#9a9a96'), roughness: 0.35, metalness: 0.75 }), iron = std({ color: srgb('#26221e'), roughness: 0.5, metalness: 0.6 }), gold = std({ color: srgb('#c8a04a'), roughness: 0.3, metalness: 0.85 });
  const wax = std({ color: srgb('#efe6cc'), roughness: 0.6 }), linenM = std({ map: K.weave('#f0ead8', 'rgba(150,130,100,0.10)'), roughness: 0.95 }), velvet = std({ color: srgb('#6a1a22'), roughness: 0.9 });
  const flameM = new THREE.MeshStandardMaterial({ color: srgb('#ffd27a'), emissive: srgb('#ffb040'), emissiveIntensity: 4, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: srgb('#0e0b09'), roughness: 1 }), glassM = std({ map: K.windowTex(true), emissive: srgb('#1a2238'), emissiveIntensity: 0.4, roughness: 0.4 });
  const tapM = std({ map: armsTex(), roughness: 0.95 }), rugM = std({ map: K.rugTex(false), roughness: 0.95 });
  const box = (w, h, d, m, x, y, z, to, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; if (o && o.rx) b.rotation.x = o.rx; if (o && o.rz) b.rotation.z = o.rz; b.castShadow = !(o && o.noCast); b.receiveShadow = true; (to || G).add(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, to, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, (o && o.seg) || 14), m); c.position.set(x, y, z); if (o && o.rot) c.rotation.set(o.rot[0], o.rot[1], o.rot[2]); c.castShadow = !(o && o.noCast); c.receiveShadow = true; (to || G).add(c); return c; };
  const ball = (r, m, x, y, z, to, s) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m); b.position.set(x, y, z); if (s) b.scale.set(s[0], s[1], s[2]); b.castShadow = true; (to || G).add(b); return b; };
  const flames = [], candles = [];
  const candleLight = (x, y, z, to, i) => { const l = new THREE.PointLight(srgb('#ffc070'), i, 5, 2); l.position.set(x, y, z); to.add(l); candles.push({ l, i }); return l; };
  const flame = (x, y, z, to, s) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.012 * (s || 1), 0.045 * (s || 1), 8), flameM); f.position.set(x, y, z); (to || G).add(f); flames.push(f); return f; };

  // ── The shell: walls cut by their openings (extruded, so the openings have their depth), the wainscot, the floor, the roof ──
  const sides = { N: new THREE.Group(), S: new THREE.Group(), E: new THREE.Group(), W: new THREE.Group(), C: new THREE.Group() };
  for (const k in sides) G.add(sides[k]);
  // (a wall: its outline along it (u: from its left end, as seen from inside) and up, holes in it; set in place facing into the hall)
  function wall(len, holes, side, place) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, HT); s.lineTo(0, HT); s.closePath();
    for (const h of holes) s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }); const m = new THREE.Mesh(g, stoneM); m.castShadow = true; m.receiveShadow = true;
    place(m); sides[side].add(m); return m;
  }
  const rect = (u0, v0, u1, v1) => { const p = new THREE.Path(); p.moveTo(u0, v0); p.lineTo(u1, v0); p.lineTo(u1, v1); p.lineTo(u0, v1); p.closePath(); return p; };
  const arched = (u0, u1, spring) => { const p = new THREE.Path(), r = (u1 - u0) / 2; p.moveTo(u0, 0.001); p.lineTo(u1, 0.001); p.lineTo(u1, spring); p.absarc(u0 + r, spring, r, 0, Math.PI, false); p.lineTo(u0, 0.001); return p; };
  const winHole = u => { const p = new THREE.Path(); p.moveTo(u - 0.6, 1.7); p.lineTo(u + 0.6, 1.7); p.lineTo(u + 0.6, 4.1); p.absarc(u, 4.1, 0.6, 0, Math.PI, false); p.lineTo(u - 0.6, 1.7); return p; };      // (tall windows, round-headed, sill at 1.7)
  const window_ = (side, u, at, ry) => {      // (the glass set in the reveal, leaded, the evening dark beyond)
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.0), glassM); g.position.copy(at); g.rotation.y = ry; sides[side].add(g);
    const sill = box(1.3, 0.08, T * 0.6, stoneDressed, 0, 0, 0, sides[side]); sill.position.set(at.x, 1.66, at.z); sill.rotation.y = ry;
  };
  // north wall (the head of the hall: behind the master's chair), u along +x from the west end
  wall(X1 - X0 + 2 * T, [], 'N', m => { m.position.set(X0 - T, 0, Z0); m.rotation.y = 0; m.position.z = Z0 - T; });
  // south wall (the foot: the great doors and two windows), seen from inside u runs along −x: built from the east end
  wall(X1 - X0 + 2 * T, [rect(X1 + T - (0 + 1.1), 0.001, X1 + T - (0 - 1.1), 3.2), winHole(X1 + T - 2.8), winHole(X1 + T + 2.8)], 'S', m => { m.position.set(X1 + T, 0, Z1 + T); m.rotation.y = Math.PI; m.position.z = Z1 + T; });
  window_('S', 0, new V3(2.8, 3.2, Z1 + T * 0.5), Math.PI); window_('S', 0, new V3(-2.8, 3.2, Z1 + T * 0.5), Math.PI);
  { const d = new THREE.Group(); d.position.set(0, 0, Z1 + T * 0.55); sides.S.add(d);      // (the great doors, shut: two leaves of oak boards, iron strap hinges)
    for (const sx of [-1, 1]) { box(1.08, 3.15, 0.08, oakDark, sx * 0.555, 1.58, 0, d); for (const y of [0.5, 1.6, 2.7]) box(0.9, 0.05, 0.02, iron, sx * 0.6, y, -0.05, d); }
    box(0.04, 0.3, 0.04, iron, 0.08, 1.15, -0.07, d); box(0.04, 0.3, 0.04, iron, -0.08, 1.15, -0.07, d); }
  // east wall (the master's left): the archway near the head, two windows down the hall; u along −z from the north end
  wall(Z1 - Z0 + 2 * T, [arched(ARCH.z - Z0 + T - ARCH.w / 2, ARCH.z - Z0 + T + ARCH.w / 2, ARCH.spring), winHole(1 - Z0 + T), winHole(4.5 - Z0 + T)], 'E', m => { m.position.set(X1 + T, 0, Z0 - T); m.rotation.y = -Math.PI / 2; });
  window_('E', 0, new V3(X1 + T * 0.5, 3.2, 1), -Math.PI / 2); window_('E', 0, new V3(X1 + T * 0.5, 3.2, 4.5), -Math.PI / 2);
  // west wall (the hearth's): one window down the hall; u along +z from the south… built from the north end, facing in
  wall(Z1 - Z0 + 2 * T, [winHole(Z1 + T - 4.5)], 'W', m => { m.position.set(X0 - T, 0, Z1 + T); m.rotation.y = Math.PI / 2; });
  window_('W', 0, new V3(X0 - T * 0.5, 3.2, 4.5), Math.PI / 2);
  // (the wainscot: oak panelling to shoulder height round the hall, broken by the openings)
  const wains = (side, x0, z0, x1, z1, gaps) => {
    const len = Math.hypot(x1 - x0, z1 - z0), dir = new V3(x1 - x0, 0, z1 - z0).normalize(), n = new V3(-dir.z, 0, dir.x), ry = Math.atan2(n.x, n.z);
    let u = 0; const cuts = (gaps || []).slice().sort((a, b) => a[0] - b[0]).concat([[len, len]]);
    for (const [g0, g1] of cuts) { if (g0 > u + 0.05) { const w = g0 - u, c = new V3(x0, 0, z0).addScaledVector(dir, u + w / 2); box(w, 1.3, 0.05, panelM, c.x, 0.65, c.z, sides[side], { ry }); box(w, 0.06, 0.09, oakDark, c.x, 1.32, c.z, sides[side], { ry }); } u = Math.max(u, g1); }
  };
  wains('N', X0, Z0 + 0.03, X1, Z0 + 0.03);
  wains('S', X1, Z1 - 0.03, X0, Z1 - 0.03, [[X1 - 1.15, X1 + 1.15]]);
  wains('E', X1 - 0.03, Z0, X1 - 0.03, Z1, [[ARCH.z - Z0 - ARCH.w / 2 - 0.05, ARCH.z - Z0 + ARCH.w / 2 + 0.05]]);
  wains('W', X0 + 0.03, Z1, X0 + 0.03, Z0, [[Z1 - HEARTH.z - HEARTH.w / 2, Z1 - HEARTH.z + HEARTH.w / 2]]);
  // the floor; the roof: boards over the rafters, tie beams across with braces up to the walls
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), flagsM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; G.add(floor);
  { const c = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 2 * T, Z1 - Z0 + 2 * T), roofM); c.rotation.x = Math.PI / 2; c.position.y = HT; sides.C.add(c);
    for (let z = Z0 + 1.6; z < Z1 - 0.5; z += 2.6) { box(X1 - X0, 0.34, 0.3, beamM, 0, HT - 0.9, z, sides.C); for (const sx of [-1, 1]) box(0.22, 1.3, 0.22, beamM, sx * (X1 - 0.55), HT - 0.75, z, sides.C, { rz: sx * 0.75 }); } }

  // ── The hearth: a great stone chimneypiece standing out from the west wall: the fire's opening, its dark back, firedogs and logs, the fire;
  // a carved mantel, and the chimney breast up to the roof ──
  const hearth = new THREE.Group(); hearth.position.set(X0, 0, HEARTH.z); sides.W.add(hearth);
  { const { w, open: o, openH: oh, depth: dp } = HEARTH, out = 0.7;
    for (const sz of [-1, 1]) box((w - o) / 2, 2.0, out, stoneDressed, out / 2, 1.0, sz * (o / 2 + (w - o) / 4), hearth, { ry: Math.PI / 2 });      // (the jambs)
    box(out, 0.45, w, stoneDressed, out / 2, oh + 0.225, 0, hearth);       // (the lintel)
    box(out + 0.12, 0.12, w + 0.3, stoneDressed, out / 2 + 0.02, 2.05, 0, hearth);      // (the mantel shelf)
    box(0.5, HT - 2.1, w - 0.3, stoneM, 0.25, (HT + 2.1) / 2, 0, hearth);      // (the breast, up to the roof)
    box(0.06, 0.8, 0.7, stoneDressed, 0.52, 2.65, 0, hearth);      // (a carved panel over the mantel: the arms in stone)
    box(0.04, oh, o, dark, 0.02, oh / 2, 0, hearth, { noCast: true }); box(out, 0.04, o, dark, out / 2, oh - 0.02, 0, hearth, { noCast: true });      // (the fire's sooted back, and the underside of the lintel)
    box(out + 0.5, 0.04, o + 0.4, stoneDressed, (out + 0.5) / 2, 0.02, 0, hearth);      // (the hearthstone)
    for (const sz of [-1, 1]) { box(0.05, 0.5, 0.05, iron, out * 0.6, 0.25, sz * 0.5, hearth); box(0.5, 0.05, 0.05, iron, out * 0.35, 0.12, sz * 0.5, hearth); }      // (the firedogs)
    for (let i = 0; i < 3; i++) cyl(0.07, 0.08, 1.15, oakDark, out * 0.25 - i * 0.12, 0.16 + (i === 1 ? 0.1 : 0), (i - 1) * 0.06, hearth, { rot: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.07 + 0.03 * (i % 3), 0.45 + 0.2 * (i % 2), 8), flameM); f.position.set(out * 0.25 - 0.05 * (i % 2), 0.42, -0.45 + i * 0.15); hearth.add(f); flames.push(f); } }

  // ── The archway's passage: a flagged stone passage beyond the east wall, lit by a torch in a bracket, its far end dark ──
  const passage = new THREE.Group(); G.add(passage);
  { const pz0 = Z0 - 0.4, pz1 = 0.6, x0 = X1 + T, len = pz1 - pz0, mid = (pz0 + pz1) / 2;
    const pf = new THREE.Mesh(new THREE.PlaneGeometry(PX1 - x0, len), flagsM); pf.rotation.x = -Math.PI / 2; pf.position.set((x0 + PX1) / 2, 0.002, mid); pf.receiveShadow = true; passage.add(pf);
    box(T, PH, len, stoneM, PX1 + T / 2, PH / 2, mid, passage);      // (its far wall)
    box(PX1 - x0 + T, 0.3, len, stoneM, (x0 + PX1) / 2 + T / 2, PH + 0.15, mid, passage);      // (its ceiling)
    box(PX1 - x0, PH, T, stoneM, (x0 + PX1) / 2, PH / 2, pz1 + T / 2, passage); box(PX1 - x0, PH, T, dark, (x0 + PX1) / 2, PH / 2, pz0 - T / 2, passage, { noCast: true });      // (its ends: one wall, one dark way on)
    const tb = new THREE.Group(); tb.position.set(PX1 - 0.08, 1.9, ARCH.z + 0.3); passage.add(tb);
    box(0.06, 0.3, 0.06, iron, 0, 0, 0, tb); cyl(0.03, 0.02, 0.42, oakDark, -0.14, 0.12, 0, tb, { rot: [0, 0, 0.5] }); flame(-0.24, 0.36, 0, tb, 3.2); }

  // ── The arms behind the master's chair: a tapestry hung from a rod ──
  { const t = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), tapM); t.position.set(0, 3.35, Z0 + 0.06); sides.N.add(t); cyl(0.03, 0.03, 2.7, iron, 0, 5.18, Z0 + 0.08, sides.N, { rot: [0, 0, Math.PI / 2] }); }

  // ── The furniture, each where the layout puts it ──
  const L = ROOM.layout(), pieces = {}, place = (k, at) => { const p = pieces[k]; Object.assign(L[k], at); p.g.position.set(L[k].x, 0, L[k].z); p.g.rotation.y = L[k].ry || 0; p.g.updateMatrixWorld(true); };
  const piece = k => { const g = new THREE.Group(); g.userData.piece = k; G.add(g); pieces[k] = { g, label: LABELS[k] }; place(k, {}); return g; };
  const marks = [];
  // the long table: a refectory board on trestles, a linen cloth over it, and the feast finished on it
  { const g = piece('table'), TL = 6.0, TW = 1.1, TH = 0.76;
    box(TW, 0.07, TL, oak, 0, TH - 0.035, 0, g);
    for (const z of [-TL / 2 + 0.45, TL / 2 - 0.45, 0]) { box(0.1, TH - 0.12, 0.12, oakDark, 0, (TH - 0.12) / 2 + 0.05, z, g); box(TW - 0.15, 0.08, 0.14, oakDark, 0, 0.04, z, g); box(TW - 0.25, 0.06, 0.1, oakDark, 0, TH - 0.12, z, g); }
    box(0.08, 0.08, TL - 1.0, oakDark, 0, 0.3, 0, g);
    box(TW + 0.02, 0.006, TL - 0.2, linenM, 0, TH + 0.003, 0, g, { noCast: true }); for (const sx of [-1, 1]) box(0.006, 0.22, TL - 0.2, linenM, sx * (TW / 2 + 0.01), TH - 0.1, 0, g, { noCast: true });
    const top = TH + 0.006;
    // (a place, used: a pewter plate with scraps and a bone, a goblet, a knife, a crumpled napkin; the head of the table its own)
    const place_ = (x, z, ry, o) => { const p = new THREE.Group(); p.position.set(x, top, z); p.rotation.y = ry; g.add(p);
      cyl(0.13, 0.11, 0.014, pewter, 0, 0.007, 0, p, { seg: 20 }); ball(0.02, oakDark, 0.03, 0.02, 0.02, p, [1.4, 0.6, 1]); cyl(0.005, 0.006, 0.09, wax, -0.04, 0.02, -0.02, p, { rot: [Math.PI / 2, 0.6, 0] });
      const gl = new THREE.Group(); gl.position.set(0.14, 0, -0.12); p.add(gl); cyl(0.035, 0.02, 0.006, pewter, 0, 0.003, 0, gl); cyl(0.006, 0.006, 0.08, pewter, 0, 0.045, 0, gl); cyl(0.035, 0.02, 0.07, pewter, 0, 0.12, 0, gl);
      if (o && o.tipped) gl.rotation.z = Math.PI / 2 - 0.1, gl.position.y = 0.035;
      box(0.012, 0.004, 0.17, iron, -0.15, 0.003, 0, p); ball(0.045, linenM, 0.02, 0.025, 0.14, p, [1.3, 0.5, 1]); };
    place_(0, -TL / 2 + 0.28, Math.PI, {}); place_(-0.33, -2.25, -Math.PI / 2, {}); place_(-0.33, -1.45, -Math.PI / 2, { tipped: true }); place_(0.33, -0.4, Math.PI / 2, {}); place_(0.33, 0.4, Math.PI / 2, {});
    // (the roast: a carved fowl on a great pewter charger, its carcass and its legs; a half loaf on its board; a bowl of fruit; flagons; salt)
    cyl(0.26, 0.22, 0.02, pewter, 0, top + 0.01, -1.05, g, { seg: 24 }); ball(0.12, std({ color: srgb('#8a4a22'), roughness: 0.55 }), 0, top + 0.07, -1.05, g, [1, 0.6, 1.4]);
    for (let i = 0; i < 4; i++) cyl(0.008, 0.008, 0.12, wax, -0.04 + i * 0.027, top + 0.12, -1.05, g, { rot: [0.3, 0, 0] });
    for (const sx of [-1, 1]) { ball(0.04, std({ color: srgb('#7a3e1a') }), sx * 0.16, top + 0.04, -0.9, g, [1, 0.8, 1.6]); }
    box(0.34, 0.025, 0.24, oak, 0.15, top + 0.012, -0.2, g); ball(0.08, std({ color: srgb('#b8844a'), roughness: 0.8 }), 0.15, top + 0.07, -0.2, g, [1.3, 0.75, 1]);
    cyl(0.16, 0.08, 0.08, pewter, -0.1, top + 0.04, 0.55, g, { seg: 20 });
    for (let i = 0; i < 6; i++) ball(0.035, std({ color: srgb(i % 2 ? '#a82a22' : '#7a9a3a'), roughness: 0.5 }), -0.1 + Math.cos(i) * 0.06, top + 0.09 + (i > 3 ? 0.03 : 0), 0.55 + Math.sin(i) * 0.06, g);
    for (let i = 0; i < 14; i++) ball(0.011, std({ color: srgb('#4a1e3a'), roughness: 0.4 }), -0.04 + (i % 4) * 0.018, top + 0.06 + Math.floor(i / 4) * 0.015, 0.62 + (i % 3) * 0.012, g);
    for (const [x, z] of [[0.28, -1.95], [-0.2, 0.05]]) { cyl(0.05, 0.065, 0.24, pewter, x, top + 0.12, z, g); cyl(0.025, 0.05, 0.05, pewter, x, top + 0.265, z, g); box(0.02, 0.12, 0.04, pewter, x + 0.07, top + 0.15, z, g); }
    cyl(0.03, 0.04, 0.05, pewter, 0.05, top + 0.025, -1.6, g);
    // (two candelabra, three branches each, the candles burned down)
    for (const z of [-2.0, 0.95]) { const c = new THREE.Group(); c.position.set(0, top, z); g.add(c);
      cyl(0.08, 0.1, 0.03, pewter, 0, 0.015, 0, c); cyl(0.015, 0.015, 0.32, pewter, 0, 0.17, 0, c); box(0.36, 0.02, 0.02, pewter, 0, 0.3, 0, c);
      for (const x of [-0.17, 0, 0.17]) { cyl(0.03, 0.025, 0.03, pewter, x, x ? 0.32 : 0.34, 0, c); const h = 0.07 + Math.abs(x) * 0.2; cyl(0.014, 0.014, h, wax, x, (x ? 0.335 : 0.355) + h / 2, 0, c); flame(x, (x ? 0.335 : 0.355) + h + 0.02, 0, c); }
      candleLight(0, 0.5, 0, c, 1.6); }
  }
  // the rug under it
  { const g = piece('rug'); const r = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 7.4), rugM); r.rotation.x = -Math.PI / 2; r.position.y = 0.004; r.receiveShadow = true; g.add(r); }
  // the chairs: the master's, high-backed and carved, its arms and a velvet cushion; the others with lower backs (all facing +z)
  const chair = (k, high) => { const g = piece(k), w = high ? 0.56 : 0.46, d = high ? 0.5 : 0.44, sh = 0.44;
    box(w, 0.05, d, oak, 0, sh, 0, g); box(w - 0.06, 0.05, d - 0.06, velvet, 0, sh + 0.045, 0.01, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.025, 0.028, sh, oakDark, sx * (w / 2 - 0.03), sh / 2, sz * (d / 2 - 0.03), g);
    const bh = high ? 1.5 : 1.05;
    for (const sx of [-1, 1]) cyl(0.03, 0.032, bh, oakDark, sx * (w / 2 - 0.03), bh / 2, -d / 2 + 0.03, g);
    box(w - 0.06, high ? 0.9 : 0.45, 0.035, oak, 0, high ? sh + 0.55 : sh + 0.38, -d / 2 + 0.03, g);
    box(w + 0.02, 0.07, 0.06, oakDark, 0, bh, -d / 2 + 0.03, g);
    if (high) { const crest = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.05, 24, 1, false, -Math.PI / 2, Math.PI), oakDark); crest.rotation.x = -Math.PI / 2; crest.position.set(0, bh + 0.03, -d / 2 + 0.03); crest.castShadow = true; g.add(crest);
      for (const sx of [-1, 1]) { box(0.06, 0.05, d, oakDark, sx * (w / 2 + 0.01), sh + 0.27, 0.0, g); cyl(0.025, 0.025, 0.27, oakDark, sx * (w / 2 + 0.01), sh + 0.13, d / 2 - 0.04, g); } }
    return g; };
  chair('lordChair', true); chair('sonChair'); chair('cicelyChair'); chair('chairE1'); chair('chairE2');
  // the court cupboard against the head wall: two tiers of oak, pewter dishes stood along its top, a ewer
  { const g = piece('cupboard'); box(1.4, 0.05, 0.5, oak, 0, 1.18, 0, g); box(1.4, 0.05, 0.5, oak, 0, 0.62, 0, g); box(1.36, 0.5, 0.46, oakDark, 0, 0.88, 0, g); box(1.36, 0.05, 0.46, oak, 0, 0.08, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.035, 0.04, 1.16, oakDark, sx * 0.66, 0.6, sz * 0.21, g);
    for (let i = 0; i < 5; i++) { const p = cyl(0.14, 0.14, 0.012, pewter, -0.5 + i * 0.25, 1.33, -0.17, g, { seg: 20, rot: [1.35, 0, 0] }); void p; }
    cyl(0.05, 0.07, 0.24, pewter, 0.45, 1.32, 0.08, g); }
  // the candle stands either side of the master's place: iron, on three feet, a fat candle on each pricket
  for (const k of ['standW', 'standE']) { const g = piece(k);
    for (let i = 0; i < 3; i++) { const a = i * 2.094; box(0.04, 0.03, 0.3, iron, Math.sin(a) * 0.13, 0.03, Math.cos(a) * 0.13, g, { ry: a }); }
    cyl(0.02, 0.025, 1.55, iron, 0, 0.8, 0, g); cyl(0.12, 0.09, 0.03, iron, 0, 1.58, 0, g); cyl(0.045, 0.045, 0.24, wax, 0, 1.71, 0, g); flame(0, 1.85, 0, g, 1.6); candleLight(0, 1.95, 0, g, 1.1); }
  // the bench by the great doors
  { const g = piece('bench'); box(1.8, 0.06, 0.36, oak, 0, 0.45, 0, g); for (const sx of [-1, 1]) box(0.06, 0.42, 0.32, oakDark, sx * 0.75, 0.21, 0, g); box(1.5, 0.05, 0.04, oakDark, 0, 0.2, 0, g); }
  // the marks (seen only in the room editor): a ring on the floor, an arrow the way they face
  for (const k of ['silasMark', 'adelaMark']) { const g = piece(k), m = new THREE.MeshBasicMaterial({ color: k === 'silasMark' ? 0x6ad0ff : 0xffc86a, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 32), m); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; g.add(ring);
    const ar = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 3), m); ar.rotation.x = Math.PI / 2; ar.position.set(0, 0.012, 0.36); g.add(ar); marks.push(g); g.visible = false; }

  // ── Light: evening. The fire, the candles on the table and the stands, the torch in the passage; a warm key from high over the table
  // for the shadows, the windows dark blue ──
  const hemi = new THREE.HemisphereLight(srgb('#c0b098'), srgb('#2a2018'), 0.75); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#3a3028'), 0.45); G.add(amb);
  const key = new THREE.SpotLight(srgb('#ffd8a8'), 28, 16, 0.9, 0.85, 2); key.position.set(-1.2, HT - 0.4, -1.5); key.target.position.set(0, 0, -2.2);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.camera.near = 0.5; key.shadow.camera.far = 12; G.add(key); G.add(key.target);
  const fireL = new THREE.PointLight(srgb('#ff9a4a'), 6, 9, 2); fireL.position.set(X0 + 1.2, 0.6, HEARTH.z); G.add(fireL);
  const torch = new THREE.PointLight(srgb('#ff9050'), 1.8, 6, 2); torch.position.set(PX1 - 0.4, 2.2, ARCH.z + 0.3); G.add(torch);
  const winL = new THREE.PointLight(srgb('#4a5a8a'), 0.3, 6, 2); winL.position.set(0, 3, Z1 - 1); G.add(winL);

  // ── Which side each thing goes with (hidden with it while the camera's out beyond it), the furniture by where it stands now ──
  const bounds = { minX: X0, maxX: X1, minZ: Z0, maxZ: Z1, ht: HT };
  const sideOf = new Map();
  const resides = () => {
    sideOf.clear(); for (const k of ['N', 'S', 'E', 'W', 'C']) sideOf.set(sides[k], k); sideOf.set(passage, 'E');
    const REACH = 0.75, bx = new THREE.Box3(), c = new V3();
    for (const k in pieces) { if (/Mark$/.test(k)) continue; const g = pieces[k].g; bx.setFromObject(g); if (bx.isEmpty()) continue; bx.getCenter(c);
      const d = { N: c.z - Z0, S: Z1 - c.z, W: c.x - X0, E: X1 - c.x }; let best = null; for (const s in d) if (d[s] < REACH && (!best || d[s] < d[best])) best = s; if (best) sideOf.set(g, best); }
  };
  resides();
  const IN = 0.45;
  const inPassage = p => p.x > X1 + T - 0.05 && p.x < PX1 && p.z > Z0 - 0.4 && p.z < 0.6 && p.y < PH;      // (looking in through the archway: its wall stays)
  const sidesAt = p => { const s = new Set(); if (p.z < Z0 + IN) s.add('N'); if (p.z > Z1 - IN) s.add('S'); if (p.x < X0 + IN) s.add('W'); if (p.x > X1 - IN && !inPassage(p)) s.add('E'); if (p.y > HT - 0.3) s.add('C'); return s; };

  // ── Where the scene's people are: each seat (from its chair as it stands), Silas's mark and Adela's ──
  const spots = () => {
    const seat = k => { const p = pieces[k].g; return { at: new V3(0, 0, 0.04).applyMatrix4(p.matrixWorld), yaw: L[k].ry || 0, seatY: 0.49 }; };
    const mark = k => ({ at: new V3(L[k].x, 0, L[k].z), yaw: L[k].ry || 0 });
    return { master: seat('lordChair'), son: seat('sonChair'), cicely: seat('cicelyChair'), silas: mark('silasMark'), adela: mark('adelaMark') };
  };
  const views = {
    'From the foot': [[0, 2.3, 6.4], [0, 1.0, -3.2]], 'Corner': [[6.8, 8.5, 9.5], [0, 0.6, -1.5]], 'From above': [[0, 21, 0.02], [0, 0, 0]],
    'From the archway': [[X1 - 0.5, 1.65, ARCH.z + 0.4], [-1.5, 1.0, -3.2]], 'From the passage': [[X1 + T + 1.9, 1.65, ARCH.z + 0.1], [X0, 1.15, ARCH.z + 0.9]],
    'From the hearth': [[X0 + 1.4, 1.7, HEARTH.z + 1.2], [1.2, 1.0, -3.6]], 'Behind his chair': [[0.35, 2.05, -6.4], [0, 0.85, 0.5]], 'Over Silas’s shoulder': [[2.45, 1.95, -2.2], [-1.0, 0.9, -3.0]],
  };
  let low = false, t = 0;
  const setLow = on => { low = !!on; key.castShadow = !low; };
  return { group: G, pieces, keys: Object.keys(LAYOUT), place, layout: () => JSON.parse(JSON.stringify(L)), spots, views, bounds, sideOf, sidesAt, resides, name: 'The great hall at Thornleigh',
    showMarks: on => { for (const m of marks) m.visible = !!on; }, setLow, key,
    tick(dt) { t += dt; const k = 0.82 + 0.12 * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 13.1 + 1.3) + 0.05 * Math.sin(t * 23.7);
      fireL.intensity = 6 * k; torch.intensity = 1.8 * (0.9 + 0.1 * Math.sin(t * 9.1)); candles.forEach((c, i) => { c.l.intensity = c.i * (0.93 + 0.07 * Math.sin(t * (8 + i) + i)); }); flames.forEach((f, i) => { f.scale.y = 0.85 + 0.25 * Math.sin(t * (6 + i % 5) + i * 1.7); }); } };
}

root.Hall = { build, ROOM, LAYOUT, LABELS };
})(typeof window !== 'undefined' ? window : globalThis);
