// Fenwick Hall — the ground floor as Silas finds it (Ch. 1, "The Dusty Hall"; docs/gdd.md, "Chapter 1 in detail"): the entrance hall and the
// great hall beyond it, and outside, the front of the house, its porch and the overgrown sweep before it, the Fenwood all round. Midday.
//   The entrance hall (6 m by 5 m, 4 m high): the front door in the south wall; the main stair up along the north wall; in the west wall the
//   study door, locked (Ch. 3's); in the east, the wide door through to the great hall. Furniture under dust sheets; a long-case clock,
//   stopped; the great-uncle's portrait. The great hall (9 m by 7 m, 5 m to its beams): its great hearth in the east wall, cold; the long
//   table and its benches, the settle and the stools by the hearth, a dresser, all as they were left; its south windows shuttered; in the
//   north wall, the door to the kitchens and the servants' wing, barred (Ch. 4's). Outside: the house's front, two storeys over the entrance
//   and the great hall's tall single storey, in grey stone under its roof; the porch; the gravel sweep gone to weeds; the trees.
//   What can be put right in the great hall (its dust sheets off, its shutters open, its hearth cleared and lit, a pot over it) is each its
//   own state; the room's restoration (0–1) follows from them (setRestored for all at once).
//
//   const fh = FenwickHall.build(scene) → { group, spots(), points, doors: { front, great, study, kitchens }, door (the front), bounds, sideOf,
//     sidesAt(p), walk: { areas, blocks, doorways }, state: { sheets, shutters, hearth, fire, pot }, set(k, v), restored(), setRestored(k), reset(),
//     setLow(on), tick(dt), name }
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3, K = root.Kit;
// (the entrance hall; the great hall east of it; the wall's thickness)
const E = { x0: -3, x1: 3, z0: -2.5, z1: 2.5, ht: 4 }, G2 = { x0: 3, x1: 12, z0: -3.5, z1: 3.5, ht: 5 }, T = 0.35;
const FRONT = { x: 0, w: 1.3, h: 2.6 }, GREAT = { z: 0.6, w: 1.6, h: 2.8 }, STUDY = { z: 0.2, w: 1.0, h: 2.2 }, KITCH = { x: 8.6, w: 1.0, h: 2.2 };
const HEARTH = { z: 0, w: 2.2, h: 1.6, d: 0.9 };      // the great hearth's opening, in the great hall's east wall
const STAIR = { x0: -2.5, x1: 2.3, z0: -2.5, z1: -1.4, rise: 3.6 };      // up along the north wall, east to west

function build(scene) {
  const Gr = new THREE.Group(); scene.add(Gr);
  const std = o => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0.02 }, o)), { grain: 0.05, scale: 8 });
  const tex = (t, r) => { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(r[0], r[1]); return c; };
  // (as found: the plaster grimed, the boards and flags dull with dust)
  const plasterM = std({ map: K.plasterTex('#b8ad96', [1.5, 1]), roughness: 0.95 }), boardsM = std({ map: K.boardsTex('#5a4230', [3, 3]), roughness: 0.85 });
  const flagsM = std({ map: tex(K.stoneTex, [3, 3]), roughness: 0.95, color: srgb('#a89c8a') }), stoneM = std({ map: tex(K.stoneTex, [1, 1]), roughness: 0.92 });
  const facadeM = std({ map: tex(K.stoneTex, [0.55, 0.55]), roughness: 0.95, color: srgb('#cfc8b8') });      // (the walls' UVs are in metres: a stone's size)
  // (a door's leaf: its boards upright, the grain running up them)
  const doorM = std({ map: (t => { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.repeat.set(1, 4); return t; })(K.grain('#3a2513', [1, 1])), roughness: 0.78 });
  const oak = std({ map: K.grain('#5e3e26', [1, 1]), roughness: 0.6 }), oakDark = std({ map: K.grain('#36220f', [1, 1]), roughness: 0.6 }), beamM = std({ map: K.grain('#2e1e12', [1, 1]), roughness: 0.7 });
  const iron = std({ color: srgb('#24211e'), roughness: 0.5, metalness: 0.6 }), pewter = std({ color: srgb('#8a8a86'), roughness: 0.45, metalness: 0.6 });
  const sheetM = std({ map: K.dustSheetTex, roughness: 1, side: THREE.DoubleSide }), webM = new THREE.MeshBasicMaterial({ map: K.cobwebTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.7 });
  // (glass: from inside, the day through it; from outside, dark, catching the sky)
  const glassDay = std({ map: K.windowTex(false), emissive: srgb('#cfd8dc'), emissiveIntensity: 0.5, roughness: 0.3 }), glassOut = std({ color: srgb('#3a4450'), roughness: 0.15, metalness: 0.4 }), dark = new THREE.MeshStandardMaterial({ color: srgb('#0c0a08'), roughness: 1 });
  const ashM = std({ color: srgb('#5a5650'), roughness: 1 }), slateM = std({ color: srgb('#4a4a50'), roughness: 0.8 }), ivyM = std({ color: srgb('#3a5a2a'), roughness: 0.9 });
  const flameM = new THREE.MeshStandardMaterial({ color: srgb('#ffd27a'), emissive: srgb('#ffa040'), emissiveIntensity: 4, roughness: 1 });
  const box = (w, h, d, m, x, y, z, to, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; if (o && o.rx) b.rotation.x = o.rx; if (o && o.rz) b.rotation.z = o.rz;
    b.castShadow = !(o && o.noCast); b.receiveShadow = true; (to || Gr).add(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, to, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, (o && o.seg) || 14), m); c.position.set(x, y, z); if (o && o.rot) c.rotation.set(o.rot[0], o.rot[1], o.rot[2]); c.castShadow = true; c.receiveShadow = true; (to || Gr).add(c); return c; };
  const sides = { N: new THREE.Group(), S: new THREE.Group(), E: new THREE.Group(), W: new THREE.Group(), C: new THREE.Group(), GN: new THREE.Group(), GS: new THREE.Group(), GE: new THREE.Group(), GC: new THREE.Group(), out: new THREE.Group() };
  for (const k in sides) Gr.add(sides[k]);

  // ── The shell: each wall a slab cut by its openings ──
  const rect = (u0, v0, u1, v1) => { const p = new THREE.Path(); p.moveTo(u0, v0); p.lineTo(u1, v0); p.lineTo(u1, v1); p.lineTo(u0, v1); p.closePath(); return p; };
  function wall(len, ht, holes, to, place, m) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, ht); s.lineTo(0, ht); s.closePath(); for (const h of holes) s.holes.push(h);
    const w = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }), m || plasterM); w.castShadow = true; w.receiveShadow = true; place(w); to.add(w); return w;
  }
  // (the entrance hall: south (the front door and a window either side), north, west (the study door), and the east wall (the great hall's door)
  // shared with the great hall: it runs the great hall's height)
  const winE = [-2.0, 2.0];
  wall(E.x1 - E.x0 + 2 * T, E.ht, [rect(T + FRONT.x - FRONT.w / 2 - E.x0, 0.001, T + FRONT.x + FRONT.w / 2 - E.x0, FRONT.h)].concat(winE.map(x => rect(T + x - E.x0 - 0.45, 1.1, T + x - E.x0 + 0.45, 3.0))), sides.S,
    w => { w.position.set(E.x0 - T, 0, E.z1); });
  // (and outside, the house's grey stone: a skin over the south walls' outer faces, cut as they are)
  const skin = (len, ht, holes, place) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, ht); s.lineTo(0, ht); s.closePath(); for (const h of holes) s.holes.push(h);
    const w = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }), facadeM); w.castShadow = true; w.receiveShadow = true; place(w); sides.out.add(w); };
  skin(E.x1 - E.x0 + 2 * T, E.ht, [rect(T + FRONT.x - FRONT.w / 2 - E.x0, 0.001, T + FRONT.x + FRONT.w / 2 - E.x0, FRONT.h)].concat(winE.map(x => rect(T + x - E.x0 - 0.45, 1.1, T + x - E.x0 + 0.45, 3.0))), w => { w.position.set(E.x0 - T, 0, E.z1 + T); });
  wall(E.x1 - E.x0 + 2 * T, E.ht, [], sides.N, w => { w.position.set(E.x0 - T, 0, E.z0 - T); });
  wall(E.z1 - E.z0, E.ht, [rect(E.z1 - STUDY.z - STUDY.w / 2, 0.001, E.z1 - STUDY.z + STUDY.w / 2, STUDY.h)], sides.W, w => { w.position.set(E.x0, 0, E.z1); w.rotation.y = Math.PI / 2; });
  wall(G2.z1 - G2.z0 + 2 * T, G2.ht, [rect(G2.z1 + T - GREAT.z - GREAT.w / 2, 0.001, G2.z1 + T - GREAT.z + GREAT.w / 2, GREAT.h)], sides.E, w => { w.position.set(E.x1, 0, G2.z1 + T); w.rotation.y = Math.PI / 2; });
  // (the great hall: south (three tall windows), north (the kitchens' door), east (the hearth's opening))
  const winG = [5.0, 7.5, 10.0];
  wall(G2.x1 - G2.x0 + T, G2.ht, winG.map(x => rect(x - G2.x0 - 0.55, 1.0, x - G2.x0 + 0.55, 3.8)), sides.GS, w => { w.position.set(G2.x0, 0, G2.z1); });
  skin(G2.x1 - G2.x0 + 2 * T, G2.ht, winG.map(x => rect(x - G2.x0 + T - 0.55, 1.0, x - G2.x0 + T + 0.55, 3.8)), w => { w.position.set(G2.x0 - T, 0, G2.z1 + T); });
  skin(G2.z1 - G2.z0 + 2 * T, G2.ht, [], w => { w.position.set(G2.x1 + T + 0.03, 0, G2.z1 + T); w.rotation.y = Math.PI / 2; });      // (and its east end, outside)
  wall(G2.x1 - G2.x0 + T, G2.ht, [rect(KITCH.x - G2.x0 - KITCH.w / 2, 0.001, KITCH.x - G2.x0 + KITCH.w / 2, KITCH.h)], sides.GN, w => { w.position.set(G2.x0, 0, G2.z0 - T); });
  wall(G2.z1 - G2.z0 + 2 * T, G2.ht, [rect(G2.z1 + T - HEARTH.z - HEARTH.w / 2, 0.001, G2.z1 + T - HEARTH.z + HEARTH.w / 2, HEARTH.h)], sides.GE, w => { w.position.set(G2.x1 + T, 0, G2.z1 + T); w.rotation.y = Math.PI / 2; }, stoneM);
  // (the floors: flags in the entrance, flags in the great hall; the ceilings: plaster over the entrance, beams and boards over the great hall)
  { const f = new THREE.Mesh(new THREE.PlaneGeometry(E.x1 - E.x0, E.z1 - E.z0), flagsM); f.rotation.x = -Math.PI / 2; f.position.set((E.x0 + E.x1) / 2, 0, 0); f.receiveShadow = true; Gr.add(f);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(G2.x1 - G2.x0, G2.z1 - G2.z0), flagsM); g.rotation.x = -Math.PI / 2; g.position.set((G2.x0 + G2.x1) / 2, 0.001, 0); g.receiveShadow = true; Gr.add(g);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(E.x1 - E.x0, E.z1 - E.z0), plasterM); c.rotation.x = Math.PI / 2; c.position.set(0, E.ht, 0); sides.C.add(c);
    const gc = new THREE.Mesh(new THREE.PlaneGeometry(G2.x1 - G2.x0, G2.z1 - G2.z0), boardsM); gc.rotation.x = Math.PI / 2; gc.position.set((G2.x0 + G2.x1) / 2, G2.ht, 0); sides.GC.add(gc);
    for (let x = G2.x0 + 1.2; x < G2.x1; x += 1.8) { box(0.28, 0.34, G2.z1 - G2.z0, beamM, x, G2.ht - 0.17, 0, sides.GC); } }      // (the great hall's beams)

  // ── Doors: oak, ledged; each opens, eased (to(k, ms)) ──
  const doors = {};
  function makeDoor(name, w, h, hinge, place, swing) {
    const D = { k: 0, from: 0, target: 0, t: 0, ms: 0, done: null, name };
    const leaf = new THREE.Group(); place(leaf);
    const lw = w - 0.04; box(lw, h - 0.02, 0.06, doorM, -lw / 2 * hinge, (h - 0.02) / 2, 0, leaf);
    for (const y of [0.4, h * 0.5, h - 0.4]) box(lw - 0.08, 0.1, 0.03, oak, -lw / 2 * hinge, y, -0.045, leaf);
    box(0.16, 0.03, 0.02, iron, -(lw - 0.12) * hinge, h * 0.42, -0.07, leaf); cyl(0.022, 0.022, 0.05, iron, -(lw - 0.08) * hinge, h * 0.42, -0.09, leaf, { rot: [Math.PI / 2, 0, 0] });
    const base = leaf.rotation.y, set = k => { D.k = k; leaf.rotation.y = base + swing * k; leaf.updateMatrixWorld(true); };
    D.set = k => { D.done = null; D.ms = 0; set(k); };
    D.to = (k, ms) => new Promise(res => { if (!ms) { set(k); res(); return; } Object.assign(D, { from: D.k, target: k, t: 0, ms, done: res }); });
    D.tick = dt => { if (!D.ms) return; D.t += dt * 1000; const u = Math.min(1, D.t / D.ms), e = u * u * (3 - 2 * u); set(D.from + (D.target - D.from) * e); if (u >= 1) { D.ms = 0; const d = D.done; D.done = null; if (d) d(); } };
    doors[name] = D; return D;
  }
  // (the front door, hung on its west side, swinging in (seen from within, from the east, it's back against the wall's edge, the day
  // through it); the great hall's, on its north side, into the great hall; the study's and the
  // kitchens', shut and staying so)
  // (hinge: +1, the leaf runs from its hinge to its own −x; −1, to its +x. swing: how far it turns, open)
  makeDoor('front', FRONT.w, FRONT.h, -1, l => { l.position.set(FRONT.x - FRONT.w / 2 + 0.02, 0, E.z1 - 0.05); sides.S.add(l); }, 1.45);
  makeDoor('great', GREAT.w, GREAT.h, -1, l => { l.position.set(E.x1 + T - 0.05, 0, GREAT.z - GREAT.w / 2 + 0.02); l.rotation.y = -Math.PI / 2; sides.E.add(l); }, 1.4);
  makeDoor('study', STUDY.w, STUDY.h, -1, l => { l.position.set(E.x0 + 0.05, 0, STUDY.z + STUDY.w / 2 - 0.02); l.rotation.y = Math.PI / 2; sides.W.add(l); }, 0);
  makeDoor('kitchens', KITCH.w, KITCH.h, -1, l => { l.position.set(KITCH.x - KITCH.w / 2 + 0.02, 0, G2.z0 + 0.05); sides.GN.add(l); }, 0);
  // (the kitchens' door barred: two planks nailed across it)
  for (const [y, r] of [[0.9, 0.18], [1.5, -0.14]]) box(KITCH.w + 0.3, 0.14, 0.04, oak, KITCH.x, y, G2.z0 + 0.13, sides.GN, { rz: r });
  // (frames round each opening)
  const frame = (to, x, z, w, h, rotY) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; to.add(g);
    box(0.09, h + 0.08, 0.12, oakDark, -w / 2 - 0.03, (h + 0.08) / 2, 0, g); box(0.09, h + 0.08, 0.12, oakDark, w / 2 + 0.03, (h + 0.08) / 2, 0, g); box(w + 0.15, 0.1, 0.12, oakDark, 0, h + 0.04, 0, g); };
  frame(sides.S, FRONT.x, E.z1 - 0.02, FRONT.w, FRONT.h, 0); frame(sides.E, E.x1 + T / 2, GREAT.z, GREAT.w, GREAT.h, Math.PI / 2); frame(sides.W, E.x0 + 0.02, STUDY.z, STUDY.w, STUDY.h, Math.PI / 2); frame(sides.GN, KITCH.x, G2.z0 + 0.02, KITCH.w, KITCH.h, 0);

  // ── Windows: the entrance hall's, leaded, dirty, letting in the day; the great hall's, shuttered (opened as it's put right) ──
  const pane = (w, h, x, y, z, to, ry) => { const i = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassDay); i.position.set(x, y, z); i.rotation.y = ry + Math.PI; to.add(i);
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassOut); o.position.set(x, y, z + 0.005 * Math.cos(ry)); o.rotation.y = ry; sides.out.add(o); };
  for (const x of winE) { pane(0.9, 1.9, x, 2.05, E.z1 + T * 0.6, sides.S, 0);
    box(1.0, 0.06, 0.3, oakDark, x, 1.08, E.z1 + 0.1, sides.S); }
  const shutters = [];
  for (const x of winG) {
    pane(1.1, 2.8, x, 2.4, G2.z1 + T * 0.6, sides.GS, 0);
    box(1.2, 0.06, 0.32, oakDark, x, 0.98, G2.z1 + 0.1, sides.GS);
    // (two leaves each, folding back into the reveal)
    const pair = [];
    for (const sx of [-1, 1]) { const h = new THREE.Group(); h.position.set(x + sx * 0.55, 2.4, G2.z1 + 0.04); sides.GS.add(h); box(0.55, 2.8, 0.04, oak, -sx * 0.275, 0, 0, h); for (const y of [-0.9, 0, 0.9]) box(0.5, 0.06, 0.02, oakDark, -sx * 0.275, y, -0.03, h); pair.push({ h, sx }); }
    shutters.push(pair);
  }

  // ── The stair, up along the entrance hall's north wall: treads and risers, a string, a handrail on its open side ──
  { const n = 18, run = (STAIR.x1 - STAIR.x0) / n, rise = STAIR.rise / n, wd = STAIR.z1 - STAIR.z0;
    for (let i = 0; i < n; i++) { const x = STAIR.x1 - (i + 0.5) * run, y = (i + 1) * rise; box(run + 0.02, 0.05, wd, oak, x, y - 0.025, (STAIR.z0 + STAIR.z1) / 2, sides.N); box(0.03, rise, wd, oakDark, x + run / 2, y - rise / 2, (STAIR.z0 + STAIR.z1) / 2, sides.N, { noCast: true }); }
    const len = Math.hypot(STAIR.x1 - STAIR.x0, STAIR.rise), ang = Math.atan2(STAIR.rise, STAIR.x1 - STAIR.x0);
    const string = box(len, 0.28, 0.07, oakDark, (STAIR.x0 + STAIR.x1) / 2, STAIR.rise / 2 - 0.05, STAIR.z1 + 0.03, sides.N); string.rotation.z = -ang;
    const rail = box(len, 0.07, 0.07, oak, (STAIR.x0 + STAIR.x1) / 2, STAIR.rise / 2 + 0.85, STAIR.z1 + 0.03, sides.N); rail.rotation.z = -ang;
    for (let i = 0; i <= n; i += 2) { const x = STAIR.x1 - i * run, y = i * rise; box(0.04, 0.9, 0.04, oak, x, y + 0.45, STAIR.z1 + 0.03, sides.N); }
    cyl(0.07, 0.08, 1.15, oakDark, STAIR.x1 + 0.05, 0.575, STAIR.z1 + 0.03, sides.N); }      // (the newel)

  // ── The entrance hall's things, as left: a hall table and two chairs under dust sheets, a long-case clock (stopped), a coat stand by the
  // door, a bench, the great-uncle's portrait beside the study door; cobwebs ──
  const sheeted = (w, h, d, x, z, to, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; (to || Gr).add(g);
    const s = box(w, h, d, sheetM, 0, h / 2, 0, g); s.scale.set(1, 1, 1); const skirt = box(w + 0.06, 0.08, d + 0.06, sheetM, 0, 0.04, 0, g, { noCast: true }); return g; };
  sheeted(1.4, 0.82, 0.6, 0.3, 0.2, Gr); sheeted(0.5, 1.0, 0.5, -1.0, 0.6, Gr, 0.3); sheeted(0.5, 1.0, 0.5, 1.6, 0.5, Gr, -0.4);
  { const g = new THREE.Group(); g.position.set(-2.7, 0, -1.0); g.rotation.y = Math.PI / 2; Gr.add(g); box(0.5, 2.1, 0.32, oakDark, 0, 1.05, 0, g); box(0.36, 0.36, 0.02, std({ color: srgb('#d8ccb0'), roughness: 0.6 }), 0, 1.75, 0.17, g);
    for (const a of [0.3, 2.1]) box(0.012, 0.13, 0.005, iron, 0.06 * Math.cos(a), 1.75 + 0.06 * Math.sin(a), 0.185, g, { rz: a, noCast: true }); }      // (the clock, its hands stopped)
  { const g = new THREE.Group(); g.position.set(1.3, 0, 2.15); Gr.add(g); cyl(0.03, 0.035, 1.8, oakDark, 0, 0.9, 0, g); for (let a = 0; a < 4; a++) box(0.22, 0.03, 0.03, oakDark, 0.1 * Math.cos(a * 1.57), 1.7, 0.1 * Math.sin(a * 1.57), g, { ry: -a * 1.57 }); }      // (a coat stand, bare)
  box(1.4, 0.44, 0.38, oak, -1.6, 0.22, 2.2);      // (a bench under the west window)
  // (the portrait: a man in a dark coat, gaunt, half his face in shadow, in a heavy gilt frame gone dull)
  const portraitTex = K.canvasTex(256, 320, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2a2218'); g.addColorStop(1, '#120e0a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#1a1612'; c.beginPath(); c.moveTo(w * 0.18, h); c.quadraticCurveTo(w * 0.5, h * 0.48, w * 0.82, h); c.fill();      // (the coat)
    c.fillStyle = '#c8b498'; c.beginPath(); c.ellipse(w * 0.5, h * 0.36, w * 0.15, h * 0.15, 0, 0, 7); c.fill();      // (the face)
    c.fillStyle = 'rgba(10,8,6,0.65)'; c.beginPath(); c.ellipse(w * 0.58, h * 0.36, w * 0.1, h * 0.16, 0, 0, 7); c.fill();      // (half in shadow)
    c.fillStyle = '#8a8478'; c.fillRect(w * 0.36, h * 0.2, w * 0.28, h * 0.05);      // (grey hair)
    c.fillStyle = '#e8e0d0'; c.fillRect(w * 0.45, h * 0.53, w * 0.1, h * 0.08);      // (the stock at his throat)
    c.fillStyle = 'rgba(200,190,170,0.08)'; for (let i = 0; i < 300; i++) c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  });
  { const g = new THREE.Group(); g.position.set(E.x0 + 0.06, 2.3, -1.15); g.rotation.y = Math.PI / 2; sides.W.add(g);
    box(0.92, 1.12, 0.06, std({ color: srgb('#7a6430'), roughness: 0.5, metalness: 0.5 }), 0, 0, 0, g, { noCast: true });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.95), std({ map: portraitTex, roughness: 0.7 })); p.position.z = 0.035; g.add(p); }
  const web = (x, y, z, ry, s, to) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8 * (s || 1), 0.8 * (s || 1)), webM); m.position.set(x, y, z); m.rotation.y = ry; (to || Gr).add(m); return m; };
  web(E.x0 + 0.42, E.ht - 0.42, E.z1 - 0.42, Math.PI * 0.75, 1, sides.S); web(E.x1 - 0.42, E.ht - 0.42, E.z0 + 0.42, -Math.PI * 0.25, 1, sides.N);

  // ── The great hall's things: the long table and its benches, the settle, the stools by the hearth, the dresser; dust sheets over the table
  // and the settle (off, as it's put right) ──
  const gsheets = [];
  { const tx = 7.2, tz = 0.4, tl = 4.6;
    box(tl, 0.07, 1.0, oak, tx, 0.76, tz); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.1, 0.72, 0.1, oakDark, tx + sx * (tl / 2 - 0.25), 0.36, tz + sz * 0.38);
    for (const sz of [-1, 1]) { box(tl - 0.4, 0.06, 0.3, oak, tx, 0.45, tz + sz * 0.8); for (const sx of [-1, 1]) box(0.06, 0.42, 0.24, oakDark, tx + sx * (tl / 2 - 0.5), 0.21, tz + sz * 0.8); }
    const s = box(tl + 0.2, 0.06, 1.2, sheetM, tx, 0.81, tz, Gr, { noCast: true }); const s2 = box(tl + 0.2, 0.5, 0.04, sheetM, tx, 0.56, tz + 0.6, Gr, { noCast: true }); const s3 = box(tl + 0.2, 0.5, 0.04, sheetM, tx, 0.56, tz - 0.6, Gr, { noCast: true });
    gsheets.push(s, s2, s3); }
  { const g = new THREE.Group(); g.position.set(10.6, 0, -2.4); g.rotation.y = Math.PI * 0.85; Gr.add(g);      // (the settle, angled to the hearth)
    box(1.6, 0.05, 0.5, oak, 0, 0.44, 0, g); box(1.6, 1.3, 0.06, oakDark, 0, 0.9, -0.24, g); for (const sx of [-1, 1]) box(0.06, 1.1, 0.5, oakDark, sx * 0.78, 0.55, 0, g);
    const s = box(1.75, 1.4, 0.62, sheetM, 0, 0.7, 0.02, g, { noCast: true }); gsheets.push(s); }
  // (the stools by the hearth: three-legged, plain; the one nearest the fire is the one she breaks, that evening)
  const stools = [];
  for (const [x, z] of [[10.9, 1.4], [10.5, 2.1]]) { const g = new THREE.Group(); g.position.set(x, 0, z); Gr.add(g); cyl(0.17, 0.17, 0.04, oak, 0, 0.42, 0, g, { seg: 16 });
    for (let a = 0; a < 3; a++) { const l = cyl(0.018, 0.022, 0.44, oakDark, 0.1 * Math.cos(a * 2.09), 0.2, 0.1 * Math.sin(a * 2.09), g); l.rotation.set(0.12 * Math.sin(a * 2.09), 0, -0.12 * Math.cos(a * 2.09)); } stools.push(g); }
  { const g = new THREE.Group(); g.position.set(6.0, 0, G2.z0 + 0.3); Gr.add(g);      // (the dresser on the north wall, its pewter dull)
    box(1.8, 0.9, 0.5, oakDark, 0, 0.45, 0, g); box(1.8, 1.2, 0.08, oakDark, 0, 1.5, -0.21, g); for (const y of [1.3, 1.75]) box(1.8, 0.03, 0.25, oak, 0, y, -0.1, g);
    for (let i = 0; i < 5; i++) { const p = cyl(0.11, 0.1, 0.015, pewter, -0.7 + i * 0.35, 1.45, -0.17, g, { seg: 18 }); p.rotation.x = Math.PI / 2 - 0.25; } }
  { const g = new THREE.Group(); g.position.set(11.25, 0, -1.75); Gr.add(g);      // (a log basket by the hearth, full of dry wood)
    cyl(0.3, 0.26, 0.45, std({ color: srgb('#7a6040'), roughness: 0.95 }), 0, 0.225, 0, g, { seg: 16 });
    for (let i = 0; i < 6; i++) { const l = cyl(0.05, 0.05, 0.5, std({ map: K.grain('#6a4a2c', [1, 1]) }), -0.12 + (i % 3) * 0.12, 0.48 + Math.floor(i / 3) * 0.09, -0.06 + Math.floor(i / 3) * 0.1, g); l.rotation.z = Math.PI / 2; } }
  web(G2.x0 + 0.5, G2.ht - 0.5, G2.z0 + 0.5, Math.PI * 0.25, 1.3, sides.GN); web(G2.x1 - 0.5, G2.ht - 0.5, G2.z1 - 0.5, -Math.PI * 0.75, 1.3, sides.GS);

  // ── The great hearth: a stone surround and chimney breast, a deep cold hearth of old ash, firedogs, a crane with its hook for a pot; once
  // cleared, laid and lit, the fire ──
  const hearth = new THREE.Group(); hearth.position.set(G2.x1, 0, HEARTH.z); sides.GE.add(hearth);
  box(0.5, HEARTH.h + 0.5, 0.35, stoneM, -0.25, (HEARTH.h + 0.5) / 2, -HEARTH.w / 2 - 0.17, hearth); box(0.5, HEARTH.h + 0.5, 0.35, stoneM, -0.25, (HEARTH.h + 0.5) / 2, HEARTH.w / 2 + 0.17, hearth);
  box(0.55, 0.4, HEARTH.w + 0.7, stoneM, -0.27, HEARTH.h + 0.2, 0, hearth); box(0.7, 0.12, HEARTH.w + 1.0, stoneM, -0.32, HEARTH.h + 0.46, 0, hearth);      // (the lintel, the mantel shelf)
  box(1.0, 2.6, HEARTH.w + 0.7, stoneM, 0.15, HEARTH.h + 1.82, 0, hearth);      // (the breast, up to the beams)
  { const back = new THREE.Mesh(new THREE.PlaneGeometry(HEARTH.w, HEARTH.h), dark); back.position.set(HEARTH.d - 0.05, HEARTH.h / 2, 0); back.rotation.y = -Math.PI / 2; hearth.add(back);
    for (const sz of [-1, 1]) box(HEARTH.d, HEARTH.h, 0.12, stoneM, HEARTH.d / 2, HEARTH.h / 2, sz * (HEARTH.w / 2 + 0.06), hearth, { noCast: true });      // (its cheeks)
    box(HEARTH.d, 0.12, HEARTH.w + 0.24, dark, HEARTH.d / 2, HEARTH.h + 0.06, 0, hearth, { noCast: true });      // (its throat, sooted)
    box(HEARTH.d + 0.4, HEARTH.h + 0.6, HEARTH.w + 0.6, stoneM, HEARTH.d / 2 + 0.2, (HEARTH.h + 0.6) / 2, 0, sides.out).position.add(new V3(G2.x1, 0, HEARTH.z)); }      // (and outside, the chimney's foot)
  box(0.9, 0.06, HEARTH.w + 0.4, stoneM, -0.25, 0.03, 0, hearth);      // (the hearthstone)
  const ash = box(0.7, 0.08, HEARTH.w - 0.4, ashM, 0.35, 0.04, 0, hearth, { noCast: true });
  for (const sz of [-1, 1]) { box(0.5, 0.05, 0.04, iron, 0.3, 0.2, sz * 0.45, hearth); box(0.04, 0.35, 0.04, iron, 0.08, 0.18, sz * 0.45, hearth); }      // (the firedogs)
  const logs = new THREE.Group(); hearth.add(logs); for (const [z, r] of [[-0.25, 0.3], [0.2, -0.25], [0, 0.05]]) { const l = cyl(0.07, 0.08, 0.7, std({ map: K.grain('#5a3e24', [1, 1]) }), 0.32, 0.27, z, logs); l.rotation.set(0, r, Math.PI / 2); }
  const flames = new THREE.Group(); hearth.add(flames); for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.06 + 0.03 * (i % 3), 0.3 + 0.1 * (i % 2), 8), flameM); f.position.set(0.32, 0.45, -0.4 + i * 0.13); flames.add(f); }
  const crane = new THREE.Group(); crane.position.set(0.25, 0, -HEARTH.w / 2 + 0.15); hearth.add(crane); box(0.04, 1.3, 0.04, iron, 0, 0.75, 0, crane); box(0.04, 0.04, 0.7, iron, 0.12, 1.35, 0.35, crane);
  const hook = box(0.02, 0.35, 0.02, iron, 0.12, 1.16, 0.6, crane);
  const pot = new THREE.Group(); pot.position.set(0.37, 0.72, -HEARTH.w / 2 + 0.75); hearth.add(pot);
  { const b = cyl(0.17, 0.13, 0.24, iron, 0, 0, 0, pot, { seg: 18 }); const rim = cyl(0.18, 0.18, 0.02, iron, 0, 0.12, 0, pot, { seg: 18 }); const st = cyl(0.15, 0.15, 0.01, std({ color: srgb('#6a4a28'), roughness: 0.6 }), 0, 0.105, 0, pot, { seg: 18 }); pot.userData.stew = st; }
  const fireL = new THREE.PointLight(srgb('#ff9a4a'), 0, 9, 2); fireL.position.set(G2.x1 - 0.6, 0.8, HEARTH.z); Gr.add(fireL);
  // (his things, from the road: a pack and a bundle of the last of his supplies; carried in with him, set down on the great hall's table)
  const pack = new THREE.Group(); Gr.add(pack);
  { box(0.36, 0.48, 0.2, std({ color: srgb('#5a4a30'), roughness: 0.9 }), 0, 0.24, 0, pack); box(0.3, 0.1, 0.18, std({ color: srgb('#4a3c26'), roughness: 0.9 }), 0, 0.5, 0, pack); }
  pack.position.set(8.6, 0.8, 0.5); pack.visible = false;
  const bowl = new THREE.Group(); Gr.add(bowl); cyl(0.07, 0.05, 0.05, std({ map: K.grain('#7a5a3a', [1, 1]), roughness: 0.6 }), 0, 0.025, 0, bowl, { seg: 16 }); box(0.16, 0.008, 0.02, pewter, 0.1, 0.01, 0.03, bowl, { ry: 0.5 });
  bowl.position.set(9.2, 0.8, 0.2); bowl.visible = false;

  // ── Outside: the house's front (two storeys over the entrance, the great hall's tall storey), its roofs, the porch, the sweep gone to weeds,
  // the trees of the Fenwood all round, the sky ──
  { const O = sides.out, up = E.ht, top = 8.2;
    // (the upper storey over the entrance: its front, with two windows; its gable; the great hall's front above its walls)
    const s = new THREE.Shape(); s.moveTo(-0.001, 0); s.lineTo(E.x1 - E.x0 + 2 * T, 0); s.lineTo(E.x1 - E.x0 + 2 * T, top - up - 1.6); s.lineTo((E.x1 - E.x0 + 2 * T) / 2, top - up); s.lineTo(0, top - up - 1.6); s.closePath();
    for (const x of [-1.6, 1.6]) s.holes.push(rect(x - E.x0 + T - 0.45, 0.8, x - E.x0 + T + 0.45, 2.4));
    const upper = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }), facadeM); upper.position.set(E.x0 - T, up, E.z1); upper.castShadow = true; O.add(upper);
    for (const x of [-1.6, 1.6]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), glassOut); g.position.set(x, up + 1.6, E.z1 + T + 0.01); O.add(g); }
    // (the roofs: slate, pitched; the entrance's ridge north–south, the great hall's east–west)
    const roof = (w, len, rise, x, y, z, ry) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; O.add(g);
      for (const sx of [-1, 1]) { const r = box(Math.hypot(w / 2, rise) + 0.3, 0.12, len + 0.4, slateM, sx * w / 4, rise / 2, 0, g); r.rotation.z = sx * Math.atan2(rise, w / 2); } };
    roof(E.x1 - E.x0 + 2 * T, E.z1 - E.z0 + 2 * T, 1.6, 0, top - 1.6, 0, 0);
    roof(G2.z1 - G2.z0 + 2 * T, G2.x1 - G2.x0 + T, 2.2, (G2.x0 + G2.x1) / 2, G2.ht, 0, Math.PI / 2);
    // (the facade's stone: the walls' outer faces are their own; ivy up the great hall's corner)
    for (let i = 0; i < 14; i++) box(0.5 + 0.3 * Math.sin(i), 0.4, 0.04, ivyM, G2.x1 - 0.3 - 0.15 * (i % 3), 0.4 + i * 0.32, G2.z1 + T + 0.03, O, { noCast: true });
    // (the porch: two shallow steps, flagged; the sweep: gravel, weeds through it; the grass gone long; the trees)
    box(2.6, 0.12, 1.2, stoneM, FRONT.x, 0.06, E.z1 + T + 0.6, O); box(2.2, 0.06, 0.4, stoneM, FRONT.x, 0.15, E.z1 + T + 0.25, O);
    const gravel = K.canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#8a8270'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${90 + Math.random() * 80},${85 + Math.random() * 70},${70 + Math.random() * 60},0.8)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(${50 + Math.random() * 30},${90 + Math.random() * 50},${40 + Math.random() * 20},0.85)`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, 7); c.fill(); } });
    const sweep = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), std({ map: tex(gravel, [6, 4]), roughness: 1 })); sweep.rotation.x = -Math.PI / 2; sweep.position.set(4, -0.002, E.z1 + T + 5.5); sweep.receiveShadow = true; O.add(sweep);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), std({ color: srgb('#4e6a32'), roughness: 1 })); grass.rotation.x = -Math.PI / 2; grass.position.set(4, -0.02, 0); grass.receiveShadow = true; O.add(grass);
    // (the sky: a dome, pale at the horizon, blue overhead, a few soft clouds)
    const skyTex = K.canvasTex(64, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7fa6c8'); g.addColorStop(0.45, '#a9c2d6'); g.addColorStop(0.5, '#dfe6e6'); g.addColorStop(1, '#c8ccc0'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(Math.random() * w, h * (0.15 + 0.25 * Math.random()), 10 + Math.random() * 14, 4 + Math.random() * 6, 0, 0, 7); c.fill(); } });
    skyTex.wrapS = THREE.ClampToEdgeWrapping; skyTex.wrapT = THREE.ClampToEdgeWrapping;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })); sky.position.set(4, -8, 0); sky.renderOrder = -1; O.add(sky);
    // (the Fenwood, round about: trees as dark masses against the sky, nearer ones in front)
    const treeM = std({ color: srgb('#2e4426'), roughness: 1 }), trunkM = std({ color: srgb('#3a2c20'), roughness: 1 });
    const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
    for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2, r = 17 + rnd() * 9, x = 4 + Math.cos(a) * r, z = Math.sin(a) * r * 0.9 + 2; if (z > -8 && Math.abs(x - 4) < 9 && z < 4) continue;
      const h = 6 + rnd() * 6; cyl(0.25, 0.35, h * 0.4, trunkM, x, h * 0.2, z, O); const c = new THREE.Mesh(new THREE.ConeGeometry(2.2 + rnd() * 1.6, h * 0.85, 9), treeM); c.position.set(x, h * 0.55, z); c.castShadow = true; O.add(c); }
    for (const [x, z, s] of [[-5.5, 6, 1], [11.5, 9.5, 1.2], [-7, 11, 1.3], [14, 5, 0.9]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(1.6 * s, 10, 8), treeM); c.position.set(x, 2.6 * s, z); c.castShadow = true; O.add(c); cyl(0.2, 0.3, 2.2 * s, trunkM, x, 1.1 * s, z, O); }
  }

  // ── Light: midday. The sun high in the south, the sky's own light; within, only what the day lets in: the door, the windows, the great
  // hall dark till its shutters open; and its fire, once it's lit ──
  const hemi = new THREE.HemisphereLight(srgb('#dfe6ee'), srgb('#5a5040'), 0.55); Gr.add(hemi);
  const sun = new THREE.DirectionalLight(srgb('#fff2dc'), 2.4); sun.position.set(8, 16, 14); sun.target.position.set(4, 0, 0); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; Gr.add(sun); Gr.add(sun.target);
  const inside = new THREE.AmbientLight(srgb('#8a8070'), 0.32); Gr.add(inside);
  const doorL = new THREE.PointLight(srgb('#f2ecdf'), 1.6, 7, 2); doorL.position.set(FRONT.x, 1.6, E.z1 - 0.6); Gr.add(doorL);
  const winEL = winE.map(x => { const l = new THREE.PointLight(srgb('#e8e6dc'), 0.7, 5, 2); l.position.set(x, 2.2, E.z1 - 0.5); Gr.add(l); return l; });
  const winGL = winG.map(x => { const l = new THREE.PointLight(srgb('#f0ece0'), 0, 7, 2); l.position.set(x, 2.4, G2.z1 - 0.7); Gr.add(l); return l; });
  const gloom = new THREE.PointLight(srgb('#9a9080'), 0.35, 8, 2); gloom.position.set(7.5, 3.2, 0); Gr.add(gloom);      // (what light gets through the shutters' cracks and the door)

  // ── What's been put right in the great hall, each its own; the room's restoration follows ──
  const state = { sheets: true, shutters: [false, false, false], hearth: 'ash', fire: false, pot: false, pack: false, bowl: false };
  function set(k, v) {
    if (k === 'sheets') { state.sheets = !!v; for (const s of gsheets) s.visible = state.sheets; }
    else if (k === 'shutter') { const [i, on] = v; state.shutters[i] = !!on; for (const { h, sx } of shutters[i]) h.rotation.y = on ? sx * -1.5 : 0; winGL[i].intensity = on ? 3.4 : 0; }
    // (the hearth: 'ash' (as found), 'clear', 'laid', 'lit')
    else if (k === 'hearth') { state.hearth = v; ash.visible = v === 'ash'; logs.visible = v === 'laid' || v === 'lit'; flames.visible = v === 'lit'; state.fire = v === 'lit'; fireL.intensity = state.fire ? 3.4 : 0; }
    else if (k === 'pot') { state.pot = !!v; pot.visible = state.pot; }
    else if (k === 'pack') { state.pack = !!v; pack.visible = state.pack; }
    else if (k === 'bowl') { state.bowl = !!v; bowl.visible = state.bowl; }
    gloom.intensity = 0.35 + 0.25 * state.shutters.filter(Boolean).length;
  }
  set('sheets', true); for (let i = 0; i < 3; i++) set('shutter', [i, false]); set('hearth', 'ash'); set('pot', false);
  // (as Silas finds it: every door shut, nothing yet put right)
  function reset() { for (const k in doors) doors[k].set(0); setRestored(0); set('pot', false); set('pack', false); set('bowl', false); }
  const restored = () => { const parts = [!state.sheets, ...state.shutters, state.hearth !== 'ash', state.fire]; return parts.filter(Boolean).length / parts.length; };
  function setRestored(k) { set('sheets', k < 0.5); for (let i = 0; i < 3; i++) set('shutter', [i, k >= 0.5]); set('hearth', k >= 1 ? 'lit' : k >= 0.5 ? 'laid' : 'ash'); }

  // ── Where people go, and what's where (named points, for looking at and for the things there are to do) ──
  const spots = () => ({
    drive: { at: new V3(FRONT.x + 0.4, 0, E.z1 + T + 7.5), yaw: Math.PI },      // (on the sweep, the house before him)
    porch: { at: new V3(FRONT.x, 0, E.z1 + T + 0.75), yaw: Math.PI },
    threshold: { at: new V3(FRONT.x, 0, E.z1 - 0.35), yaw: Math.PI },
    within: { at: new V3(0.5, 0, 1.0), yaw: Math.PI - 0.35 },      // (a few steps in, looking about him)
    greatDoor: { at: new V3(E.x1 - 0.6, 0, GREAT.z), yaw: Math.PI / 2 },
    greatIn: { at: new V3(G2.x0 + 1.0, 0, GREAT.z), yaw: Math.PI / 2 },
    hearth: { at: new V3(G2.x1 - 1.35, 0, HEARTH.z + 0.3), yaw: Math.PI / 2 },
    table: { at: new V3(8.6, 0, -0.45), yaw: 0 },
  });
  const points = {
    door: new V3(FRONT.x, 1.6, E.z1), portrait: new V3(E.x0 + 0.1, 2.3, -1.15), clock: new V3(-2.7, 1.6, -1.0), stair: new V3(-0.5, 1.8, -1.95), study: new V3(E.x0, 1.5, STUDY.z),
    sheets: new V3(0.3, 0.9, 0.2), greatDoor: new V3(E.x1, 1.5, GREAT.z), hearth: new V3(G2.x1 - 0.2, 0.8, HEARTH.z), table: new V3(7.2, 0.9, 0.4), settle: new V3(10.6, 0.9, -2.4),
    kitchens: new V3(KITCH.x, 1.4, G2.z0), basket: new V3(11.25, 0.5, -1.75), dresser: new V3(6.0, 1.4, G2.z0 + 0.3), stools: new V3(10.7, 0.5, 1.7),
    shutter0: new V3(winG[0], 1.9, G2.z1), shutter1: new V3(winG[1], 1.9, G2.z1), shutter2: new V3(winG[2], 1.9, G2.z1),
  };
  // ── Where Silas can walk (rects: x0, z0, x1, z1), and what's in the way; the doorways joining the rooms, each open only while its door is ──
  const walk = {
    areas: [{ x0: E.x0, z0: STAIR.z1, x1: E.x1, z1: E.z1, room: 'entrance', ht: E.ht }, { x0: G2.x0, z0: G2.z0, x1: G2.x1, z1: G2.z1, room: 'great', ht: G2.ht }],
    doorways: [{ x0: E.x1 - 0.2, z0: GREAT.z - GREAT.w / 2 + 0.15, x1: G2.x0 + 0.2 + T, z1: GREAT.z + GREAT.w / 2 - 0.15, door: 'great' }],
    blocks: [{ x0: -0.42, z0: -0.12, x1: 1.02, z1: 0.52 }, { x0: -1.3, z0: 0.3, x1: -0.7, z1: 0.9 }, { x0: 1.3, z0: 0.2, x1: 1.9, z1: 0.8 }, { x0: -2.95, z0: -1.3, x1: -2.4, z1: -0.7 },
      { x0: 1.15, z0: 2.0, x1: 1.45, z1: 2.5 }, { x0: -2.3, z0: 2.0, x1: -0.9, z1: 2.5 },
      { x0: -0.72, z0: 1.15, x1: -0.5, z1: 2.5 }, { x0: 3.3, z0: -0.4, x1: 4.9, z1: 0.1 },      // (the front door and the great hall's, open)
      { x0: 4.8, z0: -0.25, x1: 9.6, z1: 1.05 }, { x0: 4.8, z0: -0.6, x1: 9.6, z1: -0.25 }, { x0: 4.8, z0: 1.05, x1: 9.6, z1: 1.4 },      // (the table and its benches)
      { x0: 9.7, z0: -3.1, x1: 11.4, z1: -1.7 }, { x0: 5.1, z0: G2.z0, x1: 6.9, z1: G2.z0 + 0.6 }, { x0: G2.x1 - 0.55, z0: -1.4, x1: G2.x1, z1: 1.4 },
      { x0: 10.65, z0: 1.15, x1: 11.15, z1: 1.65 }, { x0: 10.25, z0: 1.85, x1: 10.75, z1: 2.35 }, { x0: 10.9, z0: -2.1, x1: 11.6, z1: -1.4 }],
  };
  // ── Which side each thing's on, to hide the walls nearest the camera (inside only: outside, the house is all there) ──
  const sideOf = new Map(); for (const k in sides) if (k !== 'out') sideOf.set(sides[k], k);
  const IN = 0.35;
  const sidesAt = p => {
    const s = new Set(); if (p.z > E.z1 + T || p.y > G2.ht + 0.5) return s;      // (outside, or above: none hidden)
    if (p.x <= E.x1) { if (p.z > E.z1 - IN) s.add('S'); if (p.z < E.z0 + IN) s.add('N'); if (p.x < E.x0 + IN) s.add('W'); if (p.x > E.x1 - IN) s.add('E'); s.add('GC'); if (p.y < E.ht + 0.2) s.add('C'); }
    else { if (p.z > G2.z1 - IN) s.add('GS'); if (p.z < G2.z0 + IN) s.add('GN'); if (p.x > G2.x1 - IN) s.add('GE'); if (p.x < G2.x0 + IN) s.add('E'); s.add('C'); if (p.y < G2.ht + 0.2) s.add('GC'); }
    return s;
  };
  const bounds = { minX: E.x0 - 6, maxX: G2.x1 + 6, minZ: G2.z0 - 4, maxZ: E.z1 + 14, ht: 9 };
  let t = 0;
  const setLow = on => { sun.castShadow = !on; };
  // (the air, while this is the room shown: a light midday haze, not the evening's dark one)
  const air = { fog: srgb('#c9d3d6'), density: 0.014 };
  return { group: Gr, spots, points, doors, door: doors.front, bounds, sideOf, sidesAt, walk, state, set, restored, setRestored, reset, setLow, sun, stools, pack, bowl, air, name: 'Fenwick Hall',
    tick(dt) { t += dt; for (const k in doors) doors[k].tick(dt);
      if (state.fire) { const f = 0.85 + 0.1 * Math.sin(t * 7.3) + 0.06 * Math.sin(t * 12.1 + 1.3); fireL.intensity = 3.4 * f; flames.children.forEach((c, i) => { c.scale.y = 0.8 + 0.3 * Math.sin(t * (6 + i % 4) + i * 1.9); }); } } };
}

root.FenwickHall = { build, E, G2 };
})(typeof window !== 'undefined' ? window : globalThis);
