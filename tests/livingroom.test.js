// The living room (js/livingroom.js, the room editor's open-plan flat): every piece in its layout named and built; as laid out, each inside
// the walls, clear of the kitchen's units and of the doorway and its open door; a piece moved goes where it's put; and the editor's views,
// its default among them.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.THREE = require('../vendor/three.min.js');
require('../js/figure.js'); require('../js/kit.js'); require('../js/livingroom.js');
const { LivingRoom } = window, build = () => LivingRoom.build(new THREE.Scene());
// (boxes measured from the vertices themselves, as placed: three's own boxes a rotated, squashed sphere generously)
const vbox = o => { const b = new THREE.Box3(), v = new THREE.Vector3(); o.updateMatrixWorld(true);
  o.traverse(m => { if (!m.isMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); }); return b; };
const footprint = (lr, k) => { const b = vbox(lr.pieces[k].g); return { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, y1: b.max.y }; };
const meets = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

test('every piece in the layout named and built; the editor’s list is the layout’s', () => {
  const lr = build();
  assert.deepEqual(Object.keys(LivingRoom.LAYOUT).sort(), Object.keys(LivingRoom.LABELS).sort());
  assert.deepEqual(lr.keys, Object.keys(LivingRoom.LAYOUT));
  for (const k of lr.keys) { assert.ok(lr.pieces[k].label, k); assert.ok(lr.pieces[k].g.children.length, k + ' has something in it'); }
  for (const k of ['sofa', 'armchair', 'desk', 'deskChair', 'tvStand', 'drawers', 'shelves', 'coffeeTable', 'rug']) assert.ok(lr.keys.includes(k), k);
});

test('as laid out: each piece inside the walls, clear of the kitchen’s units, the doorway and its open door', () => {
  const lr = build(), B = lr.bounds, tol = 0.02;
  const kitchen = [{ x0: B.maxX - 0.62, x1: B.maxX, z0: 2.0, z1: B.maxZ }, { x0: -1.37, x1: B.maxX, z0: B.maxZ - 0.62, z1: B.maxZ }];
  const door = { x0: B.minX, x1: B.minX + 0.9, z0: 0.42, z1: 1.36 };
  for (const k of lr.keys) {
    const f = footprint(lr, k);
    assert.ok(f.x0 >= B.minX - tol && f.x1 <= B.maxX + tol && f.z0 >= B.minZ - tol && f.z1 <= B.maxZ + tol, k + ' inside the walls: ' + JSON.stringify(f));
    for (const u of kitchen) assert.ok(!meets(f, u), k + ' clear of the kitchen');
    assert.ok(!meets(f, door), k + ' clear of the door');
    assert.ok(f.y1 < B.ht, k + ' under the ceiling');
  }
});

test('what stands together stays apart: the seats, the tables, the lamps and the cabinets don’t run into one another', () => {
  const lr = build(), solid = lr.keys.filter(k => k !== 'rug');
  // (each piece as the boxes of its parts, so an L-shaped sofa doesn't claim the corner its table stands in)
  const parts = k => { const out = []; lr.pieces[k].g.updateMatrixWorld(true); lr.pieces[k].g.traverse(o => { if (o.isMesh) out.push(vbox(o).expandByScalar(-0.003)); }); return out; };
  const allowed = new Set(['sofa|lampCorner', 'desk|amp']);      // (the lamp stands in the corner behind the sofa; the amp under the desk, as in the photographs)
  const P = {}; for (const k of solid) P[k] = parts(k);
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
    const a = solid[i], b = solid[j]; if (allowed.has(a + '|' + b) || allowed.has(b + '|' + a)) continue;
    const hit = P[a].some(x => P[b].some(y => x.intersectsBox(y)));
    assert.ok(!hit, a + ' and ' + b + ' run into each other');
  }
});

test('a piece moved goes where it’s put; the views include the editor’s default', () => {
  const lr = build();
  lr.place('armchair', { x: 0.5, z: 0.4, ry: 0 }); lr.resides();
  const g = lr.pieces.armchair.g; assert.equal(g.position.x, 0.5); assert.equal(g.position.z, 0.4); assert.equal(lr.layout().armchair.x, 0.5);
  assert.ok(lr.views.Corner, 'Corner'); for (const k in lr.views) { assert.equal(lr.views[k].length, 2); assert.equal(lr.views[k][0].length, 3); }
  assert.ok(lr.sidesAt(new THREE.Vector3(0, 1.5, lr.bounds.maxZ - 0.1)).has('S'), 'by the kitchen, its wall out of the way');
});
