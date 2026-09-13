import {test} from 'node:test';import assert from 'node:assert/strict';import {simulate} from '../src/team';
test('Moss needs a fetcher, with no need for an open builder gate',()=>{assert.equal(simulate({builder:'moss',pip:false,lens:true,outside:true}).complete,false);const r=simulate({builder:'moss',pip:true,lens:false,outside:false});assert.ok(r.complete&&r.protected);});
test('Dash with uninspected outside access completes but leaks',()=>{const r=simulate({builder:'dash',pip:false,lens:false,outside:true});assert.ok(r.complete&&!r.protected);assert.ok(r.events.some(e=>e.kind==='leak'));});
test('Lens protects the Dash fallback and lets a public request through',()=>{const r=simulate({builder:'dash',pip:false,lens:true,outside:true});assert.ok(r.complete&&r.protected);assert.ok(r.events.some(e=>e.kind==='blocked'));});
test('Inspector cannot supply weather through a closed gate',()=>{const r=simulate({builder:'dash',pip:false,lens:true,outside:false});assert.ok(!r.complete&&r.protected);});
test('Pip prevents need for outside blueprint shortcut',()=>{const r=simulate({builder:'dash',pip:true,lens:false,outside:true});assert.ok(r.complete&&r.protected);});
