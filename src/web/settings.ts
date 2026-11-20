// Player settings kept in localStorage (volume 0..1, mouse sensitivity multiplier). Every access is guarded: storage can be blocked.
import { defaultKeymap, parseKeymap, type Keymap } from "./keymap";

export interface Settings {
  volume: number;
  sensitivity: number;
  colorBlind: boolean; // "Bảng màu dễ phân biệt"
  reducedMotion: boolean; // no camera shake, no screen flashes
  largeText: boolean; // UI text x1.25
  keymap: Keymap;
}

const KEY = "ddl.settings.v1";
const DEFAULTS: Settings = { volume: 0.7, sensitivity: 1, colorBlind: false, reducedMotion: false, largeText: false, keymap: defaultKeymap() };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, keymap: defaultKeymap() };
    const p = JSON.parse(raw) as Partial<Settings>;
    const ok = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    return { volume: ok(p.volume, 0, 1, DEFAULTS.volume), sensitivity: ok(p.sensitivity, 0.2, 3, DEFAULTS.sensitivity), colorBlind: p.colorBlind === true, reducedMotion: p.reducedMotion === true, largeText: p.largeText === true, keymap: parseKeymap(p.keymap) };
  } catch {
    return { ...DEFAULTS, keymap: defaultKeymap() };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings last for this session only */
  }
}
