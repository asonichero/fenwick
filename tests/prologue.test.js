// The prologue's opening scene (js/prologue.js): its script holds together: everyone in it made from a real spec, every line said by someone
// in it with a face they have, every shot and act it names defined, the story's beats in the GDD's order, the names kept back till the reveal;
// and its shots, from the hall as built, inside the hall and looking at who they're meant to.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.THREE = require('../vendor/three.min.js');
require('../js/cast.js'); require('../js/figure.js'); require('../js/kit.js'); require('../js/hall.js'); require('../js/prologue.js');
const { Prologue, Cast, Figure, Hall } = window, SC = Prologue.SCENES.hall;
const ACTS = ['adelaIn', 'nod', 'sonRises', 'sonToAdela', 'bow'];

test('the cast: the master, his son, Cicely in Adela’s gown, Adela in the goose girl’s dress, and Silas; each made from a real spec', () => {
  assert.deepEqual(Object.keys(SC.cast).sort(), ['adela', 'cicely', 'heir', 'master', 'silas']);
  const spec = s => s[0] === 'man' ? Cast.manSpec(s[1]) : s[0] === 'silas' ? Cast.squireSpec() : Cast.figureSpec(s[1], 'f', s[2]);
  for (const id in SC.cast) assert.ok(spec(SC.cast[id].spec), id);
  assert.equal(SC.cast.cicely.spec[2], 'gown'); assert.equal(SC.cast.adela.spec[2], 'goose');
  assert.ok(SC.cast.adela.off, 'Adela comes in through the archway, called on a pretext');
  for (const id in SC.cast) assert.ok(SC.names[id], id + ' has a name to show');
});

test('every beat is something the player can see or hear: lines by the cast with real faces, known shots and acts', () => {
  for (const [i, b] of SC.beats.entries()) {
    assert.ok(b.who || b.shot || b.act || b.pause || b.end || b.look, 'beat ' + i);
    if (b.who) { assert.ok(SC.cast[b.who], 'speaker ' + b.who); assert.ok(b.text && b.text.length > 1, 'beat ' + i); assert.ok(!b.to || SC.cast[b.to], 'to ' + b.to); }
    if (b.face) assert.ok(Figure.EXPRS[b.face], 'face ' + b.face);
    for (const id in b.listen || {}) { assert.ok(SC.cast[id], id); assert.ok(Figure.EXPRS[b.listen[id]], b.listen[id]); }
    for (const id in b.look || {}) { assert.ok(SC.cast[id], id); assert.ok(b.look[id] === null || SC.cast[b.look[id]], b.look[id]); }
    if (b.shot) assert.ok(SC.shots[b.shot], 'shot ' + b.shot); if (b.push) assert.ok(SC.shots[b.push], 'push ' + b.push);
    if (b.act) assert.ok(ACTS.includes(b.act), 'act ' + b.act);
  }
  assert.ok(SC.beats[SC.beats.length - 1].end, 'it ends in a cut to black');
  assert.deepEqual(Prologue.speakers(SC).sort(), ['adela', 'cicely', 'heir', 'master', 'silas']);
});

test('the story in the GDD’s order: the pretext, the parallel case, her sentence, “your own sentence”, the truth, the apology, the decree, the bow', () => {
  const at = f => SC.beats.findIndex(f), say = (who, re) => at(b => b.who === who && re.test(b.text));
  const order = [
    at(b => b.act === 'adelaIn'), say('silas', /neighbouring estate/), say('silas', /herd swine/), say('silas', /What should be done/),
    say('cicely', /thrashed/), say('master', /named your own sentence/), say('master', /Your name is Cicely/), say('master', /Her name is Adela/),
    at(b => b.act === 'sonToAdela'), say('heir', /make amends/), say('master', /your office/), at(b => b.act === 'bow'),
  ];
  for (const i of order) assert.ok(i >= 0, 'every beat there: ' + order);
  for (let k = 1; k < order.length; k++) assert.ok(order[k] > order[k - 1], 'in order at ' + k + ': ' + order);
  assert.ok(at(b => b.act === 'nod') < say('silas', /neighbouring estate/), 'Silas speaks at his master’s nod');
});

test('the names held back till the reveal: the bride and the goose girl, then Cicely and Adela', () => {
  assert.equal(SC.names.cicely, 'The bride'); assert.equal(SC.names.adela, 'The goose girl');
  const ci = SC.beats.findIndex(b => b.name && b.name.cicely), ai = SC.beats.findIndex(b => b.name && b.name.adela), rev = SC.beats.findIndex(b => b.who === 'master' && /own sentence/.test(b.text || ''));
  assert.equal(SC.beats[ci].name.cicely, 'Cicely'); assert.equal(SC.beats[ai].name.adela, 'Adela');
  assert.ok(ci > rev && ai > rev, 'named only after “You have named your own sentence”');
  assert.ok(!SC.beats.slice(0, rev).some(b => /Cicely|Adela/.test(b.text || '')), 'nobody says their names before it');
});

test('the shots, from the hall as built: each camera inside the hall (or the passage), above the floor, looking at someone a few metres off', () => {
  const h = Hall.build(new THREE.Scene()), S = h.spots(), B = h.bounds;
  for (const name in SC.shots) {
    const s = Prologue.shot(SC, name, S), [x, y, z] = s.cam;
    assert.ok(x > B.minX && x < B.maxX + 3.2 && z > B.minZ && z < B.maxZ, name + ' inside: ' + s.cam);
    assert.ok(y > 0.8 && y < B.ht - 0.5, name + ' at a height');
    const d = Math.hypot(s.look[0] - x, s.look[2] - z); assert.ok(d > 0.8 && d < 12, name + ' at a distance ' + d);
  }
  // (the close shots look at the one they're named for)
  for (const [name, who] of [['master', 'master'], ['bride', 'cicely'], ['silas', 'silas'], ['adela', 'adela']]) {
    const s = Prologue.shot(SC, name, S); assert.ok(Math.hypot(s.look[0] - S[who].at.x, s.look[2] - S[who].at.z) < 0.3, name);
  }
});
