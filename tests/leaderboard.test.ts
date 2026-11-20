// Ticket-04 section 3: leaderboard rules. Expected values are derived from the ticket by hand.
import { describe, expect, it } from "vitest";
import { Leaderboard, addEntry, formatIso, validateName, type Entry, type LeaderboardStorage } from "../src/web/leaderboard";

const e = (name: string, score: number, at = "2026-11-20T10:00:00+07:00", extra: Partial<Entry> = {}): Entry => ({ name, score, nights_won: 1, achieved_at: at, seed: 1, ...extra });
const memory = (initial: unknown = null): LeaderboardStorage & { value: unknown } => {
  const s = { value: initial, read: () => s.value, write: (v: unknown) => { s.value = v; } };
  return s;
};

describe("validateName", () => {
  it("accepts 3-12 characters from [A-Za-z0-9_]", () => {
    for (const ok of ["abc", "Nguyen_An1", "A_1", "abcdefghijkl" /* 12 */, "___", "Z9z"]) expect(validateName(ok), ok).toBe(true);
  });
  it("rejects too short (2), too long (13), spaces, punctuation, empty", () => {
    for (const bad of ["ab", "abcdefghijklm" /* 13 */, "a b c", "no-dash", "name!", "", "a.b", "tab\tx"]) expect(validateName(bad), bad).toBe(false);
  });
  it("accepts Vietnamese letters (bonus), counting code points after NFC: Cường = 5, Nguyễn_Văn = 10", () => {
    expect(validateName("Cường")).toBe(true);
    expect(validateName("Cu'ng")).toBe(false); // an apostrophe is not a letter
    expect(validateName("Cường")).toBe(true); // decomposed form is normalised to NFC first
    expect(validateName("Nguyễn_Văn")).toBe(true);
    expect(validateName("Đặng")).toBe(true);
  });
  it("rejects emoji and non-Latin scripts", () => {
    expect(validateName("fire🔥ok")).toBe(false);
    expect(validateName("日本語です")).toBe(false);
  });
});

describe("addEntry", () => {
  it("sorts by score descending", () => {
    let list: Entry[] = [];
    for (const [n, s] of [["aaa", 100], ["bbb", 300], ["ccc", 200]] as const) list = addEntry(list, e(n, s)).entries;
    expect(list.map((x) => x.name)).toEqual(["bbb", "ccc", "aaa"]);
  });

  it("keeps only the top 10: the 11th (lowest) entry is dropped and reports rank null", () => {
    let list: Entry[] = [];
    for (let i = 1; i <= 10; i++) list = addEntry(list, e(`pl${i}x`, i * 10)).entries; // scores 10..100
    expect(list).toHaveLength(10);
    const low = addEntry(list, e("lowest", 5));
    expect(low.entries).toHaveLength(10);
    expect(low.rank).toBeNull();
    expect(low.entries.map((x) => x.name)).not.toContain("lowest");
    const high = addEntry(list, e("champ", 500));
    expect(high.rank).toBe(1);
    expect(high.entries).toHaveLength(10);
    expect(high.entries[0]!.name).toBe("champ");
    expect(high.entries.map((x) => x.name)).not.toContain("pl1x"); // the old lowest (score 10) fell off
  });

  it("on equal score the earlier entry ranks higher, whatever the insertion order", () => {
    let list = addEntry([], e("later", 100, "2026-11-20T12:00:00+07:00")).entries;
    list = addEntry(list, e("earlier", 100, "2026-11-20T09:00:00+07:00")).entries;
    expect(list.map((x) => x.name)).toEqual(["earlier", "later"]);
  });

  it("compares times by instant, not by text: 10:00+07:00 is earlier than 09:00+00:00", () => {
    // 10:00+07:00 = 03:00Z; 09:00+00:00 = 09:00Z
    let list = addEntry([], e("utc9", 50, "2026-11-20T09:00:00+00:00")).entries;
    list = addEntry(list, e("vn10", 50, "2026-11-20T10:00:00+07:00")).entries;
    expect(list.map((x) => x.name)).toEqual(["vn10", "utc9"]);
  });

  it("same score and same instant: insertion order decides", () => {
    let list = addEntry([], e("first", 70)).entries;
    list = addEntry(list, e("second", 70)).entries;
    expect(list.map((x) => x.name)).toEqual(["first", "second"]);
  });

  it("returns the 1-based rank of the new entry", () => {
    const list = addEntry(addEntry([], e("aaa", 300)).entries, e("bbb", 100)).entries;
    expect(addEntry(list, e("ccc", 200)).rank).toBe(2);
  });

  it("refuses an invalid name", () => {
    expect(() => addEntry([], e("no", 1))).toThrow();
  });
});

describe("formatIso", () => {
  it("writes local time with the UTC offset: 08:04:05Z at +420 min is 15:04:05+07:00", () => {
    expect(formatIso(Date.UTC(2026, 10, 20, 8, 4, 5), 420)).toBe("2026-11-20T15:04:05+07:00");
  });
  it("handles a negative and a half-hour offset and the date rollover: 23:30:00Z at -330 min is 18:00:00-05:30 the same day; at +330 it is 05:00:00+05:30 the next day", () => {
    expect(formatIso(Date.UTC(2026, 10, 20, 23, 30, 0), -330)).toBe("2026-11-20T18:00:00-05:30");
    expect(formatIso(Date.UTC(2026, 10, 20, 23, 30, 0), 330)).toBe("2026-11-21T05:00:00+05:30");
  });
  it("UTC is +00:00", () => {
    expect(formatIso(Date.UTC(2026, 0, 2, 3, 4, 5), 0)).toBe("2026-01-02T03:04:05+00:00");
  });
});

describe("Leaderboard (injected storage)", () => {
  it("starts empty, persists a submitted entry, and a new instance over the same storage sees it (restart)", () => {
    const store = memory();
    const lb = new Leaderboard(store);
    expect(lb.entries()).toEqual([]);
    lb.submit(e("Mayba", 400, "2026-11-20T10:00:00+07:00", { nights_won: 3, seed: 42 }));
    const again = new Leaderboard(store);
    expect(again.entries()).toEqual([e("Mayba", 400, "2026-11-20T10:00:00+07:00", { nights_won: 3, seed: 42 })]);
  });

  it("ignores corrupted stored data instead of crashing", () => {
    expect(new Leaderboard(memory("not an array")).entries()).toEqual([]);
    expect(new Leaderboard(memory([{ name: "ok_name", score: "x" }])).entries()).toEqual([]);
  });

  it("export is {\"entries\": [...]} in rank order", () => {
    const lb = new Leaderboard(memory());
    lb.submit(e("low_one", 10));
    lb.submit(e("top_one", 90));
    lb.submit(e("mid_one", 50));
    const out = lb.exportJson();
    expect(Object.keys(out)).toEqual(["entries"]);
    expect(out.entries.map((x) => x.name)).toEqual(["top_one", "mid_one", "low_one"]);
    for (const x of out.entries) expect(Object.keys(x).sort()).toEqual(["achieved_at", "name", "nights_won", "score", "seed"]);
  });
});
