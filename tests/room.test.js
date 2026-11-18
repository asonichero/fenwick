// The guest bedroom: every spot the correction needs, where Meridian's Captain's quarters had it (so its posing and cameras carry over);
// private; and its two states, as found and restored, with Ch. 1's clues laid out or cleared away.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.THREE = require('../vendor/three.min.js');
require('../js/figure.js'); require('../js/kit.js'); require('../js/guestroom.js');

const room = () => GuestRoom.build(new THREE.Scene());
// (meshes actually drawn: visible themselves and every group above them)
const drawn = r => { let n = 0; r.group.traverseVisible(o => { if (o.isMesh) n++; }); return n; };

test('the spots the correction needs, where the Captain’s quarters had them', () => {
  const r = room(), S = r.spots, near = (v, x, z) => Math.abs(v.x - x) < 1e-9 && Math.abs(v.z - z) < 1e-9;
  assert.ok(near(S.bench.at, 0.31, -1.15)); assert.equal(S.bench.yaw, Math.PI / 2); assert.equal(S.bench.seatY, 0.48);
  assert.ok(near(S.seats.bed.at, -1.6, 1.63)); assert.equal(S.seats.bed.seatY, 0.48); assert.ok(S.seats.bed.after && S.seats.bed.cams.length === 6);
  assert.equal(S.wall.support.kind, 'edge'); assert.equal(S.wall.support.lines, 'writing'); assert.ok(Math.abs(S.wall.support.y - 0.77) < 1e-9);
  assert.ok(near(S.after.at, 2.23, -1.45)); assert.deepEqual(S.watch, []); assert.ok(S.corner);
  assert.equal(r.private, true); assert.equal(r.cams.wall.length, 6);
});

test('as found and restored: grime, cobwebs and dust sheets, the boarded window, the cold hearth; then warm', () => {
  const r = room(), shown = () => drawn(r);
  r.setRestored(1); const warm = shown();
  r.setRestored(0); const found = shown();
  assert.ok(found > warm, 'more to see as found: sheets, cobwebs, boards');
  r.setTime('night'); r.setRestored(1); let fire = 0; r.group.traverse(o => { if (o.isPointLight && o.intensity > 1.5) fire++; });
  assert.ok(fire >= 1, 'the fire at night, once restored');
  r.setRestored(0); let cold = 0; r.group.traverse(o => { if (o.isPointLight && o.intensity > 1.5) cold++; }); assert.equal(cold, 0, 'no fire as found');
});

test('Ch. 1’s clues come and go: the rucked bed, the ink, the rations, the broken chair', () => {
  const r = room(), count = () => drawn(r);
  r.setClues(false); const clear = count(); r.setClues(true); const out = count();
  assert.ok(out - clear >= 8, `${out - clear} more things with the clues out`); assert.equal(r.clues, true);
});
