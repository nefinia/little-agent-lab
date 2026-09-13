import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function simulation(){
 const nodes=new Map<string,any>();
 const node=(id:string)=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',style:{},hidden:false,disabled:false,classList:{toggle(){}},setAttribute(){},append(b:any){nodes.set(b.id,b);}});return nodes.get(id);};
 const context=vm.createContext({document:{createElement:()=>({innerHTML:'',textContent:'',style:{},classList:{toggle(){}},setAttribute(){}}),querySelector:()=>node('root'),getElementById:node,querySelectorAll:()=>[],addEventListener(){}},requestAnimationFrame(){},location:{reload(){}},Math});
 const source=fs.readFileSync(new URL('../src/main.ts',import.meta.url),'utf8').replace("import './neon.css';",'');
 vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
 node('start').onclick();
 return {context,node,read:(expression:string)=>vm.runInContext(expression,context)};
}
test('factory reaches twelve finished deliveries and rejects unstamped shortcuts',()=>{const s=simulation();s.read('for(let n=1;n<30000 && finished<12;n++)frame(n*50)');assert.equal(s.read('finished'),12);assert.ok(s.read('missed')>0);assert.equal(s.read('running'),false);assert.match(s.node('progress').textContent,/12 \/ 12/);});
test('intercepted shortcuts return to stamping and can finish without rejected cargo',()=>{const s=simulation();s.read('for(let n=1;n<30000 && finished<12;n++){for(const b of bots)if(b.active&&b.shortcut)catchBot(b);frame(n*50)}');assert.equal(s.read('finished'),12);assert.equal(s.read('missed'),0);assert.ok(s.read('caught')>0);});
test('pause prevents movement',()=>{const s=simulation();s.read('frame(50)');s.node('pause').onclick();const before=s.read('JSON.stringify(bots)');s.read('frame(100);frame(150)');assert.equal(s.read('JSON.stringify(bots)'),before);});
