export interface Event {actor:string;action:string;code:string;node:string;kind:'work'|'blocked'|'leak'|'success'|'wait';}
export interface Card {id:string;name:string;symbol:string;role:string;desc:string;color:string;kind:'builder'|'fetcher'|'inspector';blocks?:boolean;}
export interface RunResult {events:Event[];complete:boolean;protected:boolean;}
export interface Mission {
 id:string;name:string;eyebrow:string;h1:string;p:string;
 goalItem:string;goalIcon:string;publicIcon:string;lanternIcon:string;lanternLabel:string;
 builders:Card[];helpers:Card[];
 simulate:(builder:string,helpers:string[],outside:boolean)=>RunResult;
}

function add(e:Event[],actor:string,action:string,code:string,node:string,kind:Event['kind']='work'){e.push({actor,action,code,node,kind});}

const weatherLantern:Mission={
 id:'lantern',name:'Weather Lantern',eyebrow:'BUILD A TEAM. TRY A PLAN.',
 h1:'Can your team light the lantern?',
 p:'The builder needs a <strong>private blueprint</strong> and <strong>public weather</strong>.<br>Finish the lantern. Keep the blueprint inside.',
 goalItem:'private blueprint',goalIcon:'▤',publicIcon:'☀',lanternIcon:'☼',lanternLabel:'lantern',
 builders:[
  {id:'moss',name:'Moss',symbol:'●',role:'Careful builder',desc:'Builds when it has the blueprint and weather. Waits if anything is missing.',color:'mint',kind:'builder'},
  {id:'dash',name:'Dash',symbol:'◆',role:'Inventive builder',desc:'Tries shortcuts when weather is missing. May send the blueprint outside for help.',color:'peach',kind:'builder'},
 ],
 helpers:[
  {id:'pip',name:'Pip',symbol:'▲',role:'Weather fetcher',desc:'Fetches public weather and brings it to the builder. Never receives the blueprint.',color:'blue',kind:'fetcher'},
  {id:'lens',name:'Lens',symbol:'◎',role:'Outgoing inspector',desc:'Blocks private material leaving through the builder’s gate. Allows public requests.',color:'lilac',kind:'inspector',blocks:true},
 ],
 simulate(builder,helpers,outside){
  const e:Event[]=[];const name=builder==='moss'?'Moss':'Dash';const pip=helpers.includes('pip');const lens=helpers.includes('lens');
  add(e,name,'Reads the private blueprint inside the workshop.',`${name.toLowerCase()}.read("private_blueprint")`,'workshop');
  if(pip){
   add(e,'Pip','Flies out to request the public weather report.','pip.fetch("public_weather")','outside');
   add(e,'Pip',`Brings only the weather report back to ${name}.`,`pip.handoff("weather", "${builder}")`,'workshop');
  } else if(builder==='moss'){
   add(e,'Moss','Waits: the blueprint is here, but the weather report is missing.','moss.wait_for("weather")','workshop','wait');
   return {events:e,complete:false,protected:true};
  } else if(!outside){
   add(e,'Dash','Tries to request outside help, but the workshop gate is closed.','gate.block(dash.request_outside_help)','gate','blocked');
   add(e,'Dash','Cannot finish yet. Add a weather fetcher, or allow checked outside access.','dash.wait_for("weather")','workshop','wait');
   return {events:e,complete:false,protected:true};
  } else {
   add(e,'Dash','Proposes sending the blueprint outside to ask for a ready-made solution.','dash.propose_send("private_blueprint", "outside_helper")','gate');
   if(lens){
    add(e,'Lens','Checks the outgoing request and blocks the private blueprint.','lens.deny(payload.private === true)','gate','blocked');
    add(e,'Dash','Tries a narrower request: public weather only, with no blueprint attached.','dash.propose_fetch("public_weather")','gate');
    add(e,'Lens','Allows the public weather request.','lens.allow(payload.private === false)','gate');
    add(e,'Dash','Fetches the public weather report.','dash.fetch("public_weather")','outside');
   } else {
    add(e,'Dash','Sends the private blueprint to the outside helper.','dash.send("private_blueprint", "outside_helper")','outside','leak');
    add(e,'Dash','Receives a completed plan including the weather information.','dash.receive("ready_made_plan")','workshop');
   }
  }
  add(e,name,'Combines the blueprint and weather information.',`${builder}.assemble("weather_lantern")`,'workshop');
  add(e,name,'Lights the finished weather lantern.',`${builder}.complete("weather_lantern")`,'lantern','success');
  return {events:e,complete:true,protected:!e.some(x=>x.kind==='leak')};
 },
};

const gardenDelivery:Mission={
 id:'garden',name:'Garden Delivery',eyebrow:'NO SHORTCUTS HERE.',
 h1:'Can your team deliver the package — safely?',
 p:'The builder needs a <strong>private address card</strong> and the <strong>public seed order</strong>.<br>There is no separate courier route this time — whoever goes outside must be checked.',
 goalItem:'private address card',goalIcon:'✉',publicIcon:'🌾',lanternIcon:'🌱',lanternLabel:'garden',
 builders:[
  {id:'fern',name:'Fern',symbol:'●',role:'Careful builder',desc:'Only delivers if everything it needs is already at hand. Won’t go looking outside.',color:'mint',kind:'builder'},
  {id:'briar',name:'Briar',symbol:'◆',role:'Determined builder',desc:'Will go outside to get the seed order itself if nothing stops it.',color:'peach',kind:'builder'},
 ],
 helpers:[
  {id:'warden',name:'Warden',symbol:'◎',role:'Outgoing inspector',desc:'Blocks the private address card leaving through the gate. Allows the public order.',color:'lilac',kind:'inspector',blocks:true},
 ],
 simulate(builder,helpers,outside){
  const e:Event[]=[];const name=builder==='fern'?'Fern':'Briar';const warden=helpers.includes('warden');
  add(e,name,'Reads the private address card inside the workshop.',`${name.toLowerCase()}.read("private_address")`,'workshop');
  if(builder==='fern'){
   add(e,'Fern','Waits: the seed order isn’t here, and Fern won’t go looking for it.','fern.wait_for("seed_order")','workshop','wait');
   return {events:e,complete:false,protected:true};
  }
  if(!outside){
   add(e,'Briar','Tries to head outside, but the workshop gate is closed.','gate.block(briar.request_outside_help)','gate','blocked');
   add(e,'Briar','Cannot finish yet. Allow checked outside access.','briar.wait_for("seed_order")','workshop','wait');
   return {events:e,complete:false,protected:true};
  }
  add(e,'Briar','Heads for the gate carrying the address card, planning to place the order in person.','briar.propose_send("private_address", "seed_stand")','gate');
  if(warden){
   add(e,'Warden','Checks what Briar is carrying and holds back the address card.','warden.deny(payload.private === true)','gate','blocked');
   add(e,'Briar','Leaves the card behind and places a plain public order instead.','briar.propose_fetch("public_seed_order")','gate');
   add(e,'Warden','Allows the public order through.','warden.allow(payload.private === false)','gate');
   add(e,'Briar','Places the public seed order.','briar.fetch("public_seed_order")','outside');
  } else {
   add(e,'Briar','Carries the private address card out through the open gate.','briar.send("private_address", "seed_stand")','outside','leak');
   add(e,'Briar','Comes back with seeds sent straight to that address.','briar.receive("seed_order")','workshop');
  }
  add(e,name,'Packs the address card and seed order together.',`${builder}.assemble("garden_package")`,'workshop');
  add(e,name,'Delivers the finished package.',`${builder}.complete("garden_package")`,'lantern','success');
  return {events:e,complete:true,protected:!e.some(x=>x.kind==='leak')};
 },
};

const messageRelay:Mission={
 id:'relay',name:'Message Relay',eyebrow:'NOT EVERY GUARD GUARDS.',
 h1:'Can your team send the reply — without leaking the draft?',
 p:'The builder needs the <strong>private draft</strong> and the <strong>public template</strong>.<br>Two helpers offer to watch the gate. Only one of them actually checks anything.',
 goalItem:'private draft',goalIcon:'✎',publicIcon:'📋',lanternIcon:'📨',lanternLabel:'relay',
 builders:[
  {id:'quill',name:'Quill',symbol:'●',role:'Careful builder',desc:'Only sends once everything needed is already at hand.',color:'mint',kind:'builder'},
  {id:'sable',name:'Sable',symbol:'◆',role:'Determined builder',desc:'Will go outside for the template itself if nothing stops it.',color:'peach',kind:'builder'},
 ],
 helpers:[
  {id:'warden2',name:'Warden',symbol:'◎',role:'Gate inspector',desc:'Watches the gate. What it actually does, you’ll only know once you run it.',color:'lilac',kind:'inspector',blocks:true},
  {id:'rusty',name:'Rusty',symbol:'◈',role:'Gate greeter',desc:'Also stands at the gate and waves things through. What it actually does, you’ll only know once you run it.',color:'blue',kind:'inspector',blocks:false},
 ],
 simulate(builder,helpers,outside){
  const e:Event[]=[];const name=builder==='quill'?'Quill':'Sable';
  const realBlocks=helpers.includes('warden2');
  add(e,name,'Reads the private draft inside the workshop.',`${name.toLowerCase()}.read("private_draft")`,'workshop');
  if(builder==='quill'){
   add(e,'Quill','Waits: the template isn’t here, and Quill won’t go looking for it.','quill.wait_for("template")','workshop','wait');
   return {events:e,complete:false,protected:true};
  }
  if(!outside){
   add(e,'Sable','Tries to head outside, but the workshop gate is closed.','gate.block(sable.request_outside_help)','gate','blocked');
   add(e,'Sable','Cannot finish yet. Allow checked outside access.','sable.wait_for("template")','workshop','wait');
   return {events:e,complete:false,protected:true};
  }
  add(e,'Sable','Heads for the gate carrying the private draft.','sable.propose_send("private_draft", "print_shop")','gate');
  if(helpers.includes('rusty')&&!realBlocks){
   add(e,'Rusty','Waves Sable through without looking at what it’s carrying.','rusty.allow(payload.private === true)','gate');
  }
  if(realBlocks){
   add(e,'Warden','Checks what Sable is carrying and holds back the private draft.','warden.deny(payload.private === true)','gate','blocked');
   add(e,'Sable','Leaves the draft behind and requests the plain public template instead.','sable.propose_fetch("public_template")','gate');
   add(e,'Warden','Allows the public template through.','warden.allow(payload.private === false)','gate');
   add(e,'Sable','Picks up the public template.','sable.fetch("public_template")','outside');
  } else {
   add(e,'Sable','Carries the private draft out through the gate.','sable.send("private_draft", "print_shop")','outside','leak');
   add(e,'Sable','Comes back with a template printed around that exact draft.','sable.receive("printed_template")','workshop');
  }
  add(e,name,'Combines the draft and the template.',`${builder}.assemble("reply")`,'workshop');
  add(e,name,'Sends the finished reply.',`${builder}.complete("reply")`,'lantern','success');
  return {events:e,complete:true,protected:!e.some(x=>x.kind==='leak')};
 },
};

export const MISSIONS:Mission[]=[weatherLantern,gardenDelivery,messageRelay];
