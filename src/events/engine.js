// The Event Engine (spec §9): scheduled payloads, incident spawns, the
// single-slot choice modal with its overflow rule, active ongoing effects,
// and player action processing (spec loop step 5).

import { BALANCE } from '../balance.js';
import { chance } from '../rng.js';
import {
  pushTicker, addBP, addGlue, openChoice, money, clamp,
} from '../util.js';
import { rollIncident, resolveIncidentChoice } from './incidents.js';
import { resolveMonologue } from '../npc/dave.js';
import { resolveTrade, resolveDispute, detonateDefect, handbackPress, spawnDispute } from '../npc/tod.js';
import { startMandatoryFun, kevinHearsScream } from '../npc/kevin.js';
import { deployTerry } from '../npc/terry.js';
import { deployDave } from '../npc/dave.js';
import { deployChris } from '../npc/chris.js';
import { fiberPrice, rushFiberPrice, resinPrice } from '../engine/economy.js';

// ------------------------------------------------------------ scheduler ---
export function processScheduled(state) {
  const due = state.events.scheduled.filter(e => e.fireTick <= state.meta.tick);
  state.events.scheduled = state.events.scheduled.filter(e => e.fireTick > state.meta.tick);
  for (const e of due) {
    switch (e.kind) {
      case 'FIBER_DELIVERY':
        state.resources.woodFiber = clamp(state.resources.woodFiber + e.data.amount, 0, BALANCE.CAPS.fiber);
        pushTicker(state, { speaker: 'PLANT', text: `Fiber delivery: +${e.data.amount}t. The truck driver waved. Nobody waves here. Suspicious, but the fiber checks out.` });
        break;
      case 'TOD_DEFECT': detonateDefect(state, e.data.type); break;
      case 'CCREW_HANDBACK': handbackPress(state, e.data.defect); break;
      case 'MANDATORY_FUN': startMandatoryFun(state); break;
      case 'TOD_DISPUTE': spawnDispute(state); break;
    }
  }
}

// --------------------------------------------------------- active events ---
export function tickActiveEvents(state) {
  const keep = [];
  for (const ev of state.events.active) {
    let alive = true;
    switch (ev.kind) {
      case 'PRESS_THERMAL': {
        const press = state.plant.machines.PRESS;
        if (press.status === 'RUNNING' || press.status === 'DEGRADED' || press.status === 'REPAIRING') {
          alive = false; // someone is dealing with it; the crisis stands down
          if (press.status !== 'REPAIRING') {
            pushTicker(state, { speaker: 'PLANT', text: 'Press thermal event contained. The smoke has agreed to stop being evidence.' });
          }
        } else {
          ev.ticksLeft--;
          if (ev.ticksLeft === 0 && state.flags.pressHealthCap === null) {
            state.flags.pressHealthCap = BALANCE.EVENTS.PRESS_THERMAL_CAP;
            pushTicker(state, { speaker: 'PLANT', severity: 'CRIT', text: 'The press cooked too long unattended. Max press health capped at 70 for the rest of the shift. It will never fully trust you again.' });
            alive = false;
          }
        }
        break;
      }
      case 'INSPECTION':
      case 'TOD_DISPUTE_WINDOW':
      case 'DRIP': {
        ev.ticksLeft--;
        if (ev.ticksLeft <= 0) {
          alive = false;
          if (ev.kind === 'DRIP') {
            pushTicker(state, { speaker: 'PLANT', text: 'The resin leak has stopped, in the sense that it is now a solid.' });
          }
        }
        break;
      }
    }
    if (alive) keep.push(ev);
  }
  state.events.active = keep;
}

// ---------------------------------------------------------- choice slot ---
export function tickChoices(state) {
  const E = state.events;

  // promote queue → pending; overflow beyond max converts to timeout (spec §9.2)
  while (E.choiceQueue.length > 0 && !E.pendingChoice) {
    E.pendingChoice = E.choiceQueue.shift();
  }
  while (E.choiceQueue.length > BALANCE.EVENTS.CHOICE_QUEUE_MAX) {
    const overflow = E.choiceQueue.pop();
    pushTicker(state, { speaker: 'PLANT', severity: 'WARN', text: 'you were busy. decisions were made in your absence. by physics.' });
    dispatchChoice(state, overflow, overflow.timeoutOption);
  }

  if (E.pendingChoice) {
    E.pendingChoice.timer--;
    if (E.pendingChoice.timer <= 0) {
      const c = E.pendingChoice;
      E.pendingChoice = null;
      pushTicker(state, { speaker: 'PLANT', severity: 'WARN', text: 'No response on the radio. The default option has been exercised. The default option noticed your silence.' });
      dispatchChoice(state, c, c.timeoutOption);
    }
  }
}

function dispatchChoice(state, choice, optionIndex) {
  switch (choice.kind) {
    case 'DAVE_MONOLOGUE': resolveMonologue(state, optionIndex); break;
    case 'TOD_TRADE': resolveTrade(state, choice, optionIndex); break;
    case 'TOD_DISPUTE': resolveDispute(state, optionIndex); break;
    default: resolveIncidentChoice(state, choice, optionIndex); break;
  }
}

// --------------------------------------------------------------- spawns ---
export function spawnIncidents(state) {
  const E = BALANCE.EVENTS;
  // act structure: hours 1–3 tutorial-calm, 4–8 grind, 9–12 siege
  const p = E.INCIDENT_P
    * BALANCE.BREAKDOWN.DIFF[state.meta.difficulty]
    * (1 + (state.meta.tick / BALANCE.TICKS_PER_SHIFT) * E.LATE_SHIFT_RAMP);
  if (chance(state, p)) rollIncident(state);
  // hourly guaranteed roll
  if (state.meta.shiftClock % 60 === 0 && state.meta.shiftClock > 0) rollIncident(state);
}

// -------------------------------------------------------- player actions ---
export function processActions(state, actions) {
  for (const action of actions) applyAction(state, action);
}

function deployBlocked(state, npcKey, machineId) {
  if (state.meta.tick < state.flags.deploymentsLockedUntil) {
    pushTicker(state, { speaker: 'KEVIN', severity: 'WARN', text: "No deployments during Morale Pizza!! everyone's in the break room!! the machines can wait... probably!!!" });
    return true;
  }
  const m = state.plant.machines[machineId];
  if (!m || (m.status !== 'DOWN' && m.status !== 'CHRISED')) return true;
  const npc = state.npcs[npcKey];
  if (npc.status !== 'AVAILABLE') return true;
  return false;
}

function deployCost(state, base, machineId) {
  const m = state.plant.machines[machineId];
  return m.status === 'CHRISED' ? Math.round(base * BALANCE.CHRIS.CHRISED_COST_MULT) : base;
}

export function applyAction(state, action) {
  const R = state.resources;
  const sp = state.spencer;
  const B = BALANCE;

  switch (action.type) {
    case 'BUY_FIBER': {
      const cost = fiberPrice(state);
      if (R.cash < cost || R.woodFiber >= B.CAPS.fiber) return;
      R.cash -= cost;
      state.flags.fiberPurchases++;
      state.events.scheduled.push({
        fireTick: state.meta.tick + B.ECONOMY.FIBER_BUY.delay,
        kind: 'FIBER_DELIVERY', data: { amount: B.ECONOMY.FIBER_BUY.amount },
      });
      pushTicker(state, { speaker: 'SPENCER', text: `[ORDER PLACED] Fiber +25t, ${money(cost)}, ETA 5 min.${state.flags.fiberPurchases > B.ECONOMY.FIBER_BUY.escalateAfter ? ' The spot market is feeling emotional about your buying pattern.' : ''}` });
      break;
    }
    case 'RUSH_FIBER': {
      const cost = rushFiberPrice(state);
      if (R.cash < cost || R.woodFiber >= B.CAPS.fiber) return;
      R.cash -= cost;
      state.flags.fiberPurchases++;
      R.woodFiber = clamp(R.woodFiber + B.ECONOMY.FIBER_BUY.amount, 0, B.CAPS.fiber);
      pushTicker(state, { speaker: 'SPENCER', text: `[RUSH ORDER] Fiber +25t, ${money(cost)}. The truck was already moving. Don't ask why the truck was already moving.` });
      break;
    }
    case 'BUY_RESIN': {
      const cost = resinPrice(state);
      if (R.cash < cost || R.resin >= B.CAPS.resin) return;
      R.cash -= cost;
      state.flags.resinDiscountNext = false;
      R.resin = clamp(R.resin + B.ECONOMY.RESIN_BUY.amount, 0, B.CAPS.resin);
      pushTicker(state, { speaker: 'SPENCER', text: `[ORDER] Resin +6t, ${money(cost)}. The vendor answered on the first ring. Never a good sign, always a good tote.` });
      break;
    }
    case 'CALIBRATE': {
      const C = B.ECONOMY.CALIBRATE;
      if (R.cash < C.cost) return;
      R.cash -= C.cost;
      state.plant.quality = clamp(state.plant.quality + C.qualityGain, 0, 100);
      state.flags.formerPausedUntil = state.meta.tick + C.formerPause;
      pushTicker(state, { speaker: 'SPENCER', text: `[CALIBRATION] Forming line paused 3 min, quality +12, ${money(C.cost)}. The line resents being measured but performs better when watched. Like everyone.` });
      break;
    }
    case 'CLEANUP': {
      const G = B.GLUE;
      if (R.cash < G.CLEANUP_COST) return;
      R.cash -= G.CLEANUP_COST;
      addGlue(state, -G.CLEANUP_AMOUNT);
      state.flags.sanderPausedUntil = state.meta.tick + G.CLEANUP_SANDER_PAUSE;
      state.events.active = state.events.active.filter(e => e.kind !== 'DRIP');
      pushTicker(state, { speaker: 'SPENCER', text: `[CLEANUP CREW] ${money(G.CLEANUP_COST)}, sander down 10 min, glue -25. The crew found a 2019 safety vest in the pile. It is part of the pile's story now.` });
      break;
    }
    case 'PURGE': {
      if (!state.flags.contaminated || R.cash < B.TOD.PURGE_COST) return;
      R.cash -= B.TOD.PURGE_COST;
      state.flags.contaminated = false;
      pushTicker(state, { speaker: 'SPENCER', text: `[PURGE] ${money(B.TOD.PURGE_COST)}. Tod's fiber has been escorted from the system. It did not go quietly. Nothing Tod touches goes quietly.` });
      break;
    }
    case 'COFFEE': {
      addBP(state, 'RELIEF_COFFEE', -B.BP.COFFEE_RELIEF);
      sp.caffeineTimers.push(state.meta.tick + B.BP.CAFFEINE_DECAY_TICKS);
      sp.caffeine = sp.caffeineTimers.length;
      state.stats.coffees++;
      pushTicker(state, {
        speaker: 'SPENCER',
        text: sp.caffeine >= B.BP.CAFFEINE_JITTER_AT
          ? '[COFFEE ' + sp.caffeine + '] The third coffee is always a mistake and your hands know it before you do.'
          : '[COFFEE] Breakroom drip, vintage tonight. BP -10. Worth it.',
      });
      break;
    }
    case 'SCREAM': {
      if (sp.screamCooldown > 0) return;
      addBP(state, 'RELIEF_VENT', -B.BP.SCREAM_RELIEF);
      sp.screamCooldown = B.BP.SCREAM_COOLDOWN;
      state.stats.screams++;
      pushTicker(state, { speaker: 'SPENCER', text: '[RADIO SILENCE]' });
      if (chance(state, B.BP.SCREAM_KEVIN_HEARS_P)) kevinHearsScream(state);
      break;
    }
    case 'DEPLOY': {
      const { npc, machineId } = action;
      if (deployBlocked(state, npc, machineId)) return;
      if (npc === 'terry') {
        const cost = deployCost(state, B.TERRY.COST, machineId);
        if (R.cash < cost) return;
        if (state.plant.machines[machineId].status === 'CHRISED') {
          pushTicker(state, { speaker: 'TERRY', text: 'Terry looked at it. Sighed.' }); // the sigh costs nothing but means everything
        }
        R.cash -= cost;
        deployTerry(state, machineId);
      } else if (npc === 'dave') {
        const cost = deployCost(state, B.DAVE.COST, machineId);
        if (R.cash < cost) return;
        R.cash -= cost;
        deployDave(state, machineId);
      } else if (npc === 'chris') {
        deployChris(state, machineId); // $0*. the asterisk is doing a lot of work.
      }
      break;
    }
    case 'CHOICE': {
      const c = state.events.pendingChoice;
      if (!c) return;
      state.events.pendingChoice = null;
      dispatchChoice(state, c, action.optionIndex);
      break;
    }
  }
}
