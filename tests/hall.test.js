// Thornleigh's great hall (the prologue's opening scene): its layout, as the room editor (rooms.html) keeps it, and the furniture in it.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.THREE = require('../vendor/three.min.js');
require('../js/figure.js'); require('../js/kit.js'); require('../js/hall.js');
const Hall = window.Hall;

test('the hall’s layout: every piece placed and named; a draft laid over the defaults, piece by piece', () => {
  const L = Hall.ROOM.layout({});
  for (const k of ['table', 'lordChair', 'sonChair', 'cicelyChair', 'silasMark', 'adelaMark']) { assert.ok(L[k], k); assert.ok(Hall.LABELS[k], k); }
  assert.deepEqual(Object.keys(L).sort(), Object.keys(Hall.LABELS).sort());
  const D = Hall.ROOM.layout({ table: { x: 0.5 } }); assert.equal(D.table.x, 0.5); assert.equal(D.table.z, Hall.LAYOUT.table.z); assert.deepEqual(D.lordChair, Hall.LAYOUT.lordChair);
});

test('as built: the master at the head facing down the table, his son at his right and Cicely beside him, Adela’s mark in the archway at his left', () => {
  const scene = new THREE.Scene(), h = Hall.build(scene), S = h.spots();
  assert.ok(S.master.at.z < S.son.at.z && S.son.at.z < S.cicely.at.z, 'down the table from the head');
  assert.ok(Math.abs(S.master.yaw) < 1e-6, 'the master facing down the hall');
  assert.ok(S.son.at.x < 0 && S.cicely.at.x < 0, 'at his right (west), facing him from his left: the table between');
  assert.ok(S.adela.at.x > h.bounds.maxX - 0.5, 'Adela at the east wall, his left'); assert.ok(S.silas.at.x > 0, 'Silas across the table from them');
  // (a piece moved moves what stands on it, and its side's worked out again)
  h.place('table', { x: 0.3, z: -1.0, ry: 0 }); h.resides(); assert.equal(h.layout().table.x, 0.3);
});
