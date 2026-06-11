// TERRY — Star Millwright. Finite Competence (spec §8.3).
// Resolves anything instantly. Is mortal. The break is sacred: NO code path
// in this file (or any file — acceptance test 2) shortens breakTicksRemaining.
// It decrements by exactly 1 per tick. State law / federal law / Terry's law.
//
// The other half of Terry: you LIKE him. Everyone likes him. Watching him
// work is the only wellness program this plant has ever funded, and the game
// bills you for it later, at clock-out, all at once.

import { BALANCE } from '../balance.js';
import { chance, pick } from '../rng.js';
import { pushTicker, addBP, setHealth } from '../util.js';

// Terry's voice (§12): ≤6 words. The sigh is free.
const FIX_LINES = [
  'It was the obvious thing.',
  'Tightened. Done. Next.',
  'Bearing. Always the bearing.',
  'Greased it while in there.',
  'Running. Tell Chris nothing.',
  'That noise was normal, actually.',
  'Done. Wrote it in the log.',
  'Back up. Watch the gauge.',
  'She was just lonely.',
  'Found a coin in there. Yours.',
];

// What he does on the walk back, unasked, unbilled, unannounced.
const WALKBY_LINES = [
  'Heard a rattle. Handled it.',
  'Bolt was loose. Not anymore.',
  'Belt was crying. Fixed it.',
  'Touched up a coupling. Free.',
];

// Spencer, off the radio, on the record.
const ADMIRE_LINES = [
  '(quietly, to no one) God, I really like this guy.',
  'Terry nodded at me just now. Best part of my night.',
  'He didn\'t even open the manual. The manual studies HIM.',
  'Note to self: whatever Terry is paid, it isn\'t enough.',
  'I would follow Terry into a burning kiln. He\'d know which valve.',
  'Watching that man work just took five points off my blood pressure. Medically.',
  'I really, really like this guy. Don\'t tell HR — there\'s a form for it.',
  'If Terry ever quits I\'m walking into the tree line that same hour.',
];

const BREAK_LINES = [
  'TERRY IS ON BREAK. (state law / federal law / Terry\'s law)',
  'TERRY IS ON BREAK. He earned it six times over tonight. Doesn\'t make it hurt less.',
  'TERRY IS ON BREAK. The thermos is out. The thermos predates the plant. Negotiations are not available.',
];

const RETURN_LINES = [
  'Back. What broke.',
  'Break\'s done. Point me.',
  'Rested. Where\'s the noise.',
];

const CLOCKOUT_LINES = [
  'Terry has gone home. Terry said, quote, "No."',
  'Terry has clocked out. He waved at YOU specifically. It still felt like losing.',
  'Terry has gone home. The plant got 3% louder out of respect.',
];

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
    text: `${BALANCE.MACHINES[machineId].label} fixed. ${pick(state, FIX_LINES)}`,
  });

  // On the walk back he hears things. The things get fixed. Nobody is billed,
  // nobody is told, and the work order is never opened because it never existed.
  if (chance(state, BALANCE.TERRY.WALKBY_P)) {
    const candidates = BALANCE.CHAIN
      .map(id => state.plant.machines[id])
      .filter(x => x.id !== machineId && (x.status === 'RUNNING' || x.status === 'DEGRADED'));
    if (candidates.length > 0) {
      const worst = candidates.reduce((a, b) => (a.health <= b.health ? a : b));
      setHealth(state, worst, worst.health + BALANCE.TERRY.WALKBY_HEALTH);
      if (worst.status === 'DEGRADED' && worst.health >= BALANCE.DEGRADED_AT) {
        worst.status = 'RUNNING';
        worst.flavor = 'nominal';
      }
      pushTicker(state, {
        speaker: 'TERRY',
        text: `(passing the ${BALANCE.MACHINES[worst.id].label}) ${pick(state, WALKBY_LINES)}`,
      });
    }
  }

  // Spencer says the quiet part. The ticker is the black box recorder; let it
  // record the one good feeling on this shift.
  if (chance(state, BALANCE.TERRY.ADMIRE_P)) {
    pushTicker(state, { speaker: 'SPENCER', text: pick(state, ADMIRE_LINES) });
  }
}

export function tickTerry(state) {
  const t = state.npcs.terry;
  if (t.status === 'CLOCKED_OUT') return;

  if (t.status === 'ON_BREAK') {
    t.breakTicksRemaining--; // the ONLY mutation of this field, anywhere, ever
    if (t.breakTicksRemaining <= 0) {
      t.status = 'AVAILABLE';
      t.stamina = BALANCE.TERRY.BREAK_REGEN_TO; // not 100. the shift takes its tithe.
      pushTicker(state, { speaker: 'TERRY', text: pick(state, RETURN_LINES) });
    }
    return;
  }

  t.stamina = Math.max(0, t.stamina - BALANCE.TERRY.PASSIVE_DRAIN);

  if (t.stamina <= BALANCE.TERRY.BREAK_AT) {
    if (t.breaksTaken >= BALANCE.TERRY.BREAKS_BEFORE_CLOCKOUT) {
      t.status = 'CLOCKED_OUT';
      pushTicker(state, {
        speaker: 'PLANT', severity: 'CRIT',
        text: pick(state, CLOCKOUT_LINES),
      });
    } else {
      t.status = 'ON_BREAK';
      t.breakTicksRemaining = BALANCE.TERRY.BREAK_TICKS;
      t.breaksTaken++;
      pushTicker(state, {
        speaker: 'PLANT', severity: 'WARN',
        text: pick(state, BREAK_LINES),
      });
    }
  }
}
