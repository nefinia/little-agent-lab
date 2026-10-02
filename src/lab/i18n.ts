// Little Agent Lab — languages (English, French, Spanish).
//
// The language is chosen once at startup (switching reloads the page):
//   window.SofiLang.lang (set by the sofi.games shell) → ?lang= → localStorage "sofi-lang"
//   → navigator.language (fr/es) → English.
// All player-visible text lives in ./strings/{en,fr,es}.ts. `tx` is a live binding to the
// current dictionary; `fmt` fills {placeholders} ({^name} capitalises the first letter).
import { en, type Strings } from './strings/en';
import { fr } from './strings/fr';
import { es } from './strings/es';

export type Lang = 'en' | 'fr' | 'es';
export const LANGS: Lang[] = ['en', 'fr', 'es'];
export const LANG_KEY = 'sofi-lang';

/** French typography: narrow no-break space before ! ? ; and no-break space before : and inside « ». */
function frenchSpaces<T>(v: T): T {
  if (typeof v === 'string') {
    return v.replace(/ ([!?;])/g, ' $1').replace(/ :/g, ' :').replace(/« /g, '« ').replace(/ »/g, ' »') as T;
  }
  if (Array.isArray(v)) return v.map(frenchSpaces) as T;
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = frenchSpaces(x);
    return o as T;
  }
  return v;
}

const DICTS: Record<Lang, Strings> = { en, fr: frenchSpaces(fr), es };

const isLang = (x: unknown): x is Lang => typeof x === 'string' && (LANGS as string[]).includes(x);

export function detectLang(): Lang {
  try {
    const w = (typeof window !== 'undefined' ? window : undefined) as (Window & { SofiLang?: { lang?: string } }) | undefined;
    if (!w) return 'en';
    const sofi = w.SofiLang?.lang?.toLowerCase();
    if (isLang(sofi)) return sofi;
    const q = new URLSearchParams(w.location.search).get('lang')?.toLowerCase();
    if (isLang(q)) return q;
    let saved: string | null = null;
    try { saved = w.localStorage.getItem(LANG_KEY); } catch { /* storage blocked */ }
    if (isLang(saved)) return saved;
    const nav = (w.navigator?.language || '').toLowerCase().slice(0, 2);
    if (isLang(nav)) return nav;
  } catch { /* fall through */ }
  return 'en';
}

export let lang: Lang = detectLang();
export let tx: Strings = DICTS[lang];

/** Switch the dictionary (used by tests; the game itself reloads to change language). */
export function setLang(l: Lang) { lang = l; tx = DICTS[l]; }
export const dict = (l: Lang): Strings => DICTS[l];

export const cap = (s: string) => s ? s[0]!.toUpperCase() + s.slice(1) : s;

/** Fill {name} placeholders; {^name} capitalises the inserted value. */
export function fmt(s: string, vars: Record<string, string | number> = {}): string {
  return s.replace(/\{(\^?)(\w+)\}/g, (m, up: string, k: string) => {
    if (!(k in vars)) return m;
    const v = String(vars[k]);
    return up ? cap(v) : v;
  });
}

/** Pick the singular or plural form. */
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
