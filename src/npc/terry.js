// TERRY — Star Millwright. Finite Competence (spec §8.3).
// Resolves anything instantly. Is mortal. The break is sacred: NO code path
// in this file (or any file — acceptance test 2) shortens breakTicksRemaining.
// It decrements by exactly 1 per tick. State law / federal law / Terry's law.

import { BALANCE } from '../balance.js';
import { pushTicker, addBP, setHealth } from '../util.js';

export function deployTerry(state, machineId) {
  const t = state.npcs.terry;
  const m = state.plant.machines[machineId];

  // INSTANT. This is why you love him. This is why you will lose him.
  m.status = 'RUNNING';
  setHealth(state, m, 100);
  m.assignedNpc = null;
  m.repairEta = null;
  m.flavor = 'nominal';
  t.stamina -= BALANCE.TERRY.STAMINA_PER_FIX;
  t.fixesThisShift++;
  state.stats.terryFixes++;
  addBP(state, 'RELIEF_SMALL_VICTORY', -BALANCE.BP.TERRY_VICTORY); // watching mastery is soothing
  pushTicker(state, {
    speaker: 'TERRY',
    text: `${BALANCE.MACHINES[machineId].label} fixed. ${m.id === 'PRESS' ? 'Tightened. Done. Next.' : 'It was the obvious thing.'}`,
  });
  // Voice rule (§12): Terry's lines are ≤6 words. The sigh is free.
}

export function tickTerry(state) {
  const t = state.npcs.terry;
  if (t.status === 'CLOCKED_OUT') return;

  if (t.status === 'ON_BREAK') {
    t.breakTicksRemaining--; // the ONLY mutation of this field, anywhere, ever
    if (t.breakTicksRemaining <= 0) {
      t.status = 'AVAILABLE';
      t.stamina = BALANCE.TERRY.BREAK_REGEN_TO; // not 100. the shift takes its tithe.
      pushTicker(state, { speaker: 'TERRY', text: 'Back. What broke.' });
    }
    return;
  }

  t.stamina = Math.max(0, t.stamina - BALANCE.TERRY.PASSIVE_DRAIN);

  if (t.stamina <= BALANCE.TERRY.BREAK_AT) {
    if (t.breaksTaken >= BALANCE.TERRY.BREAKS_BEFORE_CLOCKOUT) {
      t.status = 'CLOCKED_OUT';
      pushTicker(state, {
        speaker: 'PLANT', severity: 'CRIT',
        text: `Terry has gone home. Terry said, quote, "No."`,
      });
    } else {
      t.status = 'ON_BREAK';
      t.breakTicksRemaining = BALANCE.TERRY.BREAK_TICKS;
      t.breaksTaken++;
      pushTicker(state, {
        speaker: 'PLANT', severity: 'WARN',
        text: 'TERRY IS ON BREAK. (state law / federal law / Terry\'s law)',
      });
    }
  }
}
