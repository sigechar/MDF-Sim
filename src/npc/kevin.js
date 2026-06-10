// KEVIN — MDF Superintendent. Systemic Conflict Avoidance (spec §8.1).
// He intercepts your progress with puns and intercepts nothing else, ever.
// There is no "summon Kevin" button. There will never be a summon Kevin button.

import { BALANCE } from '../balance.js';
import { chance, randInt, pick } from '../rng.js';
import {
  pushTicker, addBP, highAlarmCount, authorityCrisisActive,
  msfPerHour, requiredMsfPerHour,
} from '../util.js';
import { PUNS, KEVIN_RATE_NAGS } from '../content/puns.js';

export function tickKevin(state) {
  const k = state.npcs.kevin;
  const crisis = highAlarmCount(state) > 0 || authorityCrisisActive(state);

  if (k.ambushBoostTicks > 0) k.ambushBoostTicks--;
  if (k.punCooldown > 0) k.punCooldown--;
  if (k.nagCooldown > 0) k.nagCooldown--;

  // The Mandatory Fun is unstoppable, even by crisis. ESPECIALLY by crisis.
  if (k.status === 'MANDATORY_FUN') {
    k.funTicks--;
    if (k.funTicks <= 0) {
      k.status = 'ROAMING';
      // The pizza concludes with a guaranteed wood pun (spec §14.2)
      deliverPun(state, true);
    }
    return;
  }

  // Conflict detected → conflict avoided. Instantly. From any state.
  if (crisis && k.status !== 'HIDING') {
    k.status = 'HIDING';
    k.calmTicks = 0;
    pushTicker(state, {
      speaker: 'PLANT', severity: 'WARN',
      text: "Kevin? ... Kevin?? ... [Kevin's office light turns off]",
    });
  }

  switch (k.status) {
    case 'HIDING': {
      // The Hiding Tax: every tick a crisis runs unattended, Spencer pays.
      if (authorityCrisisActive(state)) {
        addBP(state, 'STRESS_KEVIN_HIDING', BALANCE.KEVIN.HIDING_BP_PER_TICK);
      }
      if (!crisis) {
        k.calmTicks++;
        if (k.calmTicks >= BALANCE.KEVIN.HIDE_EXIT_CALM_TICKS) {
          k.status = 'ROAMING';
          pushTicker(state, {
            speaker: 'KEVIN',
            text: "Wow!! Crazy night out there huh!! I was on a call... an important call!!",
          });
        }
      } else {
        k.calmTicks = 0;
      }
      break;
    }
    case 'ROAMING': {
      // The rate nag: when msf/hr runs low, Kevin does not raise the issue.
      // He stands NEAR the issue and radiates. With wordplay.
      const RN = BALANCE.KEVIN.RATE_NAG;
      if (state.meta.tick >= RN.AFTER_TICK && (k.nagCooldown ?? 0) <= 0
        && msfPerHour(state) < requiredMsfPerHour(state) * RN.FRACTION) {
        const text = pick(state, KEVIN_RATE_NAGS)(
          msfPerHour(state).toFixed(1), requiredMsfPerHour(state).toFixed(0));
        addBP(state, 'STRESS_KEVIN_NUDGE', RN.BP);
        pushTicker(state, { speaker: 'KEVIN', severity: 'WARN', text });
        k.nagCooldown = randInt(state, RN.COOLDOWN[0], RN.COOLDOWN[1]);
      }
      const p = BALANCE.KEVIN.APPROACH_P
        + (k.ambushBoostTicks > 0 ? BALANCE.KEVIN.PAUSE_AMBUSH_BONUS : 0);
      if (k.punCooldown <= 0 && chance(state, p)) {
        k.status = 'APPROACHING';
        k.approachTicks = BALANCE.KEVIN.APPROACH_TICKS;
        pushTicker(state, {
          speaker: 'PLANT', severity: 'WARN',
          text: 'Kevin has spotted you. Kevin is approaching. There is still time to look busy. There is not still time to look busy.',
        });
      }
      break;
    }
    case 'APPROACHING': {
      k.approachTicks--;
      if (k.approachTicks <= 0) deliverPun(state, false);
      break;
    }
  }
}

function deliverPun(state, forceWood) {
  const k = state.npcs.kevin;
  const pool = forceWood ? PUNS.filter(p => p.isWoodRelated) : PUNS;
  const pun = pick(state, pool);
  const dmg = pun.isWoodRelated ? BALANCE.KEVIN.WOOD_PUN_BP : BALANCE.KEVIN.PUN_BP;
  addBP(state, 'STRESS_PUN', dmg);
  k.punsDeliveredThisShift++;
  state.stats.punsEndured++;
  if (pun.isWoodRelated) state.stats.woodPunsEndured++;
  state.events.lastPun = { tick: state.meta.tick, text: pun.text };
  pushTicker(state, { speaker: 'KEVIN', severity: 'WARN', text: pun.text });
  k.status = 'ROAMING';
  k.punCooldown = randInt(state, BALANCE.KEVIN.PUN_COOLDOWN[0], BALANCE.KEVIN.PUN_COOLDOWN[1]);
}

// Called the instant a requiresAuthority event spawns. Kevin does not learn
// about crises and then hide; hiding is how he learns about crises.
export function kevinFlee(state) {
  const k = state.npcs.kevin;
  if (k.status === 'HIDING') return;
  if (k.status === 'MANDATORY_FUN') {
    // Crisis interrupts pizza. Kevin resolves the conflict between fun and
    // duty by taking the pizza somewhere neither can find him.
    k.funTicks = 0;
    state.flags.deploymentsLockedUntil = state.meta.tick;
    pushTicker(state, {
      speaker: 'PLANT', severity: 'WARN',
      text: 'Morale Pizza adjourned. Kevin has taken two boxes "to review the situation from his office." His office light is already off.',
    });
  } else {
    pushTicker(state, {
      speaker: 'PLANT', severity: 'WARN',
      text: "Kevin? ... Kevin?? ... [Kevin's office light turns off]",
    });
  }
  k.status = 'HIDING';
  k.calmTicks = 0;
}

// Supportive pun when Kevin overhears a locker scream (spec §7.3). It is
// somehow worse that he means well.
export function kevinHearsScream(state) {
  const k = state.npcs.kevin;
  if (k.status !== 'ROAMING') return;
  addBP(state, 'STRESS_PUN', BALANCE.KEVIN.PUN_BP);
  state.stats.punsEndured++;
  k.punsDeliveredThisShift++;
  const text = "Heard you in there!! Sounds like someone needs a morale boost... knock on wood!!!";
  state.events.lastPun = { tick: state.meta.tick, text };
  pushTicker(state, { speaker: 'KEVIN', severity: 'WARN', text });
}

export function startMandatoryFun(state) {
  const k = state.npcs.kevin;
  if (k.status === 'HIDING') {
    // Even pizza cannot reach a man this committed. Reschedule by a minute... no.
    // Pizza wins. Pizza always wins. He emerges FOR THE PIZZA.
    pushTicker(state, { speaker: 'PLANT', text: "Kevin's office light turns back on. It's pizza time. Crisis status: unchanged." });
  }
  k.status = 'MANDATORY_FUN';
  k.funTicks = BALANCE.KEVIN.MANDATORY_FUN_TICKS;
  state.flags.deploymentsLockedUntil = state.meta.tick + BALANCE.KEVIN.MANDATORY_FUN_TICKS;
  addBP(state, 'RELIEF_QUIET_MINUTE', -2); // the pizza is fine. the pizza is the only fine thing.
  pushTicker(state, {
    speaker: 'KEVIN', severity: 'WARN',
    text: "MANDATORY MIDNIGHT MORALE PIZZA!!! Everyone to the break room!! That's an order... a FUN order!!!",
  });
  pushTicker(state, {
    speaker: 'PLANT',
    text: 'All deployments locked for 10 minutes. The machines remain unsupervised. They know.',
  });
}
