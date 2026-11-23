// Walking (js/gait.js, from the Mixamo clips in models/walk.json): every walk planned comes out at the length asked, on its own feet: the
// start only where there's room, the stop on whichever foot follows on, the steps lengthened by little or nothing.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs');
globalThis.window = globalThis; globalThis.THREE = require('../vendor/three.min.js');
globalThis.fetch = async u => ({ json: async () => JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', u), 'utf8')) });
require('../js/gait.js');
const { Gait } = window, META = require('../models/fenwick_meta.json');
const fig = (sex, s) => { const rest = {}; for (const k in META[sex].joints) rest[k] = new THREE.Vector3(...META[sex].joints[k]).multiplyScalar(s); return { rest, root: { scale: { x: s } } }; };

test('the clips: the walk, the start, the stop and the stop mirrored; where they join', async () => {
  const D = await Gait.load('models/walk.json');
  for (const k of ['walk', 'start', 'stop', 'stopM']) { assert.ok(D.clips[k], k); for (const b of Gait.ORDER) assert.equal(D.clips[k].Q[b].length, D.clips[k].n, k + ' ' + b); }
  const J = D.join; assert.ok(J.cycle > 20 && J.startToWalk < J.cycle && J.walkToStop < J.cycle && J.startFirst >= 0);
  const W = D.clips.walk; assert.ok(W.z[J.cycle] - W.z[0] > 1, 'the walk goes forward, +z');
});

test('every walk planned comes out at the length asked, its steps lengthened by at most 12%', async () => {
  await Gait.load('models/walk.json');
  for (const [sex, s] of [['f', 0.98], ['m', 1.1]]) {
    const F = fig(sex, s), k = Gait.rig(F).k; assert.ok(k > 0.6 && k < 1.1, 'our legs against theirs: ' + k);
    for (let len = 0.3; len <= 8; len += 0.17) {
      const P = Gait.plan(F, len, {}); assert.ok(Math.abs(Gait.planned(F, P) - len) < 0.01, `${sex} ${len.toFixed(2)}: ${Gait.planned(F, P).toFixed(3)}`);
      assert.ok(Math.abs(P.sg - 1) <= 0.12 || P.seq.length === 1, `${sex} ${len.toFixed(2)} σ ${P.sg}`);
      assert.ok(/^stop/.test(P.seq[P.seq.length - 1].clip), 'it ends in the stop');
      if (P.seq[0].clip === 'start') assert.ok(len > 2.5, 'the start only with room for it');
    }
  }
});
