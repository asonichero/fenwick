// The figures: the skeleton has five-fingered hands and a bone for each cheek; every skinned point's weights sum to one; the seat's spots sit on
// the outer surface (not on a leg tube buried inside the buttock); every skinned material is dual-quaternion skinned; the clothes come and go.
// First the figures built in code (model: 'built'), then the same for the Blender-built ones (models/*.glb), and their build, layers and IK.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
// (a canvas that draws nothing: the face is painted on one)
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.THREE = require('../vendor/three.min.js');
require('../js/figure.js'); require('../js/cast.js');
const F = window.Figure, Cast = window.Cast;

const built = spec => Object.assign(spec, { model: 'built' });
const fig = Figure => Figure.make(built(Cast.figureSpec('goldie')));

test('hands have four two-jointed fingers and a thumb; each cheek has a bone', () => {
  const f = fig(F);
  for (const s of ['L', 'R']) {
    for (const n of ['index', 'middle', 'ring', 'pinky']) { assert.ok(f.bone[n + '1' + s] && f.bone[n + '2' + s], n + s); assert.equal(f.bone[n + '2' + s].parent, f.bone[n + '1' + s]); }
    assert.ok(f.bone['thumb1' + s] && f.bone['thumb2' + s]); assert.equal(f.bone['glute' + s].parent, f.bone.hips);
  }
});

test('every skinned point’s weights sum to one', () => {
  const f = fig(F);
  for (const m of [f.body, f.clothes.top, f.clothes.bottoms, f.clothes.under, f.bootL]) {
    const w = m.geometry.attributes.skinWeight.array;
    for (let i = 0; i < w.length; i += 4) { const t = w[i] + w[i + 1] + w[i + 2] + w[i + 3]; assert.ok(Math.abs(t - 1) < 1e-4, `weights ${t} at ${i / 4}`); }
  }
});

test('the seat’s spots are on the outer surface, weighted to the pelvis and the cheek', () => {
  for (const [id, spec] of Cast.IDS.map(id => [id, Cast.figureSpec(id)]).concat([['silas', Cast.squireSpec()]])) {
    const sex = spec.sex, f = F.make(built(spec)), g = f.body.geometry, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array, p = g.attributes.position;
    for (const k of ['cheekL', 'sitspotR', 'cheekR', 'sitspotL']) {
      const sp = f.spot[k];
      // nothing of the body lies further back near it
      for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i) - sp.bind.x, p.getY(i) - sp.bind.y) < 0.006) assert.ok(p.getZ(i) >= sp.bind.z - 0.006, `${id}/${sex} ${k}`);
      let leg = 0; for (let j = 0; j < 4; j++) if (/^thigh/.test(f.bones[si[sp.i * 4 + j]].name)) leg += sw[sp.i * 4 + j];
      assert.ok(leg < 0.5, `${id}/${sex} ${k} rides the thigh (${leg})`);
    }
  }
});

test('skinned materials use dual-quaternion skinning (shadows too)', () => {
  const f = fig(F);
  for (const m of [f.body, f.clothes.top, f.bootL]) {
    assert.match(m.material.customProgramCacheKey(), /^dqs\|/); assert.ok(m.customDepthMaterial);
    const sh = { vertexShader: '#include <skinning_pars_vertex>\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n#include <skinning_vertex>', fragmentShader: '', uniforms: {} };
    m.material.onBeforeCompile(sh); assert.match(sh.vertexShader, /dqQuat/); assert.doesNotMatch(sh.vertexShader, /#include <skinning_vertex>/);
  }
});

test('lowering and raising the clothes remakes them, and hides the skin under each', () => {
  const f = fig(F), hide = () => f.skinMat.userData.u.uHide.value, bit = r => (hide() >> r) & 1;
  assert.equal(bit(F.R.SEAT), 1);
  f.setClothes({ bottoms: 'down', under: 'down' }); assert.equal(bit(F.R.SEAT), 0); assert.equal(bit(F.R.SHIN), 1);
  f.setClothes({ top: 'up' }); assert.equal(bit(F.R.WAIST), 0); assert.equal(bit(F.R.WAIST_HI), 1);
});

test('a grip curls every finger the same way on each hand, mirrored', () => {
  const f = fig(F); f.grip('L', 1, 0, 1); f.grip('R', 1, 0, 1);
  for (const n of ['index', 'middle', 'ring', 'pinky']) { assert.ok(f.bone[n + '1L'].rotation.z < 0); assert.ok(f.bone[n + '1R'].rotation.z > 0); }
});

// ── The Blender-built figures ──
require('../vendor/GLTFLoader.js');
const fs = require('fs'), path = require('path'), MODELS = path.join(__dirname, '..', 'models');
const meta = JSON.parse(fs.readFileSync(path.join(MODELS, 'fenwick_meta.json')));
const glb = sx => { const b = fs.readFileSync(path.join(MODELS, 'fenwick_' + sx + '.glb')); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const loaded = Promise.all(['f', 'm'].map(sx => F.adopt(meta, sx, glb(sx))));
// (a heroine by id, or Silas: the household's one man)
const gfig = (id, sex) => F.make(sex === 'm' || id === 'silas' ? Cast.squireSpec() : Cast.figureSpec(id || 'belle'));

test('the Blender-built figures: the same skeleton, built from the models, every garment weighted to one (the armpits’ straight blend apart)', async () => {
  await loaded;
  for (const sex of ['f', 'm']) {
    const f = gfig('goldie', sex);
    assert.ok(f.model, 'made from the model'); assert.equal(f.bones.length, sex === 'm' ? 45 : 43);      // (his: two more, for his lift and his scrotum's own swing)
    for (const s of ['L', 'R']) { for (const n of ['index', 'middle', 'ring', 'pinky', 'thumb']) assert.equal(f.bone[n + '2' + s].parent, f.bone[n + '1' + s]); assert.equal(f.bone['glute' + s].parent, f.bone.hips); }
    // (every garment the model has, made: hers in each outfit and state, his raised, lowered and in uniform)
    if (sex === 'f') for (const id of Cast.IDS) for (const o of Cast.outfits(id)) { f.setPeriod(Cast.WARDROBE[id][o]); for (const st of [{ top: 'down', bottoms: 'up', under: 'up' }, { top: 'up', bottoms: 'down', under: 'down' }]) f.setClothes(st); check(f); }
    else { f.setClothes({ top: 'up', bottoms: 'down', under: 'down' }); f.setOutfit('uniform'); check(f); }
  }
  function check(f) {
    for (const m of [f.body, ...Object.values(f.gm)]) {
      const w = m.geometry.attributes.skinWeight.array, j = m.geometry.attributes.skinIndex.array;
      // (to one; or, round the armpits only, to 1 + their share blended straight across (see figure.js, DQS_PARS))
      const P = m.geometry.attributes.position, L = f.L;
      for (let i = 0; i < w.length; i += 4) {
        const t = w[i] + w[i + 1] + w[i + 2] + w[i + 3], k = i / 4;
        if (t > 1 + 1e-4) assert.ok(t <= 2 + 1e-4 && Math.abs(P.getY(k) - L.armpit) < 0.25 && Math.abs(P.getX(k)) > 0.04, `${m.geometry.name} weights ${t} at ${P.getX(k).toFixed(3)}, ${P.getY(k).toFixed(3)}`);
        else assert.ok(Math.abs(t - 1) < 1e-4, `${m.geometry.name} weights ${t}`);
      }
      for (let i = 0; i < j.length; i++) assert.ok(j[i] < f.bones.length);
      assert.match(m.material.customProgramCacheKey(), /^dqs\|/);
    }
  }
});

test('each one’s build sets the body’s shape keys, and the clothes follow them', async () => {
  await loaded;
  const silas = F.make(Cast.squireSpec()), slight = gfig('cinderella');      // (Silas: his one build, average)
  const inf = (f, m, k) => m.morphTargetInfluences[m.geometry.userData.keys[k]];
  assert.ok(inf(silas, silas.body, 'muscle') > 0.2 && inf(silas, silas.body, 'slight') === 0);
  assert.ok(inf(slight, slight.body, 'slight') > 0.2 && inf(slight, slight.body, 'muscle') === 0);
  for (const m of Object.values(silas.gm)) assert.equal(inf(silas, m, 'muscle'), inf(silas, silas.body, 'muscle'));
});

test('the body’s response: the sex fuller, his lifting on its own bone, a deeper tone there, and his pouch filling out', async () => {
  await loaded;
  for (const sex of ['f', 'm']) {
    const f = gfig('goldie', sex), inf = m => m.morphTargetInfluences[m.geometry.userData.keys.sexSwell];
    assert.ok('sexSwell' in f.body.geometry.userData.keys); assert.equal(inf(f.body), 0); assert.equal(f.skinMat.userData.u.uFlush.value.x, 0);
    f.setResponse(0.5); for (let i = 0; i < 120; i++) f.tick(0.05);
    assert.ok(inf(f.body) > 0.4, 'fuller'); if (sex === 'f') assert.ok(f.skinMat.userData.u.uFlush.value.x > 0.8, 'flushed'); else assert.equal(f.skinMat.userData.u.uFlush.value.x, 0, 'his: no tint');
    if (sex === 'm') {
      assert.equal(f.bone.sex.parent, f.bone.hips);
      assert.ok(f.bone.sex.rotation.x < -0.6 && f.bone.sex.rotation.x > -1.0, `lifting partway: ${f.bone.sex.rotation.x}`);
      assert.ok(inf(f.gm.Briefs) > 0.5 && inf(f.gm.Trousers) > 0.5, 'the pouch follows');
    } else assert.equal(f.bone.sex, undefined);
    f.setResponse(0); for (let i = 0; i < 200; i++) f.tick(0.05);
    assert.equal(inf(f.body), 0); if (sex === 'm') assert.ok(f.bone.sex.rotation.x > -0.01, 'and back down');
  }
});

test('her period layers: the dress (or kirtle), leggings where she wears them, drawers (or smalls); the skin under each hidden', async () => {
  await loaded;
  const shown = f => Object.entries(f.gm).filter(([, m]) => m.visible).map(([k]) => k).sort(), bit = (f, r) => (f.skinMat.userData.u.uHide.value >> r) & 1;
  const belle = gfig('belle');
  assert.deepEqual(shown(belle), ['Boots', 'Drawers', 'DressLong']);      // (her drawers under the skirt, drawn: it's cloth, and may lift off her)
  assert.deepEqual(belle.layers.sort(), ['top', 'under']); assert.equal(belle.skirt, 'long'); assert.equal(belle.clothes.bottoms, null);
  assert.equal(bit(belle, F.R.SEAT), 1, 'her drawers over her seat'); assert.equal(bit(belle, F.R.FOREARM), 1);
  belle.setClothes({ top: 'up' }); assert.deepEqual(shown(belle), ['Boots', 'Drawers', 'DressLong']);      // (raised, the same dress: its cloth rolls the back up) assert.equal(bit(belle, F.R.SEAT), 1);
  belle.setClothes({ under: 'down' }); assert.deepEqual(shown(belle), ['Boots', 'DrawersDown', 'DressLong']); assert.equal(bit(belle, F.R.SEAT), 0); assert.equal(bit(belle, F.R.THIGH), 0);
  assert.ok(belle.skinMat.userData.u.uStock.value.w > 0.5, 'stockings under a dress');
  const gretel = gfig('gretel');
  assert.deepEqual(shown(gretel), ['Boots', 'Kirtle', 'Leggings', 'Smalls']); assert.deepEqual(gretel.layers.sort(), ['bottoms', 'top', 'under']); assert.equal(gretel.skirt, 'short');
  assert.equal(gretel.skinMat.userData.u.uStock.value.w, 0, 'no stockings under leggings'); assert.equal(bit(gretel, F.R.SHIN), 1);
  gretel.setClothes({ top: 'up', bottoms: 'down', under: 'down' }); assert.deepEqual(shown(gretel), ['Boots', 'Kirtle', 'LeggingsDown', 'SmallsDown']); assert.equal(bit(gretel, F.R.SEAT), 0);
  // (what each takes off a smack: a skirt that's down most; bare, nothing)
  assert.equal(gretel.cushionOf('sitspot'), 0); belle.setClothes({ top: 'down', under: 'up' }); assert.ok(belle.cushionOf('sitspot') > 0.45);
  // (Red: her dress, or her walking clothes; the outfit changed, the garments with it)
  const red = gfig('red'); assert.ok(red.gm.DressElbow); red.setPeriod(Cast.WARDROBE.red.walking); assert.ok(red.gm.Kirtle && red.gm.Leggings && !red.gm.DressElbow);
});

test('the Blender-built seat’s spots are on its outer surface, in order down it', async () => {
  await loaded;
  for (const sex of ['f', 'm']) {
    const f = gfig('goldie', sex), p = f.body.geometry.attributes.position;
    for (const k of F.SPOTS) {
      const sp = f.spot[k];
      for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i) - sp.bind.x, p.getY(i) - sp.bind.y) < 0.006) assert.ok(p.getZ(i) >= sp.bind.z - 0.006, `${sex} ${k}`);
    }
    for (const s of ['L', 'R']) { const y = a => f.spot[a + s].bind.y; assert.ok(y('cheek') > y('sitspot') && y('sitspot') > y('thighs'), sex + s); }
  }
});

test('the arms, hanging a little out at rest, still reach where they’re sent', async () => {
  await loaded;
  const f = gfig(), V = THREE.Vector3;
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const W = new V(sx * 0.12, 1.25, 0.35);
    F.ik2(f, f.bone['upperArm' + s], f.bone['foreArm' + s], f.bone['hand' + s], W, new V(sx, -0.3, -0.5).normalize(), -1);
    assert.ok(f.bone['hand' + s].getWorldPosition(new V()).distanceTo(W) < 0.002, s);
  }
});

test('her forms: folds with the pelvis (only their lower outer edges sharing with the thighs), and the inner form between them with its own tone', async () => {
  await loaded;
  const f = gfig('goldie'), g = f.body.geometry, part = g.attributes._part, tone = g.attributes.tone, p = g.attributes.position;
  const w = g.attributes.skinWeight.array, j = g.attributes.skinIndex.array, hips = f.bones.indexOf(f.bone.hips);
  let sex = 0, inner = 0, offMid = 0, onHips = 0;
  for (let i = 0; i < part.count; i++) {
    if (part.getX(i) < 0.5) continue; sex++;
    let wh = 0; for (let k = 0; k < 4; k++) if (j[i * 4 + k] === hips) wh += w[i * 4 + k];
    if (wh > 0.65) onHips++;
    if (part.getX(i) > 1.5) { inner++; assert.equal(tone.getX(i), 1); if (Math.abs(p.getX(i)) > 0.006) offMid++; } else assert.equal(tone.getX(i), 0);
  }
  assert.ok(sex > 150 && inner > 5 && inner < sex / 3, `${sex} on the sex, ${inner} on the inner form`); assert.equal(offMid, 0, 'the inner form at the midline');
  assert.ok(onHips / sex > 0.85, `mostly with the pelvis: ${onHips}/${sex}`);
  const m = gfig('silas'); for (let i = 0; i < m.body.geometry.attributes.tone.count; i++) assert.equal(m.body.geometry.attributes.tone.getX(i), 0);
});

test('her clothes drawn on: lacing, chemise, apron, print, patches; the leggings darned; Silas in his waistcoat and boots', async () => {
  await loaded;
  const u = (f, k) => f.gm[k].material.userData.u;
  const goldie = gfig('goldie'); assert.ok(goldie.gm.DressElbow);
  assert.equal(u(goldie, 'DressElbow').uParam.value.w, 1, 'an apron'); assert.equal(u(goldie, 'DressElbow').uL0.value.z, 0, 'the uniform: plain'); assert.equal(u(goldie, 'DressElbow').uParam.value.z, 1, 'elbow sleeves');
  assert.deepEqual(Cast.WARDROBE.goldie.maid.main, Cast.WARDROBE.cinderella.maid.main, 'the maids in the same uniform');
  const eleanor = F.make(Cast.figureSpec('cinderella', 'f', 'dayoff')); assert.equal(u(eleanor, 'DressElbow').uL0.value.z, 1, 'her days-off dress: a print'); assert.equal(u(eleanor, 'DressElbow').uParam.value.w, 0, 'no apron');
  const snow = gfig('snow'); assert.equal(u(snow, 'DressLong').uL0.value.w, 1, 'her bodice its own colour'); assert.equal(u(snow, 'DressLong').uParam.value.w, 0, 'no apron');
  const gretel = gfig('gretel'); assert.equal(u(gretel, 'Kirtle').uL1.value.w, 1, 'patches'); assert.equal(u(gretel, 'Leggings').uL0.value.x, 1, 'darned');
  const silas = gfig('silas'), top = Object.keys(silas.gm).find(k => /^(Tunic|Shirt)/.test(k) && silas.gm[k].visible); assert.equal(top, 'Shirt');
  assert.equal(u(silas, 'Shirt').uL0.value.x, 4); assert.equal(u(silas, 'Boots').uParam.value.x, 0);
});

test('her skin’s painted detail and her feet, where the model puts them; the crease under her breasts by her bust; none on Silas', async () => {
  await loaded;
  const U = f => f.skinMat.userData.u, belle = gfig('belle'), red = gfig('red'), gretel = gfig('gretel'), silas = gfig('silas'), L = belle.L;
  assert.ok(L.nipple && L.navel && L.toes && L.footFrame, 'the model gives them'); assert.equal(L.toes.length, 20);
  assert.ok(U(belle).uNip.value.w > 0); assert.equal(U(belle).uNav.value.w, 1); assert.equal(U(belle).uKnee.value.w, 1); assert.ok(U(belle).uFootF.value.z > 0.9);
  const w = U(belle).uToe.value.map(v => v.z);       // (the toenails big to little, each a little further back than the last)
  for (let i = 1; i < 5; i++) assert.ok(w[i] < w[i - 1], `toe ${i}`);
  assert.ok(U(red).uBust.value.x > U(belle).uBust.value.x, 'lower on a fuller bust'); assert.ok(U(gretel).uBust.value.y < U(belle).uBust.value.y, 'fainter on a smaller');
  assert.equal(U(silas).uNip.value.w, 0); assert.equal(U(silas).uFootF.value.z, 0);
});

test('her skirt is cloth below the waist: as made standing; across a lap it lies over her seat and falls off her legs; raised, rolled to the small of her back, her seat clear; another of her as she was', async () => {
  await loaded;
  const belle = gfig('belle'), other = gfig('belle'), C = belle.cloth;
  assert.ok(C && C.mesh.visible && C.name === 'DressLong', 'her skirt has its cloth');
  assert.ok(belle.gm.DressLong.geometry.index.count < belle.model.mesh.DressLong.geo.index.count, 'the dress as built, without its skirt');
  const X = () => C.X, finite = () => Array.from(X()).every(Number.isFinite);
  // (standing: the skirt as it was made, its hem where the garment's is)
  belle.root.updateMatrixWorld(true); belle.tick(1 / 60); assert.ok(finite());
  let hemY = 0; for (let c = 0; c < C.NC; c++) hemY += X()[(c * (C.NR + 1) + C.NR) * 3 + 1] / C.NC;
  assert.ok(Math.abs(hemY - belle.L.skirtHem) < 0.06, `standing, its hem at ${hemY.toFixed(2)} (the garment's ${belle.L.skirtHem.toFixed(2)})`);
  // (face down across something, as over a lap: her seat uppermost)
  // (what of it lies over her seat: of its points within 5 cm of over the fullest of her cheek, the highest, how far above it)
  const seat = () => { const p = belle.surface('cheekL', null, 0).p; let above = -9, n = 0; for (let k = 0; k < X().length / 3; k++) { const q = new THREE.Vector3(X()[k * 3], X()[k * 3 + 1], X()[k * 3 + 2]).applyMatrix4(belle.root.matrixWorld); if (Math.hypot(q.x - p.x, q.z - p.z) < 0.05) { n++; above = Math.max(above, q.y - p.y); } } return { n, above }; };
  belle.root.position.y = 1.1; belle.root.rotation.x = Math.PI / 2; belle.root.updateMatrixWorld(true); belle.setDrape('otk'); belle.tick(1 / 60);
  assert.ok(finite(), 'settled');
  const s1 = seat(); assert.ok(s1.above > 0 && s1.above < 0.08, `across: the skirt over her seat (${s1.above.toFixed(3)} m above it)`);
  let low = 9; for (let k = 0; k < X().length / 3; k++) low = Math.min(low, new THREE.Vector3(X()[k * 3], X()[k * 3 + 1], X()[k * 3 + 2]).applyMatrix4(belle.root.matrixWorld).y);
  assert.ok(low < 1.0, `it falls off her legs toward the floor (lowest ${low.toFixed(2)} m)`);
  for (let i = 0; i < 30; i++) belle.tick(1 / 60); assert.ok(finite(), 'and stays');
  // (raised: the back rolled up to the small of her back, her seat clear of it)
  belle.setClothes({ top: 'up' }); belle.tick(1 / 60); assert.ok(finite());
  const s2 = seat(); assert.ok(s2.above < 0, `raised: nothing of it over her seat (${s2.above.toFixed(3)} m)`);
  assert.ok(C.roll && C.roll.size > 100, 'its back wound into a roll');
  belle.setClothes({ under: 'down' }); assert.equal((belle.skinMat.userData.u.uHide.value >> F.R.SEAT) & 1, 0, 'raised, and her drawers down: her seat not hidden');
  belle.setClothes({ top: 'down', under: 'up' }); assert.ok(belle.gm.Drawers && belle.gm.Drawers.visible, 'under her skirt, her drawers drawn: nothing under it hidden');
  // (another of her, standing, is as she was made)
  other.root.updateMatrixWorld(true); other.tick(1 / 60);
  let oh = 0; for (let c = 0; c < other.cloth.NC; c++) oh += other.cloth.X[(c * (other.cloth.NR + 1) + other.cloth.NR) * 3 + 1] / other.cloth.NC;
  assert.ok(Math.abs(oh - other.L.skirtHem) < 0.06, 'another of her in the same dress is as made');
});

test('Silas at night (his nightshirt over linen drawers, barefoot) and with nothing on; no stockings drawn on him', async () => {
  await loaded;
  const shown = f => Object.entries(f.gm).filter(([, m]) => m.visible).map(([k]) => k).sort();
  const night = F.make(Cast.squireSpec({ outfit: 'night' })); assert.deepEqual(shown(night), ['Drawers', 'NightShirt']); assert.equal(night.clothes.top, night.gm.NightShirt);
  assert.equal((night.skinMat.userData.u.uHide.value >> F.R.FOOT) & 1, 0, 'barefoot');
  const none = F.make(Cast.squireSpec({ outfit: 'none' })); assert.deepEqual(shown(none), []); assert.equal(none.skinMat.userData.u.uHide.value, 0);
  assert.equal(none.skinMat.userData.u.uStock.value.w, 0, 'no stockings drawn on his legs');
  // (a chemise isn't raised by hand: at the table it's up of itself; across the knee, up when her drawers come down, down when they're back)
  const gc = F.make(Cast.figureSpec('goldie', 'f', 'night')); assert.deepEqual(gc.layers, ['under']);
  gc.setDrape('table'); assert.equal(gc.state.top, 'up'); gc.setDrape('otk'); assert.equal(gc.state.top, 'down');
  gc.setClothes({ under: 'down' }); assert.equal(gc.state.top, 'up'); gc.setClothes({ under: 'up' }); assert.equal(gc.state.top, 'down');
  const bn = F.make(Cast.figureSpec('belle', 'f', 'night')); assert.deepEqual(bn.layers.sort(), ['top', 'under'], 'a night-dress raised as a skirt is');
  // (hers: each in her nightclothes, barefoot: a chemise, or a night-dress)
  const g = F.make(Cast.figureSpec('goldie', 'f', 'night')), b = F.make(Cast.figureSpec('belle', 'f', 'night'));
  assert.ok(g.gm.Chemise && g.gm.Chemise.visible && !g.gm.Boots, 'Goldie: her chemise, barefoot'); assert.ok(b.gm.NightDress && b.gm.NightDress.visible, 'Belle: her night-dress');
});

test('the Blender-built hair: every style the household wears, coloured per point, fitted to the head; his beard', async () => {
  const hb = fs.readFileSync(path.join(MODELS, 'fenwick_hair.glb')); await F.adoptHair(hb.buffer.slice(hb.byteOffset, hb.byteOffset + hb.byteLength));
  const styles = F.hairStyles();
  for (const id of Cast.IDS) { const L = Cast.ROSTER[id].look; assert.ok(styles.includes('Hair_' + (L.hairStyle === 'braid' ? L.hairCap : L.hairStyle)), id); }
  assert.ok(styles.includes('Hair_' + Cast.SQUIRE.look.hairStyle)); assert.ok(styles.includes('Beard_beard'));
  const f = gfig('goldie'); assert.ok(f.hairMesh && f.hairMesh.geometry.attributes.color, 'her curls, with their colour per point');
  const box = new THREE.Box3().setFromBufferAttribute(f.hairMesh.geometry.attributes.position);
  assert.ok(box.max.y > 2.1 && box.max.y < 3.2 && box.min.y > -3.5, `in head units: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);
  const s = gfig('silas'); assert.ok(s.hairMesh, 'his hair'); assert.equal(s.head.children.filter(m => m.isMesh && m.geometry.attributes.color).length, 2, 'his hair and his beard');
});

test('the braids: Red’s, Snow White’s and Rapunzel’s plaits hang from the head and bend down their length with gravity; Rapunzel’s reaches the waist', async () => {
  await loaded;
  for (const id of ['red', 'snow', 'rapunzel']) {
    const f = gfig(id); assert.ok(f.tail && f.tail.piv && f.tail.bones.length >= 6, id + ' a chain down the plait');
    f.root.updateMatrixWorld(true); for (let i = 0; i < 20; i++) f.tick(0.05);
    const root = f.tail.piv.getWorldPosition(new THREE.Vector3()), up = Figure.braidTip(f);
    assert.ok(up.y < root.y - 0.1, id + ' hangs down her back');
    // (laid on her side: it falls to the floor's side, bending, not held out from the head)
    f.root.rotation.z = Math.PI / 2; f.root.position.y = 1.2; f.root.updateMatrixWorld(true); for (let i = 0; i < 60; i++) f.tick(0.05);      // (up off the floor, which it lies on)
    const r2 = f.tail.piv.getWorldPosition(new THREE.Vector3()), tip = Figure.braidTip(f);
    assert.ok(tip.y < r2.y - 0.08, `${id}: the end ${(r2.y - tip.y).toFixed(2)} m below where it leaves the head`);
    for (const X of f.tail.X) assert.ok(Number.isFinite(X.x + X.y + X.z), id + ' settled');
  }
  const r = gfig('rapunzel'); r.root.updateMatrixWorld(true); for (let i = 0; i < 20; i++) r.tick(0.05);
  const tip = Figure.braidTip(r), waist = r.root.localToWorld(new THREE.Vector3(0, r.L.waist, 0)).y;
  assert.ok(tip.y < waist + 0.08, `the end of the plait at ${tip.y.toFixed(2)} m, the waist at ${waist.toFixed(2)} m`);
});
