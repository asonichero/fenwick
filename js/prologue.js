// Fenwick Hall — the prologue, The True Bride: its scenes as scripts, for the cutscene player (js/cutscene.js).
//
// A scene: where it's played (room), the cards told over black before it, who's in it and how each starts (cast: seated in a chair, standing
// at a mark, or off till an act brings them on), what each is called (names: what the player knows them by, till a line says otherwise), the
// shots its camera cuts between, and its beats, in order. A beat is any of:
//   shot: 'name'            cut to that shot (glide: ms, to move there instead; push: 'name', then drift slowly on toward that one)
//   who, text, face, to     a line: who says it, the face they say it with, who they say it to (their head turns that way; the rest look at
//                           the speaker). Without a `to`, they speak to the table.
//   listen: { id: face }    the others' faces as it's said
//   look: { id: id|'down'|null }  heads turned to someone, or down (null: back to where they'd look anyway); kept till changed
//   act: 'name'             something done (adelaIn, nod, sonRises, sonToAdela, bow), shot and played before the line, if any
//   name: { id: 'Name' }    from here on, called this (the reveal)
//   pause: ms               held a moment, no line
//   end: true               the scene's over: fade to black
// Shots are given from someone's place: the camera and what it looks at in that person's own frame (x to their left, y up, z ahead of them),
// so they follow the room's layout as it's edited (rooms.html); `at` instead of `from` places them in the room itself.
//
//   Prologue.SCENES.hall · Prologue.shot(scene, name, spots) → { cam, look } · Prologue.speakers(scene)
(function (root) {
'use strict';

const HALL = {
  id: 'hall', room: 'hall', title: 'The false bride’s sentence',
  cards: [
    { big: 'Thornleigh', small: 'Some years before Fenwick Hall' },
    { text: 'Silas Fenwick manages Thornleigh’s lands and people for its master. He is trusted for his judgement. The final say is not his.' },
    { text: 'Tonight the master dines with his son, and with the bride his son was promised. A goose girl has been sent for, to wait at table.' },
  ],
  // (seat: the chair at the hall's spot of that name; mark: standing on it; off: out of sight till an act brings them on; arms: how they're held)
  cast: {
    master: { spec: ['man', 'master'], seat: 'master', face: 'calm' },
    heir: { spec: ['man', 'heir'], seat: 'son', face: 'calm' },
    cicely: { spec: ['her', 'cicely', 'gown'], seat: 'cicely', face: 'haughty' },
    silas: { spec: ['silas'], mark: 'silas', face: 'calm', arms: 'rest' },
    adela: { spec: ['her', 'adela', 'goose'], mark: 'adela', off: true, face: 'shy', arms: 'clasp', demure: true },      // (demure: her eyes down, but for whoever speaks to her)
  },
  names: { master: 'The master', heir: 'The young lord', cicely: 'The bride', adela: 'The goose girl', silas: 'Silas' },
  shots: {
    foot: { at: true, cam: [0, 2.3, 6.4], look: [0, 1.0, -3.2] },
    footIn: { at: true, cam: [0, 1.95, 2.4], look: [0, 1.0, -3.4] },
    head: { from: 'silas', cam: [2.0, 1.9, -1.0], look: [-0.6, 1.0, 1.75] },           // (over Silas's shoulder, the head of the table)
    master: { from: 'master', cam: [0.55, 1.4, 1.6], look: [0, 1.15, 0] },
    bride: { from: 'cicely', cam: [-0.5, 1.35, 1.6], look: [0, 1.12, 0] },
    silas: { from: 'silas', cam: [0.6, 1.45, 1.6], look: [0, 1.55, 0] },
    arch: { from: 'adela', cam: [1.9, 1.55, 2.65], look: [0, 1.2, -0.35] },          // (from the table, the archway, her coming through it)
    adela: { from: 'adela', cam: [0.9, 1.5, 1.65], look: [0, 1.45, 0] },
    pair: { from: 'adela', cam: [2.35, 1.5, 0.45], look: [0, 1.32, 0.42] },          // (the young lord before her, side on)
    bow: { from: 'silas', cam: [1.4, 1.45, 2.1], look: [0, 1.2, 0.2] },
  },
  beats: [
    { shot: 'foot', push: 'footIn', ms: 11000 },
    { pause: 1400 },
    // (Cicely playing the great lady, and enjoying it: the house's food, its servants, its steward, all beneath her)
    { who: 'cicely', to: 'master', face: 'haughty', text: 'The venison was a little dry, sir. At my father’s table, a cook who sent it up so would be turned off without a character.' },
    { who: 'master', to: 'cicely', face: 'calm', text: 'We’re slower to turn people off at Thornleigh, my dear. You may come to be glad of it.' },
    { shot: 'head' },
    { who: 'master', to: 'silas', face: 'calm', text: 'Is the girl come to pour?' },
    { who: 'silas', to: 'master', face: 'calm', text: 'She’s at the door, sir.' },
    { act: 'adelaIn', shot: 'arch' },
    { who: 'master', to: 'adela', face: 'calm', text: 'Come in, child. Stand by till you’re wanted.', listen: { adela: 'shy' } },
    { shot: 'bride', who: 'cicely', to: 'master', face: 'pout', look: { cicely: 'adela' }, text: 'Must it be that one, sir? She’s slow, and she brings the yard in with her.' },
    { shot: 'master', who: 'master', to: 'cicely', face: 'calm', text: 'She’ll do very well where she is.', look: { cicely: null } },
    { act: 'nod', who: 'master', to: 'silas', face: 'calm', text: 'Now, Silas. You had a matter for us, you said.' },
    { shot: 'bride', who: 'cicely', to: 'master', face: 'pout', text: 'Must we have the steward’s business at table, sir? It’s been a long dinner.' },
    { shot: 'head', who: 'master', to: 'cicely', face: 'calm', text: 'Indulge an old man, my dear. You’ll be mistress here, and asked to judge such things. Let us see how you would.' },
    { shot: 'bride', who: 'cicely', to: 'silas', face: 'haughty', text: 'Very well. Go on, then. Silas, is it?' },
    // (the case: a trade quarrel from a neighbouring estate, near enough her own story to be it, and dull enough that she doesn't listen for it)
    { shot: 'silas', who: 'silas', to: 'cicely', face: 'calm', text: 'It is, my lady. A case brought me by a neighbouring estate. They’d have Thornleigh’s judgement on it.' },
    { who: 'silas', face: 'calm', text: 'A farrier of some name was engaged to a great house, a long ride off. He set out with his apprentice, and his old grey mare.' },
    { who: 'silas', face: 'calm', text: 'On the road the apprentice took his master’s letter and his good coat, and went on ahead. At the gate he gave himself out as the farrier, and they took him in as one.' },
    { who: 'silas', face: 'calm', text: 'When the farrier came after, the apprentice had him put to muck out the stables. And the old mare, that knew her master, he sold at the first fair, so she couldn’t give him away.' },
    { shot: 'adela', look: { adela: 'silas' }, listen: { adela: 'concerned' }, pause: 1600 },
    { shot: 'silas', who: 'silas', to: 'cicely', face: 'calm', text: 'What should be done with such a man?', look: { adela: null } },
    { shot: 'bride', who: 'cicely', to: 'silas', face: 'haughty', text: 'A servant who’d make himself his master? There’s nothing to weigh.' },
    { who: 'cicely', to: 'master', face: 'defiant', text: 'Strip him of all he took, to the last stitch. Have him soundly thrashed for his lies, and turn him out of doors with nothing.' },
    { who: 'cicely', to: 'master', face: 'haughty', text: 'That is how my father would deal with it.' },
    { shot: 'master', pause: 900 },
    { who: 'master', to: 'cicely', face: 'stern', text: 'You have named your own sentence.' },
    { shot: 'bride', who: 'cicely', to: 'master', face: 'surprised', text: 'Sir?' },
    // (the master translates it, piece by piece, to her face)
    { shot: 'master', who: 'master', to: 'cicely', face: 'stern', text: 'The farrier was no farrier, and no man. She was a lady, sent here to marry my son. The apprentice was her waiting-maid.' },
    { who: 'master', to: 'cicely', face: 'stern', text: 'The letter was her name. The good coat was a gown.' },
    { shot: 'bride', who: 'master', to: 'cicely', face: 'stern', text: 'That gown.', look: { cicely: 'down' }, listen: { cicely: 'wince' } },
    { shot: 'master', who: 'master', to: 'cicely', face: 'stern', text: 'The stables were my goose-yard.', look: { cicely: null } },
    { shot: 'adela', who: 'master', to: 'cicely', face: 'stern', text: 'And the mare that knew her mistress, and was sold so she couldn’t tell, was called Falada.', look: { adela: 'master' }, listen: { adela: 'surprised' } },
    { shot: 'master', who: 'master', to: 'cicely', face: 'stern', text: 'Your name is Cicely.', name: { cicely: 'Cicely' }, look: { adela: null } },
    { shot: 'adela', who: 'master', to: 'adela', face: 'soft', text: 'And hers is Adela.', name: { adela: 'Adela' } },
    { who: 'adela', to: 'master', face: 'surprised', text: 'Sir… I swore I would tell no living soul.' },
    { who: 'master', to: 'adela', face: 'soft', text: 'And you told none. You told an old iron stove, and Silas was on the other side of the wall.', listen: { adela: 'teary' } },
    { look: { adela: 'silas' }, pause: 1200 },
    { shot: 'bride', who: 'cicely', to: 'heir', face: 'wince', text: 'My lord, you’ll not take a goose girl’s word over mine. Over your own bride’s!' },
    { shot: 'head', act: 'sonRises', look: { adela: null }, pause: 1100 },
    { act: 'sonToAdela', shot: 'pair', who: 'heir', to: 'adela', face: 'concerned', text: 'Lady. You’ve been a month with the geese under my own roof, and I never once looked at you.' },
    { who: 'heir', to: 'adela', face: 'tender', text: 'Forgive me. You’ll be treated as you should have been from the first, and better, to make amends.' },
    { who: 'adela', to: 'heir', face: 'teary', text: 'My lord…' },
    { shot: 'master', who: 'master', to: 'silas', face: 'stern', text: 'Silas.' },
    { shot: 'silas', who: 'silas', to: 'master', face: 'calm', text: 'Sir.' },
    { shot: 'master', who: 'master', to: 'silas', face: 'stern', text: 'She has named her sentence. Take her to your office, and see it carried out.' },
    { shot: 'bride', who: 'cicely', to: 'silas', face: 'crying', text: 'No — sir, please —' },
    { shot: 'bow', act: 'bow', pause: 1700 },
    { end: true },
  ],
  next: { title: 'His terms', where: 'Silas’s office, off the yard' },
};

const SCENES = { hall: HALL };

// A shot, in the room: its camera and the point it looks at ([x, y, z] each), from the spots (the hall's spots(): { id: { at, yaw } }).
function shot(scene, name, spots) {
  const s = scene.shots[name]; if (!s) return null;
  if (s.at) return { cam: s.cam.slice(), look: s.look.slice() };
  const p = spots[s.from], c = Math.cos(p.yaw || 0), n = Math.sin(p.yaw || 0), at = p.at;
  const W = ([x, y, z]) => [at.x + x * c + z * n, y, at.z - x * n + z * c];
  return { cam: W(s.cam), look: W(s.look) };
}
// Everyone who says anything in it, and everyone it names.
const speakers = scene => [...new Set(scene.beats.filter(b => b.who).map(b => b.who))];

root.Prologue = { SCENES, shot, speakers };
})(typeof window !== 'undefined' ? window : globalThis);
