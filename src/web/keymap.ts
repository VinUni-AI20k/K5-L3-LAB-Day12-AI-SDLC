// Key bindings (Ticket-04 section 4). Pure. Keys are `KeyboardEvent.key` lowercased.
export const ACTIONS = ["forward", "back", "left", "right", "jump", "dash", "interact", "pulse", "pause"] as const;
export type Action = (typeof ACTIONS)[number];
export type Keymap = Record<Action, string>;

export const ACTION_LABELS: Record<Action, string> = {
  forward: "Tiến", back: "Lùi", left: "Trái", right: "Phải", jump: "Nhảy", dash: "Lướt", interact: "Nạp đèn", pulse: "Tỏa sáng", pause: "Tạm dừng",
};

/** Keys that cannot be bound: F3 is the FPS counter, Tab is browser focus, the arrows turn the camera, P is a pause alias and R restarts a lost night. */
const RESERVED = new Set(["f3", "tab", "arrowleft", "arrowright", "arrowup", "arrowdown", "p", "r"]);

export function defaultKeymap(): Keymap {
  return { forward: "w", back: "s", left: "a", right: "d", jump: " ", dash: "shift", interact: "e", pulse: "f", pause: "escape" };
}

export interface Conflict { key: string; actions: Action[] }

/** Every key used by two or more actions, in the order the keys first appear in ACTIONS. */
export function findConflicts(map: Keymap): Conflict[] {
  const by = new Map<string, Action[]>();
  for (const a of ACTIONS) by.set(map[a], [...(by.get(map[a]) ?? []), a]);
  return [...by.entries()].filter(([, acts]) => acts.length > 1).map(([key, actions]) => ({ key, actions }));
}

export interface RebindResult { ok: boolean; map: Keymap; conflictWith?: Action; reason?: "reserved" | "conflict" }

/** Binds `key` to `action` unless it is reserved or already owns another action. The input map is never modified. */
export function rebind(map: Keymap, action: Action, key: string): RebindResult {
  const k = key.toLowerCase();
  if (RESERVED.has(k)) return { ok: false, map: { ...map }, reason: "reserved" };
  const owner = ACTIONS.find((a) => a !== action && map[a] === k);
  if (owner) return { ok: false, map: { ...map }, conflictWith: owner, reason: "conflict" };
  return { ok: true, map: { ...map, [action]: k } };
}

/** Reads saved data; anything incomplete, mistyped or with duplicate keys gives the defaults. */
export function parseKeymap(raw: unknown): Keymap {
  if (raw === null || typeof raw !== "object") return defaultKeymap();
  const o = raw as Record<string, unknown>;
  const m = {} as Keymap;
  for (const a of ACTIONS) {
    const v = o[a];
    if (typeof v !== "string" || v === "" || RESERVED.has(v)) return defaultKeymap();
    m[a] = v.toLowerCase();
  }
  return findConflicts(m).length > 0 ? defaultKeymap() : m;
}

export function keyLabel(key: string): string {
  const names: Record<string, string> = { " ": "Space", shift: "Shift", escape: "Esc", arrowleft: "←", arrowright: "→", arrowup: "↑", arrowdown: "↓", enter: "Enter", control: "Ctrl", alt: "Alt" };
  return names[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}
