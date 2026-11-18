// Fenwick Hall — writes the code-built head (js/figure.js) out for Blender, so the hair built there fits it: the head's surface and ears, in
// head units (the space of the head group, F.head, that the hair hangs in), for her head and for his.
//   node tools/export-head.js → tools/blender/head.json
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.THREE = require('../vendor/three.min.js');
require('../js/figure.js');
const out = {};
for (const sex of ['f', 'm']) {
  const F = Figure.make({ sex, model: 'built', hairStyle: 'none' }), H = F.head, meshes = [];
  H.updateMatrixWorld(true); const inv = H.matrixWorld.clone().invert();
  H.children.forEach((m, i) => {
    if (!m.isMesh || m === F.faceLayer || m.material.side === THREE.BackSide) return;
    const g = m.geometry, p = g.attributes.position, M = inv.clone().multiply(m.matrixWorld), v = new THREE.Vector3(), pos = [];
    for (let j = 0; j < p.count; j++) { v.fromBufferAttribute(p, j).applyMatrix4(M); pos.push(+v.x.toFixed(5), +v.y.toFixed(5), +v.z.toFixed(5)); }
    meshes.push({ name: i === 0 ? 'head' : 'part' + i, pos, idx: g.index ? Array.from(g.index.array) : null });
  });
  out[sex] = { meshes, scale: H.scale.x };
}
fs.writeFileSync(path.join(__dirname, 'blender', 'head.json'), JSON.stringify(out));
console.log('head.json:', Object.entries(out).map(([s, o]) => `${s}: ${o.meshes.length} meshes, ${o.meshes[0].pos.length / 3} points on the head, ${o.scale.toFixed(4)} m a unit`).join('; '));
