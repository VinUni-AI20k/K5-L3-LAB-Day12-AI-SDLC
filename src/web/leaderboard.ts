// Local leaderboard rules (Ticket-04 section 3). Pure: storage is injected, so the web build (localStorage),
// the Electron build (userData file over IPC) and the tests all use the same code.
export interface Entry {
  name: string;
  score: number; // sum of the nights won
  nights_won: number; // 0..3
  achieved_at: string; // ISO 8601 with time zone
  seed: number;
}

export interface LeaderboardStorage {
  read(): unknown;
  write(value: unknown): void;
}

export const MAX_ENTRIES = 10;

/** 3-12 code points, each a Latin-script letter (so Vietnamese diacritics work), a digit or "_". Normalised to NFC first. */
export function validateName(raw: string): boolean {
  const chars = [...raw.normalize("NFC")];
  if (chars.length < 3 || chars.length > 12) return false;
  return chars.every((c) => /^[\p{Script=Latin}0-9_]$/u.test(c));
}

const instant = (iso: string): number => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
};

/**
 * Inserts `entry`, then keeps the top 10: score descending, then the earlier `achieved_at` instant first, then insertion order.
 * `rank` is the 1-based rank of the new entry, or null when it did not make the top 10.
 */
export function addEntry(list: readonly Entry[], entry: Entry): { entries: Entry[]; rank: number | null } {
  if (!validateName(entry.name)) throw new Error(`invalid name: ${entry.name}`);
  const clean: Entry = { ...entry, name: entry.name.normalize("NFC") };
  const tagged = [...list, clean].map((x, i) => ({ x, i }));
  tagged.sort((a, b) => b.x.score - a.x.score || instant(a.x.achieved_at) - instant(b.x.achieved_at) || a.i - b.i);
  const top = tagged.slice(0, MAX_ENTRIES);
  const pos = top.findIndex((t) => t.x === clean);
  return { entries: top.map((t) => t.x), rank: pos < 0 ? null : pos + 1 };
}

/** Local time with the UTC offset, e.g. 2026-11-20T15:04:05+07:00. `offsetMin` is minutes east of UTC. */
export function formatIso(ms: number, offsetMin: number): string {
  const d = new Date(ms + offsetMin * 60000);
  const p = (n: number, w = 2): string => String(n).padStart(w, "0");
  const sign = offsetMin >= 0 ? "+" : "-";
  const o = Math.abs(offsetMin);
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}${sign}${p(Math.floor(o / 60))}:${p(o % 60)}`;
}

/** Now, in the machine's local time zone. */
export function nowIso(): string {
  const d = new Date();
  return formatIso(d.getTime(), -d.getTimezoneOffset());
}

function isEntry(v: unknown): v is Entry {
  if (v === null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.name === "string" && typeof o.score === "number" && typeof o.nights_won === "number" && typeof o.achieved_at === "string" && typeof o.seed === "number";
}

export class Leaderboard {
  constructor(private readonly storage: LeaderboardStorage) {}

  /** Stored entries in rank order. Corrupted data is ignored, never thrown. */
  entries(): Entry[] {
    let raw: unknown;
    try {
      raw = this.storage.read();
    } catch {
      return [];
    }
    const arr = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { entries?: unknown }).entries) ? (raw as { entries: unknown[] }).entries : [];
    return arr.filter(isEntry);
  }

  submit(entry: Entry): { entries: Entry[]; rank: number | null } {
    const r = addEntry(this.entries(), entry);
    this.storage.write(r.entries);
    return r;
  }

  exportJson(): { entries: Entry[] } {
    return { entries: this.entries().map((e) => ({ name: e.name, score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed })) };
  }
}
