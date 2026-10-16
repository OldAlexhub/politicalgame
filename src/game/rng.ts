/* eslint-disable no-bitwise */
export interface RandomSample {
  value: number;
  state: number;
}

// Mulberry32 expressed as an explicit state transition so saves/replays are exact.
export function nextRandom(previousState: number): RandomSample {
  const state = (previousState + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return {value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state};
}

export function randomBetween(previousState: number, minimum: number, maximum: number) {
  const sample = nextRandom(previousState);
  return {
    value: Math.round(minimum + sample.value * (maximum - minimum)),
    state: sample.state,
  };
}

export function stableId(prefix: string, seed: number, sequence: number) {
  return `${prefix}-${seed.toString(36)}-${sequence.toString(36)}`;
}
