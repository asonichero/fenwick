// The player: their name, as they give it on the prologue's first card (Silas Fenwick unless they change it), kept in the browser. Their first
// name is what they're called in the scenes; their surname names the hall they inherit ("Fenwick Hall").
//
//   Player.get() → { first, last } · Player.set({ first, last }) · Player.hall() → 'Fenwick Hall' · Player.fill('Now, {first}.') → 'Now, Silas.'
//   Player.clean(s, fallback): a name as typed, tidied (letters, spaces, hyphens and apostrophes; each word capitalised; at most 24 letters)
(function (root) {
'use strict';
const KEY = 'fenwick:player', DEFAULT = { first: 'Silas', last: 'Fenwick' };
const store = () => { try { return root.localStorage || null; } catch (e) { return null; } };
function clean(s, fallback) {
  const t = String(s == null ? '' : s).replace(/[^\p{L}\p{M}' \-’]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return t ? t.replace(/(^|[\s\-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()) : fallback;
}
function get() {
  let v = null; const ls = store();
  try { v = ls && JSON.parse(ls.getItem(KEY) || 'null'); } catch (e) { v = null; }
  return { first: clean(v && v.first, DEFAULT.first), last: clean(v && v.last, DEFAULT.last) };
}
function set(v) {
  const n = { first: clean(v && v.first, DEFAULT.first), last: clean(v && v.last, DEFAULT.last) }, ls = store();
  try { if (ls) ls.setItem(KEY, JSON.stringify(n)); } catch (e) { /* not kept: private window */ }
  return n;
}
const hall = n => `${(n || get()).last} Hall`;
// (a script's text with the player's name put in: {first}, {last}, {full}, {hall})
const fill = (text, n) => { n = n || get(); return String(text).replace(/\{(first|last|full|hall)\}/g, (m, k) => (k === 'full' ? `${n.first} ${n.last}` : k === 'hall' ? hall(n) : n[k])); };

root.Player = { KEY, DEFAULT, get, set, hall, fill, clean };
})(typeof window !== 'undefined' ? window : globalThis);
