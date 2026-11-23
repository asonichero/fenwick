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
//   act: 'name'             something done (adelaIn, nod, plead, sonRises, sonToAdela, kneel, bow; and for any scene, by someone (by): walk a
//                           path of spots, sit at a seat, stand, turned toward someone or a spot; door to: 0 or 1; unlace), shot and played
//                           before the line, if any (wait: false: while it's said)
//   choose: { key, prompt, hint, options: [{ id, label, text, beats }] }   the player's choice of what Silas says; its beats play, and it's kept
//   name: { id: 'Name' }    from here on, called this (the reveal). In any text or name, {first} and {last} are the player's (js/player.js)
//   pause: ms               held a moment, no line
//   end: true               the scene's over: fade to black
// Shots are given from someone's place: the camera and what it looks at in that person's own frame (x to their left, y up, z ahead of them),
// so they follow the room's layout as it's edited (rooms.html); `at` instead of `from` places them in the room itself.
//
//   Prologue.SCENES.hall, .office · Prologue.ORDER (the scenes, in the order they're played) · Prologue.shot(scene, name, spots) → { cam, look }
//   · Prologue.speakers(scene)
(function (root) {
'use strict';

const HALL = {
  id: 'hall', room: 'hall', title: 'The false bride’s sentence',
  // (told over black, before it; the second asks the player's name: {first} and {last} in the script are theirs)
  cards: [
    { big: 'Thornleigh', small: 'Some years before Redmere' },
    { text: 'You manage Thornleigh’s lands and people for its master. You are trusted for your judgement, but the final say is your master’s.', ask: 'name' },
  ],
  // (seat: the chair at the hall's spot of that name; mark: standing on it; off: out of sight till an act brings them on; arms: how they're held)
  cast: {
    master: { spec: ['man', 'master'], seat: 'master', face: 'calm' },
    heir: { spec: ['man', 'heir'], seat: 'son', face: 'calm', look: 'hisPlate' },      // (look: where his eyes are kept, not on whoever speaks)
    cicely: { spec: ['her', 'cicely', 'gown'], seat: 'cicely', face: 'haughty' },
    silas: { spec: ['silas'], mark: 'silas', face: 'calm', arms: 'rest' },
    adela: { spec: ['her', 'adela', 'goose'], mark: 'adela', off: true, face: 'shy', arms: 'clasp', demure: true, gaitRate: 0.85 },      // (demure: her eyes down, but for whoever speaks to her)
  },
  names: { master: 'Thornleigh', heir: 'Young Thornleigh', cicely: 'The Bride', adela: 'The goose girl', silas: '{first}' },
  // (things to look at, from someone's place: x to their left, y up, z ahead)
  points: { hisPlate: { from: 'son', at: [0.02, 0.78, 0.5] } },
  shots: {
    foot: { at: true, cam: [0, 2.3, 6.4], look: [0, 1.0, -3.2] },
    footIn: { at: true, cam: [0, 1.95, 2.4], look: [0, 1.0, -3.4] },
    head: { from: 'silas', cam: [2.0, 1.9, -1.0], look: [-0.6, 1.0, 1.75] },           // (over Silas's shoulder, the head of the table)
    master: { from: 'master', cam: [0.55, 1.4, 1.6], look: [0, 1.15, 0] },
    bride: { from: 'cicely', cam: [-0.5, 1.35, 1.6], look: [0, 1.12, 0] },
    silas: { from: 'silas', cam: [0.6, 1.45, 1.6], look: [0, 1.55, 0] },
    arch: { from: 'adela', cam: [1.9, 1.55, 2.65], look: [0, 1.2, -0.35] },          // (from the table, the archway, her coming through it)
    adela: { from: 'adela', cam: [0.9, 1.5, 1.65], look: [0, 1.45, 0] },
    pair: { from: 'adela', cam: [2.35, 1.5, 0.45], look: [0, 1.32, 0.42] },          // (Young Thornleigh before her, side on)
    plea: { from: 'son', cam: [0.45, 1.45, 0.95], look: [-0.5, 1.0, 0.07] },         // (from the table, past him: Cicely turned to him, her hand on his arm)
    rebuff: { from: 'son', cam: [-0.75, 1.5, 1.95], look: [-0.05, 1.4, 0.1] },       // (from across the table: him standing over her, her in her chair)
    kneel: { from: 'adela', cam: [2.6, 1.0, 0.45], look: [0, 0.78, 0.45] },           // (side on and lower: him on one knee, her hand in his)
    bow: { from: 'silas', cam: [1.4, 1.45, 2.1], look: [0, 1.2, 0.2] },
  },
  beats: [
    { shot: 'foot', push: 'footIn', ms: 11000 },
    { pause: 1400 },
    // (Cicely playing the great lady, and enjoying it: the house's food, its servants, its steward, all beneath her)
    { who: 'cicely', to: 'master', face: 'haughty', text: 'The venison was a little dry, sir. At my father’s table, a cook who sent it up so would be turned off without a character.' },
    { who: 'master', to: 'cicely', face: 'calm', text: 'We’re slower to turn people off at Thornleigh, my dear. You may come to be glad of it.' },
    { shot: 'head' },
    // (Young Thornleigh's eyes, through it: his plate while she finds fault, his father, Silas through the case; Adela once she's named; Cicely
    // not once, till she turns to him)
    { who: 'master', to: 'silas', face: 'calm', text: 'Is the girl come to pour?', look: { heir: 'master' } },
    { who: 'silas', to: 'master', face: 'calm', text: 'She’s at the door, sir.' },
    { act: 'adelaIn', shot: 'arch', look: { heir: 'hisPlate' } },
    { who: 'master', to: 'adela', face: 'calm', text: 'Come in, child. Stand by till you’re wanted.', listen: { adela: 'shy' } },
    { shot: 'bride', who: 'cicely', to: 'master', face: 'pout', look: { cicely: 'adela' }, text: 'Must it be that one, sir? She was always slow, and she brings the yard in with her.' },
    { shot: 'master', who: 'master', to: 'cicely', face: 'calm', text: 'She’ll do very well where she is.', look: { cicely: null } },
    { act: 'nod', who: 'master', to: 'silas', face: 'calm', text: 'Now, {first}. You had a matter for us, you said.', look: { heir: 'master' } },
    { shot: 'bride', who: 'cicely', to: 'master', face: 'pout', text: 'Must we have the steward’s business at table, sir? It’s been a long dinner.' },
    { shot: 'head', who: 'master', to: 'cicely', face: 'calm', text: 'Indulge an old man, my dear. You’ll be mistress here, and asked to judge such things. Let us see how you would.' },
    { shot: 'bride', who: 'cicely', to: 'silas', face: 'haughty', text: 'Very well. Go on, then. {first}, is it?' },
    // (the case: a trade quarrel from a neighbouring estate, near enough her own story to be it, and dull enough that she doesn't listen for it)
    { shot: 'silas', who: 'silas', to: 'cicely', face: 'calm', text: 'It is, my lady. A case brought me by a neighbouring estate. They’d have Thornleigh’s judgement on it.', look: { heir: 'silas' } },
    { who: 'silas', face: 'calm', text: 'A farrier of some name was engaged to a great house, a long ride off. He set out with his apprentice, and his old grey mare.' },
    { who: 'silas', face: 'calm', text: 'On the road the apprentice took his master’s letter and his good coat, and went on ahead. At the gate he gave himself out as the farrier, and they took him in as one.' },
    { who: 'silas', face: 'calm', text: 'When the farrier came after, the apprentice had him put to muck out the stables. And the old mare, that knew her master, he sold at the first fair, so she couldn’t give him away.' },
    { shot: 'adela', look: { adela: 'silas' }, listen: { adela: 'concerned' }, pause: 1600 },
    { shot: 'silas', who: 'silas', to: 'cicely', face: 'calm', text: 'What should be done with such a man?', look: { adela: null } },
    { shot: 'bride', who: 'cicely', to: 'silas', face: 'haughty', text: 'A servant who’d make himself his master? There’s nothing to weigh.', look: { heir: 'master' } },
    { who: 'cicely', to: 'master', face: 'defiant', text: 'Strip him of all he took, to the last stitch. Have him soundly thrashed for his lies, and turn him out of doors with nothing.' },
    { who: 'cicely', to: 'master', face: 'haughty', text: 'That is how my father would deal with it.' },
    { shot: 'master', pause: 900 },
    { who: 'master', to: 'cicely', face: 'stern', text: 'Then you have named your own sentence.' },
    { shot: 'bride', who: 'cicely', to: 'master', face: 'surprised', text: 'Sir?' },
    // (the master translates it, piece by piece, to her face)
    { shot: 'master', who: 'master', to: 'cicely', face: 'stern', text: 'The farrier was no farrier, and no man. She was a lady, sent here to marry my son. The apprentice was her waiting-maid.' },
    { who: 'master', to: 'cicely', face: 'stern', text: 'The letter was her name. The good coat was a gown.' },
    { shot: 'bride', who: 'master', to: 'cicely', face: 'stern', text: 'That gown.', look: { cicely: 'down' }, listen: { cicely: 'wince' } },
    { shot: 'master', who: 'master', to: 'cicely', face: 'stern', text: 'The stables were my goose-yard.', look: { cicely: null } },
    { shot: 'adela', who: 'master', to: 'cicely', face: 'stern', text: 'And the mare that knew her mistress, and was sold so she couldn’t tell, was called Falada.', look: { adela: 'master' }, listen: { adela: 'surprised' } },
    { shot: 'master', who: 'master', to: 'cicely', face: 'stern', text: 'Your name is Cicely.', name: { cicely: 'Cicely' }, look: { adela: null } },
    { shot: 'adela', who: 'master', to: 'adela', face: 'soft', text: 'And hers is Adela.', name: { adela: 'Adela' }, look: { heir: 'adela' } },
    { who: 'adela', to: 'master', face: 'surprised', text: 'Sir… I swore I would tell no living soul.' },
    { who: 'master', to: 'adela', face: 'soft', text: 'And you told none. You told an old iron stove, and {first} was on the other side of the wall.', listen: { adela: 'teary' } },
    { look: { adela: 'silas' }, pause: 1200 },
    // (to Young Thornleigh, turned to him in her chair, her hand on his arm; he doesn't look at her, but at Adela)
    { shot: 'plea', act: 'plead', who: 'cicely', to: 'heir', face: 'wince', look: { heir: 'cicely' }, text: 'My lord, you’ll not take a goose girl’s word over mine. Over your own bride’s!' },
    // (he gets up, and answers her before he goes to Adela)
    { shot: 'rebuff', act: 'sonRises', look: { adela: null } },
    { who: 'heir', to: 'cicely', face: 'stern', text: 'You were never my bride. I’ll not hear you call yourself so again.', listen: { cicely: 'sad' } },
    { look: { heir: 'adela', cicely: 'down' }, pause: 900 },
    { act: 'sonToAdela', shot: 'pair', who: 'heir', to: 'adela', face: 'concerned', text: 'Lady. You’ve been a month with the geese under my own roof, and I never once looked at you.' },
    { act: 'kneel', shot: 'kneel', who: 'heir', to: 'adela', face: 'tender', text: 'Forgive me. You’ll be treated as you should have been from the first, and better, to make amends.', look: { heir: null, cicely: null } },
    { who: 'adela', to: 'heir', face: 'teary', text: 'My lord…' },
    { shot: 'master', who: 'master', to: 'silas', face: 'stern', text: '{first}.' },
    { shot: 'silas', who: 'silas', to: 'master', face: 'calm', text: 'Sir.' },
    { shot: 'master', who: 'master', to: 'silas', face: 'stern', text: 'She has named her sentence. Take her to your office, and see it carried out.' },
    { shot: 'bride', who: 'cicely', to: 'silas', face: 'crying', text: 'No — sir, please —' },
    { shot: 'bow', act: 'bow', pause: 1700 },
    { end: true },
  ],
  next: { title: 'Your terms', where: 'Your office, off the yard' },      // (what follows, if the game stops here)
};

// ── The confrontation: his office, off the yard, the same evening. The door shut on them; her plea, light and practised; his questions, till
// she sees what she did and says it, and concedes the sentence; then he relents (not the thrashing she named, but she'll learn), and gives
// her the word, the mare's name; she accepts; and the gown, first: it was never hers. Then black, and the correction (to be built) ──
const OFFICE = {
  id: 'office', room: 'office', title: 'His terms',
  start: { door: 1 },      // (the door open as it begins: he shuts it)
  cast: {
    silas: { spec: ['silas'], mark: 'door', face: 'stern' },
    cicely: { spec: ['her', 'cicely', 'gown'], mark: 'cicely', face: 'concerned', arms: 'clasp', look: 'silas' },
  },
  names: { silas: '{first}', cicely: 'Cicely' },
  shots: {
    room: { at: true, cam: [-1.9, 2.1, -2.15], look: [0.6, 1.0, 0.9] },            // (from the corner behind the desk: the room, the door)
    desk: { from: 'cicely', cam: [-0.35, 1.55, -0.7], look: [0, 1.1, 1.65] },        // (over her shoulder: him at his desk)
    her: { from: 'silas', cam: [0.75, 1.5, -0.35], look: [-0.05, 1.4, 1.66] },        // (past his shoulder, from behind the desk: her before it)
    him: { from: 'silas', cam: [0.3, 1.3, 1.35], look: [0, 1.12, 0.05] },
    close: { from: 'cicely', cam: [0.35, 1.5, 1.25], look: [0, 1.42, 0] },
    rise: { from: 'cicely', cam: [2.0, 1.8, -1.15], look: [-0.4, 1.0, 0.95] },        // (from the fire side: him getting up, coming round)
    two: { from: 'cicely', cam: [1.1, 1.55, 1.5], look: [-0.22, 1.38, 0.22] },         // (from the desk's end: her face, him side on to her)
    gown: { from: 'cicely', cam: [0.55, 1.5, 0.8], look: [0, 1.2, 0] },              // (close, from the desk: her hands at her lacing)
  },
  beats: [
    { shot: 'room', act: 'door', by: 'silas', to: 0, ms: 1200 },
    { pause: 400 },
    // (he goes round to his chair; she starts while he does, light, practised)
    { act: 'walk', by: 'silas', path: ['door', 'deskSE', 'deskNE', 'chairSide'], toward: 'silas', wait: false, who: 'cicely', to: 'silas', face: 'smile',
      text: 'Mr {last}. You’re a sensible man; everyone says so. We needn’t make so much of a story told at supper.' },
    { act: 'sit', by: 'silas', at: 'silas', shot: 'her', who: 'cicely', to: 'silas', face: 'smile', text: 'Let me go tonight, quietly, and no one need see me again. You could tell your master it was done.' },
    // (the prologue's one choice: how he answers her. It's remembered; it sets how she meets her correction)
    { choose: { key: 'tone', prompt: 'How do you answer her?', hint: 'How you answer sets how she meets her correction.', options: [
      { id: 'firm', label: 'Firm', text: 'No. You’ll stand there and answer me.', beats: [
        { shot: 'him', who: 'silas', to: 'cicely', face: 'stern', text: 'No. You’ll stand there and answer me.' }, { shot: 'close', who: 'cicely', to: 'silas', face: 'defiant', text: '…As you like.' }] },
      { id: 'dry', label: 'Dry', text: 'And tell him what? That I walked you to the gate and wished you well?', beats: [
        { shot: 'him', who: 'silas', to: 'cicely', face: 'calm', text: 'And tell him what? That I walked you to the gate and wished you well? No.' }, { shot: 'close', who: 'cicely', to: 'silas', face: 'pout', text: 'There’s no call to be clever.' }] },
      { id: 'gentle', label: 'Gentle', text: 'It isn’t mine to give. But I’ll hear you, if you’ll talk to me plainly.', beats: [
        { shot: 'him', who: 'silas', to: 'cicely', face: 'caring', text: 'It isn’t mine to give. But I’ll hear you, if you’ll talk to me plainly.' }, { shot: 'close', who: 'cicely', to: 'silas', face: 'cheeky', text: 'Then you’ll see it was nothing. A game, at supper.' }] },
    ] } },
    // (his questions: short, one at a time, till she answers them truly)
    { shot: 'him', who: 'silas', to: 'cicely', face: 'calm', text: 'What did you take from her?' },
    { shot: 'close', who: 'cicely', to: 'silas', face: 'defiant', text: 'A gown. She has others.' },
    { shot: 'him', who: 'silas', to: 'cicely', face: 'calm', text: 'What else?' },
    { shot: 'close', who: 'cicely', to: 'silas', face: 'pout', text: '…Her place at table, I suppose.' },
    { shot: 'him', who: 'silas', to: 'cicely', face: 'stern', text: 'And her name. And her mare.' },
    { shot: 'close', who: 'cicely', to: 'silas', face: 'defiant', text: 'It was a horse. Horses are sold every day.' },
    { shot: 'him', who: 'silas', to: 'cicely', face: 'calm', text: 'Why that one?' },
    { shot: 'close', look: { cicely: 'down' }, pause: 1300 },
    { who: 'cicely', to: 'silas', face: 'wince', text: '…Because the mare knew her.' },
    { shot: 'him', who: 'silas', to: 'cicely', face: 'calm', text: 'How long was she out with the geese?', look: { cicely: null } },
    { shot: 'close', who: 'cicely', to: 'silas', face: 'sad', text: 'A month. Near enough.', look: { cicely: 'down' } },
    { shot: 'him', who: 'silas', to: 'cicely', face: 'calm', text: 'Sleeping where?', look: { cicely: null } },
    { shot: 'close', who: 'cicely', to: 'silas', face: 'wince', text: '…The loft over the goose house.' },
    { shot: 'him', who: 'silas', to: 'cicely', face: 'stern', text: 'And if no one had heard her at the stove? How long then?' },
    { shot: 'close', pause: 1600, look: { cicely: 'down' } },
    { who: 'cicely', to: 'silas', face: 'teary', text: '…As long as I could keep it.' },
    { shot: 'her', who: 'silas', to: 'cicely', face: 'stern', text: 'Say what you did. All of it, in your own words.', look: { cicely: null } },
    // (and she does: the weight of it, at last; and concedes the sentence, and that he must do as he's bid)
    { shot: 'close', who: 'cicely', to: 'silas', face: 'crying', text: 'I took her gown and her name, and the man she was promised to. I had her put out with the geese, and her mare sold so no one would know her.' },
    { who: 'cicely', to: 'silas', face: 'crying', text: 'And I’d have left her there. And tonight I said what such a one deserved, and I meant every word.' },
    { who: 'cicely', to: 'silas', face: 'sad', text: 'I named the sentence. And you’ve been bid to carry it out. I know you must.' },
    // (he relents: gets up, comes round the desk to her)
    { shot: 'rise', act: 'stand', by: 'silas', at: 'chairSide', toward: 'cicely', pause: 300 },
    { act: 'walk', by: 'silas', path: ['chairSide', 'deskNE', 'deskSE', 'near'], toward: 'cicely' },
    { shot: 'two', who: 'silas', to: 'cicely', face: 'caring', text: 'I’ll not thrash you, as you put it.' },
    { who: 'silas', to: 'cicely', face: 'calm', text: 'But you’ll learn your lesson, here, tonight, at my hand, if you want this house to give you a character when you leave it.' },
    { shot: 'close', who: 'cicely', to: 'silas', face: 'concerned', text: '…At your hand.' },
    { shot: 'two', who: 'silas', to: 'cicely', face: 'calm', text: 'Measured. Not the sentence you named.' },
    // (the word: hers to say, the mare's name)
    { who: 'silas', to: 'cicely', face: 'caring', text: 'And if it’s ever more than you can bear, you say one word, and it stops at once, and you may go on your way. No one will stop you.' },
    { who: 'silas', to: 'cicely', face: 'caring', text: 'The word is Falada.', listen: { cicely: 'surprised' } },
    { shot: 'close', who: 'cicely', to: 'silas', face: 'teary', text: '…Her name. You’d have me say her name.' },
    { who: 'silas', to: 'cicely', face: 'soft', text: 'So you’ll remember her. Only if you need it.' },
    { look: { cicely: 'down' }, pause: 1100 },
    { who: 'cicely', to: 'silas', face: 'sad', text: '…I understand. I accept, Mr {last}.', look: { cicely: null } },
    // (and the gown, first)
    { shot: 'two', who: 'silas', to: 'cicely', face: 'stern', text: 'Then the gown first. It was never yours to wear. Take it off.' },
    { shot: 'close', who: 'cicely', to: 'silas', face: 'wince', text: '…Here?' },
    { shot: 'two', who: 'silas', to: 'cicely', face: 'calm', text: 'Here. Your shift can stay.' },
    { shot: 'gown', act: 'unlace', by: 'cicely', look: { cicely: 'down' }, pause: 1900 },
    { end: true },
  ],
  next: { title: 'The correction', where: 'Across your knee, in your office (being built)' },
};

const SCENES = { hall: HALL, office: OFFICE };

// A shot, in the room: its camera and the point it looks at ([x, y, z] each), from the spots (the hall's spots(): { id: { at, yaw } }).
function shot(scene, name, spots) {
  const s = scene.shots[name]; if (!s) return null;
  if (s.at) return { cam: s.cam.slice(), look: s.look.slice() };
  const p = spots[s.from], c = Math.cos(p.yaw || 0), n = Math.sin(p.yaw || 0), at = p.at;
  const W = ([x, y, z]) => [at.x + x * c + z * n, y, at.z - x * n + z * c];
  return { cam: W(s.cam), look: W(s.look) };
}
// Everyone who says anything in it, and everyone it names.
const flat = beats => beats.flatMap(b => [b].concat(b.choose ? b.choose.options.flatMap(o => flat(o.beats)) : []));
const speakers = scene => [...new Set(flat(scene.beats).filter(b => b.who).map(b => b.who))];

root.Prologue = { SCENES, ORDER: ['hall', 'office'], shot, speakers };
})(typeof window !== 'undefined' ? window : globalThis);
