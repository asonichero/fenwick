// Walking (js/gait.js, from the Mixamo loops in models/walk.json): each figure's walk a blend of the loops, lined up step for step; every walk
// planned comes out at the length asked, ending on a heel strike, its steps lengthened by a hair if at all.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs');
globalThis.window = globalThis; globalThis.THREE = require('../vendor/three.min.js');
globalThis.fetch = async u => ({ json: async () => JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', u), 'utf8')) });
require('../js/gait.js');
const { Gait } = window, META = require('../models/fenwick_meta.json');
const fig = (sex, s) => { const rest = {}; for (const k in META[sex].joints) rest[k] = new THREE.Vector3(...META[sex].joints[k]).multiplyScalar(s); return { rest, root: { scale: { x: s } } }; };

test('the loops: the standard walk, the female walk and the sad walk, each with its own rest, lined up from the left heel’s strike', async () => {
  const D = await Gait.load('models/walk.json');
  for (const k of ['walk', 'female', 'sad']) {
    const c = D.clips[k]; assert.ok(c && c.loop, k); assert.ok(c.per > 1, k + ' goes forward, +z');
    assert.ok(c.off >= 0 && c.off < c.cyc, k); for (const b of Gait.ORDER) { assert.equal(c.Q[b].length, c.n, k + ' ' + b); assert.ok(c.avg[b], k + ' ' + b); }
    assert.ok(D.rests[k] && D.rests[k].hips, k + '’s own rest');
  }
  assert.ok(D.rests.female.hips.pos[1] < D.rests.walk.hips.pos[1] - 0.1, 'her character’s smaller: its own legs, its own scale');
});

test('the styles: Silas’s and Adela’s own walks, blended from the loops, quieter than the standard walk', () => {
  const S = Gait.STYLES;
  for (const k of ['silas', 'adela', 'plain']) { const m = S[k].mix; assert.ok(Object.keys(m).every(c => ['walk', 'female', 'sad'].includes(c)), k); assert.ok(S[k].arms > 0 && S[k].arms <= 1, k); }
  assert.ok(S.silas.mix.sad > 0 && S.silas.arms < 1, 'Silas: sobered, his arms easier');
  assert.ok(S.adela.mix.female > 0 && S.adela.head > S.silas.head && S.adela.arms < S.silas.arms, 'Adela: her head bowed, her hands still');
});

test('every walk planned comes out at the length asked, ending on a heel strike, its steps lengthened by under 3%', async () => {
  await Gait.load('models/walk.json');
  for (const [sex, s, style] of [['f', 0.98, 'adela'], ['m', 1.1, 'silas'], ['f', 0.98, 'plain']]) {
    const F = fig(sex, s);
    for (let len = 0.3; len <= 8; len += 0.17) {
      const P = Gait.plan(F, len, { style }), end = (((P.ph0 + P.span) % 0.5) + 0.5) % 0.5;
      assert.ok(Math.abs(Gait.planned(F, P) - len) < 0.005, `${style} ${len.toFixed(2)}: ${Gait.planned(F, P).toFixed(3)}`);
      assert.ok(Math.min(end, 0.5 - end) < 1e-6, `${style} ${len.toFixed(2)}: ends on a heel strike (${end})`);
      assert.ok(Math.abs(P.sg - 1) < 0.03, `${style} ${len.toFixed(2)} σ ${P.sg}`);
    }
  }
});

// (a stand-in skeleton from the measured joints: each bone at its joint, its parent's as the figure has it; at rest, every turn none)
function skeleton(sex, s) {
  const J = META[sex].joints, P = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', clavL: 'chest', upperArmL: 'clavL', foreArmL: 'upperArmL', handL: 'foreArmL',
    clavR: 'chest', upperArmR: 'clavR', foreArmR: 'upperArmR', handR: 'foreArmR', thighL: 'hips', shinL: 'thighL', footL: 'shinL', toeL: 'footL', thighR: 'hips', shinR: 'thighR', footR: 'shinR', toeR: 'footR' };
  const F = fig(sex, s), root = new THREE.Object3D(), bone = {}, bones = [];
  for (const k of Gait.ORDER) { const b = new THREE.Bone(); b.name = k; bone[k] = b; bones.push(b); }
  for (const k of Gait.ORDER) { const at = new THREE.Vector3(...J[k]); if (P[k]) { bone[P[k]].add(bone[k]); bone[k].position.copy(at.sub(new THREE.Vector3(...J[P[k]]))); } else { root.add(bone[k]); bone[k].position.copy(at); } }
  const rest0 = {}; for (const k in bone) rest0[k] = bone[k].position.clone();
  root.scale.setScalar(s);
  return Object.assign(F, { root, bone, bones, rest0, resetPose() { for (const k in bone) { bone[k].quaternion.identity(); bone[k].position.copy(rest0[k]); } }, grip() {} });
}

test('walking, the shoulders stay as the figure holds them standing; the arms still swing from them', async () => {
  await Gait.load('models/walk.json');
  for (const [sex, s, style] of [['m', 1.1, 'silas'], ['f', 0.98, 'adela']]) {
    const F = skeleton(sex, s), arm = [];
    for (let ph = 0; ph < 1; ph += 0.05) {
      Gait.pose(F, style, ph);
      for (const sd of ['L', 'R']) assert.ok(F.bone['clav' + sd].quaternion.angleTo(new THREE.Quaternion()) < 1e-6, `${style} ${ph.toFixed(2)}: the ${sd} shoulder kept`);
      arm.push(F.bone.upperArmL.quaternion.clone());
    }
    const swing = Math.max(...arm.map(q => q.angleTo(arm[0])));
    assert.ok(swing > 0.15, `${style}: the arm swings (${swing.toFixed(2)} rad)`);
  }
});
