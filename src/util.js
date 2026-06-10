import { BALANCE } from './balance.js';
import { rand, chance } from './rng.js';

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function clockString(shiftClock) {
  const total = (18 * 60 + shiftClock) % 1440;
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// ---------------------------------------------------------------- ticker ---
// Every state-changing system writes here (spec §9.3). The ticker is the
// black box recorder: a player reading only this should be able to
// reconstruct the run.
export function pushTicker(state, { channel = 'RADIO', speaker = null, text, severity = 'INFO' }) {
  // RED zone: Spencer's perception occasionally renders ALL CAPS (spec §7.5)
  if (state.spencer.bp >= BALANCE.BP.RED && severity !== 'CRIT' && chance(state, BALANCE.BP.ALLCAPS_P)) {
    text = text.toUpperCase();
  }
  state.events.log.push({ tick: state.meta.tick, channel, speaker, text, severity });
  if (state.events.log.length > 200) state.events.log.shift();
}

// -------------------------------------------------------- blood pressure ---
// Canonical stress/relief application. Positive = stress, negative = relief.
// All NPC dysfunction terminates here (spec §7).
export function addBP(state, id, amount) {
  if (amount > 0 && state.spencer.caffeine >= BALANCE.BP.CAFFEINE_JITTER_AT) {
    amount *= BALANCE.BP.CAFFEINE_STRESS_MULT; // vibrating is not calm
  }
  state.spencer.bp = clamp(state.spencer.bp + amount, BALANCE.CAPS.bpFloor, BALANCE.CAPS.bp);
  state.stats.bpLedger[id] = (state.stats.bpLedger[id] || 0) + amount;
}

// ----------------------------------------------------------------- glue ----
export function addGlue(state, amount) {
  state.plant.gluePileup = clamp(state.plant.gluePileup + amount, 0, 120);
}

export function addQuality(state, amount) {
  state.plant.quality = clamp(state.plant.quality + amount, 0, 100);
}

// --------------------------------------------------------------- alarms ----
// Alarms are DERIVED from state every tick so the HMI can never lie (P2).
export function deriveAlarms(state) {
  const alarms = [];
  for (const id of BALANCE.CHAIN) {
    const m = state.plant.machines[id];
    if (m.status === 'DOWN' || m.status === 'CHRISED') {
      alarms.push({ id: `DOWN_${id}`, machineId: id, severity: 'HIGH', text: `${BALANCE.MACHINES[id].label} DOWN` });
    }
  }
  if (state.flags.contaminated) {
    alarms.push({ id: 'CONTAMINATION', severity: 'MEDIUM', text: 'FIBER CONTAMINATION — PURGE REQUIRED' });
  }
  if (state.plant.gluePileup >= BALANCE.GLUE.WARN_AT) {
    alarms.push({ id: 'GLUE', severity: 'MEDIUM', text: 'HOUSEKEEPING: RESIN ACCUMULATION' });
  }
  if (state.events.active.some(e => e.kind === 'PRESS_THERMAL')) {
    alarms.push({ id: 'THERMAL', machineId: 'PRESS', severity: 'HIGH', text: 'PRESS THERMAL EVENT' });
  }
  alarms.sort((a, b) => (a.severity === 'HIGH' ? -1 : 1) - (b.severity === 'HIGH' ? -1 : 1));
  state.plant.alarms = alarms;
  return alarms;
}

export function highAlarmCount(state) {
  return state.plant.alarms.filter(a => a.severity === 'HIGH').length;
}

// Composite uptime, recomputed from machine states (spec §5.4)
const STATUS_FACTOR = { RUNNING: 1.0, DEGRADED: 0.6, REPAIRING: 0.25, DOWN: 0.0, CHRISED: 0.0 };
export function computeUptime(state) {
  let u = 0;
  for (const id of BALANCE.CHAIN) {
    u += BALANCE.MACHINES[id].weight * STATUS_FACTOR[state.plant.machines[id].status];
  }
  state.plant.uptime = Math.round(u * 100);
  return state.plant.uptime;
}

// Is there an active crisis that demands a superintendent? (Kevin is gone.)
export function authorityCrisisActive(state) {
  return state.events.active.some(e => e.requiresAuthority)
    || (state.events.pendingChoice && state.events.pendingChoice.requiresAuthority);
}

// The Hiding Tax (spec §8.1): penalties during authority crises are marked up
// when Kevin is HIDING. He will always be HIDING, because the crisis is what
// sent him there. Acceptance test 3 counts the (theoretical) violations.
export function kevinMarkup(state) {
  if (state.npcs.kevin.status === 'HIDING') return BALANCE.KEVIN.ABSENTEE_MULT;
  state.stats.kevinCowardiceViolations++;
  return 1;
}

// ----------------------------------------------------------- scheduling ----
export function schedule(state, fireTick, kind, data = {}) {
  state.events.scheduled.push({ fireTick, kind, data });
}

// Choice events queue here; the event engine promotes them (spec §9.2).
export function openChoice(state, choice) {
  if (state.spencer.bp >= BALANCE.BP.RED) {
    choice.timerTicks = Math.ceil(choice.timerTicks * BALANCE.BP.RED_TIMER_MULT);
  }
  choice.timer = choice.timerTicks;
  state.events.choiceQueue.push(choice);
}

// Health setter that respects the press thermal cap (spec §14.2)
export function setHealth(state, machine, value) {
  const cap = machine.id === 'PRESS' ? (state.flags.pressHealthCap ?? 100) : 100;
  machine.health = clamp(value, 0, cap);
}

export function adjacentMachines(id) {
  const i = BALANCE.CHAIN.indexOf(id);
  const out = [];
  if (i > 0) out.push(BALANCE.CHAIN[i - 1]);
  if (i < BALANCE.CHAIN.length - 1) out.push(BALANCE.CHAIN[i + 1]);
  return out;
}

export function money(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}
