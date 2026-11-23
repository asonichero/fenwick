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
//   Chapters and arcs: a chapter introduces its heroine and ends once she's taken in; the next opens only then. Her arc runs on alongside the
//   others at the player's pace: Estate.corrected(s, id, result) (a correction's outcome) and Estate.affect (what's said) move her track;
//   Estate.arcOf(s, id) → { stage, path, waits } · Estate.closeArc(s, id) (her arc's closing scene, once she's ready and what it waits on has
//   got far enough) · Estate.chapterOpen(s, n) · Estate.finaleOpen(s)
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
  // (Redmere, by the footpath through the Fenwood, from the first day: about sixty households, 250 to 300 people, all holding from the Hall.
  // No one wanders: Silas meets whom the story needs, a few speaking at a visit, a handful more placed about the green)
  village: { name: 'Redmere', chapter: 1, area: 'village', public: true, gate: { kind: 'none', label: 'By the footpath through the Fenwood' },
    rooms: [{ id: 'green', name: 'The green' }, { id: 'bakery', name: 'The bakery' }, { id: 'alehouse', name: 'The alehouse' }, { id: 'smithy', name: 'The smithy' }, { id: 'church', name: 'The church and churchyard' }, { id: 'reeve', name: 'The reeve’s house' }, { id: 'market', name: 'Market' }] },
};
const ROOMS = {}; for (const z in ZONES) for (const r of ZONES[z].rooms) ROOMS[r.id] = Object.assign({ zone: z }, r);

// ── The chapters (GDD: "Chapter progression and ensemble dynamics"). clues: what the player reads before a confrontation (the GDD's pillar
// names muddy footprints, broken furniture, wolf tracks, pried locks, hidden food caches; each chapter's discovery supplies its own).
// journey: the on-rails walk, where the GDD names one. beats: the chapter's steps, in order, drafted from its conflict and climax. ──
const CHAPTERS = [
  // (Ch. 1 in detail: docs/gdd.md, "Chapter 1 in detail". Three days. His arrival, the Hall, the Fenwood and Redmere; that evening, her asleep
  // in his bed; her terms, the correction, the night in the guest room; the offer, and home to decide; back, and taken in)
  { n: 1, id: 'dusty', title: 'The Dusty Hall', zone: 'hall', featured: ['goldie'], with: [],
    conflict: 'Arriving at the Hall and walking the Fenwood to Redmere; finding the trespasser asleep in his bed; her terms, the correction and the offer; house rules, and her place.',
    // (what she left, for him to read when he's back from Redmere at dusk: he'd put the last of the supplies he travelled with to a stew over
    // the great hall's hearth before he went)
    clues: ['the stew pot emptied, a used bowl and spoon on the table', 'a stool broken by the great hall’s hearth', 'muddy prints up the stair', 'his bed slept in'],
    // (on the way: hers, and the next chapter's)
    signs: ['small footprints off the footpath', 'a ribbon caught on a bramble', 'wolf tracks, deeper in'],
    meets: ['reeve', 'bakerMother', 'alewife', 'vicar'],      // (Redmere, the first time; the vicar a nod at the churchyard gate, if at all)
    days: [
      ['arrive', 'keys', 'explore', 'restore', 'stew', 'woods', 'village', 'dusk', 'clues', 'discover', 'terms', 'correction', 'aftercare', 'guestroom'],
      ['offer', 'decide', 'round', 'letter'],
      ['return', 'rules', 'chair', 'work'],
    ],
    open: ['who hands him the keys (Edwin Hollis, the solicitor, perhaps)'],
    lore: 'Goldie’s wandering is why she finds the Hall. Her father is Redmere’s smith; her family and the village watch her change in instalments.' },
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
for (const C of CHAPTERS) if (C.days) C.beats = C.days.flat();
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
const TRACK = ['trust', 'respect', 'affection', 'growth', 'submission', 'resentment'];      // (submission: how far she's given herself to his authority; resentment: what she holds against him)

// ── Chapters and arcs (docs/gdd.md, "Chapters and arcs"). Not seven self-contained chapters: each introduces a heroine (from its zone opening to
// her taken into the household, its last beat), and the next chapter opens only once it has ended. Her arc then runs on alongside everyone
// else's, closed at the pace the player sets: as her track moves (the corrections, and what's said in conversations), she goes from settling
// in, to having her flaw tested, to turning, to ready; then her arc's own closing scene closes it, along her path. Some arcs wait on others: a
// stage of hers can't be reached till another's has got so far. The stages' thresholds, the waits and the paths are drafted. ──
const ARC_STAGES = ['settling', 'testing', 'turning', 'ready', 'closed'];
const ARC = {
  testing: t => t.corrections >= 1 || t.growth >= 0.1,
  turning: t => t.growth >= 0.4 && t.trust >= 0.4 && t.resentment <= 0.45,
  ready: t => t.growth >= 0.75 && t.trust >= 0.6 && t.respect >= 0.5 && t.resentment <= 0.25,
};
// (whose arc waits on whose, and for what: drafted from the GDD's pairings. stage: the stage of hers that waits; needs: { id: stage of theirs })
const ARC_WAITS = {
  cinderella: { stage: 'ready', needs: { goldie: 'turning' }, why: 'She covers for Goldie’s messes until Silas holds Goldie accountable.' },
  snow: { stage: 'ready', needs: { belle: 'turning' }, why: 'Belle has to be steady herself to ground Snow White.' },
  rapunzel: { stage: 'ready', needs: { red: 'turning' }, why: 'Red teaches Rapunzel the village and the paths.' },
  gretel: { stage: 'ready', needs: { cinderella: 'turning' }, why: 'The kitchens are Eleanor’s to share with her.' },
};
const FINALE_NEEDS = 'turning';      // (every arc at least this far before the finale opens: the roles it gives each of them need what they've learned)
// (the path an arc closes along: the two axes. Romance, where it's open on her track and she's come that way; devotion, where she's given
// herself to his authority; else simply her place in the household)
const PATHS = { romance: t => t.romance != null && t.romance >= 0.5 && t.affection >= 0.5, devotion: t => t.submission >= 0.5 && t.respect >= 0.5 };

function create(o) {
  o = o || {};
  const s = { chapter: 1, beat: 0, day: 0, postgame: false, zones: {}, rooms: {}, residents: [], arrived: {}, tracks: {}, habits: {}, rep: {}, flags: {}, log: [] };
  for (const z in ZONES) s.zones[z] = { open: ZONES[z].gate.kind === 'none' && ZONES[z].chapter === 1 };
  for (const id in ROOMS) s.rooms[id] = { restored: 0, lit: false };
  for (const k of REPUTATION) s.rep[k] = 0;
  return s;
}
// Opening a zone: its gate dealt with (unlock, clear, or its rooms restored enough to use).
function canOpen(s, z) { const Z = ZONES[z]; return !!Z && Z.chapter <= s.chapter; }
function open(s, z) { if (!canOpen(s, z)) return false; s.zones[z].open = true; s.log.push({ day: s.day, open: z }); return true; }
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
  s.residents.push(id); s.arrived[id] = s.day;
  s.tracks[id] = { trust: 0.2, respect: 0.2, affection: 0.1, growth: 0, submission: 0.1, resentment: 0, corrections: 0, romance: r.dynamic.romance === true ? 0 : null, closed: null };
  // (left alone, habits only slide: the floor is never above where she starts)
  const c = r.meters.compliance, m = r.meters.mindfulness;
  s.habits[id] = { compliance: c, mindfulness: m, floor: { compliance: Math.min(c, floorOf(r, 'compliance')), mindfulness: Math.min(m, floorOf(r, 'mindfulness')) } };
  s.log.push({ day: s.day, arrive: id });
  return true;
}
// What she's wearing (Cast.WARDROBE: her outfits, the first her usual). Red's leggings and kirtle are for walking the estate (the grounds and the
// wood; never the village, where she's her mother's daughter at the bakery counter), and she wears them more often as time goes on: about one
// walk in four when she first comes to the Hall, most of them after a season, a little more as she trusts Silas (her track's trust). Indoors
// at the Hall, now and then once she's used to it. where: an area (hall | grounds | wood | village) or a zone's id. (Rates drafted.)
function walkingChance(s, where) {
  const area = (ZONES[where] && ZONES[where].area) || where, since = s.day - (s.arrived.red == null ? s.day : s.arrived.red), t = s.tracks.red;
  const p = clamp(0.25 + 0.6 * Math.min(1, since / 120) + 0.15 * (t ? t.trust : 0), 0, 0.95);
  return area === 'grounds' || area === 'wood' ? p : area === 'hall' ? 0.25 * p : 0;
}
function outfitFor(s, id, where, rnd) {
  const C = root.Cast, list = C ? C.outfits(id) : []; if (!list.length) return null;
  if (id === 'red') return (rnd || Math.random)() < walkingChance(s, where) ? 'walking' : 'dress';
  return list[0];
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
  touch(t); return t;
}
// ── Her arc: its stage (the furthest her track has reached, held where something it waits on hasn't got far enough), its path, and what it
// waits on. A stage once reached isn't lost (setbacks show in her track and her habits, not by undoing her arc) ──
const stageN = k => ARC_STAGES.indexOf(k);
// (the furthest stage her track meets now; kept on the track as it moves (reached), so a stage once reached isn't lost)
const meets = t => { let n = 0; for (const k of ['testing', 'turning', 'ready']) { if (ARC[k](t)) n = stageN(k); else break; } return n; };
const touch = t => { t.reached = Math.max(t.reached || 0, meets(t)); };
function arcOf(s, id) {
  const t = s.tracks[id]; if (!t) return null;
  if (t.closed) return { stage: 'closed', path: t.closed, waits: [] };
  let n = Math.max(t.reached || 0, meets(t));
  const W = ARC_WAITS[id], waits = [];
  if (W) for (const o in W.needs) { const a = arcOf(s, o); if (!a || stageN(a.stage) < stageN(W.needs[o])) waits.push({ id: o, stage: W.needs[o], why: W.why }); }
  if (waits.length) n = Math.min(n, stageN(W.stage) - 1);      // (held short of it while it waits)
  return { stage: ARC_STAGES[n], path: pathOf(t), waits };
}
const pathOf = t => (PATHS.romance(t) ? 'romance' : PATHS.devotion(t) ? 'devotion' : 'household');
// (her arc's closing scene: only once she's ready; closed along her path, and kept so)
function closeArc(s, id) { const a = arcOf(s, id); if (!a || a.stage !== 'ready') return false; s.tracks[id].closed = a.path; s.log.push({ day: s.day, closed: id, path: a.path }); return a.path; }
// A correction's outcome (js/session.js's turnEnd result) on her track: her defiance let go in compliance is growth; what she resents, she
// holds; corrected well (seen through, and cared for after), she trusts him a little more; her word ends it, and costs trust it shouldn't
// have had to. Only hers moves. (Drafted.)
function corrected(s, id, r) {
  const t = s.tracks[id]; if (!t) throw new Error('Estate.corrected: ' + id + ' is not in the household');
  const drop = r.defiance ? Math.max(0, r.defiance.from - r.defiance.to) : 0;
  t.corrections++;
  t.growth = clamp(t.growth + 0.25 * (r.compliance || 0) + 0.15 * drop, 0, 1);
  t.resentment = clamp(t.resentment + (r.resentment || 0), 0, 1);
  if (r.outcome === 'word') t.trust = clamp(t.trust - 0.05, 0, 1);
  else { t.trust = clamp(t.trust + (r.cared ? 0.06 : 0.02), 0, 1); t.respect = clamp(t.respect + 0.04, 0, 1); }
  touch(t); return arcOf(s, id);
}
// The chapters: the next opens only once this one has ended (its heroine taken in); the finale, only once every arc has got far enough.
const chapterOpen = (s, n) => n <= 1 || s.chapter >= n;
const finaleOpen = s => chapterOpen(s, CHAPTERS.length) && s.residents.every(id => stageN(arcOf(s, id).stage) >= stageN(FINALE_NEEDS));
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

const api = { ZONES, ROOMS, CHAPTERS, UNPLACED_JOURNEYS, HOMES, VIGNETTES, WEEK, DAY_SERVES, LAPSES, DRIFT, FINALE, REPUTATION, TRACK, ARC_STAGES, ARC_WAITS, FINALE_NEEDS,
  arcOf, closeArc, corrected, chapterOpen, finaleOpen, create, canOpen, open, unlock, clear, restore, light, warmth, everyHearth, arrive, homeOf, walkingChance, outfitFor, affect, allowRomance, vignettes, dayKind, servedToday, drift, intervene, chapterOf, step, raise };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Estate = api;
})(typeof window !== 'undefined' ? window : globalThis);
