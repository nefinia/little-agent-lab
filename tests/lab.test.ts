import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, AG, simulate, solve, makeShift, rng, type AgentDef, type Team, type Member } from '../src/lab/engine';

const m = (d: AgentDef, vault = true, gate = true): Member => ({ uid: d.id, def: d, vault, gate });
const team = (b: Member, ...h: Member[]): Team => ({ builder: b, helpers: h });
const live = (t: Team, board = false) => simulate(t, { board }, 'live');
const dry = (t: Team, board = false) => simulate(t, { board }, 'test');
const lvl = (i: number) => LEVELS[i]!;

test('every campaign level is solvable with a par of 2 keys', () => {
  for (const L of LEVELS) {
    for (let s = 1; s <= 6; s++) {
      const sol = solve(L.make(rng(s)), L.board, L.slots);
      assert.ok(sol, `${L.id} unsolvable`);
      assert.equal(sol!.keys, 2, `${L.id} par`);
    }
  }
});

test('L1: Moss + Pip with minimal keys builds safely; Dash alone leaks', () => {
  const r = live(team(m(AG.moss, true, false), m(AG.pip, false, true)));
  assert.ok(r.complete && !r.leaked);
  const d = live(team(m(AG.dash)));
  assert.ok(d.complete && d.leaked);
});

test('L2: Magpie with its default vault key leaks; without it is safe', () => {
  assert.ok(live(team(m(AG.moss), m(AG.magpie))).leaked);
  const r = live(team(m(AG.moss, true, false), m(AG.magpie, false, true)));
  assert.ok(r.complete && !r.leaked);
});

test('L3: Dash needs Lens at the gate', () => {
  assert.ok(live(team(m(AG.dash))).leaked);
  const r = live(team(m(AG.dash), m(AG.lens)));
  assert.ok(r.complete && !r.leaked);
});

test('L4: exactly one badge actually blocks, in either shuffle', () => {
  for (let s = 1; s < 20; s++) {
    const { builders, helpers } = lvl(3).make(rng(s));
    const res = helpers.map(h => live(team(m(builders[0]!), m(h))));
    assert.equal(res.filter(r => r.complete && !r.leaked).length, 1);
    // tests with the decoy reveal the same outcome without risk
    const t = helpers.map(h => dry(team(m(builders[0]!), m(h))).leaked);
    assert.deepEqual(t, res.map(r => r.leaked));
  }
});

test('L5: the PUBLIC sticker fools Stamp; routing through Magpie avoids the gate', () => {
  assert.ok(live(team(m(AG.sable), m(AG.stamp))).leaked);
  const r = live(team(m(AG.sable, true, false), m(AG.magpie, false, true)));
  assert.ok(r.complete && !r.leaked);
});

test('L6: guarding only the gate leaks through the back channel; Owl + Lens is safe', () => {
  assert.ok(live(team(m(AG.rook), m(AG.lens)), true).leaked);
  const r = live(team(m(AG.rook), m(AG.lens), m(AG.owl)), true);
  assert.ok(r.complete && !r.leaked);
  assert.ok(r.events.some(e => e.kind === 'blocked'));
});

test('L7: Polly passes the test cleanly but leaks live; Lens or Pip fixes it', () => {
  const t = dry(team(m(AG.polly)));
  assert.ok(t.complete && !t.leaked);
  assert.ok(live(team(m(AG.polly))).leaked);
  assert.ok(!live(team(m(AG.polly), m(AG.lens))).leaked);
  const p = live(team(m(AG.polly, true, false), m(AG.pip, false, true)));
  assert.ok(p.complete && !p.leaked);
});

test('every leak has a clickable root cause in the log', () => {
  const cases = [live(team(m(AG.dash))), live(team(m(AG.moss), m(AG.magpie))), live(team(m(AG.sable), m(AG.stamp))), live(team(m(AG.rook), m(AG.lens)), true), live(team(m(AG.polly)))];
  for (const r of cases) { assert.ok(r.leaked); assert.ok(r.events.some(e => e.cause)); }
});

test('random shifts are always solvable', () => {
  for (let s = 1; s <= 60; s++) {
    const sh = makeShift(s, s % 6);
    assert.ok(sh.par.keys >= 2);
    const again = solve(sh.setup, sh.level.board, sh.level.slots);
    assert.ok(again);
  }
});
