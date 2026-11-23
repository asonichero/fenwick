// Fenwick Hall — the prologue's correction, as a tutorial: a phase controller over the live correction (js/session.js), after the GDD ("The
// correction: the tutorial"). The script is data (js/prologue.js: SCENES.correction): five phases after a first one to begin, each with
// what she may do of her own accord (cover herself, look back), what waits for the player (her hand: the run stops, and it's the player's
// choice, moved out of the way or taken and held; then they start the run again), how low her defiance may go yet, how submissive she is,
// when it gives way to the next; and the prompts, each shown while it matters, teaching a control. Every control is closed to the player
// till a prompt has taught it (`taught(act)`), End too. The correction itself goes on as it always does: her reactions, her lines, her kicks
// and her distress are the simulation's.
//   A phase can open with a few lines said (intro: [{ at, who, text, if, unless }]: at seconds into it; who 'cicely' or 'silas'; said only if
//   she's pinned (if: 'pinned'), or only if not (unless)), its prompts held back till they're said, and a moment more; or, after a line
//   that leads into them (lead), not even that: the page's told at once, so his thought can follow straight on (a prompt's `first`: before
//   anything else she says).
//   It can't be failed. Once she's broken and said what she did, she's receptive, and it runs on as the player has it: ended whenever they
//   judge it's enough (End waits for that), or taken on to too harsh, and her word, which ends it whenever she says it.
//
//   const T = Tutorial.create(ses, script, { say(text), tone })  ·  pass it as Session.create's opts.director (T.director) before the
//   session's made: Tutorial.director(script) → { director, attach(ses, ui) }  ·  T.update(dt) each frame  ·  T.prompt → { text, control } | null
//   ·  T.phase → { i, id, name }  ·  T.canEnd  ·  T.locked (every control held: while she tells it truly)  ·  T.taught(act) (the control open to the player yet: 'run', 'pace', 'strength', 'top', 'under',
//   'soothe', 'end')  ·  T.did(action) (the page tells it what the player did: those, and 'slower'; and with her hand, 'tell' (moved out of the
//   way) or 'take' (taken))
(function (root) {
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function director(script) {
  const S = { i: 0, ses: null, ui: null, t: 0, hits0: 0, did: {}, pdone: {}, shown: {}, wordSeen: false, done: false, broken: false, soothedT: 0, told: 0, tellT: 0, covers: 0, coversDone: 0, pinnedAt: null, word: false,
    taught: new Set(), stopped: false, since: {} };
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
    broken: () => S.broken, yielded: () => !!(P() && P().said.yield === 2),      // (broken, and her first line of it said)
    slowed: () => !!S.did.slower, telling: () => S.told > 0 && S.told < script.accept.length, told: () => S.told >= script.accept.length,
    judged: () => S.believed != null && S.t - S.believed >= 3.5,      // (he's said he believes her, and a moment since)
  };
  // ── On to the next phase, when this one's done ──
  function advance() {
    S.i = Math.min(script.phases.length - 1, S.i + 1); S.t = 0; S.hits0 = hits(); S.introN = 0;
    const p = ph(), Pc = P();
    if (Pc && p.submission != null) Pc.rel.submission = p.submission;
    if (S.ui.phase) S.ui.phase(S.i, p);
  }
  function out() {
    const p = ph(), o = p.out || {}, n = inPhase();
    switch (p.id) {
      case 'ready': return hits() >= 1;
      case 'defiance': return ((n >= o.hits && D() >= o.distress) || n >= o.most) && (p.prompts || []).every(q => !q.act || S.taught.has(q.act));      // (and everything it teaches, introduced)
      // (her hand twice, or once and held from then on; and a few smacks after)
      case 'covering': return !S.ses.covering && (S.coversDone >= (o.covers || 2) || S.ses.pinned) && S.coverDoneAt != null && n - S.coverDoneAt >= o.after;
      case 'pride': return P() && P().f.state.under === 'down' && ((D() >= o.distress && n >= o.hits) || n >= o.most);
      case 'breaking': return S.broken && !!S.did.soothe && S.ses.st.soothe;      // (soothing her: on, to her telling it)
      default: return false;
    }
  }
  function update(dt) {
    if (!S.ses || S.done || S.word) return;
    const ses = S.ses, p = ph(), Pc = P(); if (!Pc || ses.st.phase !== 'turn') return;
    S.t += dt;
    // (a phase's opening lines, each at its moment)
    const intro = p.intro || []; S.introN = S.introN || 0;
    while (S.introN < intro.length && S.t >= intro[S.introN].at) { const L = intro[S.introN++], pin = !!(ses.pinned);
      if ((L.if === 'pinned' && !pin) || (L.unless === 'pinned' && pin)) continue; if (S.ui.say) S.ui.say(L.text, L.who || 'cicely');
      if (L.lead && S.ui.phase) S.ui.phase(); }      // (and what it leads into, thought of now, queued straight after it)
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
    // (receptive: what she did, and why, a line at a time, a few seconds apart, everything held meanwhile; then his word, that he believes her
    // but it's not learned yet; and then it's the player's to run on, or end)
    if (p.id === 'receptive') {
      if (S.told < script.accept.length) { S.tellT -= dt; if (S.tellT <= 0) { if (S.ui.say) S.ui.say(script.accept[S.told]); S.told++; S.tellT = 5.5; } }
      else if (S.believed == null) { S.tellT -= dt; if (S.tellT <= -1.5) { S.believed = S.t; if (script.believe && S.ui.say) S.ui.say(script.believe, 'silas'); } }
    }
    // (while a prompt's waiting on the player, what she says over and over till they do it (its cycle), a few seconds apart)
    { const q = prompt(), ck = q && q.cycle ? keyOf(q) : null;
      if (ck !== (S.cyc && S.cyc.k)) S.cyc = ck ? { k: ck, t: q.firstAfter || 5, i: 0 } : null;
      else if (S.cyc) { S.cyc.t -= dt; if (S.cyc.t <= 0) { if (S.ui.say) S.ui.say(q.cycle[S.cyc.i++ % q.cycle.length], 'cicely'); S.cyc.t = q.every || 5; } } }
    // (a prompt for something the player needn't do (optional: pace, strength): after a few smacks left alone, it gives way to the next)
    { const q = prompt(); if (q && q.optional) { const k = keyOf(q); if (S.since[k] == null) S.since[k] = hits(); if (hits() - S.since[k] >= (q.grace || 8)) S.pdone[k] = true; } }
    // (a prompt that teaches nothing to do, only something to see: a few seconds, then on)
    const pr = prompt(); if (pr && !pr.act && !pr.acts && !pr.when) { const k = keyOf(pr); S.shown[k] = (S.shown[k] || 0) + dt; if (S.shown[k] > 8) S.pdone[k] = true; }
    if (out()) advance();
  }
  // (the prompt now: the first of this phase's that applies: its moment (`when`) holding, far enough in (`after`), its control not yet used
  // (one for a moment that comes again, `again`, shows every time it does); one with neither control nor moment shows a few seconds)
  const keyOf = q => S.i + ':' + q.key;
  const applies = q => !(q.when && !is[q.when]()) && !(q.after != null && inPhase() < q.after) && !S.pdone[keyOf(q)];
  const introDone = () => { const p = ph(), I = p.intro || [], L = I[I.length - 1]; return !I.length || S.t >= L.at + (L.lead ? 0 : p.introHold || 2.5); };
  function prompt() {
    if (!S.ses || S.done || S.word || !P()) return null;
    if (!introDone()) return null;      // (what's said first, said)
    const p = ph(), q = (p.prompts || []).find(applies); if (!q) return null;
    for (const a of [q.act].concat(q.acts || [])) if (a) S.taught.add(a === 'slower' ? 'pace' : a);      // (shown: what it teaches is the player's from now on)
    return Object.assign({ phase: p.name, word: !S.wordSeen ? script.word : null }, q);
  }
  return {
    director, attach, update,
    get prompt() { return prompt(); }, get phase() { return { i: S.i, id: ph().id, name: ph().name }; },
    get canEnd() { return ph().id === 'receptive' && S.taught.has('end') && !this.locked; },
    // (everything held: while she tells it truly, and till he's thought what's his to judge)
    get locked() { return !S.done && !S.word && ph().id === 'receptive' && !is.judged(); },
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
