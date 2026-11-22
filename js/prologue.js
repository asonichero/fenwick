// Fenwick Hall — the prologue, The True Bride: its scenes as scripts, for the cutscene player (js/cutscene.js).
//
// A scene: where it's played (room), the cards told over black before it, who's in it and how each starts (cast: seated in a chair, standing
// at a mark, or off till an act brings them on), what each is called (names: what the player knows them by, till a line says otherwise), the
// shots its camera cuts between, and its beats, in order. A beat is any of:
//   shot: 'name'            cut to that shot (glide: ms, to move there instead; push: 'name', then drift slowly on toward that one)
//   who, text, face, to     a line: who says it, the face they say it with, who they say it to (their head turns that way; the rest look at
//                           the speaker). Without a `to`, they speak to the table.
//   listen: { id: face }    the others' faces as it's said
//   look: { id: id|null }   heads turned (null: back to where they'd look anyway); kept till changed
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
    cicely: { spec: ['her', 'cicely', 'gown'], seat: 'cicely', face: 'smile' },
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
    { who: 'cicely', to: 'master', face: 'smile', text: 'I could grow used to such a table, sir.' },
    { who: 'master', to: 'cicely', face: 'calm', text: 'I hope you may have the chance, my dear.' },
    { shot: 'head' },
    { who: 'master', to: 'silas', face: 'calm', text: 'Is the girl come to pour?' },
    { who: 'silas', to: 'master', face: 'calm', text: 'She’s at the door, sir.' },
    { act: 'adelaIn', shot: 'arch' },
    { who: 'master', to: 'adela', face: 'calm', text: 'Come in, child. Stand by till you’re wanted.', listen: { adela: 'shy' } },
    { shot: 'bride', look: { cicely: 'adela' }, listen: { cicely: 'cheeky' }, pause: 1500 },
    { shot: 'master', act: 'nod', who: 'master', to: 'silas', face: 'calm', text: 'Now, Silas. You’ve a matter to put to us, you said. Put it.', look: { cicely: null } },
    { shot: 'silas', who: 'silas', to: 'master', face: 'calm', text: 'A case brought to me by a neighbouring estate, sir. They’d have our judgement on it.' },
    { who: 'silas', face: 'calm', text: 'A journeyman was sent with his master’s son to a new place. On the road he took the son’s coat and his papers, and swore him to silence.' },
    { who: 'silas', face: 'calm', text: 'At the journey’s end he was received as the son. The son was set to herd swine.' },
    { shot: 'adela', look: { adela: 'silas' }, listen: { adela: 'concerned' }, pause: 1600 },
    { shot: 'silas', who: 'silas', to: 'cicely', face: 'calm', text: 'What should be done with such a man?', look: { adela: null } },
    { shot: 'head', who: 'master', to: 'cicely', face: 'calm', text: 'You’ve a quick mind, my dear. What would you say?' },
    { shot: 'bride', who: 'cicely', to: 'silas', face: 'cheeky', text: 'Why, that’s simple. Strip him of everything he took, to the last stitch, and have him soundly thrashed for his lies.' },
    { who: 'cicely', to: 'master', face: 'defiant', text: 'Then turn him out of doors with nothing. It’s no more than he deserves.' },
    { shot: 'master', pause: 900 },
    { who: 'master', to: 'cicely', face: 'stern', text: 'You have named your own sentence.' },
    { shot: 'bride', who: 'cicely', to: 'master', face: 'surprised', text: 'Sir?' },
    { shot: 'master', who: 'master', to: 'cicely', face: 'stern', text: 'You came into my house as my son’s bride. You are her waiting-maid. Your name is Cicely.', name: { cicely: 'Cicely' } },
    { who: 'master', to: 'cicely', face: 'stern', text: 'You took her gown and her name on the road, and had her sent out to the geese.', listen: { cicely: 'wince' } },
    { shot: 'adela', who: 'master', to: 'adela', face: 'soft', text: 'Her name is Adela.', name: { adela: 'Adela' }, listen: { adela: 'surprised' } },
    { who: 'adela', to: 'master', face: 'surprised', text: 'Sir… I swore I would tell no living soul.' },
    { who: 'master', to: 'adela', face: 'soft', text: 'And you told none. You told an old iron stove, and Silas was on the other side of the wall.', listen: { adela: 'teary' } },
    { look: { adela: 'silas' }, pause: 1200 },
    { shot: 'bride', who: 'cicely', to: 'heir', face: 'wince', text: 'My lord, it isn’t so — you can’t believe a goose girl over me —' },
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
