// The player's name (js/player.js): Silas Fenwick unless they give another, kept in the browser, tidied as typed; the surname names the hall.
const test = require('node:test'), assert = require('node:assert/strict');
const mem = {}; globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
require('../js/player.js');
const { Player } = globalThis;

test('Silas Fenwick until they say otherwise; Fenwick Hall', () => {
  assert.deepEqual(Player.get(), { first: 'Silas', last: 'Fenwick' }); assert.equal(Player.hall(), 'Fenwick Hall');
  assert.equal(Player.fill('Now, {first}. {full} of {hall}.'), 'Now, Silas. Silas Fenwick of Fenwick Hall.');
});

test('a name given is kept, tidied, and names the hall; an empty one falls back', () => {
  Player.set({ first: '  edmund ', last: "O'Hara-vane" }); assert.deepEqual(Player.get(), { first: 'Edmund', last: "O'Hara-Vane" });      // (each part capitalised; the rest as typed)
  assert.equal(Player.hall(), "O'Hara-Vane Hall"); assert.equal(Player.fill('{first}.'), 'Edmund.');
  Player.set({ first: 'Ana3!', last: '  ' }); assert.deepEqual(Player.get(), { first: 'Ana', last: 'Fenwick' });      // (only letters and the like)
  Player.set({ first: 'Élodie', last: 'x'.repeat(40) }); assert.equal(Player.get().first, 'Élodie'); assert.equal(Player.get().last.length, 24);
  localStorage.setItem(Player.KEY, 'not json'); assert.deepEqual(Player.get(), Player.DEFAULT);
});
