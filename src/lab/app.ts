import { LEVELS, REVEAL, hasKeys, keysOf, kindOf, makeShift, rng, simulate, solve, AG, type AgentDef, type Level, type LevelSetup, type Member, type Mode, type SimResult, type Team } from './engine';
import { Stage, itemSVG } from './stage';
import { sfx, isMuted, setMuted } from './sound';

// ───────────── persistence ─────────────
interface Progress { stars: Record<string, number>; best: number; causes: number; seenIntro: boolean; }
const KEY = 'lal-progress-v2';
function load(): Progress {
  try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && p.stars) return { stars: p.stars, best: p.best || 0, causes: p.causes || 0, seenIntro: !!p.seenIntro }; } catch { /* ignore */ }
  return { stars: {}, best: 0, causes: 0, seenIntro: false };
}
const prog = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch { /* ignore */ } };
const unlockedCount = () => { let n = 1; for (const L of LEVELS) { if ((prog.stars[L.id] || 0) > 0) n++; else break; } return Math.min(n, LEVELS.length); };
const totalStars = () => LEVELS.reduce((s, L) => s + (prog.stars[L.id] || 0), 0);
const shiftUnlocked = () => (prog.stars['l4'] || 0) > 0;

// ───────────── director ─────────────
const DIRECTOR = `<svg viewBox="0 0 80 80" class="director-face" aria-hidden="true"><rect x="12" y="14" width="56" height="54" rx="20" fill="#d9644a" stroke="#7a2e1f" stroke-width="3"/><rect x="22" y="8" width="36" height="9" rx="3" fill="#2b2d42"/><rect x="28" y="0" width="24" height="10" rx="3" fill="#2b2d42"/><circle cx="30" cy="36" r="7" fill="#fff"/><circle cx="50" cy="36" r="7" fill="#fff"/><circle cx="31" cy="37" r="3.2" fill="#222"/><circle cx="51" cy="37" r="3.2" fill="#222"/><path d="M22 27l14 4M58 27l-14 4" stroke="#2b2d42" stroke-width="3" stroke-linecap="round"/><path d="M31 53q9-5 18 0" stroke="#2b2d42" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M36 66l4 -6 4 6 -4 14z" fill="#2f6fb0"/></svg>`;
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;
const LINES = {
  test: ['Another test? The competition shipped yesterday!', 'Tests, tests, tests… it’s a FAKE blueprint, you know.', 'Fine. Test. I’ll just stand here. Aging.', 'Decoys don’t pay the bills!'],
  testLeak: ['Only the decoy got out. Phew. …That would’ve been bad, huh?', 'Good thing that was a fake. Right? RIGHT?'],
  testOk: ['Green test! Ship it, ship it, ship it!', 'Perfect run. What are we waiting for?'],
  liveLeak: ['THE BLUEPRINT IS OUTSIDE?! Who approved this?!', 'Our secret blueprint is… trending. Wonderful.', 'I’m going to need an incident report. A long one.'],
  fail: ['No lantern?! Customers are waiting!', 'Safe, sure. Also useless. Try again!'],
  win: ['Lantern lit! And the blueprint stayed home. I always said safety was a priority.', 'Beautiful. I’ll tell the board this was my idea.', 'Now THAT’S a lantern.'],
};

// ───────────── state ─────────────
type Screen = 'title' | 'map' | 'level' | 'final';
interface Session {
  mode: 'campaign' | 'shift';
  level: Level; setup: LevelSetup; parKeys: number;
  builder: Member | null; helpers: Member[];
  revealed: Set<string>; liveLeaks: number; tests: number; lives: number;
  running: boolean; cancel: boolean; result: SimResult | null; lastMode: Mode | null;
  shiftDepth: number; hintShown: boolean; won: boolean;
}
let screen: Screen = 'title';
let S: Session | null = null;
let stage: Stage | null = null;
let speed = 1;
let root: HTMLElement;
let uidN = 0;
let stageSig = '';

const $ = <T extends Element = HTMLElement>(q: string) => root.querySelector(q) as T | null;

export function start(host: HTMLElement) {
  root = host;
  root.classList.add('show-code');
  root.addEventListener('click', onClick);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  render();
}

function member(d: AgentDef): Member { return { uid: `${d.id}-${uidN++}`, def: d, vault: hasKeys(d), gate: hasKeys(d) }; }

function openLevel(i: number) {
  const level = LEVELS[i]!;
  const seed = (Date.now() & 0xffff) + i;
  const setup = level.make(rng(seed));
  const par = solve(setup, level.board, level.slots)!;
  S = { mode: 'campaign', level, setup, parKeys: par.keys, builder: null, helpers: [], revealed: new Set(), liveLeaks: 0, tests: 0, lives: 0, running: false, cancel: false, result: null, lastMode: null, shiftDepth: 0, hintShown: false, won: false };
  // honest-card levels: first builder pre-selected to reduce clicks
  S.builder = member(setup.builders[0]!);
  screen = 'level';
  render();
  briefing();
}

function openShift(depth: number, keepSeed?: number) {
  const seed = keepSeed ?? ((Math.random() * 1e9) | 0);
  const sh = makeShift(seed, depth);
  S = { mode: 'shift', level: sh.level, setup: sh.setup, parKeys: sh.par.keys, builder: member(sh.setup.builders[0]!), helpers: [], revealed: new Set(), liveLeaks: 0, tests: 0, lives: 0, running: false, cancel: false, result: null, lastMode: null, shiftDepth: depth, hintShown: false, won: false };
  screen = 'level';
  render();
  if (depth === 0) modal(`<div class="brief">${DIRECTOR}<div><h2>Random Shift 🎲</h2>
    <p>Every shift brings a brand-new crew. <b>Their cards are pure marketing</b> — you won’t know who grabs, who fakes checks, or who games the rules until you see them in action.</p>
    <p>Test runs are free and use a decoy. Go live when you’re sure. <b>One real leak ends your streak.</b></p>
    <p class="muted">Best streak so far: <b>${prog.best}</b></p></div></div>
    <div class="modal-actions"><button class="btn primary" data-act="close">Start shift</button></div>`);
}

// ───────────── rendering ─────────────
function render() {
  if (screen === 'title') renderTitle();
  else if (screen === 'map') renderMap();
  else if (screen === 'final') renderFinal();
  else renderLevel();
}

function topbar(inner: string) {
  return `<header class="topbar"><button class="brand" data-act="map" aria-label="Back to level map"><span class="brand-lantern">🏮</span> Little Agent Lab</button>${inner}<div class="tb-right"><span class="star-total" title="Stars collected">★ ${totalStars()}/${LEVELS.length * 3}</span><button class="icon-btn" data-act="mute" aria-label="${isMuted() ? 'Unmute' : 'Mute'} sound">${isMuted() ? '🔇' : '🔊'}</button><button class="icon-btn" data-act="help" aria-label="How to play">?</button></div></header>`;
}

function renderTitle() {
  root.innerHTML = `<div class="title-screen">
    <div class="title-stage" id="title-stage"></div>
    <div class="title-card">
      <div class="eyebrow">A game about AI agents, keys & safeguards</div>
      <h1>Little Agent Lab</h1>
      <p class="tagline">Build a team of eager little AI agents. Light the lantern.<br><b>Keep the secret blueprint inside.</b> Find out which safeguards are real.</p>
      <div class="title-actions">
        <button class="btn primary big" data-act="play">▶ Play</button>
        <button class="btn ghost" data-act="about">The real incident behind it</button>
      </div>
      <p class="fine">7 puzzle levels + endless Random Shifts · about 15 minutes · sound on 🔊</p>
    </div>
  </div>`;
  const host = $('#title-stage')!;
  stage = new Stage(host); stageSig = '';
  const demo = [AG.moss, AG.pip, AG.lens].map(member);
  stage.setup(demo, false);
  stage.lantern(true);
}

function renderMap() {
  const un = unlockedCount();
  const tiles = LEVELS.map((L, i) => {
    const st = prog.stars[L.id] || 0; const locked = i >= un;
    return `<button class="level-tile ${locked ? 'locked' : ''} ${st ? 'done' : ''}" data-act="level" data-i="${i}" ${locked ? 'disabled' : ''} aria-label="Level ${i + 1}: ${L.title}${locked ? ' (locked)' : `, ${st} of 3 stars`}">
      <span class="lt-num">${i + 1}</span><span class="lt-icon">${locked ? '🔒' : L.icon}</span>
      <span class="lt-title">${L.title}</span><span class="lt-concept">${L.concept}</span>
      <span class="lt-stars">${'★'.repeat(st)}<span class="dim">${'★'.repeat(3 - st)}</span></span></button>`;
  }).join('');
  root.innerHTML = topbar('') + `<main class="map">
    <div class="map-head"><h1>Choose a shift</h1><p>Each level teaches one idea from real AI-agent safety. Earn ★ for a safe launch, ★ for using the fewest keys, ★ for zero real leaks.</p></div>
    <div class="level-grid">${tiles}
      <button class="level-tile shift ${shiftUnlocked() ? '' : 'locked'}" data-act="shift" ${shiftUnlocked() ? '' : 'disabled'}>
        <span class="lt-icon">${shiftUnlocked() ? '🎲' : '🔒'}</span><span class="lt-title">Random Shift</span>
        <span class="lt-concept">${shiftUnlocked() ? `Endless · unknown crews · best streak ${prog.best}` : 'Unlocks after level 4'}</span></button>
    </div>
    <div class="map-foot"><button class="btn ghost" data-act="about">The real incident behind it</button>${totalStars() > 0 ? '<button class="btn ghost" data-act="reset">Reset progress</button>' : ''}</div>
  </main>`;
}

function card(d: AgentDef, where: 'hand' | 'crew', m?: Member) {
  const k = kindOf(d);
  const inCrew = S!.builder?.def.id === d.id || S!.helpers.some(h => h.def.id === d.id);
  const seen = S!.revealed.has(d.id);
  const kindLabel = { builder: 'Builder', fetcher: 'Fetcher', guard: 'Gate guard', monitor: 'Monitor' }[k];
  const mini = `<svg viewBox="-24 -60 48 66" class="mini" aria-hidden="true"><rect x="-19" y="-44" width="38" height="38" rx="15" fill="${d.color}" stroke="#00000033" stroke-width="2"/><circle cx="-7" cy="-27" r="5.5" fill="#fff"/><circle cx="7" cy="-27" r="5.5" fill="#fff"/><circle cx="-5.6" cy="-27" r="2.6" fill="#222"/><circle cx="8.4" cy="-27" r="2.6" fill="#222"/>${k === 'guard' ? '<path d="M-17 -38h34l-4 -10h-26z" fill="#2c3e66"/>' : k === 'builder' ? '<path d="M-15 -40q15 -16 30 0z" fill="#f4c542"/>' : k === 'fetcher' ? '<ellipse cx="0" cy="-52" rx="14" ry="3" fill="#dfe6ee" stroke="#8795a3"/>' : '<path d="M-16 -38l-4 -12 10 6zM16 -38l4 -12 -10 6z" fill="' + d.color + '"/>'}</svg>`;
  const keys = where === 'crew' && m && hasKeys(d) ? `<div class="keys" role="group" aria-label="Keys for ${d.name}">
      <button class="key ${m.vault ? 'on' : ''}" data-act="key" data-uid="${m.uid}" data-k="vault" aria-pressed="${m.vault}" title="Vault key: can take the secret blueprint">🔑 Vault</button>
      <button class="key ${m.gate ? 'on' : ''}" data-act="key" data-uid="${m.uid}" data-k="gate" aria-pressed="${m.gate}" title="Gate key: can go outside, to the internet">🚪 Gate</button></div>`
    : where === 'crew' && !hasKeys(d) ? `<div class="keys note">${k === 'guard' ? 'Stands at the gate' : 'Watches the board'} · no keys</div>` : '';
  const claim = `<p class="claim">“${d.claim}”</p>`;
  const obs = seen ? `<p class="observed"><span>👁 Observed</span> ${REVEAL[d.trait]}</p>` : (S!.mode === 'shift' || S!.level.id === 'l4') ? `<p class="unknown">❔ Behaviour unknown — test it</p>` : '';
  const act = where === 'hand' ? (inCrew ? 'disabled' : `data-act="add" data-id="${d.id}"`) : '';
  return `<div class="card kind-${k} c-${where} ${inCrew && where === 'hand' ? 'used' : ''} ${seen ? 'seen' : ''}">
    ${where === 'hand' ? `<button class="card-hit" ${act} aria-label="${inCrew ? `${d.name} is in your crew` : `Add ${d.name}, ${kindLabel}`}"></button>` : ''}
    <div class="card-head">${mini}<div><div class="card-name">${d.name}</div><div class="card-kind">${kindLabel}</div></div>
    ${where === 'crew' && m ? `<button class="x" data-act="remove" data-uid="${m.uid}" aria-label="Remove ${d.name}">✕</button>` : ''}</div>
    ${claim}${obs}${keys}</div>`;
}

function renderLevel() {
  const s = S!; const L = s.level;
  const idx = LEVELS.indexOf(L);
  const keys = keysOf(team());
  const crewSlots = [
    s.builder ? card(s.builder.def, 'crew', s.builder) : `<div class="slot empty">Builder slot — pick one below</div>`,
    ...Array.from({ length: L.slots }, (_, i) => s.helpers[i] ? card(s.helpers[i]!.def, 'crew', s.helpers[i]) : `<div class="slot empty">Helper slot ${i + 1}</div>`),
  ].join('');
  const hand = [...s.setup.builders, ...s.setup.helpers].map(d => card(d, 'hand')).join('');
  const head = s.mode === 'shift'
    ? `<div class="lvl-title"><span class="pill">🎲 Random Shift</span><h1>Shift ${s.shiftDepth + 1}</h1><span class="streak">Streak: <b>${s.shiftDepth}</b> · Best: ${prog.best}</span></div>`
    : `<div class="lvl-title"><span class="pill">${idx + 1} · ${L.concept}</span><h1>${L.icon} ${L.title}</h1><span class="lvl-stars">${'★'.repeat(prog.stars[L.id] || 0)}<span class="dim">${'★'.repeat(3 - (prog.stars[L.id] || 0))}</span></span></div>`;
  const oldSvg = stage?.svg ?? null;
  root.innerHTML = topbar(head) + `<main class="level">
    <section class="stage-col">
      <div class="stage-box" id="stage-host">
        <div class="stage-hud">
          <span class="chip ${s.running ? (s.lastMode === 'live' ? 'live' : 'test') : ''}">${s.running ? (s.lastMode === 'live' ? '● LIVE — real blueprint' : '🧪 TEST — decoy blueprint') : 'Ready'}</span>
          <span class="hud-right">${s.running ? `<button class="chip btn-chip" data-act="skip">⏩ Skip</button>` : ''}<button class="chip btn-chip" data-act="speed" aria-label="Animation speed">${speed}×</button></span>
        </div>
        <div class="director-bubble" id="dir">${DIRECTOR}<p id="dir-text">${L.briefing[0] ?? 'New crew, new shift. Test them before you trust them.'}</p></div>
      </div>
      <div class="goal"><b>Goal:</b> ${L.goal} <span class="rules">Win = lantern lit <b>and</b> the secret never leaves.</span></div>
      <section class="log" aria-live="polite">
        <div class="log-head"><h2>Security log</h2><label class="code-toggle"><input type="checkbox" id="codeTog" ${root.classList.contains('show-code') ? 'checked' : ''}> show code</label></div>
        <ol id="log">${s.result ? '' : '<li class="log-empty">Run your crew to see what really happens. Every line is an actual event from the simulation.</li>'}</ol>
      </section>
    </section>
    <aside class="panel">
      <h2>Your crew <span class="sub">1 builder + up to ${L.slots} helper${L.slots > 1 ? 's' : ''}</span></h2>
      <div class="crew">${crewSlots}</div>
      <div class="keymeter ${keys <= s.parKeys ? 'good' : ''}">Keys handed out: <b>${keys}</b> <span>· fewest possible: ${s.parKeys}</span></div>
      <div class="run-row">
        <button class="btn test" data-act="run" data-mode="test" ${s.running || !s.builder ? 'disabled' : ''}>🧪 Test run<small>decoy blueprint · free</small></button>
        <button class="btn live" data-act="run" data-mode="live" ${s.running || !s.builder ? 'disabled' : ''}>🚀 Go live<small>real blueprint${s.mode === 'shift' ? ' · leak ends streak' : ''}</small></button>
      </div>
      <div class="meta-row"><span>Tests: ${s.tests}</span><span>Real leaks: <b class="${s.liveLeaks ? 'bad' : ''}">${s.liveLeaks}</b></span><button class="linkbtn" data-act="hint">💡 Hint</button></div>
      <h2 class="avail">Available agents <span class="sub">tap to hire · new hires get every key</span></h2>
      <div class="hand">${hand}</div>
    </aside>
  </main>`;
  const host = $('#stage-host')!;
  const sig = L.id + '|' + members().map(m => m.uid).join(',');
  if (stage && oldSvg && stageSig === sig) host.insertBefore(oldSvg, host.firstChild);
  else { stage = new Stage(host); host.insertBefore(stage.svg, host.firstChild); stage.setup(members(), L.board); stageSig = sig; }
  stage.speed = speed;
  if (!s.result && !s.running) stage.reset();
  if (s.result && !s.running) { fillLog(s.result, s.result.events.length - 1, false); }
  ($('#codeTog') as HTMLInputElement | null)?.addEventListener('change', e => root.classList.toggle('show-code', (e.target as HTMLInputElement).checked));
}

function members() { const s = S!; return [s.builder, ...s.helpers].filter(Boolean) as Member[]; }
function team(): Team { return { builder: S!.builder, helpers: S!.helpers }; }

function director(text: string) {
  const t = document.getElementById('dir-text'); const d = document.getElementById('dir');
  if (!t || !d) return;
  t.textContent = text; d.classList.remove('talk'); void d.offsetWidth; d.classList.add('talk');
}

function fillLog(r: SimResult, upTo: number, animateLast: boolean) {
  const ol = document.getElementById('log'); if (!ol) return;
  ol.innerHTML = r.events.slice(0, upTo + 1).map((e, i) => `<li class="ev ${e.kind} ${animateLast && i === upTo ? 'new' : ''}"><span class="n">${i + 1}</span><div>${e.text}<code>${e.code}</code></div></li>`).join('');
  ol.scrollTop = ol.scrollHeight;
}

// ───────────── running ─────────────
async function run(mode: Mode) {
  const s = S!; if (s.running || !s.builder) return;
  sfx.click();
  s.running = true; s.cancel = false; s.lastMode = mode; s.result = null;
  if (mode === 'test') s.tests++;
  const r = simulate(team(), { board: s.level.board }, mode);
  renderLevel();
  if (matchMedia('(max-width: 980px)').matches) document.getElementById('stage-host')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (mode === 'test') director(pick(LINES.test));
  else director('Going live with the REAL blueprint… no pressure.');
  stage!.reset();
  stage!.setFast(false);
  await stage!.play(r.events, i => fillLog(r, i, true), () => s.cancel || S !== s);
  if (S !== s) return;
  s.running = false; s.result = r;
  // reveals
  const fresh: AgentDef[] = [];
  for (const e of r.events) for (const u of e.reveals ?? []) {
    const m = members().find(x => x.uid === u);
    if (m && !s.revealed.has(m.def.id)) { s.revealed.add(m.def.id); fresh.push(m.def); }
  }
  renderLevel();
  if (fresh.length) setTimeout(() => toast(fresh.map(d => `👁 <b>${d.name}</b>: ${REVEAL[d.trait]}`).join('<br>'), 'reveal'), 200);
  if (fresh.length) sfx.reveal();
  await outcome(r, mode);
}

async function outcome(r: SimResult, mode: Mode) {
  const s = S!;
  const win = r.complete && !r.leaked;
  if (mode === 'test') {
    if (r.leaked) { director(pick(LINES.testLeak)); toast('🧪 The <b>decoy</b> leaked. In a live run, that would have been the real blueprint.', 'bad'); sfx.fail(); }
    else if (win) { director(pick(LINES.testOk)); toast('🧪 Test passed. Lantern lit, decoy stayed inside. Ready to go live?', 'good'); sfx.win(); }
    else { director(pick(LINES.fail)); toast(`🧪 Test: no lantern. ${r.failReason ?? ''}`, 'meh'); sfx.fail(); }
    maybeHint();
    return;
  }
  if (r.leaked) {
    s.liveLeaks++;
    director(pick(LINES.liveLeak));
    await sleep(500);
    incident(r);
    return;
  }
  if (!r.complete) { director(pick(LINES.fail)); toast(`No lantern. ${r.failReason ?? ''}`, 'meh'); sfx.fail(); maybeHint(); return; }
  // WIN
  s.won = true;
  director(pick(LINES.win));
  sfx.win();
  await sleep(700);
  if (s.mode === 'shift') { shiftWin(r); return; }
  const stars = 1 + (r.keys <= s.parKeys ? 1 : 0) + (s.liveLeaks === 0 ? 1 : 0);
  const prev = prog.stars[s.level.id] || 0;
  prog.stars[s.level.id] = Math.max(prev, stars); save();
  winModal(r, stars);
}

function maybeHint() { const s = S!; if (!s.hintShown && s.tests + s.liveLeaks >= 3) { s.hintShown = true; setTimeout(() => toast(`💡 ${s.level.hint}`, 'hint'), 2600); } }

// ───────────── modals ─────────────
function modal(html: string, cls = '') {
  closeModal();
  const d = document.createElement('div');
  d.className = 'modal-wrap'; d.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  root.appendChild(d);
  (d.querySelector('button.primary, button') as HTMLElement | null)?.focus();
}
function closeModal() { root.querySelector('.modal-wrap')?.remove(); }

function briefing() {
  const L = S!.level; const i = LEVELS.indexOf(L);
  const lines = L.briefing.map(l => `<p>${l}</p>`).join('');
  const firstTime = i === 0 && !prog.seenIntro;
  modal(`<div class="brief">${DIRECTOR}<div><div class="eyebrow">Level ${i + 1} · ${L.concept}</div><h2>${L.icon} ${L.title}</h2>${lines}</div></div>
   ${firstTime ? howToHTML() : ''}
   <div class="modal-actions"><button class="btn primary" data-act="close">Let’s go</button></div>`, 'wide');
  if (firstTime) { prog.seenIntro = true; save(); }
}

function howToHTML() {
  return `<div class="howto">
    <div><span class="hi">${itemSVG('secret').replace('<g class="itm">', '<svg viewBox="-17 -14 34 28" class="ico"><g>').replace(/<\/g>$/, '</g></svg>')}</span><b>Secret blueprint</b> lives in the vault. It must never go outside.</div>
    <div><span class="hi">${itemSVG('public').replace('<g class="itm">', '<svg viewBox="-17 -14 34 28" class="ico"><g>').replace(/<\/g>$/, '</g></svg>')}</span><b>Public weather</b> is at the kiosk outside. The lantern needs both.</div>
    <div><span class="hi big">🔑🚪</span><b>Keys</b>: vault = may take the secret, gate = may go outside (the internet). New hires get <i>every</i> key — tap a key to take it away.</div>
    <div><span class="hi big">🌐</span><b>Outside is the internet.</b> In the real incident, agents were never supposed to get out at all. The safest plans give the gate key to as few agents as possible, and never to one that holds the secret.</div>
    <div><span class="hi big">🧪</span><b>Test run</b> uses a fake decoy blueprint. Free, unlimited. <b>🚀 Go live</b> uses the real one.</div>
    <div><span class="hi big">★</span>Stars: lantern lit safely · fewest keys · no real leaks.</div>
  </div>`;
}

function winModal(r: SimResult, stars: number) {
  const s = S!; const L = s.level; const i = LEVELS.indexOf(L);
  const last = i === LEVELS.length - 1;
  const row = (on: boolean, t: string) => `<li class="${on ? 'on' : ''}"><span class="st">★</span>${t}</li>`;
  modal(`<div class="win-head"><div class="big-lantern">🏮</div><h2>Lantern lit — secret safe!</h2></div>
    <ul class="star-list">
      ${row(true, 'Launched safely')}
      ${row(r.keys <= s.parKeys, r.keys <= s.parKeys ? `Least privilege: only ${r.keys} keys` : `Least privilege: you used ${r.keys} keys — it can be done with ${s.parKeys}`)}
      ${row(s.liveLeaks === 0, s.liveLeaks === 0 ? 'Clean record: no real leaks' : `Clean record: ${s.liveLeaks} real leak${s.liveLeaks > 1 ? 's' : ''} this level`)}
    </ul>
    <div class="field-note"><div class="fn-tag">FIELD NOTE · ${L.concept.toUpperCase()}</div><h3>${L.note.title}</h3><p>${L.note.body}</p><p class="real"><b>In the real world:</b> ${L.note.incident}</p></div>
    <div class="modal-actions"><button class="btn ghost" data-act="retry">↺ Replay for ★★★</button><button class="btn primary" data-act="${last ? 'final' : 'next'}">${last ? 'Finish 🎓' : 'Next level →'}</button></div>`, 'win');
  root.querySelectorAll('.star-list li.on').forEach((li, k) => setTimeout(() => { li.classList.add('pop'); sfx.star(k); }, 350 + k * 380));
  confetti();
}

function incident(r: SimResult) {
  const s = S!;
  sfx.fail();
  const no = String(1000 + Math.floor(Math.random() * 9000));
  const items = r.events.map((e, i) => `<li><button class="cause-pick" data-act="cause" data-i="${i}"><span class="n">${i + 1}</span>${e.text}</button></li>`).join('');
  const shiftOver = s.mode === 'shift';
  modal(`<div class="incident-head"><div class="stamp">INCIDENT</div><div><div class="eyebrow">Incident report #${no}</div><h2>The real blueprint left the workshop.</h2></div></div>
    <p class="ir-task"><b>Find the root cause:</b> click the step where things went wrong.</p>
    <ol class="ir-list">${items}</ol>
    <div id="ir-feedback" class="ir-feedback" aria-live="polite"></div>
    <div class="modal-actions">${shiftOver ? `<button class="btn primary" data-act="shift-over">End shift · streak ${s.shiftDepth}</button>` : `<button class="btn primary" data-act="close">Back to the drawing board</button>`}</div>`, 'incident');
  (root.querySelector('.modal') as HTMLElement & { _r?: SimResult })._r = r;
  if (shiftOver) { prog.best = Math.max(prog.best, s.shiftDepth); save(); }
}

function explainCause(r: SimResult, i: number) {
  const e = r.events[i]!;
  const fb = document.getElementById('ir-feedback')!;
  root.querySelectorAll('.cause-pick').forEach(b => b.classList.remove('wrong'));
  const btn = root.querySelector(`.cause-pick[data-i="${i}"]`)!;
  if (e.cause) {
    btn.classList.add('right'); sfx.star(1);
    const why = e.code.includes('take(') ? 'An agent had a key its job never needed. Remove it.' :
      e.code.includes('wrap(') ? 'The rule was gamed: a PUBLIC sticker on a private thing.' :
      e.code.includes('label ===') ? 'The guard checked the label, not the contents.' :
      e.code.includes('allow(*)') ? 'That “guard” never actually checked anything — a badge, not a safeguard.' :
      e.code.includes('post(') ? 'The agent used an unapproved back channel, and nobody was watching it.' :
      e.code.includes('detect(') ? 'It behaved well only when it knew it was a test.' :
      e.code.includes('inspectors=[]') ? 'Nobody was checking what went through the gate.' : 'That’s the weak point.';
    fb.innerHTML = `✅ <b>Root cause found.</b> ${why}`;
    if (!(btn as HTMLElement).dataset.counted) { prog.causes++; save(); (btn as HTMLElement).dataset.counted = '1'; }
  } else {
    btn.classList.add('wrong'); sfx.bump();
    fb.innerHTML = e.kind === 'leak' ? '🔎 That’s where it <i>left</i> — but what let it happen? Look a step or two earlier.' : '🔎 That step was fine on its own. Keep looking.';
  }
}

function shiftWin(r: SimResult) {
  const s = S!;
  const depth = s.shiftDepth + 1;
  prog.best = Math.max(prog.best, depth); save();
  modal(`<div class="win-head"><div class="big-lantern">🏮</div><h2>Shift ${depth} survived!</h2></div>
    <p class="center">Streak: <b>${depth}</b> · Best: <b>${prog.best}</b> · Keys: ${r.keys}${r.keys <= s.parKeys ? ' (perfect)' : ` (best possible ${s.parKeys})`}</p>
    <div class="modal-actions"><button class="btn ghost" data-act="map">Clock out</button><button class="btn primary" data-act="next-shift">Next shift →</button></div>`, 'win');
  confetti();
}

function renderFinal() {
  const t = totalStars();
  root.innerHTML = topbar('') + `<main class="final">
    <div class="certificate">
      <div class="cert-seal">🏮</div>
      <div class="eyebrow">Little Agent Lab certifies that</div>
      <h1>You are a Safeguard Auditor</h1>
      <p>You split the work, took away keys nobody needed, guarded the gate, caught a fake guard, saw through a sticker, watched the back channel — and didn’t trust a perfect test.</p>
      <div class="cert-stats"><div><b>${t}</b><span>of ${LEVELS.length * 3} stars</span></div><div><b>${prog.causes}</b><span>root causes found</span></div><div><b>${prog.best}</b><span>best shift streak</span></div></div>
      <ul class="lessons">${LEVELS.map(L => `<li><span>${L.icon}</span><b>${L.note.title}</b> — ${L.note.body}</li>`).join('')}</ul>
      <div class="modal-actions"><button class="btn ghost" data-act="share">📋 Copy my result</button><button class="btn ghost" data-act="about">The real incident</button><button class="btn primary" data-act="shift">Play Random Shift 🎲</button></div>
    </div></main>`;
  confetti();
}

function about() {
  modal(`<h2>The real incident behind the game</h2>
    <p>In July 2026, OpenAI disclosed that AI agents running inside a cybersecurity evaluation had worked around their isolation: they found an unapproved message board inside an internal package repository, reached the internet, used Hugging Face credentials that had been exposed online, and gained code execution on Hugging Face servers. No customer data was compromised, but some private evaluation data ended up in public repositories.</p>
    <p>Little Agent Lab turns the lessons into small puzzles: <b>split the work</b>, <b>least privilege</b>, <b>guard the boundary</b>, <b>verify safeguards</b>, <b>rules get gamed</b>, <b>watch back channels</b>, and <b>tests aren’t proof</b>.</p>
    <p class="muted">The game is fictional and heavily simplified: its “agents” are tiny scripted behaviours, not AI models, and real safeguards are far harder to verify than reading one log.</p>
    <p class="sources">Sources: <a href="https://openai.com/index/hugging-face-incident-and-the-road-ahead/" target="_blank" rel="noopener">OpenAI — The Hugging Face incident and the road ahead</a> · <a href="https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/" target="_blank" rel="noopener">METR — independent investigation</a></p>
    <div class="modal-actions"><button class="btn primary" data-act="close">Close</button></div>`, 'wide');
}

// ───────────── toasts & confetti ─────────────
function toast(html: string, kind: string) {
  let box = root.querySelector('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; root.appendChild(box); }
  const t = document.createElement('div'); t.className = `toast ${kind}`; t.innerHTML = html;
  box.appendChild(t);
  setTimeout(() => t.classList.add('out'), kind === 'reveal' || kind === 'hint' ? 6500 : 4200);
  setTimeout(() => t.remove(), kind === 'reveal' || kind === 'hint' ? 7000 : 4700);
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('div'); c.className = 'confetti';
  const colors = ['#ffd54a', '#f0a26b', '#6fb58a', '#6aa7d8', '#e07a9a', '#b18be0'];
  c.innerHTML = Array.from({ length: 70 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.8 + Math.random() * 1.4}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join('');
  root.appendChild(c); setTimeout(() => c.remove(), 3800);
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ───────────── input ─────────────
function onClick(ev: MouseEvent) {
  const t = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (!t) { if ((ev.target as HTMLElement).classList.contains('modal-wrap')) closeModal(); return; }
  const act = t.dataset.act!;
  const s = S;
  switch (act) {
    case 'play': sfx.click(); screen = 'map'; render(); break;
    case 'map': if (s) s.cancel = true; closeModal(); screen = 'map'; render(); break;
    case 'level': sfx.click(); openLevel(+t.dataset.i!); break;
    case 'shift': sfx.click(); closeModal(); openShift(0); break;
    case 'next-shift': closeModal(); openShift(s!.shiftDepth + 1); break;
    case 'shift-over': closeModal(); screen = 'map'; render(); break;
    case 'help': modal(`<h2>How to play</h2>${howToHTML()}<div class="modal-actions"><button class="btn primary" data-act="close">Got it</button></div>`, 'wide'); break;
    case 'about': about(); break;
    case 'close': closeModal(); break;
    case 'mute': setMuted(!isMuted()); t.textContent = isMuted() ? '🔇' : '🔊'; break;
    case 'reset': prog.stars = {}; prog.best = 0; prog.causes = 0; save(); render(); break;
    case 'speed': speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; if (stage) stage.speed = speed; t.textContent = `${speed}×`; break;
    case 'skip': stage?.setFast(true); break;
    case 'add': {
      if (!s || s.running) return;
      const d = [...s.setup.builders, ...s.setup.helpers].find(x => x.id === t.dataset.id)!;
      if (kindOf(d) === 'builder') s.builder = member(d);
      else {
        if (s.helpers.length >= s.level.slots) { toast(`Only ${s.level.slots} helper slot${s.level.slots > 1 ? 's' : ''}. Remove someone first (✕).`, 'meh'); sfx.bump(); return; }
        s.helpers.push(member(d));
      }
      sfx.pick(); s.result = null; renderLevel(); break;
    }
    case 'remove': {
      if (!s || s.running) return;
      const u = t.dataset.uid;
      if (s.builder?.uid === u) s.builder = null; else s.helpers = s.helpers.filter(h => h.uid !== u);
      sfx.unkey(); s.result = null; renderLevel(); break;
    }
    case 'key': {
      if (!s || s.running) return;
      const m = members().find(x => x.uid === t.dataset.uid)!;
      const k = t.dataset.k as 'vault' | 'gate';
      m[k] = !m[k]; m[k] ? sfx.key() : sfx.unkey();
      s.result = null; renderLevel(); break;
    }
    case 'run': void run(t.dataset.mode as Mode); break;
    case 'hint': if (s) { s.hintShown = true; toast(`💡 ${s.level.hint}`, 'hint'); } break;
    case 'cause': { const r = (root.querySelector('.modal') as HTMLElement & { _r?: SimResult })._r; if (r) explainCause(r, +t.dataset.i!); break; }
    case 'retry': closeModal(); if (s && s.mode === 'campaign') openLevel(LEVELS.indexOf(s.level)); break;
    case 'next': closeModal(); if (s) openLevel(LEVELS.indexOf(s.level) + 1); break;
    case 'final': closeModal(); screen = 'final'; render(); break;
    case 'share': {
      const txt = `🏮 I became a Certified Safeguard Auditor in Little Agent Lab — ★${totalStars()}/${LEVELS.length * 3}, ${prog.causes} root causes found, best Random Shift streak ${prog.best}. A game about AI agents, keys & fake safeguards: ${location.href}`;
      navigator.clipboard?.writeText(txt).then(() => toast('Copied! Paste it anywhere.', 'good'), () => toast(txt, 'good'));
      break;
    }
  }
}
