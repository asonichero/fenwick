// Fenwick Hall — what's said in a correction (the structure is Project Meridian's js/lines.js; every line is new). Each heroine's scripted
// responses as it goes (as she's placed, the first smack, as her distress crosses each band, when soothed, her safe word when it's gone too far,
// at the end), Silas's word to place her and to correct her position, the conversation after (aftercare given through what's said, then what
// she's to do with the rest of the day), and the terms: the conversation, before any correction, where Silas sets out how his household
// works and she agrees to it and chooses her word.
// A first draft, in each voice, for review. {word}: her safe word. {name}: what Silas calls her (Cast: short).
//
//   Lines.react(id, key) → a line or null · Lines.captain(key, id) (Silas; `captain` is the engine's name) · Lines.place(id, position)
//   Lines.after(id, outcome, mood) → the aftercare conversation as steps · Lines.terms(id) → the terms conversation as steps
(function (root) {
'use strict';
const pick = a => (Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a);

// Silas placing her, by position. Standing, by what she holds (a room's support names its lines): wall, a rail (a footboard, a bannister);
// flat, a bare wall; edge, a counter or a board's edge; writing, the guest room's writing table; desk, the study's desk; table, chest down over
// a table's end.
const PLACE = {
  otk: ['Across my knee, {name}.', 'Here. Over my lap.', 'Come here. Across my knee.'],
  wall: ['Both hands on the rail, {name}. Feet apart.', 'Take hold of the rail. Bend.', 'The rail. Both hands, and keep them there.'],
  flat: ['Hands on the wall, {name}. Step back.', 'Palms flat on the wall. Feet apart.', 'Face the wall. Hands on it, and leave them there.'],
  edge: ['Hands on the edge, {name}. Step back. Bend.', 'Palms flat on the board. Feet apart.', 'Over here. Both hands down, and keep them there.'],
  writing: ['Hands on the writing table, {name}. Step back. Bend.', 'Palms flat on the table. Feet apart.', 'Over here. Both hands on the table, and keep them there.'],
  desk: ['Hands on the desk, {name}. Step back. Bend.', 'Palms flat on the desk. Feet apart.', 'Here. Both hands on the desk.'],
  table: ['Over the table, {name}.', 'Bend over the end of the table. Hold the sides.', 'Here. Chest down on the table.'],
};
// Silas, when she gets in the way of it: a hand back over the seat (hands); the second time, he takes the wrist and holds it at the small of
// her back (pin); and when she comes up out of position (down: across the knee; then by what she holds).
const CAPTAIN = {
  hands: ['Hand down, {name}.', 'Move the hand.', 'That hand goes back where it was.'],
  pin: ['That’s twice. I’ll hold it for you.', 'Give me the wrist. There.', 'All right. I have it. Stay.'],
  down: ['Down.', 'Stay down, {name}.', 'Back over. All the way.'],
  rail: ['Back in position.', 'Hands on the rail. Bend.', 'Down, {name}. Hold the rail.'],
  wall: ['Back in position.', 'Hands on the rail. Bend.', 'Down, {name}. Hold the rail.'],
  flat: ['Hands back on the wall.', 'Back in position, {name}.', 'Palms on the wall. Stay there.'],
  edge: ['Hands back on the edge.', 'Down. Palms flat, {name}.', 'Back over.'],
  writing: ['Hands back on the table.', 'Down. Palms flat, {name}.', 'Back over the table.'],
  desk: ['Hands back on the desk.', 'Down. Palms flat, {name}.', 'Back over the desk.'],
  table: ['Back down on the table.', 'Chest down, {name}.', 'Stay down on the table.'],
};

// During: start (as she's placed), first (the first smack), flinching, struggling, edge, past (each the first time it's reached), plead (now
// and then while it's hard), spent (now and then, once the fight's gone out of her: hardly words), accept (in place of a plea, the more
// submissive she is), flushed (once, if her body's response shows: embarrassment), soothe (the palm on her, between), word (her safe word,
// called), end (when Silas stops). While she's still defiant: defy (back-talk, in place of the early band lines and the pleas), and yield
// (once, as the defiance breaks). What each calls him is drafted: the maids "sir"; the wards (Red, Belle, Rapunzel, Snow White) "Silas".
const REACT = {
  goldie: {
    start: ['Fine. But I want it noted I did not break that chair on purpose.', 'This is ridiculous. …Fine. Fine.', 'You could just dock my wages, like a normal person.'],
    first: ['Ow! — all right, that’s real.', 'Hey!'],
    flinching: ['Ow— all right, I heard you the first time—', 'That’s— ow— that’s a lot of hand.'],
    struggling: ['I’ll put things back! I’ll put things back where they go—', 'Ah! All right— all right, I see it, I see it—'],
    edge: ['I wasn’t thinking— I never think— I’m sorry—', 'Please— I’ll be careful, I swear I’ll be careful—'],
    past: ['I’m sorry— about the chair, and the ink, and all of it—'],
    plead: ['Sir—', 'Please—', 'Sir— please—'],
    spent: ['…', 'Mm…', '…ow.'],
    accept: ['Yes, sir. I know.', 'I know. I know why.'],
    flushed: ['Don’t— don’t look at me like that. Don’t look at all.', 'That’s just— the blood. In my face. Never mind.'],
    soothe: ['…oh. That’s— better.', 'Hm. That isn’t fair, being kind now.'],
    defy: ['It was already wobbly!', 'You leave a bed that soft lying about, what do you expect?', 'This is not how normal people settle a debt.'],
    yield: ['…All right. All right. You win. I’ll be careful.', 'All right— I hear you. I’m listening now. I am.'],
    word: '{word}! {word}— stop, please.',
    end: ['…I’m going to sit on cushions for a week.', '…Noted. Very, very noted.'],
  },
  red: {
    start: ['I know. I left the path again. I know.', 'All right. I did promise.'],
    first: ['Oh!', 'Ah—'],
    flinching: ['I’ll stay on the path— I will—', 'Ow— yes— I hear you—'],
    struggling: ['I wasn’t thinking— I saw the foxgloves and I just—', 'Ah! I know, I know— the wolves—'],
    edge: ['I’m sorry— I’ll look, I’ll listen, I promise—', 'Please— I’ll remember this time—'],
    past: ['I’m sorry— I’m sorry I frightened you—'],
    plead: ['Silas—', 'Please—'],
    spent: ['…', 'Mm…', '…'],
    accept: ['Yes. I know. You’re right.', 'I know why. I do.'],
    flushed: ['Don’t— oh, don’t look at my face.', 'I’m red as my cloak. Don’t say it.'],
    soothe: ['…mm. That’s kind.', 'Oh— that helps.'],
    defy: ['It was only a little way off the path!', 'I’ve walked that wood all my life.', 'You sound just like my mother.'],
    yield: ['…All right. You’re right. I don’t look. I never look.', 'All right. All right. I’m listening.'],
    word: '{word}— {word}, please stop.',
    end: ['…I’ll keep to the path. I mean it this time.', '…You’ll still walk me home?'],
  },
  belle: {
    start: ['Very well.', 'As you like. I agreed to your terms.'],
    first: ['…', 'Hh.'],
    flinching: ['I’m aware.', 'Quite.'],
    struggling: ['That is— ah— entirely unnecessary to repeat—', 'I understand the principle—'],
    edge: ['I’m sorry— I knew, and I went anyway—', 'Please— I can’t— I can’t hold it any more—'],
    past: ['I’m sorry. I’m sorry. I didn’t want you to see me like this—'],
    plead: ['Silas—', 'Please—'],
    spent: ['…', 'Mm.', '…'],
    accept: ['Yes. You were clear.', 'I know. I gave my word.'],
    flushed: ['Kindly don’t remark on it.', 'This is mortifying. Look elsewhere.'],
    soothe: ['…Thank you.', 'That is— not unwelcome.'],
    defy: ['The door was unlocked. I merely observed it.', 'I could balance your books blindfolded, you know.', 'You may stop when the point is made. It was made some time ago.'],
    yield: ['…You’re right. I went because I was told not to. That’s all it ever was.', 'All right. All right. I’ll stop managing you.'],
    word: '{word}. {word}— please stop.',
    end: ['…That wasn’t in the ledger.', '…Noted. I’ll not go near the door.'],
  },
  cinderella: {
    start: ['Yes, sir. Of course.', 'I understand, sir. I’m sorry for the trouble.'],
    first: ['Oh—', 'Hh—'],
    flinching: ['I’m all right, sir—', 'Yes, sir— yes—'],
    struggling: ['I only went for an hour— only an hour—', 'Ah— I’m sorry— I’m sorry—'],
    edge: ['I was so tired— I’m always so tired— I didn’t want anyone to know—', 'Please— I’ll rest, I promise I’ll rest—'],
    past: ['I’m sorry— I didn’t think anyone would notice. No one ever notices.'],
    plead: ['Sir—', 'Please—'],
    spent: ['…', 'Mm…', '…'],
    accept: ['Yes, sir. I know.', 'You’re right. I know you are.'],
    flushed: ['Oh— I’m sorry— I don’t know why I’m so warm—', 'Please don’t look, sir.'],
    soothe: ['…Oh. No one’s ever—', 'That’s— thank you, sir.'],
    defy: ['There was still the laundry to do, sir.', 'It doesn’t matter about me.'],
    yield: ['…All right. I’ll let it be enough.', 'Yes. I hear you. I’ll stop.'],
    word: '{word}… {word}, please. Please stop.',
    end: ['…I’m all right, sir. Truly. …I think I am.'],
  },
  gretel: {
    start: ['Fine. Get it over with.', 'I know what I took. You needn’t list it.'],
    first: ['Tch—!', 'Hh!'],
    flinching: ['Ow. Fine. Ow.', 'That’s— all right, that’s something.'],
    struggling: ['All right! It was the ham as well! And the cheese!', 'Ah— I’ll stop— I’ll stop taking things—'],
    edge: ['I had to— there wasn’t— there was never enough—', 'Please— I’ll tell you where the rest is, I’ll tell you—'],
    past: ['I’m sorry— I didn’t know you could just— ask—'],
    plead: ['Sir—', 'Please—'],
    spent: ['…', 'Mm…', '…'],
    accept: ['Yes. No more lying. I know.', 'All right. I hear it.'],
    flushed: ['Don’t you dare say anything.', 'Look somewhere else, would you.'],
    soothe: ['…huh.', 'You don’t have to do that.'],
    defy: ['I never touched your smokehouse.', 'You’ve no proof it was me.', 'A ham doesn’t miss itself.'],
    yield: ['…All right. It was me. All of it. Under the boards by the stove.', 'Fine. Fine. You win. I won’t lie to you.'],
    word: '{word}— {word}! Stop.',
    end: ['…Hansel’s not to hear about this.', '…Is there— is there still supper, after?'],
  },
  rapunzel: {
    start: ['I’m sorry. I know I promised to stay where you could see me.', 'You did explain. I remember. I’m ready.'],
    first: ['Oh!', 'Ah—'],
    flinching: ['I won’t wander— I won’t—', 'Oh— oh, that stings—'],
    struggling: ['I only wanted to see where the stream went—', 'Ah! I’m sorry— I’m sorry—'],
    edge: ['I didn’t know it was dangerous— I never know— please—', 'Please— I’ll stay where you can see me—'],
    past: ['I’m sorry— I’m so sorry— I won’t go past the wall again—'],
    plead: ['Silas—', 'Please—'],
    spent: ['…', 'Mm…', '…'],
    accept: ['Yes. I understand now.', 'I know. I’ll remember.'],
    flushed: ['Oh— I’m all warm. Don’t look.', 'My face is burning.'],
    soothe: ['…oh. That’s nice.', 'That’s gentler. Thank you.'],
    defy: ['But it was so beautiful.', 'You can’t keep me in. I’ve been kept in.'],
    yield: ['…I know. It isn’t a tower. It’s a rule. I’ll keep it.', 'All right. All right. I’ll stay close.'],
    word: '{word}! {word}— please stop.',
    end: ['…I’ll stay where you can see me.', '…It doesn’t feel like the tower. It feels like someone minded.'],
  },
  snow: {
    start: ['I know. I opened the gate. He looked so tired.', 'I’m sorry. I know. I really do know.'],
    first: ['Oh!', 'Ow—!'],
    flinching: ['I won’t open it— I won’t—', 'Oh— that’s— ow—'],
    struggling: ['He said he was only a pedlar! He had ribbons!', 'Ah! I’m sorry, I’m sorry—'],
    edge: ['I just can’t say no to anyone— I can’t— please—', 'Please— I’ll call you first, every time—'],
    past: ['I’m sorry— I didn’t mean to let her find me— I’m sorry—'],
    plead: ['Silas—', 'Please—'],
    spent: ['…', 'Mm…', '…'],
    accept: ['Yes. I’ll learn to say no.', 'I know. You’re keeping me safe.'],
    flushed: ['Oh, don’t look at me, I must look a fright.', 'My face! Don’t look at it.'],
    soothe: ['…oh, that’s lovely.', 'Mm. You do care. I knew you did.'],
    defy: ['She only wanted to sell me laces!', 'You can’t expect me to be rude to people.'],
    yield: ['…All right. I’ll say no. Even when they smile.', 'You’re right. You’re right. I’ll call you first.'],
    word: '{word}— {word}, please stop!',
    end: ['…Do you still like me?', '…I’ll latch the gate. I promise.'],
  },
  // (the prologue's false bride: proud and sharp in the borrowed gown, holding in all she feels, till it breaks; what she calls Silas, the
  // steward, and then Mr Fenwick)
  cicely: {
    start: ['Get it over with, then. I won’t cry for you, steward.', 'Do it. You’ll not have the satisfaction.', 'A steward. Of all the— fine. Fine.'],
    first: ['Ah—!', 'Oh! You—'],
    flinching: ['That’s nothing. That’s— nothing.', 'Is that all a steward has in him?'],
    struggling: ['Stop— you’ve made your point—', 'Enough— I said enough—'],
    edge: ['I know what I did— I know— please—', 'I made her swear— I made her— I’m sorry—'],
    past: ['I’m sorry— I took everything of hers— everything—'],
    plead: ['Please—', 'Mr Fenwick— please—', 'Please, sir—'],
    spent: ['…', '…oh…', 'Mm…'],
    accept: ['Yes. I earned it. Every bit of it.', 'I know. I know what I did to her.'],
    flushed: ['Don’t look at me.', 'Don’t— I’d rather you didn’t see me like this.'],
    soothe: ['…Why are you being kind?', '…That helps. I don’t deserve that it helps.'],
    defy: ['She never had to earn any of it! Not one thing!', 'Twenty years I dressed her. One week of being her, and I’m the thief?', 'You’d not dare if I were still the bride.'],
    yield: ['…All right. All right. I was wrong. I was wicked to her.', 'Stop— I’ll say it. I wronged her. I wronged her.'],
    word: '{word}! {word}— please— I can’t—',
    end: ['…I named that. Out of my own mouth.', '…It’s done, then.'],
  },
};

// Aftercare: the conversation once it's over. Her opening line (by outcome: done, or word if she called it; or, if it ended with her defiance
// still standing, unbroken: short, guarded), three ways Silas can answer (reassure her; say why it mattered, in his own words to each; ask how
// she is), each with her reply; then what she's to do with the rest of the day, with her answer; and a last word.
const APPROACH = [
  { id: 'reassure', label: 'Reassure her', captain: ['It’s done. It stays done. You’re all right, and so are we.', 'Come here. It’s over, and nobody’s going anywhere.'] },
  { id: 'explain', label: 'Say why it mattered' },
  { id: 'ask', label: 'Ask how she is', captain: ['Talk to me. How are you, truly?', 'Breathe first. Then tell me where you are.'] },
];
const ORDERS = [
  { id: 'rest', label: 'Rest', captain: 'You’re done for today. Bed, water, and sleep. I’ll have a tray sent up.' },
  { id: 'supper', label: 'Eat with me', captain: 'Kitchen. You’ll eat something warm in front of me, and we’ll not talk about it.' },
  { id: 'fire', label: 'Sit by the fire', captain: 'Sit with me by the fire a while. Nothing’s needed of you for an hour.' },
  { id: 'work', label: 'Back to work', captain: 'Back to your work when you’re ready. Not before. I’ll look in on you at dusk.' },
];
const AFTER = {
  goldie: {
    open: { done: ['…Ow. That was a great deal of hand.', '…I think I can feel my own heartbeat. In odd places.'], word: ['I said it. I’m sorry. It was— too much, all at once.'], unbroken: ['Are we finished? I’ve a chair to mend, apparently.', 'Fine. Can I go?'] },
    why: 'You walk into things as if nothing in the world belongs to anyone. Some of it belongs to people who’ll hurt you for it. I’d rather it was me, and this.',
    reply: { reassure: '…You’re not going to send me home?', explain: 'I know. I don’t think. I see a thing and I’m already there.', ask: 'Sore. Embarrassed. And— strangely sort of settled? Don’t laugh.' },
    order: { rest: 'Bed. In the daytime. My mother would faint.', supper: 'Is there porridge? …That’s a joke. Mostly.', fire: 'All right. I’ll sit. I’ll even sit still.', work: 'I’ll do the guest rooms. Properly. Corners and all.' },
    close: '…Thank you. Sir.',
  },
  red: {
    open: { done: ['…I’m all right. I’m all right.', 'That was worse than the wolf. Almost.'], word: ['I’m sorry. I had to say it. It was too much.'], unbroken: ['Can I go home now?', 'Fine. I heard you.'] },
    why: 'I promised your mother I’d keep an eye on you. I can’t do that if you’re three fields off the path chasing foxgloves.',
    reply: { reassure: '…Thank you. I needed to hear you say it.', explain: 'I know. It’s just— it’s the only time nobody wants anything from me.', ask: 'Shaky. Warm. Like after a long walk home.' },
    order: { rest: 'Mother will want to know why. …I’ll tell her I was tired. It’s true.', supper: 'Only if I can bring the bread. It’s better than your cook’s.', fire: 'I’d like that. Will you tell me about the tracks again?', work: 'Grandmother’s basket. On the path. The whole way.' },
    close: '…Thank you, Silas.',
  },
  belle: {
    open: { done: ['…Well. That was instructive.', '…Give me a moment. I am composing myself.'], word: ['I said it. You stopped. I hadn’t been sure you would.'], unbroken: ['If we’re finished, the accounts are waiting.', 'I believe the point is recorded.'] },
    why: 'There’s rot in that wing. Floors that won’t hold. I didn’t lock it to keep you from my secrets. I locked it to keep you.',
    reply: { reassure: '…You needn’t. But— thank you.', explain: 'I know. I knew. I went because it was forbidden, and I don’t like being forbidden things.', ask: 'Humiliated. Sore. And— lighter, which is irritating.' },
    order: { rest: 'I don’t nap. …I’ll lie down with a book.', supper: 'You’ll talk about the rents. You always talk about the rents.', fire: 'All right. You may sit. I’ll read.', work: 'The quarter-day accounts. I was halfway through Michaelmas.' },
    close: '…Thank you, Silas.',
  },
  cinderella: {
    open: { done: ['…I’m all right, sir.', '…I’m sorry to have been such trouble.'], word: ['I’m sorry, sir. I didn’t mean to stop you. I just— couldn’t.'], unbroken: ['May I go back to the laundry, sir?', 'It doesn’t matter, sir.'] },
    why: 'You are not a pair of hands, Eleanor. I pay for your work, and I will not have it bought with you.',
    reply: { reassure: '…No one’s ever said that to me after.', explain: 'I know. I just— if I’m working, nobody minds me.', ask: 'Tired. Very tired. And— it’s strange— I don’t feel I have to hide it.' },
    order: { rest: 'Rest. In the day. …Yes, sir. If you’re sure.', supper: 'Sit at the table? Not stand? …All right.', fire: 'Just sit? …I’ll try. You may have to remind me.', work: 'I’ll stop at dusk. I promise. I’ll stop.' },
    close: '…Thank you, sir.',
  },
  gretel: {
    open: { done: ['…Well. That happened.', '…All right. All right. I’m done lying. For today.'], word: ['I said it. Didn’t think you’d actually stop.'], unbroken: ['Are we done? Hansel needs his broth.', 'Fine. Noted.'] },
    why: 'There will be a next meal, Gretel. And one after that. You don’t have to steal what’s already yours.',
    reply: { reassure: '…Huh. All right.', explain: 'I know. I hear it. It’s just— my hands don’t believe it yet.', ask: 'Sore. Fed, though. That’s new.' },
    order: { rest: 'Rest. With Hansel? …All right.', supper: 'You’re buying. …You know what I mean.', fire: 'I’ll sit. But I’m keeping my boots on.', work: 'The larder. I’ll count it out loud, so you know.' },
    close: '…Thanks. Sir.',
  },
  rapunzel: {
    open: { done: ['…It’s over? Oh. It’s over.', '…That was very loud. Inside, I mean.'], word: ['I said it. Was that right? You stopped. You really stopped.'], unbroken: ['May I go back to the garden?', '…I don’t want to talk.'] },
    why: 'The world’s bigger than your window, and not all of it is kind. I want you to have all of it. I want you to come back from it.',
    reply: { reassure: '…Thank you. That’s the nicest part.', explain: 'I know. I just— there’s so much, and I’ve only ever seen it from up high.', ask: 'Stingy. Floaty. Like the first time I stood in rain.' },
    order: { rest: 'I’ll lie in the garden room. With the window open.', supper: 'Will you show me which knife?', fire: 'Can I ask you questions? About everything?', work: 'The feverfew needs thinning. I’ll stay inside the wall.' },
    close: '…Thank you, Silas.',
  },
  snow: {
    open: { done: ['…Do you still like me?', '…Is my face all blotchy?'], word: ['I said it. I’m sorry. I couldn’t bear any more.'], unbroken: ['Are you cross with me still?', 'I don’t want to talk about it.'] },
    why: 'She will send people who smile, Snow. Every one of them will be kind to you. That’s what makes them dangerous.',
    reply: { reassure: '…Oh, thank goodness.', explain: 'I know. I know. I just— I can’t bear anyone thinking I’m unkind.', ask: 'Sore. Silly. Safe. Mostly safe.' },
    order: { rest: 'Will Belle sit with me?', supper: 'I’ll sit next to you. Not Belle. Me.', fire: 'Only if you tell me I did well. After.', work: 'Gate drill. I’ll do it twice. With the latch.' },
    close: '…Thank you, Silas.',
  },
  cicely: {
    open: { done: ['…I thought you’d be cruel. You weren’t. That’s worse, somehow.', '…I’d have had her thrashed and turned out. And you— that was all.'], word: ['I said it. Her name. I’m sorry— I couldn’t. I’ll go.'], unbroken: ['Is that the sentence served? Then I’ll take my nothing and go.'] },
    why: 'You made a lady tend geese and swear herself silent, and you’d have seen her turned out with nothing. Better you feel the weight of it once, from me, than carry it lightly the rest of your life.',
    reply: { reassure: '…You’re not turning me out?', explain: 'I know. I watched her be given everything, all my life. I wanted one thing to be mine, and I took all of it.', ask: 'Sore. Ashamed. …Lighter, somehow. I don’t understand that.' },
    order: { rest: 'I don’t know where I’m to sleep now. …Thank you.', supper: 'I can’t eat in front of you. …I’ll try.', fire: 'I’ll sit. If you’ll let me.', work: 'Give me something honest to do. Anything.' },
    close: '…Thank you, Mr Fenwick.',
  },
};
// The terms (the GDD's intervention scene, the first time she's taken in hand): Silas sets out what he expects and what he'll do; she agrees,
// or she doesn't and it ends there; and she chooses her word, which stops anything at once. Steps for js/talk.js: lines, then her answer.
const TERMS = {
  goldie: [
    { who: 'captain', text: 'You broke a chair worth more than your father’s shop, and you slept in my bed. The reeve can settle that, or I can.' },
    { who: 'subject', text: 'You, then. What does that mean?' },
    { who: 'captain', text: 'It means you answer to me. When you’re careless, I correct you myself, the old way, and then it’s done. And you work off the chair.' },
    { who: 'subject', text: '…And if I say no?' },
    { who: 'captain', text: 'Then you go home and the reeve hears it. Your choice. Think on it, and talk to your parents first.' },
  ],
  red: [
    { who: 'captain', text: 'I told your mother I’d keep an eye on you. In my wood, that means you keep to my rules. If you don’t, I’ll correct you. Not her. Me.' },
    { who: 'subject', text: 'You’d really— you’d do that?' },
    { who: 'captain', text: 'Like someone I don’t want to find in pieces at the bottom of a gully. You can say no. Then I walk you to the edge and no further.' },
  ],
  belle: [
    { who: 'captain', text: 'You’ll keep my books, dine at my table and want for nothing. One condition: the West Wing is closed to you. If you test it, I’ll answer it myself.' },
    { who: 'subject', text: 'Answer it how, precisely?' },
    { who: 'captain', text: 'The way a guardian does. Firmly, and in private. You may refuse. The debt is settled either way; I’ll not hold your father to ransom with you.' },
  ],
  cinderella: [
    { who: 'captain', text: 'You live here now. Your wages come to you. In return: you rest when I say, you eat what’s put in front of you, and you’re in by curfew. Break that, and I’ll correct you for it.' },
    { who: 'subject', text: 'Yes, sir.' },
    { who: 'captain', text: 'Not yes, sir. I want an answer you’ve thought about. You can say no to me, Eleanor. Practise it now, if you like.' },
  ],
  gretel: [
    { who: 'captain', text: 'You’ll eat in my kitchen, every day, and your brother with you. You’ll not steal, you’ll not lie to me, and you’ll not set a snare on my land. Do, and I’ll correct you myself.' },
    { who: 'subject', text: 'And if I don’t like your terms?' },
    { who: 'captain', text: 'Then you still eat tonight, and Hansel stays till he’s mended. The terms are for staying.' },
  ],
  rapunzel: [
    { who: 'captain', text: 'You’re free to go anywhere in the grounds. Past the garden wall, past the brook, only with someone. If you wander off, I’ll correct you for it. Firmly, and kindly.' },
    { who: 'subject', text: 'Gothel said I was safe because I couldn’t leave.' },
    { who: 'captain', text: 'You can leave. That’s the difference. These are terms you choose, and you can unchoose them.' },
  ],
  snow: [
    { who: 'captain', text: 'While you’re under my roof, you open no gate and take nothing from anyone I haven’t seen. If you do, I correct you. It may save your life.' },
    { who: 'subject', text: 'You make it sound very grim.' },
    { who: 'captain', text: 'It is grim. You may still say no. I’ll protect you either way; the terms are how you help me do it.' },
  ],
  // (the prologue: in his office, after the master's decree. She pleads; he sets his terms, and gives her the word himself: the mare she had
  // sold away. Its own whole conversation: AGREE has nothing for her)
  cicely: [
    { who: 'subject', text: 'Please. Not that. Not what I said— I didn’t know it was me I was sentencing.' },
    { who: 'captain', text: 'You knew what you’d done to her. And you’d have had that done to her.' },
    { who: 'subject', text: '…What will you do with me?' },
    { who: 'captain', text: 'If you want clemency, you’ll submit to me. A correction at my hand, measured. Not the sentence you named.' },
    { who: 'captain', text: 'And if it’s ever too much, say the mare’s name. {word}. It stops at once, and you go on your way, and no one will stop you.' },
    { who: 'subject', text: '…Her name. You’d have me say her name.' },
    { who: 'captain', text: 'Only if you need it.' },
    { who: 'subject', text: '…I submit.' },
  ],
};
// (her agreement, and her word: the same shape for all, in her voice)
const AGREE = {
  goldie: ['…Fine. I’ll do it. But I pick the word.', 'Then it’s {word}. Because it pricks.'],
  red: ['…All right. I’d rather it was you.', 'My word’s {word}. For the one Grandmother leaves in the window.'],
  belle: ['…Very well. I accept your terms.', '{word}. I trust you’ll remember it.'],
  cinderella: ['…Yes. I’ve thought. Yes.', '{word}. It’s the only warm thing I ever had of my own.'],
  gretel: ['…Fine. Deal. But Hansel stays either way.', '{word}. Like the ones we dropped. Didn’t work then either.'],
  rapunzel: ['…Yes. I choose them.', '{word}. It grows by the wall. I can see it from anywhere.'],
  snow: ['…Yes. I want to stay. I want to be good at it.', '{word}. It sounds strong. I’d like to be.'],
};
const WORD_ASK = 'And a word. If it’s ever more than you can bear, you say it, and it stops at once. Whatever it is, wherever we are.';

const WHO = { silas: { short: 'Silas', word: '' }, captain: { short: 'Silas', word: '' } };
const fill = (t, id) => { const C = root.Cast, r = (C && C.ROSTER[id]) || WHO[id] || WHO.silas; return t.replace(/\{word\}/g, r.word).replace(/\{name\}/g, r.short); };
function place(id, position) { return fill(pick(PLACE[position] || PLACE.otk), id); }
function react(id, key) { const R = REACT[id]; if (!R || !R[key]) return null; return fill(pick(R[key]), id); }
// (anyone without lines of their own (the prologue's Adela, never corrected), an aftercare in few words, and terms without her own reasons)
const AFTER_ANY = {
  open: { done: ['…', '…It’s over.'], word: ['I said it. I’m sorry.'], unbroken: ['…Are we finished?'] },
  why: 'It mattered, so I dealt with it. Now it’s done, and it stays done.',
  reply: { reassure: '…Thank you.', explain: '…I understand.', ask: '…Sore. Better than I was.' },
  order: { rest: 'Yes.', supper: 'Yes, sir.', fire: 'All right.', work: 'Yes. I’ll go back to it.' },
  close: '…Thank you.',
};
const TERMS_ANY = [{ who: 'captain', text: 'You answer to me. When it’s needed, I correct you myself, and then it’s done.' }];
function captain(key, id) { return CAPTAIN[key] ? fill(pick(CAPTAIN[key]), id) : null; }
// The aftercare conversation, as steps for the page to play (js/talk.js): { who: 'subject' | 'captain', text } lines, and { choose: [{ label,
// then: [...] }] }: what Silas says, explored (any or all of reassuring her, saying why it mattered, asking how she is), then what she's to do
// with the rest of the day, one of them.
// (mood 'unbroken': it ended with her defiance still standing; the safe word's opening comes first all the same)
function after(id, outcome, mood) {
  const A = AFTER[id] || AFTER_ANY, k = outcome === 'word' ? 'word' : mood === 'unbroken' && A.open.unbroken ? 'unbroken' : 'done', open = pick(A.open[k]);
  const said = a => (a.id === 'explain' ? A.why : pick(a.captain));
  return [
    { who: 'subject', text: fill(open, id), expr: k === 'word' ? 'sad' : k === 'unbroken' ? (id === 'cinderella' || id === 'rapunzel' ? 'sad' : 'defiant') : 'teary' },
    { explore: true, choose: APPROACH.map(a => ({ label: a.label, approach: a.id, then: [{ who: 'captain', text: fill(said(a), id) }, { who: 'subject', text: fill(A.reply[a.id], id), expr: a.id === 'reassure' ? 'teary' : a.id === 'explain' ? 'concerned' : 'wistful' }] }))
      .concat([{ label: 'Tell her what’s next', end: true, then: [] }]) },
    { choose: ORDERS.map(o => ({ label: o.label, order: o.id, then: [{ who: 'captain', text: fill(o.captain, id) }, { who: 'subject', text: fill(A.order[o.id], id), expr: 'soft' }] })) },
    { who: 'subject', text: fill(A.close, id), expr: 'soft' },
  ];
}
// The terms, as steps: Silas's terms and her questions, then he asks for her word, and she agrees and gives it. (Whether she can decline here,
// and what follows if she does, is the chapter's to script: docs/alpha-plan.md.)
function terms(id) {
  const T = TERMS[id] || TERMS_ANY, A = AGREE[id], steps = T.map(s => ({ who: s.who, text: fill(s.text, id) }));
  if (TERMS[id] && !A) return steps;      // (her terms whole, the word given her in them: Cicely's)
  if (!A) return steps.concat([{ who: 'captain', text: WORD_ASK }]);
  return steps
    .concat([{ who: 'subject', text: fill(A[0], id) }, { who: 'captain', text: WORD_ASK }, { who: 'subject', text: fill(A[1], id) }, { who: 'captain', text: fill('{word}, then. Say it and I stop.', id) }]);
}

const api = { PLACE, CAPTAIN, REACT, AFTER, APPROACH, ORDERS, TERMS, AGREE, place, captain, react, after, terms };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Lines = api;
})(typeof window !== 'undefined' ? window : globalThis);
