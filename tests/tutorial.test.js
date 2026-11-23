// The prologue's correction as a tutorial (js/tutorial.js over SCENES.correction): played through against a stand-in for the correction
// engine by a player who does what each prompt asks, it goes through its phases in the GDD's order, teaching each control as it first
// matters, and every control closed till then, End too; she never comes up out of position; her hand stops the run and waits for the
// player's choice, and the run waits for them to begin it again; her defiance is held up till the breaking; it can't be ended before
// she's accepted it; and her word stops it.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
require('../js/prologue.js'); require('../js/tutorial.js');
const { Prologue, Tutorial } = window, SC = Prologue.SCENES.correction;

// (the stand-in: smacks while running, distress climbing with them and easing off; she covers when the director's forced it, and the run
// stops with it, as the engine has it; her hand moved or taken by the player's choice; her defiance drained toward nothing by distress, never
// below the director's floor)
function fake() {
  const P = { hits: 0, f: { state: { top: 'down', under: 'up' } }, rel: { submission: 0.1 }, said: {}, def: 0.85, def0: 0.85 };
  let D = 0, cover = false, pinned = false, covers = 0;
  const ses = { current: P, st: { phase: 'turn', soothe: false, running: false, pace: 1, strength: 1 }, distress: () => D,
    get covering() { return cover; }, get pinned() { return pinned; },
    cover() { if (!pinned) { cover = true; covers++; ses.st.running = false; } },
    tell() { if (cover) { cover = false; return 'hand'; } return false; }, takeHand() { if (!cover) return false; cover = false; pinned = true; return true; } };
  const tick = (dir, dt) => {
    if (ses.st.running && !cover) { P.hits += dt * 2 * ses.st.pace; D = Math.min(1.4, D + dt * 0.04 * ses.st.strength); }
    else D = Math.max(0, D - dt * 0.01);
    P.hits = Math.round(P.hits * 1000) / 1000;
    const floor = dir.floor(P), tgt = Math.max(floor, 0.85 * (1 - Math.min(1, D)));
    if (tgt < P.def) { const was = P.def; P.def = tgt; if (was >= 0.2 && P.def < 0.2) P.said.yield = 1; }
  };
  return { P, ses, tick };
}

function play(choose, hands) {
  hands = hands || ['tell', 'take']; let nh = 0;
  const F = fake(), said = [], T = Tutorial.director(SC); T.attach(F.ses, { say: t => said.push(t) });
  const phases = [], taught = new Set(); let t = 0, endedEarly = false, ranUntaught = false, restarts = 0, couldEnd = false;
  for (; t < 600; t += 0.1) {
    F.tick(T.director, 0.1); T.update(0.1);
    if (!phases.includes(T.phase.id)) phases.push(T.phase.id);
    const pr = T.prompt; for (const a of pr ? [pr.act].concat(pr.acts || []) : []) if (a) taught.add(a);
    if (T.canEnd) couldEnd = true;
    // (the player: does what the prompt asks; otherwise keeps a run going)
    const act = pr && (pr.act || (pr.acts && (pr.acts.length > 1 ? hands[Math.min(nh, hands.length - 1)] : pr.acts[0])));
    if (!T.canEnd && F.ses.st.running && t > 30 && t < 30.2) endedEarly = T.canEnd;      // (trying to end it early: it can't)
    if (act === 'tell') { const r = F.ses.tell(); if (r === 'hand') nh++; T.did('tell'); }
    else if (act === 'take') { F.ses.takeHand(); nh++; T.did('take'); }
    else if (act === 'top') { F.P.f.state.top = 'up'; T.did('top'); }
    else if (act === 'under') { F.P.f.state.under = 'down'; T.did('under'); }
    else if (act === 'run') { if (T.phase.id === 'covering') restarts++; F.ses.st.running = true; T.did('run'); }
    else if (act === 'pace') { F.ses.st.pace = 1.25; T.did('pace'); }
    else if (act === 'strength') { F.ses.st.strength = 1.25; T.did('strength'); }
    else if (act === 'slower') { F.ses.st.pace = 0.75; T.did('slower'); }
    else if (act === 'soothe') { F.ses.st.running = false; F.ses.st.soothe = true; T.did('soothe'); }
    else if (act === 'end') { if (T.canEnd) { T.did('end'); break; } }
    else if (!F.ses.st.soothe && !F.ses.covering) { if (!T.taught('run')) ranUntaught = true; else if (!F.ses.st.running && T.phase.id !== 'covering') F.ses.st.running = true; }      // (keeps a run going: only once it's been taught; and after her hand, only as asked)
    if (choose) choose(F, T, t);
  }
  return { F, T, phases, taught, said, t, endedEarly, ranUntaught, restarts, couldEnd };
}

test('played as the prompts ask: every phase in the GDD’s order, each control taught; receptive, it ends when the player ends it', () => {
  const r = play();
  assert.deepEqual(r.phases, ['ready', 'defiance', 'covering', 'pride', 'breaking', 'receptive']);
  for (const a of ['tell', 'top', 'run', 'pace', 'strength', 'under', 'slower', 'soothe', 'end']) assert.ok(r.taught.has(a), 'taught: ' + a);
  for (const a of ['run', 'pace', 'strength', 'top', 'under', 'soothe', 'end']) assert.ok(r.T.taught(a), 'open by the end: ' + a);
  assert.ok(r.F.ses.pinned, 'her hand taken, the second time');
  assert.deepEqual(r.said, SC.accept, 'what she did, and why, all of it');
  assert.equal(r.endedEarly, false); assert.ok(r.t < 600, 'it ends: ' + r.t.toFixed(1));
});

test('her hand: either way, either time; taken the first time, it’s held from then on and the covering’s done; the run begun again each time', () => {
  const first = play(null, ['take']); assert.ok(first.F.ses.pinned); assert.deepEqual(first.phases, ['ready', 'defiance', 'covering', 'pride', 'breaking', 'receptive']);
  assert.equal(first.restarts, 1, 'once: the run begun again after it');
  const told = play(null, ['tell', 'tell']); assert.ok(!told.F.ses.pinned, 'moved twice: never held'); assert.ok(told.phases.includes('pride'));
  assert.equal(told.restarts, 2, 'twice: begun again each time');
  const C = SC.phases.find(p => p.id === 'covering'), q = C.prompts.find(x => x.when === 'covering');
  assert.deepEqual(q.acts, ['tell', 'take']); assert.ok(!q.control, 'no control: a choice in the dialogue');
  assert.deepEqual(SC.hand.options.map(o => o.id), ['tell', 'take']); assert.match(SC.hand.options[0].label, /out of the way/i);
  assert.ok(C.prompts.some(x => x.when === 'stopped' && x.act === 'run'), 'then: start the run again');
});

test('every control closed till the tutorial’s taught it, End too; none of them before the first prompt', () => {
  const T = Tutorial.director(SC), F = fake(); T.attach(F.ses, {});
  for (const a of ['run', 'pace', 'strength', 'top', 'under', 'soothe', 'end']) assert.equal(T.taught(a), false, 'closed at first: ' + a);
  T.update(0.1); assert.ok(T.taught('top') && !T.taught('run'), 'the shift first');
  const r = play(); assert.equal(r.ranUntaught, false, 'never a run before it was taught'); assert.ok(r.T.taught('end'));
  // (End: only once the tutorial says so, after she's said what she did)
  let endBefore = false; play((F, T) => { if (T.phase.id === 'receptive' && T.S.told < SC.accept.length && T.taught('end')) endBefore = true; });
  assert.equal(endBefore, false);
});

test('she never comes up out of position: no phase allows it, and nothing in the script asks the player to put her back', () => {
  for (const p of SC.phases) { assert.ok(!(p.allow || []).includes('up') && !(p.hold || []).includes('up') && !p.forceUp, p.id); for (const q of p.prompts || []) assert.ok(q.when !== 'up' && !/keep her position|put her back/i.test(q.text), p.id + ': ' + q.key); }
  const T = Tutorial.director(SC); assert.ok(!T.director.allow('up') && !T.director.allow('cover'), 'before: nothing of her own accord');
});

test('receptive, it runs on: it doesn’t end of itself; End is the player’s, once she’s said what she did and the tutorial says so', () => {
  let ran = 0;
  const r = play((F, T) => { if (T.phase.id === 'receptive') ran += 0.1; }, null);
  assert.ok(r.couldEnd); assert.ok(ran > (SC.accept.length - 1) * 5, 'ran on while she spoke: ' + ran.toFixed(1));
  const T = Tutorial.director(SC), F = fake(); T.attach(F.ses, {}); assert.equal(T.canEnd, false, 'not before');
});

test('her defiance is held up till the breaking, and then it goes', () => {
  let lowBefore = 1, breakAt = null;
  play((F, T) => { if (T.phase.i < 4) lowBefore = Math.min(lowBefore, F.P.def); if (T.phase.id === 'breaking' && breakAt == null && F.P.said.yield) breakAt = F.P.def; });
  assert.ok(lowBefore >= 0.49, 'held up: ' + lowBefore); assert.ok(breakAt != null && breakAt < 0.2, 'broken: ' + breakAt);
});

test('only what each phase allows of her own accord; and what waits for the player', () => {
  const phase = id => SC.phases.find(p => p.id === id);
  assert.ok(phase('covering').allow.includes('cover') && phase('covering').hold.includes('cover'));
  assert.ok(!phase('pride').allow.includes('cover'), 'pride: she holds still and holds it in');
  assert.ok(phase('breaking').floor === 0 && phase('pride').floor > 0.4);
});

test('the first prompt carries her word; and her word stops it', () => {
  const T = Tutorial.director(SC), F = fake(); T.attach(F.ses, {});
  assert.match(T.prompt.word, /Falada/);
  T.word(); assert.equal(T.prompt, null);
});

test('how he answered her plea sets how defiant she comes to it', () => {
  assert.ok(SC.tone.dry > SC.tone.firm && SC.tone.firm > SC.tone.gentle);
});
