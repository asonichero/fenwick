// The cast and what they say: every heroine is an adult (as the GDD has them: 18 to 21), each has a safe word of her own, every one has every
// scripted line, a full aftercare conversation and her terms; nobody but she says her word, and only when she calls it or agrees it.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const Cast = require('../js/cast.js'), Lines = require('../js/lines.js');
const REACT_KEYS = ['start', 'first', 'flinching', 'struggling', 'edge', 'past', 'plead', 'spent', 'accept', 'flushed', 'soothe', 'defy', 'yield', 'word', 'end'];

test('the seven heroines, in chapter order, as the GDD lists them', () => {
  assert.deepEqual(Cast.IDS, ['goldie', 'red', 'belle', 'cinderella', 'gretel', 'rapunzel', 'snow']);
  assert.deepEqual(Cast.IDS.map(id => Cast.ROSTER[id].chapter), [1, 2, 3, 4, 5, 6, 7]);
});

test('every heroine is an adult, 18 to 21, as the GDD states', () => {
  const AGES = { goldie: 18, red: 19, belle: 20, cinderella: 20, gretel: 19, rapunzel: 20, snow: 18 };
  for (const id of Cast.IDS) { const a = Cast.ROSTER[id].age; assert.ok(a >= 18 && a <= 21, id); assert.equal(a, AGES[id], id); }
  assert.ok(Cast.SQUIRE.age >= 30 && Cast.SQUIRE.age <= 49);
});

test('the names the GDD gives: Marigold called Goldie, Rose called Red, Eleanor called Eleanor', () => {
  assert.equal(Cast.ROSTER.goldie.name, 'Marigold'); assert.equal(Cast.ROSTER.goldie.short, 'Goldie');
  assert.equal(Cast.ROSTER.red.name, 'Rose'); assert.equal(Cast.ROSTER.cinderella.name, 'Eleanor'); assert.equal(Cast.ROSTER.cinderella.short, 'Eleanor');
  assert.equal(Cast.SQUIRE.name, 'Silas Fenwick');
});

test('each has her own safe word', () => {
  const words = Cast.IDS.map(id => Cast.ROSTER[id].word); assert.equal(new Set(words).size, words.length);
  for (const w of words) assert.match(w, /^[A-Z][a-z]+$/);
});

test('every heroine has every scripted line', () => {
  for (const id of Cast.IDS) for (const k of REACT_KEYS) assert.ok(Lines.react(id, k), id + ' ' + k);
  for (const k of ['hands', 'pin', 'down', 'rail', 'flat', 'edge', 'writing', 'desk', 'table']) assert.ok(Lines.captain(k, 'goldie') && !Lines.captain(k, 'goldie').includes('{'), k);
  for (const k of Object.keys(Lines.PLACE)) for (let i = 0; i < 20; i++) { const t = Lines.place('goldie', k); assert.ok(!t.includes('{'), k); assert.ok(Lines.PLACE[k].some(x => x.replace('{name}', 'Goldie') === t), k); }
});

test('the safe word is said only when it is called (or agreed, in the terms)', () => {
  for (const id of Cast.IDS) {
    const w = Cast.ROSTER[id].word;
    assert.ok(Lines.react(id, 'word').includes(w), id);
    for (const k of REACT_KEYS.filter(k => k !== 'word')) for (const t of [].concat(Lines.REACT[id][k])) assert.ok(!t.includes('{word}') && !t.includes(w), id + ' ' + k);
    for (const k in Lines.PLACE) for (const t of Lines.PLACE[k]) assert.ok(!t.includes('{word}'));
    for (const k in Lines.CAPTAIN) for (const t of Lines.CAPTAIN[k]) assert.ok(!t.includes('{word}'));
  }
});

test('aftercare: an opening, a choice of approach, an instruction, a last word, for either outcome', () => {
  for (const id of Cast.IDS) for (const outcome of ['done', 'word']) {
    const steps = Lines.after(id, outcome);
    assert.equal(steps.length, 4); assert.ok(steps[0].text); assert.ok(steps[1].explore);
    assert.equal(steps[1].choose.filter(c => !c.end).length, 3); assert.equal(steps[1].choose.filter(c => c.end).length, 1); assert.equal(steps[2].choose.length, 4);
    for (const c of steps[1].choose.concat(steps[2].choose)) for (const s of c.then) assert.ok(s.text && !s.text.includes('{'), id);
    assert.ok(!steps[0].text.includes(Cast.ROSTER[id].word) || outcome === 'word', id);
  }
});

test('defiance: each has back-talk, a breaking line and a guarded aftercare opening; Goldie, the most overt, is the most wilful', () => {
  for (const id of Cast.IDS) {
    const r = Cast.ROSTER[id];
    assert.ok(r.meters.wilfulness >= 0 && r.meters.wilfulness <= 1, id); assert.equal(r.meters.wilfulness, r.resist.overt, id);
    assert.ok(Lines.AFTER[id].open.unbroken.includes(Lines.after(id, 'done', 'unbroken')[0].text), id);
  }
  assert.equal(Cast.IDS.reduce((a, id) => (Cast.ROSTER[id].meters.wilfulness > Cast.ROSTER[a].meters.wilfulness ? id : a)), 'goldie');
  // (Gretel's is concealment: the most covert; Rapunzel and Snow White "low on both counts")
  assert.equal(Cast.IDS.reduce((a, id) => (Cast.ROSTER[id].resist.covert > Cast.ROSTER[a].resist.covert ? id : a)), 'gretel');
  for (const id of ['rapunzel', 'snow']) assert.ok(Cast.ROSTER[id].resist.overt <= 0.15 && Cast.ROSTER[id].resist.covert <= 0.15, id);
});

test('the terms: Silas sets them out, asks for her word, and she gives it; the last line repeats it back', () => {
  for (const id of Cast.IDS) {
    const t = Lines.terms(id), w = Cast.ROSTER[id].word;
    assert.ok(t.length >= 6, id); assert.equal(t[0].who, 'captain');
    assert.ok(t.some(s => s.who === 'subject' && s.text.includes(w)), id + ' gives her word');
    assert.ok(t[t.length - 1].text.startsWith(w), id);
    for (const s of t) assert.ok(!s.text.includes('{'), id);
  }
});

test('figure specs: each heroine’s own build and look, in her period clothes; the braids where they’re drafted; Silas the one man', () => {
  for (const id of Cast.IDS) {
    const s = Cast.figureSpec(id), W = Cast.WARDROBE[id];
    assert.equal(s.sex, 'f'); assert.ok(s.height > 1.5 && s.height < 1.8, id); assert.ok(s.hairStyle, id);
    assert.equal(s.outfit, 'period'); assert.equal(s.period, W[Cast.outfits(id)[0]], id + ' in her usual');
    for (const [k, o] of Object.entries(W)) {
      assert.ok(['dress', 'kirtle'].includes(o.kind) && ['long', 'elbow'].includes(o.sleeves), id + ' ' + k);
      for (const c of ['main', 'chemise', 'underCol', 'shoe']) assert.match(o[c], /^#[0-9a-f]{6}$/, id + ' ' + k + ' ' + c);
      // (leggings and a kirtle together, with smalls under them; a dress with drawers and stockings)
      if (o.legs === 'leggings') { assert.equal(o.kind, 'kirtle', id + ' ' + k); assert.equal(o.under, 'smalls'); } else { assert.equal(o.kind, 'dress', id + ' ' + k); assert.equal(o.under, 'drawers'); assert.ok(o.stockings, id + ' ' + k); }
    }
    assert.ok(Cast.ROSTER[id].period, id + ' has her wardrobe described');
  }
  // (leggings are Gretel's own, and Red's for walking the estate; everyone else in dresses)
  assert.deepEqual(Cast.IDS.filter(id => Object.values(Cast.WARDROBE[id]).some(o => o.legs === 'leggings')), ['red', 'gretel']);
  assert.equal(Cast.figureSpec('gretel').period.legs, 'leggings'); assert.equal(Cast.figureSpec('red').period.kind, 'dress'); assert.equal(Cast.figureSpec('red', 'f', 'walking').period.legs, 'leggings');
  assert.equal(Cast.figureSpec('rapunzel').hairStyle, 'braid'); assert.ok(Cast.figureSpec('rapunzel').braidLen >= 8); assert.equal(Cast.figureSpec('snow').hairCap, 'sidepart');
  const sq = Cast.squireSpec(); assert.equal(sq.sex, 'm'); assert.ok(sq.beard); assert.equal(sq.outfit, 'offduty'); assert.equal(sq.hairStyle, 'tousled');
  assert.ok(Cast.wriggle('gretel') > Cast.wriggle('belle'), 'the smaller wriggles more');
});

test('romance only where the GDD names it: Red and Belle', () => {
  for (const id of Cast.IDS) assert.equal(Cast.ROSTER[id].dynamic.romance === true, id === 'red' || id === 'belle', id);
});

test('Hansel is never part of a correction (he has no roster entry, word or lines)', () => {
  assert.ok(!Cast.ROSTER.hansel); assert.ok(Cast.VILLAGE.hansel); assert.ok(!Lines.REACT.hansel);
});
