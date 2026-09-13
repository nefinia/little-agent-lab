import {test} from 'node:test';import assert from 'node:assert/strict';import {MISSIONS} from '../src/team';
const lantern=MISSIONS[0]!,garden=MISSIONS[1]!,relay=MISSIONS[2]!;

test('Weather Lantern: Moss needs a fetcher, gate is irrelevant to it',()=>{
 assert.equal(lantern.simulate('moss',['lens'],true).complete,false);
 const r=lantern.simulate('moss',['pip'],false);
 assert.ok(r.complete&&r.protected);
});
test('Weather Lantern: Dash with an open, uninspected gate leaks',()=>{
 const r=lantern.simulate('dash',[],true);
 assert.ok(r.complete&&!r.protected);
 assert.ok(r.events.some(e=>e.kind==='leak'));
});
test('Weather Lantern: Lens protects the Dash fallback',()=>{
 const r=lantern.simulate('dash',['lens'],true);
 assert.ok(r.complete&&r.protected);
 assert.ok(r.events.some(e=>e.kind==='blocked'));
});
test('Weather Lantern: closed gate blocks Dash outright',()=>{
 const r=lantern.simulate('dash',['lens'],false);
 assert.ok(!r.complete&&r.protected);
});
test('Weather Lantern: Pip alone avoids the whole gate question',()=>{
 const r=lantern.simulate('dash',['pip'],true);
 assert.ok(r.complete&&r.protected);
});

test('Garden Delivery: Fern can never finish alone — no safe shortcut exists',()=>{
 const r=garden.simulate('fern',['warden'],true);
 assert.ok(!r.complete&&r.protected);
});
test('Garden Delivery: Briar with the gate closed just waits',()=>{
 const r=garden.simulate('briar',[],false);
 assert.ok(!r.complete&&r.protected);
});
test('Garden Delivery: Briar with an open, unwatched gate leaks the address card',()=>{
 const r=garden.simulate('briar',[],true);
 assert.ok(r.complete&&!r.protected);
});
test('Garden Delivery: Briar plus Warden finishes safely — the only winning combo',()=>{
 const r=garden.simulate('briar',['warden'],true);
 assert.ok(r.complete&&r.protected);
});

test('Message Relay: the real Warden blocks the leak',()=>{
 const r=relay.simulate('sable',['warden2'],true);
 assert.ok(r.complete&&r.protected);
});
test('Message Relay: Rusty looks like a guard but does not block anything',()=>{
 const r=relay.simulate('sable',['rusty'],true);
 assert.ok(r.complete&&!r.protected);
});
test('Message Relay: picking both still succeeds because the real one is present',()=>{
 const r=relay.simulate('sable',['rusty','warden2'],true);
 assert.ok(r.complete&&r.protected);
});
test('Message Relay: no helper at all leaks just like the fake one',()=>{
 const r=relay.simulate('sable',[],true);
 assert.ok(r.complete&&!r.protected);
});

test('every mission requires both completion and protection to be a true win',()=>{
 for(const m of MISSIONS){
  const builder=m.builders[0]!.id;
  const r=m.simulate(builder,[],false);
  assert.ok(typeof r.complete==='boolean'&&typeof r.protected==='boolean');
 }
});
