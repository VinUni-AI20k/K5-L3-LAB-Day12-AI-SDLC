// Ticket-04 section 4: key rebinding. Expected values are derived from the ticket by hand.
import { describe, expect, it } from "vitest";
import { ACTIONS, defaultKeymap, findConflicts, parseKeymap, rebind, keyLabel, type Keymap } from "../src/web/keymap";

describe("keymap defaults", () => {
  it("covers every action in the ticket: 4 move directions, jump, dash, interact, pulse, pause = 9", () => {
    expect([...ACTIONS]).toEqual(["forward", "back", "left", "right", "jump", "dash", "interact", "pulse", "pause"]);
  });
  it("defaults are WASD, Space, Shift, E, F, Escape, with no duplicate key", () => {
    const m = defaultKeymap();
    expect(m).toEqual({ forward: "w", back: "s", left: "a", right: "d", jump: " ", dash: "shift", interact: "e", pulse: "f", pause: "escape" });
    expect(findConflicts(m)).toEqual([]);
  });
  it("returns a fresh object each time", () => {
    const a = defaultKeymap();
    a.jump = "j";
    expect(defaultKeymap().jump).toBe(" ");
  });
});

describe("findConflicts", () => {
  it("reports each key used by 2 or more actions, listing the actions in action order", () => {
    const m: Keymap = { ...defaultKeymap(), dash: "e" }; // dash and interact both on E
    expect(findConflicts(m)).toEqual([{ key: "e", actions: ["dash", "interact"] }]);
  });
  it("reports several conflicts and three-way clashes", () => {
    const m: Keymap = { ...defaultKeymap(), left: "w", back: "w", jump: "f" }; // forward/left/back on W; jump/pulse on F
    expect(findConflicts(m)).toEqual([{ key: "w", actions: ["forward", "back", "left"] }, { key: "f", actions: ["jump", "pulse"] }]);
  });
});

describe("rebind", () => {
  it("accepts a free key and lowercases it", () => {
    const r = rebind(defaultKeymap(), "jump", "J");
    expect(r.ok).toBe(true);
    expect(r.map.jump).toBe("j");
    expect(findConflicts(r.map)).toEqual([]);
  });
  it("refuses a key already used and names the action that owns it; the map is unchanged", () => {
    const r = rebind(defaultKeymap(), "interact", "f"); // F belongs to pulse
    expect(r.ok).toBe(false);
    expect(r.conflictWith).toBe("pulse");
    expect(r.map).toEqual(defaultKeymap());
  });
  it("lets an action keep its own key (no false conflict)", () => {
    expect(rebind(defaultKeymap(), "pulse", "f").ok).toBe(true);
  });
  it("refuses reserved keys: F3 (FPS counter), Tab, the camera arrows, P (pause alias) and R (restart)", () => {
    for (const k of ["F3", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "p", "R"]) expect(rebind(defaultKeymap(), "jump", k).ok, k).toBe(false);
  });
  it("does not modify its input", () => {
    const m = defaultKeymap();
    rebind(m, "jump", "j");
    expect(m).toEqual(defaultKeymap());
  });
});

describe("restore defaults and saving", () => {
  it("restoring after changes gives exactly the defaults", () => {
    let m = rebind(defaultKeymap(), "jump", "j").map;
    m = rebind(m, "dash", "q").map;
    expect(m).not.toEqual(defaultKeymap());
    expect(defaultKeymap()).toEqual({ forward: "w", back: "s", left: "a", right: "d", jump: " ", dash: "shift", interact: "e", pulse: "f", pause: "escape" });
  });
  it("a saved map round-trips through JSON", () => {
    const m = rebind(defaultKeymap(), "jump", "j").map;
    expect(parseKeymap(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });
  it("corrupted or conflicting saved data falls back to the defaults", () => {
    expect(parseKeymap(null)).toEqual(defaultKeymap());
    expect(parseKeymap("x")).toEqual(defaultKeymap());
    expect(parseKeymap({ forward: "w" })).toEqual(defaultKeymap()); // missing actions
    expect(parseKeymap({ ...defaultKeymap(), jump: 5 })).toEqual(defaultKeymap());
    expect(parseKeymap({ ...defaultKeymap(), dash: "e" })).toEqual(defaultKeymap()); // duplicate
  });
});

describe("keyLabel", () => {
  it("shows readable names", () => {
    expect(keyLabel(" ")).toBe("Space");
    expect(keyLabel("shift")).toBe("Shift");
    expect(keyLabel("escape")).toBe("Esc");
    expect(keyLabel("arrowleft")).toBe("←");
    expect(keyLabel("e")).toBe("E");
  });
});
