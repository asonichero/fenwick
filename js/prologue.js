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
//   Prologue.SCENES.hall, .office, .correction (the tutorial: phases, not beats) · Prologue.ORDER (the scenes, in the order they're played) · Prologue.shot(scene, name, spots) → { cam, look }
//   · Prologue.speakers(scene)
(function (root) {
'use strict';

const HALL = {
  id: 'hall', room: 'hall', title: 'The false bride’s sentence',
  // (told over the opening shot, before it: who the player is, and their name asked: {first} and {last} in the script are theirs)
  cards: [
    { text: 'You manage Thornleigh’s lands and people for its master. You are trusted for your judgement, but the final say is your master’s.', ask: 'name' },
  ],
  // (seat: the chair at the hall's spot of that name; mark: standing on it; off: out of sight till an act brings them on; arms: how they're held)
  cast: {
    master: { spec: ['man', 'master'], seat: 'master', face: 'calm' },
    heir: { spec: ['man', 'heir'], seat: 'son', face: 'calm', look: 'hisPlate' },      // (look: where his eyes are kept, not on whoever speaks)
    cicely: { spec: ['her', 'cicely', 'gown'], seat: 'cicely', face: 'haughty' },
    silas: { spec: ['silas'], mark: 'silas', face: 'calm', arms: 'rest' },
    adela: { spec: ['her', 'adela', 'goose'], mark: 'adela', off: true, face: 'shy', arms: 'clasp', demure: true, gait: 'adela', enter: { back: 1.6 } },      // (enter: comes on walking, from that far behind her mark)      // (demure: her eyes down, but for whoever speaks to her)
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
    silas: { spec: ['silas'], mark: 'door', face: 'stern', gait: 'silas' },
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

// ── The correction: the tutorial (docs/gdd.md, "The correction: the tutorial"). Across his knee on his chair, pulled out from the desk; she's
// in her own shift and drawers, and across his knee from the first. The correction plays as it always does (js/session.js); a phase
// controller (js/tutorial.js) drives her defiance, pride and submission through five phases, and a prompt teaches each control as it first
// matters: till then, it's closed to the player. Her hand, when it comes back, stops the run, and what's done with it is a choice in the
// dialogue: moved out of the way, or taken; then the run's begun again. It can't be failed. Once she's receptive it runs on as the player has
// it: ended when they judge it's enough, or on to too harsh, and her word. ──
const CORRECTION = {
  id: 'correction', room: 'office', title: 'The correction',
  // (how defiant she comes to it, from how he answered her plea: stung by dryness most; disarmed a little by gentleness)
  tone: { firm: 0.78, dry: 0.9, gentle: 0.66 },
  rel: { submission: 0.1, comfort: 0.1, desire: 0 },
  // (the tutorial is Silas's own thoughts, in the dialogue box, as each thing first matters (`think`); the control it's about lit at the foot.
  // The player's left to work out from his thought what to do with it)
  // (her word, thought of with the first of them)
  word: 'I’ll know it’s too much if she names the mare.',
  // (her hand back over her seat: the choice, in the dialogue box, under his thought)
  // (what Silas says, either way, the first time and the second: shown under the choice, and said)
  hand: { prompt: 'Her hand’s back, to cover herself. Move it out of the way, or take it and keep hold of it?', options: [
    { id: 'tell', label: 'Move it out of the way', say: ['Hand away, Cicely. Keep your position, or this only takes longer.', 'Again? Every time that hand comes back, it goes on longer. Keep it down.'] },
    { id: 'take', label: 'Take her hand', say: ['Then I’ll keep it for you. Give it here.', 'That’s twice. I’ll hold it for you, then. Stay still.'] }] },
  phases: [
    { id: 'ready', name: 'Before you begin', prompts: [
      { key: 'shift', when: 'shiftDown', think: 'She won’t feel it through the shift. I should raise it.', control: 'T', act: 'top' },
      { key: 'run', think: 'Now I’m ready to begin.', control: 'Space', act: 'run' } ] },
    { id: 'defiance', name: 'Defiance', floor: 0.5, allow: ['glance'], out: { hits: 14, distress: 0.45, most: 24 }, prompts: [
      { key: 'pace', after: 4, optional: true, think: 'A steady pace is easier to bear than a quick one.', control: '[ ]', act: 'pace' },
      { key: 'strength', after: 9, optional: true, think: 'Harder brings her to it sooner. Too hard, and it’s more than she can bear.', control: '− =', act: 'strength' } ] },      // (optional: left alone, each gives way after a few smacks)
    // (her hand back over her seat: the run stops, and the player chooses, in the dialogue, either time: move it out of the way, or take it and
    // hold it, from then on. Then the run's theirs to begin again. After the first time, she takes a good deal more before it comes again)
    { id: 'covering', name: 'Covering', floor: 0.5, allow: ['cover', 'glance'], hold: ['cover'], forceCover: [2, 16], out: { covers: 2, after: 4 }, prompts: [
      { key: 'hand', when: 'covering', again: true, acts: ['tell', 'take'] },      // (his thought's the choice's own: SCENES.correction.hand.prompt)
      { key: 'again', when: 'stopped', again: true, think: 'Again, then.', control: 'Space', act: 'run' } ] },
    // (her hand dealt with, she's still answering back; he says so: she's not feeling it yet. Then he thinks of her drawers)
    { id: 'pride', name: 'Pride', floor: 0.55, allow: ['glance'], out: { distress: 0.95, hits: 8, most: 34 },
      intro: [
        { at: 0.8, who: 'cicely', text: 'Is that the worst a steward can do? I’ve had harder from a hairbrush.' },
        { at: 4.6, who: 'cicely', if: 'pinned', text: 'Hold my hand all you like. It won’t make me sorry.' },
        { at: 4.6, who: 'cicely', unless: 'pinned', text: 'Move my hand all you like. It won’t make me sorry.' },
        { at: 8.4, who: 'silas', text: 'Still more breath for answering back than for anything else. You’re not feeling this yet, are you?' } ],
      prompts: [
      { key: 'drawers', when: 'drawersUp', think: 'Through linen, it isn’t reaching her. I should lower her drawers.', control: 'U', act: 'under' },
      { key: 'meter', think: 'She won’t let me see it in her face. I’ll have to judge it some other way.', look: 'meter' } ] },
    // (broken: after her first line of it, he thinks to slow; and till he does, she goes on, over and over (cycle). Slower, and she promises she
    // understands, over and over, till he soothes her)
    { id: 'breaking', name: 'Breaking', floor: 0, submission: 0.5, out: { need: 'soothe' }, prompts: [
      { key: 'slow', when: 'yielded', think: 'There. It’s gone out of her. Slower, now.', control: '[', act: 'slower',
        cycle: ['I was wrong— I was wicked to her—', 'I know what I did— I know—', 'Please— I was wrong— I was wrong—'] },
      { key: 'soothe', when: 'slowed', think: 'A hand between, in slow circles. She should know it isn’t anger.', control: 'S', act: 'soothe',
        cycle: ['I understand. I do. I understand.', 'I’ll not do it again. I swear it.', 'I know what I did to her. I know it now.'] } ] },
    // (she says what she did, and why, truly: everything held while she does (the controls greyed). Then he says he believes her, but it isn't
    // learned yet; and thinks it's his to judge when it's enough, and that she'll end it herself if she must. Receptive: her defiance gone,
    // what's done from here reaches her, as in any correction once it's lowered. It runs on as the player has it: on to its end, or too far,
    // and her word)
    { id: 'receptive', name: 'Receptive', floor: 0, submission: 0.8, prompts: [
      { key: 'listen', when: 'telling', think: 'Let her speak.' },
      { key: 'receptive', when: 'judged', think: 'It’s mine to judge when it’s enough. And if it’s ever more than she can bear, she’ll end it herself.', control: 'Enter', act: 'end', look: 'meter' } ] },
  ],
  // (his word, once she's told it truly)
  believe: 'I believe you. But you’ve not learned it yet.',
  // (what she says as she comes to it honestly: what she did, and why. One at a time, a little apart)
  accept: [
    'I wanted it. All of it. Her gowns, and her name, and him.',
    'Twenty years I walked behind her, holding her train, and no one ever once asked what I wanted.',
    'So I envied her. That’s all it ever was. And I’d have kept her down with the geese to keep what I took.',
    'I’m sorry. Not for being found out. For her.',
  ],
  next: { title: 'Aftercare and the offer', where: 'In your office, seated together' },      // (if the game stops before it)
};

// ── The aftercare and the offer (docs/gdd.md, "Aftercare and the offer"): the two of them on the settle in his office, as every correction ends
// (the correction's own aftercare: js/session.js seats them). A conversation (js/talk.js's: lines, and lines of inquiry the player works
// through in any order, then how it ends). Then the offer: the place she made her mistress take. Played one of two ways:
//   done: the player ended it. How she is, why it mattered, that it's over; then he believes she's truly sorry, and there may be a place for her
//   here, if the master agrees. She takes it.
//   word: she said her word. He owns that it went too far, before anything else, and tells her she's free, as he promised; the offer comes as
//   what he'd have said either way, set apart from the rest of the night, not amends for it; and she needn't answer tonight. ──
const AFTERCARE = {
  id: 'aftercare', room: 'office', title: 'Aftercare and the offer',
  talk: {
    done: [
      { who: 'subject', expr: 'teary', text: '…I thought you’d be cruel. You weren’t. That’s worse, somehow.' },
      { explore: true, choose: [
        { label: 'Ask how she is', then: [
          { who: 'captain', expr: 'caring', text: 'Breathe first. Then tell me how you are.' },
          { who: 'subject', expr: 'wistful', text: 'Sore. Ashamed. …Lighter, somehow. I don’t understand that.' },
          { who: 'captain', expr: 'soft', text: 'You will.' } ] },
        { label: 'Say why it mattered', then: [
          { who: 'captain', expr: 'calm', text: 'You made a lady tend geese and swear herself silent, and you’d have seen her turned out with nothing. Better you feel the weight of it once, from me, than carry it lightly the rest of your life.' },
          { who: 'subject', expr: 'sad', text: 'I know. I watched her be given everything, all my life. I wanted one thing to be mine, and I took all of it.' } ] },
        { label: 'Tell her it’s over', then: [
          { who: 'captain', expr: 'soft', text: 'It’s done. What you did is paid for, here, tonight, and it stays paid.' },
          { who: 'subject', expr: 'teary', text: '…You’re not turning me out?' },
          { who: 'captain', expr: 'calm', text: 'That isn’t mine to say. Not yet.' } ] },
        { label: 'Tell her what you think', after: 'Tell her what you think', end: true, then: [
          { who: 'captain', expr: 'caring', text: 'I believe you’re sorry. Truly sorry, and for her, not for being found out.' },
          { who: 'captain', expr: 'calm', text: 'The master’s sentence turns you out with nothing. But there may be a place for you here, if he agrees: the one you made her take. The geese, with Kit, under my eye.' },
          { who: 'subject', expr: 'surprised', text: '…The geese.' },
          { who: 'captain', expr: 'soft', text: 'It’s offered, not ordered. You may go instead, and no one will stop you.' },
          { who: 'subject', expr: 'teary', text: '…No. I’ll stay, if he’ll have me. I’ll keep them better than she was let to.' },
          { who: 'captain', expr: 'caring', text: 'Then I’ll ask him in the morning.' },
          { who: 'subject', expr: 'soft', text: '…Thank you, Mr {last}.' } ] },
      ] },
    ],
    word: [
      { who: 'subject', expr: 'crying', text: 'I said it. Her name. I’m sorry— I couldn’t. I’ll go.' },
      // (his, first, and not the player's to leave out: it went too far, and that's his)
      { who: 'captain', expr: 'concerned', text: 'Don’t be sorry for that. You said it, and you were right to. That went further than it should have, and that’s mine to answer for, not yours.' },
      { explore: true, choose: [
        { label: 'Ask how she is', then: [
          { who: 'captain', expr: 'concerned', text: 'How are you? Truly.' },
          { who: 'subject', expr: 'sad', text: '…It hurt more than I could hold. I’m all right now. Mostly.' },
          { who: 'captain', expr: 'soft', text: 'Sit as long as you need.' } ] },
        { label: 'Say why it mattered', then: [
          { who: 'captain', expr: 'calm', text: 'What you did to her mattered. What I did just now went past it. Both are true.' },
          { who: 'subject', expr: 'sad', text: 'I know what I did to her. I didn’t need it beaten into me to know it.' },
          { who: 'captain', expr: 'soft', text: 'No. You didn’t.' } ] },
        { label: 'Tell her she’s free', then: [
          { who: 'captain', expr: 'calm', text: 'You’re free to go, as I promised. Tonight, if you want it, and with the character I said this house would give you. Saying your word costs you nothing.' },
          { who: 'subject', expr: 'surprised', text: '…Nothing?' },
          { who: 'captain', expr: 'soft', text: 'Nothing. That’s what it’s for.' } ] },
        { label: 'Tell her what you think', end: true, then: [
          { who: 'captain', expr: 'calm', text: 'There’s something I’d have said either way. Hear it as that, not as amends. Nothing makes up for the last of tonight, and I won’t pretend this does.' },
          { who: 'captain', expr: 'caring', text: 'I believe you’re sorry. I heard it before ever it went too far.' },
          { who: 'captain', expr: 'calm', text: 'There may be a place for you here, if the master agrees: the geese, with Kit. Or go, as I promised, and no one will think the less of you for it.' },
          { who: 'captain', expr: 'soft', text: 'You needn’t answer me tonight.' },
          { who: 'subject', expr: 'wistful', text: '…I’d stay. Not because of tonight. Because of what I owe her.' },
          { who: 'captain', expr: 'soft', text: 'Then I’ll ask him in the morning. And if you think better of it by then, say so, and go with my blessing.' } ] },
      ] },
    ],
  },
  next: { title: 'Coda: the letter', where: 'Some weeks on: the goose yard, and a rider with a letter (being built)' },
};

// ── Coda: the letter (docs/gdd.md, "Coda: the letter"). Some weeks on, by day: Silas at his desk; a knock; Cicely, in the goose girl's plain
// dress, with a letter a rider left at the yard gate. He leaves it where she lays it and comes round the desk to her: what he asks her (how
// she's keeping, the geese, Lady Adela, the letter), every one of it, in whatever order, before she goes back to her work; how she is matters
// more to him than whatever the letter holds. She's settled, steady, and better for it. Then, alone, he opens it, and the view's of the page,
// its words written out as he reads them: his great-uncle is dead, and the Hall in the Fenwood is his. ──
const CODA = {
  id: 'coda', room: 'office', day: true, title: 'The letter',
  card: { big: 'Some weeks later' },      // (on black, before it: clicked through)
  start: { door: 0 },
  cast: {
    silas: { spec: ['silas'], seat: 'silas', arms: 'desk', face: 'calm', gait: 'silas', look: 'down' },      // (at his ledger)
    cicely: { spec: ['her', 'cicely', 'goose'], mark: 'outside', face: 'smile', arms: 'clasp',      // (behind the door from the first, ready to come in)
      gait: { mix: { female: 0.55, walk: 0.3, sad: 0.15 }, arms: 0.5, sway: 0.5, head: 0.06, slump: 0, pace: 1.0 } },      // (a working woman's walk now: steady, unhurried)
  },
  names: { silas: '{first}', cicely: 'Cicely' },
  points: { door: { from: 'door', at: [0, 1.5, 0.6] }, letterAt: { from: 'front', at: [-0.08, 0.767, 0.42] } },
  // (the letter: in her right hand as she comes in; its text, as it's written out on the page)
  letter: { start: { by: 'cicely', side: 'R' }, text: [
    { right: 'Wendham, the 9th of October' }, { gap: 26 },
    { p: 'Sir,' },
    { p: 'It falls to me to tell you of the death, on the last day of September, of Mr Ambrose {last}, of {hall} in the Fenwood: your great-uncle, on your father’s side, whom I believe you met but once, as a boy.', indent: true },
    { p: 'He died without issue. By his will he leaves to you, as his nearest living kin, the house and estate of {hall}, with its lands, its tenancies, and such of its household as remain.', indent: true },
    { p: 'I should tell you plainly that the house has been much neglected in his later years, and its affairs are in some disorder. Its people, I am told, have been left very much to themselves.', indent: true },
    { p: 'I would be glad to wait upon you at your earliest convenience, or to receive you at the Hall, where the keys are kept against your coming.', indent: true },
    { gap: 14 }, { right: 'I have the honour to be, Sir,' }, { right: 'your most obedient servant,' }, { gap: 10 }, { sign: 'Edwin Hollis' },
  ] },
  shots: {
    day: { at: true, cam: [2.05, 1.6, 0.95], look: [0.72, 0.95, -1.75] },            // (from across the room by the window: him at his desk, the sun in)
    dayIn: { at: true, cam: [1.75, 1.45, 0.3], look: [0.74, 1.0, -1.8] },
    him: { at: true, cam: [1.08, 1.38, -0.42], look: [0.75, 1.13, -1.86] },          // (across the desk: him at it)
    doorway: { at: true, cam: [0.3, 1.6, -2.25], look: [1.25, 1.15, 1.9] },          // (past his shoulder, from behind the desk: the door)
    her: { at: true, cam: [0.84, 1.47, -1.3], look: [0.93, 1.42, -0.47] },            // (across the desk: her, before it)
    lay: { at: true, cam: [2.25, 1.78, -1.25], look: [0.98, 1.22, -0.6] },            // (side on: her hand to the desk)
    rise: { at: true, cam: [-1.25, 1.8, 0.9], look: [1.15, 1.0, -1.2] },              // (from the fire side: him getting up, coming round)
    two: { at: true, cam: [1.12, 1.62, 1.8], look: [1.37, 1.48, -0.36] },            // (the two of them, before the desk, side on)
    herOver: { at: true, cam: [2.4, 1.66, 0.45], look: [0.93, 1.45, -0.47] },        // (over his shoulder: her face)
    himOver: { at: true, cam: [0.42, 1.56, -1.02], look: [1.8, 1.6, -0.25] },         // (over hers: his)
    exit: { at: true, cam: [0.55, 1.6, -1.1], look: [1.3, 1.2, 2.0] },               // (from the desk: her going out at the door)
    take: { at: true, cam: [2.2, 1.8, -1.25], look: [0.95, 1.3, -0.6] },              // (side on: him at the desk, taking it up)
    open: { at: true, cam: [0.7, 1.58, -1.72], look: [0.93, 1.42, -0.47] },          // (across the desk: him, the letter open before him)
  },
  beats: [
    // (by day: him at his desk, at his ledger; a knock)
    { shot: 'day', push: 'dayIn', ms: 7000, pause: 2400 },
    { sfx: 'knock', pause: 500 }, { look: { silas: 'door' }, pause: 700 },
    { shot: 'him', who: 'silas', face: 'calm', text: 'Come in.' },
    { shot: 'doorway', act: 'door', to: 1, ms: 1000 },
    { act: 'walk', by: 'cicely', path: ['outside', 'door', 'front'], toward: 'silas', look: { silas: 'cicely' } },      // (in as soon as it's open)
    { shot: 'her', who: 'cicely', to: 'silas', face: 'smile', text: 'Beg pardon, Mr {last}. A rider left this at the yard gate for you. He’d come no further: the grey gander saw him off.' },
    { shot: 'lay', act: 'lay', by: 'cicely', at: 'letterAt', look: { cicely: 'letter' } },
    { look: { cicely: 'silas', silas: 'letter' }, pause: 900 },
    { shot: 'him', look: { silas: 'cicely' }, who: 'silas', to: 'cicely', face: 'smile', text: 'Thank you, Cicely.' },
    // (he leaves it where it lies, and comes round the desk to her)
    { shot: 'rise', act: 'stand', by: 'silas', at: 'chairSide', toward: 'cicely', pause: 200 },
    { act: 'walk', by: 'silas', path: ['chairSide', 'deskNE', 'deskSE', 'byDesk'], toward: 'cicely', wait: false, who: 'silas', to: 'cicely', face: 'calm', text: 'It’s kept the length of the road. It’ll keep a while longer.' },
    { shot: 'two', act: 'turn', by: 'cicely', toward: 'byDesk', wait: false, who: 'silas', to: 'cicely', face: 'caring', text: 'I’ve hardly seen you these three weeks but from the window. Have you a minute?' },
    { shot: 'herOver', who: 'cicely', to: 'silas', face: 'cheeky', hold: 'choices', text: 'A minute, sir. The geese won’t count themselves.' },
    // (what he asks her: every one, in whatever order; and only then does she go back to her work)
    { talk: { hint: 'Ask what you like, in any order.', options: [
      { id: 'keeping', label: 'Ask how she’s keeping', beats: [
        { shot: 'himOver', who: 'silas', to: 'cicely', face: 'caring', text: 'How are you keeping? Truly. Not the answer you’d give the steward.' },
        { shot: 'herOver', who: 'cicely', to: 'silas', face: 'wistful', text: 'Truly? …I sleep. I didn’t, those first nights. Now I’m out at first light, and by dark I’m too tired to lie awake thinking.' },
        { look: { cicely: 'down' }, who: 'cicely', to: 'silas', face: 'smile', text: 'My hands are ruined. The bride I played at being would have wept over them. I find I don’t mind.' },
        { shot: 'himOver', look: { cicely: null }, who: 'silas', to: 'cicely', face: 'smile', text: 'That’s the best news I’ve had in weeks.' },
        { shot: 'herOver', who: 'cicely', to: 'silas', face: 'cheeky', text: 'Better than whatever’s in that letter?' },
        { shot: 'himOver', who: 'silas', to: 'cicely', face: 'calm', text: 'A great deal better.' } ] },
      { id: 'geese', label: 'Ask after the geese', beats: [
        { shot: 'himOver', who: 'silas', to: 'cicely', face: 'calm', text: 'And the geese?' },
        { shot: 'herOver', who: 'cicely', to: 'silas', face: 'cheeky', text: 'Forty-one of them, and the grey gander’s stopped trying to kill me. Mostly.' },
        { who: 'cicely', to: 'silas', face: 'smile', text: 'Kit says I’ve a way with them. He said it as if it pained him.' },
        { shot: 'himOver', who: 'silas', to: 'cicely', face: 'smile', text: 'From Kit, that’s very nearly a medal.' } ] },
      { id: 'adela', label: 'Ask if she’s seen Lady Adela', beats: [
        { shot: 'himOver', who: 'silas', to: 'cicely', face: 'calm', text: 'Have you seen Lady Adela?' },
        { shot: 'herOver', look: { cicely: 'down' }, who: 'cicely', to: 'silas', face: 'wistful', text: 'She came down to the yard last week. I thought she’d come to look at me, the way I used to look at her.' },
        { look: { cicely: null }, who: 'cicely', to: 'silas', face: 'teary', text: 'She asked how I was. As though it mattered. So I asked her pardon, and she gave it. I don’t know that I would have, in her place.' },
        { shot: 'himOver', who: 'silas', to: 'cicely', face: 'soft', text: 'That was the harder thing, asking. Harder than anything in this room. I’m glad you did.' } ] },
      { id: 'letter', label: 'Ask about the letter', beats: [
        { shot: 'himOver', who: 'silas', to: 'cicely', face: 'calm', text: 'Did the rider say who it’s from?' },
        { shot: 'herOver', who: 'cicely', to: 'silas', face: 'calm', text: 'A solicitor, in Wendham. He wanted it in your hand and no one else’s, and he looked at me as if I might steal it.' },
        { look: { cicely: 'letter' }, who: 'cicely', to: 'silas', face: 'shy', text: '…I didn’t.' },
        { shot: 'himOver', look: { cicely: null }, who: 'silas', to: 'cicely', face: 'caring', text: 'I know. It never crossed my mind.' },
        { shot: 'herOver', who: 'cicely', to: 'silas', face: 'surprised', text: 'You’ve not even opened it.' },
        { shot: 'himOver', who: 'silas', to: 'cicely', face: 'soft', text: 'Whatever a solicitor has to say will keep. You’re here now.' } ] },
    ] } },
    // (and then she's back to her work)
    { shot: 'two', who: 'cicely', to: 'silas', face: 'smile', text: 'I’d best get back, sir, before Kit decides they’re all his again.' },
    { shot: 'herOver', who: 'silas', to: 'cicely', face: 'caring', text: 'Go on, then. And Cicely: if ever you’re not well, you come to me. Letter or no letter.' },
    { shot: 'himOver', who: 'cicely', to: 'silas', face: 'soft', text: 'I know, sir. …I know.' },
    { shot: 'exit', clear: true, act: 'walk', by: 'cicely', path: ['front', 'door', 'outside'], look: { silas: 'cicely' } },
    { act: 'gone', by: 'cicely', pause: 700 },
    // (alone: the letter, now. He takes it up from where she laid it, breaks the seal, and reads)
    { shot: 'take', look: { silas: 'letter' }, act: 'walk', by: 'silas', path: ['byDesk', 'front'], toward: 'silas' },
    { act: 'take', by: 'silas', pause: 400 },
    { shot: 'open', act: 'open', by: 'silas', pause: 1000 },
    { act: 'read', by: 'silas' },
    { button: 'Put the letter down' },
    // (put down: and what it says, in his words, for whoever read it quickly)
    { shot: 'open', act: 'lower', by: 'silas', look: { silas: 'down' }, pause: 700 },
    { who: 'silas', face: 'surprised', text: 'Great-uncle Ambrose. I met him once, as a boy. I’d all but forgotten him.' },
    { who: 'silas', face: 'wistful', look: { silas: null }, text: 'And he’s left me {hall}. The house, the land, the tenants; whoever’s left of the household.' },
    { who: 'silas', face: 'calm', text: 'Neglected for years, the man says, and its people left to themselves.' },
    { who: 'silas', face: 'soft', text: 'A hall of my own. And for once, the final say mine.' },
    { end: true },
  ],
  next: { title: 'The road to the Fenwood', where: 'Your master’s leave, and the way to {hall} (being built)' },
};

const SCENES = { hall: HALL, office: OFFICE, correction: CORRECTION, aftercare: AFTERCARE, coda: CODA };

// A shot, in the room: its camera and the point it looks at ([x, y, z] each), from the spots (the hall's spots(): { id: { at, yaw } }).
function shot(scene, name, spots) {
  const s = scene.shots[name]; if (!s) return null;
  if (s.at) return { cam: s.cam.slice(), look: s.look.slice() };
  const p = spots[s.from], c = Math.cos(p.yaw || 0), n = Math.sin(p.yaw || 0), at = p.at;
  const W = ([x, y, z]) => [at.x + x * c + z * n, y, at.z - x * n + z * c];
  return { cam: W(s.cam), look: W(s.look) };
}
// Everyone who says anything in it, and everyone it names.
const flat = beats => beats.flatMap(b => [b].concat(b.choose ? b.choose.options.flatMap(o => flat(o.beats)) : [], b.talk ? b.talk.options.flatMap(o => flat(o.beats)) : []));
const speakers = scene => [...new Set(flat(scene.beats).filter(b => b.who).map(b => b.who))];

root.Prologue = { SCENES, ORDER: ['hall', 'office', 'correction', 'aftercare', 'coda'], shot, speakers };
})(typeof window !== 'undefined' ? window : globalThis);
