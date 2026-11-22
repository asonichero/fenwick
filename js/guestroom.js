// Fenwick Hall — the guest bedroom (Ch. 1, "The Dusty Hall": the upstairs room where Silas finds Goldie asleep, with half-eaten rations, spilled
// ink and a broken antique chair). 5.5 m by 6 m under a beamed plaster ceiling, an oak wainscot round it. Its layout is Project Meridian's
// Captain's quarters, piece for piece (the chair, the bed's edge, the writing table, the settle and every camera in the same place), so the
// posing tuned there carries over; everything in it is the Hall's.
//   West wall (−x): the bed's head, a half-tester (a canopy over the pillows, curtains at its sides, no posts at the foot to get in the way);
//   a writing table free-standing in front of the wall, its chair behind it. North (−z): the door; the fireplace; a clothes press in the
//   corner. East (+x): a settle under the window. South (+z): the bed along it, a second window (boarded up, as found), the washstand.
//   In the middle: a sturdy oak chair on a Turkey rug.
// Two states, as the GDD's evolving manor has it: setRestored(0) is the room as Silas finds it (grime, cobwebs, dust sheets, a cold hearth,
// a boarded window), setRestored(1) warm and lived in (limewash, a fire, the rug's colours back). setClues(true) lays out Ch. 1's clues.
// Private, as a bedroom: nobody watches a correction here.
//
//   const room = GuestRoom.build(scene) → { group, spots, key, cams, setLow, setTime, setRestored, setClues, sideOf, sidesAt, tick, … }
//   spots.bench: across the knee on the oak chair; spots.seats.bed: across the knee perched on the edge of the bed (her near arm up on the
//   mattress), its own aftercare there; spots.wall: standing, palms flat on the writing table; spots.after: the settle.
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3, K = root.Kit;
const X0 = -2.75, X1 = 2.75, ZS = -3, ZH = 3, HT = 2.9;      // west and east walls, the north wall (the door), the south, height
// the bed (from the west wall to BX1, from BZ to the south wall), its mattress's top; the writing table (its front edge at DX1, from DZ0 to
// DZ1), its top; the settle against the east wall (from SZ0 to SZ1). (All as the Captain's quarters, so the poses fit.)
const BX1 = X0 + 2.1, BZ = ZH - 1.5, MT = 0.5, DX0 = X0 + 0.85, DX1 = X0 + 1.45, DZ0 = -0.65, DZ1 = 0.45, DY = 0.76, SZ0 = -1.95, SZ1 = -0.35;

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const detail = [], dusty = [], clues = [], boards = [];
  const std = o => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.75, metalness: 0.02 }, o)), { grain: 0.05, scale: 8 });
  const box = (w, h, d, m, x, y, z, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; if (o && o.rx) b.rotation.x = o.rx; if (o && o.rz) b.rotation.z = o.rz; b.castShadow = !(o && o.noCast); b.receiveShadow = true; ((o && o.to) || G).add(b); if (o && o.detail) detail.push(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, rot, seg, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 16), m); c.position.set(x, y, z); if (rot) c.rotation.set(rot[0], rot[1], rot[2]); c.castShadow = !(o && o.noCast); c.receiveShadow = true; ((o && o.to) || G).add(c); if (o && o.detail) detail.push(c); return c; };
  const plane = (w, h, m, x, y, z, rx, ry, o) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx || 0, ry || 0, 0); p.receiveShadow = true; ((o && o.to) || G).add(p); return p; };

  // ── Materials ──
  const plasterM = std({ map: K.plasterTex('#e8dcc4', [2, 1.2]), roughness: 0.95 });
  const panelM = std({ map: K.panelTex('#6e4a2e', [1, 1]), roughness: 0.55 });
  const oak = std({ map: K.grain('#7a5434', [1, 1]), roughness: 0.5 }), oakDark = std({ map: K.grain('#4e3220', [1, 1]), roughness: 0.5 });
  const floorM = std({ map: K.boardsTex('#7a5a3c', [3, 3]), roughness: 0.7 });
  const ceilM = std({ map: K.plasterTex('#efe6d2', [3, 3]), roughness: 0.95 });
  const stone = std({ map: K.stoneTex, roughness: 0.9 }), brick = std({ map: K.brickTex, roughness: 0.95 });
  const iron = std({ color: srgb('#2a2624'), roughness: 0.5, metalness: 0.6 }), brass = std({ color: srgb('#b08a3e'), roughness: 0.35, metalness: 0.75 });
  const linen = std({ map: K.weave('#ece4d2', 'rgba(150,130,100,0.12)'), roughness: 0.95 }), quilt = std({ map: K.quiltTex, roughness: 0.95 });
  const drape = std({ map: K.weave('#5a2a2e', 'rgba(255,220,180,0.06)', [2, 4]), roughness: 0.95, side: THREE.DoubleSide });
  const cushion = std({ map: K.weave('#3e5a4a', 'rgba(255,240,210,0.08)'), roughness: 0.95 });
  const leather = std({ color: srgb('#6a3a26'), roughness: 0.6 });
  const marble = std({ color: srgb('#e6e0d6'), roughness: 0.25, metalness: 0.05 }), china = std({ color: srgb('#f2eee6'), roughness: 0.3 });
  const sheetM = std({ map: K.dustSheetTex, roughness: 1, side: THREE.DoubleSide });
  const webM = new THREE.MeshBasicMaterial({ map: K.cobwebTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const inkM = std({ color: srgb('#0c0c14'), roughness: 0.15, metalness: 0.1 });
  const rugFresh = K.rugTex(0.1), rugFaded = K.rugTex(0.75), rugM = std({ map: rugFresh, roughness: 0.95 });
  const viewDay = K.windowTex(false), viewNight = K.windowTex(true), viewM = new THREE.MeshBasicMaterial({ map: viewDay });
  const glowFire = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ff8a3a'), emissiveIntensity: 3 });
  const glowFlame = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ffd890'), emissiveIntensity: 4 });
  const ashM = std({ color: srgb('#4a4440'), roughness: 1 });

  // ── The shell: boards, a beamed plaster ceiling, plaster walls over an oak wainscot ──
  const floor = plane(X1 - X0, ZH - ZS, floorM, 0, 0, 0, -Math.PI / 2);
  plane(X1 - X0, ZH - ZS, ceilM, 0, HT, 0, Math.PI / 2);
  for (const x of [-1.2, 1.2]) box(0.2, 0.18, ZH - ZS, oakDark, x, HT - 0.09, 0);
  const walls = [];
  const wallRun = (len, x, z, ry) => {
    const n = Math.max(1, Math.round(len / 0.9)), pw = len / n, ps = [];
    for (let i = 0; i < n; i++) {
      const off = -len / 2 + pw * (i + 0.5), px = x + Math.cos(ry) * off, pz = z - Math.sin(ry) * off;
      ps.push(plane(pw, HT - 0.95, plasterM, px, 0.95 + (HT - 0.95) / 2, pz, 0, ry), plane(pw, 0.8, panelM, px, 0.15 + 0.4, pz, 0, ry), plane(pw, 0.15, oakDark, px, 0.075, pz, 0, ry));
    }
    walls.push(ps);
  };
  wallRun(X1 - X0, 0, ZS, 0); wallRun(ZH - ZS, X0, 0, Math.PI / 2); wallRun(ZH - ZS, X1, 0, -Math.PI / 2); wallRun(X1 - X0, 0, ZH, Math.PI);
  // (the dado rail and a cornice, round the room)
  for (const [len, x, z, ry] of [[X1 - X0, 0, ZS + 0.015, 0], [X1 - X0, 0, ZH - 0.015, 0], [ZH - ZS, X0 + 0.015, 0, Math.PI / 2], [ZH - ZS, X1 - 0.015, 0, Math.PI / 2]]) {
    box(len, 0.045, 0.03, oak, x, 0.96, z, { ry, noCast: true }); box(len, 0.08, 0.05, std({ color: srgb('#e2d8c2'), roughness: 0.9 }), x, HT - 0.04, z, { ry, noCast: true });
  }

  // ── North wall: the door (planked oak, an iron latch and strap hinges), the fireplace, the clothes press in the corner ──
  const MX = X0 + 1.05;
  box(1.1, 2.18, 0.1, oakDark, MX, 1.09, ZS + 0.05); box(0.9, 2.02, 0.05, std({ map: K.grain('#6a4428', [1, 3]), roughness: 0.6 }), MX, 1.01, ZS + 0.1);
  for (const y of [0.4, 1.6]) box(0.5, 0.04, 0.012, iron, MX - 0.18, y, ZS + 0.13, { detail: true });
  box(0.04, 0.12, 0.03, iron, MX + 0.34, 1.0, ZS + 0.14, { detail: true }); box(0.14, 0.02, 0.02, iron, MX + 0.3, 1.04, ZS + 0.15, { detail: true });
  const FX = 0.75, FW = 1.5;
  box(FW, 1.25, 0.32, stone, FX, 0.625, ZS + 0.16);                       // (the surround, the firebox cut into it)
  box(FW + 0.16, 0.08, 0.38, oakDark, FX, 1.29, ZS + 0.19);               // (the mantel shelf)
  box(0.82, 0.78, 0.02, brick, FX, 0.42, ZS + 0.33, { noCast: true });     // (the firebox's mouth, dark brick)
  box(1.7, 0.04, 0.6, stone, FX, 0.02, ZS + 0.6, { noCast: true });        // (the hearthstone)
  for (const dx of [-0.25, 0.25]) { box(0.04, 0.2, 0.22, iron, FX + dx, 0.12, ZS + 0.42, { detail: true }); cyl(0.022, 0.022, 0.04, brass, FX + dx, 0.24, ZS + 0.52, null, 10, { detail: true }); }
  const logs = []; for (const [dx, a] of [[-0.12, 0.3], [0.1, -0.25], [0, 0.05]]) logs.push(cyl(0.05, 0.05, 0.5, std({ map: K.grain('#5a3a22', [1, 1]), roughness: 0.9 }), FX + dx, 0.13 + (dx === 0 ? 0.08 : 0), ZS + 0.42, [0, a, Math.PI / 2], 10, { noCast: true }));
  const embers = box(0.5, 0.03, 0.18, glowFire, FX, 0.08, ZS + 0.42, { noCast: true }), ash = box(0.55, 0.03, 0.2, ashM, FX, 0.075, ZS + 0.42, { noCast: true });
  const flames = []; for (let i = 0; i < 5; i++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.05 + 0.02 * (i % 2), 0.22 + 0.06 * (i % 3), 8), glowFlame); fl.position.set(FX - 0.18 + i * 0.09, 0.27, ZS + 0.42); G.add(fl); flames.push(fl); }
  for (const dx of [-0.6, 0.6]) { cyl(0.03, 0.04, 0.05, brass, FX + dx, 1.36, ZS + 0.2, null, 12, { detail: true }); cyl(0.012, 0.012, 0.16, china, FX + dx, 1.46, ZS + 0.2, null, 8, { detail: true }); }
  // (over the mantel, a picture: the great-uncle's, as found under a dust sheet)
  box(0.8, 0.62, 0.04, std({ map: K.grain('#8a6a2a', [1, 1]), roughness: 0.4, metalness: 0.3 }), FX, 1.85, ZS + 0.04);
  plane(0.68, 0.5, std({ color: srgb('#3a3226'), roughness: 0.8 }), FX, 1.85, ZS + 0.065);
  dusty.push(box(0.86, 0.7, 0.06, sheetM, FX, 1.85, ZS + 0.09, { noCast: true }));
  const LX = X1 - 0.55;
  box(1.0, 2.05, 0.6, oak, LX, 1.025, ZS + 0.3); for (const dx of [-0.24, 0.24]) box(0.44, 1.5, 0.02, panelM, LX + dx, 1.15, ZS + 0.61, { noCast: true });
  box(1.06, 0.08, 0.64, oakDark, LX, 2.09, ZS + 0.32); box(0.02, 0.12, 0.03, brass, LX - 0.03, 1.1, ZS + 0.63, { detail: true }); box(0.02, 0.12, 0.03, brass, LX + 0.03, 1.1, ZS + 0.63, { detail: true });
  dusty.push(box(1.1, 1.6, 0.7, sheetM, LX, 1.3, ZS + 0.33, { noCast: true }));

  // ── The bed: a half-tester, its head on the west wall, along the south; a tall panelled headboard, the canopy over the pillows with its
  // curtains, a linen mattress, bolster and pillows, a patchwork quilt. Its own group, so it never hides with the walls: they're perched on it. ──
  const bed = new THREE.Group(); G.add(bed);
  const bl = BX1 - X0, bw = ZH - BZ, bcx = (X0 + BX1) / 2, bcz = (BZ + ZH) / 2;
  box(bl, 0.32, bw, oak, bcx, 0.16, bcz, { to: bed });
  box(0.06, 0.38, bw, oakDark, BX1 - 0.03, 0.31, bcz, { to: bed });                       // (a low footboard)
  box(bl - 0.06, MT - 0.32, bw - 0.06, linen, bcx, (0.32 + MT) / 2, bcz, { to: bed });
  const quiltTidy = box(1.25, 0.06, bw - 0.02, quilt, BX1 - 0.68, MT + 0.03, bcz, { to: bed });
  box(0.3, 0.14, bw - 0.12, linen, X0 + 0.22, MT + 0.07, bcz, { to: bed });
  for (const z of [bcz - 0.33, bcz + 0.33]) box(0.38, 0.11, 0.55, linen, X0 + 0.5, MT + 0.07, z, { to: bed });
  box(0.08, 1.55, bw, oakDark, X0 + 0.04, MT + 0.75, bcz); for (const dz of [-0.5, 0, 0.5]) box(0.02, 1.0, 0.4, panelM, X0 + 0.09, MT + 0.8, bcz + dz, { noCast: true });
  box(0.9, 0.16, bw + 0.04, oakDark, X0 + 0.45, 2.3, bcz); box(0.9, 0.02, bw - 0.04, drape, X0 + 0.45, 2.21, bcz, { noCast: true });
  for (const z of [BZ + 0.06, ZH - 0.06]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.7, 8, 1), drape); const p = c.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.03 * Math.sin(p.getX(i) * 26)); c.geometry.computeVertexNormals(); c.position.set(X0 + 0.42, 1.38, z); c.castShadow = true; G.add(c); }
  // (as found: she slept in it: the quilt rucked and thrown back, the pillow dented)
  const rucked = new THREE.Group(); G.add(rucked);
  { const g = new THREE.PlaneGeometry(1.4, bw + 0.1, 14, 10), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, 0.05 + 0.05 * Math.sin(x * 7 + y * 3) * Math.cos(y * 5) + 0.08 * Math.exp(-((x + 0.45) ** 2) * 20)); } g.computeVertexNormals();
    const q = new THREE.Mesh(g, quilt); q.rotation.x = -Math.PI / 2; q.position.set(BX1 - 0.75, MT + 0.01, bcz); q.castShadow = true; q.receiveShadow = true; rucked.add(q); }
  clues.push(rucked);

  // ── The writing table, free-standing in front of the west wall, facing the room: a slim oak top on turned legs, a drawer; a candlestick,
  // an inkstand, a quill, a sheaf of paper; its chair behind it. (Its front edge is where she stands.) ──
  const dz = (DZ0 + DZ1) / 2, dl = DZ1 - DZ0, dd = DX1 - DX0, dx = (DX0 + DX1) / 2;
  box(dd, 0.035, dl, oak, dx, DY - 0.018, dz); box(dd - 0.08, 0.1, dl - 0.08, oak, dx, DY - 0.085, dz);
  box(0.012, 0.06, 0.4, oakDark, DX1 - 0.035, DY - 0.085, dz, { noCast: true }); box(0.02, 0.02, 0.05, brass, DX1 - 0.025, DY - 0.085, dz, { detail: true });
  for (const [x, z] of [[DX0 + 0.05, DZ0 + 0.05], [DX0 + 0.05, DZ1 - 0.05], [DX1 - 0.05, DZ0 + 0.05], [DX1 - 0.05, DZ1 - 0.05]]) cyl(0.024, 0.016, DY - 0.13, oak, x, (DY - 0.13) / 2, z, null, 10);
  const candleT = new THREE.Group(); G.add(candleT);
  cyl(0.045, 0.055, 0.02, brass, DX0 + 0.14, DY + 0.01, DZ1 - 0.12, null, 14, { detail: true, to: candleT }); cyl(0.012, 0.016, 0.12, brass, DX0 + 0.14, DY + 0.08, DZ1 - 0.12, null, 10, { detail: true, to: candleT });
  cyl(0.013, 0.013, 0.12, china, DX0 + 0.14, DY + 0.2, DZ1 - 0.12, null, 8, { detail: true, to: candleT });
  const flameT = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), glowFlame); flameT.scale.y = 2; flameT.position.set(DX0 + 0.14, DY + 0.28, DZ1 - 0.12); candleT.add(flameT);
  box(0.12, 0.03, 0.08, oakDark, DX0 + 0.16, DY + 0.015, dz - 0.18, { detail: true }); cyl(0.018, 0.02, 0.04, inkM, DX0 + 0.16, DY + 0.05, dz - 0.18, null, 10, { detail: true });
  cyl(0.003, 0.002, 0.22, china, DX0 + 0.2, DY + 0.09, dz - 0.2, [0.9, 0, 0.3], 6, { detail: true });
  box(0.22, 0.01, 0.3, std({ color: srgb('#e8dcc0'), roughness: 0.9 }), dx + 0.04, DY + 0.005, dz + 0.04, { detail: true, noCast: true });
  // (as found: the ink spilled, run across the papers and off the edge; the rations she left, half-eaten, on a pewter plate)
  { const g = new THREE.CircleGeometry(0.12, 20), p = g.attributes.position; for (let i = 1; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)), r = 1 + 0.35 * Math.sin(a * 5) + 0.2 * Math.sin(a * 11); p.setXY(i, p.getX(i) * r, p.getY(i) * r * 0.7); }
    const spill = new THREE.Mesh(g, inkM); spill.rotation.x = -Math.PI / 2; spill.position.set(dx + 0.02, DY + 0.012, dz - 0.08); G.add(spill); clues.push(spill);
    const drip = box(0.006, 0.12, 0.03, inkM, DX1 + 0.003, DY - 0.06, dz - 0.1, { noCast: true }); clues.push(drip);
    const pot = cyl(0.018, 0.02, 0.04, inkM, DX0 + 0.3, DY + 0.02, dz - 0.02, [Math.PI / 2, 0, 0.6], 10); clues.push(pot); }
  { const plate = cyl(0.11, 0.1, 0.012, std({ color: srgb('#8a8a86'), roughness: 0.35, metalness: 0.6 }), dx + 0.02, DY + 0.006, DZ0 + 0.15, null, 20); clues.push(plate);
    const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10, 0, Math.PI), std({ color: srgb('#b8844a'), roughness: 0.8 })); loaf.scale.set(1, 0.7, 1); loaf.rotation.y = 0.4; loaf.position.set(dx, DY + 0.014, DZ0 + 0.14); G.add(loaf); clues.push(loaf);
    const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12, 1, false, 0, 1.2), std({ color: srgb('#e8c868'), roughness: 0.6 })); cheese.position.set(dx + 0.06, DY + 0.032, DZ0 + 0.2); G.add(cheese); clues.push(cheese);
    const core = cyl(0.01, 0.01, 0.05, std({ color: srgb('#e8dcb0'), roughness: 0.7 }), dx + 0.09, DY + 0.035, DZ0 + 0.08, [0, 0, Math.PI / 2], 8); clues.push(core); }
  // (the writing chair behind it: oak, a rush seat, a ladder back)
  const WCX = X0 + 0.48, rush = std({ map: K.weave('#b89a5a', 'rgba(90,60,20,0.25)'), roughness: 0.95 });
  box(0.44, 0.04, 0.44, rush, WCX, 0.46, dz); for (const [ox, oz] of [[-0.19, -0.19], [-0.19, 0.19], [0.19, -0.19], [0.19, 0.19]]) cyl(0.018, 0.016, 0.45, oak, WCX + ox, 0.225, dz + oz, null, 8);
  for (const oz of [-0.19, 0.19]) cyl(0.018, 0.018, 0.55, oak, WCX - 0.19, 0.74, dz + oz, null, 8); for (const y of [0.66, 0.8, 0.94]) box(0.025, 0.06, 0.38, oak, WCX - 0.19, y, dz);

  // ── The east wall: a settle under the window (a high-backed oak bench, a squab cushion and two more against its back), the window's
  // curtains either side ──
  const sz = (SZ0 + SZ1) / 2, sw = SZ1 - SZ0, SX = X1 - 0.425;
  const settle = [box(0.85, 0.3, sw, oak, SX, 0.15, sz), box(0.7, 0.12, sw - 0.06, cushion, SX - 0.06, 0.36, sz), box(0.1, 0.62, sw, oakDark, X1 - 0.08, 0.6, sz)];
  for (const z of [sz - sw / 4, sz + sw / 4]) settle.push(box(0.14, 0.36, sw / 2 - 0.08, cushion, X1 - 0.19, 0.6, z));
  for (const z of [SZ0 - 0.02, SZ1 + 0.02]) settle.push(box(0.85, 0.52, 0.06, oakDark, SX, 0.48, z));
  for (const m of settle) m.userData.keep = true;
  const VW = 1.3, VH = 1.15, VY = 1.62;
  box(0.08, VH + 0.14, VW + 0.14, oakDark, X1 - 0.03, VY, sz); plane(VW, VH, viewM, X1 - 0.075, VY, sz, 0, -Math.PI / 2);
  box(0.06, 0.04, VW + 0.06, oakDark, X1 - 0.08, VY, sz, { noCast: true }); box(0.06, VH, 0.04, oakDark, X1 - 0.08, VY, sz, { noCast: true });
  box(0.16, 0.04, VW + 0.2, oak, X1 - 0.1, VY - VH / 2 - 0.05, sz);
  for (const z of [sz - VW / 2 - 0.2, sz + VW / 2 + 0.2]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.7, 6, 1), drape); const p = c.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, 0.025 * Math.sin(p.getX(i) * 30)); c.geometry.computeVertexNormals(); c.rotation.y = -Math.PI / 2; c.position.set(X1 - 0.09, VY - 0.1, z); c.castShadow = true; G.add(c); }
  box(0.05, 0.05, VW + 1.0, oakDark, X1 - 0.09, VY + VH / 2 + 0.12, sz, { noCast: true });

  // ── The south wall: a second window between the bed and the washstand (boarded up, as found), the washstand (a marble top, a jug in its
  // basin, a glass over it) ──
  const WX = 0.35;
  box(1.0, 1.3, 0.08, oakDark, WX, 1.6, ZH - 0.03); plane(0.86, 1.16, viewM, WX, 1.6, ZH - 0.075, 0, Math.PI);
  box(0.92, 0.04, 0.16, oak, WX, 0.92, ZH - 0.1);
  for (const [y, a] of [[1.25, 0.05], [1.5, -0.04], [1.78, 0.03], [2.0, -0.06]]) boards.push(box(1.1, 0.14, 0.03, std({ map: K.grain('#6a5238', [1, 1]), roughness: 0.9 }), WX, y, ZH - 0.1, { rz: a }));
  const SWX = 1.6;
  box(0.75, 0.04, 0.45, marble, SWX, 0.82, ZH - 0.26); box(0.7, 0.78, 0.4, oak, SWX, 0.4, ZH - 0.25);
  cyl(0.15, 0.1, 0.08, china, SWX, 0.88, ZH - 0.26, null, 20, { detail: true }); cyl(0.05, 0.07, 0.2, china, SWX + 0.04, 0.98, ZH - 0.26, null, 14, { detail: true });
  box(0.5, 0.62, 0.03, std({ map: K.grain('#8a6a2a', [1, 1]), roughness: 0.4, metalness: 0.3 }), SWX, 1.45, ZH - 0.02); plane(0.42, 0.54, std({ color: srgb('#9aa6aa'), roughness: 0.08, metalness: 0.9 }), SWX, 1.45, ZH - 0.036, 0, Math.PI);
  // (the broken antique chair, as found: a gilt side chair on its back by the washstand, a leg off it, beside it; restored, it's gone to be mended)
  const broken = new THREE.Group(); broken.position.set(1.0, 0, 2.15); broken.rotation.y = 0.5; G.add(broken); clues.push(broken);
  { const gilt = std({ color: srgb('#c8a050'), roughness: 0.35, metalness: 0.6 }), silk = std({ color: srgb('#7a8aa8'), roughness: 0.7 });
    const ch = new THREE.Group(); ch.rotation.x = -Math.PI / 2 + 0.25; ch.position.y = 0.06; broken.add(ch);
    box(0.4, 0.05, 0.4, silk, 0, 0.42, 0, { to: ch }); for (const [ox, oz] of [[-0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) cyl(0.015, 0.01, 0.42, gilt, ox, 0.21, oz, null, 8, { to: ch });
    box(0.36, 0.5, 0.03, silk, 0, 0.72, -0.19, { to: ch }); box(0.4, 0.04, 0.04, gilt, 0, 0.98, -0.19, { to: ch });
    cyl(0.015, 0.01, 0.42, gilt, 0.35, 0.02, 0.25, [0, 0, Math.PI / 2 - 0.2], 8, { to: broken }); }

  // ── The middle: the sturdy oak chair (no arms, a leather seat, a plain back) on the rug ──
  const CX = X1 - 2.4, CZ = sz;
  box(0.48, 0.06, 0.48, leather, CX, 0.45, CZ); box(0.48, 0.03, 0.48, oak, CX, 0.41, CZ);
  for (const [ox, oz] of [[-0.21, -0.21], [-0.21, 0.21], [0.21, -0.21], [0.21, 0.21]]) box(0.045, 0.41, 0.045, oak, CX + ox, 0.205, CZ + oz);
  box(0.04, 0.5, 0.44, oak, CX - 0.22, 0.72, CZ); box(0.03, 0.08, 0.36, oakDark, CX - 0.21, 0.92, CZ);
  const rug = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.012, 1.9), rugM); rug.position.set(X1 - 1.5, 0.006, sz); rug.receiveShadow = true; G.add(rug);

  // ── Cobwebs in the upper corners and under the canopy, as found ──
  for (const [x, z, ry] of [[X0 + 0.01, ZS + 0.01, 0], [X1 - 0.01, ZS + 0.01, -Math.PI / 2], [X1 - 0.01, ZH - 0.01, Math.PI], [X0 + 0.01, ZH - 0.01, Math.PI / 2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), webM); w.position.set(x + Math.sin(ry + Math.PI / 4) * 0.2, HT - 0.22, z + Math.cos(ry + Math.PI / 4) * 0.2); w.rotation.y = ry + Math.PI / 4; G.add(w); dusty.push(w);
  }

  // ── Light. By day: the windows (a cool spill from the east one over the settle and the chair; the boarded south one lets through only
  // blades of it), a soft sky fill. By night: the fire, the candles on the writing table and the mantel, warm and low. ──
  const hemi = new THREE.HemisphereLight(srgb('#f2ead8'), srgb('#3a2e24'), 0.9); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#3a3028'), 0.5); G.add(amb);
  const key = new THREE.SpotLight(srgb('#fff0dc'), 7, 7, 1.1, 0.85, 2); key.position.set(0, HT - 0.1, 0); key.target.position.set(-0.4, 0, 0.1);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; key.shadow.camera.near = 0.2; key.shadow.camera.far = 6; G.add(key); G.add(key.target);
  const winE = new THREE.SpotLight(srgb('#dfe8f2'), 4, 6, 0.75, 0.8, 2); winE.position.set(X1 - 0.2, VY + 0.2, sz); winE.target.position.set(CX - 0.6, 0.4, sz + 0.3); G.add(winE); G.add(winE.target);
  const winS = new THREE.PointLight(srgb('#e8eef4'), 0.8, 3.5, 2); winS.position.set(WX, 1.6, ZH - 0.4); G.add(winS);
  const fireL = new THREE.PointLight(srgb('#ff9a4a'), 1.8, 5.5, 2); fireL.position.set(FX, 0.45, ZS + 0.75); G.add(fireL);
  const candleL = new THREE.PointLight(srgb('#ffc070'), 0.9, 3, 2); candleL.position.set(DX0 + 0.14, DY + 0.34, DZ1 - 0.12); G.add(candleL);
  const mantelL = new THREE.PointLight(srgb('#ffc070'), 0.6, 3, 2); mantelL.position.set(FX, 1.6, ZS + 0.4); G.add(mantelL);

  // ── Where things happen; the cameras as the Captain's quarters' (Project Meridian), which these spots copy ──
  const otkCams = face => [['Side', [0.05, 1.2, 2.4], [0.05, 0.76, 0.3]], ['Behind', [-1.4, 1.3, 0.67], [-0.05, 0.72, 0.3]], ['Seat', [-0.46, 1.5, 1.07], [-0.1, 0.82, 0.35]],
    ['Her face', ...face], ['Silas', [0.3, 0.92, 0.95], [0.0, 1.18, 0.1]], ['Room', [1.5, 1.9, 1.5], [0.0, 0.7, 0.25]]];
  const spots = {
    // (across the knee on the oak chair, facing the settle: she lies across his lap, her head toward the hearth, her legs toward the bed)
    bench: { at: new V3(CX - 0.04, 0, CZ), yaw: Math.PI / 2, turn: 0, seatY: 0.48, cams: otkCams([[0.62, 0.36, 0.75], [0.3, 0.55, 0.36]]) },
    seats: {
      // (or perched on the edge of the bed, facing into the room: she lies along it in front, her head toward the pillows, the near arm up
      // on the mattress; and the aftercare stays on the bed, side by side on its edge)
      bed: { at: new V3(-1.6, 0, BZ + 0.13), yaw: Math.PI, turn: 0, seatY: MT - 0.02, rest: { y: MT, edge: 0.11, mesh: [bed, rucked] },
        cams: otkCams([[0.42, 0.36, 1.05], [0.24, 0.55, 0.36]]).map(c => c[0] === 'Side' ? ['Side', [-1.8, 1.25, 1.7], [0.05, 0.76, 0.3]] : c[0] === 'Room' ? ['Room', [-1.6, 1.95, 1.9], [0.1, 0.7, 0.25]] : c),
        after: { at: new V3(-1.3, 0, BZ + 0.11), yaw: Math.PI, seatY: MT - 0.02, beside: new V3(-1.92, 0, BZ + 0.11),
          cams: [['Two-shot', [-1.3, 1.05, 1.6], [0.3, 0.85, 0.0]], ['Close', [-0.75, 1.05, 1.05], [0.3, 0.95, 0.0]]] } },
    },
    // (standing at the writing table's front edge, palms flat on it, bent well forward; Silas at her left. Not offered now: over it instead)
    wall: { at: new V3(DX1 + 0.85, 0, dz), yaw: -Math.PI / 2, support: { kind: 'edge', y: DY + 0.01, d: 0.85, bend: 0.95, lines: 'writing' } },
    // (over the writing table: bent across its front edge, her hands holding its far edge, her feet on the floor; Silas at her left)
    table: { at: new V3(DX1 + 0.55, 0, dz), yaw: -Math.PI / 2, top: DY, d: 0.55, w: DZ1 - DZ0, len: DX1 - DX0, grip: 'far' },
    // (the aftercare, otherwise: the settle, side by side)
    after: { at: new V3(X1 - 0.52, 0, sz - 0.3), yaw: -Math.PI / 2, seatY: 0.44, beside: new V3(X1 - 0.52, 0, sz + 0.32) },
    watch: [],
    corner: { at: new V3(X1 - 0.4, 0, 0.6), yaw: -Math.PI / 2 },
  };

  // ── State: the time of day, how far the room's restored, the clues, low-CPU ──
  const wallsMerged = walls.map(ps => { const ms = K.merged(ps); for (const m of ms) { m.visible = false; G.add(m); } return ms; });
  const meshes = []; G.traverse(o => { if (o.isMesh) meshes.push(o); });
  const cast0 = new Map(meshes.map(m => [m, m.castShadow]));
  let low = false, time = 'day', restored = 1, showClues = false, t = 0;
  const lit = () => restored >= 0.5;
  const tint = (m, a, b) => m.color.copy(srgb(a)).lerp(srgb(b), restored);
  function apply() {
    const day = time === 'day', found = restored < 0.5;
    for (const m of meshes) m.castShadow = low ? false : cast0.get(m);
    for (const d of detail) d.visible = !low;
    walls.forEach((ps, i) => { for (const p of ps) p.visible = !low; for (const m of wallsMerged[i]) m.visible = low; });
    // (as found: grime on the plaster and the boards, the rug sun-faded, cobwebs and dust sheets, the south window boarded, the hearth cold)
    tint(plasterM, '#a89a80', '#ffffff'); tint(ceilM, '#a89a84', '#ffffff'); tint(floorM, '#8a8076', '#ffffff'); tint(panelM, '#9a8a7a', '#ffffff');
    rugM.map = restored < 0.5 ? rugFaded : rugFresh; rugM.needsUpdate = true;
    for (const d of dusty) d.visible = found; for (const b of boards) b.visible = restored < 0.35;
    for (const f of flames) f.visible = lit(); embers.visible = lit(); ash.visible = !lit(); for (const l of logs) l.visible = lit();
    for (const c of clues) c.visible = showClues; quiltTidy.visible = !showClues;
    viewM.map = day ? viewDay : viewNight; viewM.needsUpdate = true;
    const boarded = restored < 0.35;
    key.intensity = day ? (found ? 3.5 : 5) : 0.35; key.color.copy(srgb(day ? '#fff0dc' : '#ffb070'));
    winE.intensity = day ? 4 : 0.25; winE.color.copy(srgb(day ? '#dfe8f2' : '#5a6a9a')); winS.intensity = day ? (boarded ? 0.25 : 0.9) : 0.08;
    fireL.intensity = lit() ? (day ? 1.0 : 2.6) : 0; candleL.intensity = day ? 0 : 1.1; mantelL.intensity = day || found ? 0 : 0.6; flameT.visible = !day;
    hemi.color.copy(srgb(day ? '#f2ead8' : '#c8a882')); hemi.intensity = (day ? (found ? 0.75 : 1.0) : 0.45) + (low ? 0.3 : 0);
    amb.intensity = day ? 0.5 : 0.3;
    const sz_ = low ? 1024 : 2048;
    if (key.shadow.mapSize.x !== sz_) { key.shadow.mapSize.set(sz_, sz_); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  }
  const setLow = on => { low = !!on; apply(); }, setTime = v => { time = v === 'night' ? 'night' : 'day'; apply(); };
  const setRestored = r => { restored = Math.max(0, Math.min(1, +r || 0)); apply(); }, setClues = on => { showClues = !!on; apply(); };
  apply();
  const { sideOf, sidesAt } = K.roomSides(G, { minX: X0, maxX: X1, minZ: ZS, maxZ: ZH, ht: HT }, [floor, bed]);
  // (at the writing table, her face from across it, low over its top; beside the writing chair, clear of the candlestick)
  const cams = { wall: [['Side', [-1.9, 1.4, -0.05], [0.1, 1.0, 0.1]], ['Behind', [-0.35, 1.2, -1.25], [0, 0.85, 0.15]], ['Seat', [-0.55, 1.25, -0.75], [0, 0.88, 0]],
    ['Her face', [0.5, 0.92, 1.9], [0.0, 1.02, 0.5]], ['Silas', [-0.4, 1.42, -0.25], [0.43, 1.5, -0.07]], ['Room', [1.05, 1.9, -2.95], [-0.15, 0.8, -0.15]]] };
  return { group: G, spots, key, cams, setLow, setTime, setRestored, setClues, get time() { return time; }, get restored() { return restored; }, get clues() { return showClues; },
    sideOf, sidesAt, name: 'Guest bedroom', private: true, bounds: { minX: X0 + 0.15, maxX: X1 - 0.15, minZ: ZS + 0.15, maxZ: ZH - 0.15 }, get low() { return low; },
    tick(dt) {
      t += dt; if (!lit()) return;
      const k = 0.82 + 0.12 * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 13.1 + 1.3) + 0.05 * Math.sin(t * 23.7);
      fireL.intensity = (time === 'day' ? 1.0 : 2.6) * k; glowFlame.emissiveIntensity = 3.4 + 1.2 * k;
      flames.forEach((f, i) => { f.scale.y = 0.8 + 0.35 * Math.sin(t * (6 + i) + i * 1.7); });
    } };
}

root.GuestRoom = { build };
})(typeof window !== 'undefined' ? window : globalThis);
