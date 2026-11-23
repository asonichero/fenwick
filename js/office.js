// Fenwick Hall — Silas's office at Thornleigh: the estate office off the yard, where the prologue's confrontation, its correction and the
// aftercare are played (docs/gdd.md, "Prologue: The True Bride"). The same evening. A working room: limewashed walls over a dark skirting, a
// boarded floor, a beamed ceiling; his desk out from the north wall with his chair behind it (sturdy, armless: the correction's), ledgers on
// shelves behind him, the estate's map on the wall, a board of keys by the door; a small fire in the west wall, a window onto the dark yard in
// the east; the door in the south wall, which shuts.
//   The furniture and the marks (where Cicely stands before the desk; where Silas shuts the door; where he stands before her) are laid out by
// Office.ROOM, as the hall's are (rooms.html arranges them). The walls, the door, the window and the fireplace stay put.
//
//   const office = Office.build(scene) → { group, pieces, keys, place(key, at), layout(), spots(), views, bounds, sideOf, sidesAt, resides(),
//     showMarks(on), setLow(on), door: { set(k), to(k, ms) → Promise, get k }, setChair('out' | 'desk'), bay() (for js/session.js), tick(dt) }
//   · Office.ROOM, Office.LAYOUT, Office.LABELS
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3, K = root.Kit;
const X0 = -2.5, X1 = 2.5, Z0 = -2.6, Z1 = 2.2, HT = 2.85, T = 0.35;      // the walls (west, east, north: behind the desk, south: the door's), height, thickness
const DOOR = { x: 1.3, w: 0.95, h: 2.05, open: 1.35 };      // in the south wall: its middle, width, height; how far it swings in, open (radians)
const WIN = { z: -0.5, w: 0.9, sill: 0.95, h: 1.15 };      // in the east wall, onto the yard
const FIRE = { z: 0.55, w: 1.3, open: 0.72, openH: 0.7 };      // the fireplace in the west wall

const LAYOUT = {
  desk: { x: 0.75, z: -1.2, ry: 0 },
  chair: { x: 0.75, z: -1.95, ry: 0 },
  shelves: { x: -1.45, z: -2.42, ry: 0 },
  chest: { x: 0.25, z: 1.95, ry: -Math.PI },
  sideChair: { x: -2.1, z: 1.55, ry: Math.PI / 2 },
  rug: { x: 0.75, z: -0.25, ry: 0 },
  settle: { x: -2.17, z: -1.2, ry: Math.PI / 2 },
  cicelyMark: { x: 0.75, z: -0.25, ry: Math.PI },
  doorMark: { x: 1.2, z: 1.6, ry: 0 },
  nearMark: { x: 1.3, z: -0.5, ry: -1.03 },
  chairOutMark: { x: -0.7, z: 0.25, ry: Math.PI / 2 },
};
const LABELS = { desk: 'His desk (and the ledgers on it)', chair: 'His chair, behind it', shelves: 'The shelves of ledgers', chest: 'The strongbox', sideChair: 'A chair by the fire',
  rug: 'The rag rug', settle: 'The settle (the aftercare’s seat)', chairOutMark: 'Where his chair goes for the correction (a mark)', cicelyMark: 'Where Cicely stands before the desk (a mark)', doorMark: 'Where Silas shuts the door (a mark)', nearMark: 'Where Silas stands before her (a mark)' };
const KEY = 'fenwick:room:office';
const ROOM = {
  KEY, LAYOUT,
  layout(o) { let saved = o; if (!saved) try { saved = JSON.parse((root.localStorage && root.localStorage.getItem(KEY)) || '{}'); } catch (e) { saved = {}; }
    const L = {}; for (const k in LAYOUT) L[k] = Object.assign({}, LAYOUT[k], saved && saved[k]); return L; },
  saveLayout(L) { try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) {} },
  resetLayout() { try { root.localStorage && root.localStorage.removeItem(KEY); } catch (e) {} },
};

// ── Its own textures: the estate's map, ledger spines ──
const mapTex = () => K.canvasTex(384, 256, (c, w, h) => {
  c.fillStyle = '#d8c9a0'; c.fillRect(0, 0, w, h); K.speckle(c, w, h, 500, '#8a7448', 0.08, 4);
  // (fields in their strips, the river, the woods, the house and its yard; a compass rose; a title cartouche)
  for (let i = 0; i < 26; i++) { c.strokeStyle = 'rgba(90,70,40,0.5)'; c.lineWidth = 1; const x = 20 + K.rnd() * (w - 60), y = 30 + K.rnd() * (h - 70); c.strokeRect(x, y, 26 + K.rnd() * 40, 14 + K.rnd() * 20); }
  c.strokeStyle = '#5a7a9a'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, h * 0.7); c.bezierCurveTo(w * 0.3, h * 0.5, w * 0.5, h * 0.95, w, h * 0.6); c.stroke();
  for (let i = 0; i < 90; i++) { c.fillStyle = 'rgba(60,90,50,0.55)'; c.beginPath(); c.arc(w * 0.62 + K.rnd() * w * 0.32, 20 + K.rnd() * h * 0.35, 4 + K.rnd() * 3, 0, 7); c.fill(); }
  c.fillStyle = '#7a3a2a'; c.fillRect(w * 0.38, h * 0.3, 22, 14); c.fillRect(w * 0.38 + 26, h * 0.32, 10, 10);
  c.strokeStyle = '#4a3a22'; c.lineWidth = 3; c.strokeRect(6, 6, w - 12, h - 12);
  c.fillStyle = '#efe4c0'; c.fillRect(w * 0.06, h * 0.78, 110, 34); c.strokeStyle = '#4a3a22'; c.lineWidth = 1.5; c.strokeRect(w * 0.06, h * 0.78, 110, 34);
  c.fillStyle = '#3a2a18'; c.font = 'italic 13px Georgia'; c.fillText('Thornleigh', w * 0.06 + 18, h * 0.78 + 22);
  c.strokeStyle = '#3a2a18'; c.lineWidth = 1.5; const cx = w - 40, cy = h - 40; c.beginPath(); c.moveTo(cx, cy - 22); c.lineTo(cx, cy + 22); c.moveTo(cx - 22, cy); c.lineTo(cx + 22, cy); c.stroke();
});

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const std = o => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.75, metalness: 0.02 }, o)), { grain: 0.05, scale: 8 });
  const tex = (t, r) => { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(r[0], r[1]); return c; };
  const plasterM = std({ map: K.plasterTex('#d6cab0', [1.5, 1]), roughness: 0.95 }), boardsM = std({ map: K.boardsTex('#6a4a30', [2.5, 2.5]), roughness: 0.7 });
  const oak = std({ map: K.grain('#6a4428', [1, 1]), roughness: 0.5 }), oakDark = std({ map: K.grain('#3e2616', [1, 1]), roughness: 0.5 }), beamM = std({ map: K.grain('#3a2618', [1, 1]), roughness: 0.6 });
  const stoneM = std({ map: tex(K.stoneTex, [0.8, 0.8]), roughness: 0.9 }), iron = std({ color: srgb('#26221e'), roughness: 0.5, metalness: 0.6 }), brass = std({ color: srgb('#b8944a'), roughness: 0.35, metalness: 0.8 });
  const pewter = std({ color: srgb('#9a9a96'), roughness: 0.35, metalness: 0.75 }), wax = std({ color: srgb('#efe6cc'), roughness: 0.6 }), paper = std({ color: srgb('#e8dcc0'), roughness: 0.9 });
  const leathers = ['#5a2a1a', '#3a2a1e', '#6a4a2a', '#2a3a2a', '#4a1e1e', '#5a4a30'].map(c => std({ color: srgb(c), roughness: 0.7 }));
  const flameM = new THREE.MeshStandardMaterial({ color: srgb('#ffd27a'), emissive: srgb('#ffb040'), emissiveIntensity: 4, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: srgb('#0e0b09'), roughness: 1 }), glassM = std({ map: K.windowTex(true), emissive: srgb('#1a2238'), emissiveIntensity: 0.45, roughness: 0.4 });
  const mapM = std({ map: mapTex(), roughness: 0.9 }), rugM = std({ map: K.rugTex(true), roughness: 0.95 }), wool = std({ color: srgb('#4a3a2a'), roughness: 0.95, side: THREE.DoubleSide });
  const box = (w, h, d, m, x, y, z, to, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; if (o && o.rx) b.rotation.x = o.rx; if (o && o.rz) b.rotation.z = o.rz; b.castShadow = !(o && o.noCast); b.receiveShadow = true; if (o && o.noCloth) b.userData.noCloth = true; (to || G).add(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, to, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, (o && o.seg) || 14), m); c.position.set(x, y, z); if (o && o.rot) c.rotation.set(o.rot[0], o.rot[1], o.rot[2]); c.castShadow = !(o && o.noCast); c.receiveShadow = true; (to || G).add(c); return c; };
  const ball = (r, m, x, y, z, to, s) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m); b.position.set(x, y, z); if (s) b.scale.set(s[0], s[1], s[2]); b.castShadow = true; (to || G).add(b); return b; };
  const flames = [];
  const flame = (x, y, z, to, s) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.012 * (s || 1), 0.045 * (s || 1), 8), flameM); f.position.set(x, y, z); (to || G).add(f); flames.push(f); return f; };

  // ── The shell: walls cut by their openings, a dark skirting, the floor, the beamed ceiling ──
  const sides = { N: new THREE.Group(), S: new THREE.Group(), E: new THREE.Group(), W: new THREE.Group(), C: new THREE.Group() };
  for (const k in sides) G.add(sides[k]);
  function wall(len, holes, side, place) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, HT); s.lineTo(0, HT); s.closePath();
    for (const h of holes) s.holes.push(h);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }), plasterM); m.castShadow = true; m.receiveShadow = true;
    place(m); sides[side].add(m); return m;
  }
  const rect = (u0, v0, u1, v1) => { const p = new THREE.Path(); p.moveTo(u0, v0); p.lineTo(u1, v0); p.lineTo(u1, v1); p.lineTo(u0, v1); p.closePath(); return p; };
  wall(X1 - X0 + 2 * T, [], 'N', m => { m.position.set(X0 - T, 0, Z0 - T); });
  // (south: the door; seen from inside, u runs along −x from the east end)
  wall(X1 - X0 + 2 * T, [rect(X1 + T - (DOOR.x + DOOR.w / 2), 0.001, X1 + T - (DOOR.x - DOOR.w / 2), DOOR.h)], 'S', m => { m.position.set(X1 + T, 0, Z1 + T); m.rotation.y = Math.PI; });
  // (east: the window onto the yard; u along −z from the north end)
  wall(Z1 - Z0 + 2 * T, [rect(WIN.z - Z0 + T - WIN.w / 2, WIN.sill, WIN.z - Z0 + T + WIN.w / 2, WIN.sill + WIN.h)], 'E', m => { m.position.set(X1 + T, 0, Z0 - T); m.rotation.y = -Math.PI / 2; });
  wall(Z1 - Z0 + 2 * T, [], 'W', m => { m.position.set(X0 - T, 0, Z1 + T); m.rotation.y = Math.PI / 2; });
  // (the window: small leaded panes, the yard dark beyond, a deep sill; shutters folded back)
  { const g = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, WIN.h), glassM); g.position.set(X1 + T * 0.6, WIN.sill + WIN.h / 2, WIN.z); g.rotation.y = -Math.PI / 2; sides.E.add(g);
    box(0.32, 0.05, WIN.w + 0.1, oakDark, X1 - 0.02, WIN.sill - 0.02, WIN.z, sides.E);
    for (const sz of [-1, 1]) box(0.03, WIN.h, WIN.w / 2, oakDark, X1 - 0.05, WIN.sill + WIN.h / 2, WIN.z + sz * (WIN.w / 2 + WIN.w / 4 + 0.02), sides.E, { ry: sz * 0.25 }); }
  // (the skirting, dark, round the room, broken by the door and the fireplace)
  const skirt = (side, x0, z0, x1, z1, gaps) => {
    const len = Math.hypot(x1 - x0, z1 - z0), dir = new V3(x1 - x0, 0, z1 - z0).normalize(), n = new V3(-dir.z, 0, dir.x), ry = Math.atan2(n.x, n.z);
    let u = 0; for (const [g0, g1] of (gaps || []).concat([[len, len]])) { if (g0 > u + 0.05) { const w = g0 - u, c = new V3(x0, 0, z0).addScaledVector(dir, u + w / 2); box(w, 0.18, 0.025, oakDark, c.x, 0.09, c.z, sides[side], { ry }); } u = Math.max(u, g1); }
  };
  skirt('N', X0, Z0 + 0.013, X1, Z0 + 0.013); skirt('S', X1, Z1 - 0.013, X0, Z1 - 0.013, [[X1 - DOOR.x - DOOR.w / 2, X1 - DOOR.x + DOOR.w / 2]]);
  skirt('E', X1 - 0.013, Z0, X1 - 0.013, Z1); skirt('W', X0 + 0.013, Z1, X0 + 0.013, Z0, [[Z1 - FIRE.z - FIRE.w / 2, Z1 - FIRE.z + FIRE.w / 2]]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), boardsM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; G.add(floor);
  { const c = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 2 * T, Z1 - Z0 + 2 * T), plasterM); c.rotation.x = Math.PI / 2; c.position.y = HT; sides.C.add(c);
    box(X1 - X0, 0.26, 0.24, beamM, 0, HT - 0.13, (Z0 + Z1) / 2, sides.C);      // (the summer beam, across)
    for (let x = X0 + 0.45; x < X1; x += 0.6) box(0.1, 0.12, Z1 - Z0, beamM, x, HT - 0.06, (Z0 + Z1) / 2, sides.C); }      // (the joists)

  // ── The door: plank, ledged, an iron latch; hung on its east side, swinging in. Shut by default; the scene opens and shuts it ──
  const door = { k: 0, from: 0, target: 0, t: 0, ms: 0, done: null };
  const leaf = new THREE.Group(); leaf.position.set(DOOR.x + DOOR.w / 2 - 0.02, 0, Z1 - 0.06); sides.S.add(leaf);
  { const w = DOOR.w - 0.04; box(w, DOOR.h - 0.02, 0.05, oakDark, -w / 2, (DOOR.h - 0.02) / 2, 0, leaf);
    for (const y of [0.35, 1.0, 1.7]) box(w - 0.06, 0.1, 0.03, oak, -w / 2, y, -0.04, leaf);
    for (const y of [0.35, 1.7]) box(0.42, 0.035, 0.012, iron, -0.2, y, -0.06, leaf);
    box(0.16, 0.03, 0.02, iron, -w + 0.12, 1.05, -0.065, leaf); cyl(0.018, 0.018, 0.05, iron, -w + 0.06, 1.05, -0.08, leaf, { rot: [Math.PI / 2, 0, 0] }); }
  // (the frame round it)
  box(0.08, DOOR.h + 0.06, 0.1, oakDark, DOOR.x - DOOR.w / 2 - 0.02, (DOOR.h + 0.06) / 2, Z1 - 0.03, sides.S); box(0.08, DOOR.h + 0.06, 0.1, oakDark, DOOR.x + DOOR.w / 2 + 0.02, (DOOR.h + 0.06) / 2, Z1 - 0.03, sides.S);
  box(DOOR.w + 0.12, 0.1, 0.1, oakDark, DOOR.x, DOOR.h + 0.03, Z1 - 0.03, sides.S);
  { const out = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w, DOOR.h), dark); out.position.set(DOOR.x, DOOR.h / 2, Z1 + T - 0.02); out.rotation.y = Math.PI; sides.S.add(out); }      // (the yard beyond, dark)
  const setDoor = k => { door.k = k; leaf.rotation.y = -DOOR.open * k; leaf.updateMatrixWorld(true); };
  door.set = k => { door.done = null; door.ms = 0; setDoor(k); };
  door.to = (k, ms) => new Promise(res => { if (!ms) { setDoor(k); res(); return; } Object.assign(door, { from: door.k, target: k, t: 0, ms, done: res }); });

  // ── The fireplace in the west wall: a plain stone surround, a fire basket, the fire, a fender ──
  const fp = new THREE.Group(); fp.position.set(X0, 0, FIRE.z); sides.W.add(fp);
  { const { w, open: o, openH: oh } = FIRE, out = 0.32;
    for (const sz of [-1, 1]) box(out, 1.15, (w - o) / 2, stoneM, out / 2, 0.575, sz * (o / 2 + (w - o) / 4), fp);
    box(out, 0.45, w, stoneM, out / 2, oh + 0.225, 0, fp); box(out + 0.08, 0.07, w + 0.14, oakDark, out / 2 + 0.02, 1.19, 0, fp);
    box(0.03, oh, o, dark, 0.02, oh / 2, 0, fp, { noCast: true }); box(out, 0.03, o, dark, out / 2, oh - 0.015, 0, fp, { noCast: true });
    box(out + 0.3, 0.03, w, stoneM, (out + 0.3) / 2, 0.015, 0, fp);
    box(0.22, 0.12, o * 0.7, iron, out * 0.45, 0.14, 0, fp); for (let i = 0; i < 3; i++) cyl(0.04, 0.045, o * 0.6, oakDark, out * 0.45 - 0.04 + i * 0.04, 0.24 + (i === 1 ? 0.04 : 0), 0, fp, { rot: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.05 + 0.02 * (i % 2), 0.22 + 0.1 * (i % 2), 8), flameM); f.position.set(out * 0.45, 0.36, -0.2 + i * 0.1); fp.add(f); flames.push(f); }
    box(0.03, 0.12, w * 0.8, brass, out + 0.28, 0.06, 0, fp);      // (the fender)
    cyl(0.008, 0.008, 0.7, iron, out + 0.1, 0.4, w / 2 + 0.05, fp, { rot: [0, 0, 0.15] }); }      // (a poker, leant)
  // ── On the walls: the estate's map over the desk; the board of keys by the door; a peg with his coat ──
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), mapM); m.position.set(0.75, 1.75, Z0 + 0.02); sides.N.add(m); box(0.96, 0.66, 0.02, oakDark, 0.75, 1.75, Z0 + 0.008, sides.N, { noCast: true }); }
  { const kb = new THREE.Group(); kb.position.set(0.35, 1.45, Z1 - 0.02); sides.S.add(kb); box(0.5, 0.3, 0.025, oak, 0, 0, 0, kb);
    for (let i = 0; i < 6; i++) { const x = -0.2 + i * 0.08; cyl(0.006, 0.006, 0.04, iron, x, 0.06, -0.03, kb, { rot: [Math.PI / 2, 0, 0] }); cyl(0.012, 0.012, 0.005, iron, x, 0.0, -0.035, kb, { rot: [Math.PI / 2, 0, 0] }); box(0.008, 0.07, 0.004, iron, x, -0.05, -0.035, kb); } }
  { const pg = new THREE.Group(); pg.position.set(-0.6, 1.65, Z1 - 0.02); sides.S.add(pg); cyl(0.012, 0.012, 0.1, oakDark, 0, 0, -0.05, pg, { rot: [Math.PI / 2, 0, 0] });
    // (his coat, hung by its collar: shoulders, a body widening to the skirts, the sleeves at its sides)
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.24, 0.95, 16, 1, true), wool); coat.scale.z = 0.42; coat.position.set(0, -0.5, -0.11); coat.castShadow = true; pg.add(coat);
    ball(0.15, wool, 0, -0.06, -0.11, pg, [1.15, 0.45, 0.5]); for (const sx of [-1, 1]) cyl(0.04, 0.05, 0.62, wool, sx * 0.17, -0.38, -0.1, pg, { rot: [0, 0, sx * 0.08] }); }

  // ── The furniture, each where the layout puts it ──
  const L = ROOM.layout(), pieces = {}, place = (k, at) => { const p = pieces[k]; Object.assign(L[k], at); p.g.position.set(L[k].x, 0, L[k].z); p.g.rotation.y = L[k].ry || 0; p.g.updateMatrixWorld(true); };
  const piece = k => { const g = new THREE.Group(); g.userData.piece = k; G.add(g); pieces[k] = { g, label: LABELS[k] }; place(k, {}); return g; };
  const marks = [];
  // his desk: a plain oak writing table, its drawers on his side (north) either side of the knee-hole; on it, his ledgers, an open one, the
  // inkstand and quill, papers, a sand box, a candlestick burning
  const DW = 1.5, DD = 0.8, DH = 0.76; let deskLight = null;
  { const g = piece('desk');
    box(DW, 0.05, DD, oak, 0, DH - 0.025, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.03, 0.035, DH - 0.05, oakDark, sx * (DW / 2 - 0.05), (DH - 0.05) / 2, sz * (DD / 2 - 0.05), g);
    box(DW - 0.08, 0.14, 0.03, oakDark, 0, DH - 0.12, DD / 2 - 0.05, g);      // (the apron, the front: her side)
    for (const sx of [-1, 1]) { box(0.42, 0.18, DD - 0.12, oakDark, sx * (DW / 2 - 0.27), DH - 0.14, 0, g); box(0.36, 0.13, 0.02, oak, sx * (DW / 2 - 0.27), DH - 0.14, -DD / 2 + 0.05, g); cyl(0.012, 0.012, 0.02, brass, sx * (DW / 2 - 0.27), DH - 0.14, -DD / 2 + 0.03, g, { rot: [Math.PI / 2, 0, 0] }); }
    const top = DH;
    // (an open ledger before his place; a stack of shut ones at the east corner; loose papers; the inkstand, quill, sand box; a candlestick at the
    // west end, away from where he gets up)
    const lg = new THREE.Group(); lg.position.set(-0.05, top, -0.08); g.add(lg);
    box(0.25, 0.03, 0.34, leathers[0], -0.13, 0.015, 0, lg, { rz: 0.05 }); box(0.25, 0.03, 0.34, leathers[0], 0.13, 0.015, 0, lg, { rz: -0.05 }); box(0.23, 0.012, 0.31, paper, -0.12, 0.034, 0, lg, { rz: 0.05 }); box(0.23, 0.012, 0.31, paper, 0.12, 0.034, 0, lg, { rz: -0.05 });
    for (let i = 0; i < 4; i++) box(0.26, 0.05, 0.36, leathers[1 + i], 0.52, top + 0.025 + i * 0.052, -0.12 + (i % 2) * 0.02, g, { ry: (i % 2 ? 0.05 : -0.04) });
    for (let i = 0; i < 3; i++) box(0.2, 0.003, 0.28, paper, -0.42 - i * 0.03, top + 0.002 + i * 0.003, 0.08 - i * 0.02, g, { ry: 0.2 * i - 0.1, noCast: true });
    const ink = new THREE.Group(); ink.position.set(0.22, top, -0.24); g.add(ink); box(0.2, 0.02, 0.12, brass, 0, 0.01, 0, ink); cyl(0.025, 0.028, 0.05, iron, -0.05, 0.045, 0, ink); cyl(0.022, 0.025, 0.04, pewter, 0.05, 0.04, 0, ink);
    box(0.004, 0.003, 0.22, paper, -0.05, 0.14, 0.02, ink, { rx: 1.0, ry: 0.3 });
    const cs = new THREE.Group(); cs.position.set(-0.6, top, -0.24); g.add(cs); cyl(0.06, 0.07, 0.015, pewter, 0, 0.008, 0, cs); cyl(0.012, 0.015, 0.14, pewter, 0, 0.08, 0, cs); cyl(0.025, 0.02, 0.025, pewter, 0, 0.16, 0, cs);
    cyl(0.013, 0.013, 0.12, wax, 0, 0.23, 0, cs); flame(0, 0.31, 0, cs, 1.3);
    deskLight = new THREE.PointLight(srgb('#ffc070'), 1.3, 5, 2); deskLight.position.set(0, 0.42, 0); cs.add(deskLight); }
  // his chair: plain, sturdy, armless, a ladder back (it's across his knee here, later)
  { const g = piece('chair'), w = 0.48, d = 0.46, sh = 0.46;
    box(w, 0.045, d, oak, 0, sh, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.024, 0.027, sh, oakDark, sx * (w / 2 - 0.03), sh / 2, sz * (d / 2 - 0.03), g);
    for (const sx of [-1, 1]) cyl(0.026, 0.028, 1.02, oakDark, sx * (w / 2 - 0.03), 0.51, -d / 2 + 0.03, g);
    for (const y of [0.66, 0.8, 0.94]) box(w - 0.06, 0.06, 0.025, oak, 0, y, -d / 2 + 0.03, g);
    for (const sz of [-1, 1]) box(w - 0.06, 0.025, 0.025, oakDark, 0, 0.16, sz * (d / 2 - 0.03), g); }
  // the shelves behind him: ledgers in their leathers, bundles of papers tied with tape, rolled plans
  { const g = piece('shelves'), w = 1.4, h = 2.05, d = 0.32;
    for (const sx of [-1, 1]) box(0.04, h, d, oakDark, sx * (w / 2 - 0.02), h / 2, 0, g);
    for (let i = 0; i < 5; i++) box(w - 0.04, 0.035, d, oak, 0, 0.08 + i * 0.48, 0, g);
    box(w, 0.04, d, oakDark, 0, h, 0, g); box(w - 0.04, h, 0.02, oakDark, 0, h / 2, -d / 2 + 0.01, g, { noCast: true });
    for (let s = 0; s < 4; s++) { let x = -w / 2 + 0.06; const y0 = 0.1 + s * 0.48;
      while (x < w / 2 - 0.1) { const bw = 0.04 + K.rnd() * 0.05, bh = 0.26 + K.rnd() * 0.12;
        if (K.rnd() < 0.12) { box(0.22, 0.08, 0.2, paper, x + 0.11, y0 + 0.04, 0.02, g); box(0.02, 0.085, 0.205, leathers[0], x + 0.11, y0 + 0.04, 0.02, g); x += 0.26; continue; }
        box(bw, bh, 0.24, leathers[Math.floor(K.rnd() * leathers.length)], x + bw / 2, y0 + bh / 2, 0.02, g); x += bw + 0.004; } }
    for (let i = 0; i < 3; i++) cyl(0.035, 0.035, 0.5, paper, -0.3 + i * 0.09, 2.1, 0.0, g, { rot: [0, 0, Math.PI / 2] }); }
  // the strongbox: iron-bound oak, on the floor by the east wall
  { const g = piece('chest'); box(0.7, 0.42, 0.42, oakDark, 0, 0.21, 0, g); for (const x of [-0.25, 0, 0.25]) box(0.04, 0.44, 0.44, iron, x, 0.21, 0, g); box(0.08, 0.1, 0.02, iron, 0, 0.3, 0.22, g); }
  // a plain chair by the fire
  { const g = piece('sideChair'); box(0.42, 0.04, 0.4, oak, 0, 0.44, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.02, 0.022, 0.44, oakDark, sx * 0.18, 0.22, sz * 0.17, g);
    for (const sx of [-1, 1]) cyl(0.022, 0.024, 0.95, oakDark, sx * 0.18, 0.475, -0.17, g); box(0.36, 0.2, 0.02, oak, 0, 0.8, -0.17, g); }
  // the settle along the west wall: a high-backed oak bench for two, a cushion along it (the aftercare's)
  { const g = piece('settle'), w = 1.3, d = 0.48, sh = 0.44;
    box(w, 0.05, d, oak, 0, sh, 0, g); box(w - 0.08, 0.06, d - 0.08, std({ color: srgb('#5a2a22'), roughness: 0.9 }), 0, sh + 0.05, 0.01, g);
    for (const sx of [-1, 1]) { box(0.06, 1.15, d, oakDark, sx * (w / 2 - 0.03), 0.575, 0, g); box(0.06, 0.06, d + 0.02, oakDark, sx * (w / 2 - 0.03), 0.7, 0.02, g); }
    box(w - 0.06, 0.72, 0.04, oak, 0, sh + 0.42, -d / 2 + 0.03, g); box(w, 0.06, 0.08, oakDark, 0, 1.15, -d / 2 + 0.03, g); box(w - 0.08, 0.18, 0.03, oakDark, 0, 0.18, d / 2 - 0.04, g); }
  // a rag rug before the desk
  { const g = piece('rug'); const r = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), rugM); r.rotation.x = -Math.PI / 2; r.position.y = 0.004; r.receiveShadow = true; g.add(r); }
  // the marks (only in the room editor)
  for (const k of ['cicelyMark', 'doorMark', 'nearMark', 'chairOutMark']) { const g = piece(k), m = new THREE.MeshBasicMaterial({ color: k === 'cicelyMark' ? 0xffc86a : k === 'chairOutMark' ? 0xc89aff : 0x6ad0ff, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 32), m); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; g.add(ring);
    const ar = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 3), m); ar.rotation.x = Math.PI / 2; ar.position.set(0, 0.012, 0.36); g.add(ar); marks.push(g); g.visible = false; }

  // ── Light: the evening. The candle on the desk and the fire, warm; the window cold; a key from high in front of the desk for the shadows ──
  const hemi = new THREE.HemisphereLight(srgb('#c0b098'), srgb('#2a2018'), 0.6); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#3a3028'), 0.4); G.add(amb);
  const key = new THREE.SpotLight(srgb('#ffd8a8'), 14, 9, 0.95, 0.85, 2); key.position.set(0.8, HT - 0.15, 0.6); key.target.position.set(-0.2, 0, -1.0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.camera.near = 0.3; key.shadow.camera.far = 8; G.add(key); G.add(key.target);
  const fireL = new THREE.PointLight(srgb('#ff9a4a'), 3.2, 6, 2); fireL.position.set(X0 + 0.7, 0.5, FIRE.z); G.add(fireL);
  const winL = new THREE.PointLight(srgb('#4a5a8a'), 0.35, 4, 2); winL.position.set(X1 - 0.6, 1.6, WIN.z); G.add(winL);

  // ── Which side each thing goes with, for hiding the walls nearest the camera ──
  const bounds = { minX: X0, maxX: X1, minZ: Z0, maxZ: Z1, ht: HT };
  const sideOf = new Map();
  const resides = () => {
    sideOf.clear(); for (const k of ['N', 'S', 'E', 'W', 'C']) sideOf.set(sides[k], k);
    const REACH = 0.6, bx = new THREE.Box3(), c = new V3();
    for (const k in pieces) { if (/Mark$/.test(k)) continue; const g = pieces[k].g; bx.setFromObject(g); if (bx.isEmpty()) continue; bx.getCenter(c);
      const d = { N: c.z - Z0, S: Z1 - c.z, W: c.x - X0, E: X1 - c.x }; let best = null; for (const s in d) if (d[s] < REACH && (!best || d[s] < d[best])) best = s; if (best) sideOf.set(g, best); }
  };
  resides();
  const IN = 0.3;
  const sidesAt = p => { const s = new Set(); if (p.z < Z0 + IN) s.add('N'); if (p.z > Z1 - IN) s.add('S'); if (p.x < X0 + IN) s.add('W'); if (p.x > X1 - IN) s.add('E'); if (p.y > HT - 0.2) s.add('C'); return s; };

  // ── Where the scene's people are: his chair (and its side, where he sits down from and gets up to), Cicely's mark, the door's, where he
  // stands before her, and the way round the desk's east end (beside it, and off its corners, front and back) ──
  const spots = () => {
    const at = (k, x, z) => new V3(x, 0, z).applyMatrix4(pieces[k].g.matrixWorld).setY(0);
    const mark = k => ({ at: new V3(L[k].x, 0, L[k].z), yaw: L[k].ry || 0 });
    const cr = L.chair.ry || 0;
    return { silas: { at: at('chair', 0, 0.04), yaw: cr, seatY: 0.49 }, chairSide: { at: at('chair', 0.55, 0.02), yaw: cr - Math.PI / 2 },
      deskEast: { at: at('desk', DW / 2 + 0.42, 0), yaw: L.desk.ry || 0 }, deskNE: { at: at('desk', DW / 2 + 0.36, -DD / 2 - 0.32), yaw: L.desk.ry || 0 }, deskSE: { at: at('desk', DW / 2 + 0.32, DD / 2 + 0.3), yaw: L.desk.ry || 0 },
      cicely: mark('cicelyMark'), door: mark('doorMark'), near: mark('nearMark') };
  };
  const views = {
    'From the door': [[DOOR.x - 0.75, 1.65, Z1 - 0.45], [-0.2, 0.95, -1.5]], 'Behind the desk': [[-0.9, 1.75, Z0 + 0.35], [0.4, 0.95, 0.8]],
    'Corner': [[X1 - 0.3, 2.4, Z1 - 0.3], [-0.6, 0.6, -1.0]], 'From above': [[0, 13, 0.02], [0, 0, -0.2]], 'From the fire': [[X0 + 0.45, 1.6, 0.2], [1.2, 0.9, -0.9]],
    'Before the desk': [[0.25, 1.55, 1.35], [0, 1.0, -1.6]],
  };
  // ── The correction: his chair pulled out from the desk into the room (its mark), and back; and the room as the correction engine wants it ──
  let chairOut = false;
  const setChair = where => { chairOut = where === 'out'; const k = chairOut ? 'chairOutMark' : 'chair', g = pieces.chair.g; g.position.set(L[k].x, 0, L[k].z); g.rotation.y = L[k].ry || 0; g.updateMatrixWorld(true); resides(); };
  const bay = () => {
    const at = (k, x, z) => new V3(x, 0, z).applyMatrix4(pieces[k].g.matrixWorld).setY(0), sy = L.settle.ry || 0;
    return { group: G, private: true, bounds, sideOf, sidesAt, spots: {
      bench: { at: new V3(L.chairOutMark.x, 0, L.chairOutMark.z), yaw: L.chairOutMark.ry || 0, turn: 0, seatY: 0.49 },
      // (Silas at the settle's south end, she beside him at his left, toward the north: his left arm round her, as the engine sits them)
      after: { at: at('settle', -0.3, 0.06), yaw: sy, seatY: 0.49, beside: at('settle', 0.3, 0.06) },
      wall: { at: at('desk', 0, DD / 2 + 0.85), yaw: (L.desk.ry || 0) + Math.PI, support: { kind: 'edge', y: DH + 0.01, d: 0.85, bend: 0.95, lines: 'writing' } },
      watch: [], corner: { at: new V3(X1 - 0.4, 0, Z1 - 0.6), yaw: Math.PI } } };
  };
  let t = 0;
  const setLow = on => { key.castShadow = !on; };
  return { group: G, pieces, keys: Object.keys(LAYOUT), place, layout: () => JSON.parse(JSON.stringify(L)), spots, views, bounds, sideOf, sidesAt, resides, name: 'Silas’s office at Thornleigh',
    showMarks: on => { for (const m of marks) m.visible = !!on; }, setLow, key, door, setChair, bay, get chairOut() { return chairOut; },
    tick(dt) { t += dt;
      if (door.ms) { door.t += dt * 1000; const k = Math.min(1, door.t / door.ms), e = k * k * (3 - 2 * k); setDoor(door.from + (door.target - door.from) * e); if (k >= 1) { door.ms = 0; const d = door.done; door.done = null; if (d) d(); } }
      const f = 0.85 + 0.1 * Math.sin(t * 7.1) + 0.06 * Math.sin(t * 12.7 + 1.1); fireL.intensity = 3.2 * f; deskLight.intensity = 1.3 * (0.95 + 0.05 * Math.sin(t * 9.3));
      flames.forEach((fl, i) => { fl.scale.y = 0.85 + 0.25 * Math.sin(t * (6 + i % 5) + i * 1.7); }); } };
}

root.Office = { build, ROOM, LAYOUT, LABELS };
})(typeof window !== 'undefined' ? window : globalThis);
