// Fenwick Hall — the estate as a game state: the chapters and the zones they open, the Hall's restoration, who lives where, the ambient
// vignettes, the week's rhythm, each heroine's relationship track, and the post-game habit drift (docs/gdd.md). Pure data and functions, no
// rendering, so it runs under node (tests/estate.test.js) and in the page alike.
//
// What the GDD states is the structure: the eight chapters (zone, featured heroine, conflict and climax), the physical gates (doors unlocked,
// fallen timber cleared, rooms restored), the evolving manor, the homes and pairings the vignettes give, the week of village days, Hall days
// and boundary walks, the rule that nothing in one relationship lowers another, the drift of hidden Compliance and Mindfulness with its clues,
// the finale's roles and the village's verdict. Marked `draft` (docs/alpha-plan.md): which gate each zone has, the numbers (rates, thresholds,
// amounts), and the order of the week.
//
//   const s = Estate.create() · Estate.unlock(s, 'study') · Estate.restore(s, 'guest', 0.5) · Estate.arrive(s, 'goldie')
//   Estate.affect(s, 'red', { trust: +0.1 }) · Estate.drift(s, 1, rnd) → clues · Estate.intervene(s, 'goldie', 'correction')
(function (root) {
'use strict';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ── The zones: where each chapter opens up, and what bars it (GDD: "unlocking doors, clearing fallen timber and restoring rooms opens new wings
// and triggers new arrivals"). gate.kind: unlock | clear | restore | none. Stated: the briars on the eastern perimeter (Ch. 6), the locked West
// Wing (Ch. 3 to the finale). Which of the three the others are is drafted. rooms: what can be restored there (hearth: it has one to light). ──
const ZONES = {
  hall: { name: 'Main Hall and guest bedrooms', chapter: 1, area: 'hall', gate: { kind: 'none', label: 'Where Silas arrives' },
    rooms: [{ id: 'entrance', name: 'Entrance hall' }, { id: 'greathall', name: 'Great hall', hearth: true }, { id: 'guest', name: 'Guest bedroom', hearth: true }, { id: 'stair', name: 'Main stair' }] },
  gate: { name: 'Front gate and forest trail', chapter: 2, area: 'grounds', gate: { kind: 'clear', label: 'Fallen timber across the drive', draft: true },
    rooms: [{ id: 'frontgate', name: 'Front gate' }, { id: 'trail', name: 'Forest trail' }] },
  study: { name: 'Study and West Wing landing', chapter: 3, area: 'hall', gate: { kind: 'unlock', label: 'The study door, and the great-uncle’s ledgers', draft: true },
    rooms: [{ id: 'study', name: 'Study', hearth: true }, { id: 'landing', name: 'West Wing landing' }, { id: 'upper', name: 'The upper rooms', hearth: true }] },
  servants: { name: 'Servants’ wing and laundry yard', chapter: 4, area: 'hall', gate: { kind: 'restore', label: 'The soot-choked kitchens and laundry', draft: true },
    rooms: [{ id: 'quarters', name: 'Servants’ quarters', hearth: true }, { id: 'kitchens', name: 'Kitchens', hearth: true }, { id: 'laundry', name: 'Laundry yard' }] },
  cellar: { name: 'Smokehouse and root cellar', chapter: 5, area: 'grounds', gate: { kind: 'unlock', label: 'The cellar door, its lock pried', draft: true },
    rooms: [{ id: 'smokehouse', name: 'Smokehouse' }, { id: 'rootcellar', name: 'Root cellar' }, { id: 'larder', name: 'Larder' }, { id: 'stables', name: 'Stables' }] },
  briar: { name: 'Eastern briar wall and gatehouse', chapter: 6, area: 'grounds', gate: { kind: 'clear', label: 'The briar-choked eastern perimeter' },
    rooms: [{ id: 'briarwall', name: 'Briar wall' }, { id: 'gatehouse', name: 'Gatehouse tower' }, { id: 'garden', name: 'Walled garden' }] },
  timber: { name: 'Far creek and timberline camp', chapter: 7, area: 'wood', gate: { kind: 'clear', label: 'The overgrown timber road', draft: true },
    rooms: [{ id: 'creek', name: 'Far creek' }, { id: 'camp', name: 'Timberline camp' }] },
  westwing: { name: 'The restored West Wing', chapter: 8, area: 'hall', gate: { kind: 'unlock', label: 'The West Wing door, locked since the great-uncle’s death' },
    rooms: [{ id: 'westwing', name: 'West Wing', hearth: true }] },
  village: { name: 'Redmere', chapter: 2, area: 'village', public: true, gate: { kind: 'none', label: 'Reached once the trail is clear' },
    rooms: [{ id: 'bakery', name: 'The bakery' }, { id: 'green', name: 'The green' }, { id: 'market', name: 'Market' }] },
};
const ROOMS = {}; for (const z in ZONES) for (const r of ZONES[z].rooms) ROOMS[r.id] = Object.assign({ zone: z }, r);

// ── The chapters (GDD: "Chapter progression and ensemble dynamics"). clues: what the player reads before a confrontation (the GDD's pillar
// names muddy footprints, broken furniture, wolf tracks, pried locks, hidden food caches; each chapter's discovery supplies its own).
// journey: the on-rails walk, where the GDD names one. beats: the chapter's steps, in order, drafted from its conflict and climax. ──
const CHAPTERS = [
  { n: 1, id: 'dusty', title: 'The Dusty Hall', zone: 'hall', featured: ['goldie'], with: [],
    conflict: 'Discovering the trespasser; establishing house rules and putting her to work restoring order.',
    clues: ['half-eaten rations', 'spilled ink', 'a broken antique chair', 'a guest bed slept in'],
    beats: ['explore', 'clues', 'discover', 'terms', 'correction', 'aftercare', 'offer', 'restore'],
    lore: 'Goldie’s wandering is why she finds the Hall. Her parents and the village watch her change in instalments.' },
  { n: 2, id: 'path', title: 'The Forest Path', zone: 'gate', featured: ['red'], with: [],
    conflict: 'Rescuing her from the wolf; twilight escort to the village and the start of her woods lessons.',
    clues: ['wolf tracks', 'a dropped basket', 'a trampled path-side'],
    journey: { id: 'escort', label: 'Twilight escort to Redmere' },
    beats: ['clear', 'patrol', 'clues', 'rescue', 'journey', 'promise', 'terms', 'lesson'],
    lore: 'Red’s mother is relieved when Silas brings her home and promises to keep an eye on her; the village starts to read him as a protector.' },
  { n: 3, id: 'ledger', title: 'The Ledger and the Wing', zone: 'study', featured: ['belle'], with: [],
    conflict: 'Settling her father’s debt; establishing her as ward and bookkeeper and catching her at the West Wing door.',
    clues: ['the great-uncle’s ledgers', 'a lamp moved to the West Wing landing', 'scratches round the keyhole'],
    beats: ['unlock', 'audit', 'summons', 'offer', 'terms', 'clues', 'catch', 'correction', 'aftercare'],
    lore: 'Belle’s father is the debt made flesh. The West Wing carries the great-uncle’s last years in the Hall.' },
  { n: 4, id: 'sooty', title: 'The Sooty Kitchens', zone: 'servants', featured: ['cinderella'], with: ['goldie'],
    conflict: 'Uncovering her exhaustion and night outings; confronting her stepmother at the village border.',
    clues: ['a cold hearth with someone asleep by it', 'muddy footprints by the laundry door at dawn', 'wages paid and none spent'],
    journey: { id: 'border', label: 'Confronting the stepmother at the village border' },
    beats: ['restore', 'hire', 'clues', 'discover', 'journey', 'move-in', 'terms', 'correction', 'aftercare'] },
  { n: 5, id: 'cellar', title: 'The Root Cellar', zone: 'cellar', featured: ['gretel'], with: ['hansel'],
    conflict: 'Following snare trails into the brush; bringing the siblings onto the estate and teaching trust.',
    clues: ['a pried lock on the root cellar', 'snares in the brush', 'a hidden food cache'],
    beats: ['clues', 'track', 'disarm', 'discover', 'shelter', 'terms', 'correction', 'aftercare', 'cache'] },
  { n: 6, id: 'folly', title: 'The Perimeter Folly', zone: 'briar', featured: ['rapunzel'], with: [],
    conflict: 'Evicting Gothel from the gatehouse; guiding Rapunzel into the walled garden for the first time.',
    clues: ['a tenancy far longer than its rent', 'a window barred from outside', 'two cups at a table for one'],
    beats: ['clear', 'inspect', 'clues', 'discover', 'evict', 'journey', 'terms', 'lesson'],
    journey: { id: 'garden', label: 'Into the walled garden for the first time', draft: true } },
  { n: 7, id: 'timber', title: 'The Deep Timberline', zone: 'timber', featured: ['snow'], with: ['belle'],
    conflict: 'Accepting guardianship from the woodcutters; enforcing gate security as external threats converge.',
    clues: ['a gate left unlatched', 'a pedlar’s ribbon on the path', 'strangers’ boot prints at the gate'],
    beats: ['clear', 'camp', 'guardianship', 'terms', 'clues', 'correction', 'aftercare', 'drill'] },
  { n: 8, id: 'finale', title: 'The Convergence at the West Wing', zone: 'westwing', featured: ['goldie', 'red', 'belle', 'cinderella', 'gretel', 'rapunzel', 'snow'], with: [],
    conflict: 'Unlocking the West Wing to resolve the previous owner’s mystery while defending the estate from Snow White’s stepmother and the wolf pack.',
    clues: [], beats: ['warning', 'roles', 'defence', 'unlock', 'truth', 'title'] },
];
// (the one the GDD names but doesn't place: "touring hazardous ruins". Ch. 3's West Wing landing or Ch. 6's gatehouse are the candidates.)
const UNPLACED_JOURNEYS = ['Touring hazardous ruins'];

// ── Who lives where once she's taken in (the vignettes: roommates in the servants' quarters, companions in the upper rooms). ──
const HOMES = { servants: 'quarters', upper: 'upper', kitchens: 'kitchens', garden: 'garden', village: 'bakery', stables: 'stables' };
// The ambient vignettes between chapters (GDD), each once both are in residence.
const VIGNETTES = [
  { id: 'roommates', pair: ['goldie', 'cinderella'], room: 'quarters', text: 'Cinderella covers for Goldilocks’s messes until Silas holds Goldilocks accountable.' },
  { id: 'companions', pair: ['belle', 'snow'], room: 'upper', text: 'Sharp-tongued, sceptical Belle grounds gentle, overly trusting Snow White.' },
  { id: 'outdoors', pair: ['red', 'rapunzel'], room: 'garden', text: 'Red helps teach Rapunzel to navigate the village and paths safely.' },
  { id: 'pantry', pair: ['gretel', 'goldie'], room: 'kitchens', text: 'Scrappy, practical Gretel keeps daydreaming Goldilocks honest in the kitchens and pantry.' },
];

// ── The week (GDD lore: "village days, Hall days and boundary walks. Each place serves different heroines"). The order, and who each kind
// of day serves, are drafted. ──
const WEEK = ['hall', 'hall', 'village', 'boundary', 'hall', 'village', 'boundary'];
const DAY_SERVES = { hall: ['goldie', 'belle', 'cinderella', 'gretel', 'snow'], village: ['red', 'goldie', 'cinderella', 'belle'], boundary: ['red', 'rapunzel', 'gretel', 'snow'] };

// ── Post-game (GDD, "The Steward's Year"): each heroine's lapses, and the clue each leaves when her habits drift. ──
const LAPSES = {
  goldie: [{ lapse: 'Sneaking into the West Wing attics', clue: 'an attic door unlatched' }, { lapse: 'Rearranging the parlour furniture at midnight', clue: 'late-night candle glow in the parlour' }, { lapse: 'Taking unauthorised horse rides deep into the woods', clue: 'a horse missing from the stables' }],
  red: [{ lapse: 'Tracking wolves alone', clue: 'her basket left at the wood’s edge' }, { lapse: 'Ignoring curfew in the deep timber', clue: 'no lamp at the bakery after dark' }],
  belle: [{ lapse: 'Covertly altering ledger rules to prove a point', clue: 'a misplaced ledger' }, { lapse: 'Reading forbidden West Wing texts until dawn', clue: 'late-night candle glow in the West Wing' }, { lapse: 'Debating him in front of the staff', clue: 'the staff talking in the kitchens' }],
  cinderella: [{ lapse: 'Overworking herself during harvests', clue: 'the laundry lamp lit before dawn' }],
  gretel: [{ lapse: 'Hoarding treats', clue: 'a loose floorboard by the stove' }, { lapse: 'Sneaking pantry food out to stray animals and village children', clue: 'the larder door unlatched' }],
  rapunzel: [{ lapse: 'Wandering off after rare plants', clue: 'the garden gate standing open' }],
  snow: [{ lapse: 'Admitting unvetted travellers through the front gates', clue: 'the front gate unlatched' }],
};
// The drift: unchecked, each value slides toward where her flaw would leave it (floor: drafted from Cast's resist); once it's below CLUE_AT,
// each day it may leave a clue, likelier the lower it is. An intervention lifts it. (All numbers drafted.)
const DRIFT = { RATE: 0.06, CLUE_AT: 0.55, CLUE_K: 1.4, GAIN: { correction: 0.35, talk: 0.15, lesson: 0.2 } };
const floorOf = (r, key) => { const R = r.resist || { overt: 0.3, covert: 0.3 }; return clamp(0.5 - 0.4 * (key === 'compliance' ? R.overt : Math.max(R.covert, 1 - (r.meters.mindfulness || 0.5))), 0.05, 0.45); };

// ── The finale's roles (GDD: "Silas coordinates the household, relying on the skills each woman has developed"). ──
const FINALE = {
  threats: ['Snow White’s stepmother, with bailiffs challenging the estate’s title', 'A pack of starving winter wolves'],
  roles: [
    { who: ['red'], task: 'Track and signal the wolf pack’s movements across the perimeter', skill: 'woodcraft and vigilance' },
    { who: ['gretel', 'cinderella'], task: 'Fortify and provision the ground floor and entryways', skill: 'provisioning; working without collapsing' },
    { who: ['goldie'], task: 'Spot the structural breach in the servants’ stairs before it fails', skill: 'mindfulness' },
    { who: ['rapunzel', 'snow'], task: 'Guard the upper safe rooms and the estate deeds', skill: 'common sense; saying no' },
    { who: ['belle'], task: 'Use the ledgers and legal records to outmanoeuvre the bailiffs at the front gate', skill: 'the estate’s books' },
  ],
  truth: 'The great-uncle was not a monster but a lonely, broken man who failed to anchor his own troubled family and let the house decay in grief. Confronting it seals Silas’s inheritance and answers the title challenge.',
};

// ── The village's verdict (GDD: by the end, fair employer, steward who settles debts, protector, a landlord who keeps his promises; the
// vicar disapproves throughout). Gossip carries it: market days, the green, the bakery counter. ──
const REPUTATION = ['employer', 'steward', 'protector', 'promises'];

// ── Relationship tracks: one per heroine. GDD: "each relationship runs on its own track, and nothing the player does in one thread lowers
// another." So an effect names one heroine and moves only her track. trust, respect, affection (0–1, drafted), and growth: how far she's come
// with her flaw (the GDD's "dialogue choices shape each heroine's growth and change later ambient interactions"). romance: only where the
// GDD names it (Red, Belle) or the designer opens it. ──
const TRACK = ['trust', 'respect', 'affection', 'growth'];

function create(o) {
  o = o || {};
  const s = { chapter: 1, beat: 0, day: 0, postgame: false, zones: {}, rooms: {}, residents: [], tracks: {}, habits: {}, rep: {}, flags: {}, log: [] };
  for (const z in ZONES) s.zones[z] = { open: ZONES[z].gate.kind === 'none' && ZONES[z].chapter === 1 };
  for (const id in ROOMS) s.rooms[id] = { restored: 0, lit: false };
  for (const k of REPUTATION) s.rep[k] = 0;
  return s;
}
// Opening a zone: its gate dealt with (unlock, clear, or its rooms restored enough to use).
function canOpen(s, z) { const Z = ZONES[z]; return !!Z && Z.chapter <= s.chapter; }
function open(s, z) { if (!canOpen(s, z)) return false; s.zones[z].open = true; if (z === 'gate') s.zones.village.open = true; s.log.push({ day: s.day, open: z }); return true; }
const unlock = open, clear = open;
// Restoring a room: from dusty and boarded up (0) to warm and lived in (1); a room with a hearth can be lit once it's restored halfway.
function restore(s, room, amount) {
  const R = s.rooms[room]; if (!R || !s.zones[ROOMS[room].zone].open) return false;
  R.restored = clamp(R.restored + (amount == null ? 1 : amount), 0, 1);
  if (ROOMS[room].zone === 'servants' && ZONES.servants.rooms.every(r => s.rooms[r.id].restored >= 0.5)) s.flags.servantsRestored = true;
  return true;
}
function light(s, room) { const R = s.rooms[room]; if (!R || !ROOMS[room].hearth || R.restored < 0.5) return false; R.lit = true; return true; }
// The manor's state, 0 (a dusty shell) – 1 (warm, lived in): the rooms of open zones, restored, and their fires.
function warmth(s) {
  const rs = Object.keys(ROOMS).filter(id => ZONES[ROOMS[id].zone].area !== 'village');
  return rs.reduce((a, id) => a + s.rooms[id].restored * (ROOMS[id].hearth ? 0.7 + 0.3 * (s.rooms[id].lit ? 1 : 0) : 1), 0) / rs.length;
}
const everyHearth = s => Object.keys(ROOMS).filter(id => ROOMS[id].hearth).every(id => s.rooms[id].lit);

// A heroine taken into the household: her home, her track, her habits (from Cast's drafted meters).
function arrive(s, id) {
  const C = root.Cast, r = C && C.ROSTER[id]; if (!r || s.residents.includes(id)) return false;
  s.residents.push(id);
  s.tracks[id] = { trust: 0.2, respect: 0.2, affection: 0.1, growth: 0, romance: r.dynamic.romance === true ? 0 : null };
  // (left alone, habits only slide: the floor is never above where she starts)
  const c = r.meters.compliance, m = r.meters.mindfulness;
  s.habits[id] = { compliance: c, mindfulness: m, floor: { compliance: Math.min(c, floorOf(r, 'compliance')), mindfulness: Math.min(m, floorOf(r, 'mindfulness')) } };
  s.log.push({ day: s.day, arrive: id });
  return true;
}
const homeOf = id => { const r = root.Cast && root.Cast.ROSTER[id]; return r ? HOMES[r.home] : null; };
// What a choice does to a relationship: effects on one heroine's track, never another's (the GDD's non-exclusivity). Returns the track.
function affect(s, id, fx) {
  const t = s.tracks[id]; if (!t) throw new Error('Estate.affect: ' + id + ' is not in the household');
  for (const k in fx) {
    if (k === 'romance') { if (t.romance == null) continue; t.romance = clamp(t.romance + fx[k], 0, 1); continue; }
    if (!TRACK.includes(k)) throw new Error('Estate.affect: no such track value ' + k);
    t[k] = clamp(t[k] + fx[k], 0, 1);
  }
  return t;
}
// Opening romance on a track the GDD leaves open (the designer's call, not the player's: docs/alpha-plan.md).
function allowRomance(s, id) { const t = s.tracks[id]; if (t && t.romance == null) t.romance = 0; }
function vignettes(s) { return VIGNETTES.filter(v => v.pair.every(id => s.residents.includes(id)) && !s.flags['seen:' + v.id]); }
const dayKind = s => WEEK[s.day % WEEK.length];
const servedToday = s => DAY_SERVES[dayKind(s)].filter(id => s.residents.includes(id));

// Habit drift, `days` at a time (post-game; or anywhere, given force). Returns the clues it leaves: { id, lapse, clue, day }.
function drift(s, days, rnd, force) {
  rnd = rnd || Math.random; const out = [];
  if (!s.postgame && !force) return out;
  for (let d = 0; d < (days || 1); d++) {
    s.day++;
    for (const id of s.residents) {
      const H = s.habits[id];
      for (const k of ['compliance', 'mindfulness']) H[k] += (H.floor[k] - H[k]) * DRIFT.RATE;
      const low = Math.min(H.compliance, H.mindfulness);
      if (low < DRIFT.CLUE_AT && rnd() < (DRIFT.CLUE_AT - low) * DRIFT.CLUE_K) {
        const L = LAPSES[id]; if (!L) continue; const l = L[Math.floor(rnd() * L.length) % L.length];
        out.push({ id, lapse: l.lapse, clue: l.clue, day: s.day });
      }
    }
  }
  return out;
}
// Catching it: a correction, a talk or a lesson lifts both values (and, in the post-game, the GDD's late-night interventions).
function intervene(s, id, kind) {
  const H = s.habits[id]; if (!H) return false; const g = DRIFT.GAIN[kind] || DRIFT.GAIN.talk;
  H.compliance = clamp(H.compliance + g, 0, 1); H.mindfulness = clamp(H.mindfulness + g * 0.8, 0, 1);
  return true;
}
// The chapters' order: each call takes the current chapter's next beat; after its last, on to the next chapter; after the finale, the
// post-game. (What each beat plays, and what must be true before it, is the chapter scripts' to say: not built yet.)
const chapterOf = s => CHAPTERS[s.chapter - 1];
function step(s) {
  const C = chapterOf(s); if (!C) return null;
  const b = C.beats[s.beat]; s.beat++;
  if (s.beat >= C.beats.length) { s.chapter++; s.beat = 0; if (s.chapter > CHAPTERS.length) s.postgame = true; }
  return b;
}
function raise(s, facet, amount) { if (!REPUTATION.includes(facet)) throw new Error('Estate.raise: ' + facet); s.rep[facet] = clamp(s.rep[facet] + amount, 0, 1); return s.rep[facet]; }

const api = { ZONES, ROOMS, CHAPTERS, UNPLACED_JOURNEYS, HOMES, VIGNETTES, WEEK, DAY_SERVES, LAPSES, DRIFT, FINALE, REPUTATION, TRACK,
  create, canOpen, open, unlock, clear, restore, light, warmth, everyHearth, arrive, homeOf, affect, allowRomance, vignettes, dayKind, servedToday, drift, intervene, chapterOf, step, raise };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Estate = api;
})(typeof window !== 'undefined' ? window : globalThis);
