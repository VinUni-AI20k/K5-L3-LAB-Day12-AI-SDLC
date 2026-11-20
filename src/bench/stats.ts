// Bench statistics (Ticket-04 section 1). Pure; also bundled for the Electron main process (electron/bench-stats.cjs).
export interface BenchStats { frames: number; avg_fps: number; p1_low_fps: number; frame_ms_p95: number }

/**
 * dts are frame times in ms.
 * avg_fps = 1000*N / sum(dt); p1_low_fps = 1000 / mean of the k largest dt with k = max(1, ceil(0.01*N));
 * frame_ms_p95 = the 95th percentile of dt by nearest rank (the ceil(0.95*N)-th smallest).
 */
export function benchStats(dts: readonly number[]): BenchStats {
  const n = dts.length;
  if (n === 0) throw new Error("benchStats needs at least one frame");
  const sorted = [...dts].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const k = Math.max(1, Math.ceil(0.01 * n - 1e-9));
  let top = 0;
  for (let i = 0; i < k; i++) top += sorted[n - 1 - i]!;
  const rank = Math.max(1, Math.ceil(0.95 * n - 1e-9));
  return { frames: n, avg_fps: (1000 * n) / sum, p1_low_fps: 1000 / (top / k), frame_ms_p95: sorted[rank - 1]! };
}
