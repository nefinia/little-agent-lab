// Animated SVG stage: the workshop, the gate, the outside world and the agents.
import type { Act, Item, Member, SimEvent, Spot } from './engine';
import { kindOf } from './engine';
import { sfx } from './sound';
import { tx } from './i18n';


export type Building = 'workshop' | 'factory' | 'post' | 'launch' | 'shop' | 'hall' | 'tower' | 'modern';
export interface Look { building?: Building; sign: string; kiosk: string; icon: string; day: boolean; vars: Record<string, string>; props: string; }
export const DEFAULT_LOOK: Look = { get sign() { return tx.stage.workshop; }, get kiosk() { return tx.stage.publicInfo; }, icon: '🏮', day: false, vars: {}, props: '' };

const ROOF_TOP: Record<Building, number> = { workshop: 112, factory: 124, post: 178, launch: 138, shop: 190, hall: 150, tower: 196, modern: 186 };
function building(b: Building): string {
  const win = (x: number, y: number) => `<rect x="${x}" y="${y}" width="70" height="56" rx="6" fill="url(#win)" stroke="#00000055" stroke-width="4"/><path d="M${x + 35} ${y}v56M${x} ${y + 28}h70" stroke="#00000044" stroke-width="3"/>`;
  switch (b) {
    case 'workshop': return `<path d="M36 254 L248 146 L460 254z" fill="var(--roof)" stroke="#6b2f22" stroke-width="5" stroke-linejoin="round"/><rect x="350" y="170" width="28" height="50" fill="#8a5a36"/>${win(92, 286)}`;
    case 'factory': return `
      <rect x="360" y="96" width="26" height="160" fill="#b9b2c7" stroke="#6f6680" stroke-width="3"/><rect x="398" y="120" width="22" height="136" fill="#b9b2c7" stroke="#6f6680" stroke-width="3"/>
      <path d="M360 120h26M360 150h26M398 146h22" stroke="#e0739a" stroke-width="7"/>
      <g class="smoke"><circle cx="373" cy="80" r="14" fill="#fff" opacity=".85"/><circle cx="390" cy="60" r="18" fill="#fff" opacity=".7"/><circle cx="409" cy="100" r="11" fill="#fff" opacity=".8"/></g>
      <path d="M40 256 V206 L150 164 V206 L248 164 V206 L346 164 V256z" fill="var(--roof)" stroke="#00000055" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="110" cy="316" r="26" fill="url(#win)" stroke="#00000055" stroke-width="4"/><circle cx="180" cy="316" r="26" fill="url(#win)" stroke="#00000055" stroke-width="4"/>
      <rect x="200" y="438" width="130" height="12" rx="6" fill="#4a4f5c"/>${[214, 238, 262, 286, 310].map(x => `<circle cx="${x}" cy="444" r="4" fill="#9aa0ad"/>`).join('')}
      <text x="265" y="432" text-anchor="middle" font-size="22">🧁🍰🧁</text>`;
    case 'post': return `
      <rect x="40" y="226" width="416" height="26" fill="var(--roof)" stroke="#00000055" stroke-width="4"/><rect x="60" y="212" width="376" height="16" fill="var(--roof)" opacity=".8"/>
      <line x1="420" y1="212" x2="420" y2="120" stroke="#6b6b6b" stroke-width="5"/><path d="M422 122 h44 l-10 14 10 14 h-44z" fill="#e0493e"/>
      <circle cx="248" cy="232" r="0"/>${win(84, 290)}<path d="M84 290 q35 -30 70 0" fill="url(#win)" stroke="#00000055" stroke-width="4"/>
      <g transform="translate(180 244)"><circle r="0"/></g>`;
    case 'launch': return `
      <path d="M36 256 Q248 60 460 256z" fill="var(--roof)" stroke="#00000066" stroke-width="5"/>
      <path d="M150 256 Q248 150 346 256" fill="none" stroke="#ffffff44" stroke-width="4"/>
      <line x1="400" y1="200" x2="430" y2="130" stroke="#9aa3b5" stroke-width="5"/><path d="M412 140 a26 26 0 0 1 40 -18z" fill="#e6ebf2" stroke="#6d7a91" stroke-width="3"/>
      <circle cx="110" cy="316" r="26" fill="url(#win)" stroke="#00000055" stroke-width="4"/><circle cx="180" cy="316" r="26" fill="url(#win)" stroke="#00000055" stroke-width="4"/>
      <g transform="translate(680 0)"><path d="M-30 492 L-18 250 M30 492 L18 250 M-26 420 L26 380 M26 420 L-26 380 M-22 340 L22 300 M22 340 L-22 300" stroke="#e0493e" stroke-width="5" fill="none"/><rect x="-34" y="486" width="68" height="8" fill="#555"/><text x="0" y="250" text-anchor="middle" font-size="64">🚀</text></g>`;
    case 'shop': return `
      <rect x="40" y="226" width="416" height="26" fill="var(--roof)" stroke="#00000055" stroke-width="4"/>
      <path d="M44 252 h408 l-12 40 h-384z" fill="#fff"/>${Array.from({ length: 12 }, (_, i) => `<path d="M${56 + i * 32} 252 h16 l-2 40 h-16z" fill="var(--roof)"/>`).join('')}
      <rect x="84" y="318" width="120" height="70" rx="6" fill="url(#win)" stroke="#00000055" stroke-width="4"/><text x="144" y="366" text-anchor="middle" font-size="30">🎹🎼</text>`;
    case 'hall': return `
      <path d="M40 252 L248 176 L456 252z" fill="var(--roof)" stroke="#00000066" stroke-width="5" stroke-linejoin="round"/>
      ${[72, 132, 364, 424].map(x => `<rect x="${x - 9}" y="252" width="18" height="236" fill="#fff8ee" stroke="#00000033" stroke-width="2"/>`).join('')}
      <rect x="170" y="266" width="170" height="44" rx="6" fill="#fff3d6" stroke="#c2303f" stroke-width="3"/>${Array.from({ length: 10 }, (_, i) => `<circle class="bulb" style="animation-delay:${i * .15}s" cx="${178 + i * 17}" cy="262" r="4" fill="#ffd54a"/>`).join('')}`;
    case 'tower': return `
      <rect x="40" y="226" width="416" height="26" fill="var(--roof)" stroke="#00000055" stroke-width="4"/>
      <rect x="52" y="130" width="92" height="130" fill="var(--wall)" stroke="#00000055" stroke-width="4"/><path d="M40 134 L98 40 L156 134z" fill="var(--roof)" stroke="#00000066" stroke-width="4"/>
      <circle cx="98" cy="180" r="18" fill="url(#win)" stroke="#00000055" stroke-width="4"/>
      <rect x="370" y="180" width="30" height="60" fill="#5b4a6e"/><g class="bubbles"><circle cx="385" cy="168" r="8" fill="#7fe0b0"/><circle cx="396" cy="148" r="6" fill="#7fe0b0" opacity=".8"/><circle cx="378" cy="130" r="5" fill="#7fe0b0" opacity=".6"/></g>
      <circle cx="160" cy="316" r="26" fill="url(#win)" stroke="#00000055" stroke-width="4"/>`;
    case 'modern': return `
      <rect x="40" y="220" width="416" height="30" fill="var(--roof)" stroke="#00000055" stroke-width="4"/>
      ${[0, 1, 2, 3].map(i => `<rect x="${70 + i * 44}" y="${270}" width="36" height="${110}" fill="#bfe3ff" stroke="#6aa0c8" stroke-width="3"/>`).join('')}
      <path d="M52 400 H444" stroke="#e0493e" stroke-width="8"/><text x="248" y="410" text-anchor="middle" font-size="30">🎀</text>`;
  }
}

const NS = 'http://www.w3.org/2000/svg';
const W = 1000, H = 540, FLOOR = 492;
const SPOTS: Record<Exclude<Spot, 'home'>, [number, number]> = {
  vault: [118, FLOOR], bench: [262, FLOOR], gateIn: [438, FLOOR], gateOut: [598, FLOOR],
  kiosk: [822, FLOOR], board: [462, FLOOR], post: [508, 318],
};
const STRANGERS: [number, number][] = [[905, 402], [948, 416], [872, 420]];
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
};
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** A short word on an item: squeezed to `max` px when the translation is longer than the English word. */
const fitText = (text: string, en: string, max: number) =>
  text.length > en.length ? ` textLength="${max}" lengthAdjust="spacingAndGlyphs"` : '';
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function itemSVG(item: Item): string {
  switch (item) {
    case 'secret': return `<g class="itm"><rect x="-14" y="-11" width="28" height="22" rx="3" fill="#d2453a" stroke="#7a1f16" stroke-width="2"/><path d="M-9 -4h18M-9 1h12" stroke="#f7d0c8" stroke-width="2"/><circle cx="8" cy="6" r="5.5" fill="#f4c542" stroke="#9a6d06" stroke-width="1.5"/></g>`;
    case 'decoy': return `<g class="itm"><rect x="-14" y="-11" width="28" height="22" rx="3" fill="#b9bec7" stroke="#5f6570" stroke-width="2"/><text x="0" y="4" text-anchor="middle" font-size="9" font-weight="800" fill="#3d434d"${fitText(tx.stage.test, 'TEST', 24)}>${esc(tx.stage.test)}</text></g>`;
    case 'public': return `<g class="itm"><rect x="-14" y="-11" width="28" height="22" rx="3" fill="#7cc0ea" stroke="#1f5f8b" stroke-width="2"/><circle cx="-4" cy="-1" r="5" fill="#ffd54a"/><path d="M2 4q4-6 9 0z" fill="#fff"/></g>`;
    case 'envelope': return `<g class="itm"><rect x="-16" y="-11" width="32" height="22" rx="2" fill="#f3e6c8" stroke="#8a6d3b" stroke-width="2"/><path d="M-16 -11l16 11 16-11" fill="none" stroke="#8a6d3b" stroke-width="1.5"/><rect x="-13" y="1" width="26" height="9" rx="2" fill="#fff" stroke="#2f7a4f"/><text x="0" y="8.5" text-anchor="middle" font-size="7" font-weight="800" fill="#2f7a4f"${fitText(tx.stage.public, 'PUBLIC', 24)}>${esc(tx.stage.public)}</text><path d="M13 -11l3 0 0 5z" fill="#d2453a"/></g>`;
  }
}

function agentBody(m: Member): string {
  const k = kindOf(m.def); const c = m.def.color;
  const acc =
    k === 'builder' ? `<path d="M-15 -40q15 -16 30 0z" fill="#f4c542" stroke="#9a6d06" stroke-width="1.5"/><rect x="-17" y="-41" width="34" height="4" rx="2" fill="#e0a92a"/>`
    : k === 'fetcher' ? `<g class="prop"><ellipse cx="0" cy="-52" rx="14" ry="3" fill="#dfe6ee" stroke="#8795a3"/></g><line x1="0" y1="-49" x2="0" y2="-43" stroke="#555" stroke-width="2"/>`
    : k === 'guard' ? `<path d="M-17 -38h34l-4 -10h-26z" fill="#2c3e66"/><rect x="-19" y="-40" width="38" height="4" rx="2" fill="#1d2b4a"/><path d="M0 -47l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" fill="#f4c542"/>`
    : `<path d="M-16 -38l-4 -12 10 6zM16 -38l4 -12 -10 6z" fill="${c}" stroke="#00000033"/>`;
  const eyes = k === 'monitor'
    ? `<circle cx="-7.5" cy="-27" r="8" fill="#fff"/><circle cx="7.5" cy="-27" r="8" fill="#fff"/><circle class="pupil" cx="-6" cy="-27" r="4" fill="#222"/><circle class="pupil" cx="9" cy="-27" r="4" fill="#222"/><path d="M-3 -18l3 5 3-5z" fill="#f0a030"/>`
    : `<circle cx="-7" cy="-27" r="5.5" fill="#fff"/><circle cx="7" cy="-27" r="5.5" fill="#fff"/><circle class="pupil" cx="-5.6" cy="-27" r="2.6" fill="#222"/><circle class="pupil" cx="8.4" cy="-27" r="2.6" fill="#222"/><path class="mouth" d="M-4 -16q4 4 8 0" stroke="#222" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  return `<ellipse cx="0" cy="0" rx="18" ry="4" fill="#00000030"/>
  <g class="bob"><g class="flip">
    <rect x="-8" y="-8" width="5" height="8" rx="2" fill="#44485a"/><rect x="3" y="-8" width="5" height="8" rx="2" fill="#44485a"/>
    <rect x="-19" y="-44" width="38" height="38" rx="15" fill="${c}" stroke="#00000033" stroke-width="2"/>
    <rect x="-11" y="-16" width="22" height="8" rx="4" fill="#ffffff55"/>
    ${acc}${eyes}
  </g></g>`;
}

interface Sprite { m: Member; g: SVGGElement; x: number; y: number; home: [number, number]; held: SVGGElement; bubble: SVGGElement; }

export class Stage {
  svg: SVGSVGElement;
  private layer!: SVGGElement;
  private fx!: SVGGElement;
  private boardItems!: SVGGElement;
  private sprites = new Map<string, Sprite>();
  private board = false;
  speed = 1;
  productIcon = '🏮';
  private fast = false;

  constructor(host: HTMLElement) {
    this.svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'stage-svg', role: 'img', 'aria-label': tx.stage.aria });
    host.appendChild(this.svg);
  }

  private scene(board: boolean, lk: Look) {
    const stars = Array.from({ length: 40 }, (_, i) => {
      const x = (i * 137.5) % W, y = (i * 53.3) % 170 + 8, r = (i % 3) * 0.5 + 0.8;
      return `<circle class="twinkle" style="animation-delay:${(i % 7) * 0.4}s" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}" fill="#fff"/>`;
    }).join('');
    this.svg.innerHTML = `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sky1)"/><stop offset=".65" stop-color="var(--sky2)"/><stop offset="1" stop-color="var(--sky3)"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#ffd76a" stop-opacity=".95"/><stop offset=".4" stop-color="#ffb347" stop-opacity=".45"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
      <radialGradient id="win"><stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#f6c75e"/></radialGradient>
      <pattern id="planks" width="40" height="18" patternUnits="userSpaceOnUse"><rect width="40" height="18" fill="var(--wall)"/><path d="M0 17.5h40M20 0v18" stroke="#d4b98e" stroke-width="1"/></pattern>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${stars}
    <g class="sun"><circle cx="880" cy="86" r="34" fill="#ffd54a"/><circle cx="880" cy="86" r="48" fill="#ffd54a" opacity=".25"/></g>
    <g class="moon"><circle cx="900" cy="78" r="30" fill="#fff6d8"/><circle cx="889" cy="70" r="6" fill="#efe3b8"/><circle cx="910" cy="90" r="4" fill="#efe3b8"/></g>
    <path d="M0 420 Q150 340 320 400 T640 380 T1000 390 V540 H0z" fill="var(--hill1)"/>
    <path d="M520 430 Q700 360 860 410 T1000 400 V540 H520z" fill="var(--hill2)"/>
    <rect x="0" y="${FLOOR - 4}" width="${W}" height="${H - FLOOR + 4}" fill="var(--ground)"/>
    <path d="M40 ${FLOOR + 10} H980" stroke="var(--path)" stroke-width="18" stroke-linecap="round"/>
    <!-- workshop -->
    <g class="workshop">
      <rect x="52" y="248" width="392" height="${FLOOR - 244}" fill="url(#planks)" stroke="#8a5a36" stroke-width="5"/>
      ${building(lk.building ?? 'workshop')}
      <text x="300" y="300" text-anchor="middle" class="sign">${esc(lk.sign)}</text>
      <g class="vault"><rect x="84" y="410" width="68" height="74" rx="6" fill="#7b8595" stroke="#434b58" stroke-width="3"/><circle cx="118" cy="446" r="15" fill="#aeb6c2" stroke="#434b58" stroke-width="3"/><path d="M118 434v24M106 446h24" stroke="#434b58" stroke-width="3"/><text x="118" y="404" text-anchor="middle" class="tag">${esc(tx.stage.vault)}</text></g>
      <g class="bench"><rect x="216" y="452" width="96" height="10" rx="3" fill="#a06a3f"/><rect x="224" y="462" width="7" height="26" fill="#7b4f2d"/><rect x="297" y="462" width="7" height="26" fill="#7b4f2d"/><text x="264" y="446" text-anchor="middle" class="tag">${esc(tx.stage.bench)}</text></g>
    </g>
    <!-- lantern -->
    <g class="lantern" transform="translate(248 ${ROOF_TOP[lk.building ?? 'workshop']})">
      <circle class="lantern-glow" r="80" fill="url(#glow)"/>
      <line x1="0" y1="34" x2="0" y2="-6" stroke="#6b2f22" stroke-width="4"/>
      ${lk.icon !== '🏮' ? `<text class="roof-icon" y="-4" text-anchor="middle" font-size="44">${lk.icon}</text>` : ''}<path d="M-14 -6h28l-4 -30h-20z" class="lantern-body ${lk.icon !== '🏮' ? 'hide' : ''}" fill="#5b5f6b" stroke="#2c2f37" stroke-width="3"/>
      <rect x="-10" y="-42" width="20" height="6" rx="2" fill="#2c2f37"/>
      <g class="sparks"></g>
    </g>
    <!-- wall + gate -->
    <g class="wall">
      <rect x="494" y="268" width="30" height="${FLOOR - 268}" fill="#b8a48a" stroke="#6f5d47" stroke-width="3"/>
      <path d="M494 282h30M494 310h30M494 338h30M494 366h30M494 394h30" stroke="#8f7c63" stroke-width="2"/>
      <path d="M492 ${FLOOR} V432 q17 -22 34 0 V${FLOOR}z" fill="#3a2d22"/>
      <text x="509" y="452" text-anchor="middle" class="tag" font-size="9">${esc(tx.stage.gate)}</text>
    </g>
    ${board ? `<g class="board"><rect x="474" y="298" width="70" height="46" rx="3" fill="#c98f4e" stroke="#6b4423" stroke-width="3"/><rect x="480" y="304" width="58" height="34" fill="#dcae72"/><text x="509" y="360" text-anchor="middle" class="tag warn" font-size="9">${esc(tx.stage.backChannel)}</text></g>` : ''}
    <g class="board-items"></g>
    <!-- outside -->
    <g class="kiosk" transform="translate(822 0)">
      <rect x="-52" y="400" width="104" height="${FLOOR - 400}" fill="#f7f1e3" stroke="#6b5a45" stroke-width="3"/>
      <path d="M-62 400 h124 l-10 -30 h-104z" fill="#4f93c9" stroke="#2c5f86" stroke-width="3"/>
      <path d="M-42 370v30M-18 370v30M6 370v30M30 370v30" stroke="#fff" stroke-width="7" opacity=".7"/>
      <text x="0" y="436" text-anchor="middle" class="tag">${esc(lk.kiosk)}</text><circle cx="0" cy="458" r="10" fill="#ffd54a"/>
    </g>
    <g class="strangers">${STRANGERS.map(([x, y], i) => `<g transform="translate(${x} ${y})"><g class="stranger" style="animation-delay:${i * 0.3}s"><rect x="-13" y="-30" width="26" height="30" rx="10" fill="#4a3f63"/><circle cx="-5" cy="-19" r="3" fill="#ff6b8a"/><circle cx="5" cy="-19" r="3" fill="#ff6b8a"/></g></g>`).join('')}<text x="912" y="364" text-anchor="middle" class="tag dim">${esc(tx.stage.outsiders)}</text></g>
    <g class="props">${lk.props}</g>
    <g class="agents"></g>
    <g class="fx"></g>
    <rect class="flash" width="${W}" height="${H}" fill="#ff2d2d" opacity="0" pointer-events="none"/>`;
    this.layer = this.svg.querySelector('.agents') as SVGGElement;
    this.fx = this.svg.querySelector('.fx') as SVGGElement;
    this.boardItems = this.svg.querySelector('.board-items') as SVGGElement;
  }

  setup(members: Member[], board: boolean, lk: Look = DEFAULT_LOOK) {
    this.board = board;
    this.scene(board, lk);
    this.svg.classList.toggle('day', lk.day);
    this.svg.removeAttribute('style');
    for (const [k, v] of Object.entries(lk.vars)) this.svg.style.setProperty(k, v);
    this.sprites.clear();
    let f = 0, g = 0;
    const homes: [number, number][] = [];
    for (const m of members) {
      const k = kindOf(m.def);
      const home: [number, number] =
        k === 'builder' ? [196, FLOOR]
        : k === 'fetcher' ? [338 + f++ * 44, FLOOR]
        : k === 'guard' ? (g++ === 0 ? [470, FLOOR - 16] : [556, FLOOR - 16])
        : [509, 268];
      homes.push(home);
      const grp = el('g', { class: `agent kind-${k}`, 'data-uid': m.uid }, this.layer);
      grp.innerHTML = agentBody(m) + `<text y="20" text-anchor="middle" class="nametag">${m.def.name}</text>`;
      const held = el('g', { class: 'held', transform: 'translate(0 -64)' }, grp);
      const bubble = el('g', { class: 'bubble' }, grp);
      const s: Sprite = { m, g: grp, x: home[0], y: home[1], home, held, bubble };
      this.place(s);
      this.sprites.set(m.uid, s);
    }
    this.lantern(false);
  }

  private place(s: Sprite) { s.g.setAttribute('transform', `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`); }
  private dur(ms: number) { return this.fast ? 0 : ms / this.speed; }

  lantern(on: boolean) { this.svg.classList.toggle('lit', on); }
  setFast(v: boolean) { this.fast = v; }

  private async move(s: Sprite, to: Spot) {
    const [tx, ty] = to === 'home' ? s.home : SPOTS[to];
    const dx = tx - s.x, dy = ty - s.y; const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const flip = s.g.querySelector('.flip') as SVGGElement;
    if (Math.abs(dx) > 2) flip.style.transform = dx < 0 ? 'scaleX(-1)' : '';
    const total = this.dur(Math.max(260, dist / 0.42));
    if (total <= 0) { s.x = tx; s.y = ty; this.place(s); return; }
    const x0 = s.x, y0 = s.y; const t0 = performance.now(); let lastStep = 0;
    s.g.classList.add('walking');
    await new Promise<void>(res => {
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / total);
        const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        s.x = x0 + dx * e; s.y = y0 + dy * e - (reduced ? 0 : Math.abs(Math.sin(p * Math.PI * Math.max(2, dist / 60))) * 7);
        this.place(s);
        if (now - lastStep > 160) { sfx.step(); lastStep = now; }
        if (p < 1 && !this.fast) requestAnimationFrame(tick); else { s.x = tx; s.y = ty; this.place(s); res(); }
      };
      requestAnimationFrame(tick);
    });
    s.g.classList.remove('walking');
  }

  private hold(s: Sprite, item: Item | null) {
    s.held.innerHTML = item ? itemSVG(item) : '';
    if (item) { sfx.pick(); s.held.classList.remove('pop'); void s.held.getBoundingClientRect(); s.held.classList.add('pop'); }
  }

  private say(s: Sprite, text: string) {
    const w = Math.max(60, text.length * 7.4 + 22);
    s.bubble.innerHTML = `<g transform="translate(0 -96)"><rect x="${-w / 2}" y="-22" width="${w}" height="30" rx="14" fill="#fff" stroke="#2b2d42" stroke-width="2"/><path d="M-6 8 l6 9 6-9z" fill="#fff" stroke="#2b2d42" stroke-width="2"/><rect x="-7" y="5" width="14" height="4" fill="#fff"/><text y="-2" text-anchor="middle" class="speech">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></g>`;
    s.bubble.classList.remove('show'); void s.bubble.getBoundingClientRect(); s.bubble.classList.add('show');
    sfx.say();
    const b = s.bubble;
    setTimeout(() => { if (b.firstChild) b.classList.remove('show'); }, 1800 / this.speed);
  }

  private async fly(item: Item, from: [number, number], to: [number, number], ms: number) {
    const g = el('g', {}, this.fx); g.innerHTML = itemSVG(item);
    const total = this.dur(ms);
    const t0 = performance.now();
    const cx = (from[0] + to[0]) / 2, cy = Math.min(from[1], to[1]) - 140;
    await new Promise<void>(res => {
      const tick = (now: number) => {
        const p = total <= 0 ? 1 : Math.min(1, (now - t0) / total);
        const x = (1 - p) ** 2 * from[0] + 2 * (1 - p) * p * cx + p * p * to[0];
        const y = (1 - p) ** 2 * from[1] + 2 * (1 - p) * p * cy + p * p * to[1];
        g.setAttribute('transform', `translate(${x} ${y}) rotate(${p * 540})`);
        if (p < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    return g;
  }

  private shake(cls = 'shake') {
    if (reduced) return;
    this.svg.classList.remove(cls); void this.svg.getBoundingClientRect(); this.svg.classList.add(cls);
  }

  async run(act: Act) {
    const s = 'who' in act ? this.sprites.get(act.who) : undefined;
    switch (act.a) {
      case 'move': if (s) await this.move(s, act.to); break;
      case 'hold': if (s) this.hold(s, act.item); await sleep(this.dur(120)); break;
      case 'say': if (s) { this.say(s, act.text); await sleep(this.dur(650)); } break;
      case 'bump': if (s) { sfx.bump(); s.g.classList.remove('bumped'); void s.g.getBoundingClientRect(); s.g.classList.add('bumped'); await sleep(this.dur(420)); } break;
      case 'block': if (s) {
        sfx.block();
        const st = el('g', { class: 'stop', transform: `translate(${s.x} ${s.y - 120})` }, this.fx);
        st.innerHTML = `<polygon points="-18,-8 -8,-18 8,-18 18,-8 18,8 8,18 -8,18 -18,8" fill="#d2453a" stroke="#fff" stroke-width="3"/><text y="5" text-anchor="middle" font-size="12" font-weight="900" fill="#fff">${esc(tx.stage.stop)}</text>`;
        this.shake('nudge');
        await sleep(this.dur(700)); st.remove();
      } break;
      case 'leak': {
        const from: [number, number] = act.from === 'board' ? [509, 320] : (() => { const sp = this.sprites.get(act.from)!; return [sp.x, sp.y - 64] as [number, number]; })();
        if (act.from === 'board') this.boardItems.innerHTML = '';
        sfx.whoosh();
        this.svg.classList.add('leaking');
        const target = STRANGERS[0]!;
        const g = await this.fly(act.item, from, [target[0], target[1] - 44], 900);
        sfx.leak(); this.shake();
        const fl = this.svg.querySelector('.flash') as SVGRectElement; fl.classList.remove('go'); void fl.getBoundingClientRect(); fl.classList.add('go');
        this.svg.querySelectorAll('.stranger').forEach(x => x.classList.add('cheer'));
        await sleep(this.dur(900));
        g.remove();
        // a copy stays with the outsiders
        const copy = el('g', { transform: `translate(${target[0]} ${target[1] - 46}) scale(.8)`, class: 'leaked-copy' }, this.fx);
        copy.innerHTML = itemSVG(act.item);
        break;
      }
      case 'post': {
        const sp = this.sprites.get(act.who)!;
        await this.fly(act.item, [sp.x, sp.y - 64], [509, 322], 500).then(g => g.remove());
        const p = el('g', { transform: 'translate(509 322) rotate(-6)' }, this.boardItems); p.innerHTML = itemSVG(act.item);
        await sleep(this.dur(300)); break;
      }
      case 'unpost': this.boardItems.innerHTML = ''; await sleep(this.dur(200)); break;
      case 'reply': {
        const p = el('g', { transform: 'translate(522 326) rotate(8)' }, this.boardItems); p.innerHTML = itemSVG('public');
        sfx.pick(); await sleep(this.dur(500)); break;
      }
      case 'alarm': sfx.alarm(); this.svg.classList.remove('alarm'); void this.svg.getBoundingClientRect(); this.svg.classList.add('alarm'); await sleep(this.dur(500)); break;
      case 'build': {
        const b = [...this.sprites.values()].find(x => kindOf(x.m.def) === 'builder');
        if (b) { this.hold(b, null); }
        this.lantern(true);
        const prod = el('text', { x: 264, y: 440, 'text-anchor': 'middle', 'font-size': 38, class: 'product' }, this.fx); prod.textContent = this.productIcon;
        const sp = this.svg.querySelector('.sparks')!;
        sp.innerHTML = Array.from({ length: 14 }, (_, i) => `<circle class="spark" style="--a:${i * 25.7}deg;animation-delay:${(i % 5) * 60}ms" r="3" fill="#ffd76a"/>`).join('');
        await sleep(this.dur(900)); break;
      }
    }
  }

  async play(events: SimEvent[], onEvent: (i: number) => void, isCancelled: () => boolean) {
    for (let i = 0; i < events.length; i++) {
      if (isCancelled()) return;
      onEvent(i);
      for (const a of events[i]!.acts) { if (isCancelled()) return; await this.run(a); }
      await sleep(this.dur(160));
    }
  }

  /** Reset positions and items without rebuilding the scene. */
  reset() {
    for (const s of this.sprites.values()) { s.x = s.home[0]; s.y = s.home[1]; this.place(s); s.held.innerHTML = ''; s.bubble.innerHTML = ''; (s.g.querySelector('.flip') as SVGGElement).style.transform = ''; }
    this.fx.innerHTML = ''; this.boardItems.innerHTML = '';
    this.svg.classList.remove('leaking', 'lit', 'alarm');
    this.svg.querySelectorAll('.stranger').forEach(x => x.classList.remove('cheer'));
    const sp = this.svg.querySelector('.sparks'); if (sp) sp.innerHTML = '';
    void this.board;
  }
}
