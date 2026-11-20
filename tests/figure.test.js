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

test('the Blender-built figures: the same skeleton, built from the models, every garment weighted to one', async () => {
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
      for (let i = 0; i < w.length; i += 4) { const t = w[i] + w[i + 1] + w[i + 2] + w[i + 3]; assert.ok(Math.abs(t - 1) < 1e-4, `${m.geometry.name} weights ${t}`); }
      for (let i = 0; i < j.length; i++) assert.ok(j[i] < f.bones.length);
      assert.match(m.material.customProgramCacheKey(), /^dqs\|/);
    }
  }
});

test('each one’s build sets the body’s shape keys, and the clothes follow them', async () => {
  await loaded;
  const heavy = F.make(Cast.squireSpec({ build: 'heavy' })), slight = gfig('cinderella');
  const inf = (f, m, k) => m.morphTargetInfluences[m.geometry.userData.keys[k]];
  assert.ok(inf(heavy, heavy.body, 'muscle') > 0.7 && inf(heavy, heavy.body, 'slight') === 0);
  assert.ok(inf(slight, slight.body, 'slight') > 0.2 && inf(slight, slight.body, 'muscle') === 0);
  for (const m of Object.values(heavy.gm)) assert.equal(inf(heavy, m, 'muscle'), inf(heavy, heavy.body, 'muscle'));
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
  assert.deepEqual(shown(belle), ['Boots', 'DressLong']);      // (her drawers under the skirt, not drawn while it's down)
  assert.deepEqual(belle.layers.sort(), ['top', 'under']); assert.equal(belle.skirt, 'long'); assert.equal(belle.clothes.bottoms, null);
  assert.equal(bit(belle, F.R.SEAT), 1); assert.equal(bit(belle, F.R.FOREARM), 1);
  belle.setClothes({ top: 'up' }); assert.deepEqual(shown(belle), ['Boots', 'Drawers', 'DressLongUp']); assert.equal(bit(belle, F.R.SEAT), 1);
  belle.setClothes({ under: 'down' }); assert.deepEqual(shown(belle), ['Boots', 'DrawersDown', 'DressLongUp']); assert.equal(bit(belle, F.R.SEAT), 0); assert.equal(bit(belle, F.R.THIGH), 0);
  assert.ok(belle.skinMat.userData.u.uStock.value.w > 0.5, 'stockings under a dress');
  const gretel = gfig('gretel');
  assert.deepEqual(shown(gretel), ['Boots', 'Kirtle', 'Leggings', 'Smalls']); assert.deepEqual(gretel.layers.sort(), ['bottoms', 'top', 'under']); assert.equal(gretel.skirt, 'short');
  assert.equal(gretel.skinMat.userData.u.uStock.value.w, 0, 'no stockings under leggings'); assert.equal(bit(gretel, F.R.SHIN), 1);
  gretel.setClothes({ top: 'up', bottoms: 'down', under: 'down' }); assert.deepEqual(shown(gretel), ['Boots', 'KirtleUp', 'LeggingsDown', 'SmallsDown']); assert.equal(bit(gretel, F.R.SEAT), 0);
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
  assert.equal(u(goldie, 'DressElbow').uParam.value.w, 1, 'an apron'); assert.equal(u(goldie, 'DressElbow').uL0.value.z, 1, 'a print'); assert.equal(u(goldie, 'DressElbow').uParam.value.z, 1, 'elbow sleeves');
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

test('her skirt draped as she lies, from Blender: each pose its own, down or raised; her own copy, not another’s; as built when she stands', async () => {
  await loaded;
  const j = JSON.parse(fs.readFileSync(path.join(MODELS, 'fenwick_drapes.json'))), b = fs.readFileSync(path.join(MODELS, 'fenwick_drapes.bin'));
  F.adoptDrapes(j, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  for (const g of ['DressLong', 'DressElbow', 'Kirtle']) {
    assert.deepEqual(Object.keys(j.meshes[g].poses).sort(), ['after', 'bed', 'edge', 'otk', 'table'], g);
    assert.deepEqual(Object.keys(j.meshes[g + 'Up'].poses).sort(), ['bed', 'edge', 'otk', 'table'], g + 'Up');
  }
  const belle = gfig('belle'), other = gfig('belle'), pos = f => Float32Array.from(f.gm[f.topName].geometry.attributes.position.array);
  const rest = pos(belle); belle.setDrape('otk'); const otk = pos(belle);
  let moved = 0; for (let i = 0; i < rest.length; i++) moved = Math.max(moved, Math.abs(otk[i] - rest[i]));
  assert.ok(moved > 0.1, `across the knee, its hem falls away (${moved.toFixed(2)} m)`);
  assert.deepEqual(Array.from(pos(other)), Array.from(rest), 'another in the same dress is as she was');
  belle.setClothes({ top: 'up' }); assert.equal(belle.topName, 'DressLongUp'); assert.equal(belle.gm.DressLongUp.userData.drapeKey, 'DressLongUp|otk');
  belle.setClothes({ top: 'down' }); belle.setDrape(null); assert.deepEqual(Array.from(pos(belle)), Array.from(rest), 'standing, as built');
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

test('the braids: Red’s, Snow White’s and Rapunzel’s plaits hang from the head and swing with gravity; Rapunzel’s reaches the waist', async () => {
  await loaded;
  for (const id of ['red', 'snow', 'rapunzel']) {
    const f = gfig(id); assert.ok(f.tail && f.tail.piv, id);
    f.root.rotation.z = Math.PI / 2; f.root.updateMatrixWorld(true); for (let i = 0; i < 60; i++) f.tick(0.05);
    assert.ok(Math.abs(f.tail.piv.rotation.z) > 0.5, id + ' swings toward the floor');
  }
  const r = gfig('rapunzel'); r.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(r.tail.piv), waist = r.L.waist * r.root.scale.x;
  assert.ok(box.min.y < waist + 0.08, `the end of the plait at ${box.min.y.toFixed(2)} m, the waist at ${waist.toFixed(2)} m`);
});
