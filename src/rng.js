// The ONLY randomness entry point in the entire codebase (spec §15.2 #8).
// mulberry32, state carried inside GameState for full determinism under seed.

export function rand(state) {
  let t = (state.meta.rngState = (state.meta.rngState + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function chance(state, p) {
  return rand(state) < p;
}

export function randInt(state, min, max) {
  return min + Math.floor(rand(state) * (max - min + 1));
}

export function pick(state, arr) {
  return arr[Math.floor(rand(state) * arr.length)];
}

export function pickWeighted(state, entries) {
  // entries: [{ weight, ... }]
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let roll = rand(state) * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return entries[entries.length - 1];
}
