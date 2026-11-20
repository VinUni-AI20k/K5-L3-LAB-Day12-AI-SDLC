// Ticket-02 palette (each RGB channel within +-10% is allowed; we use the exact values). Single place for colours.
export const PALETTE = {
  nightSky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  cloudSea: 0x12384a,
  lanternLit: 0xffb347,
  lanternCore: 0xffe9b0,
  lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeOutline: 0x7a3cff,
  shadeStunned: 0x3a3450,
  mayShirt: 0xe8e2d0,
  mayScarf: 0xc8102e, // also the charm
  gold: 0xf2c14e, // gold border, score
  drifter: 0x8fa3b8,
  uiDanger: 0xff5a5f,
  // colour-blind mode (Ticket-03): shade outline and eyes, and the warning colour (shown with a warning icon)
  shadeOutlineCB: 0x00b3ff,
  warningCB: 0xffffff,
  uiText: 0xf5f1e6,
} as const;

export const css = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;

/** Ambient light intensity: 0.15 + 0.55 * (lit lanterns / total lanterns). */
export const ambientIntensity = (lit: number, total: number): number => 0.15 + 0.55 * (total > 0 ? lit / total : 0);
