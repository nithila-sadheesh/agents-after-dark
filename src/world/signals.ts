// Shared traffic-signal clock (READ-ONLY for all agents). Every intersection runs the same cycle off
// performance.now(), so traffic lights (roads) and cars (life) agree without any coordination.
// "EW" = traffic moving along X (streets at z ∈ STREETS_Z); "NS" = traffic moving along Z (streets at x ∈ STREETS_X).
export type SignalPhase = 'EW_GREEN' | 'EW_YELLOW' | 'NS_GREEN' | 'NS_YELLOW' | 'ALL_RED';

const PHASES: [SignalPhase, number][] = [
  ['EW_GREEN', 9], ['EW_YELLOW', 2], ['ALL_RED', 1],
  ['NS_GREEN', 9], ['NS_YELLOW', 2], ['ALL_RED', 1],
];
export const SIGNAL_CYCLE_S = PHASES.reduce((a, [, d]) => a + d, 0); // 24s

export function signalPhase(nowSeconds = performance.now() / 1000): SignalPhase {
  let t = nowSeconds % SIGNAL_CYCLE_S;
  for (const [phase, d] of PHASES) { if (t < d) return phase; t -= d; }
  return 'ALL_RED';
}

/** Light color for a given approach axis right now. */
export function signalFor(axis: 'EW' | 'NS', nowSeconds?: number): 'green' | 'yellow' | 'red' {
  const p = signalPhase(nowSeconds);
  if (p === `${axis}_GREEN`) return 'green';
  if (p === `${axis}_YELLOW`) return 'yellow';
  return 'red';
}
