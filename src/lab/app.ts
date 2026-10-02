import { LEVELS, REVEAL, hasKeys, keysOf, kindOf, makeShift, rng, simulate, solve, themeText, AG, type AgentDef, type Level, type LevelSetup, type Member, type Mode, type SimResult, type Team } from './engine';
import { Stage, itemSVG, DEFAULT_LOOK, type Look } from './stage';
import { sfx, isMuted, setMuted } from './sound';
import { tx, fmt, plural, lang, LANGS, LANG_KEY, type Lang } from './i18n';

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
const LINES = tx.director;


const P = (items: [string, number, number, number?][]) => items.map(([e, x, y, sz]) => `<text x="${x}" y="${y}" font-size="${sz ?? 30}" text-anchor="middle">${e}</text>`).join('');
/** Sign and kiosk names of a scene, in the current language. */
const words = (code: keyof typeof tx.looks) => ({ sign: tx.looks[code].sign, kiosk: tx.looks[code].kiosk });
const LOOKS: Record<string, Look> = {
  weather_lantern: DEFAULT_LOOK,
  birthday_cake: { building: 'factory', ...words('birthday_cake'), icon: '🎂', day: true, props: P([['🌷', 620, 500], ['🌷', 760, 505, 24], ['🎈', 980, 250, 34], ['🍓', 420, 488, 24]]),
    vars: { '--sky1': '#6cc4f0', '--sky2': '#b7e6fa', '--sky3': '#fde6c9', '--hill1': '#7cc27a', '--hill2': '#5aa65f', '--ground': '#8ccf6e', '--roof': '#e0739a', '--wall': '#fde4ee', '--path': '#e8cfa0' } },
  party_invitation: { building: 'post', ...words('party_invitation'), icon: '💌', day: true, props: P([['📮', 400, 488, 34], ['🌳', 650, 470, 60], ['🗺️', 822, 470, 22], ['🕊️', 700, 180, 30]]),
    vars: { '--sky1': '#7fb8e6', '--sky2': '#cfe6f5', '--sky3': '#f7e3b0', '--hill1': '#6fa37a', '--hill2': '#4f8a63', '--ground': '#79b467', '--roof': '#3f6fb0', '--wall': '#e6edf7', '--path': '#d9c9a3' } },
  tiny_rocket: { building: 'launch', ...words('tiny_rocket'), icon: '🚀', day: false, props: P([['🪐', 760, 120, 46], ['🛰️', 560, 70, 30], ['☄️', 420, 60, 28]]),
    vars: { '--sky1': '#070822', '--sky2': '#251a55', '--sky3': '#5b3b91', '--hill1': '#2a2f4a', '--hill2': '#1d2138', '--ground': '#3b3f58', '--roof': '#6d7a91', '--wall': '#cfd6e2', '--path': '#8a8fa8' } },
  music_box: { building: 'shop', ...words('music_box'), icon: '🎶', day: true, props: P([['🎵', 640, 300, 30], ['🎶', 720, 250, 26], ['📚', 822, 470, 22]]),
    vars: { '--sky1': '#ff8f6b', '--sky2': '#ffc49a', '--sky3': '#ffe6b8', '--hill1': '#c9825f', '--hill2': '#a8674d', '--ground': '#9bbf6a', '--roof': '#7b4bb3', '--wall': '#f1e4ff', '--path': '#e3c29a' } },
  concert_poster: { building: 'hall', ...words('concert_poster'), icon: '🎻', day: false, props: P([['✨', 640, 200, 30], ['🎸', 660, 480, 34], ['🎟️', 822, 470, 22]]),
    vars: { '--sky1': '#170c30', '--sky2': '#4a1f6e', '--sky3': '#d04a7c', '--hill1': '#3a1f4d', '--hill2': '#2b173b', '--ground': '#4a3a5f', '--roof': '#c2303f', '--wall': '#f6d6c4', '--path': '#b28bb5' } },
  moon_potion: { building: 'tower', ...words('moon_potion'), icon: '🌙', day: false, props: P([['🍄', 420, 490, 28], ['🌿', 640, 495, 30], ['🦉', 980, 300, 30], ['🌫️', 700, 420, 50]]),
    vars: { '--sky1': '#0c2323', '--sky2': '#1c4e48', '--sky3': '#7fb39b', '--hill1': '#1f3b35', '--hill2': '#16302b', '--ground': '#3f6b4f', '--roof': '#4b3a6b', '--wall': '#e1eee0', '--path': '#9fb59a' } },
  grand_opening: { building: 'modern', ...words('grand_opening'), icon: '🎉', day: true, props: P([['🎈', 30, 200, 38], ['🎈', 470, 200, 34], ['🎊', 640, 180, 34], ['📸', 660, 480, 30]]),
    vars: { '--sky1': '#4fb6ff', '--sky2': '#a6ddff', '--sky3': '#fff0bd', '--hill1': '#6cbf73', '--hill2': '#4ea35f', '--ground': '#83c96b', '--roof': '#e8a317', '--wall': '#fff4d6', '--path': '#e6cf9c' } },
};
const lookFor = (L: Level) => LOOKS[L.theme.productCode] ?? DEFAULT_LOOK;

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
const TEST_BUDGET = 3;
const A = tx.app;   // interface text in the current language

const $ = <T extends Element = HTMLElement>(q: string) => root.querySelector(q) as T | null;

export function start(host: HTMLElement) {
  root = host;
  document.documentElement.lang = lang;
  document.title = tx.meta.title;
  const meta = (sel: string, v: string) => document.querySelector(sel)?.setAttribute('content', v);
  meta('meta[name="description"]', tx.meta.description);
  meta('meta[property="og:description"]', tx.meta.ogDescription);
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
  S = { mode: 'campaign', level, setup, parKeys: par.keys, builder: null, helpers: [], revealed: new Set(), liveLeaks: 0, tests: 0, lives: TEST_BUDGET, running: false, cancel: false, result: null, lastMode: null, shiftDepth: 0, hintShown: false, won: false };
  // honest-card levels: first builder pre-selected to reduce clicks
  S.builder = member(setup.builders[0]!);
  screen = 'level';
  render();
  briefing();
}

function openShift(depth: number, keepSeed?: number) {
  const seed = keepSeed ?? ((Math.random() * 1e9) | 0);
  const sh = makeShift(seed, depth);
  S = { mode: 'shift', level: sh.level, setup: sh.setup, parKeys: sh.par.keys, builder: member(sh.setup.builders[0]!), helpers: [], revealed: new Set(), liveLeaks: 0, tests: 0, lives: TEST_BUDGET, running: false, cancel: false, result: null, lastMode: null, shiftDepth: depth, hintShown: false, won: false };
  screen = 'level';
  render();
  if (depth === 0) modal(`<div class="brief">${DIRECTOR}<div><h2>${A.shiftIntroTitle}</h2>
    <p>${A.shiftIntro1}</p>
    <p>${A.shiftIntro2}</p>
    <p class="muted">${fmt(A.shiftIntroBest, { n: prog.best })}</p></div></div>
    <div class="modal-actions"><button class="btn primary" data-act="close">${A.startShift}</button></div>`);
}

// ───────────── rendering ─────────────
function render() {
  if (screen === 'title') renderTitle();
  else if (screen === 'map') renderMap();
  else if (screen === 'final') renderFinal();
  else renderLevel();
}

function topbar(inner: string) {
  return `<header class="topbar"><button class="brand" data-act="map" aria-label="${A.backToMap}"><span class="brand-lantern">🏮</span> Little Agent Lab</button>${inner}<div class="tb-right"><span class="star-total" title="${A.starsCollected}">★ ${totalStars()}/${LEVELS.length * 3}</span><button class="icon-btn" data-act="mute" aria-label="${isMuted() ? A.unmute : A.mute}">${isMuted() ? '🔇' : '🔊'}</button><button class="icon-btn" data-act="help" aria-label="${A.howToPlay}">?</button></div></header>`;
}

function renderTitle() {
  root.innerHTML = `<div class="title-screen">
    <div class="title-stage" id="title-stage"></div>
    <div class="title-card">
      <div class="eyebrow">${A.titleEyebrow.replace(/&/g, '&amp;')}</div>
      <h1>Little Agent Lab</h1>
      <p class="tagline">${A.tagline}</p>
      <div class="title-actions">
        <button class="btn primary big" data-act="play">${A.play}</button>
        <button class="btn ghost" data-act="about">${A.realIncidentBehind}</button>
      </div>
      <p class="fine">${A.titleFine}</p>${langSwitch()}
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
    return `<button class="level-tile ${locked ? 'locked' : ''} ${st ? 'done' : ''}" data-act="level" data-i="${i}" ${locked ? 'disabled' : ''} aria-label="${fmt(locked ? A.tileLocked : A.tileStars, { n: i + 1, title: L.title, st })}">
      <span class="lt-num">${i + 1}</span><span class="lt-icon">${locked ? '🔒' : L.icon}</span>
      <span class="lt-title">${L.title}</span><span class="lt-concept">${L.concept}</span>
      <span class="lt-stars">${'★'.repeat(st)}<span class="dim">${'★'.repeat(3 - st)}</span></span></button>`;
  }).join('');
  root.innerHTML = topbar('') + `<main class="map">
    <div class="map-head"><h1>${A.mapTitle}</h1><p>${A.mapIntro}</p></div>
    <div class="level-grid">${tiles}
      <button class="level-tile shift ${shiftUnlocked() ? '' : 'locked'}" data-act="shift" ${shiftUnlocked() ? '' : 'disabled'}>
        <span class="lt-icon">${shiftUnlocked() ? '🎲' : '🔒'}</span><span class="lt-title">${A.randomShift}</span>
        <span class="lt-concept">${shiftUnlocked() ? fmt(A.shiftTile, { n: prog.best }) : A.shiftLocked}</span></button>
    </div>
    <div class="map-foot"><button class="btn ghost" data-act="about">${A.realIncidentBehind}</button>${totalStars() > 0 ? `<button class="btn ghost" data-act="reset">${A.resetProgress}</button>` : ''}</div>
  </main>`;
}

function card(d: AgentDef, where: 'hand' | 'crew', m?: Member) {
  const k = kindOf(d);
  const inCrew = S!.builder?.def.id === d.id || S!.helpers.some(h => h.def.id === d.id);
  const seen = S!.revealed.has(d.id);
  const kindLabel = tx.kinds[k];
  const mini = `<svg viewBox="-24 -60 48 66" class="mini" aria-hidden="true"><rect x="-19" y="-44" width="38" height="38" rx="15" fill="${d.color}" stroke="#00000033" stroke-width="2"/><circle cx="-7" cy="-27" r="5.5" fill="#fff"/><circle cx="7" cy="-27" r="5.5" fill="#fff"/><circle cx="-5.6" cy="-27" r="2.6" fill="#222"/><circle cx="8.4" cy="-27" r="2.6" fill="#222"/>${k === 'guard' ? '<path d="M-17 -38h34l-4 -10h-26z" fill="#2c3e66"/>' : k === 'builder' ? '<path d="M-15 -40q15 -16 30 0z" fill="#f4c542"/>' : k === 'fetcher' ? '<ellipse cx="0" cy="-52" rx="14" ry="3" fill="#dfe6ee" stroke="#8795a3"/>' : '<path d="M-16 -38l-4 -12 10 6zM16 -38l4 -12 -10 6z" fill="' + d.color + '"/>'}</svg>`;
  const keys = where === 'crew' && m && hasKeys(d) ? `<div class="keys" role="group" aria-label="${fmt(A.keysFor, { name: d.name })}">
      <button class="key ${m.vault ? 'on' : ''}" data-act="key" data-uid="${m.uid}" data-k="vault" aria-pressed="${m.vault}" title="${A.vaultKeyTitle}">${A.vaultKey}</button>
      <button class="key ${m.gate ? 'on' : ''}" data-act="key" data-uid="${m.uid}" data-k="gate" aria-pressed="${m.gate}" title="${A.gateKeyTitle}">${A.gateKey}</button></div>`
    : where === 'crew' && !hasKeys(d) ? `<div class="keys note">${k === 'guard' ? A.standsAtGate : A.watchesBoard} · ${A.noKeys}</div>` : '';
  const claim = `<p class="claim">${fmt(A.claim, { claim: d.claim })}</p>`;
  const obs = seen ? `<p class="observed"><span>${A.observed}</span> ${REVEAL[d.trait]}</p>` : (S!.mode === 'shift' || S!.level.id === 'l4') ? `<p class="unknown">${A.unknown}</p>` : '';
  const act = where === 'hand' ? (inCrew ? 'disabled' : `data-act="add" data-id="${d.id}"`) : '';
  return `<div class="card kind-${k} c-${where} ${inCrew && where === 'hand' ? 'used' : ''} ${seen ? 'seen' : ''}">
    ${where === 'hand' ? `<button class="card-hit" ${act} aria-label="${fmt(inCrew ? A.inCrew : A.addAgent, { name: d.name, kind: kindLabel })}"></button>` : ''}
    <div class="card-head">${mini}<div><div class="card-name">${d.name}</div><div class="card-kind">${kindLabel}</div></div>
    ${where === 'crew' && m ? `<button class="x" data-act="remove" data-uid="${m.uid}" aria-label="${fmt(A.removeAgent, { name: d.name })}">✕</button>` : ''}</div>
    ${claim}${obs}${keys}</div>`;
}

function renderLevel() {
  const s = S!; const L = s.level;
  const idx = LEVELS.indexOf(L);
  const keys = keysOf(team());
  const crewSlots = [
    s.builder ? card(s.builder.def, 'crew', s.builder) : `<div class="slot empty">${A.builderSlot}</div>`,
    ...Array.from({ length: L.slots }, (_, i) => s.helpers[i] ? card(s.helpers[i]!.def, 'crew', s.helpers[i]) : `<div class="slot empty">${fmt(A.helperSlot, { n: i + 1 })}</div>`),
  ].join('');
  const hand = [...s.setup.builders, ...s.setup.helpers].map(d => card(d, 'hand')).join('');
  const head = s.mode === 'shift'
    ? `<div class="lvl-title"><span class="pill">${A.shiftPill}</span><h1>${L.title}</h1><span class="streak">${fmt(A.streakLine, { n: s.shiftDepth, best: prog.best })}</span></div>`
    : `<div class="lvl-title"><span class="pill">${idx + 1} · ${L.concept}</span><h1>${L.icon} ${L.title}</h1><span class="lvl-stars">${'★'.repeat(prog.stars[L.id] || 0)}<span class="dim">${'★'.repeat(3 - (prog.stars[L.id] || 0))}</span></span></div>`;
  const oldSvg = stage?.svg ?? null;
  root.innerHTML = topbar(head) + `<main class="level">
    <section class="stage-col">
      <div class="stage-box" id="stage-host">
        <div class="stage-hud">
          <span class="chip ${s.running ? (s.lastMode === 'live' ? 'live' : 'test') : ''}">${s.running ? (s.lastMode === 'live' ? A.chipLive : A.chipTest) : A.chipReady}</span>
          <span class="hud-right">${s.running ? `<button class="chip btn-chip" data-act="skip">${A.skip}</button>` : ''}<button class="chip btn-chip" data-act="speed" aria-label="${A.speed}">${speed}×</button></span>
        </div>
        <div class="director-bubble" id="dir">${DIRECTOR}<p id="dir-text">${L.briefing[0] ?? LINES.newShift}</p></div>
      </div>
      <div class="step runbar ${s.helpers.length > 0 && !s.result && !s.running ? 'next' : ''}">
      <h2><span class="num">3</span> ${A.runIt} <span class="sub">${A.runItSub}</span></h2>
      <div class="run-row">
        <button class="btn test" data-act="run" data-mode="test" ${s.running || !s.builder || s.lives <= 0 ? 'disabled' : ''}>${A.testRun}<small>${s.lives > 0 ? fmt(A.testsLeftSmall, { n: s.lives, max: TEST_BUDGET }) : A.noTestsLeft}</small></button>
        <button class="btn live" data-act="run" data-mode="live" ${s.running || !s.builder ? 'disabled' : ''}>${A.goLive}<small>${A.realSecret}${s.mode === 'shift' ? A.leakEndsStreak : ''}</small></button>
      </div>
      <div class="meta-row"><span>${fmt(A.testsLeft, { n: s.lives, max: TEST_BUDGET })}</span><span>${A.realLeaks} <b class="${s.liveLeaks ? 'bad' : ''}">${s.liveLeaks}</b></span><button class="linkbtn" data-act="hint">${A.hint}</button></div>
      </div>
      <div class="goal">${A.goal} ${L.goal} <span class="rules">${A.winRule}</span></div>
      <section class="log" aria-live="polite">
        <div class="log-head"><h2>${A.securityLog}</h2><label class="code-toggle"><input type="checkbox" id="codeTog" ${root.classList.contains('show-code') ? 'checked' : ''}> ${A.showCode}</label></div>
        <ol id="log">${s.result ? '' : `<li class="log-empty">${A.logEmpty}</li>`}</ol>
      </section>
    </section>
    <aside class="panel">
      <div class="step ${s.helpers.length === 0 && !s.result ? 'next' : ''}">
        <h2><span class="num">1</span> ${A.hireCrew} <span class="sub">${fmt(plural(L.slots, A.hireSubOne, A.hireSubMany), { n: L.slots })}</span></h2>
        <div class="hand">${hand}</div>
      </div>
      <div class="step">
        <h2><span class="num">2</span> ${A.handOutKeys} <span class="sub">${A.handOutSub}</span></h2>
        <div class="crew">${crewSlots}</div>
        <div class="keymeter">${fmt(A.keymeter, { n: keys, par: s.parKeys })}</div>
      </div>
    </aside>
  </main>`;
  const host = $('#stage-host')!;
  const sig = L.id + '|' + members().map(m => m.uid).join(',');
  if (stage && oldSvg && stageSig === sig) host.insertBefore(oldSvg, host.firstChild);
  else { stage = new Stage(host); host.insertBefore(stage.svg, host.firstChild); stage.setup(members(), L.board, lookFor(L)); stageSig = sig; }
  stage.productIcon = L.theme.icon;
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
  if (mode === 'test') { if (s.lives <= 0) { s.running = false; return; } s.tests++; s.lives--; }
  const r = simulate(team(), { board: s.level.board, theme: s.level.theme }, mode);
  renderLevel();
  if (matchMedia('(max-width: 980px)').matches) document.getElementById('stage-host')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (mode === 'test') director(s.lives === 0 ? LINES.lastTest : pick(LINES.test));
  else director(LINES.goingLive);
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
  if (fresh.length) setTimeout(() => toast(fresh.map(d => fmt(A.revealToast, { name: d.name, text: REVEAL[d.trait] })).join('<br>'), 'reveal'), 200);
  if (fresh.length) sfx.reveal();
  await outcome(r, mode);
}

async function outcome(r: SimResult, mode: Mode) {
  const s = S!;
  const win = r.complete && !r.leaked;
  if (mode === 'test') {
    if (r.leaked) { director(pick(LINES.testLeak)); toast(A.toastTestLeak, 'bad'); sfx.fail(); }
    else if (win) { director(pick(LINES.testOk)); toast(A.toastTestPass, 'good'); sfx.win(); }
    else { director(pick(LINES.fail)); toast(fmt(A.toastTestFail, { reason: r.failReason ?? '' }), 'meh'); sfx.fail(); }
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
  if (!r.complete) { director(pick(LINES.fail)); toast(fmt(A.toastLiveFail, { reason: r.failReason ?? '' }), 'meh'); sfx.fail(); maybeHint(); return; }
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

function maybeHint() { const s = S!; if (!s.hintShown && s.tests + s.liveLeaks >= 3) { s.hintShown = true; setTimeout(() => toast(fmt(A.hintToast, { hint: s.level.hint }), 'hint'), 2600); } }

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
  modal(`<div class="brief">${DIRECTOR}<div><div class="eyebrow">${fmt(A.briefEyebrow, { n: i + 1, concept: L.concept })}</div><h2>${L.icon} ${L.title}</h2>${lines}</div></div>
   ${firstTime ? howToHTML() : ''}
   <div class="modal-actions"><button class="btn primary" data-act="close">${A.letsGo}</button></div>`, 'wide');
  if (firstTime) { prog.seenIntro = true; save(); }
}

function howToHTML() {
  const ico = (item: 'secret' | 'public') => itemSVG(item).replace('<g class="itm">', '<svg viewBox="-17 -14 34 28" class="ico"><g>').replace(/<\/g>$/, '</g></svg>');
  // each text sits in its own <span> so the flex row keeps it as one block next to its icon
  const [secret, pub, keys, outside, test, stars] = A.howto;
  return `<div class="howto">
    <div><span class="hi">${ico('secret')}</span><span>${secret}</span></div>
    <div><span class="hi">${ico('public')}</span><span>${pub}</span></div>
    <div><span class="hi big">🔑🚪</span><span>${keys}</span></div>
    <div><span class="hi big">🌐</span><span>${outside}</span></div>
    <div><span class="hi big">🧪</span><span>${test}</span></div>
    <div><span class="hi big">★</span><span>${stars}</span></div>
  </div>`;
}

function winModal(r: SimResult, stars: number) {
  const s = S!; const L = s.level; const i = LEVELS.indexOf(L);
  const last = i === LEVELS.length - 1;
  const row = (on: boolean, t: string) => `<li class="${on ? 'on' : ''}"><span class="st">★</span>${t}</li>`;
  modal(`<div class="win-head"><div class="big-lantern">${s.level.theme.icon}</div><h2>${fmt(A.winHead, { product: themeText(s.level.theme).product })}</h2></div>
    <ul class="star-list">
      ${row(true, A.starSafe)}
      ${row(r.keys <= s.parKeys, fmt(r.keys <= s.parKeys ? A.starKeysOk : A.starKeysMore, { n: r.keys, par: s.parKeys }))}
      ${row(s.liveLeaks === 0, s.liveLeaks === 0 ? A.starClean : fmt(plural(s.liveLeaks, A.starLeaksOne, A.starLeaksMany), { n: s.liveLeaks }))}
    </ul>
    <div class="field-note"><div class="fn-tag">${fmt(A.fieldNote, { concept: L.concept.toUpperCase() })}</div><h3>${L.note.title}</h3><p>${L.note.body}</p><p class="real">${A.inRealWorld} ${L.note.incident}</p></div>
    <div class="modal-actions"><button class="btn ghost" data-act="retry">${A.replay}</button><button class="btn primary" data-act="${last ? 'final' : 'next'}">${last ? A.finish : A.nextLevel}</button></div>`, 'win');
  root.querySelectorAll('.star-list li.on').forEach((li, k) => setTimeout(() => { li.classList.add('pop'); sfx.star(k); }, 350 + k * 380));
  confetti();
}

function incident(r: SimResult) {
  const s = S!;
  sfx.fail();
  const no = String(1000 + Math.floor(Math.random() * 9000));
  const items = r.events.map((e, i) => `<li><button class="cause-pick" data-act="cause" data-i="${i}"><span class="n">${i + 1}</span>${e.text}</button></li>`).join('');
  const shiftOver = s.mode === 'shift';
  modal(`<div class="incident-head"><div class="stamp">${A.incidentStamp}</div><div><div class="eyebrow">${fmt(A.incidentNo, { no })}</div><h2>${fmt(A.incidentHead, { real: themeText(s.level.theme).real })}</h2></div></div>
    <p class="ir-task">${A.findCause}</p>
    <ol class="ir-list">${items}</ol>
    <div id="ir-feedback" class="ir-feedback" aria-live="polite"></div>
    <div class="modal-actions">${shiftOver ? `<button class="btn primary" data-act="shift-over">${fmt(A.endShift, { n: s.shiftDepth })}</button>` : `<button class="btn primary" data-act="close">${A.drawingBoard}</button>`}</div>`, 'incident');
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
    // the event's code line (always English pseudo-code) tells which mistake this was
    const C = A.causes;
    const why = e.code.includes('take(') ? C.take :
      e.code.includes('wrap(') ? C.wrap :
      e.code.includes('label ===') ? C.label :
      e.code.includes('allow(*)') ? C.waver :
      e.code.includes('post(') ? C.post :
      e.code.includes('detect(') ? C.detect :
      e.code.includes('inspectors=[]') ? C.noGuard : C.other;
    fb.innerHTML = fmt(A.causeFound, { why });
    if (!(btn as HTMLElement).dataset.counted) { prog.causes++; save(); (btn as HTMLElement).dataset.counted = '1'; }
  } else {
    btn.classList.add('wrong'); sfx.bump();
    fb.innerHTML = e.kind === 'leak' ? A.causeLeftHere : A.causeFine;
  }
}

function shiftWin(r: SimResult) {
  const s = S!;
  const depth = s.shiftDepth + 1;
  prog.best = Math.max(prog.best, depth); save();
  modal(`<div class="win-head"><div class="big-lantern">🏮</div><h2>${fmt(A.shiftSurvived, { n: depth })}</h2></div>
    <p class="center">${fmt(A.shiftStats, { n: depth, best: prog.best, keys: r.keys })}${r.keys <= s.parKeys ? A.perfect : fmt(A.bestPossible, { par: s.parKeys })}</p>
    <div class="modal-actions"><button class="btn ghost" data-act="map">${A.clockOut}</button><button class="btn primary" data-act="next-shift">${A.nextShift}</button></div>`, 'win');
  confetti();
}

function renderFinal() {
  const t = totalStars();
  root.innerHTML = topbar('') + `<main class="final">
    <div class="certificate">
      <div class="cert-seal">🏮</div>
      <div class="eyebrow">${A.certifies}</div>
      <h1>${A.auditor}</h1>
      <p>${A.finalText}</p>
      <div class="cert-stats"><div><b>${t}</b><span>${fmt(A.ofStars, { n: LEVELS.length * 3 })}</span></div><div><b>${prog.causes}</b><span>${A.causesFound}</span></div><div><b>${prog.best}</b><span>${A.bestStreak}</span></div></div>
      <ul class="lessons">${LEVELS.map(L => `<li><span>${L.icon}</span><b>${L.note.title}</b> — ${L.note.body}</li>`).join('')}</ul>
      <div class="modal-actions"><button class="btn ghost" data-act="share">${A.copyResult}</button><button class="btn ghost" data-act="about">${A.realIncident}</button><button class="btn primary" data-act="shift">${A.playShift}</button></div>
    </div></main>`;
  confetti();
}

function about() {
  modal(`<h2>${A.aboutTitle}</h2>
    <p>${A.about1}</p>
    <p>${A.about2}</p>
    <p class="muted">${A.about3}</p>
    <p class="sources">${A.sources} <a href="https://openai.com/index/hugging-face-incident-and-the-road-ahead/" target="_blank" rel="noopener">${A.sourceOpenAI}</a> · <a href="https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/" target="_blank" rel="noopener">${A.sourceMETR}</a></p>
    <div class="modal-actions"><button class="btn primary" data-act="close">${A.close}</button></div>`, 'wide');
}

/** EN · FR · ES links on the title screen, only when the sofi.games shell (SofiLang) isn't there to offer its own switcher. */
function langSwitch() {
  if ((window as Window & { SofiLang?: unknown }).SofiLang) return '';
  const name: Record<Lang, string> = { en: 'English', fr: 'Français', es: 'Español' };
  return `<p class="fine lang-switch" role="group" aria-label="${A.language}">${LANGS.map(l => l === lang
    ? `<b aria-current="true">${l.toUpperCase()}</b>`
    : `<a href="?lang=${l}" data-act="lang" data-lang="${l}" lang="${l}" title="${name[l]}">${l.toUpperCase()}</a>`).join(' · ')}</p>`;
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
    case 'help': modal(`<h2>${A.howToPlay}</h2>${howToHTML()}<div class="modal-actions"><button class="btn primary" data-act="close">${A.gotIt}</button></div>`, 'wide'); break;
    case 'lang': {
      ev.preventDefault();
      const l = t.dataset.lang!;
      try { localStorage.setItem(LANG_KEY, l); } catch { /* storage blocked: the ?lang= link still works */ }
      const u = new URL(location.href); u.searchParams.delete('lang');
      location.href = u.toString();
      break;
    }
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
        if (s.helpers.length >= s.level.slots) { toast(fmt(plural(s.level.slots, A.slotsFullOne, A.slotsFullMany), { n: s.level.slots }), 'meh'); sfx.bump(); return; }
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
      const txt = fmt(A.share, { stars: totalStars(), max: LEVELS.length * 3, causes: prog.causes, best: prog.best, url: location.href });
      navigator.clipboard?.writeText(txt).then(() => toast(A.copied, 'good'), () => toast(txt, 'good'));
      break;
    }
  }
}
