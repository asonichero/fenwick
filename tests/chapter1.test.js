// Chapter 1's opening (js/chapter1.js) and the house it's played in (js/fenwickhall.js): the arrival's script holds together (its shots,
// acts and spots real, its lines his thoughts); the Hall as built (the sweep outside, the rooms within, the great hall reached only through
// its door, opened); everything there is to do in the walked scene somewhere he can stand and reach it; and the great hall's putting right,
// played through by its own conditions, ending in the stew, the house put right as it goes.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'getImageData' || k === 'createImageData' ? () => ({ data: new Uint8ClampedArray(4 * 64 * 64) }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.THREE = require('../vendor/three.min.js');
require('../js/cast.js'); require('../js/figure.js'); require('../js/kit.js'); require('../js/fenwickhall.js'); require('../js/prologue.js'); require('../js/chapter1.js'); require('../js/roam.js');
const { Chapter1, Prologue, FenwickHall, Roam, Figure, Cast } = window, A = Chapter1.SCENES.arrival, H = Chapter1.SCENES.house;
const V3 = THREE.Vector3, hall = () => FenwickHall.build(new THREE.Scene());
const ACTS = ['walk', 'door', 'turn'], SFX = ['knock', 'paper', 'lock', 'creak', 'rattle', 'strike'];
// (the walking's own test of where he may stand, on a stand-in view)
const freeIn = fh => Roam.create({ stage: { camera: { position: new V3() }, controls: { target: new V3() } }, room: fh, figure: null, things: [], ui: {} }).free;

test('the chapter’s scenes follow the prologue’s in the one list, none of them sharing a name', () => {
  assert.deepEqual(Chapter1.ORDER, ['arrival', 'house']);
  for (const k of Chapter1.ORDER) { assert.ok(Chapter1.SCENES[k], k); assert.ok(!Prologue.SCENES[k], k + ' is not also a prologue scene'); }
  assert.deepEqual(A.card, { big: 'Chapter One', small: 'The Dusty Hall' });
  assert.ok(A.seamless, 'the arrival goes on into the Hall walked without a cut');
  for (const S of [A, H]) { assert.equal(S.room, 'fenwick'); assert.ok(S.day); assert.ok(Cast.squireSpec(), 'Silas'); assert.deepEqual(S.cast.silas.spec, ['silas']); }
});

test('the arrival: its shots, acts and spots real; every line one of his thoughts; up the sweep, the door unlocked and opened, and in', () => {
  const fh = hall(), sp = fh.spots();
  for (const [i, b] of A.beats.entries()) {
    assert.ok(b.who || b.shot || b.act || b.pause || b.sfx || b.look, 'beat ' + i);
    if (b.shot) assert.ok(A.shots[b.shot], 'shot ' + b.shot); if (b.push) assert.ok(A.shots[b.push], 'push ' + b.push);
    if (b.act) assert.ok(ACTS.includes(b.act), 'act ' + b.act);
    if (b.sfx) assert.ok(SFX.includes(b.sfx), 'sound ' + b.sfx);
    if (b.path) for (const k of b.path) assert.ok(sp[k], 'spot ' + k);
    if (b.which) assert.ok(fh.doors[b.which], 'door ' + b.which);
    if (b.toward) assert.ok(sp[b.toward] || A.cast[b.toward], 'toward ' + b.toward);
    for (const id in b.look || {}) assert.ok(b.look[id] === null || fh.points[b.look[id]], 'looks at ' + b.look[id]);
    if (b.who) { assert.equal(b.who, 'silas'); assert.ok(b.think, 'his own thought, not said aloud: ' + b.text); if (b.face) assert.ok(Figure.EXPRS[b.face], b.face); }
  }
  const at = f => A.beats.findIndex(f);
  const order = [at(b => b.path && b.path[0] === 'drive'), at(b => b.sfx === 'lock'), at(b => b.act === 'door' && b.which === 'front'), at(b => b.path && b.path.includes('within'))];
  assert.ok(order.every(i => i >= 0) && order.every((v, i) => !i || v > order[i - 1]), 'in order: ' + order);
  // (the camera kept outside the house for the shots of it, and within it for the shots inside)
  for (const k of ['house', 'houseIn', 'approach', 'porch']) assert.ok(A.shots[k].cam[2] > FenwickHall.E.z1, k + ' from outside');
  for (const k of ['doorIn', 'inside']) { const [x, , z] = A.shots[k].cam, E = FenwickHall.E; assert.ok(x > E.x0 && x < E.x1 && z > E.z0 && z < E.z1, k + ' from within'); }
  // (ending turned toward the way on, the great hall's door, the front door swung shut behind him)
  assert.ok(A.beats.some(b => b.act === 'turn' && b.toward === 'greatDoor'), 'turned to the great hall');
  const last = A.beats[A.beats.length - 1]; assert.equal(last.act, 'door'); assert.equal(last.which, 'front'); assert.equal(last.to, 0);
});

test('the Hall: the sweep outside the front door, the walk within; the great hall reached only through its door, and only once it’s open', () => {
  const fh = hall(), sp = fh.spots(), free = freeIn(fh), E = FenwickHall.E, G2 = FenwickHall.G2;
  assert.ok(sp.drive.at.z > E.z1 + 5 && sp.porch.at.z > E.z1, 'the drive and the porch outside');
  for (const k of ['threshold', 'within', 'greatDoor']) assert.ok(free(sp[k].at.x, sp[k].at.z), k + ' is somewhere he can stand');
  for (const k of ['greatIn', 'hearth', 'table']) assert.ok(sp[k].at.x > G2.x0, k + ' in the great hall');
  // (flood-filled from where he starts: the great hall out of reach with its door shut, in reach with it open; never outside the walls)
  const reach = () => { const S = 0.1, key = (i, j) => i + ',' + j, seen = new Set(), q = [[Math.round(sp.within.at.x / S), Math.round(sp.within.at.z / S)]];
    seen.add(key(...q[0])); while (q.length) { const [i, j] = q.pop(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj, k = key(a, b); if (seen.has(k) || !free(a * S, b * S)) continue; seen.add(k); q.push([a, b]); } }
    return [...seen].map(k => k.split(',').map(v => +v * S)); };
  fh.reset(); let pts = reach();
  assert.ok(pts.every(([x]) => x < E.x1), 'shut: the entrance hall only');
  fh.doors.great.set(1); pts = reach();
  assert.ok(pts.some(([x]) => x > G2.x0 + 2), 'open: on into the great hall');
  assert.ok(pts.every(([x, z]) => (x > E.x0 && x < E.x1 && z > E.z0 && z < E.z1) || (x > G2.x0 - 0.5 && x < G2.x1 && z > G2.z0 && z < G2.z1)), 'never outside the walls');
});

test('as found, and put right: all of it reset; restoration from the sheets, the shutters and the hearth; all at once, and each by itself', () => {
  const fh = hall(); fh.reset();
  assert.equal(fh.restored(), 0); assert.equal(fh.state.hearth, 'ash'); assert.ok(fh.state.sheets); assert.ok(!fh.state.pot);
  for (const k in fh.doors) assert.equal(fh.doors[k].k, 0, k + ' shut');
  fh.set('sheets', false); fh.set('shutter', [0, true]); const r = fh.restored(); assert.ok(r > 0 && r < 1, 'partly');
  fh.setRestored(1); assert.equal(fh.restored(), 1); assert.equal(fh.state.hearth, 'lit'); assert.ok(fh.state.fire);
  fh.reset(); assert.equal(fh.restored(), 0); assert.ok(!fh.state.fire);
});

test('the Hall walked: everything there is to do is somewhere he can stand and reach it, and its steps are ones the game plays', () => {
  const fh = hall(), free = freeIn(fh), S = H.roam, sp = fh.spots(); fh.doors.great.set(1);
  assert.ok(sp[S.from], 'begun at ' + S.from); assert.ok(sp[S.face], 'facing ' + S.face); assert.ok(S.intro.length);
  const STEPS = ['once', 'think', 'sfx', 'set', 'door', 'fade', 'sound', 'flag', 'wait'], WHEN = ['flag', 'not', 'door', 'shutter', ...Object.keys(fh.state)];
  const ids = new Set();
  for (const t of S.things) {
    assert.ok(!ids.has(t.id), 'one ' + t.id); ids.add(t.id);
    const p = fh.points[t.at]; assert.ok(p, t.id + ' at ' + t.at); assert.ok(t.label, t.id + ' offered');
    let ok = false; for (let x = -3; x < 12 && !ok; x += 0.05) for (let z = -3.5; z < 3.5 && !ok; z += 0.05) if (free(x, z) && Math.hypot(x - p.x, z - p.z) <= (t.reach || 1.4) - 0.05) ok = true;
    assert.ok(ok, t.id + ' can be reached');
    for (const k in t.when || {}) assert.ok(WHEN.includes(k), t.id + ' when ' + k);
    const all = st => { for (const s of st) { for (const k in s) assert.ok(STEPS.includes(k), t.id + ' step ' + k); if (s.fade) all(s.fade); if (s.sfx) assert.ok(SFX.includes(s.sfx), s.sfx); if (s.door) assert.ok(fh.doors[s.door[0]], s.door[0]); } };
    all(t.steps);
  }
  assert.ok(S.things.some(t => JSON.stringify(t.steps).includes(`"flag":"${S.done}"`)), 'something done ends it');
});

test('the great hall put right, played by its own conditions: in through its door, the sheets off, the shutters open, the hearth cleared, laid and lit, and the stew on', () => {
  const fh = hall(), S = H.roam, flags = new Set(), used = [];
  fh.reset();
  const cond = w => { if (!w) return true; for (const k in w) { const v = w[k];
    if (k === 'flag') { if (!flags.has(v)) return false; } else if (k === 'not') { if (flags.has(v)) return false; }
    else if (k === 'door') { if ((fh.doors[v[0]].k > 0.5) !== (v[1] === 'open')) return false; }
    else if (k === 'shutter') { if (!!fh.state.shutters[v[0]] !== v[1]) return false; }
    else if (fh.state[k] !== v) return false; } return true; };
  const run = st => { for (const s of st) { if (s.set) fh.set(s.set[0], s.set[1]); if (s.door) fh.doors[s.door[0]].set(s.door[1]); if (s.flag) flags.add(s.flag); if (s.fade) run(s.fade); } };
  // (each time, the first thing on the list that's wanted now and changes something: as a player working through it would)
  const changes = t => t.when && Object.keys(t.when).length;
  for (let n = 0; n < 40 && !flags.has(S.done); n++) { const t = S.things.find(t => changes(t) && cond(t.when) && !used.includes(t.id)); if (!t) break; used.push(t.id); run(t.steps); }
  assert.ok(flags.has(S.done), 'the stew on, at last: ' + used.join(', '));
  assert.ok(used.indexOf('great') < used.indexOf('ash'), 'into the great hall first');
  assert.deepEqual(['ash', 'lay', 'light', 'stew'].map(k => used.indexOf(k)).every((v, i, a) => v >= 0 && (!i || v > a[i - 1])), true, 'the hearth in its order');
  assert.equal(fh.restored(), 1, 'the great hall put right'); assert.ok(fh.state.pot && fh.state.pack);
  assert.ok(H.roam.last.some(s => s.think && /Redmere/.test(s.think)), 'and on to Redmere');
});
