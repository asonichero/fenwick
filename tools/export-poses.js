// Fenwick Hall — writes out the poses each heroine is put in for a correction (and the aftercare), for Blender to drape her skirt in
// (tools/blender/bake_drapes.py). For each heroine and pose: every bone's skinning matrix (where the bind pose's points go, in the world),
// the scale she's bound at and her build (the shape keys' amounts); Silas's the same, and what he's wearing; and the furniture (boxes). The
// floor is the world's y = 0. And which garments with a skirt each heroine wears. Taken from the figures page as it places her, so the
// poses are the game's own, and each heroine's own (they're of different heights, at the same furniture).
//   npm run serve (in another shell), then: node tools/export-poses.js [http://localhost:8123/] → tools/blender/poses.json
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8123/';
const POSES = ['otk', 'bed', 'edge', 'table', 'after'];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 200, height: 150 } });
  await p.goto(`${BASE}figures.html?still=1&who=belle&pose=otk&view=front`, { timeout: 180000 });
  await p.waitForFunction(() => window.ready, null, { timeout: 180000 });
  const out = await p.evaluate(POSES => {
    const r = a => Array.from(a).map(v => +v.toFixed(6));
    const rig = G => {
      G.root.updateMatrixWorld(true); const bones = {};
      G.skeleton.bones.forEach((bn, i) => { bones[bn.name] = r(new THREE.Matrix4().multiplyMatrices(bn.matrixWorld, G.skeleton.boneInverses[i]).elements); });
      return { bones, scale: G.bindM.elements[0], keys: Object.assign({}, G.keys) };
    };
    const garment = o => ({ kirtle: 'Kirtle', chemise: 'Chemise', nightdress: 'NightDress' }[o.kind] || (o.sleeves === 'long' ? 'DressLong' : 'DressElbow'));
    const garments = id => { const seen = {}; for (const o of Object.values(Cast.WARDROBE[id])) { const g = garment(o); seen[g] = seen[g] || o.legs === 'leggings'; } return Object.entries(seen); };
    const res = { heroes: {}, garments: {} };
    for (const id of Cast.IDS) {
      res.garments[id] = garments(id); res.heroes[id] = {};      // ([garment, worn over leggings?])
      for (const pose of POSES) {
        cfg.who = id; cfg.outfit = Cast.outfits(id)[0]; cfg.pose = pose; build();
        for (let i = 0; i < 60; i++) ses.update(0.05);      // (placed, without drawing each step)
        const boxes = [], P = PROPS[PROP_OF[pose]];
        if (P) { P.updateMatrixWorld(true); P.traverse(m => { if (m.isMesh && m.geometry.parameters) { const g = m.geometry.parameters; boxes.push([...r(m.matrixWorld.elements), g.width, g.height, g.depth]); } }); }
        res.heroes[id][pose] = Object.assign(rig(F), { silas: Object.assign(rig(C), { wears: Object.keys(C.gm).filter(n => C.gm[n].visible) }), boxes });
      }
    }
    return res;
  }, POSES);
  await b.close();
  for (const id in out.heroes) console.log(id, out.garments[id].map(g => g[0] + (g[1] ? ' (over leggings)' : '')).join(', '), '—', Object.keys(out.heroes[id]).join(' '));
  fs.writeFileSync(path.join(__dirname, 'blender', 'poses.json'), JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
