// The estate: the chapters open their zones in order; the Hall warms as it's restored; the homes and vignettes follow who's in residence;
// nothing in one relationship lowers another; and the post-game habit drift leaves clues until someone intervenes.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const Cast = require('../js/cast.js'), Estate = require('../js/estate.js');
const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

test('eight chapters, each with its zone and featured heroine, as the GDD tables them', () => {
  assert.equal(Estate.CHAPTERS.length, 8);
  assert.deepEqual(Estate.CHAPTERS.slice(0, 7).map(c => c.featured[0]), Cast.IDS);
  for (const c of Estate.CHAPTERS) { assert.ok(Estate.ZONES[c.zone], c.id); assert.equal(Estate.ZONES[c.zone].chapter, c.n, c.id); assert.ok(c.conflict && c.beats.length, c.id); }
  assert.deepEqual(Estate.CHAPTERS[3].with, ['goldie']); assert.deepEqual(Estate.CHAPTERS[6].with, ['belle']);
  assert.equal(Estate.CHAPTERS[1].journey.id, 'escort');      // (the twilight walk)
});

test('progression is gated: a zone opens only once its chapter is reached; the trail opens the village', () => {
  const s = Estate.create();
  assert.ok(s.zones.hall.open); assert.ok(!s.zones.study.open);
  assert.equal(Estate.unlock(s, 'study'), false);
  s.chapter = 2; assert.ok(Estate.clear(s, 'gate')); assert.ok(s.zones.village.open);
  s.chapter = 3; assert.ok(Estate.unlock(s, 'study'));
  assert.equal(Estate.ZONES.briar.gate.kind, 'clear'); assert.equal(Estate.ZONES.westwing.gate.kind, 'unlock');
});

test('the Hall warms as it’s restored, and only once every hearth is lit is it the ending’s house', () => {
  const s = Estate.create(); const w0 = Estate.warmth(s);
  assert.equal(Estate.restore(s, 'study'), false, 'not before its zone is open');
  assert.ok(Estate.restore(s, 'guest', 0.4)); assert.equal(Estate.light(s, 'guest'), false, 'not lit till it’s half restored');
  Estate.restore(s, 'guest', 0.6); assert.ok(Estate.light(s, 'guest')); assert.ok(Estate.warmth(s) > w0);
  assert.ok(!Estate.everyHearth(s));
  s.chapter = 8; for (const z in Estate.ZONES) Estate.open(s, z);
  for (const id in Estate.ROOMS) { Estate.restore(s, id, 1); Estate.light(s, id); }
  assert.ok(Estate.everyHearth(s)); assert.ok(Estate.warmth(s) > 0.99);
});

test('homes and vignettes: the roommates once Goldie and Eleanor are both in; Red lives in the village', () => {
  const s = Estate.create();
  Estate.arrive(s, 'goldie'); assert.equal(Estate.vignettes(s).length, 0);
  Estate.arrive(s, 'cinderella'); assert.deepEqual(Estate.vignettes(s).map(v => v.id), ['roommates']);
  assert.equal(Estate.homeOf('goldie'), Estate.homeOf('cinderella')); assert.equal(Estate.homeOf('belle'), Estate.homeOf('snow'));
  assert.equal(Estate.homeOf('red'), 'bakery'); assert.equal(Estate.arrive(s, 'goldie'), false);
});

test('non-exclusivity: no sequence of choices in one thread lowers another', () => {
  const s = Estate.create(), rnd = seeded(11); for (const id of Cast.IDS) Estate.arrive(s, id);
  for (let i = 0; i < 2000; i++) {
    const id = Cast.IDS[Math.floor(rnd() * 7)], before = JSON.parse(JSON.stringify(s.tracks));
    const fx = {}; for (const k of Estate.TRACK) if (rnd() < 0.5) fx[k] = (rnd() - 0.5) * 0.4; if (rnd() < 0.3) fx.romance = (rnd() - 0.5) * 0.4;
    Estate.affect(s, id, fx);
    for (const other of Cast.IDS) if (other !== id) assert.deepEqual(s.tracks[other], before[other], `${id}'s choice moved ${other}`);
  }
  assert.throws(() => Estate.affect(s, 'hansel', { trust: 1 }));
});

test('romance tracks only where it’s named (Red, Belle) until the designer opens one', () => {
  const s = Estate.create(); for (const id of Cast.IDS) Estate.arrive(s, id);
  assert.equal(s.tracks.red.romance, 0); assert.equal(s.tracks.belle.romance, 0); assert.equal(s.tracks.goldie.romance, null);
  Estate.affect(s, 'goldie', { romance: 0.3 }); assert.equal(s.tracks.goldie.romance, null);
  Estate.allowRomance(s, 'goldie'); Estate.affect(s, 'goldie', { romance: 0.3 }); assert.ok(Math.abs(s.tracks.goldie.romance - 0.3) < 1e-9);
});

test('habit drift: post-game only; unchecked it slides and leaves the GDD’s clues; an intervention lifts it', () => {
  const s = Estate.create(); for (const id of Cast.IDS) Estate.arrive(s, id);
  assert.deepEqual(Estate.drift(s, 10, seeded(3)), [], 'not before the post-game'); assert.equal(s.day, 0);
  s.postgame = true;
  const g0 = Object.assign({}, s.habits.goldie), clues = Estate.drift(s, 30, seeded(5));
  assert.ok(s.habits.goldie.compliance < g0.compliance || s.habits.goldie.compliance <= s.habits.goldie.floor.compliance + 1e-9);
  assert.ok(clues.length > 0);
  for (const c of clues) assert.ok(Estate.LAPSES[c.id].some(l => l.clue === c.clue && l.lapse === c.lapse), c.clue);
  for (const id of Cast.IDS) for (const k of ['compliance', 'mindfulness']) assert.ok(s.habits[id][k] >= s.habits[id].floor[k] - 1e-9 && s.habits[id][k] <= 1);
  const c0 = s.habits.goldie.compliance; Estate.intervene(s, 'goldie', 'correction'); assert.ok(s.habits.goldie.compliance > c0);
  // (the GDD's named clues are all there: unlatched doors, misplaced ledgers, late-night candle glow)
  const all = Object.values(Estate.LAPSES).flat().map(l => l.clue).join(' | ');
  for (const k of ['unlatched', 'misplaced ledger', 'candle glow']) assert.ok(all.includes(k), k);
});

test('the week: village days, Hall days and boundary walks, each serving those in residence', () => {
  const s = Estate.create(); for (const id of Cast.IDS) Estate.arrive(s, id);
  assert.deepEqual([...new Set(Estate.WEEK)].sort(), ['boundary', 'hall', 'village']);
  for (let d = 0; d < 7; d++) { s.day = d; assert.ok(Estate.servedToday(s).length > 0, Estate.dayKind(s)); }
  const all = new Set(Object.values(Estate.DAY_SERVES).flat()); for (const id of Cast.IDS) assert.ok(all.has(id), id + ' is served by some day');
});

test('the chapters run beat by beat into the post-game; the finale gives every heroine a role', () => {
  const s = Estate.create(); let n = 0; while (!s.postgame && n < 500) { Estate.step(s); n++; }
  assert.ok(s.postgame); assert.equal(n, Estate.CHAPTERS.reduce((a, c) => a + c.beats.length, 0));
  const roled = new Set(Estate.FINALE.roles.flatMap(r => r.who)); assert.deepEqual([...roled].sort(), [...Cast.IDS].sort());
  assert.throws(() => Estate.raise(s, 'charm', 0.1)); assert.equal(Estate.raise(s, 'protector', 0.3), 0.3);
});
