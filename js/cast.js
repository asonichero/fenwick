// Fenwick Hall — who's in the house: Silas Fenwick (the player), the seven heroines, and the village and household cast (docs/gdd.md, "Cast of
// characters"). Each heroine's entry keeps two kinds of fact apart:
//   gdd:   what the design document states (her names, age, role, chapter, flaw, how she resists, how she's found, her arc, history, temperament).
//   the rest is a first draft for review (docs/alpha-plan.md): her body, look, how she takes pain, her wilfulness, what she wears, and the
//          safe word she agrees when Silas explains his terms. Nothing drafted contradicts the GDD; where the GDD is silent it says so.
// The engine (js/session.js, ported from Project Meridian) reads the same fields Meridian's crew roster gave it: pain, meters.wilfulness,
// body (h, mass, fat, bust, response), dynamic, word, base, look, and what Silas calls her (short).
//
//   Cast.ROSTER.goldie · Cast.IDS (in chapter order) · Cast.figureSpec('goldie') → a spec for Figure.make · Cast.squireSpec() · Cast.SQUIRE
(function (root) {
'use strict';

// The post-game habit drift (GDD, "Post-game mechanics"): each resident's hidden Compliance and Mindfulness. Wilfulness is Meridian's: the
// defiance she brings to a correction (js/session.js), drafted here from how the GDD says each resists.
const METERS = ['compliance', 'mindfulness', 'wilfulness'];

// resist: how she resists, as the GDD describes it (style, its words), drafted as two numbers, 0–1: overt (open defiance: the session's
// wilfulness) and covert (concealment, withholding, hiding what she needs: what the habit drift and clue-finding work against). The GDD's
// "low on both counts" (Rapunzel, Snow White) reads as low on these two.
// pain: tolerance and resilience for js/pain.js. body: her height (metres), mass (muscle and frame), fat (softness), bust (0 small – 1 large),
// response (her body's response to a correction: 1 for everyone, as Meridian has it). look: skin, hair, its style (crop, short, bun, bob,
// curls, ponytail, or braid with braidLen in head units), eyes, lips. dynamic: romance (the GDD names Red and Belle; null where it's silent),
// bond (affection given and returned, 0–1: not yet tracked). home: where she lives once she's taken in (the GDD's ambient vignettes).
const ROSTER = {
  goldie: {
    id: 'goldie', chapter: 1, name: 'Marigold', short: 'Goldie', tale: 'Goldilocks', title: 'Goldilocks', age: 18, role: 'Live-in housemaid',
    gdd: {
      names: 'Given name Marigold. At her own request Silas calls her Goldie. The village and the household often say Goldilocks, for the hair.',
      flaw: 'Chronic carelessness, daydreaming, treating others’ property without boundaries',
      discovery: 'Found fast asleep in an upstairs guest bed days after Silas moves in: half-eaten rations, spilled ink and a broken antique chair.',
      arc: 'Disciplined for the trespass and damage; offered a position as maid to work off her debt. She takes the offer to her parents and returns only if she is willing. Her employment is public; she visits her parents on her days off. His first dependent.',
      history: 'Her father keeps a working trade in Redmere; her mother runs a household where her younger siblings fell into step early. Goldie never did.',
      temperament: 'Curious, quick, unbothered by disapproval in the moment (it lands later, privately). Needs a reason, and tests whether one exists. Honest to a fault: argues her case instead of taking a consequence quietly.',
      resistance: 'The most overt of the seven. She defies in the open, debates, and tries every boundary to see which hold. What holds her is the first structure that meets her curiosity instead of suppressing it.',
      motif: 'Just right: a chair, a place at the table, a room that fits her.',
    },
    resist: { style: 'overt', overt: 0.8, covert: 0.1 }, meters: { wilfulness: 0.8, compliance: 0.25, mindfulness: 0.2 },
    pain: { tolerance: 0.45, resilience: 0.62 }, home: 'servants',
    body: { type: 'slight and quick', h: { f: 1.60 }, mass: 0.42, fat: 0.38, bust: 0.35, response: 1 },
    look: { skin: '#f0d0b4', hair: '#e0b24a', hairStyle: 'curls', eyes: '#4a7aa8' },
    dynamic: { romance: null, bond: 0 }, word: 'Thistle', base: 'cheeky',
  },
  red: {
    id: 'red', chapter: 2, name: 'Rose', short: 'Red', tale: 'Little Red Riding Hood', title: 'Red Riding Hood', age: 19, role: 'Village ward, woods companion and romantic interest',
    gdd: {
      names: 'The village calls her Red, for the cloak her mother dyed for her as a girl. Her given name is Rose.',
      flaw: 'Naivety, distraction, ignoring warnings about forest hazards',
      discovery: 'Encountered off the main forest trail while Silas patrols the boundary woods, cornered by a lone wolf after straying from the path.',
      arc: 'He drives off the wolf and escorts her back to the village in an on-rails twilight walk, promising her mother he will keep an eye on her. Over repeated encounters he teaches her woodcraft, vigilance and safety, with firm correction when she slips, as a slow-burning romantic bond develops.',
      history: 'Her father died young of illness, leaving her mother to carry the village bakery alone. Red works the counter and the oven, and carries sweets and supplies to her grandmother’s cottage in the Fenwood. Her future is uncertain.',
      temperament: 'Warm, generous with her attention, well liked. Restless under repetition, drawn off the path by whatever catches her eye. A low, constant unease about her future under the cheerfulness.',
      resistance: 'Repetition, not rebellion: dawdling on errands, straying, arriving late. Discipline is about follow-through and presence of mind.',
    },
    resist: { style: 'repetition', overt: 0.3, covert: 0.2 }, meters: { wilfulness: 0.3, compliance: 0.45, mindfulness: 0.3 },
    pain: { tolerance: 0.55, resilience: 0.58 }, home: 'village',
    body: { type: 'sturdy from the oven and the path, average height', h: { f: 1.65 }, mass: 0.52, fat: 0.45, bust: 0.55, response: 1 },
    look: { skin: '#e8c4a4', hair: '#5a2a1e', hairStyle: 'braid', hairCap: 'swept', braidLen: 4.5, ribbon: '#a8282a', eyes: '#6a5a3a' },
    dynamic: { romance: true, bond: 0 }, word: 'Lantern', base: 'smile',
  },
  belle: {
    id: 'belle', chapter: 3, name: 'Belle', short: 'Belle', tale: 'Beauty and the Beast', title: 'Belle', age: 20, role: 'Estate bookkeeper, ward and romantic foil',
    gdd: {
      flaw: 'Fierce obstinacy, intellectual pride, testing forbidden boundaries',
      discovery: 'Silas summons a merchant to answer for debts owed to the estate; he arrives with his adult daughter, who offers her skills as bookkeeper to clear the debt.',
      arc: 'Silas takes her on as his ward and potential prospect, not a servant: fine upper rooms, dining as an equal, on the strict condition that she stays out of the dangerous West Wing. Her curiosity keeps drawing her to it.',
      history: 'A merchant’s only daughter. Her mother died when she was young; she took over the household accounts out of necessity, and the competence hardened into character. Her father’s luck turned through bad timing, not recklessness.',
      temperament: 'Precise, well read, guarded, deeply proud of being capable. Handles feeling privately. Being handed over to settle a debt wounds her pride before it is anything romantic.',
      resistance: 'Quiet. She complies correctly and without complaint while withholding everything she is not asked for. The work is getting past her management, so she feels something in front of him instead of handling it alone.',
    },
    // (her defiance is pride, not misbehaviour: drafted high enough that the session's pride (holding back, then breaking bigger) shows)
    resist: { style: 'quiet', overt: 0.45, covert: 0.7 }, meters: { wilfulness: 0.45, compliance: 0.7, mindfulness: 0.75 },
    pain: { tolerance: 0.6, resilience: 0.5 }, home: 'upper',
    body: { type: 'tall and poised', h: { f: 1.68 }, mass: 0.4, fat: 0.35, bust: 0.45, response: 1 },
    look: { skin: '#e2bc9c', hair: '#4a2e1e', hairStyle: 'chignon', eyes: '#6a7480' },
    dynamic: { romance: true, bond: 0 }, word: 'Folio', base: 'calm',
  },
  cinderella: {
    id: 'cinderella', chapter: 4, name: 'Eleanor', short: 'Eleanor', tale: 'Cinderella', title: 'Cinderella', age: 20, role: 'Scullery and laundry maid',
    gdd: {
      names: 'Given name Eleanor; Silas uses it. Others call her Cinders, for the hearth ash she is always found in. She answers to both.',
      flaw: 'Extreme self-neglect, passive submission to exploitation, sneaking out at night',
      discovery: 'Hired from the village to scrub the kitchens and laundry courtyard; found asleep beside a cold hearth, bruised, exhausted and in rags despite the wages paid to her household.',
      arc: 'The direct foil to careless Goldilocks. After Silas finds her stepmother pocketing her wages, he moves her into the Hall permanently and breaks her habit of working herself to collapse: rest, curfews and self-respect.',
      history: 'Her father died and left her to a stepmother and two stepsisters who took her wages and her room. Work became the one place she was safe from criticism.',
      temperament: 'Patient, dutiful, quiet, with a stubborn kindness she hides behind work. Beneath the exhaustion, a wish for the village gatherings she keeps slipping out to.',
      resistance: 'Passive. She says yes to everything and complies to the point of collapse, hiding how tired she is. Her lapses are night outings and overwork, not defiance.',
    },
    resist: { style: 'passive', overt: 0.05, covert: 0.6 }, meters: { wilfulness: 0.05, compliance: 0.9, mindfulness: 0.35 },
    pain: { tolerance: 0.72, resilience: 0.38 }, home: 'servants',
    body: { type: 'slight, worn thin by work', h: { f: 1.63 }, mass: 0.32, fat: 0.25, bust: 0.35, response: 1 },
    look: { skin: '#ecd0b8', hair: '#b8a27a', hairStyle: 'workbun', eyes: '#6a7a6a' },
    dynamic: { romance: null, bond: 0 }, word: 'Ember', base: 'concerned',
  },
  gretel: {
    id: 'gretel', chapter: 5, name: 'Gretel', short: 'Gretel', tale: 'Hansel and Gretel', title: 'Gretel', age: 19, role: 'Kitchen hand and larder keeper',
    gdd: {
      flaw: 'Scarcity-driven distrust, instinctive lying, hoarding food',
      discovery: 'Caught raiding the smokehouse and root cellar, and setting illegal snares in the brush, to feed herself and her sick, injured brother Hansel after being abandoned in the woods.',
      arc: 'Respecting her survival instincts, Silas disarms her snares, gives Hansel light stable work once he recovers, and places Gretel in the kitchens under strict supervision, teaching her she no longer needs to steal or lie to be secure.',
      history: 'Abandoned in the woods with her brother when the household could no longer feed them. She kept them both alive through winter by trapping, stealing and telling whatever story kept a door open.',
      temperament: 'Sharp, practical, watchful, proud of her survival instinct. Trusts nothing she has not tested; lies by reflex. Fiercely loyal to her brother, quietly funny once she is fed.',
      resistance: 'Concealment. She lies, hoards food under floorboards and sets snares, with little outright defiance: open defiance gets people hurt. Discipline is about security.',
    },
    resist: { style: 'concealment', overt: 0.2, covert: 0.85 }, meters: { wilfulness: 0.2, compliance: 0.4, mindfulness: 0.6 },
    pain: { tolerance: 0.7, resilience: 0.62 }, home: 'kitchens',
    body: { type: 'small and wiry', h: { f: 1.58 }, mass: 0.38, fat: 0.2, bust: 0.3, response: 1 },
    look: { skin: '#d8b090', hair: '#8a6a42', hairStyle: 'cropped', eyes: '#4a3422' },
    dynamic: { romance: null, bond: 0 }, word: 'Pebble', base: 'calm',
  },
  rapunzel: {
    id: 'rapunzel', chapter: 6, name: 'Rapunzel', short: 'Rapunzel', tale: 'Rapunzel', title: 'Rapunzel', age: 20, role: 'Ward and walled-garden tender',
    gdd: {
      flaw: 'Total worldly ignorance, social naivety, wandering into hazards from wonder',
      discovery: 'While clearing the briar-choked eastern perimeter, Silas inspects an isolated gatehouse tower rented to an eccentric, domineering older tenant, Gothel, and finds a grown young woman kept confined for years.',
      arc: 'After evicting Gothel for unlawful confinement, he brings Rapunzel into the main grounds. She needs patient, constant guidance in common sense, household rules and safety, and finds peace tending the walled medicinal garden.',
      history: 'Gothel took her to the gatehouse tower as a child and kept her there for years. She has read the books Gothel allowed and watched the wood from a high window, but never walked a path or met a stranger on her own terms.',
      temperament: 'Wonderstruck, trusting of the first kindness she meets, without any sense of what is dangerous. Gentle and curious. She may start over-compliant and turn wild once she tastes freedom, and reads any enclosure as another tower.',
      resistance: 'Low on both counts. She wanders because she is dazzled, not defiant, and apologises sincerely each time. Discipline teaches what freedom is for, with patience rather than severity.',
    },
    resist: { style: 'wonder', overt: 0.1, covert: 0.1 }, meters: { wilfulness: 0.1, compliance: 0.75, mindfulness: 0.15 },
    pain: { tolerance: 0.35, resilience: 0.45 }, home: 'garden',
    body: { type: 'tall and slender, pale from the tower', h: { f: 1.70 }, mass: 0.35, fat: 0.35, bust: 0.45, response: 1 },
    look: { skin: '#f4dccb', hair: '#d8b860', hairStyle: 'braid', hairCap: 'swept', braidLen: 8.5, ribbon: '#4a6a3a', eyes: '#7a8aa0' },
    dynamic: { romance: null, bond: 0 }, word: 'Larkspur', base: 'wistful',
  },
  snow: {
    id: 'snow', chapter: 7, name: 'Snow White', short: 'Snow', tale: 'Snow White', title: 'Snow White', age: 18, role: 'Protected manor ward',
    gdd: {
      flaw: 'Fatal gullibility, inability to turn away strangers',
      discovery: 'Deep in the timberlands, charcoal burners and woodcutters working on his land hand over a young woman fleeing a murderous stepmother in a neighbouring parish. Only the lord of the manor has the walls and authority to protect her.',
      arc: 'Housed in the upper Hall alongside Belle, she tests his patience whenever her warm heart leads her to unlatch gates or accept gifts from unvetted visitors, requiring strict security drills as her stepmother’s agents close in.',
      history: 'Raised in a great house in the neighbouring parish, where her stepmother’s jealousy turned lethal. She fled with nothing.',
      temperament: 'Warm, trusting, quick to love, with a small vanity about being looked at and liked. Cannot turn away a stranger, a peddler or a sob story. Competitive with the other women when the household does not like her.',
      resistance: 'Low on both counts. She apologises sincerely and repeats the lapse, because the warmth that causes it is the best thing about her. Discipline is security drills and learning to say no, and must leave her kindness intact.',
    },
    resist: { style: 'warmth', overt: 0.1, covert: 0.1 }, meters: { wilfulness: 0.1, compliance: 0.65, mindfulness: 0.3 },
    pain: { tolerance: 0.4, resilience: 0.5 }, home: 'upper',
    body: { type: 'small and soft', h: { f: 1.62 }, mass: 0.42, fat: 0.48, bust: 0.5, response: 1 },
    // (Grimm's: skin white as snow, lips red as blood, hair black as ebony; a plait, not the bob of other tellings)
    look: { skin: '#f6e2d6', hair: '#141010', hairStyle: 'braid', hairCap: 'sidepart', braidLen: 5, ribbon: '#8a1a24', eyes: '#3a2a22', lips: '#b8323a' },
    dynamic: { romance: null, bond: 0 }, word: 'Ebony', base: 'smile',
  },
};
const IDS = Object.keys(ROSTER).sort((a, b) => ROSTER[a].chapter - ROSTER[b].chapter);

// ── What they wear ──
// Period dress, built in Blender (tools/blender/build_figures.py) and drawn on in js/figure.js: a dress (sleeves to the wrist, or to the elbow
// for work) with a fitted, front-laced bodice, the chemise showing at the neckline, a full skirt to the lower calf, and loose drawers to the
// knee under it, stockings and shoes; or a kirtle (the same cut, to just above the knee) over leggings and fitted smalls, with boots. Nothing
// from any film's designs. Each heroine's outfits, the first her usual:
//   kind: dress | kirtle; sleeves: long | elbow; main: the cloth; bodice: its own colour (else the main); apron; trim: bands and lacing;
//   print: a small sprig print's colour; chemise; patches; under: drawers | smalls (underCol); legs: leggings (legCol, darned); stockings;
//   shoes: boots (the default) | flats | work | soft | loafers (shoe, sole).
// Leggings are Gretel's own, and Red's for walking the estate: she wears them more often as time goes on (js/estate.js: Estate.outfitFor).
// (the Hall's maid's uniform, Goldie's and Eleanor's alike: a russet work dress with elbow sleeves, a clean apron over it, a cream chemise,
// drawers, grey stockings; each in her own shoes)
const MAID = { kind: 'dress', sleeves: 'elbow', main: '#8a4a32', trim: '#5a3222', apron: '#e8e2d4', chemise: '#f2ede2', under: 'drawers', underCol: '#efe9dc', stockings: '#4a4440' };
// (Fenwick: what each sleeps in, barefoot. Those whose dresses have elbow sleeves, with the white chemise showing below them, sleep in that
// chemise and their drawers; Gretel in a rough one of unbleached linen, patched, and her smalls; Rapunzel, Snow White and Belle in a linen
// night-dress, like Rapunzel's tower gown, to the ankle)
const CHEMISE = { kind: 'chemise', sleeves: 'elbow', main: '#f4efe4', trim: '#f4efe4', chemise: '#f4efe4', under: 'drawers', underCol: '#f2ede2' };
const NIGHTDRESS = { kind: 'nightdress', sleeves: 'long', main: '#f2ece0', trim: '#e2d8c6', chemise: '#f2ece0', under: 'drawers', underCol: '#f4f0e6' };
const WARDROBE = {
  goldie: {
    maid: Object.assign({}, MAID, { shoes: 'flats', shoe: '#3a2a20', sole: '#1e1612' }),
    own: { kind: 'dress', sleeves: 'elbow', main: '#b88a2e', bodice: '#8a4a2a', trim: '#5a3018', chemise: '#efe6d2', under: 'drawers', underCol: '#ece4d4', stockings: '#9a8a74', shoes: 'work', shoe: '#5a3e2a', sole: '#2a2420' },
    night: CHEMISE,
  },
  red: {
    dress: { kind: 'dress', sleeves: 'elbow', main: '#6a4630', trim: '#a8282a', apron: '#e8e0d0', chemise: '#f4efe4', under: 'drawers', underCol: '#f2ede2', stockings: '#7a2424', shoes: 'boots', shoe: '#4a3020' },
    walking: { kind: 'kirtle', sleeves: 'elbow', main: '#6a4630', trim: '#a8282a', chemise: '#f4efe4', under: 'smalls', underCol: '#efe8da', legs: 'leggings', legCol: '#6a2622', shoes: 'boots', shoe: '#4a3020' },
    night: CHEMISE,
  },
  belle: {
    dress: { kind: 'dress', sleeves: 'long', main: '#2f4a3a', trim: '#c8b48a', chemise: '#f4efe4', under: 'drawers', underCol: '#f4f0e6', stockings: '#ece6da', shoes: 'loafers', shoe: '#2a1e18', sole: '#140e0c' },
    night: NIGHTDRESS,
  },
  cinderella: {
    maid: Object.assign({}, MAID, { shoes: 'work', shoe: '#4a3a2e', sole: '#221a14' }),
    dayoff: { kind: 'dress', sleeves: 'elbow', main: '#6a7c96', print: '#efe8d6', bodice: '#3e4a62', trim: '#2e3648', chemise: '#f4efe4', under: 'drawers', underCol: '#f2ede2', stockings: '#e8e2d6', shoes: 'work', shoe: '#4a3a2e', sole: '#221a14' },
    rags: { kind: 'dress', sleeves: 'elbow', main: '#6a625a', trim: '#4a4440', apron: '#9a9286', chemise: '#c8c0b0', patches: true, under: 'drawers', underCol: '#d8d0c0', stockings: '#3a3632', shoes: 'soft', shoe: '#4a3a2e', sole: '#2a221c' },
    night: CHEMISE,
  },
  gretel: {
    kirtle: { kind: 'kirtle', sleeves: 'elbow', main: '#5a4630', trim: '#3a2a1a', chemise: '#e2d8c4', patches: true, under: 'smalls', underCol: '#e2d8c4', legs: 'leggings', legCol: '#3e3a32', darned: true, shoes: 'boots', shoe: '#3a2a1e' },
    night: { kind: 'chemise', sleeves: 'elbow', main: '#d8ccb2', trim: '#d8ccb2', chemise: '#d8ccb2', patches: true, under: 'smalls', underCol: '#e2d8c4' },
  },
  rapunzel: {
    garden: { kind: 'dress', sleeves: 'long', main: '#8a9a74', trim: '#5a6a4a', apron: '#d8ccb0', chemise: '#f6f1e6', under: 'drawers', underCol: '#f4f0e6', stockings: '#ece6da', shoes: 'boots', shoe: '#5a4632' },
    tower: { kind: 'dress', sleeves: 'long', main: '#e2d8c2', trim: '#b8ac94', chemise: '#f6f1e6', patches: true, under: 'drawers', underCol: '#f4f0e6', stockings: '#ece6da', shoes: 'soft', shoe: '#b8a88a', sole: '#8a7a5a' },
    night: NIGHTDRESS,
  },
  snow: {
    dress: { kind: 'dress', sleeves: 'long', main: '#efe6d2', bodice: '#8a1a24', trim: '#d8b46a', chemise: '#fbf8f0', under: 'drawers', underCol: '#f6f2ea', stockings: '#f2eee6', shoes: 'flats', shoe: '#3a1418', sole: '#1a0a0c' },
    night: NIGHTDRESS,
  },
};
// (what each is, for the set-up: a line about each outfit)
const OUTFIT_NOTES = { night: 'for bed', maid: 'as maid, the Hall’s uniform', dayoff: 'her own, for her days off', own: 'her own, as found', dress: 'her dress', walking: 'walking the estate: kirtle and leggings', rags: 'as found, in rags', kirtle: 'kirtle and leggings', garden: 'for the garden', tower: 'from the tower' };
const PERIOD = {
  goldie: 'Her own at first: a mustard skirt and a laced rust bodice over a cream chemise, worn shoes. As maid: the Hall’s uniform, a russet work dress and clean apron, as Eleanor wears.',
  red: 'A brown working dress with red trim and a flour-dusted apron, red wool stockings, ankle boots; on the estate’s paths, more and more, a kirtle over madder leggings. Her madder-red hooded cloak is still to build.',
  belle: 'A merchant’s daughter’s gown in deep green wool, long-sleeved, pale gold braid at the cuffs and hem, white stockings, heeled shoes.',
  cinderella: 'Found in rags: a soot-grey dress, patched. In the Hall: the maid’s uniform, a russet dress, a clean apron, grey stockings, her own shoes. For her days off, a dress Silas buys her in place of the rags: soft blue linen with a small cream sprig, a navy bodice, pale stockings.',
  gretel: 'A patched brown kirtle cut short for running, over darned leggings; boots taken from somewhere.',
  rapunzel: 'From the tower, an outgrown linen gown, let out and patched. In the garden: a sage dress, a canvas apron, borrowed boots.',
  snow: 'A fine cream gown from her father’s house with a crimson laced bodice, gold braid, white stockings, thin shoes.',
};
for (const id in WARDROBE) { ROSTER[id].wardrobe = WARDROBE[id]; ROSTER[id].period = PERIOD[id]; }
const outfits = id => Object.keys(WARDROBE[id] || {});

// ── Silas ──
// GDD: "Silas Fenwick, Squire of Fenwick Hall": a practical, woodsy man in his mid-to-late 30s (the archetype says 30s to 40s), the third or
// fourth heir of a great-uncle who let the Hall decay. Drafted: his age, his look, and his clothes: a dark wool waistcoat over an undyed linen
// shirt, sleeves rolled; moleskin trousers with a contrast seam; brown boots (Meridian's off-duty henley outfit, which was already a
// frontier woodsman's).
const SQUIRE = {
  id: 'silas', name: 'Silas Fenwick', short: 'Silas', title: 'Squire of Fenwick Hall', role: 'Squire (player)', age: 37,
  gdd: {
    archetype: 'The practical woodsman and reluctant lord. Self-reliant; works with his hands, reads tracks, mends timber, lives simply.',
    claim: 'Squire, not lord of the manor: his authority is informal but locally absolute, by custom and tenancy. Every household in Redmere holds from him.',
    temperament: ['Exacting and economical with words; warmth shows in what he does', 'Immovable once decided, because he checks his reasoning first', 'Dry humour, rare enough to feel earned', 'Takes authority seriously because it is new to him', 'Unimpressed by vanity or excuses; deeply protective once someone is in his care'],
    method: 'Walks his grounds regularly to take stock. Hears an account before he judges, and will not judge where he holds no claim.',
    flaws: ['Rigidity once committed', 'Reading silence as agreement', 'Mistaking competence in a girl for ease'],
    nonExclusive: 'Openly non-exclusive, and says so plainly and early to each woman. Each relationship runs on its own track.',
  },
  look: { skin: '#d6ad8e', hair: '#4a3220', hairStyle: 'tousled', eyes: '#5a6a4a', beard: true },
  build: { mass: 0.68, fat: 0.4 }, h: 1.86,
  own: { top: 'waistcoat', sleeves: 'rolled', tunic: '#3e3428', shirt: '#d8cdb4', print: '#9a7a4a', accent: '#6a5030', trousers: '#4a4234', legs: 'canvas', legAccent: '#2e261c' },
  options: { skin: ['#f0d0b4', '#d6ad8e', '#b88a6a', '#8a5a3e'], hair: ['#161210', '#3a2a20', '#4a3220', '#6a4a2e', '#8a8580'], hairStyle: ['tousled', 'short', 'crop'], build: { lean: [0.45, 0.3], average: [0.6, 0.4], heavy: [0.8, 0.55] } },
};

// ── Everyone else (no corrections: the village and household as the GDD names them; names only where it gives them) ──
const VILLAGE = {
  bakerMother: { label: 'Red’s mother', role: 'Redmere’s baker, widowed', note: 'Hopeful and practical about her daughter’s future; relieved by any protector.' },
  grandmother: { label: 'Red’s grandmother', role: 'Lives in a cottage in the Fenwood, on Silas’s land' },
  goldieFamily: { label: 'Goldie’s family', role: 'Father keeps a working trade in Redmere; mother; younger siblings', note: 'Unseen; reported on by Goldie.' },
  merchant: { label: 'Belle’s father', role: 'A merchant in debt to the estate', note: 'His visits are awkward and transactional at first.' },
  hansel: { label: 'Hansel', role: 'Gretel’s brother; light stable work once he recovers', note: 'His age is not given (open). Never part of a correction.' },
  gothel: { label: 'Gothel', role: 'The gatehouse tower’s tenant, evicted for unlawful confinement', note: 'Antagonist, Ch. 6.' },
  stepmotherC: { label: 'Eleanor’s stepmother', role: 'Pockets the wages paid for Eleanor’s work', note: 'With two stepsisters. Confronted at the village border, Ch. 4.' },
  stepmotherS: { label: 'Snow White’s stepmother', role: 'Of a great house in the neighbouring parish', note: 'Her agents close in; she brings bailiffs to challenge the estate’s title in the finale.' },
  vicar: { label: 'The vicar', role: 'Redmere’s parson', note: 'Disapproves of Silas’s open non-exclusivity, and says so.' },
  alewife: { label: 'The alewife', role: 'Keeps Redmere’s alehouse' },
  reeve: { label: 'The reeve', role: 'Redmere’s reeve' },
  woodcutters: { label: 'The woodcutters and charcoal burners', role: 'Work the timberline on Silas’s land', note: 'Hand Snow White over to him, Ch. 7.' },
  greatUncle: { label: 'The great-uncle', role: 'The previous owner, dead', note: 'Shut himself up in the Hall and let it decay in grief; the West Wing holds his last years.' },
};

const pronouns = () => ({ they: 'she', them: 'her', their: 'her', They: 'She' });
// A heroine as a figure (all seven are women: the engine's other translation isn't used), in one of her outfits (her usual by default).
function figureSpec(id, sex, outfit) {
  const r = ROSTER[id], L = r.look, W = WARDROBE[id], key = W[outfit] ? outfit : outfits(id)[0];
  return { who: id, sex: 'f', height: r.body.h.f, mass: r.body.mass, fat: r.body.fat, skin: L.skin, hair: L.hair, hairStyle: L.hairStyle, hairCap: L.hairCap, braidLen: L.braidLen, ribbon: L.ribbon,
    eyes: L.eyes, lips: L.lips || null, beard: false, outfit: 'period', period: W[key], periodKey: key, dept: W[key].trim, bust: r.body.bust };
}
function squireSpec(c) {
  c = Object.assign({ skin: SQUIRE.look.skin, hair: SQUIRE.look.hair, hairStyle: SQUIRE.look.hairStyle, build: null, beard: true }, c || {});
  const [mass, fat] = c.build ? SQUIRE.options.build[c.build] || [SQUIRE.build.mass, SQUIRE.build.fat] : [SQUIRE.build.mass, SQUIRE.build.fat];
  return { sex: 'm', height: SQUIRE.h, mass, fat, skin: c.skin, hair: c.hair, hairStyle: c.hairStyle, eyes: SQUIRE.look.eyes, beard: c.beard !== false,
    outfit: c.outfit === 'none' || c.outfit === 'night' ? c.outfit : 'offduty', dept: SQUIRE.own.accent, off: SQUIRE.own, bust: 0.45, size: 1 };
}
// How much she squirms under a correction, 0 (stoic) – 1: the smaller she is the more (her height against the household's and her mass), and
// the more pain she can take, a little the less (as Meridian's crew). body.wriggle, where given, overrides it.
const H_SPAN = [1.55, 1.75];
function wriggle(id) {
  const r = ROSTER[id]; if (!r) return 0.5; if (r.body.wriggle != null) return r.body.wriggle;
  const hn = Math.max(0, Math.min(1, (r.body.h.f - H_SPAN[0]) / (H_SPAN[1] - H_SPAN[0]))), size = 0.4 * hn + 0.6 * r.body.mass, tol = r.pain.tolerance;
  return Math.max(0.15, Math.min(1, 1.15 - size - 0.5 * (tol - 0.5)));
}
// Voice pitch for the babble and cries (Hz).
const PITCH = { silas: 118, goldie: 222, red: 210, belle: 200, cinderella: 206, gretel: 214, rapunzel: 226, snow: 230 };
const pitch = id => PITCH[id] || 208;

const api = { METERS, ROSTER, IDS, SQUIRE, VILLAGE, WARDROBE, PERIOD, OUTFIT_NOTES, outfits, pronouns, figureSpec, squireSpec, pitch, wriggle };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Cast = api;
})(typeof window !== 'undefined' ? window : globalThis);
