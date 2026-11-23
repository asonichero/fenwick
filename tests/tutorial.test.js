// The prologue's correction as a tutorial (js/tutorial.js over SCENES.correction): played through against a stand-in for the correction
// engine by a player who does what each prompt asks, it goes through its phases in the GDD's order, teaching each control as it first
// matters; her coming up and covering wait for the player; her defiance is held up till the breaking; it can't be ended before she's
// accepted it; and her word stops it.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
require('../js/prologue.js'); require('../js/tutorial.js');
const { Prologue, Tutorial } = window, SC = Prologue.SCENES.correction;

// (the stand-in: smacks while running, distress climbing with them and easing off; she comes up or covers when the director's forced it;
// put back or moved by the player's controls; her defiance drained toward nothing by distress, never below the director's floor)
function fake() {
  const P = { hits: 0, f: { state: { top: 'down', under: 'up' } }, rel: { submission: 0.1 }, said: {}, def: 0.85, def0: 0.85 };
  let D = 0, up = true, cover = false, pinned = false, covers = 0;
  const ses = { current: P, st: { phase: 'turn', soothe: false, running: false, pace: 1, strength: 1 }, distress: () => D,
    get up() { return up; }, get covering() { return cover; }, get pinned() { return pinned; },
    pushUp() { up = true; }, cover() { cover = true; covers++; }, putBack() { up = false; }, handDown() { cover = false; if (covers >= 2) pinned = true; } };
  const tick = (dir, dt) => {
    if (ses.st.running && !up && !cover) { P.hits += dt * 2 * ses.st.pace; D = Math.min(1.4, D + dt * 0.04 * ses.st.strength); }
    else D = Math.max(0, D - dt * 0.01);
    P.hits = Math.round(P.hits * 1000) / 1000;
    const floor = dir.floor(P), tgt = Math.max(floor, 0.85 * (1 - Math.min(1, D)));
    if (tgt < P.def) { const was = P.def; P.def = tgt; if (was >= 0.2 && P.def < 0.2) P.said.yield = 1; }
  };
  return { P, ses, tick };
}

function play(choose) {
  const F = fake(), said = [], T = Tutorial.director(SC); T.attach(F.ses, { say: t => said.push(t) });
  const phases = [], taught = new Set(); let t = 0, endedEarly = false;
  for (; t < 600; t += 0.1) {
    F.tick(T.director, 0.1); T.update(0.1);
    if (!phases.includes(T.phase.id)) phases.push(T.phase.id);
    const pr = T.prompt; if (pr && pr.act) taught.add(pr.act);
    // (the player: does what the prompt asks; otherwise keeps a run going)
    const act = pr && pr.act;
    if (!T.canEnd && F.ses.st.running && t > 30 && t < 30.2) endedEarly = T.canEnd;      // (trying to end it early: it can't)
    if (act === 'putBack') { F.ses.putBack(); T.did('putBack'); }
    else if (act === 'top') { F.P.f.state.top = 'up'; T.did('top'); }
    else if (act === 'under') { F.P.f.state.under = 'down'; T.did('under'); }
    else if (act === 'run') { F.ses.st.running = true; T.did('run'); }
    else if (act === 'pace') { F.ses.st.pace = 1.25; T.did('pace'); }
    else if (act === 'strength') { F.ses.st.strength = 1.25; T.did('strength'); }
    else if (act === 'hand') { F.ses.handDown(); T.did('hand'); }
    else if (act === 'slower') { F.ses.st.pace = 0.75; T.did('slower'); }
    else if (act === 'soothe') { F.ses.st.running = false; F.ses.st.soothe = true; T.did('soothe'); }
    else if (act === 'end') { T.did('end'); break; }
    else if (!F.ses.st.soothe) F.ses.st.running = true;
    if (choose) choose(F, T, t);
  }
  return { F, T, phases, taught, said, t, endedEarly };
}

test('played as the prompts ask: every phase in the GDD’s order, each control taught, and it ends on her acceptance', () => {
  const r = play();
  assert.deepEqual(r.phases, ['ready', 'defiance', 'covering', 'pride', 'breaking', 'acceptance']);
  for (const a of ['putBack', 'top', 'run', 'pace', 'strength', 'hand', 'under', 'slower', 'soothe', 'end']) assert.ok(r.taught.has(a), 'taught: ' + a);
  assert.ok(r.F.ses.pinned, 'the second time, her wrist held');
  assert.deepEqual(r.said, SC.accept, 'what she did, and why, all of it');
  assert.equal(r.endedEarly, false); assert.ok(r.t < 600, 'it ends: ' + r.t.toFixed(1));
});

test('her defiance is held up till the breaking, and then it goes', () => {
  let lowBefore = 1, breakAt = null;
  play((F, T) => { if (T.phase.i < 4) lowBefore = Math.min(lowBefore, F.P.def); if (T.phase.id === 'breaking' && breakAt == null && F.P.said.yield) breakAt = F.P.def; });
  assert.ok(lowBefore >= 0.49, 'held up: ' + lowBefore); assert.ok(breakAt != null && breakAt < 0.2, 'broken: ' + breakAt);
});

test('only what each phase allows of her own accord; and what waits for the player', () => {
  const T = Tutorial.director(SC), F = fake(); T.attach(F.ses, {});
  assert.ok(T.director.allow('up') && T.director.hold('up') && !T.director.allow('cover'), 'before: only coming up, and it waits');
  const phase = id => SC.phases.find(p => p.id === id);
  assert.ok(phase('covering').allow.includes('cover') && phase('covering').hold.includes('cover'));
  assert.ok(!phase('pride').allow.includes('up') && !phase('pride').allow.includes('cover'), 'pride: she holds still and holds it in');
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
