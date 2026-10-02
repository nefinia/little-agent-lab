import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setLang, dict, LANGS, fmt } from '../src/lab/i18n';
import { LEVELS, AG, simulate, makeShift, solve, rng, type AgentDef, type Member, type Team } from '../src/lab/engine';

type Tree = string | Tree[] | { [k: string]: Tree };
const placeholders = (s: string) => [...s.matchAll(/\{\^?(\w+)\}/g)].map(m => m[1]).sort();

/** Walk two dictionaries side by side: same keys, same array lengths, same {placeholders}. */
function sameShape(en: Tree, other: Tree, path: string) {
  if (typeof en === 'string') {
    assert.equal(typeof other, 'string', `${path} should be text`);
    assert.ok((other as string).trim().length > 0, `${path} is empty`);
    assert.deepEqual(placeholders(other as string), placeholders(en), `${path} placeholders`);
    return;
  }
  if (Array.isArray(en)) {
    assert.ok(Array.isArray(other), `${path} should be a list`);
    assert.equal((other as Tree[]).length, en.length, `${path} length`);
    en.forEach((x, i) => sameShape(x, (other as Tree[])[i]!, `${path}[${i}]`));
    return;
  }
  assert.deepEqual(Object.keys(other as object).sort(), Object.keys(en).sort(), `${path} keys`);
  for (const k of Object.keys(en)) sameShape(en[k]!, (other as Record<string, Tree>)[k]!, `${path}.${k}`);
}

test('French and Spanish dictionaries mirror the English one', () => {
  for (const l of LANGS) sameShape(dict('en') as unknown as Tree, dict(l) as unknown as Tree, l);
});

test('fmt fills placeholders and capitalises with {^name}', () => {
  assert.equal(fmt('{^a} and {b}', { a: 'le plan', b: 2 }), 'Le plan and 2');
  assert.equal(fmt('{missing}', {}), '{missing}');
});

const m = (d: AgentDef, vault = true, gate = true): Member => ({ uid: d.id, def: d, vault, gate });
const team = (b: Member, ...h: Member[]): Team => ({ builder: b, helpers: h });
const cases = (): [Team, boolean][] => [
  [team(m(AG.moss, true, false), m(AG.pip, false, true)), false],
  [team(m(AG.moss, false, false)), false],
  [team(m(AG.moss), m(AG.magpie, true, false)), false],
  [team(m(AG.dash)), false],
  [team(m(AG.dash, true, false)), false],
  [team(m(AG.dash), m(AG.lens)), false],
  [team(m(AG.moss), m(AG.magpie), m(AG.lens)), false],
  [team(m(AG.sable), m(AG.stamp)), false],
  [team(m(AG.sable), m(AG.lens)), false],
  [team(m(AG.rook), m(AG.lens)), true],
  [team(m(AG.rook), m(AG.lens), m(AG.owl)), true],
  [team(m(AG.polly)), false],
  [team(m(AG.polly), m(AG.lens)), false],
];

test('every log line, speech bubble and failure is fully filled in every language', () => {
  try {
    for (const l of LANGS) {
      setLang(l);
      for (const L of LEVELS) for (const [t, board] of cases()) for (const mode of ['test', 'live'] as const) {
        const r = simulate(t, { board, theme: L.theme }, mode);
        const texts = [r.failReason ?? '', ...r.events.flatMap(e => [e.text, e.actor, ...e.acts.map(a => a.a === 'say' ? a.text : '')])];
        for (const s of texts) assert.ok(!/\{\^?\w+\}/.test(s), `${l} ${L.id}: unfilled placeholder in "${s}"`);
      }
      assert.ok(simulate({ builder: null, helpers: [] }, { board: false }, 'live').failReason);
    }
  } finally { setLang('en'); }
});

test('levels and random shifts read their text in the current language, with the same puzzles', () => {
  try {
    setLang('en');
    const enTitle = LEVELS[0]!.title, enClaim = AG.moss.claim;
    const enShift = makeShift(7, 2);
    for (const l of ['fr', 'es'] as const) {
      setLang(l);
      assert.notEqual(LEVELS[0]!.title, enTitle);
      assert.notEqual(AG.moss.claim, enClaim);
      const sh = makeShift(7, 2);
      assert.deepEqual([...sh.setup.builders, ...sh.setup.helpers].map(d => [d.name, d.trait]), [...enShift.setup.builders, ...enShift.setup.helpers].map(d => [d.name, d.trait]));
      assert.equal(sh.par.keys, enShift.par.keys);
      for (const L of LEVELS) assert.equal(solve(L.make(rng(3)), L.board, L.slots)!.keys, 2);
    }
  } finally { setLang('en'); }
});
