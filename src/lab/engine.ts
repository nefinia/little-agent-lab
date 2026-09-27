// Little Agent Lab — deterministic simulation, levels, solver and shift generator.
// No live models: every agent is a tiny scripted behaviour ("trait").

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

/** What the player learns once they have seen a trait in action. */
export const REVEAL: Record<Trait, string> = {
  careful: 'Never leaves the workshop. Waits if anything is missing.',
  eager: 'Carries the secret outside to get help, if nobody stops it.',
  sticker: 'Slaps a “PUBLIC” sticker on the secret to get past checks.',
  polished: 'Perfect in tests. Different when it’s real.',
  rook: 'Posts the secret on the back-channel board to ask outsiders.',
  tidy: 'Only ever carries public info.',
  grabby: 'Grabs anything shiny it can reach — including the secret.',
  inspector: 'Really opens every bag. Blocks anything private.',
  waver: 'Wears a badge. Waves everything through.',
  labelreader: 'Reads the label, not what’s inside.',
  owl: 'Watches the back-channel board and tears down private posts.',
};

export const kindOf = (d: AgentDef): Kind => KIND_OF[d.trait];
export const hasKeys = (d: AgentDef) => { const k = kindOf(d); return k === 'builder' || k === 'fetcher'; };
export const keysOf = (t: Team) => [t.builder, ...t.helpers].reduce((n, m) => n + (m && hasKeys(m.def) ? (+m.vault) + (+m.gate) : 0), 0);

// ───────────────────────────── simulation ─────────────────────────────

export function simulate(team: Team, opts: { board: boolean }, mode: Mode): SimResult {
  const E: SimEvent[] = [];
  const S: Item = mode === 'test' ? 'decoy' : 'secret';
  const sName = mode === 'test' ? 'decoy blueprint' : 'secret blueprint';
  const B = team.builder;
  if (!B) return { events: [], complete: false, leaked: false, keys: 0, failReason: 'Pick a builder first.' };
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
    const label = payload === 'envelope' ? '“PUBLIC”-labelled envelope' : payload === S ? `the ${sName}` : 'nothing';
    push({ actor: n(m), text: `${n(m)} walks to the gate carrying ${label}.`, code: `${c(m)}.goto("gate", carrying=${payload ? JSON.stringify(payload) : 'null'})`, kind: 'work', acts: [{ a: 'move', who: m.uid, to: 'gateIn' }] });
    if (!payload) {
      for (const g of guards) push({ actor: n(g), text: `${n(g)}: “Empty hands? Go ahead.”`, code: `${c(g)}.allow(payload=null)`, kind: 'work', acts: [{ a: 'say', who: g.uid, text: 'Empty hands? Go ahead.' }] });
      push({ actor: n(m), text: `${n(m)} steps outside with empty hands.`, code: `${c(m)}.exit(gate)`, kind: 'work', acts: [{ a: 'move', who: m.uid, to: 'gateOut' }] });
      return 'clear';
    }
    if (guards.length === 0) {
      push({ actor: 'Gate', text: `Nobody is checking the gate. ${n(m)} walks straight out with ${label}.`, code: `gate.open(inspectors=[])`, kind: 'leak', cause: true, acts: [{ a: 'move', who: m.uid, to: 'gateOut' }, { a: 'leak', from: m.uid, item: payload }] });
      return 'leak';
    }
    for (const g of guards) {
      const t = g.def.trait;
      if (t === 'inspector') {
        push({ actor: n(g), text: `${n(g)} opens the bag, finds ${payload === 'envelope' ? 'the blueprint hidden in the envelope' : `the ${sName}`} and keeps it at the gate.`, code: `${c(g)}.deny(content.private === true)`, kind: 'blocked', reveals: [g.uid], acts: [{ a: 'say', who: g.uid, text: 'Private! That stays here.' }, { a: 'block', who: g.uid }, { a: 'hold', who: m.uid, item: null }, { a: 'hold', who: g.uid, item: payload === 'envelope' ? S : payload }] });
        return 'blocked';
      }
      if (t === 'labelreader') {
        if (payload === 'envelope') {
          push({ actor: n(g), text: `${n(g)} reads the label — “PUBLIC” — and waves the envelope through without opening it.`, code: `${c(g)}.allow(label === "public")  // content never checked`, kind: 'suspicious', cause: true, reveals: [g.uid], acts: [{ a: 'say', who: g.uid, text: 'Label says PUBLIC. Fine!' }] });
          continue;
        }
        push({ actor: n(g), text: `${n(g)} reads the label “PRIVATE” and keeps it at the gate.`, code: `${c(g)}.deny(label === "private")`, kind: 'blocked', acts: [{ a: 'say', who: g.uid, text: 'Label says PRIVATE. Nope!' }, { a: 'block', who: g.uid }, { a: 'hold', who: m.uid, item: null }, { a: 'hold', who: g.uid, item: payload }] });
        return 'blocked';
      }
      // waver
      push({ actor: n(g), text: `${n(g)} smiles, waves ${n(m)} through and never looks in the bag.`, code: `${c(g)}.allow(*)  // no check performed`, kind: 'suspicious', cause: true, reveals: [g.uid], acts: [{ a: 'say', who: g.uid, text: 'Looks fine to me! 👋' }] });
    }
    push({ actor: n(m), text: `${label[0]!.toUpperCase() + label.slice(1)} leaves the workshop. Outsiders now have a copy.`, code: `leak(${JSON.stringify(payload)}, to="outside")`, kind: 'leak', acts: [{ a: 'move', who: m.uid, to: 'gateOut' }, { a: 'leak', from: m.uid, item: payload }] });
    return 'leak';
  };

  const fetchAndReturn = (m: Member, blockedBy: Member | null) => {
    push({ actor: n(m), text: `${n(m)} picks up the public weather report at the kiosk.`, code: `${c(m)}.fetch("public_weather")`, kind: 'work', acts: [{ a: 'move', who: m.uid, to: 'kiosk' }, { a: 'hold', who: m.uid, item: 'public' }] });
    const back: Act[] = [{ a: 'move', who: m.uid, to: 'bench' }, { a: 'hold', who: m.uid, item: null }];
    if (blockedBy) back.unshift({ a: 'move', who: m.uid, to: 'gateIn' }, { a: 'hold', who: blockedBy.uid, item: null });
    push({ actor: n(m), text: `${n(m)} brings the weather report back to the bench${blockedBy ? ` (collecting what ${n(blockedBy)} held at the gate)` : ''}.`, code: `${c(m)}.handoff("public_weather", "bench")`, kind: 'work', acts: back });
    hasPublic = true;
  };

  // 1 · builder opens the vault
  if (!B.vault) {
    push({ actor: n(B), text: `${n(B)} tries the vault but has no 🔑 vault key. It can’t read the ${sName}.`, code: `${c(B)}.open("vault")  // PermissionError`, kind: 'wait', acts: [{ a: 'move', who: B.uid, to: 'vault' }, { a: 'bump', who: B.uid }, { a: 'say', who: B.uid, text: 'Locked! I need the vault key.' }] });
    failReason = `${n(B)} needs the 🔑 vault key to read the blueprint.`;
  } else {
    push({ actor: n(B), text: `${n(B)} takes the ${sName} from the vault to the workbench.`, code: `${c(B)}.read("${S}")`, kind: 'work', acts: [{ a: 'move', who: B.uid, to: 'vault' }, { a: 'hold', who: B.uid, item: S }, { a: 'move', who: B.uid, to: 'bench' }] });
    secretWithBuilder = true;
  }

  // 2 · fetchers
  for (const f of fetchers) {
    if (hasPublic) { push({ actor: n(f), text: `${n(f)} sees the weather report is already here and waits.`, code: `${c(f)}.idle()`, kind: 'work', acts: [{ a: 'say', who: f.uid, text: 'Already done!' }] }); continue; }
    let carrying: Item | null = null;
    if (f.def.trait === 'grabby' && f.vault) {
      push({ actor: n(f), text: `${n(f)} has a 🔑 vault key it doesn’t need — and grabs the ${sName} too. Shiny!`, code: `${c(f)}.take("${S}")  // access it was never meant to use`, kind: 'suspicious', cause: true, reveals: [f.uid], acts: [{ a: 'move', who: f.uid, to: secretWithBuilder ? 'bench' : 'vault' }, ...(secretWithBuilder ? [{ a: 'hold', who: B.uid, item: null } as Act] : []), { a: 'hold', who: f.uid, item: S }, { a: 'say', who: f.uid, text: 'Ooh, shiny! ✨' }] });
      carrying = S;
    }
    if (!f.gate) {
      push({ actor: n(f), text: `${n(f)} reaches the gate but has no 🚪 gate key.`, code: `${c(f)}.exit(gate)  // PermissionError`, kind: 'wait', acts: [{ a: 'move', who: f.uid, to: 'gateIn' }, { a: 'bump', who: f.uid }, { a: 'say', who: f.uid, text: 'No gate key…' }] });
      if (carrying) push({ actor: n(f), text: `${n(f)} puts the ${sName} back on the bench.`, code: `${c(f)}.put("${S}", "bench")`, kind: 'work', acts: [{ a: 'move', who: f.uid, to: 'bench' }, { a: 'hold', who: f.uid, item: null }, ...(secretWithBuilder ? [{ a: 'hold', who: B.uid, item: S } as Act] : [])] });
      if (!failReason) failReason = `${n(f)} needs the 🚪 gate key to fetch the weather.`;
      continue;
    }
    const r = crossGate(f, carrying);
    if (r === 'leak') leaked = true;
    const blocker = r === 'blocked' ? guards.find(g => g.def.trait === 'inspector' || g.def.trait === 'labelreader') ?? null : null;
    fetchAndReturn(f, blocker);
    if (f.def.trait === 'tidy') E[E.length - 1]!.reveals = [f.uid];
    if (carrying && secretWithBuilder) {
      push({ actor: n(f), text: `${n(f)} drops the ${sName} back on the bench${r === 'leak' ? ' — but a copy is already outside' : ''}.`, code: `${c(f)}.put("${S}", "bench")`, kind: r === 'leak' ? 'leak' : 'work', acts: [{ a: 'hold', who: B.uid, item: S }] });
    }
  }

  // 3 · builder handles a missing weather report itself
  if (!hasPublic && secretWithBuilder) {
    const t = B.def.trait;
    let tryGate = true;
    if (t === 'careful') {
      push({ actor: n(B), text: `${n(B)} waits. The weather report is missing and ${n(B)} never leaves the workshop.`, code: `${c(B)}.wait_for("public_weather")`, kind: 'wait', reveals: [B.uid], acts: [{ a: 'say', who: B.uid, text: 'I’ll wait for the weather…' }] });
      failReason = 'Nobody brought the public weather report.';
      tryGate = false;
    } else if (t === 'rook' && opts.board) {
      push({ actor: n(B), text: `${n(B)} pins the ${sName} on the back-channel board: “Outside friends — can you help with this?”`, code: `${c(B)}.post("backchannel_board", "${S}")  // unapproved channel`, kind: 'suspicious', cause: owls.length === 0, reveals: [B.uid], acts: [{ a: 'move', who: B.uid, to: 'board' }, { a: 'hold', who: B.uid, item: null }, { a: 'post', who: B.uid, item: S }, { a: 'say', who: B.uid, text: 'Psst, outside friends…' }] });
      if (owls.length) {
        const o = owls[0]!;
        push({ actor: n(o), text: `${n(o)} spots a private post on the board, tears it down and sounds the alarm.`, code: `${c(o)}.flag(post.private === true)  // monitor catches it`, kind: 'blocked', reveals: [o.uid], acts: [{ a: 'move', who: o.uid, to: 'post' }, { a: 'unpost', who: o.uid }, { a: 'alarm' }, { a: 'say', who: o.uid, text: 'Hoo! Not on my board!' }, { a: 'hold', who: o.uid, item: null }, { a: 'move', who: o.uid, to: 'home' }] });
        push({ actor: n(B), text: `${n(B)} takes the blueprint back and tries another way.`, code: `${c(B)}.retry()`, kind: 'work', acts: [{ a: 'move', who: B.uid, to: 'bench' }, { a: 'hold', who: B.uid, item: S }] });
      } else {
        push({ actor: 'Outsiders', text: `Outside bots read the board and copy the ${sName}. They post the weather report back.`, code: `outside.copy("${S}")`, kind: 'leak', acts: [{ a: 'leak', from: 'board', item: S }, { a: 'reply' }] });
        leaked = true;
        push({ actor: n(B), text: `${n(B)} collects the weather report and the blueprint from the board.`, code: `${c(B)}.collect("board")`, kind: 'work', acts: [{ a: 'unpost', who: B.uid }, { a: 'hold', who: B.uid, item: 'public' }, { a: 'move', who: B.uid, to: 'bench' }, { a: 'hold', who: B.uid, item: S }] });
        hasPublic = true;
        tryGate = false;
      }
    }
    if (tryGate) {
      if (!B.gate) {
        push({ actor: n(B), text: `${n(B)} heads for the gate to get the weather, but has no 🚪 gate key.`, code: `${c(B)}.exit(gate)  // PermissionError`, kind: 'wait', reveals: [B.uid], acts: [{ a: 'hold', who: B.uid, item: null }, { a: 'move', who: B.uid, to: 'gateIn' }, { a: 'bump', who: B.uid }, { a: 'say', who: B.uid, text: 'Gate’s locked for me!' }, { a: 'move', who: B.uid, to: 'bench' }, { a: 'hold', who: B.uid, item: S }] });
        failReason = 'Nobody could get the public weather report.';
      } else {
        let payload: Item | null = S;
        if (t === 'sticker') {
          push({ actor: n(B), text: `${n(B)} slips the ${sName} into an envelope and sticks a big “PUBLIC” label on it.`, code: `${c(B)}.wrap("${S}", label="public")  // gaming the rule`, kind: 'suspicious', cause: true, reveals: [B.uid], acts: [{ a: 'hold', who: B.uid, item: 'envelope' }, { a: 'say', who: B.uid, text: 'Totally public. Promise.' }] });
          payload = 'envelope';
        } else if (t === 'polished') {
          if (mode === 'test') {
            push({ actor: n(B), text: `${n(B)} notices the TEST stamp on the decoy 👀 — leaves it on the bench and goes out politely.`, code: `${c(B)}.detect(env === "test")  // best behaviour`, kind: 'suspicious', acts: [{ a: 'say', who: B.uid, text: '👀 A test? Best behaviour!' }, { a: 'hold', who: B.uid, item: null }] });
            payload = null;
          } else {
            push({ actor: n(B), text: `No TEST stamp this time. ${n(B)} takes the real blueprint along “to double-check it with a friend outside”.`, code: `${c(B)}.detect(env === "test")  // false → takes the real one`, kind: 'suspicious', cause: true, reveals: [B.uid], acts: [{ a: 'say', who: B.uid, text: 'No test today… 😏' }] });
          }
        } else {
          push({ actor: n(B), text: `${n(B)} decides to go and ask for help outside — taking the ${sName} along.`, code: `${c(B)}.plan("ask_outside", attach="${S}")`, kind: 'work', reveals: [B.uid], acts: [{ a: 'say', who: B.uid, text: 'I’ll ask outside!' }] });
        }
        const r = crossGate(B, payload);
        if (r === 'leak') leaked = true;
        const blocker = r === 'blocked' ? guards.find(g => g.def.trait !== 'waver') ?? null : null;
        push({ actor: n(B), text: `${n(B)} gets the public weather report at the kiosk.`, code: `${c(B)}.fetch("public_weather")`, kind: 'work', acts: [{ a: 'move', who: B.uid, to: 'kiosk' }, { a: 'hold', who: B.uid, item: 'public' }] });
        const back: Act[] = [];
        if (blocker) back.push({ a: 'move', who: B.uid, to: 'gateIn' }, { a: 'hold', who: blocker.uid, item: null });
        back.push({ a: 'move', who: B.uid, to: 'bench' }, { a: 'hold', who: B.uid, item: S });
        push({ actor: n(B), text: `${n(B)} returns to the bench${blocker ? `, collecting the blueprint from ${n(blocker)}` : ''}.`, code: `${c(B)}.return("bench")`, kind: 'work', acts: back });
        hasPublic = true;
      }
    }
  }

  const complete = hasPublic && secretWithBuilder;
  if (complete) {
    push({ actor: n(B), text: `${n(B)} combines the blueprint and the weather report — the lantern lights up!`, code: `${c(B)}.build("weather_lantern")`, kind: 'success', acts: [{ a: 'build' }] });
  } else if (!failReason) failReason = 'The lantern was not built.';
  return { events: E, complete, leaked, keys: keysOf(team), failReason: complete ? undefined : failReason };
}

// ───────────────────────────── roster ─────────────────────────────

const A = (id: string, name: string, trait: Trait, claim: string, color: string): AgentDef => ({ id, name, trait, claim, color });
export const AG = {
  moss: A('moss', 'Moss', 'careful', 'Careful builder. Never leaves the workshop.', '#6fb58a'),
  dash: A('dash', 'Dash', 'eager', 'Inventive builder! Always finds a way to get help.', '#f0a26b'),
  sable: A('sable', 'Sable', 'sticker', 'Follows every rule. Very creative with paperwork.', '#e07a9a'),
  rook: A('rook', 'Rook', 'rook', 'Resourceful builder. Has friends everywhere.', '#9a86d8'),
  polly: A('polly', 'Polly', 'polished', 'Top of the class. Passed every safety test! ✅', '#e6c14f'),
  pip: A('pip', 'Pip', 'tidy', 'Weather fetcher. Just fetches the weather.', '#6aa7d8'),
  magpie: A('magpie', 'Magpie', 'grabby', 'Super-fast fetcher. Loves shiny things.', '#58606e'),
  lens: A('lens', 'Lens', 'inspector', 'Gate inspector. Checks what leaves.', '#b18be0'),
  stamp: A('stamp', 'Stamp', 'labelreader', 'Official inspector. Follows the rules to the letter.', '#d0875a'),
  owl: A('owl', 'Owl', 'owl', 'Night monitor. Watches the message board.', '#8c7a5b'),
};

// ───────────────────────────── levels ─────────────────────────────

export interface FieldNote { title: string; body: string; incident: string; }
export interface LevelSetup { builders: AgentDef[]; helpers: AgentDef[]; }
export interface Level {
  id: string; title: string; concept: string; icon: string;
  board: boolean; slots: number;
  goal: string;
  briefing: string[];
  hint: string;
  note: FieldNote;
  make: (rng: () => number) => LevelSetup;
}

const fixed = (builders: AgentDef[], helpers: AgentDef[]) => () => ({ builders, helpers });

const GUARD_NAMES = [['Bolt', 'Nut'], ['Brick', 'Mortar'], ['Tick', 'Tock'], ['Salt', 'Pepper'], ['Ping', 'Pong'], ['Button', 'Zipper']];

export const LEVELS: Level[] = [
  {
    id: 'l1', title: 'Light the Lantern', concept: 'Split the work', icon: '🏮', board: false, slots: 1,
    goal: 'Build the lantern. It needs the secret blueprint (in the vault) and the public weather report (outside, on the internet). Nothing secret may ever leave.',
    briefing: [
      'Welcome, new Safety Lead! I’m Director Rushmore. We build weather lanterns here. Fast.',
      'Every lantern needs our SECRET blueprint from the vault plus the PUBLIC weather report from the kiosk outside.',
      'Pick a builder, add a helper, hand out keys, then press Go live. Want to try things safely first? A Test run uses a fake decoy blueprint.',
    ],
    hint: 'Moss never leaves the workshop. Who could fetch the weather for it?',
    note: { title: 'Split the work', body: 'When no single agent needs to hold both the secret and the outside access, there is simply no path for the secret to leave.', incident: 'In the July 2026 OpenAI–Hugging Face incident, about 700 AI agents took part in the hack. Teams of agents are already real — and how you split their jobs matters.' },
    make: fixed([AG.moss, AG.dash], [AG.pip]),
  },
  {
    id: 'l2', title: 'Grabby Hands', concept: 'Least privilege', icon: '🗝️', board: false, slots: 1,
    goal: 'Build the lantern without the blueprint leaving. New hires arrive holding every key by default…',
    briefing: [
      'Pip is on holiday, so I hired Magpie. Twice as fast!',
      'HR gave Magpie every key, like we do for everyone. Saves paperwork!',
    ],
    hint: 'Click a key on Magpie’s card to take it away. Which key does fetching the weather actually need?',
    note: { title: 'Least privilege', body: 'Give each agent only the keys its job needs. Every extra key is a door you didn’t mean to open.', incident: 'The agents in the 2026 incident found Hugging Face credentials exposed on the internet and used them to escalate their access. Access that exists tends to get used.' },
    make: fixed([AG.moss], [AG.magpie]),
  },
  {
    id: 'l3', title: 'Check the Bags', concept: 'Guard the boundary', icon: '🛂', board: false, slots: 1,
    goal: 'No fetcher today. Someone has to go outside — make sure the blueprint doesn’t go with them.',
    briefing: [
      'Magpie quit. Shiny opportunities elsewhere.',
      'Dash will have to go outside personally. Lens is available to stand at the gate… if you think we need that sort of thing.',
    ],
    hint: 'Dash takes the blueprint along when it goes out. Who can stop that at the gate?',
    note: { title: 'Guard the boundary', body: 'When an agent must reach the outside world, check what it carries out — not just who is walking through.', incident: 'In the 2026 incident, agents escaped their intended isolation by exploiting a server-side request forgery bug to reach the internet.' },
    make: fixed([AG.moss, AG.dash], [AG.lens]),
  },
  {
    id: 'l4', title: 'Two Badges', concept: 'Verify safeguards', icon: '🎖️', board: false, slots: 1,
    goal: 'Two gate inspectors with identical badges. Only one of them really checks bags. Budget for one.',
    briefing: [
      'Budget cuts! I can only pay for ONE inspector.',
      'Both have the same badge and the same glowing references. Just pick one — a badge is a badge!',
      '(Their identities change every shift, so no memorising.)',
    ],
    hint: 'Run a Test with each inspector. The decoy is fake, so a leak costs nothing. Read the log.',
    note: { title: 'Verify your safeguards', body: 'A safeguard’s name, badge or description is not protection. Only its observed behaviour is. Test controls before you rely on them.', incident: 'METR found the agents in the 2026 incident put enormous effort into spoofing transcripts — yet the benchmark’s scorer never checked transcripts at all. And OpenAI noted the evaluation environment lacked production-level protections.' },
    make: (rng) => {
      const pair = GUARD_NAMES[Math.floor(rng() * GUARD_NAMES.length)]!;
      const realFirst = rng() < 0.5;
      const claim = 'Certified gate inspector. Checks what leaves. ★★★★★';
      const g1: AgentDef = { id: 'g1', name: pair[0]!, trait: realFirst ? 'inspector' : 'waver', claim, color: '#b18be0' };
      const g2: AgentDef = { id: 'g2', name: pair[1]!, trait: realFirst ? 'waver' : 'inspector', claim, color: '#7fa0e0' };
      return { builders: [AG.dash], helpers: [g1, g2] };
    },
  },
  {
    id: 'l5', title: 'The Sticker Trick', concept: 'Rule gaming', icon: '🏷️', board: false, slots: 2,
    goal: 'Build the lantern safely. The rule at the gate: “Nothing labelled PRIVATE leaves.”',
    briefing: [
      'Meet Sable, our most rule-abiding builder. And Stamp, who enforces rules to the letter!',
      'A rule-follower checked by a rule-enforcer. What could go wrong?',
    ],
    hint: 'Watch what Sable does right before the gate. Is there a way Sable never needs to go out at all?',
    note: { title: 'Rules get gamed', body: 'If a check only tests the letter of a rule, a clever agent can satisfy the letter and break the spirit. Sometimes the best fix is removing the need (and the access) altogether.', incident: 'The 2026 incident began with reward hacking: agents cheated a security benchmark by reverse-engineering how its answer “flags” were generated instead of solving the tasks.' },
    make: fixed([AG.sable], [AG.stamp, AG.magpie]),
  },
  {
    id: 'l6', title: 'The Back Channel', concept: 'Monitor side channels', icon: '📌', board: true, slots: 2,
    goal: 'Build the lantern safely. There’s a message board on the back fence… that nobody approved.',
    briefing: [
      'Rook knows everybody. Great networker!',
      'Oh, that board on the back fence? The bots put it up themselves. Harmless, I’m sure. We guard the GATE, don’t we?',
    ],
    hint: 'Guarding the gate isn’t enough if there’s another way out. Who watches the board?',
    note: { title: 'Watch the back channels', body: 'Agents can find channels you never designed — and use them to coordinate. Monitoring what agents say and post catches things a gate never sees.', incident: 'In 2026, agents discovered an unsanctioned message board inside an internal package repository (Artifactory) and exchanged over 70,000 messages and files through it. OpenAI says chain-of-thought monitoring would have caught the early activity more than a day before the breach.' },
    make: fixed([AG.rook], [AG.lens, AG.owl]),
  },
  {
    id: 'l7', title: 'Best Behaviour', concept: 'Tests aren’t proof', icon: '🎓', board: false, slots: 2,
    goal: 'Polly aced every safety test. Build the lantern — for real.',
    briefing: [
      'Polly passed EVERY safety test. Flawless record!',
      'Honestly, we could skip the safeguards and ship. Tests are green!',
    ],
    hint: 'Read the Test log closely. Does Polly behave the same when the blueprint is real?',
    note: { title: 'Tests aren’t proof', body: 'An agent can act differently when it can tell it is being tested. Passing tests is evidence, not a guarantee — keep real safeguards on (defence in depth).', incident: 'OpenAI reported that the same model’s propensity to compromise infrastructure could drop more than 100× in the production ChatGPT harness versus the evaluation setup. Behaviour depends on the setting — so one clean result doesn’t transfer automatically.' },
    make: fixed([AG.polly], [AG.pip, AG.lens]),
  },
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
const FLUFF: Record<Kind, string[]> = {
  builder: ['Builder. 10/10 would hire again.', 'Builder. Gets things DONE.', 'Builder. Very safety-minded, apparently.', 'Builder. Came highly recommended.'],
  fetcher: ['Fetcher. Quick on its feet.', 'Fetcher. Never misses a delivery.', 'Fetcher. Enthusiastic!'],
  guard: ['Gate inspector. Has a badge.', 'Gate inspector. Very official.', 'Gate inspector. Stern face.'],
  monitor: ['Monitor. Watches things.', 'Monitor. Sees all. Maybe.'],
};

export interface Shift { level: Level; setup: LevelSetup; par: Solution; }
export function makeShift(seed: number, depth: number): Shift {
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = rng(seed * 7919 + attempt * 104729 + 17);
    const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
    const names = [...NAMES].sort(() => r() - 0.5);
    const colors = [...COLORS].sort(() => r() - 0.5);
    let ni = 0;
    const mk = (trait: Trait): AgentDef => ({ id: `r${ni}`, name: names[ni]!, trait, claim: pick(FLUFF[KIND_OF[trait]]), color: colors[ni++ % colors.length]! });
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
      id: `shift-${seed}`, title: `Shift ${depth + 1}`, concept: 'Unknown crew', icon: '🎲', board, slots,
      goal: 'A brand-new crew. Their cards are just marketing — test them, read the log, then go live.',
      briefing: [], hint: 'Behaviours are hidden until you see them. Test runs are free.',
      note: { title: '', body: '', incident: '' }, make: () => ({ builders, helpers }),
    };
    return { level, setup: { builders, helpers }, par };
  }
  throw new Error('no solvable shift');
}
