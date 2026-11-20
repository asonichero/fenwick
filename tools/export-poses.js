// Fenwick Hall — writes out the poses a heroine is put in for a correction (and the aftercare), for Blender to drape her skirt in
// (tools/blender/bake_drapes.py): in each, every bone's skinning matrix (where the bind pose's points go, in the world), the scale the model
// is bound at, and what her skirt can fall against: Silas's legs (capsules), the furniture (boxes). The floor is the world's y = 0.
// Taken from the figures page as it places her, so the poses are the game's own.
//   npm run serve (in another shell), then: node tools/export-poses.js [http://localhost:8123/] → tools/blender/poses.json
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8123/';
const POSES = ['otk', 'bed', 'edge', 'table', 'after'];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = { who: 'belle', poses: {} };
  for (const pose of POSES) {
    const p = await b.newPage({ viewport: { width: 200, height: 150 } });
    await p.goto(`${BASE}figures.html?still=1&who=belle&pose=${pose}&view=front`, { timeout: 180000 });
    await p.waitForFunction(() => window.ready, null, { timeout: 120000 });
    out.poses[pose] = await p.evaluate(pose => {
      window.step(60); F.root.updateMatrixWorld(true); C.root.updateMatrixWorld(true);
      const r = a => Array.from(a).map(v => +v.toFixed(6)), bones = {};
      F.skeleton.bones.forEach((bn, i) => { bones[bn.name] = r(new THREE.Matrix4().multiplyMatrices(bn.matrixWorld, F.skeleton.boneInverses[i]).elements); });
      // Silas's legs, as the game's cloth would have taken them: thigh and shin, each end's radius (his trousers)
      const W = n => C.bone[n].getWorldPosition(new V3()).toArray(), k = C.root.scale.x, caps = [];
      for (const s of ['L', 'R']) caps.push([...W('thigh' + s), ...W('shin' + s), 0.094 * k, 0.066 * k], [...W('shin' + s), ...W('foot' + s), 0.062 * k, 0.046 * k]);
      const boxes = []; const P = PROPS[PROP_OF[pose]];
      if (P) { P.updateMatrixWorld(true); P.traverse(m => { if (m.isMesh && m.geometry.parameters) { const g = m.geometry.parameters; boxes.push([...r(m.matrixWorld.elements), g.width, g.height, g.depth]); } }); }
      return { bones, scale: F.bindM.elements[0], caps: caps.map(r), boxes, state: F.state.top, outfit: Object.keys(F.gm).filter(n => F.gm[n].visible) };
    }, pose);
    console.log(pose, Object.keys(out.poses[pose].bones).length, 'bones,', out.poses[pose].boxes.length, 'boxes; wearing', out.poses[pose].outfit.join(' '));
    await p.close();
  }
  await b.close();
  fs.writeFileSync(path.join(__dirname, 'blender', 'poses.json'), JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
