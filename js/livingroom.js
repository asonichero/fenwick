// Fenwick Hall — an open-plan living room (the room editor's own: a modern flat, made from photographs, to arrange in rooms.html). One long
// room, 7.5 m by 3.9 m, the ceiling at 2.4 m, downlights in it: the living end, with a window over a radiator in its end wall; along one long
// wall the TV, the console, the shelves and a chest of drawers, a second window with the armchair before it, then the kitchen; along the
// other, the corner sofa (its chaise along the end wall), two floor lamps, the desk with its two monitors, and the door out to the hall,
// standing open. At the far end, the kitchen: dark wood-grain units in an L under a white worktop, a dark mosaic splashback, the sink and the
// washing machine on the long wall, the hob and oven under a chimney hood on the end wall, the tall unit, the wall cupboards; the kettle, the
// toaster, the air fryer, the slow cooker and the microwave out on the worktop.
//   Its furniture only, and what's plugged in: nothing that's lying about. The walls, the windows and their curtains, the radiator, the door
// and the kitchen stay put; the rest is laid out by LivingRoom.ROOM (rooms.html arranges it, as it does the hall's and the office's).
//   Its axes: x across (the desk wall at −x, west; the TV wall at +x, east), z along (the window end at −z, north; the kitchen at +z, south).
//
//   const lr = LivingRoom.build(scene) → { group, pieces, keys, place(key, at), layout(), spots(), views, bounds, sideOf, sidesAt, resides(),
//     showMarks(on), setLow(on), tick(dt), name }  ·  LivingRoom.ROOM, LivingRoom.LAYOUT, LivingRoom.LABELS
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3, K = root.Kit;
const X0 = -1.95, X1 = 1.95, Z0 = -3.75, Z1 = 3.75, HT = 2.4, T = 0.2;      // the walls (desk wall, TV wall, window end, kitchen end), height, thickness
const WIN_N = { x: -0.15, w: 1.05, sill: 0.8, h: 1.15 };      // in the end wall, over the radiator
const WIN_E = { z: 0.81, w: 1.2, sill: 0.95, h: 1.1 };      // in the TV wall, the armchair before it
const DOOR = { z0: 0.45, z1: 1.3, h: 2.02 };      // in the desk wall: out to the hall
const KIT = { e: 2.0, d: 0.6, top: 0.92 };      // the kitchen: where its run along the TV wall begins (z), the units' depth, the worktop

const LAYOUT = {
  sofa: { x: -0.87, z: -2.4, ry: 0 },
  coffeeTable: { x: -0.3, z: -2.0, ry: 0 },
  rug: { x: -0.2, z: -1.65, ry: 0 },
  lampCorner: { x: -1.74, z: -3.54, ry: 0 },
  lampDesk: { x: -1.74, z: -1.08, ry: 0 },
  desk: { x: -1.6, z: -0.3, ry: Math.PI / 2 },
  deskChair: { x: -0.95, z: -0.25, ry: -Math.PI / 2 },
  amp: { x: -1.72, z: 0.1, ry: Math.PI / 2 },
  beanbags: { x: 1.48, z: -3.25, ry: -0.6 },
  fan: { x: 0.86, z: -3.47, ry: 0 },
  shelves: { x: 1.775, z: -2.33, ry: -Math.PI / 2 },
  tvStand: { x: 1.72, z: -1.2, ry: -Math.PI / 2 },
  drawers: { x: 1.73, z: -0.18, ry: -Math.PI / 2 },
  armchair: { x: 1.32, z: 0.9, ry: -Math.PI / 2 },
  bin: { x: 1.74, z: 1.79, ry: -Math.PI / 2 },
};
const LABELS = { sofa: 'The corner sofa (its chaise along the end wall)', coffeeTable: 'The coffee table', rug: 'The rug', lampCorner: 'The floor lamp in the corner (with its reading arm)',
  lampDesk: 'The floor lamp by the desk', desk: 'The desk (its monitors, keyboard and lamp)', deskChair: 'The desk chair', amp: 'The amp, under the desk',
  beanbags: 'The bean bags', fan: 'The tower fan', shelves: 'The shelf unit', tvStand: 'The TV stand (the TV and the console)', drawers: 'The chest of drawers (and the lava lamp)',
  armchair: 'The armchair', bin: 'The kitchen bin' };
const KEY = 'fenwick:room:living';
const ROOM = {
  KEY, LAYOUT,
  layout(o) { let saved = o; if (!saved) try { saved = JSON.parse((root.localStorage && root.localStorage.getItem(KEY)) || '{}'); } catch (e) { saved = {}; }
    const L = {}; for (const k in LAYOUT) L[k] = Object.assign({}, LAYOUT[k], saved && saved[k]); return L; },
  saveLayout(L) { try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) {} },
  resetLayout() { try { root.localStorage && root.localStorage.removeItem(KEY); } catch (e) {} },
};

// ── Its own textures: the laminate, the paint, the splashback's mosaic, corded fabric, the curtains' print, the screens ──
const laminateTex = () => K.canvasTex(512, 512, (c, w, h) => {
  // (four planks across, each its own pale grey-oak, their ends staggered; a fine grain running their length)
  const pw = w / 4;
  for (let i = 0; i < 4; i++) {
    let y = -K.rnd() * 300;
    while (y < h) { const len = 260 + K.rnd() * 200, l = 72 + K.rnd() * 14, tone = `hsl(${30 + K.rnd() * 8}, ${10 + K.rnd() * 6}%, ${l}%)`;
      c.fillStyle = tone; c.fillRect(i * pw, y, pw, len);
      for (let g = 0; g < 26; g++) { c.strokeStyle = `rgba(${K.rnd() < 0.6 ? '110,95,80' : '235,228,218'},${0.08 + K.rnd() * 0.12})`; c.lineWidth = 0.6 + K.rnd() * 1.6; const x = i * pw + 4 + K.rnd() * (pw - 8);
        c.beginPath(); c.moveTo(x, y); let xx = x; for (let yy = y; yy < y + len; yy += 24) { xx += (K.rnd() - 0.5) * 1.6; c.lineTo(xx, yy); } c.stroke(); }
      c.fillStyle = 'rgba(70,60,50,0.35)'; c.fillRect(i * pw, y, pw, 1.5); y += len; }
    c.fillStyle = 'rgba(70,60,50,0.3)'; c.fillRect(i * pw, 0, 1.5, h);
  }
});
const paintTex = col => K.canvasTex(256, 256, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); K.speckle(c, w, h, 500, '#6a5e52', 0.025, 3); K.speckle(c, w, h, 400, '#fffaf2', 0.03, 3); });
const mosaicTex = () => K.canvasTex(256, 256, (c, w, h) => {
  // (narrow strip tiles in rows, black to slate, some with a sheen; dark grout)
  c.fillStyle = '#141414'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) { let x = -K.rnd() * 40;
    while (x < w) { const len = 22 + K.rnd() * 58, l = 12 + K.rnd() * 22; c.fillStyle = `hsl(210, 4%, ${l}%)`; c.fillRect(x + 1, y + 1.5, len - 2, 13);
      if (K.rnd() < 0.3) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x + 1, y + 1.5, len - 2, 4); } x += len; } }
});
const cordTex = (col, dark, rep) => K.canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = col; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) { const g = c.createLinearGradient(x, 0, x + 8, 0); g.addColorStop(0, dark); g.addColorStop(0.5, 'rgba(255,255,255,0.08)'); g.addColorStop(1, dark); c.fillStyle = g; c.fillRect(x, 0, 8, h); }
  K.speckle(c, w, h, 200, '#000', 0.08, 1.4);
}, rep || [6, 3]);
const floralTex = () => K.canvasTex(256, 512, (c, w, h) => {
  // (grey cotton printed with pale leaves and blooms, drawn in line)
  c.fillStyle = '#6e6f72'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { const x = K.rnd() * w, y = K.rnd() * h, r = 8 + K.rnd() * 22;
    c.strokeStyle = `rgba(225,225,220,${0.35 + K.rnd() * 0.3})`; c.lineWidth = 1 + K.rnd() * 1.2;
    if (K.rnd() < 0.5) { for (let p = 0; p < 6; p++) { const a = p / 6 * Math.PI * 2; c.beginPath(); c.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.45, r * 0.22, a, 0, 7); c.stroke(); } }
    else { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + r, y - r * 1.4, x + r * 0.2, y - r * 2.4); c.stroke(); c.beginPath(); c.ellipse(x + r * 0.5, y - r, r * 0.5, r * 0.2, -0.9, 0, 7); c.stroke(); } }
});
const plainCurtainTex = () => K.canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#8c8d90'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 2) { c.fillStyle = `rgba(0,0,0,${0.02 + K.rnd() * 0.04})`; c.fillRect(x, 0, 1, h); } });
// (a screen on: the desktop's picture, a city of teal towers under a dusk of pink and amber, and a strip of taskbar)
const screenTex = () => K.canvasTex(512, 288, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d6a0a8'); g.addColorStop(0.35, '#7fb6b8'); g.addColorStop(1, '#1e5a62'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { const x = K.rnd() * w, bw = 10 + K.rnd() * 40, bh = 30 + K.rnd() * h * 0.8; c.fillStyle = `hsl(${178 + K.rnd() * 20}, ${30 + K.rnd() * 30}%, ${18 + K.rnd() * 26}%)`; c.fillRect(x, h - bh, bw, bh);
    c.fillStyle = 'rgba(255,200,140,0.55)'; for (let j = 0; j < 6; j++) c.fillRect(x + K.rnd() * bw, h - K.rnd() * bh, 2, 2); }
  c.fillStyle = 'rgba(10,20,24,0.85)'; c.fillRect(0, h - 10, w, 10);
});
// (a fine, quiet grain: black-stained ash, the kitchen's dark wood-grain fronts, oak veneer)
const fineGrain = (base, light, dark, n) => K.canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  for (let i = 0; i < (n || 70); i++) { c.strokeStyle = K.rnd() < 0.5 ? light : dark; c.globalAlpha = 0.25 + K.rnd() * 0.5; c.lineWidth = 0.5 + K.rnd() * 1.3; c.beginPath(); let y = K.rnd() * h; c.moveTo(0, y); for (let x = 0; x <= w; x += 12) { y += (K.rnd() - 0.5) * 1.2; c.lineTo(x, y); } c.stroke(); }
  c.globalAlpha = 1;
});
const nightTex = () => K.canvasTex(128, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0c1220'); g.addColorStop(1, '#1a1f28'); c.fillStyle = g; c.fillRect(0, 0, w, h); });

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const std = (o, grain) => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.02 }, o)), { grain: grain == null ? 0.02 : grain, scale: 8 });
  const tex = (t, r) => { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(r[0], r[1]); return c; };
  // (the shell: greige paint, white woodwork, the pale laminate, a white ceiling)
  const wallM = std({ map: paintTex('#d6ccc1'), roughness: 0.92 }), ceilM = std({ color: srgb('#eeebe6'), roughness: 0.95 }), whiteM = std({ color: srgb('#f2f0ec'), roughness: 0.45 });
  const floorM = std({ map: (t => { t.repeat.set((X1 - X0) / 0.76, (Z1 - Z0) / 2.4); return t; })(laminateTex()), roughness: 0.55 });
  // (the kitchen: dark wood-grain fronts, the white worktop, the mosaic, steel)
  const unitM = std({ map: fineGrain('#3e332c', '#5a4b40', '#2a221d', 90), roughness: 0.5 }), carcM = std({ color: srgb('#2a2420'), roughness: 0.7 }), topM = std({ color: srgb('#f1efeb'), roughness: 0.3 });
  const tileM = std({ map: (t => { t.repeat.set(4, 1); return t; })(mosaicTex()), roughness: 0.35 }), steel = std({ color: srgb('#b9bcbf'), roughness: 0.32, metalness: 0.55 }), chrome = std({ color: srgb('#d4d6d8'), roughness: 0.2, metalness: 0.75 });
  const glassBlk = std({ color: srgb('#0c0c0e'), roughness: 0.12, metalness: 0.1 }), plasticBlk = std({ color: srgb('#1b1b1d'), roughness: 0.45 }), plasticWht = std({ color: srgb('#ecebe8'), roughness: 0.4 });
  // (the furniture's own: black-stained wood, black metal, oak, fabrics)
  const blackWood = std({ map: fineGrain('#1c1b1a', '#34312e', '#0e0d0c', 60), roughness: 0.55 }), blackMetal = std({ color: srgb('#161616'), roughness: 0.45, metalness: 0.5 }), oakM = std({ map: fineGrain('#b98446', '#d2a066', '#8a5a2a', 50), roughness: 0.5 });
  const pineM = std({ map: fineGrain('#c99358', '#e0b07a', '#9a6a36', 50), roughness: 0.55 }), sofaM = std({ map: K.weave('#4a4c50', '#3e4044', [6, 6]), roughness: 0.95 }), cordGrey = std({ map: cordTex('#55575b', 'rgba(20,20,24,0.4)'), roughness: 0.95 });
  const leatherBlk = std({ color: srgb('#18181a'), roughness: 0.38 }), cordBlue = std({ map: cordTex('#22a6c0', 'rgba(10,70,90,0.35)', [8, 4]), roughness: 0.95 }), fabricBlue = std({ map: K.weave('#3e5a74', '#34506a', [8, 8]), roughness: 0.95 });
  const rugM = std({ map: K.weave('#2c2e31', '#36383b', [10, 14]), roughness: 1 }), fringeM = std({ color: srgb('#d8d0c0'), roughness: 1, side: THREE.DoubleSide });
  const redMat = std({ color: srgb('#8a1c1e'), roughness: 0.8 }), oakDoor = std({ map: (t => { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.repeat.set(1, 2); return t; })(fineGrain('#b9803e', '#d09a58', '#8e5a26', 80)), roughness: 0.45 }), champagne = std({ color: srgb('#cdb89a'), roughness: 0.3, metalness: 0.6 });
  const screenM = new THREE.MeshStandardMaterial({ map: screenTex(), emissive: srgb('#ffffff'), emissiveMap: null, emissiveIntensity: 0, roughness: 0.3 });
  screenM.emissiveMap = screenM.map; screenM.emissiveIntensity = 1.1; screenM.emissive = srgb('#ffffff');
  const tvOff = std({ color: srgb('#0a0a0c'), roughness: 0.08, metalness: 0.2 }), shadeM = new THREE.MeshStandardMaterial({ color: srgb('#f4ece0'), emissive: srgb('#ffd8a0'), emissiveIntensity: 0.75, roughness: 0.9, side: THREE.DoubleSide });
  const downM = new THREE.MeshBasicMaterial({ color: srgb('#fffaf0') }), nightM = new THREE.MeshStandardMaterial({ map: nightTex(), emissive: srgb('#1a2230'), emissiveIntensity: 0.4, roughness: 0.1 });
  const lavaGlass = new THREE.MeshStandardMaterial({ color: srgb('#2a8acb'), emissive: srgb('#1a70b8'), emissiveIntensity: 1.4, roughness: 0.15, transparent: true, opacity: 0.85 });
  const lavaWax = new THREE.MeshStandardMaterial({ color: srgb('#8ae8ff'), emissive: srgb('#6ad8ff'), emissiveIntensity: 1.6, roughness: 0.4 });

  const box = (w, h, d, m, x, y, z, to, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; if (o && o.rx) b.rotation.x = o.rx; if (o && o.rz) b.rotation.z = o.rz; b.castShadow = !(o && o.noCast); b.receiveShadow = true; (to || G).add(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, to, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, (o && o.seg) || 18), m); c.position.set(x, y, z); if (o && o.rot) c.rotation.set(o.rot[0], o.rot[1], o.rot[2]); c.castShadow = !(o && o.noCast); c.receiveShadow = true; (to || G).add(c); return c; };
  const ball = (r, m, x, y, z, to, s) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); b.position.set(x, y, z); if (s) b.scale.set(s[0], s[1], s[2]); b.castShadow = true; b.receiveShadow = true; (to || G).add(b); return b; };
  // (a box with its edges and corners rounded: cushions, arms, the bean bags' covers)
  const rbox = (w, h, d, r, m, x, y, z, to, o) => {
    r = Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002); const iw = w / 2 - r, ih = h / 2 - r, s = new THREE.Shape(), q = r * 0.6;
    s.moveTo(-iw, -ih - 0.0001); s.lineTo(iw, -ih - 0.0001); s.lineTo(iw + 0.0001, ih); s.lineTo(-iw - 0.0001, ih); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 4, curveSegments: 6 }); g.translate(0, 0, -(d - 2 * r) / 2);
    const b = new THREE.Mesh(g, m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; if (o && o.rx) b.rotation.x = o.rx; if (o && o.rz) b.rotation.z = o.rz; b.castShadow = true; b.receiveShadow = true; (to || G).add(b); void q; return b; };

  // ── The shell: the walls cut by the windows and the doorway, white skirting, the floor, the ceiling and its downlights ──
  const sides = { N: new THREE.Group(), S: new THREE.Group(), E: new THREE.Group(), W: new THREE.Group(), C: new THREE.Group() };
  for (const k in sides) G.add(sides[k]);
  const rect = (u0, v0, u1, v1) => { const p = new THREE.Path(); p.moveTo(u0, v0); p.lineTo(u1, v0); p.lineTo(u1, v1); p.lineTo(u0, v1); p.closePath(); return p; };
  function wall(len, holes, side, place) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, HT); s.lineTo(0, HT); s.closePath(); for (const h of holes) s.holes.push(h);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }), wallM); m.castShadow = true; m.receiveShadow = true; place(m); sides[side].add(m); return m;
  }
  const uN = x => x - (X0 - T), uE = z => z - (Z0 - T), uW = z => (Z1 + T) - z;
  wall(X1 - X0 + 2 * T, [rect(uN(WIN_N.x - WIN_N.w / 2), WIN_N.sill, uN(WIN_N.x + WIN_N.w / 2), WIN_N.sill + WIN_N.h)], 'N', m => { m.position.set(X0 - T, 0, Z0 - T); });
  wall(X1 - X0 + 2 * T, [], 'S', m => { m.position.set(X1 + T, 0, Z1 + T); m.rotation.y = Math.PI; });
  wall(Z1 - Z0 + 2 * T, [rect(uE(WIN_E.z - WIN_E.w / 2), WIN_E.sill, uE(WIN_E.z + WIN_E.w / 2), WIN_E.sill + WIN_E.h)], 'E', m => { m.position.set(X1 + T, 0, Z0 - T); m.rotation.y = -Math.PI / 2; });
  wall(Z1 - Z0 + 2 * T, [rect(uW(DOOR.z1), 0.001, uW(DOOR.z0), DOOR.h)], 'W', m => { m.position.set(X0 - T, 0, Z1 + T); m.rotation.y = Math.PI / 2; });
  // (skirting: plain white, round the room, broken by the doorway; none behind the kitchen's units)
  box(X1 - X0, 0.09, 0.015, whiteM, 0, 0.045, Z0 + 0.008, sides.N, { noCast: true });
  box(0.015, 0.09, KIT.e - Z0, whiteM, X1 - 0.008, 0.045, (Z0 + KIT.e) / 2, sides.E, { noCast: true });
  box(0.015, 0.09, DOOR.z0 - Z0, whiteM, X0 + 0.008, 0.045, (Z0 + DOOR.z0) / 2, sides.W, { noCast: true }); box(0.015, 0.09, Z1 - DOOR.z1, whiteM, X0 + 0.008, 0.045, (DOOR.z1 + Z1) / 2, sides.W, { noCast: true });
  box(X1 - X0 - 3.4, 0.09, 0.015, whiteM, X0 + (X1 - X0 - 3.4) / 2, 0.045, Z1 - 0.008, sides.S, { noCast: true });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; G.add(floor);
  { const c = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 2 * T, Z1 - Z0 + 2 * T), ceilM); c.rotation.x = Math.PI / 2; c.position.y = HT; sides.C.add(c); }
  // (the downlights: two rows of four down the room, flush in the ceiling)
  const DL = []; for (const z of [-2.55, -0.75, 1.05, 2.75]) for (const x of [-0.95, 0.95]) DL.push([x, z]);
  for (const [x, z] of DL) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), downM); d.rotation.x = Math.PI / 2; d.position.set(x, HT - 0.002, z); sides.C.add(d);
    const r = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.058, 20), whiteM); r.rotation.x = Math.PI / 2; r.position.set(x, HT - 0.003, z); sides.C.add(r); }

  // ── The windows: white frames, a casement and a fixed light, dark glass (night), a sill; their reveals plastered white ──
  function windowIn(side, cx, w, sill, h, along) {
    // (in a wall's own frame: u along the wall, the room at +n; along: 'x' (the end wall) or 'z' (the TV wall))
    const g = new THREE.Group(); sides[side].add(g);
    if (along === 'x') { g.position.set(cx, 0, Z0 - T / 2); } else { g.position.set(X1 + T / 2, 0, cx); g.rotation.y = -Math.PI / 2; }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.1), nightM); glass.position.set(0, sill + h / 2, -0.02); g.add(glass);
    const fr = 0.06; box(w, fr, 0.07, whiteM, 0, sill + fr / 2, 0, g); box(w, fr, 0.07, whiteM, 0, sill + h - fr / 2, 0, g);
    for (const s of [-1, 1]) box(fr, h, 0.07, whiteM, s * (w / 2 - fr / 2), sill + h / 2, 0, g);
    box(0.07, h - 2 * fr, 0.07, whiteM, w * 0.12, sill + h / 2, 0.005, g);      // (the mullion: the opener one side of it)
    box(0.012, 0.12, 0.03, chrome, w * 0.12 + 0.06, sill + h * 0.5, 0.05, g);      // (its handle)
    // (the reveals, the head, and the sill, standing a little proud into the room)
    for (const s of [-1, 1]) box(0.02, h, T / 2 + 0.01, whiteM, s * (w / 2 + 0.01), sill + h / 2, T / 4, g, { noCast: true });
    box(w + 0.04, 0.02, T / 2 + 0.01, whiteM, 0, sill + h + 0.01, T / 4, g, { noCast: true }); box(w + 0.12, 0.03, T / 2 + 0.05, whiteM, 0, sill - 0.015, T / 4 + 0.02, g);
    return g;
  }
  windowIn('N', WIN_N.x, WIN_N.w, WIN_N.sill, WIN_N.h, 'x'); windowIn('E', WIN_E.z, WIN_E.w, WIN_E.sill, WIN_E.h, 'z');
  // (the curtains: eyelet-headed, on a steel pole, drawn back to either side; folds as a run of soft waves)
  function curtain(g, x0, x1, top, bottom, m) {
    const w = x1 - x0, folds = Math.max(3, Math.round(w / 0.1)), geo = new THREE.PlaneGeometry(w, top - bottom, folds * 6, 4), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + w / 2) / w; p.setZ(i, 0.035 * Math.sin(u * folds * Math.PI * 2)); }
    geo.computeVertexNormals(); const c = new THREE.Mesh(geo, m); c.position.set((x0 + x1) / 2, (top + bottom) / 2, 0); c.castShadow = true; c.receiveShadow = true; g.add(c);
    for (let k = 0; k < folds; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 14), chrome); r.position.set(x0 + (k + 0.5) * w / folds, top + 0.005, 0); g.add(r); }
  }
  function curtains(side, cx, rodW, top, bottom, m, along, spread) {
    const g = new THREE.Group(); sides[side].add(g);
    if (along === 'x') g.position.set(cx, 0, Z0 + 0.12); else { g.position.set(X1 - 0.12, 0, cx); g.rotation.y = -Math.PI / 2; }
    cyl(0.012, 0.012, rodW, chrome, 0, top + 0.02, 0, g, { rot: [0, 0, Math.PI / 2] }); for (const s of [-1, 1]) { ball(0.022, chrome, s * rodW / 2, top + 0.02, 0, g); cyl(0.008, 0.008, 0.12, chrome, s * (rodW / 2 - 0.08), top + 0.02, -0.06, g, { rot: [Math.PI / 2, 0, 0] }); }
    curtain(g, -rodW / 2 + 0.04, -rodW / 2 + 0.04 + spread, top, bottom, m); curtain(g, rodW / 2 - 0.04 - spread, rodW / 2 - 0.04, top, bottom, m);
  }
  curtains('N', WIN_N.x + 0.08, 2.0, 2.12, 0.74, std({ map: floralTex(), roughness: 0.95, side: THREE.DoubleSide }), 'x', 0.5);
  curtains('E', WIN_E.z, 2.0, 2.2, 0.9, std({ map: plainCurtainTex(), roughness: 0.95, side: THREE.DoubleSide }), 'z', 0.48);
  // (the radiator under the end window: a white double panel on its brackets, its valve)
  { const g = new THREE.Group(); g.position.set(0.12, 0, Z0 + 0.07); sides.N.add(g);
    for (const dz of [-0.02, 0.025]) box(1.2, 0.58, 0.022, whiteM, 0, 0.43, dz, g); box(1.2, 0.03, 0.07, whiteM, 0, 0.73, 0, g);
    for (let i = 0; i < 30; i++) box(0.004, 0.56, 0.05, std({ color: srgb('#e0ddd8'), roughness: 0.5 }), -0.58 + i * 0.04, 0.43, 0.002, g, { noCast: true });
    cyl(0.015, 0.015, 0.1, chrome, -0.63, 0.14, 0, g); cyl(0.022, 0.022, 0.06, whiteM, -0.63, 0.21, 0, g); }
  // (the wall clock, over the chest of drawers: black, white hands, stopped at seven minutes past one)
  { const g = new THREE.Group(); g.position.set(X1 - 0.025, 1.95, -0.25); g.rotation.y = -Math.PI / 2; sides.E.add(g);
    cyl(0.15, 0.15, 0.03, std({ color: srgb('#1a1a1a'), roughness: 0.4 }), 0, 0, 0, g, { rot: [Math.PI / 2, 0, 0], seg: 32 }); cyl(0.152, 0.152, 0.02, std({ color: srgb('#5a5a5e'), roughness: 0.4 }), 0, 0, -0.008, g, { rot: [Math.PI / 2, 0, 0], seg: 32 });
    const hand = (len, wd, a) => { const h = box(wd, len, 0.004, plasticWht, 0, 0, 0.018, g, { noCast: true }); h.geometry.translate(0, len / 2 - 0.012, 0); h.rotation.z = -a; };
    hand(0.08, 0.008, (1 + 7 / 60) / 12 * Math.PI * 2); hand(0.12, 0.006, 7 / 60 * Math.PI * 2);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = i % 3 ? 0.002 : 0.004; const d = box(r * 2, 0.012, 0.003, plasticWht, Math.sin(a) * 0.125, Math.cos(a) * 0.125, 0.017, g, { noCast: true }); d.rotation.z = -a; } }

  // ── The door to the hall: the doorway's white lining and architrave; the oak door, standing open into the room, back toward the kitchen ──
  { const zc = (DOOR.z0 + DOOR.z1) / 2, wd = DOOR.z1 - DOOR.z0;
    for (const z of [DOOR.z0, DOOR.z1]) { box(0.07, DOOR.h + 0.07, 0.018, whiteM, X0 + 0.009, (DOOR.h + 0.07) / 2, z + (z === DOOR.z0 ? -0.035 : 0.035), sides.W, { ry: Math.PI / 2, noCast: true }); box(T, DOOR.h, 0.02, whiteM, X0 - T / 2, DOOR.h / 2, z + (z === DOOR.z0 ? 0.01 : -0.01), sides.W, { noCast: true }); }
    box(0.018, 0.07, wd + 0.14, whiteM, X0 + 0.009, DOOR.h + 0.035, zc, sides.W, { noCast: true }); box(T, 0.02, wd, whiteM, X0 - T / 2, DOOR.h - 0.01, zc, sides.W, { noCast: true });
    const lw = wd - 0.03, leaf = new THREE.Group(); leaf.position.set(X0 + 0.04, 0, DOOR.z1 - 0.025); sides.W.add(leaf);
    box(lw, DOOR.h - 0.02, 0.04, oakDoor, lw / 2, (DOOR.h - 0.02) / 2 + 0.008, 0, leaf);
    for (const s of [-1, 1]) { box(0.12, 0.018, 0.02, chrome, lw - 0.11, 1.0, s * 0.035, leaf); cyl(0.028, 0.028, 0.012, chrome, lw - 0.06, 1.0, s * 0.026, leaf, { rot: [Math.PI / 2, 0, 0] }); }
    for (const y of [0.25, 1.0, 1.75]) box(0.012, 0.1, 0.045, chrome, 0.006, y, 0, leaf, { noCast: true });
    // (the hall beyond: a narrow passage, its own paint, dim)
    const hall = new THREE.Group(); sides.W.add(hall); const hx0 = X0 - T - 1.05, hx1 = X0 - T;
    const hf = new THREE.Mesh(new THREE.PlaneGeometry(hx1 - hx0, 2.6), floorM); hf.rotation.x = -Math.PI / 2; hf.position.set((hx0 + hx1) / 2, 0.001, zc); hall.add(hf);
    box(0.05, HT, 2.6, wallM, hx0, HT / 2, zc, hall); box(hx1 - hx0, HT, 0.05, wallM, (hx0 + hx1) / 2, HT / 2, zc - 1.3, hall); box(hx1 - hx0, 0.05, 2.6, ceilM, (hx0 + hx1) / 2, HT, zc, hall);
    box(0.06, 0.2, 0.1, plasticWht, hx0 + 0.04, 1.45, zc - 0.3, hall); }      // (the entryphone on the passage wall)

  // ── The kitchen, built in: along the TV wall the sink and the washing machine; across the end wall the hob over the oven under the hood,
  // the drawers, the tall unit; wall cupboards over the end wall; the worktop, the mosaic splashback; and what's out on the worktop ──
  const KS = sides.S, KE = sides.E, D = KIT.d, TOP = KIT.top, zF = Z1 - D;      // (the end wall's run: its fronts at zF)
  const bar = (len, to, x, y, z, vertical, ry) => { const g = new THREE.Group(); g.position.set(x, y, z); if (ry) g.rotation.y = ry; to.add(g);
    if (vertical) { cyl(0.006, 0.006, len, chrome, 0, 0, 0.03, g); for (const s of [-1, 1]) cyl(0.004, 0.004, 0.03, chrome, 0, s * (len / 2 - 0.015), 0.015, g, { rot: [Math.PI / 2, 0, 0] }); }
    else { cyl(0.006, 0.006, len, chrome, 0, 0, 0.03, g, { rot: [0, 0, Math.PI / 2] }); for (const s of [-1, 1]) cyl(0.004, 0.004, 0.03, chrome, s * (len / 2 - 0.015), 0, 0.015, g, { rot: [Math.PI / 2, 0, 0] }); }
    return g; };
  // (the end wall's base run, from the TV-wall corner westward: the corner unit, a double cupboard, the oven under the hob, the drawers; then
  // the tall unit; its plinth)
  const SX = { corner: [X1, X1 - 0.6], dbl: [X1 - 0.6, 0.43], oven: [0.43, -0.17], drw: [-0.17, -0.77], tall: [-0.77, -1.37] };
  box(X1 - SX.drw[1], 0.1, 0.02, carcM, (X1 + SX.drw[1]) / 2, 0.05, zF + 0.04, KS);
  box(X1 - SX.drw[1], TOP - 0.13, D - 0.04, carcM, (X1 + SX.drw[1]) / 2, 0.1 + (TOP - 0.13) / 2, Z1 - (D - 0.04) / 2, KS);
  const front = (x0, x1, y0, y1, to, handle) => { const w = Math.abs(x1 - x0) - 0.006, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; box(w, y1 - y0 - 0.006, 0.019, unitM, cx, cy, zF + 0.01, to);
    if (handle === 'v') bar(0.16, to, cx + (x1 < x0 ? 1 : -1) * (w / 2 - 0.05), y1 - 0.14, zF + 0.02, true); else if (handle === 'v2') bar(0.16, to, cx - (w / 2 - 0.05), y1 - 0.14, zF + 0.02, true); else if (handle === 'h') bar(0.32, to, cx, y1 - 0.07, zF + 0.02, false); };
  front(SX.corner[0], SX.corner[1], 0.1, TOP - 0.04, KS, 'v'); front(SX.dbl[0], (SX.dbl[0] + SX.dbl[1]) / 2, 0.1, TOP - 0.04, KS, 'v2'); front((SX.dbl[0] + SX.dbl[1]) / 2, SX.dbl[1], 0.1, TOP - 0.04, KS, 'v');
  front(SX.drw[0], SX.drw[1], 0.66, TOP - 0.04, KS, 'h'); front(SX.drw[0], SX.drw[1], 0.38, 0.66, KS, 'h'); front(SX.drw[0], SX.drw[1], 0.1, 0.38, KS, 'h');
  // (the oven: built under, stainless, a black glass door, its display; the hob on the worktop above: black glass, four zones)
  { const cx = (SX.oven[0] + SX.oven[1]) / 2; box(0.595, 0.6, 0.02, steel, cx, 0.42, zF + 0.012, KS); box(0.5, 0.36, 0.01, glassBlk, cx, 0.38, zF + 0.024, KS, { noCast: true });
    box(0.5, 0.05, 0.008, glassBlk, cx, 0.66, zF + 0.024, KS, { noCast: true }); box(0.06, 0.02, 0.004, std({ color: srgb('#40c0ff'), emissive: srgb('#40c0ff'), emissiveIntensity: 1.5 }), cx, 0.66, zF + 0.03, KS, { noCast: true });
    cyl(0.008, 0.008, 0.46, chrome, cx, 0.6, zF + 0.06, KS, { rot: [0, 0, Math.PI / 2] }); box(0.595, 0.1, 0.02, unitM, cx, 0.06 + 0.05, zF + 0.01, KS);
    box(0.58, 0.006, 0.51, glassBlk, cx, TOP + 0.003, Z1 - 0.3, KS, { noCast: true });
    for (const [dx, dz, r] of [[-0.14, -0.1, 0.09], [0.14, -0.1, 0.07], [-0.14, 0.12, 0.07], [0.14, 0.12, 0.09]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.004, r, 28), std({ color: srgb('#5a5a5e'), roughness: 0.4 })); ring.rotation.x = -Math.PI / 2; ring.position.set(cx + dx, TOP + 0.007, Z1 - 0.3 + dz); KS.add(ring); } }
  // (the tall unit: two doors, a fridge-freezer's, up to the wall cupboards' tops)
  { const [a, b] = SX.tall, cx = (a + b) / 2; box(0.6, 2.15, D, carcM, cx, 1.075, Z1 - D / 2, KS); box(0.594, 1.18, 0.019, unitM, cx, 0.1 + 0.59, zF + 0.01, KS); box(0.594, 0.84, 0.019, unitM, cx, 1.29 + 0.42, zF + 0.01, KS);
    bar(0.22, KS, cx - 0.25, 1.05, zF + 0.02, true); bar(0.22, KS, cx - 0.25, 1.4, zF + 0.02, true); }
  // (the long wall's run: the corner's end of it under the end wall's worktop, the sink's cupboard, the washing machine; an end panel)
  const xF = X1 - D;
  box(D - 0.04, TOP - 0.13, zF - KIT.e, carcM, X1 - (D - 0.04) / 2, 0.1 + (TOP - 0.13) / 2, (KIT.e + zF) / 2, KE);
  box(0.02, 0.1, zF - KIT.e, carcM, xF + 0.04, 0.05, (KIT.e + zF) / 2, KE);
  { const g = new THREE.Group(); g.position.set(xF + 0.01, 0, 0); KE.add(g);
    // (the sink's cupboard: one door)
    box(0.019, TOP - 0.1, 0.55, unitM, 0, 0.1 + (TOP - 0.14) / 2, 2.6 + 0.29, g); bar(0.16, g, -0.01, TOP - 0.18, 2.6 + 0.08, true, -Math.PI / 2); }
  // (the washing machine: black, a round door with its chrome-rimmed glass, the dial and the panel)
  { const g = new THREE.Group(); g.position.set(xF + 0.03, 0, 2.31); g.rotation.y = -Math.PI / 2; KE.add(g);
    box(0.595, 0.84, 0.56, std({ color: srgb('#1c1c1e'), roughness: 0.35 }), 0, 0.42, -0.28, g); cyl(0.2, 0.2, 0.04, std({ color: srgb('#2c2c30'), roughness: 0.25 }), 0, 0.4, 0.01, g, { rot: [Math.PI / 2, 0, 0], seg: 32 });
    cyl(0.15, 0.15, 0.045, glassBlk, 0, 0.4, 0.015, g, { rot: [Math.PI / 2, 0, 0], seg: 32 }); box(0.16, 0.06, 0.02, std({ color: srgb('#2a2a2e'), roughness: 0.3 }), -0.18, 0.77, 0.01, g); cyl(0.03, 0.03, 0.03, chrome, 0.16, 0.77, 0.01, g, { rot: [Math.PI / 2, 0, 0] });
    box(0.03, 0.03, 0.01, std({ color: srgb('#d06a2a'), roughness: 0.5 }), 0.24, 0.2, 0.015, g, { noCast: true }); }
  box(0.02, TOP - 0.02, D, unitM, X1 - D / 2, (TOP - 0.02) / 2, KIT.e + 0.01, KE);      // (the end panel)
  // (the worktop: an L, white, square-edged)
  box(X1 - SX.drw[1] + 0.02, 0.035, D + 0.02, topM, (X1 + SX.drw[1]) / 2 - 0.01, TOP - 0.0175, Z1 - (D + 0.02) / 2, KS);
  box(D + 0.02, 0.035, zF - KIT.e + 0.02, topM, X1 - (D + 0.02) / 2, TOP - 0.0175, (KIT.e + zF) / 2 - 0.01, KE);
  // (the sink: black composite, inset, a bowl and a drainer; a chrome swan-neck tap at its back)
  { const cz = 2.88, x = X1 - 0.32; box(0.48, 0.008, 0.86, std({ color: srgb('#1a1a1c'), roughness: 0.4 }), x, TOP + 0.004, cz - 0.15, KE, { noCast: true });
    box(0.38, 0.006, 0.42, std({ color: srgb('#0d0d0e'), roughness: 0.6 }), x, TOP + 0.009, cz, KE, { noCast: true });
    for (let i = 0; i < 6; i++) box(0.3, 0.003, 0.012, std({ color: srgb('#2a2a2c'), roughness: 0.5 }), x, TOP + 0.009, cz - 0.3 - i * 0.05, KE, { noCast: true });
    cyl(0.018, 0.022, 0.26, chrome, X1 - 0.08, TOP + 0.13, cz, KE); const nk = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 20, Math.PI), chrome); nk.position.set(X1 - 0.17, TOP + 0.26, cz); KE.add(nk);
    cyl(0.01, 0.01, 0.07, chrome, X1 - 0.08, TOP + 0.21, cz + 0.035, KE, { rot: [0, 0, 1.2] }); }
  // (the splashback: the mosaic, across the end wall to the drawers, and higher behind the hob; and along the long wall's run)
  box(X1 - SX.drw[1], 1.45 - TOP, 0.012, tileM, (X1 + SX.drw[1]) / 2, (TOP + 1.45) / 2, Z1 - 0.006, KS, { noCast: true });
  box(0.6, 0.25, 0.012, tileM, (SX.oven[0] + SX.oven[1]) / 2, 1.45 + 0.125, Z1 - 0.006, KS, { noCast: true });
  box(0.012, 0.4, Z1 - KIT.e, tileM, X1 - 0.006, TOP + 0.2, (KIT.e + Z1) / 2, KE, { noCast: true });
  // (the wall cupboards: three doors over the corner and the double cupboard, then the hood, then one over the drawers; lights under them)
  const WB = 1.45, WH = 0.72, WD = 0.33, wF = Z1 - WD;
  const wall3 = (x0, x1, doors) => { box(x0 - x1, WH, WD, carcM, (x0 + x1) / 2, WB + WH / 2, Z1 - WD / 2, KS); const dw = (x0 - x1) / doors;
    for (let i = 0; i < doors; i++) { const a = x0 - i * dw, b = a - dw; box(dw - 0.006, WH - 0.006, 0.019, unitM, (a + b) / 2, WB + WH / 2, wF + 0.01, KS); bar(0.22, KS, (i % 2 ? b + 0.05 : a - 0.05), WB + 0.16, wF + 0.02, true); } };
  wall3(X1, 0.45, 3); wall3(-0.19, -0.71, 1);
  for (const x of [1.5, 0.9]) cyl(0.025, 0.025, 0.006, std({ color: srgb('#fff4dc'), emissive: srgb('#fff0d0'), emissiveIntensity: 2 }), x, WB - 0.003, Z1 - 0.12, KS, { noCast: true });
  // (the chimney hood: a stainless canopy over the hob, its chimney up to the ceiling)
  { const cx = (SX.oven[0] + SX.oven[1]) / 2, g = new THREE.Group(); g.position.set(cx, 0, Z1); KS.add(g);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.42, 0.22, 4, 1), steel); can.rotation.y = Math.PI / 4; can.scale.set(1, 1, 0.7); can.position.set(0, 1.79, -0.26); can.castShadow = true; g.add(can);
    box(0.6, 0.04, 0.5, steel, 0, 1.68, -0.25, g); box(0.25, HT - 1.9, 0.22, steel, 0, 1.9 + (HT - 1.9) / 2, -0.11, g); }
  // (what's out on the worktop and plugged in: the air fryer, the toaster, the kettle, the slow cooker; the microwave on the drawers)
  { const z = Z1 - 0.3, t = TOP;
    { const g = new THREE.Group(); g.position.set(1.6, t, z); KS.add(g); rbox(0.28, 0.3, 0.34, 0.06, std({ color: srgb('#202022'), roughness: 0.4 }), 0, 0.15, 0, g); box(0.2, 0.12, 0.01, glassBlk, 0, 0.12, 0.172, g); box(0.12, 0.02, 0.03, plasticBlk, 0, 0.21, 0.18, g); }
    { const g = new THREE.Group(); g.position.set(1.18, t, z + 0.02); KS.add(g); rbox(0.27, 0.19, 0.16, 0.04, plasticWht, 0, 0.095, 0, g); for (const s of [-1, 1]) box(0.2, 0.01, 0.025, std({ color: srgb('#2a2a2a'), roughness: 0.6 }), 0, 0.19, s * 0.035, g, { noCast: true }); box(0.02, 0.05, 0.02, plasticBlk, 0.12, 0.12, 0.085, g); }
    { const g = new THREE.Group(); g.position.set(0.92, t, z); KS.add(g); cyl(0.09, 0.075, 0.23, plasticWht, 0, 0.13, 0, g); cyl(0.1, 0.1, 0.015, plasticWht, 0, 0.0075, 0, g); box(0.03, 0.17, 0.06, plasticWht, -0.1, 0.14, 0, g); box(0.07, 0.025, 0.04, plasticWht, 0.09, 0.22, 0, g, { rz: 0.4 }); }
    { const g = new THREE.Group(); g.position.set(0.64, t, z - 0.02); KS.add(g); rbox(0.36, 0.2, 0.26, 0.08, steel, 0, 0.1, 0, g); rbox(0.3, 0.05, 0.22, 0.05, std({ color: srgb('#9aa0a4'), roughness: 0.15, transparent: true, opacity: 0.6 }), 0, 0.22, 0, g); cyl(0.015, 0.02, 0.025, plasticBlk, 0, 0.26, 0, g); box(0.05, 0.03, 0.01, plasticBlk, 0, 0.07, 0.132, g); }
    { const g = new THREE.Group(); g.position.set(-0.47, t, z + 0.02); KS.add(g); box(0.48, 0.28, 0.36, std({ color: srgb('#151517'), roughness: 0.35 }), 0, 0.14, 0, g); box(0.31, 0.2, 0.005, glassBlk, -0.06, 0.15, 0.181, g, { noCast: true });
      box(0.1, 0.22, 0.005, std({ color: srgb('#202024'), roughness: 0.3 }), 0.17, 0.15, 0.181, g, { noCast: true }); box(0.05, 0.015, 0.003, std({ color: srgb('#ff3a2a'), emissive: srgb('#ff3a2a'), emissiveIntensity: 1.2 }), 0.17, 0.235, 0.185, g, { noCast: true }); } }

  // ── The furniture, each where the layout puts it (built facing +z: its front toward the room) ──
  const L = ROOM.layout(), pieces = {}, place = (k, at) => { const p = pieces[k]; Object.assign(L[k], at); p.g.position.set(L[k].x, 0, L[k].z); p.g.rotation.y = L[k].ry || 0; p.g.updateMatrixWorld(true); };
  const piece = k => { const g = new THREE.Group(); g.userData.piece = k; G.add(g); pieces[k] = { g, label: LABELS[k] }; place(k, {}); return g; };
  const lampLights = [];
  // the corner sofa: dark charcoal, its long side against the desk wall (two seats and the corner, an arm at its open end), its chaise along
  // the end wall (the corner seat backed, the chaise not). Built about its middle: the corner at local (−0.93, −1.2)
  { const g = piece('sofa'), ox = -0.93, oz = -1.2, Dp = 0.92, LONG = 2.4, CH = 1.86, SH = 0.42;
    const at = (x, z) => [ox + x, oz + z];
    // (the base, under the long side and under the chaise)
    { const [x, z] = at(Dp / 2, LONG / 2); rbox(Dp, 0.3, LONG, 0.03, sofaM, x, 0.2, z, g); } { const [x, z] = at(Dp + (CH - Dp) / 2, Dp / 2); rbox(CH - Dp, 0.3, Dp, 0.03, sofaM, x, 0.2, z, g); }
    for (const [x, z] of [[0.05, 0.05], [Dp - 0.05, LONG - 0.05], [0.05, LONG - 0.05], [CH - 0.05, 0.05], [CH - 0.05, Dp - 0.05]]) { const [a, b] = at(x, z); cyl(0.02, 0.02, 0.05, plasticBlk, a, 0.025, b, g); }
    // (the seat cushions: the corner, two along, the chaise; each a soft slab)
    { const [x, z] = at(0.22 + (Dp - 0.22) / 2, 0.22 + (Dp - 0.22) / 2); rbox(Dp - 0.24, 0.14, Dp - 0.24, 0.05, sofaM, x, SH, z, g); }
    for (let i = 0; i < 2; i++) { const z0 = Dp + i * 0.61; const [x, z] = at(0.22 + (Dp - 0.22) / 2, z0 + 0.305); rbox(Dp - 0.24, 0.14, 0.6, 0.05, sofaM, x, SH, z, g); }
    { const [x, z] = at(Dp + (CH - Dp) / 2, Dp / 2); rbox(CH - Dp - 0.02, 0.14, Dp - 0.02, 0.05, sofaM, x, SH, z, g); }
    // (the back: along the desk wall the length of the corner and the two seats; along the end wall over the corner only; its cushions)
    { const [x, z] = at(0.11, (Dp + 2 * 0.61) / 2); rbox(0.22, 0.5, Dp + 2 * 0.61, 0.05, sofaM, x, 0.6, z, g); } { const [x, z] = at(Dp / 2, 0.11); rbox(Dp, 0.5, 0.22, 0.05, sofaM, x, 0.6, z, g); }
    for (const zc of [0.46, Dp + 0.305, Dp + 0.915]) { const [x, z] = at(0.3, zc); rbox(0.2, 0.42, zc < 0.5 ? 0.5 : 0.6, 0.09, sofaM, x, 0.68, z, g, { rz: -0.12 }); }
    { const [x, z] = at(0.6, 0.3); rbox(0.5, 0.42, 0.2, 0.09, sofaM, x, 0.68, z, g, { rx: 0.12 }); }
    // (the arm at the open end of the long side)
    { const [x, z] = at(Dp / 2, LONG - 0.12); rbox(Dp, 0.62, 0.24, 0.06, sofaM, x, 0.36, z, g); } }
  // the coffee table: black, a lower shelf, its long side along the sofa
  { const g = piece('coffeeTable'), w = 0.55, l = 1.1, h = 0.45;
    box(w, 0.04, l, blackWood, 0, h - 0.02, 0, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, h - 0.04, 0.05, blackWood, sx * (w / 2 - 0.035), (h - 0.04) / 2, sz * (l / 2 - 0.035), g);
    box(w - 0.06, 0.02, l - 0.06, blackWood, 0, 0.1, 0, g); for (const sx of [-1, 1]) box(0.02, 0.08, l - 0.1, blackWood, sx * (w / 2 - 0.035), h - 0.08, 0, g); }
  // the rug: charcoal, flat-woven, fringed at its ends
  { const g = piece('rug'), w = 1.6, l = 2.3; const r = new THREE.Mesh(new THREE.PlaneGeometry(w, l), rugM); r.rotation.x = -Math.PI / 2; r.position.y = 0.005; r.receiveShadow = true; g.add(r);
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.07), fringeM); f.rotation.x = -Math.PI / 2; f.position.set(0, 0.004, s * (l / 2 + 0.035)); g.add(f); } }
  // the floor lamps: a black pole and base, an uplighter's white shade, lit; the corner one with its reading arm
  const lamp = (k, arm) => { const g = piece(k); cyl(0.14, 0.15, 0.02, blackMetal, 0, 0.01, 0, g, { seg: 28 }); cyl(0.011, 0.011, 1.72, blackMetal, 0, 0.87, 0, g);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.045, 0.2, 28, 1, true), shadeM); sh.position.set(0, 1.8, 0); g.add(sh);
    const l = new THREE.PointLight(srgb('#ffcf8a'), 3, 4.5, 2); l.position.set(0, 1.95, 0); g.add(l); lampLights.push(l);
    if (arm) { const a = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 16, Math.PI * 0.6), blackMetal); a.position.set(0.0, 1.12, 0.16); a.rotation.set(0, Math.PI / 2, 0); g.add(a);
      const rs = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.11, 20, 1, true), shadeM); rs.position.set(0, 1.2, 0.3); rs.rotation.x = 0.5; g.add(rs); }
    return g; };
  lamp('lampCorner', true); lamp('lampDesk', false);
  // the desk: a black sit-stand desk on its two columns; a red mat; a pine riser on chrome legs with the curved monitor on it, the second
  // monitor to its right on a black box; the keyboard and its rest, the mouse; the lamp, a thin champagne arm with an LED bar; the desk's
  // own height keypad at its front
  { const g = piece('desk'), w = 1.4, d = 0.7, h = 0.74;
    box(w, 0.025, d, blackWood, 0, h - 0.0125, 0, g);
    for (const sx of [-1, 1]) { box(0.07, h - 0.06, 0.05, blackMetal, sx * 0.55, (h - 0.06) / 2 + 0.02, -0.05, g); box(0.06, 0.04, d - 0.06, blackMetal, sx * 0.55, 0.02, 0, g); box(0.05, 0.04, d - 0.12, blackMetal, sx * 0.55, h - 0.045, 0, g); }
    box(1.1, 0.04, 0.04, blackMetal, 0, h - 0.05, -0.05, g);
    box(0.09, 0.025, 0.05, plasticBlk, 0.6, h - 0.04, d / 2 - 0.02, g);      // (the height keypad, under the front edge)
    box(0.9, 0.004, 0.4, redMat, -0.08, h + 0.002, 0.1, g, { noCast: true });
    // (the riser: a pine shelf on four chrome legs)
    const ry = h + 0.12; box(1.0, 0.02, 0.25, pineM, -0.12, ry, -0.2, g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.011, 0.011, 0.12, chrome, -0.12 + sx * 0.45, h + 0.06, -0.2 + sz * 0.09, g);
    // (the curved monitor on it: its stand and neck, a dark shell behind the curved screen)
    { const m = new THREE.Group(); m.position.set(-0.12, ry + 0.01, -0.22); g.add(m); box(0.26, 0.012, 0.18, plasticBlk, 0, 0.006, 0, m); box(0.05, 0.2, 0.03, plasticBlk, 0, 0.11, -0.03, m);
      const R = 1.8, sw = 0.72, sh = 0.42, th = sw / R, cy0 = 0.42;
      const scr = new THREE.Mesh(new THREE.CylinderGeometry(R, R, sh, 24, 1, true, Math.PI - th / 2, th), screenM); scr.material.side = THREE.BackSide; scr.position.set(0, cy0, R + 0.01); m.add(scr);
      const sm = scr.material.map; sm.wrapS = THREE.RepeatWrapping; sm.repeat.x = -1;
      const back = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.025, R + 0.025, sh + 0.025, 24, 1, true, Math.PI - (th + 0.02) / 2, th + 0.02), plasticBlk); back.position.copy(scr.position); back.castShadow = true; m.add(back);
      for (const s of [-1, 1]) { const e = box(0.012, sh + 0.025, 0.03, plasticBlk, s * (R * Math.sin(th / 2 + 0.005)), cy0, R + 0.01 - R * Math.cos(th / 2 + 0.005), m); e.rotation.y = -s * th / 2; } }
    // (the second monitor, on a black box at the right)
    { const m = new THREE.Group(); m.position.set(0.48, h, -0.17); g.add(m); box(0.2, 0.3, 0.3, plasticBlk, 0, 0.15, 0, m); box(0.05, 0.12, 0.03, plasticBlk, 0, 0.36, -0.04, m);
      box(0.56, 0.34, 0.03, plasticBlk, 0, 0.6, 0, m); const st = screenTex(), s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.53, 0.3), new THREE.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: srgb('#ffffff'), emissiveIntensity: 1.1, roughness: 0.3 })); s2.position.set(0, 0.6, 0.02); m.add(s2); }
    // (the keyboard, its wrist rest, the mouse)
    rbox(0.44, 0.025, 0.14, 0.008, std({ color: srgb('#2e3034'), roughness: 0.6 }), -0.1, h + 0.017, 0.12, g); for (let r = 0; r < 5; r++) box(0.42, 0.004, 0.018, std({ color: srgb('#1e2022'), roughness: 0.7 }), -0.1, h + 0.031, 0.075 + r * 0.022, g, { noCast: true });
    rbox(0.44, 0.02, 0.07, 0.01, plasticBlk, -0.1, h + 0.012, 0.24, g); ball(0.045, std({ color: srgb('#26282b'), roughness: 0.5 }), 0.26, h + 0.02, 0.17, g, [0.75, 0.42, 1.15]);
    // (the lamp at the back left)
    { const m = new THREE.Group(); m.position.set(-0.62, h, -0.26); g.add(m); cyl(0.07, 0.075, 0.015, champagne, 0, 0.008, 0, m, { seg: 24 }); cyl(0.007, 0.007, 0.5, champagne, 0, 0.26, 0, m);
      const arm = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.007, 6, 18, Math.PI / 2), champagne); arm.position.set(0.12, 0.51, 0); arm.rotation.set(0, 0, 0); m.add(arm);
      box(0.34, 0.015, 0.03, champagne, 0.29, 0.62, 0, m); box(0.3, 0.004, 0.02, std({ color: srgb('#fff2d8'), emissive: srgb('#fff0d0'), emissiveIntensity: 2.5 }), 0.29, 0.611, 0, m, { noCast: true });
      const dl = new THREE.PointLight(srgb('#fff0d8'), 1.2, 2.5, 2); dl.position.set(0.3, 0.55, 0); m.add(dl); } }
  // the desk chair: steel-blue fabric, padded arms, on its gas lift and five castors
  { const g = piece('deskChair');
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, leg = box(0.32, 0.03, 0.05, plasticBlk, Math.sin(a) * 0.16, 0.08, Math.cos(a) * 0.16, g); leg.rotation.y = a + Math.PI / 2; ball(0.03, plasticBlk, Math.sin(a) * 0.31, 0.03, Math.cos(a) * 0.31, g); }
    cyl(0.025, 0.03, 0.3, chrome, 0, 0.24, 0, g); cyl(0.04, 0.04, 0.08, plasticBlk, 0, 0.38, 0, g);
    rbox(0.52, 0.1, 0.5, 0.04, fabricBlue, 0, 0.47, 0.02, g); rbox(0.5, 0.62, 0.09, 0.05, fabricBlue, 0, 0.86, -0.24, g, { rx: -0.1 }); box(0.06, 0.3, 0.03, plasticBlk, 0, 0.5, -0.24, g);
    for (const s of [-1, 1]) { box(0.03, 0.2, 0.03, plasticBlk, s * 0.28, 0.6, -0.02, g); rbox(0.07, 0.04, 0.26, 0.015, plasticBlk, s * 0.28, 0.71, 0.02, g); } }
  // the amp under the desk: a black combo, its grille cloth, its piping and control strip in gold
  { const g = piece('amp'), w = 0.46, h = 0.4, d = 0.24; rbox(w, h, d, 0.02, std({ color: srgb('#121212'), roughness: 0.75 }), 0, h / 2, 0, g);
    box(w - 0.06, h - 0.12, 0.005, std({ map: K.weave('#1e1c1a', '#2e2a24', [10, 10]), roughness: 1 }), 0, h / 2 - 0.03, d / 2 + 0.001, g, { noCast: true });
    box(w - 0.04, 0.008, 0.006, champagne, 0, h - 0.08, d / 2 + 0.002, g, { noCast: true }); box(w - 0.06, 0.05, 0.005, std({ color: srgb('#b89a5a'), roughness: 0.35, metalness: 0.6 }), 0, h - 0.04, d / 2 + 0.002, g, { noCast: true });
    for (let i = 0; i < 6; i++) cyl(0.008, 0.008, 0.01, std({ color: srgb('#e6d8b0'), roughness: 0.4 }), -0.15 + i * 0.06, h - 0.04, d / 2 + 0.006, g, { rot: [Math.PI / 2, 0, 0] }); }
  // the bean bags: a big corded lounger, and a smaller one slumped against it, turquoise
  { const g = piece('beanbags'); ball(0.44, cordBlue, 0, 0.21, 0.05, g, [1, 0.48, 0.95]); ball(0.32, cordBlue, 0.05, 0.6, -0.18, g, [1, 0.8, 0.85]);
    ball(0.3, cordBlue, -0.02, 0.38, -0.28, g, [1.05, 0.55, 0.5]); }
  // the tower fan: white, a dark grille down its front, a round black top
  { const g = piece('fan'); cyl(0.15, 0.16, 0.04, plasticWht, 0, 0.02, 0, g, { seg: 28 }); rbox(0.24, 0.86, 0.24, 0.1, plasticWht, 0, 0.47, 0, g);
    box(0.13, 0.62, 0.01, std({ color: srgb('#2a2a2c'), roughness: 0.6 }), 0, 0.46, 0.118, g, { noCast: true }); cyl(0.12, 0.12, 0.03, std({ color: srgb('#1e1e20'), roughness: 0.4 }), 0, 0.905, 0, g, { seg: 28 }); }
  // the shelf unit: black metal, five shelves, an X across the back
  { const g = piece('shelves'), w = 0.85, d = 0.35, h = 1.8;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.022, h, 0.022, blackMetal, sx * (w / 2 - 0.011), h / 2, sz * (d / 2 - 0.011), g);
    for (const y of [0.15, 0.55, 0.95, 1.35, 1.77]) { box(w - 0.02, 0.016, d - 0.02, blackWood, 0, y, 0, g); box(w, 0.02, 0.02, blackMetal, 0, y - 0.01, d / 2 - 0.01, g); }
    for (const s of [-1, 1]) { const x = box(0.012, 0.95, 0.008, blackMetal, 0, 1.15, -d / 2 + 0.006, g); x.rotation.z = s * 0.92; } }
  // the TV stand: black, a long top on a stepped base of open shelves; the TV on it, the console on its middle shelf
  { const g = piece('tvStand'), w = 1.2, d = 0.45, h = 0.5;
    box(w, 0.035, d, blackWood, 0, h - 0.0175, 0, g); for (const sx of [-1, 1]) box(0.03, h - 0.05, d - 0.06, blackWood, sx * (w / 2 - 0.1), (h - 0.05) / 2 + 0.015, 0, g);
    box(w - 0.2, 0.025, d - 0.06, blackWood, 0, 0.27, 0, g); box(w - 0.1, 0.03, d, blackWood, 0, 0.03, 0, g); box(0.025, 0.22, d - 0.06, blackWood, 0.18, 0.15, 0, g);
    // (the console: white, slim, its power light)
    box(0.29, 0.064, 0.24, plasticWht, -0.18, 0.315, 0.02, g); box(0.29, 0.004, 0.24, std({ color: srgb('#2a2a2a'), roughness: 0.5 }), -0.18, 0.349, 0.02, g, { noCast: true });
    cyl(0.005, 0.005, 0.003, std({ color: srgb('#ffffff'), emissive: srgb('#ffffff'), emissiveIntensity: 2 }), -0.07, 0.315, 0.141, g, { rot: [Math.PI / 2, 0, 0], noCast: true });
    // (the TV: fifty inches, a thin black slab on two splayed feet; off)
    const tv = new THREE.Group(); tv.position.set(0, h, 0.0); g.add(tv);
    for (const s of [-1, 1]) { const f = box(0.02, 0.08, 0.22, plasticBlk, s * 0.42, 0.04, 0.0, tv); f.rotation.z = s * 0.35; }
    box(1.12, 0.66, 0.05, plasticBlk, 0, 0.4, -0.02, tv); box(1.1, 0.64, 0.004, tvOff, 0, 0.4, 0.007, tv, { noCast: true }); box(0.3, 0.3, 0.04, plasticBlk, 0, 0.36, -0.065, tv); }
  // the chest of drawers: black, three drawers with round oak pulls, on splayed oak legs; the lava lamp on it, lit
  { const g = piece('drawers'), w = 0.8, d = 0.42, h0 = 0.2, h1 = 0.8;
    box(w, h1 - h0, d, blackWood, 0, (h0 + h1) / 2, 0, g);
    for (let i = 0; i < 3; i++) { const y = h0 + 0.01 + i * (h1 - h0 - 0.02) / 3 + (h1 - h0 - 0.02) / 6; box(w - 0.04, (h1 - h0 - 0.02) / 3 - 0.012, 0.01, blackWood, 0, y, d / 2 + 0.003, g);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 20), oakM); ring.position.set(0, y, d / 2 + 0.01); g.add(ring); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = cyl(0.018, 0.011, h0 + 0.01, oakM, sx * (w / 2 - 0.06), h0 / 2, sz * (d / 2 - 0.06), g); l.rotation.set(sz * 0.12, 0, -sx * 0.12); }
    // (the lava lamp: a silver cone base, the glass, the wax rising in it)
    const lv = new THREE.Group(); lv.position.set(0.12, h1, -0.04); g.add(lv); cyl(0.04, 0.065, 0.13, chrome, 0, 0.065, 0, lv); cyl(0.045, 0.03, 0.2, lavaGlass, 0, 0.23, 0, lv); cyl(0.022, 0.04, 0.045, chrome, 0, 0.355, 0, lv);
    ball(0.02, lavaWax, 0, 0.18, 0, lv, [1, 1.4, 1]); ball(0.014, lavaWax, 0.005, 0.27, 0, lv, [1, 1.3, 1]);
    const ll = new THREE.PointLight(srgb('#5ac8ff'), 0.6, 1.5, 2); ll.position.set(0, 0.25, 0.05); lv.add(ll); }
  // the armchair: a deep, wide chair, black leather arms and frame, grey corded cushions in the seat and at its back, two grey cushions
  { const g = piece('armchair'), w = 1.3, d = 0.95;
    rbox(w - 0.3, 0.26, d - 0.1, 0.04, leatherBlk, 0, 0.2, 0.02, g); rbox(w, 0.6, 0.22, 0.06, leatherBlk, 0, 0.62, -d / 2 + 0.11, g);
    for (const s of [-1, 1]) { rbox(0.2, 0.52, d, 0.06, leatherBlk, s * (w / 2 - 0.1), 0.34, 0, g); rbox(0.24, 0.12, d + 0.02, 0.06, leatherBlk, s * (w / 2 - 0.1), 0.6, 0.0, g); box(0.21, 0.18, d - 0.2, cordGrey, s * (w / 2 - 0.1), 0.18, 0.02, g); }
    for (const s of [-1, 1]) cyl(0.025, 0.02, 0.06, plasticBlk, s * (w / 2 - 0.1), 0.03, d / 2 - 0.1, g);
    rbox(w - 0.42, 0.16, d - 0.2, 0.06, cordGrey, 0, 0.41, 0.08, g);
    for (const s of [-1, 1]) rbox((w - 0.42) / 2, 0.5, 0.2, 0.1, cordGrey, s * (w - 0.42) / 4, 0.74, -d / 2 + 0.3, g, { rx: -0.18 });
    for (const s of [-1, 1]) rbox(0.42, 0.42, 0.13, 0.1, cordGrey, s * 0.22, 0.7, -d / 2 + 0.46, g, { rx: -0.25, rz: s * 0.15 }); }
  // the kitchen bin: black, a pedal bin with its lid
  { const g = piece('bin'); rbox(0.36, 0.62, 0.3, 0.06, plasticBlk, 0, 0.31, 0, g); rbox(0.37, 0.06, 0.31, 0.04, std({ color: srgb('#26262a'), roughness: 0.35 }), 0, 0.64, 0, g); box(0.1, 0.02, 0.06, plasticBlk, 0, 0.02, 0.17, g); }

  // ── Light: night, the downlights on, the floor lamps lit; the lights under the wall cupboards; the monitors and the lava lamp glowing ──
  const hemi = new THREE.HemisphereLight(srgb('#f4ece0'), srgb('#6a6058'), 0.75); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#8a8078'), 0.25); G.add(amb);
  const downs = [];
  for (const [z, shadow] of [[-2.0, true], [0.2, false], [2.6, false]]) {
    const s = new THREE.SpotLight(srgb('#fff2e0'), 16, 7, 1.15, 0.9, 2); s.position.set(0, HT - 0.05, z); s.target.position.set(0, 0, z); G.add(s); G.add(s.target);
    if (shadow) { s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.bias = -0.0004; s.shadow.normalBias = 0.02; s.shadow.camera.near = 0.3; s.shadow.camera.far = 7; }
    downs.push(s); }
  const under = new THREE.PointLight(srgb('#fff0d8'), 1.2, 2.2, 2); under.position.set(1.1, 1.38, Z1 - 0.2); G.add(under);
  const scrL = new THREE.PointLight(srgb('#8ad0d0'), 0.5, 2, 2); scrL.position.set(-1.2, 1.2, -0.35); G.add(scrL);

  // ── Which side each thing goes with, for hiding the walls nearest the camera ──
  const bounds = { minX: X0, maxX: X1, minZ: Z0, maxZ: Z1, ht: HT };
  const sideOf = new Map();
  const resides = () => {
    sideOf.clear(); for (const k of ['N', 'S', 'E', 'W', 'C']) sideOf.set(sides[k], k);
    const REACH = 0.6, bx = new THREE.Box3(), c = new V3();
    for (const k in pieces) { const g = pieces[k].g; bx.setFromObject(g); if (bx.isEmpty()) continue; bx.getCenter(c);
      const d = { N: c.z - Z0, S: Z1 - c.z, W: c.x - X0, E: X1 - c.x }; let best = null; for (const s in d) if (d[s] < REACH && (!best || d[s] < d[best])) best = s; if (best) sideOf.set(g, best); }
  };
  resides();
  const IN = 0.3;
  const sidesAt = p => { const s = new Set(); if (p.z < Z0 + IN) s.add('N'); if (p.z > Z1 - IN) s.add('S'); if (p.x < X0 + IN) s.add('W'); if (p.x > X1 - IN) s.add('E'); if (p.y > HT - 0.2) s.add('C'); return s; };
  // ── Where someone would be: on the sofa, at the desk, in the armchair; at the door ──
  const spots = () => {
    const at = (k, x, z) => new V3(x, 0, z).applyMatrix4(pieces[k].g.matrixWorld).setY(0), yaw = k => L[k].ry || 0;
    return { sofa: { at: at('sofa', -0.4, 0.2), yaw: yaw('sofa') + Math.PI / 2, seatY: 0.49 }, desk: { at: at('deskChair', 0, 0.02), yaw: yaw('deskChair'), seatY: 0.52 },
      armchair: { at: at('armchair', 0, 0.12), yaw: yaw('armchair'), seatY: 0.49 }, door: { at: new V3(X0 + 0.45, 0, (DOOR.z0 + DOOR.z1) / 2), yaw: Math.PI / 2 } };
  };
  const views = {
    'Corner': [[1.6, 2.15, 3.3], [-0.5, 0.6, -1.6]], 'From the kitchen': [[0.15, 1.5, 3.05], [0, 1.0, -3.6]], 'From the window': [[0.2, 1.55, -3.2], [0, 1.0, 3.6]],
    'The TV wall': [[-1.3, 1.4, -0.7], [1.95, 1.0, -0.7]], 'The desk wall': [[1.25, 1.4, -1.3], [-1.95, 1.0, -1.3]], 'The desk': [[-0.55, 1.45, -0.35], [-1.9, 1.05, -0.35]],
    'The kitchen': [[-0.2, 1.6, 0.6], [0.6, 1.0, 3.75]], 'From above': [[0, 13, 0.02], [0, 0, 0]],
  };
  let t = 0;
  const setLow = on => { downs[0].castShadow = !on; };
  return { group: G, pieces, keys: Object.keys(LAYOUT), place, layout: () => JSON.parse(JSON.stringify(L)), spots, views, bounds, sideOf, sidesAt, resides, name: 'The living room',
    showMarks: () => {}, hasMarks: false, setLow,
    tick(dt) { t += dt; void lampLights; lavaWax.emissiveIntensity = 1.5 + 0.2 * Math.sin(t * 0.7); } };
}

root.LivingRoom = { build, ROOM, LAYOUT, LABELS };
})(typeof window !== 'undefined' ? window : globalThis);
