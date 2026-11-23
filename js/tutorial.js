// Fenwick Hall — the prologue's correction, as a tutorial: a phase controller over the live correction (js/session.js), after the GDD ("The
// correction: the tutorial"). The script is data (js/prologue.js: SCENES.correction): five phases after a first one to begin, each with
// what she may do of her own accord (cover herself, look back), what waits for the player (her hand: the run stops, and it's the player's
// choice, moved out of the way or taken and held; then they start the run again), how low her defiance may go yet, how submissive she is,
// when it gives way to the next; and the prompts, each shown while it matters, teaching a control. Every control is closed to the player
// till a prompt has taught it (`taught(act)`), End too. The correction itself goes on as it always does: her reactions, her lines, her kicks
// and her distress are the simulation's.
//   It can't be failed. Once she's broken and said what she did, she's receptive, and it runs on as the player has it: ended whenever they
//   judge it's enough (End waits for that), or taken on to too harsh, and her word, which ends it whenever she says it.
//
//   const T = Tutorial.create(ses, script, { say(text), tone })  ·  pass it as Session.create's opts.director (T.director) before the
//   session's made: Tutorial.director(script) → { director, attach(ses, ui) }  ·  T.update(dt) each frame  ·  T.prompt → { text, control } | null
//   ·  T.phase → { i, id, name }  ·  T.canEnd  ·  T.taught(act) (the control open to the player yet: 'run', 'pace', 'strength', 'top', 'under',
//   'soothe', 'end')  ·  T.did(action) (the page tells it what the player did: those, and 'slower'; and with her hand, 'tell' (moved out of the
//   way) or 'take' (taken))
(function (root) {
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function director(script) {
  const S = { i: 0, ses: null, ui: null, t: 0, hits0: 0, did: {}, pdone: {}, shown: {}, wordSeen: false, done: false, broken: false, soothedT: 0, told: 0, tellT: 0, covers: 0, coversDone: 0, pinnedAt: null, word: false,
    taught: new Set(), stopped: false };
  const ph = () => script.phases[S.i] || script.phases[script.phases.length - 1];
  const P = () => S.ses && S.ses.current;
  // ── What the correction asks of the director ──
  const director = {
    allow: (kind) => { const p = ph(); return !!(p.allow && p.allow.includes(kind)); },
    hold: (kind) => { const p = ph(); return !!(p.hold && p.hold.includes(kind)); },
    floor: () => ph().floor || 0,
  };
  function attach(ses, ui) { S.ses = ses; S.ui = ui || {}; }
  const hits = () => (P() ? P().hits : 0), inPhase = () => hits() - S.hits0, D = () => (S.ses ? S.ses.distress() : 0);
  // (the state a prompt's `when` asks after)
  const is = {
    shiftDown: () => P() && P().f.state.top !== 'up', drawersUp: () => P() && P().f.state.under === 'up',
    covering: () => S.ses.covering, stopped: () => S.stopped && !S.ses.covering && !S.ses.st.running,      // (her hand dealt with, the run not begun again)
    broken: () => S.broken, telling: () => S.told > 0 && S.told < script.accept.length, told: () => S.told >= script.accept.length,
  };
  // ── On to the next phase, when this one's done ──
  function advance() {
    S.i = Math.min(script.phases.length - 1, S.i + 1); S.t = 0; S.hits0 = hits();
    const p = ph(), Pc = P();
    if (Pc && p.submission != null) Pc.rel.submission = p.submission;
    if (S.ui.phase) S.ui.phase(S.i, p);
  }
  function out() {
    const p = ph(), o = p.out || {}, n = inPhase();
    switch (p.id) {
      case 'ready': return hits() >= 1;
      case 'defiance': return (n >= o.hits && D() >= o.distress) || n >= o.most;
      // (her hand twice, or once and held from then on; and a few smacks after)
      case 'covering': return !S.ses.covering && (S.coversDone >= (o.covers || 2) || S.ses.pinned) && S.coverDoneAt != null && n - S.coverDoneAt >= o.after;
      case 'pride': return P() && P().f.state.under === 'down' && ((D() >= o.distress && n >= o.hits) || n >= o.most);
      case 'breaking': return S.broken && S.soothedT >= 3;
      default: return false;
    }
  }
  function update(dt) {
    if (!S.ses || S.done || S.word) return;
    const ses = S.ses, p = ph(), Pc = P(); if (!Pc || ses.st.phase !== 'turn') return;
    S.t += dt;
    // (in the covering, her hand comes back, twice)
    if (p.forceCover && !ses.covering && !ses.pinned && S.covers < p.forceCover.length) {
      const at = S.covers === 0 ? p.forceCover[0] : S.coverDoneAt != null ? S.coverDoneAt + p.forceCover[1] - p.forceCover[0] : Infinity;
      if (inPhase() >= at) ses.cover();
    }
    if (ses.covering && !S._covering) { S._covering = true; S.covers++; S.stopped = false; }
    if (!ses.covering && S._covering) { S._covering = false; S.coversDone++; S.coverDoneAt = inPhase(); if (ses.pinned && S.pinnedAt == null) S.pinnedAt = hits(); }
    // (the break: her defiance let go, it goes out of her all at once, and the engine has her say so)
    if (!S.broken && Pc.said.yield) { S.broken = true; }
    if (p.id === 'breaking' && !S.broken && inPhase() >= (p.within || 6) && S.ses.breakNow) { S.ses.breakNow(); S.broken = true; }      // (and if it hasn't come of itself, a few smacks in: it does)
    if (S.broken && ses.st.soothe) S.soothedT += dt;
    // (receptive: what she did, and why, a line at a time, a few seconds apart; then it's the player's to run on, or end)
    if (p.id === 'receptive' && S.told < script.accept.length) { S.tellT -= dt; if (S.tellT <= 0) { if (S.ui.say) S.ui.say(script.accept[S.told]); S.told++; S.tellT = 5.5; } }
    // (a prompt that teaches nothing to do, only something to see: a few seconds, then on)
    const pr = prompt(); if (pr && !pr.act && !pr.acts && !pr.when) { const k = keyOf(pr); S.shown[k] = (S.shown[k] || 0) + dt; if (S.shown[k] > 8) S.pdone[k] = true; }
    if (out()) advance();
  }
  // (the prompt now: the first of this phase's that applies: its moment (`when`) holding, far enough in (`after`), its control not yet used
  // (one for a moment that comes again, `again`, shows every time it does); one with neither control nor moment shows a few seconds)
  const keyOf = q => S.i + ':' + q.key;
  const applies = q => !(q.when && !is[q.when]()) && !(q.after != null && inPhase() < q.after) && !S.pdone[keyOf(q)];
  function prompt() {
    if (!S.ses || S.done || S.word || !P()) return null;
    const p = ph(), q = (p.prompts || []).find(applies); if (!q) return null;
    for (const a of [q.act].concat(q.acts || [])) if (a) S.taught.add(a === 'slower' ? 'pace' : a);      // (shown: what it teaches is the player's from now on)
    return Object.assign({ phase: p.name, word: !S.wordSeen ? script.word : null }, q);
  }
  return {
    director, attach, update,
    get prompt() { return prompt(); }, get phase() { return { i: S.i, id: ph().id, name: ph().name }; },
    get canEnd() { return ph().id === 'receptive' && S.taught.has('end'); },
    taught: a => S.taught.has(a === 'slower' ? 'pace' : a),
    did(a) {
      S.did[a] = (S.did[a] || 0) + 1; S.wordSeen = true;
      if (a === 'tell' || a === 'take') S.stopped = true; if (a === 'run') S.stopped = false;      // (her hand dealt with: the run's the player's to begin again)
      for (const q of ph().prompts || []) if ((q.act === a || (q.acts && q.acts.includes(a))) && !q.again && applies(q)) S.pdone[keyOf(q)] = true;
    },
    word() { S.word = true; }, finish() { S.done = true; }, S,
  };
}

root.Tutorial = { director };
})(typeof window !== 'undefined' ? window : globalThis);
