// Hourly reconciliation: corporate pace pressure and the vendor-merchandise
// doomsday counter. Spec §10.2, §10.3.

import { BALANCE } from '../balance.js';
import { pushTicker, addBP } from '../util.js';

// Corporate email subjects escalate hourly. The email IS the penalty.
const PACE_SUBJECTS = [
  'Quick check-in',
  'Following up',
  'Circling back',
  'Per my last email',
  "Adding Kevin's boss to the thread",
];

export function runEconomy(state) {
  // ---- merch-vendor doomsday counter (LOSS_BANKRUPT_MERCH arming) ----
  const E = BALANCE.ECONOMY;
  if (state.resources.resin < E.MERCH_RESIN_FLOOR && state.resources.cash < E.RESIN_BUY.cost) {
    state.flags.merchArmTicks++;
    if (state.flags.merchArmTicks === 1) {
      pushTicker(state, { channel: 'EMAIL', severity: 'WARN', text: 'ACCOUNTS PAYABLE: "exploring creative settlement options with the resin vendor." A box of lanyards has been located.' });
    } else if (state.flags.merchArmTicks === 30) {
      pushTicker(state, { channel: 'EMAIL', severity: 'CRIT', text: 'ACCOUNTS PAYABLE: the vendor has been offered "payment in company merchandise." The vendor has gone quiet. Quiet like a lawyer.' });
    }
  } else {
    state.flags.merchArmTicks = 0;
  }

  // ---- hourly corporate pace check ----
  if (state.meta.shiftClock % 60 !== 0 || state.meta.shiftClock === 0) return;

  const target = BALANCE.TARGETS[state.meta.difficulty];
  const expectedPace = target * (state.meta.shiftClock / BALANCE.TICKS_PER_SHIFT);
  if (state.resources.boardsProduced < expectedPace * BALANCE.EVENTS.PACE_GRACE) {
    state.flags.paceFailStreak++;
    if (state.flags.paceFailStreak >= BALANCE.EVENTS.PACE_FAILS_FOR_SILENCE) {
      if (!state.flags.noSubjectSent) {
        state.flags.noSubjectSent = true;
        addBP(state, 'STRESS_CORPORATE_PACE', BALANCE.STRESS.CORPORATE_NO_SUBJECT);
        pushTicker(state, { channel: 'EMAIL', severity: 'CRIT', text: 'CORPORATE: (no subject)' });
        // Nothing further. The silence is worse.
      }
    } else {
      const subject = PACE_SUBJECTS[Math.min(state.flags.paceFailStreak - 1, PACE_SUBJECTS.length - 1)];
      addBP(state, 'STRESS_CORPORATE_PACE', BALANCE.STRESS.CORPORATE_PACE);
      pushTicker(state, { channel: 'EMAIL', severity: 'WARN', text: `CORPORATE: "${subject}" — production pace ${Math.round(state.resources.boardsProduced)}/${Math.round(expectedPace)} msf.` });
    }
  } else {
    state.flags.paceFailStreak = 0;
  }
}

// Live fiber price, with spot-market emotional escalation (spec §6.2)
export function fiberPrice(state) {
  const F = BALANCE.ECONOMY.FIBER_BUY;
  const over = Math.max(0, state.flags.fiberPurchases - F.escalateAfter);
  return Math.round(F.cost * Math.pow(F.escalation, over));
}

export function rushFiberPrice(state) {
  return Math.round(fiberPrice(state) * BALANCE.ECONOMY.RUSH_MULT);
}

export function resinPrice(state) {
  const base = BALANCE.ECONOMY.RESIN_BUY.cost;
  return state.flags.resinDiscountNext ? Math.round(base * 0.9) : base;
}
