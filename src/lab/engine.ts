// Little Agent Lab — deterministic simulation, levels, solver and shift generator.
// No live models: every agent is a tiny scripted behaviour ("trait").
// Player-visible text comes from ./strings (see i18n.ts); the `code` lines stay as pseudo-code.
import { tx, fmt } from './i18n';

export type Trait =
  | 'careful' | 'eager' | 'sticker' | 'polished' | 'rook'   // builders
  | 'tidy' | 'grabby'                                        // fetchers
  | 'inspector' | 'waver' | 'labelreader'                    // gate guards
  | 'owl';                                                   // back-channel monitor
export type Kind = 'builder' | 'fetcher' | 'guard' | 'monitor';
export type Item = 'secret' | 'decoy' | 'public' | 'envelope';
export type Mode = 'test' | 'live';
export type Spot = 'home' | 'vault' | 'bench' | 'gateIn' | 'gateOut' | 'kiosk' | 'board' | 'post';

export interface AgentDef {
  id: string; name: string; trait: Trait; claim: string;
  color: string; hat?: string;
}
export interface Member { uid: string; def: AgentDef; vault: boolean; gate: boolean; }
export interface Team { builder: Member | null; helpers: Member[]; }

export type Act =
  | { a: 'move'; who: string; to: Spot }
  | { a: 'hold'; who: string; item: Item | null }
  | { a: 'say'; who: string; text: string }
  | { a: 'bump'; who: string }
  | { a: 'block'; who: string }
  | { a: 'leak'; from: string; item: Item }
  | { a: 'post'; who: string; item: Item }
  | { a: 'unpost'; who: string }
  | { a: 'reply' }
  | { a: 'alarm' }
  | { a: 'build' };

export type EventKind = 'work' | 'wait' | 'blocked' | 'leak' | 'success' | 'suspicious';
export interface SimEvent {
  actor: string; text: string; code: string; kind: EventKind;
  acts: Act[]; cause?: boolean; reveals?: string[];
}
export interface SimResult {
  events: SimEvent[]; complete: boolean; leaked: boolean; keys: number;
  failReason?: string;
}

export const KIND_OF: Record<Trait, Kind> = {
  careful: 'builder', eager: 'builder', sticker: 'builder', polished: 'builder', rook: 'builder',
  tidy: 'fetcher', grabby: 'fetcher',
  inspector: 'guard', waver: 'guard', labelreader: 'guard',
  owl: 'monitor',
};

/** What the player learns once they have seen a trait in action (in the current language). */
export const REVEAL = new Proxy({} as Record<Trait, string>, { get: (_, k) => tx.reveal[k as Trait] });

export const kindOf = (d: AgentDef): Kind => KIND_OF[d.trait];
export const hasKeys = (d: AgentDef) => { const k = kindOf(d); return k === 'builder' || k === 'fetcher'; };
export const keysOf = (t: Team) => [t.builder, ...t.helpers].reduce((n, m) => n + (m && hasKeys(m.def) ? (+m.vault) + (+m.gate) : 0), 0);


/** A level's things. Their names (with articles, per language) live in tx.themes[i]. */
export interface Theme { i: number; pubCode: string; productCode: string; icon: string; }
export const THEMES: Theme[] = [
  { i: 0, pubCode: 'public_weather', productCode: 'weather_lantern', icon: '🏮' },
  { i: 1, pubCode: 'public_prices', productCode: 'birthday_cake', icon: '🎂' },
  { i: 2, pubCode: 'public_map', productCode: 'party_invitation', icon: '💌' },
  { i: 3, pubCode: 'public_star_chart', productCode: 'tiny_rocket', icon: '🚀' },
  { i: 4, pubCode: 'public_manual', productCode: 'music_box', icon: '🎶' },
  { i: 5, pubCode: 'public_schedule', productCode: 'concert_poster', icon: '🎻' },
  { i: 6, pubCode: 'public_ingredients', productCode: 'moon_potion', icon: '🌙' },
  { i: 7, pubCode: 'public_guest_list', productCode: 'grand_opening', icon: '🎉' },
];
export const themeText = (t: Theme) => tx.themes[t.i]!;

// ───────────────────────────── simulation ─────────────────────────────

export function simulate(team: Team, opts: { board: boolean; theme?: Theme }, mode: Mode): SimResult {
  const E: SimEvent[] = [];
  const S: Item = mode === 'test' ? 'decoy' : 'secret';
  const T = opts.theme ?? THEMES[0]!;
  const W = themeText(T);            // the theme's words in the current language
  const ev = tx.ev, fl = tx.fail;
  const sName = mode === 'test' ? W.decoy : W.secretS;
  // every text can use these theme words
  const w = { sName, theSecret: W.theSecret, real: W.real, thePub: W.thePub, publicPub: W.publicPub, theProduct: W.theProduct, icon: T.icon };
  const say = (s: string, v: Record<string, string> = {}) => fmt(s, { ...w, ...v });
  const B = team.builder;
  if (!B) return { events: [], complete: false, leaked: false, keys: 0, failReason: fl.pickBuilder };
  const fetchers = team.helpers.filter(m => kindOf(m.def) === 'fetcher');
  const guards = team.helpers.filter(m => kindOf(m.def) === 'guard');
  const owls = team.helpers.filter(m => kindOf(m.def) === 'monitor');
  const n = (m: Member) => m.def.name;
  const c = (m: Member) => m.def.name.toLowerCase();
  const push = (e: SimEvent) => { E.push(e); };

  let leaked = false;
  let hasPublic = false;
  let secretWithBuilder = false;
  let failReason = '';

  // Crossing the gate: returns what happened to the payload.
  const crossGate = (m: Member, payload: Item | null): 'clear' | 'blocked' | 'leak' => {
    const label = payload === 'envelope' ? ev.envelope : sName;
    push({ actor: n(m), text: payload ? say(ev.walkGate, { n: n(m), label }) : say(ev.walkGateEmpty, { n: n(m) }), code: `${c(m)}.goto("gate", carrying=${payload ? JSON.stringify(payload) : 'null'})`, kind: 'work', acts: [{ a: 'move', who: m.uid, to: 'gateIn' }] });
    if (!payload) {
      for (const g of guards) push({ actor: n(g), text: say(ev.emptyOk, { g: n(g) }), code: `${c(g)}.allow(payload=null)`, kind: 'work', acts: [{ a: 'say', who: g.uid, text: ev.sayEmpty }] });
      push({ actor: n(m), text: say(ev.stepOutEmpty, { n: n(m) }), code: `${c(m)}.exit(gate)`, kind: 'work', acts: [{ a: 'move', who: m.uid, to: 'gateOut' }] });
      return 'clear';
    }
    if (guards.length === 0) {
      push({ actor: ev.actorGate, text: say(ev.noGuard, { n: n(m), label }), code: `gate.open(inspectors=[])`, kind: 'leak', cause: true, acts: [{ a: 'move', who: m.uid, to: 'gateOut' }, { a: 'leak', from: m.uid, item: payload }] });
      return 'leak';
    }
    for (const g of guards) {
      const t = g.def.trait;
      if (t === 'inspector') {
        push({ actor: n(g), text: say(payload === 'envelope' ? ev.inspectEnvelope : ev.inspect, { g: n(g) }), code: `${c(g)}.deny(content.private === true)`, kind: 'blocked', reveals: [g.uid], acts: [{ a: 'say', who: g.uid, text: ev.sayPrivate }, { a: 'block', who: g.uid }, { a: 'hold', who: m.uid, item: null }, { a: 'hold', who: g.uid, item: payload === 'envelope' ? S : payload }] });
        return 'blocked';
      }
      if (t === 'labelreader') {
        if (payload === 'envelope') {
          push({ actor: n(g), text: say(ev.labelPublic, { g: n(g) }), code: `${c(g)}.allow(label === "public")  // content never checked`, kind: 'suspicious', cause: true, reveals: [g.uid], acts: [{ a: 'say', who: g.uid, text: ev.sayLabelPublic }] });
          continue;
        }
        push({ actor: n(g), text: say(ev.labelPrivate, { g: n(g) }), code: `${c(g)}.deny(label === "private")`, kind: 'blocked', acts: [{ a: 'say', who: g.uid, text: ev.sayLabelPrivate }, { a: 'block', who: g.uid }, { a: 'hold', who: m.uid, item: null }, { a: 'hold', who: g.uid, item: payload }] });
        return 'blocked';
      }
      // waver
      push({ actor: n(g), text: say(ev.waver, { g: n(g), n: n(m) }), code: `${c(g)}.allow(*)  // no check performed`, kind: 'suspicious', cause: true, reveals: [g.uid], acts: [{ a: 'say', who: g.uid, text: ev.sayWaver }] });
    }
    push({ actor: n(m), text: say(ev.leaves, { label }), code: `leak(${JSON.stringify(payload)}, to="outside")`, kind: 'leak', acts: [{ a: 'move', who: m.uid, to: 'gateOut' }, { a: 'leak', from: m.uid, item: payload }] });
    return 'leak';
  };

  const fetchAndReturn = (m: Member, blockedBy: Member | null) => {
    push({ actor: n(m), text: say(ev.fetch, { n: n(m) }), code: `${c(m)}.fetch("${T.pubCode}")`, kind: 'work', acts: [{ a: 'move', who: m.uid, to: 'kiosk' }, { a: 'hold', who: m.uid, item: 'public' }] });
    const back: Act[] = [{ a: 'move', who: m.uid, to: 'bench' }, { a: 'hold', who: m.uid, item: null }];
    if (blockedBy) back.unshift({ a: 'move', who: m.uid, to: 'gateIn' }, { a: 'hold', who: blockedBy.uid, item: null });
    push({ actor: n(m), text: blockedBy ? say(ev.bringBackCollect, { n: n(m), b: n(blockedBy) }) : say(ev.bringBack, { n: n(m) }), code: `${c(m)}.handoff("${T.pubCode}", "bench")`, kind: 'work', acts: back });
    hasPublic = true;
  };

  // 1 · builder opens the vault
  if (!B.vault) {
    push({ actor: n(B), text: say(ev.noVault, { n: n(B) }), code: `${c(B)}.open("vault")  // PermissionError`, kind: 'wait', acts: [{ a: 'move', who: B.uid, to: 'vault' }, { a: 'bump', who: B.uid }, { a: 'say', who: B.uid, text: ev.sayLocked }] });
    failReason = say(fl.noVault, { n: n(B) });
  } else {
    push({ actor: n(B), text: say(ev.takeSecret, { n: n(B) }), code: `${c(B)}.read("${S}")`, kind: 'work', acts: [{ a: 'move', who: B.uid, to: 'vault' }, { a: 'hold', who: B.uid, item: S }, { a: 'move', who: B.uid, to: 'bench' }] });
    secretWithBuilder = true;
  }

  // 2 · fetchers
  for (const f of fetchers) {
    if (hasPublic) { push({ actor: n(f), text: say(ev.alreadyHere, { n: n(f) }), code: `${c(f)}.idle()`, kind: 'work', acts: [{ a: 'say', who: f.uid, text: ev.sayAlready }] }); continue; }
    let carrying: Item | null = null;
    if (f.def.trait === 'grabby' && f.vault) {
      push({ actor: n(f), text: say(ev.grab, { n: n(f) }), code: `${c(f)}.take("${S}")  // access it was never meant to use`, kind: 'suspicious', cause: true, reveals: [f.uid], acts: [{ a: 'move', who: f.uid, to: secretWithBuilder ? 'bench' : 'vault' }, ...(secretWithBuilder ? [{ a: 'hold', who: B.uid, item: null } as Act] : []), { a: 'hold', who: f.uid, item: S }, { a: 'say', who: f.uid, text: ev.sayGrab }] });
      carrying = S;
    }
    if (!f.gate) {
      push({ actor: n(f), text: say(ev.noGate, { n: n(f) }), code: `${c(f)}.exit(gate)  // PermissionError`, kind: 'wait', acts: [{ a: 'move', who: f.uid, to: 'gateIn' }, { a: 'bump', who: f.uid }, { a: 'say', who: f.uid, text: ev.sayNoGate }] });
      if (carrying) push({ actor: n(f), text: say(ev.putBack, { n: n(f) }), code: `${c(f)}.put("${S}", "bench")`, kind: 'work', acts: [{ a: 'move', who: f.uid, to: 'bench' }, { a: 'hold', who: f.uid, item: null }, ...(secretWithBuilder ? [{ a: 'hold', who: B.uid, item: S } as Act] : [])] });
      if (!failReason) failReason = say(fl.noGate, { n: n(f) });
      continue;
    }
    const r = crossGate(f, carrying);
    if (r === 'leak') leaked = true;
    const blocker = r === 'blocked' ? guards.find(g => g.def.trait === 'inspector' || g.def.trait === 'labelreader') ?? null : null;
    fetchAndReturn(f, blocker);
    if (f.def.trait === 'tidy') E[E.length - 1]!.reveals = [f.uid];
    if (carrying && secretWithBuilder) {
      push({ actor: n(f), text: say(r === 'leak' ? ev.dropBackLeak : ev.dropBack, { n: n(f) }), code: `${c(f)}.put("${S}", "bench")`, kind: r === 'leak' ? 'leak' : 'work', acts: [{ a: 'hold', who: B.uid, item: S }] });
    }
  }

  // 3 · builder handles a missing public item itself
  if (!hasPublic && secretWithBuilder) {
    const t = B.def.trait;
    let tryGate = true;
    if (t === 'careful') {
      push({ actor: n(B), text: say(ev.careful, { n: n(B) }), code: `${c(B)}.wait_for("${T.pubCode}")`, kind: 'wait', reveals: [B.uid], acts: [{ a: 'say', who: B.uid, text: say(ev.sayCareful) }] });
      failReason = say(fl.careful);
      tryGate = false;
    } else if (t === 'rook' && opts.board) {
      push({ actor: n(B), text: say(ev.rookPost, { n: n(B) }), code: `${c(B)}.post("backchannel_board", "${S}")  // unapproved channel`, kind: 'suspicious', cause: owls.length === 0, reveals: [B.uid], acts: [{ a: 'move', who: B.uid, to: 'board' }, { a: 'hold', who: B.uid, item: null }, { a: 'post', who: B.uid, item: S }, { a: 'say', who: B.uid, text: ev.sayRook }] });
      if (owls.length) {
        const o = owls[0]!;
        push({ actor: n(o), text: say(ev.owl, { n: n(o) }), code: `${c(o)}.flag(post.private === true)  // monitor catches it`, kind: 'blocked', reveals: [o.uid], acts: [{ a: 'move', who: o.uid, to: 'post' }, { a: 'unpost', who: o.uid }, { a: 'alarm' }, { a: 'say', who: o.uid, text: ev.sayOwl }, { a: 'hold', who: o.uid, item: null }, { a: 'move', who: o.uid, to: 'home' }] });
        push({ actor: n(B), text: say(ev.retry, { n: n(B) }), code: `${c(B)}.retry()`, kind: 'work', acts: [{ a: 'move', who: B.uid, to: 'bench' }, { a: 'hold', who: B.uid, item: S }] });
      } else {
        push({ actor: ev.actorOutsiders, text: say(ev.outsiders), code: `outside.copy("${S}")`, kind: 'leak', acts: [{ a: 'leak', from: 'board', item: S }, { a: 'reply' }] });
        leaked = true;
        push({ actor: n(B), text: say(ev.collectBoard, { n: n(B) }), code: `${c(B)}.collect("board")`, kind: 'work', acts: [{ a: 'unpost', who: B.uid }, { a: 'hold', who: B.uid, item: 'public' }, { a: 'move', who: B.uid, to: 'bench' }, { a: 'hold', who: B.uid, item: S }] });
        hasPublic = true;
        tryGate = false;
      }
    }
    if (tryGate) {
      if (!B.gate) {
        push({ actor: n(B), text: say(ev.noGateBuilder, { n: n(B) }), code: `${c(B)}.exit(gate)  // PermissionError`, kind: 'wait', reveals: [B.uid], acts: [{ a: 'hold', who: B.uid, item: null }, { a: 'move', who: B.uid, to: 'gateIn' }, { a: 'bump', who: B.uid }, { a: 'say', who: B.uid, text: ev.sayGateLocked }, { a: 'move', who: B.uid, to: 'bench' }, { a: 'hold', who: B.uid, item: S }] });
        failReason = say(fl.nobody);
      } else {
        let payload: Item | null = S;
        if (t === 'sticker') {
          push({ actor: n(B), text: say(ev.sticker, { n: n(B) }), code: `${c(B)}.wrap("${S}", label="public")  // gaming the rule`, kind: 'suspicious', cause: true, reveals: [B.uid], acts: [{ a: 'hold', who: B.uid, item: 'envelope' }, { a: 'say', who: B.uid, text: ev.saySticker }] });
          payload = 'envelope';
        } else if (t === 'polished') {
          if (mode === 'test') {
            push({ actor: n(B), text: say(ev.pollyTest, { n: n(B) }), code: `${c(B)}.detect(env === "test")  // best behaviour`, kind: 'suspicious', acts: [{ a: 'say', who: B.uid, text: ev.sayPollyTest }, { a: 'hold', who: B.uid, item: null }] });
            payload = null;
          } else {
            push({ actor: n(B), text: say(ev.pollyLive, { n: n(B) }), code: `${c(B)}.detect(env === "test")  // false → takes the real one`, kind: 'suspicious', cause: true, reveals: [B.uid], acts: [{ a: 'say', who: B.uid, text: ev.sayPollyLive }] });
          }
        } else {
          push({ actor: n(B), text: say(ev.eager, { n: n(B) }), code: `${c(B)}.plan("ask_outside", attach="${S}")`, kind: 'work', reveals: [B.uid], acts: [{ a: 'say', who: B.uid, text: ev.sayEager }] });
        }
        const r = crossGate(B, payload);
        if (r === 'leak') leaked = true;
        const blocker = r === 'blocked' ? guards.find(g => g.def.trait !== 'waver') ?? null : null;
        push({ actor: n(B), text: say(ev.fetchBuilder, { n: n(B) }), code: `${c(B)}.fetch("${T.pubCode}")`, kind: 'work', acts: [{ a: 'move', who: B.uid, to: 'kiosk' }, { a: 'hold', who: B.uid, item: 'public' }] });
        const back: Act[] = [];
        if (blocker) back.push({ a: 'move', who: B.uid, to: 'gateIn' }, { a: 'hold', who: blocker.uid, item: null });
        back.push({ a: 'move', who: B.uid, to: 'bench' }, { a: 'hold', who: B.uid, item: S });
        push({ actor: n(B), text: blocker ? say(ev.returnBenchCollect, { n: n(B), b: n(blocker) }) : say(ev.returnBench, { n: n(B) }), code: `${c(B)}.return("bench")`, kind: 'work', acts: back });
        hasPublic = true;
      }
    }
  }

  const complete = hasPublic && secretWithBuilder;
  if (complete) {
    push({ actor: n(B), text: say(ev.done, { n: n(B) }), code: `${c(B)}.build("${T.productCode}")`, kind: 'success', acts: [{ a: 'build' }] });
  } else if (!failReason) failReason = say(fl.product);
  return { events: E, complete, leaked, keys: keysOf(team), failReason: complete ? undefined : failReason };
}

// ───────────────────────────── roster ─────────────────────────────

type ClaimKey = keyof typeof tx.claims;
/** A roster agent; its card text (claim) is read in the current language. */
const A = (id: ClaimKey, name: string, trait: Trait, color: string): AgentDef => ({ id, name, trait, color, get claim() { return tx.claims[id]; } });
export const AG = {
  moss: A('moss', 'Moss', 'careful', '#6fb58a'),
  dash: A('dash', 'Dash', 'eager', '#f0a26b'),
  sable: A('sable', 'Sable', 'sticker', '#e07a9a'),
  rook: A('rook', 'Rook', 'rook', '#9a86d8'),
  polly: A('polly', 'Polly', 'polished', '#e6c14f'),
  pip: A('pip', 'Pip', 'tidy', '#6aa7d8'),
  magpie: A('magpie', 'Magpie', 'grabby', '#58606e'),
  lens: A('lens', 'Lens', 'inspector', '#b18be0'),
  stamp: A('stamp', 'Stamp', 'labelreader', '#d0875a'),
  owl: A('owl', 'Owl', 'owl', '#8c7a5b'),
};

// ───────────────────────────── levels ─────────────────────────────

export interface FieldNote { title: string; body: string; incident: string; }
export interface LevelSetup { builders: AgentDef[]; helpers: AgentDef[]; }
export interface Level {
  id: string; title: string; concept: string; icon: string;
  board: boolean; slots: number; theme: Theme;
  goal: string;
  briefing: string[];
  hint: string;
  note: FieldNote;
  make: (rng: () => number) => LevelSetup;
}

type LevelId = keyof typeof tx.levels;
type LevelBase = Omit<Level, 'title' | 'concept' | 'goal' | 'briefing' | 'hint' | 'note'> & { id: LevelId };
/** A campaign level: its texts (title, goal, briefing, hint, field note) are read in the current language. */
const level = (b: LevelBase): Level => ({
  ...b,
  get title() { return tx.levels[b.id].title; },
  get concept() { return tx.levels[b.id].concept; },
  get goal() { return tx.levels[b.id].goal; },
  get briefing() { return tx.levels[b.id].briefing; },
  get hint() { return tx.levels[b.id].hint; },
  get note() { return tx.levels[b.id].note; },
});

const fixed = (builders: AgentDef[], helpers: AgentDef[]) => () => ({ builders, helpers });

const GUARD_NAMES = [['Bolt', 'Nut'], ['Brick', 'Mortar'], ['Tick', 'Tock'], ['Salt', 'Pepper'], ['Ping', 'Pong'], ['Button', 'Zipper']];

export const LEVELS: Level[] = [
  level({
    id: 'l1', icon: '🏮', board: false, slots: 2,
    theme: THEMES[0]!,
    make: fixed([AG.moss, AG.dash], [AG.pip, AG.lens]),
  }),
  level({
    id: 'l2', icon: '🗝️', board: false, slots: 2,
    theme: THEMES[1]!,
    make: fixed([AG.moss, AG.dash], [AG.magpie, AG.lens]),
  }),
  level({
    id: 'l3', icon: '🛂', board: false, slots: 1,
    theme: THEMES[2]!,
    make: fixed([AG.moss, AG.dash], [AG.lens]),
  }),
  level({
    id: 'l4', icon: '🎖️', board: false, slots: 1,
    theme: THEMES[3]!,
    make: (rng) => {
      const pair = GUARD_NAMES[Math.floor(rng() * GUARD_NAMES.length)]!;
      const realFirst = rng() < 0.5;
      const claim = tx.claims.certified;
      const g1: AgentDef = { id: 'g1', name: pair[0]!, trait: realFirst ? 'inspector' : 'waver', claim, color: '#b18be0' };
      const g2: AgentDef = { id: 'g2', name: pair[1]!, trait: realFirst ? 'waver' : 'inspector', claim, color: '#7fa0e0' };
      return { builders: [AG.dash], helpers: [g1, g2] };
    },
  }),
  level({
    id: 'l5', icon: '🏷️', board: false, slots: 2,
    theme: THEMES[4]!,
    make: fixed([AG.sable], [AG.stamp, AG.magpie]),
  }),
  level({
    id: 'l6', icon: '📌', board: true, slots: 2,
    theme: THEMES[5]!,
    make: fixed([AG.rook], [AG.lens, AG.owl]),
  }),
  level({
    id: 'l7', icon: '🎓', board: false, slots: 2,
    theme: THEMES[6]!,
    make: fixed([AG.polly], [AG.pip, AG.lens]),
  }),
  level({
    id: 'l8', icon: '🎉', board: true, slots: 2,
    theme: THEMES[7]!,
    make: (rng) => {
      const pair = GUARD_NAMES[Math.floor(rng() * GUARD_NAMES.length)]!;
      const realFirst = rng() < 0.5;
      const claim = tx.claims.certifiedShort;
      const g1: AgentDef = { id: 'g1', name: pair[0]!, trait: realFirst ? 'inspector' : 'waver', claim, color: '#b18be0' };
      const g2: AgentDef = { id: 'g2', name: pair[1]!, trait: realFirst ? 'waver' : 'inspector', claim, color: '#7fa0e0' };
      return { builders: [AG.polly, AG.sable, AG.rook], helpers: [AG.magpie, g1, g2, AG.owl] };
    },
  }),
];


// ───────────────────────────── solver ─────────────────────────────

function* subsets<T>(xs: T[], max: number): Generator<T[]> {
  const n = xs.length;
  for (let mask = 0; mask < (1 << n); mask++) {
    const s = xs.filter((_, i) => mask & (1 << i));
    if (s.length <= max) yield s;
  }
}
const KEYSETS = [[false, false], [true, false], [false, true], [true, true]] as const;

export interface Solution { keys: number; helpers: number; team: Team; }
export function solve(setup: LevelSetup, board: boolean, slots: number): Solution | null {
  let best: Solution | null = null;
  for (const b of setup.builders) {
    for (const hs of subsets(setup.helpers, slots)) {
      const keyed = [b, ...hs.filter(hasKeys)];
      const combos = Math.pow(4, keyed.length);
      for (let k = 0; k < combos; k++) {
        const ks = keyed.map((_, i) => KEYSETS[Math.floor(k / Math.pow(4, i)) % 4]!);
        const mk = (d: AgentDef, i: number): Member => ({ uid: d.id, def: d, vault: hasKeys(d) ? ks[i]![0] : false, gate: hasKeys(d) ? ks[i]![1] : false });
        let ki = 1;
        const team: Team = { builder: mk(b, 0), helpers: hs.map(h => hasKeys(h) ? mk(h, ki++) : mk(h, -1)) };
        const r = simulate(team, { board }, 'live');
        if (r.complete && !r.leaked) {
          if (!best || r.keys < best.keys || (r.keys === best.keys && hs.length < best.helpers)) best = { keys: r.keys, helpers: hs.length, team };
        }
      }
    }
  }
  return best;
}

// ───────────────────────────── random shifts ─────────────────────────────

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const NAMES = ['Sprocket', 'Nib', 'Juniper', 'Cog', 'Fizz', 'Wren', 'Tinsel', 'Quark', 'Pebble', 'Ember', 'Lumen', 'Mochi', 'Orbit', 'Nova', 'Clover', 'Widget', 'Pixel', 'Comet', 'Tofu', 'Sprig', 'Vega', 'Rivet', 'Kelp', 'Zinc'];
const COLORS = ['#6fb58a', '#f0a26b', '#e07a9a', '#9a86d8', '#e6c14f', '#6aa7d8', '#58a0a0', '#c98bd8', '#d0875a', '#7fa0e0', '#8fb85a', '#d86a6a'];
/** Marketing blurbs for random crews (same count in every language, so a seed gives the same crew). */
const FLUFF = (k: Kind): string[] => tx.fluff[k];

export interface Shift { level: Level; setup: LevelSetup; par: Solution; }
export function makeShift(seed: number, depth: number): Shift {
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = rng(seed * 7919 + attempt * 104729 + 17);
    const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
    const names = [...NAMES].sort(() => r() - 0.5);
    const colors = [...COLORS].sort(() => r() - 0.5);
    let ni = 0;
    const mk = (trait: Trait): AgentDef => ({ id: `r${ni}`, name: names[ni]!, trait, claim: pick(FLUFF(KIND_OF[trait])), color: colors[ni++ % colors.length]! });
    const hard = depth >= 3;
    const bTraits: Trait[] = hard ? ['eager', 'sticker', 'polished', 'rook', 'careful'] : ['eager', 'sticker', 'rook', 'careful'];
    const board = r() < 0.4;
    const nb = 1 + (r() < 0.35 ? 1 : 0);
    const builders = Array.from({ length: nb }, () => mk(pick(bTraits)));
    const pool: Trait[] = ['tidy', 'grabby', 'grabby', 'inspector', 'waver', 'labelreader', 'waver', ...(board ? ['owl' as Trait] : [])];
    const nh = 2 + (r() < 0.5 ? 1 : 0);
    const helpers = Array.from({ length: nh }, () => mk(pick(pool)));
    const slots = 2;
    const par = solve({ builders, helpers }, board, slots);
    if (!par) continue;
    if (par.keys < 2) continue;
    // avoid shifts where the obvious default (everyone, every key) already wins
    const lazy = simulate({ builder: { uid: builders[0]!.id, def: builders[0]!, vault: true, gate: true }, helpers: helpers.slice(0, 2).map(h => ({ uid: h.id, def: h, vault: hasKeys(h), gate: hasKeys(h) })) }, { board }, 'live');
    if (lazy.complete && !lazy.leaked && attempt < 300) continue;
    const level: Level = {
      id: `shift-${seed}`, title: fmt(tx.shift.title, { n: depth + 1 }), concept: tx.shift.concept, icon: '🎲', board, slots, theme: THEMES[Math.floor(r() * THEMES.length)]!,
      goal: tx.shift.goal,
      briefing: [], hint: tx.shift.hint,
      note: { title: '', body: '', incident: '' }, make: () => ({ builders, helpers }),
    };
    return { level, setup: { builders, helpers }, par };
  }
  throw new Error('no solvable shift');
}
