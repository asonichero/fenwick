// The prologue's opening scene (js/prologue.js): its script holds together: everyone in it made from a real spec, every line said by someone
// in it with a face they have, every shot and act it names defined, the story's beats in the GDD's order, the names kept back till the reveal;
// and its shots, from the hall as built, inside the hall and looking at who they're meant to. Then the aftercare's two ways, as the correction
// ended: the offer, and after her word, the same offer set apart from the night, never as consolation.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.THREE = require('../vendor/three.min.js');
require('../js/cast.js'); require('../js/figure.js'); require('../js/kit.js'); require('../js/hall.js'); require('../js/office.js'); require('../js/prologue.js');
const { Prologue, Cast, Figure, Hall, Office } = window, SC = Prologue.SCENES.hall, OF = Prologue.SCENES.office;
const ACTS = ['adelaIn', 'nod', 'plead', 'sonRises', 'sonToAdela', 'kneel', 'bow', 'walk', 'sit', 'stand', 'door', 'unlace'];

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
    for (const id in b.look || {}) { assert.ok(SC.cast[id], id); assert.ok(b.look[id] === null || b.look[id] === 'down' || SC.cast[b.look[id]] || SC.points[b.look[id]], b.look[id]); }
    if (b.shot) assert.ok(SC.shots[b.shot], 'shot ' + b.shot); if (b.push) assert.ok(SC.shots[b.push], 'push ' + b.push);
    if (b.act) assert.ok(ACTS.includes(b.act), 'act ' + b.act);
  }
  assert.ok(SC.beats[SC.beats.length - 1].end, 'it ends in a cut to black');
  assert.deepEqual(Prologue.speakers(SC).sort(), ['adela', 'cicely', 'heir', 'master', 'silas']);
});

test('the story in the GDD’s order: the pretext, the parallel case, her sentence, “your own sentence”, the truth, the apology, the decree, the bow', () => {
  const at = f => SC.beats.findIndex(f), say = (who, re) => at(b => b.who === who && re.test(b.text));
  const order = [
    at(b => b.act === 'adelaIn'), say('silas', /neighbouring estate/), say('silas', /muck out the stables/), say('silas', /What should be done/),
    say('cicely', /thrashed/), say('master', /named your own sentence/), say('master', /Your name is Cicely/), say('master', /hers is Adela/),
    at(b => b.act === 'sonToAdela'), say('heir', /make amends/), say('master', /your office/), at(b => b.act === 'bow'),
  ];
  for (const i of order) assert.ok(i >= 0, 'every beat there: ' + order);
  for (let k = 1; k < order.length; k++) assert.ok(order[k] > order[k - 1], 'in order at ' + k + ': ' + order);
  assert.ok(at(b => b.act === 'nod') < say('silas', /neighbouring estate/), 'Silas speaks at his master’s nod');
  // (her plea to Young Thornleigh, her hand on his arm; he rises and answers her, then goes to Adela, and kneels on his second line to her)
  const plea = at(b => b.act === 'plead'), rise = at(b => b.act === 'sonRises'), answer = say('heir', /never my bride/), cross = at(b => b.act === 'sonToAdela'), kneel = at(b => b.act === 'kneel');
  assert.equal(SC.beats[plea].who, 'cicely'); assert.equal(SC.beats[plea].to, 'heir');
  assert.ok(plea < rise && rise < answer && answer < cross && cross < kneel, [plea, rise, answer, cross, kneel].join());
  assert.equal(SC.beats[answer].to, 'cicely');
  assert.equal(SC.beats.slice(cross, kneel + 1).filter(b => b.who === 'heir').length, 2, 'the kneel on his second line to her');
});

test('Cicely plays the great lady before she judges: finding fault with the house, scorning the goose girl and the steward, flattered into it', () => {
  const at = f => SC.beats.findIndex(f), judge = at(b => b.who === 'cicely' && /thrashed/.test(b.text));
  const hers = SC.beats.slice(0, judge).filter(b => b.who === 'cicely');
  assert.ok(hers.some(b => /turned off/.test(b.text)), 'the cook'); assert.ok(hers.some(b => /that one/.test(b.text)), 'the goose girl'); assert.ok(hers.some(b => /steward/.test(b.text)), 'the steward’s business');
  assert.ok(hers.filter(b => b.face === 'haughty').length >= 2, 'haughty');
  assert.ok(SC.beats.slice(0, judge).some(b => b.who === 'master' && /mistress here/.test(b.text)), 'the master flatters her into judging');
});

test('the case is a trade quarrel, not her story told back; the master translates it to her, piece by piece, before he names her', () => {
  const at = f => SC.beats.findIndex(f), rev = at(b => b.who === 'master' && /own sentence/.test(b.text || '')), named = at(b => b.who === 'master' && /Your name is Cicely/.test(b.text || ''));
  const from = at(b => b.who === 'silas' && /neighbouring estate/.test(b.text || '')), told = SC.beats.slice(from + 1, rev).filter(b => b.who === 'silas').map(b => b.text).join(' ');      // (the case itself, after he's introduced it)
  for (const w of ['farrier', 'apprentice', 'coat', 'stables', 'mare']) assert.ok(told.includes(w), 'Silas’s case: ' + w);
  for (const w of ['lady', 'gown', 'goose', 'geese', 'bride', 'Falada']) assert.ok(!told.includes(w), 'not in the case: ' + w);
  const tr = SC.beats.slice(rev + 1, named).filter(b => b.who === 'master').map(b => b.text).join(' ');
  for (const re of [/farrier was no farrier/, /apprentice was her waiting-maid/, /letter was her name/, /coat was a gown/, /stables were my goose-yard/, /Falada/]) assert.match(tr, re);
});

test('the names held back till the reveal: the bride and the goose girl, then Cicely and Adela', () => {
  assert.equal(SC.names.cicely, 'The Bride'); assert.equal(SC.names.master, 'Thornleigh'); assert.equal(SC.names.heir, 'Young Thornleigh'); assert.equal(SC.names.adela, 'The goose girl');
  const ci = SC.beats.findIndex(b => b.name && b.name.cicely), ai = SC.beats.findIndex(b => b.name && b.name.adela), rev = SC.beats.findIndex(b => b.who === 'master' && /own sentence/.test(b.text || ''));
  assert.equal(SC.beats[ci].name.cicely, 'Cicely'); assert.equal(SC.beats[ai].name.adela, 'Adela');
  assert.ok(ci > rev && ai > rev, 'named only after “You have named your own sentence”');
  assert.ok(!SC.beats.slice(0, rev).some(b => /Cicely|Adela|Falada/.test(b.text || '')), 'nobody says their names (or the mare’s) before it');
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

test('told in the second person, and the player names themselves on it; the scene calls them by their first name', () => {
  assert.equal(SC.cards.length, 1, 'straight from the title to the name'); assert.match(SC.cards[0].text, /^You manage Thornleigh’s lands and people/); assert.equal(SC.cards[0].ask, 'name');
  assert.ok(!SC.cards.some(c => /Fenwick|Silas/.test((c.big || '') + (c.small || '') + (c.text || ''))), 'no name given before they give it');
  assert.equal(SC.names.silas, '{first}');
  assert.ok(!SC.beats.some(b => /\bSilas\b/.test(b.text || '')), 'never “Silas” outright: {first}');
  assert.ok(SC.beats.filter(b => /\{first\}/.test(b.text || '')).length >= 3);
});

test('Young Thornleigh’s eyes: never on Cicely till her plea; his plate, his father, Silas; Adela once she’s named', () => {
  let L = SC.cast.heir.look; const seen = [];
  const plea = SC.beats.findIndex(b => b.act === 'plead');
  SC.beats.forEach((b, i) => { if (b.look && 'heir' in b.look) L = b.look.heir; seen.push(L); if (i < plea) assert.notEqual(L, 'cicely', 'at ' + i); });
  assert.ok(seen.slice(0, plea).every(l => l !== null && l !== undefined), 'kept, not following whoever speaks, before the plea');
  assert.equal(seen[plea], 'cicely', 'he looks at her when she turns to him');
  for (const k of ['hisPlate', 'master', 'silas', 'adela']) assert.ok(seen.slice(0, plea).includes(k), k);
  const named = SC.beats.findIndex(b => b.name && b.name.adela); assert.ok(!seen.slice(0, named).includes('adela'), 'not at the goose girl, till she’s named');
});

// ── The office: the confrontation ──
const flat = beats => beats.flatMap(b => [b].concat(b.choose ? b.choose.options.flatMap(o => flat(o.beats)) : []));

test('the office’s beats: lines by its cast with real faces, known shots and acts, walks along the office’s spots', () => {
  const o = Office.build(new THREE.Scene()), S = o.spots();
  assert.deepEqual(Object.keys(OF.cast).sort(), ['cicely', 'silas']); assert.equal(OF.cast.cicely.spec[2], 'gown', 'still in the gown, till the end');
  for (const [i, b] of flat(OF.beats).entries()) {
    if (b.who) { assert.ok(OF.cast[b.who], b.who); assert.ok(b.text, 'beat ' + i); assert.ok(!b.face || Figure.EXPRS[b.face], b.face); }
    if (b.shot) assert.ok(OF.shots[b.shot], b.shot); if (b.act) assert.ok(ACTS.includes(b.act), b.act);
    if (b.act === 'walk') for (const k of b.path) assert.ok(S[k], 'spot ' + k);
    if (b.act === 'sit' || b.act === 'stand') { assert.ok(OF.cast[b.by]); assert.ok(!b.at || S[b.at], b.at); }
    if (b.toward) assert.ok(OF.cast[b.toward] || S[b.toward], b.toward);
  }
  assert.ok(OF.beats[OF.beats.length - 1].end); assert.ok(OF.next && /correction/i.test(OF.next.title));
  for (const name in OF.shots) { const sh = Prologue.shot(OF, name, S), [x, y, z] = sh.cam, B = o.bounds; assert.ok(x > B.minX - 0.1 && x < B.maxX + 0.1 && z > B.minZ - 0.1 && z < B.maxZ + 0.1 && y > 0.8 && y < B.ht, name); }
});

test('the confrontation in order: the door shut; her plea, light; his answer (the one choice); his questions; she says what she did and concedes; he relents; the word; she accepts; the gown', () => {
  const B = OF.beats, at = f => B.findIndex(f), say = (who, re) => at(b => b.who === who && re.test(b.text || ''));
  const order = [at(b => b.act === 'door' && b.to === 0), say('cicely', /sensible man/), at(b => b.choose), say('silas', /What did you take/), say('silas', /mare/),
    say('silas', /geese/), say('silas', /stove/), say('cicely', /I took her gown/), say('cicely', /I named the sentence/), say('silas', /not thrash you, as you put it/),
    say('silas', /character/), say('silas', /The word is Falada/), say('cicely', /I accept/), say('silas', /gown first\. It was never yours to wear/), at(b => b.act === 'unlace'), at(b => b.end)];
  for (const i of order) assert.ok(i >= 0, order.join()); for (let k = 1; k < order.length; k++) assert.ok(order[k] > order[k - 1], 'in order at ' + k + ': ' + order);
  assert.match(B[say('cicely', /I named the sentence/)].text, /bid|must/, 'and that he must do as he’s bid');
  assert.ok(!B.slice(0, say('silas', /not thrash you/)).some(b => /Falada/.test(b.text || '')), 'the word only once he’s relented');
});

test('the one choice: how he answers her plea, firm, dry or gentle; each a line of his and her answer; kept as the tone', () => {
  const C = OF.beats.find(b => b.choose).choose; assert.equal(C.key, 'tone');
  assert.deepEqual(C.options.map(o => o.id), ['firm', 'dry', 'gentle']);
  for (const o of C.options) { assert.equal(o.beats[0].who, 'silas'); assert.equal(o.beats[1].who, 'cicely'); assert.ok(o.label && o.text); }
  assert.equal(OF.beats.filter(b => b.choose).length, 1);
});

// ── The aftercare and the offer: two ways it plays, as the correction ended ──
require('../js/talk.js');
const AC = Prologue.SCENES.aftercare, Talk = window.Talk;
// (the conversation played through by a player taking the choices in the order given (the first, each time, otherwise); everything said, in order)
async function talkThrough(steps, order) {
  const said = [], took = []; let k = 0;
  await Talk.play(steps, {
    line: s => { said.push(s); return Promise.resolve(); },
    choose: options => { const want = order && order[k++], o = options.find(x => x.label === want) || options[0]; return Promise.resolve(o); },
    took: o => took.push(o.label),
  });
  return { said, took, text: said.map(s => s.text).join('\n') };
}

test('the aftercare follows the correction, in his office; ended by the player, or by her word: a conversation for each', () => {
  assert.deepEqual(Prologue.ORDER.slice(0, 4), ['hall', 'office', 'correction', 'aftercare']);
  assert.equal(AC.room, 'office'); assert.ok(AC.talk.done && AC.talk.word);
  const faces = new Set(['teary', 'crying', 'sad', 'wistful', 'surprised', 'soft', 'calm', 'caring', 'concerned']);
  const walk = steps => { for (const s of steps) { if (s.choose) { for (const o of s.choose) { assert.ok(o.label); walk(o.then || []); } continue; }
    assert.ok(s.who === 'captain' || s.who === 'subject', s.text); assert.ok(s.text && s.text.length > 2); assert.ok(!s.expr || faces.has(s.expr), s.expr); } };
  walk(AC.talk.done); walk(AC.talk.word);
  assert.equal(Prologue.SCENES.correction.next.title, AC.title); assert.ok(!Prologue.SCENES.correction.wordNext, 'no end of its own after her word: on to the aftercare');
  assert.match(AC.next.title, /Coda/);
});

test('ended by the player: how she is, why it mattered, that it’s over, in any order; then he believes she’s sorry, and the place, if the master agrees', async () => {
  const ex = AC.talk.done.find(s => s.explore), labels = ex.choose.map(o => o.label).join(' | ');
  assert.match(labels, /how she is/i); assert.match(labels, /why it mattered/i); assert.match(labels, /over/i);
  const ends = ex.choose.filter(o => o.end); assert.equal(ends.length, 1);
  const all = await talkThrough(AC.talk.done, ['Say why it mattered', 'Tell her it’s over', 'Ask how she is']);
  assert.deepEqual(all.took.slice(0, 3), ['Say why it mattered', 'Tell her it’s over', 'Ask how she is'], 'in the order the player takes them');
  assert.match(all.text, /believe you’re sorry/i); assert.match(all.text, /if he agrees|if the master agrees/i); assert.match(all.text, /geese/);
  assert.ok(all.text.indexOf('believe you’re sorry') > all.text.indexOf('Sore. Ashamed.'), 'the offer last');
  assert.match(all.text, /offered, not ordered/i, 'offered, not imposed'); assert.match(all.said[all.said.length - 1].text, /Thank you/);
  // (or straight to it: the offer whenever he chooses to say it)
  const quick = await talkThrough(AC.talk.done, ['Tell her what you think']); assert.match(quick.text, /place for you here/);
});

test('after her word, the same offer, never as consolation: he owns it went too far first; she’s free, at no cost; the offer set apart, not amends; no answer wanted tonight', async () => {
  const W = AC.talk.word, first = W.findIndex(s => s.choose), before = W.slice(0, first).map(s => s.text).join('\n');
  assert.match(before, /went further than it should have/); assert.match(before, /mine to answer for/i, 'his, before the player chooses anything');
  for (const order of [['Tell her what you think'], ['Tell her she’s free', 'Ask how she is', 'Say why it mattered']]) {
    const r = await talkThrough(W, order), t = r.text;
    assert.match(t, /not as amends/i); assert.match(t, /Nothing makes up for/i); assert.match(t, /needn’t answer me tonight/i);
    assert.match(t, /if the master agrees/i); assert.match(t, /Or go, as I promised/i);
    assert.ok(t.indexOf('not as amends') < t.indexOf('place for you here'), 'set apart before it’s made');
    assert.match(t, /Not because of tonight/, 'if she stays, it’s for her own reasons');
    assert.ok(!/believe you’re sorry\. Truly sorry/.test(t), 'not the same words as the other way');
  }
  const free = await talkThrough(W, ['Tell her she’s free']); assert.match(free.text, /costs you nothing/i, 'her word costs her nothing');
  // (nothing in it that sounds like a reward for what was borne)
  const every = (await talkThrough(W, ['Ask how she is', 'Say why it mattered', 'Tell her she’s free'])).text;
  assert.ok(!/earned|deserve|reward|for what you bore|make it up/i.test(every.replace(/Nothing makes up for/, '')), 'no consolation');
});

// ── Coda: the letter: some weeks on, by day; Cicely, in the goose girl's dress, brings it; what he asks her, all of it, in any order; then he
// reads it, alone ──
const CO = Prologue.SCENES.coda, CODA_ACTS = ACTS.concat(['lay', 'take', 'open', 'read', 'lower', 'turn', 'gone']);
const allBeats = beats => beats.flatMap(b => [b].concat(b.talk ? b.talk.options.flatMap(o => allBeats(o.beats)) : []));

test('the coda: his office by day; him at his desk, her in the goose girl’s dress, coming in from the yard; every beat something to see or hear', () => {
  const o = Office.build(new THREE.Scene()), S = o.spots();
  assert.equal(CO.room, 'office'); assert.equal(CO.day, true); assert.match(CO.card.big, /weeks later/i, 'a card first: time passing'); assert.equal(typeof o.setDay, 'function'); o.setDay(true); assert.equal(o.day, true); o.setDay(false);
  assert.deepEqual(Object.keys(CO.cast).sort(), ['cicely', 'silas']); assert.equal(CO.cast.cicely.spec[2], 'goose', 'the goose girl’s plain dress now');
  assert.equal(CO.cast.silas.seat, 'silas', 'at his desk'); assert.ok(!CO.cast.cicely.off && CO.cast.cicely.mark === 'outside' && S.outside, 'behind the door from the first, ready to come in from the yard');
  const door = CO.beats.findIndex(b => b.act === 'door'); assert.ok(!CO.beats[door].pause && CO.beats[door + 1].act === 'walk' && CO.beats[door + 1].by === 'cicely', 'in as soon as it’s open');
  assert.equal(Prologue.ORDER[Prologue.ORDER.length - 1], 'coda', 'after the aftercare'); assert.match(Prologue.SCENES.aftercare.next.title, /Coda: the letter/);
  for (const [i, b] of allBeats(CO.beats).entries()) {
    assert.ok(b.who || b.shot || b.act || b.pause || b.end || b.look || b.sfx || b.talk || b.click || b.button, 'beat ' + i);
    if (b.who) { assert.ok(CO.cast[b.who], b.who); assert.ok(b.text, 'beat ' + i); assert.ok(!b.face || Figure.EXPRS[b.face], b.face); assert.ok(!b.to || CO.cast[b.to], b.to); }
    if (b.shot) assert.ok(CO.shots[b.shot], b.shot); if (b.act) assert.ok(CODA_ACTS.includes(b.act), b.act);
    if (b.act === 'walk') for (const k of b.path) assert.ok(S[k], 'spot ' + k);
    if (b.toward) assert.ok(CO.cast[b.toward] || S[b.toward], b.toward);
    if (b.look) for (const id in b.look) { const v = b.look[id]; assert.ok(v === null || v === 'down' || v === 'letter' || CO.cast[v] || CO.points[v], v); }
  }
  for (const name in CO.shots) { const sh = Prologue.shot(CO, name, S), [x, y, z] = sh.cam, B = o.bounds; assert.ok(x > B.minX - 0.1 && x < B.maxX + 0.1 && z > B.minZ - 0.1 && z < B.maxZ + 0.1 && y > 0.8 && y < B.ht, name); }
  assert.ok(CO.beats[CO.beats.length - 1].end); assert.ok(CO.next && CO.next.title);
});

test('the coda in order: a knock, “Come in”; she lays the letter down; he leaves it and comes round to her; the talk; she goes; he takes it up, opens it, reads', () => {
  const i = f => CO.beats.findIndex(f), at = (k, v) => i(b => b[k] === v);
  const knock = at('sfx', 'knock'), come = i(b => /Come in/.test(b.text || '')), lay = at('act', 'lay'), stand = i(b => b.act === 'stand' && b.by === 'silas'), talk = i(b => b.talk);
  const gone = at('act', 'gone'), take = at('act', 'take'), open = at('act', 'open'), read = at('act', 'read'), button = i(b => b.button), lower = at('act', 'lower');
  for (const [n, v] of Object.entries({ knock, come, lay, stand, talk, gone, take, open, read, button, lower })) assert.ok(v >= 0, n);
  assert.ok(knock < come && come < lay && lay < stand && stand < talk && talk < gone && gone < take && take < open && open < read && read < button && button < lower, 'in order');
  assert.match(CO.beats[button].button, /put the letter down/i, 'a button to put it down, once it’s read');
  // (and what it says, in his words, for whoever read it quickly)
  const after = CO.beats.slice(lower).filter(b => b.who === 'silas').map(b => b.text).join(' ');
  assert.match(after, /great-uncle/i); assert.match(after, /\{hall\}/); assert.match(after, /neglected/i); assert.match(after, /final say/i);
  assert.ok(CO.beats[lay].at && CO.points[CO.beats[lay].at], 'laid on the desk');
  // (he leaves it where it lies: it'll keep)
  assert.match(CO.beats.slice(stand, talk).map(b => b.text || '').join(' '), /keep/i);
});

test('the coda’s talk: how she’s keeping, the geese, Lady Adela, the letter; every one before it closes; and how she is matters more to him than the letter', () => {
  const T = CO.beats.find(b => b.talk).talk;
  assert.deepEqual(T.options.map(o => o.id), ['keeping', 'geese', 'adela', 'letter']);
  assert.ok(T.options.every(o => !o.end && o.beats.length >= 3), 'no way out but through all of them');
  const before = CO.beats[CO.beats.findIndex(b => b.talk) - 1]; assert.equal(before.hold, 'choices', 'the choices under her answer');
  const his = allBeats(CO.beats).filter(b => b.who === 'silas').map(b => b.text).join('\n'), hers = allBeats(CO.beats).filter(b => b.who === 'cicely').map(b => b.text).join('\n');
  assert.match(his, /best news I’ve had/); assert.match(his, /You’re here now/); assert.match(his, /Letter or no letter/); assert.match(his, /keep a while longer/);
  // (and better for what was done: she sleeps, she's good at her work, she asked her mistress's pardon, she didn't steal it)
  assert.match(hers, /I sleep/); assert.match(hers, /a way with them/); assert.match(hers, /asked her pardon/); assert.match(hers, /…I didn’t\./);
  // (then she's back to her work, and gone)
  const after = CO.beats.slice(CO.beats.findIndex(b => b.talk) + 1); assert.match(after[0].text, /get back/); assert.ok(after.some(b => b.act === 'walk' && b.by === 'cicely' && b.path[b.path.length - 1] === 'outside'));
});

test('the letter: a solicitor’s, the great-uncle dead, the Hall (the player’s surname) his, in the Fenwood; carried in by her; written out on the page as it’s read', () => {
  const L = CO.letter, text = L.text.map(t => t.p || t.right || t.sign || '').join(' ');
  assert.equal(L.start.by, 'cicely'); assert.match(text, /great-uncle/); assert.match(text, /\{hall\}/); assert.match(text, /Fenwood/); assert.match(text, /leaves to you/);
  assert.ok(L.text.some(t => t.sign), 'signed'); assert.ok(L.text.filter(t => t.p).length >= 4);
  assert.match(window.Player ? window.Player.fill(text) : text.replace(/\{hall\}/g, 'Fenwick Hall'), /Fenwick Hall/);
});
