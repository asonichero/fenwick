// Fenwick Hall — Chapter 1, "The Dusty Hall" (docs/gdd.md, "Chapter 1 in detail"): the scenes, as data, played by game.html. Begun with his
// arrival: a card, then the arrival (a cutscene, js/cutscene.js: up the sweep, the door unlocked, in; the hall taken in, in his own thoughts),
// and on without a cut to the Hall walked (js/roam.js): the entrance hall and the great hall, what there is to look at, and the great hall's
// first putting right (its dust sheets off, its shutters open, its hearth cleared, laid and lit), and the last of what he brought put to a stew
// over it. Then, next: the Fenwood, and Redmere.
//   A walked scene (roam): { from: a spot, face: a spot to face (begun there, not walked on into), intro: [thoughts], things: [{ id, at: a point of the room's, reach, label, when, steps, once }],
//   done: the flag that ends it, last: steps once it's done }. A thing's `when`: { flag, not, door: [name, 'open' | 'shut'], shutter: [i, bool],
//   or any of the room's state: hearth: 'ash' }. Its steps, in turn: think (a thought of his), sfx, set: [k, v] (the room's state), door:
//   [name, k, ms], fade: [steps done in black], flag, wait (ms), sound: { fire, wind } (the room's).
(function (root) {
'use strict';

// ── The arrival: midday, at the end of the road. The house, from the sweep; up to the door; the key; in ──
const ARRIVAL = {
  id: 'arrival', room: 'fenwick', day: true, title: 'The arrival', seamless: true,      // (on into the Hall walked, without a cut)
  card: { big: 'Chapter One', small: 'The Dusty Hall' },
  start: { door: 0 },
  cast: { silas: { spec: ['silas'], mark: 'drive', face: 'calm', gait: 'silas' } },
  names: { silas: '{first}' },
  shots: {
    house: { at: true, cam: [2.2, 1.55, 20.5], look: [1.2, 4.3, 2.0] },            // (the house from the end of the sweep, its roofs, him small before it)
    houseIn: { at: true, cam: [1.6, 1.65, 15.2], look: [0.7, 3.4, 2.0] },
    approach: { at: true, cam: [-3.0, 1.5, 7.4], look: [0.3, 1.3, 3.4] },          // (side on, as he walks up to it)
    porch: { at: true, cam: [1.7, 1.75, 5.6], look: [0, 1.6, 3.0] },               // (behind him, at the door)
    doorIn: { at: true, cam: [-0.9, 1.7, -0.4], look: [0.1, 1.5, 2.8] },           // (from within: the door opening, the day behind him)
    inside: { at: true, cam: [2.4, 1.7, -0.7], look: [0.4, 1.45, 1.2] },           // (him, a few steps in, looking about him, the day in the door behind)
  },
  beats: [
    { shot: 'house', push: 'houseIn', ms: 9000, pause: 2600 },
    { who: 'silas', think: true, face: 'calm', text: 'So this is {hall}.' },
    { shot: 'approach', act: 'walk', by: 'silas', path: ['drive', 'porch'] },
    { shot: 'porch', who: 'silas', think: true, face: 'calm', text: 'Much neglected, the man wrote. He was being kind.' },
    { sfx: 'lock', pause: 1200 },
    { who: 'silas', think: true, text: 'The key turns, at least.' },
    { shot: 'doorIn', act: 'door', which: 'front', to: 1, ms: 1800, sfx: 'creak', pause: 300 },
    { act: 'walk', by: 'silas', path: ['porch', 'threshold', 'within'] },
    { shot: 'inside', look: { silas: 'stair' }, pause: 1500 },
    { look: { silas: 'sheets' }, who: 'silas', think: true, text: 'Dust sheets over everything. As if he meant to come back to it all.' },
    { look: { silas: null }, act: 'turn', by: 'silas', toward: 'greatDoor', ms: 900, who: 'silas', think: true, face: 'calm', text: 'And cold as a cellar. A fire first; then I’ll see what’s what.' },      // (turned to the great hall's door: the way on)
  ],
};

// ── The Hall, walked: the entrance hall and the great hall; looked round, and the great hall's first putting right; the stew ──
const shutter = i => ({ id: 'shutter' + i, at: 'shutter' + i, reach: 1.6, label: 'Open the shutters', when: { shutter: [i, false] },
  steps: [{ sfx: 'creak', set: ['shutter', [i, true]] }, { once: 'light', think: 'Daylight. That’s better.' }] });
const HOUSE = {
  id: 'house', room: 'fenwick', day: true, title: 'The Hall',
  cast: { silas: { spec: ['silas'], mark: 'within', face: 'calm', gait: 'silas' } },
  names: { silas: '{first}' },
  roam: {
    from: 'within', face: 'greatDoor', sound: { fire: 0, wind: 0.35 },
    intro: [{ think: 'The great hall’s through there, if I have the plan of the place right.' }],
    things: [
      // (the entrance hall)
      { id: 'portrait', at: 'portrait', reach: 2.4, label: 'Look at the portrait', steps: [{ think: 'Great-uncle Ambrose, I suppose. He looks as if he’d rather not be found.' }] },
      { id: 'clock', at: 'clock', reach: 1.6, label: 'Look at the clock', steps: [{ think: 'Stopped at twenty past ten. Morning or night, there’s no telling which.' }] },
      { id: 'sheet', at: 'sheets', reach: 1.5, label: 'Lift a dust sheet', steps: [{ think: 'A good table under it. Everything put by, as if he meant to come back to it.' }] },
      { id: 'stair', at: 'stair', reach: 1.9, label: 'Go upstairs', steps: [{ think: 'Upstairs can wait. A fire first.' }] },
      { id: 'study', at: 'study', reach: 1.5, label: 'Try the door', steps: [{ sfx: 'rattle' }, { think: 'Locked, and none of these keys fits it. Later.' }] },
      { id: 'out', at: 'door', reach: 1.4, label: 'Go outside', steps: [{ think: 'Not yet. The house first.' }] },
      { id: 'great', at: 'greatDoor', reach: 1.6, label: 'Open the door', when: { door: ['great', 'shut'] },
        steps: [{ sfx: 'creak', door: ['great', 1, 1300] }, { think: 'The great hall. Dark as a church.' }] },
      // (the great hall: put right)
      shutter(0), shutter(1), shutter(2),
      { id: 'sheets', at: 'table', reach: 1.9, label: 'Take off the dust sheets', when: { sheets: true },
        steps: [{ fade: [{ set: ['sheets', false] }] }, { think: 'The table, and the settle. Good oak, all of it, and not a mark on it.' }] },
      { id: 'ash', at: 'hearth', reach: 2.0, label: 'Clear out the old ash', when: { hearth: 'ash' },
        steps: [{ fade: [{ set: ['hearth', 'clear'] }] }, { think: 'Years of it. There’s dry wood in the basket, at least.' }] },
      { id: 'lay', at: 'hearth', reach: 2.0, label: 'Lay the fire', when: { hearth: 'clear' },
        steps: [{ fade: [{ set: ['hearth', 'laid'] }] }, { think: 'Kindling under, the logs over.' }] },
      { id: 'light', at: 'hearth', reach: 2.0, label: 'Light the fire', when: { hearth: 'laid' },
        steps: [{ sfx: 'strike', wait: 700 }, { set: ['hearth', 'lit'], sound: { fire: 0.8, wind: 0.3 } }, { think: 'There. The first fire in this house in a long while, I’d wager.' }] },
      { id: 'stew', at: 'hearth', reach: 2.0, label: 'Put the last of your supplies to a stew', when: { hearth: 'lit', pot: false },
        steps: [{ fade: [{ set: ['pot', true] }, { set: ['pack', true] }] }, { think: 'The last of what I brought on the road. It’ll keep over the fire till I’m back.' }, { flag: 'stew' }] },
      { id: 'basket', at: 'basket', reach: 1.4, label: 'Look in the log basket', when: { hearth: 'ash' }, steps: [{ think: 'Dry, and plenty of it. Somebody filled this, once, against the winter.' }] },
      { id: 'kitchens', at: 'kitchens', reach: 1.6, label: 'Try the door', steps: [{ sfx: 'rattle' }, { think: 'Barred. The kitchens, and the servants’ wing beyond. Another day.' }] },
      { id: 'dresser', at: 'dresser', reach: 1.7, label: 'Look at the dresser', steps: [{ think: 'Pewter. Good pewter, and no one left to polish it.' }] },
      { id: 'settle', at: 'settle', reach: 1.9, label: 'Look at the settle', when: { sheets: false }, steps: [{ think: 'A settle by the fire, and stools. Someone sat here of an evening, once.' }] },
    ],
    // (the stew on, and the day's next thing)
    done: 'stew',
    last: [{ wait: 1500 }, { think: 'Now: Redmere. Best they meet me before they hear of me.' }, { wait: 3200 }],
  },
  next: { title: 'The Fenwood, and Redmere', where: 'The footpath through the wood to the village (being built)' },
};

// (named apart from the prologue's: its scenes and these share the game's one list)
const SCENES = { arrival: ARRIVAL, house: HOUSE };
root.Chapter1 = { SCENES, ORDER: ['arrival', 'house'] };
})(typeof window !== 'undefined' ? window : globalThis);
