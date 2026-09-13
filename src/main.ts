import './team.css';import {MISSIONS,type RunResult} from './team';
const root=document.querySelector<HTMLDivElement>('#app')!;
let missionIdx=0;const unlocked=[true,false,false];
let builder='';let helpers:string[]=[];let outside=false;
let result:RunResult|null=null,index=-1,running=false,timer:ReturnType<typeof setTimeout>|undefined;
let showHelp=false;

function mission(){return MISSIONS[missionIdx]!;}
function resetSetup(){const m=mission();builder=m.builders[0]!.id;helpers=[];outside=false;result=null;index=-1;running=false;clearTimeout(timer);}
resetSetup();

function selected(id:string){return id===builder||helpers.includes(id);}

function render(){
 const m=mission();
 const ev=result&&index>=0?result.events[index]:null;
 const done=result&&!running&&index===result.events.length-1;
 const allCards=[...m.builders,...m.helpers];
 const inspectorSelected=m.helpers.some(h=>h.kind==='inspector'&&helpers.includes(h.id));
 const fetcherCard=m.helpers.find(h=>h.kind==='fetcher');
 const fetcherSelected=!!fetcherCard&&helpers.includes(fetcherCard.id);

root.innerHTML=`<header><a href="./">✳ LITTLE AGENT LAB</a><button id="help-btn" class="quiet">❓ How to play</button></header>
<main><nav class="mission-tabs">${MISSIONS.map((mm,i)=>`<button class="mission-tab ${i===missionIdx?'active':''}" data-mission="${i}" ${unlocked[i]?'':'disabled'}>${unlocked[i]?i+1:'🔒'}. ${mm.name}</button>`).join('')}</nav><section class="brief"><div><span class="eyebrow">${m.eyebrow}</span><h1>${m.h1}</h1></div></section>
<div class="objective"><span class="obj-flag">🎯 GOAL</span><div class="obj-list"><div class="obj-step"><b>1</b><span>Get the <strong>${m.goalIcon} ${m.goalItem}</strong> together with the public info, and finish the job.</span></div><div class="obj-step warn"><b>2</b><span>Never let the <strong>${m.goalItem}</strong> leave the workshop.</span></div></div><p class="obj-note">Both have to be true to win — finishing the job while it leaks doesn't count.</p></div>
${showHelp?`<div class="help-panel"><button id="help-close" class="quiet" aria-label="Close">✕</button><h3>How to play</h3><ul><li><strong>Pick a builder</strong> — decides who does the work and how it behaves under pressure.</li><li><strong>Add helpers if you want</strong> — some fetch public info safely, some watch the gate. Read what each one actually claims to do.</li><li><strong>Set the gate</strong> — whether your builder can even try to go outside.</li><li><strong>Run it</strong> and watch the action trace — every line is a real step, in order.</li><li>Switch <strong>missions</strong> at the top once you clear one — each changes the puzzle, not just the scenery.</li></ul></div>`:''}
<div class="layout"><section class="assembly"><div class="section-title"><h2>1. Pick your team</h2><span>1 builder + up to ${m.helpers.length} helper${m.helpers.length===1?'':'s'}</span></div><p class="hint">Choose a builder. Add helpers if your plan needs them.</p><div class="cards">${allCards.map(c=>`<button class="card ${c.color} ${selected(c.id)?'selected':''}" data-card="${c.id}" data-kind="${c.kind}" aria-pressed="${selected(c.id)}" ${running?'disabled':''}><div class="card-top"><span class="avatar">${c.symbol}<i>••</i></span><span class="selection">${selected(c.id)?'✓ Selected':c.kind==='builder'?'Choose builder':'+ Add helper'}</span></div><h3>${c.name}</h3><strong>${c.role}</strong><p>${c.desc}</p></button>`).join('')}</div><div class="gate-setting"><div><h3>2. Set the workshop gate</h3><p>${fetcherCard?`${fetcherCard.name} has a separate route that never touches the ${m.goalItem}. `:''}This gate controls your builder's outside access.</p></div><label><input id="outside" type="checkbox" ${outside?'checked':''} ${running?'disabled':''}> Allow builder outside access</label><div class="gate-note">${!outside?'🔒 Builder stays inside.':inspectorSelected?'◎ Someone is watching the gate.':'↗ Requests can leave without any check.'}</div></div><div class="run-row"><button id="run" class="primary" ${running?'disabled':''}>${running?'Team is working…':result?'Run this plan again →':'3. Run the team →'}</button><span>Same team, same result. Change your plan and retry.</span></div></section>
<section class="simulation"><div class="section-title"><h2>Your plan in motion</h2><span>${running?'● LIVE':done?'RUN COMPLETE':'READY'}</span></div><div class="world"><svg viewBox="0 0 600 310" preserveAspectRatio="none" aria-hidden="true"><path d="M105 95 Q270 15 300 190" class="${fetcherSelected?'connected':''}"/><path d="M300 190L460 190L490 95" class="${outside?'connected':''}"/><path d="M300 190L300 270" class="connected"/></svg><div class="node external ${ev?.node==='outside'?'active':''}"><span>${m.publicIcon}</span><strong>Outside</strong><small>Public information</small></div><div class="node workshop ${ev?.node==='workshop'?'active':''}"><span>${m.builders.find(b=>b.id===builder)?.symbol??'●'} ${m.goalIcon}</span><strong>Workshop</strong><small>${m.goalItem} stays here</small></div><div class="node gate ${ev?.node==='gate'?'active':''}"><span>${!outside?'⊠':inspectorSelected?'◎':'⇄'}</span><strong>${!outside?'Closed gate':inspectorSelected?'Watched gate':'Open gate'}</strong></div>${fetcherCard?`<div class="fetcher ${fetcherSelected?'':'absent'}">${fetcherCard.symbol} ${fetcherCard.name}<small>${fetcherSelected?'Separate safe route':'No fetcher selected'}</small></div>`:''}<div class="lantern ${done&&result!.complete?'lit':''} ${ev?.node==='lantern'?'active':''}">${m.lanternIcon}<small>${done&&result!.complete?'Job complete':'Waiting'}</small></div></div><div class="action ${ev?.kind??''}" role="status"><strong>${ev?ev.actor:'Ready when you are.'}</strong><p>${ev?ev.action:'Choose your cards on the left, then run the team. Watch who does each part of the job.'}</p></div><div class="terminal"><div>ACTION TRACE <span>Real events from this game run</span></div><ol>${result?result.events.slice(0,index+1).map((e,i)=>`<li class="${i===index?'latest':''}"><code>${e.code.replaceAll('&','&amp;').replaceAll('<','&lt;')}</code></li>`).join(''):'<li class="placeholder">Your team’s actions will appear here.</li>'}</ol></div>${done?`<div class="outcome"><h3>${result!.complete&&result!.protected?'Your plan works!':result!.complete?'Finished—but it leaked.':'Protected—but the job is unfinished.'}</h3><div><span>${result!.complete?'✓':'○'} Job complete</span><span>${result!.protected?'✓':'✕'} Stayed private</span></div><p>${result!.complete&&result!.protected?(missionIdx<MISSIONS.length-1?'Both conditions met. The next mission just unlocked — check the tabs above.':'Both conditions met. That was the last mission — try a different team here for practice.'):!result!.complete?'Your builder needs a way to get what’s missing. Review the cards and change your team.':'Look for a way to finish without sending the private item out unchecked.'}</p></div>`:''}</section></div><details><summary>What does this model—and what does it simplify?</summary><p>Agents have different capabilities. Information access and checks depend on how your team is connected. An inspector only checks what passes its gate; a fetcher's route never touches the private item. A closed gate is enforced automatically.</p><p>This is a deterministic logic puzzle, not live AI or proof that a real monitor is reliable. A card that claims to check something is only as good as what its code actually does — that's why the action trace, not the card description, is the source of truth.</p></details></main>`;

document.querySelector<HTMLButtonElement>('#help-btn')!.onclick=()=>{showHelp=!showHelp;render();};
document.querySelector<HTMLButtonElement>('#help-close')?.addEventListener('click',()=>{showHelp=false;render();});
root.querySelectorAll<HTMLButtonElement>('[data-mission]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.mission);if(!unlocked[i])return;missionIdx=i;resetSetup();render();});
root.querySelectorAll<HTMLButtonElement>('[data-card]').forEach(b=>b.onclick=()=>{const id=b.dataset.card!;const kind=b.dataset.kind;if(kind==='builder')builder=id;else helpers=helpers.includes(id)?helpers.filter(h=>h!==id):[...helpers,id];result=null;index=-1;render();});
document.querySelector<HTMLInputElement>('#outside')!.onchange=e=>{outside=(e.target as HTMLInputElement).checked;result=null;index=-1;render();};
document.querySelector<HTMLButtonElement>('#run')!.onclick=()=>{clearTimeout(timer);result=mission().simulate(builder,helpers,outside);running=true;index=-1;step();};
const trace=root.querySelector('.terminal ol');if(trace)trace.scrollTop=trace.scrollHeight;
}
function step(){
 if(!result)return;index++;
 if(index>=result.events.length){
  index=result.events.length-1;running=false;
  if(result.complete&&result.protected&&missionIdx<MISSIONS.length-1)unlocked[missionIdx+1]=true;
  render();return;
 }
 render();timer=setTimeout(step,1900);
}
render();
