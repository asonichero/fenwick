// Silas's office at Thornleigh (the prologue's confrontation): its layout, as the room editor keeps it; where the scene's people go, from the
// furniture as it stands; the way round the desk clear of it; the door, which shuts.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.THREE = require('../vendor/three.min.js');
require('../js/figure.js'); require('../js/kit.js'); require('../js/office.js');
const Office = window.Office;

test('the office’s layout: every piece placed and named; a draft laid over the defaults', () => {
  const L = Office.ROOM.layout({});
  for (const k of ['desk', 'chair', 'shelves', 'cicelyMark', 'doorMark', 'nearMark']) { assert.ok(L[k], k); assert.ok(Office.LABELS[k], k); }
  assert.deepEqual(Object.keys(L).sort(), Object.keys(Office.LABELS).sort());
  const D = Office.ROOM.layout({ desk: { x: 0.3 } }); assert.equal(D.desk.x, 0.3); assert.equal(D.desk.z, Office.LAYOUT.desk.z);
});

test('as built: his chair behind the desk facing the room, Cicely before it facing him, the door’s mark by the door, his near her', () => {
  const o = Office.build(new THREE.Scene()), S = o.spots(), L = Office.LAYOUT;
  assert.ok(S.silas.at.z < L.desk.z && S.silas.seatY > 0.4, 'behind the desk, seated');
  assert.ok(Math.abs(S.silas.yaw) < 1e-6, 'facing the room');
  assert.ok(S.cicely.at.z > L.desk.z + 0.5 && Math.abs(Math.abs(S.cicely.yaw) - Math.PI) < 1e-6, 'before it, facing him');
  assert.ok(S.door.at.z > 1.2, 'by the door');
  assert.ok(S.near.at.distanceTo(S.cicely.at) < 0.9 && S.near.at.z > L.desk.z + 0.4, 'before her, in front of the desk');
  assert.ok(S.deskEast.at.x > L.desk.x + 0.75, 'round the desk’s east end');
});

test('the way round the desk, from the door to his chair and from it to her, keeps clear of the desk', () => {
  const o = Office.build(new THREE.Scene()), S = o.spots(), box = new THREE.Box3().setFromObject(o.pieces.desk.g); box.min.y = -1; box.max.y = 3;
  const clear = (a, b) => { for (let k = 0; k <= 40; k++) { const p = a.clone().lerp(b, k / 40); p.y = 0.5; if (box.distanceToPoint(p) < 0.12) return false; } return true; };
  for (const path of [['door', 'deskSE', 'deskNE', 'chairSide'], ['chairSide', 'deskNE', 'deskSE', 'near']]) for (let i = 1; i < path.length; i++) assert.ok(clear(S[path[i - 1]].at, S[path[i]].at), path[i - 1] + ' → ' + path[i]);
});

test('the door: shut by default; it swings open, and shuts again over time', async () => {
  const o = Office.build(new THREE.Scene()); assert.equal(o.door.k, 0);
  o.door.set(1); assert.equal(o.door.k, 1);
  const p = o.door.to(0, 500); for (let i = 0; i < 40; i++) o.tick(0.02); await p; assert.equal(o.door.k, 0);
});
