// Production, degradation, breakdowns, quality drift, and the Doom Meter.
// Spec §5 and §6. The plant could run fine; the people prevent it.

import { BALANCE } from '../balance.js';
import { chance, pick } from '../rng.js';
import {
  pushTicker, addBP, addGlue, addQuality, clamp, adjacentMachines,
} from '../util.js';
import { DEGRADED_FLAVOR, BREAKDOWN_LINES } from '../content/flavor.js';

export function runProduction(state) {
  produce(state);
  degrade(state);
  rollBreakdowns(state);
  driftQuality(state);
  accumulateGlue(state);
}

function chainAlive(state) {
  const flowing = BALANCE.CHAIN.every(id => {
    const s = state.plant.machines[id].status;
    return s === 'RUNNING' || s === 'DEGRADED';
  });
  // Player-initiated station pauses (calibration, cleanup crew) also stall the chain
  return flowing
    && state.meta.tick >= state.flags.formerPausedUntil
    && state.meta.tick >= state.flags.sanderPausedUntil;
}

function produce(state) {
  if (!chainAlive(state)) return;

  const P = BALANCE.PRODUCTION;
  let rawRate = P.BASE_RATE;
  for (const id of BALANCE.CHAIN) {
    const m = state.plant.machines[id];
    rawRate *= m.throughputMod * (m.status === 'DEGRADED' ? BALANCE.MACHINES[id].degradedTp : 1);
  }
  if (state.meta.tick < state.npcs.dave.boostUntil) rawRate *= BALANCE.DAVE.BOOST_RATE;

  const fiberDraw = rawRate * P.FIBER_PER_M3;
  const resinDraw = rawRate * P.RESIN_PER_M3;
  if (state.resources.woodFiber < fiberDraw || state.resources.resin < resinDraw) {
    addBP(state, 'STRESS_STARVED', BALANCE.STRESS.STARVED);
    if (state.meta.tick % 15 === 0) {
      pushTicker(state, { speaker: 'PLANT', severity: 'WARN', text: 'FORMER RUNNING ON FUMES — feedstock starvation. The silo echoes when you knock on it. Don\'t knock on it.' });
    }
    return;
  }

  state.resources.woodFiber -= fiberDraw;
  state.resources.resin -= resinDraw;

  const qualityGate = clamp(state.plant.quality / 100, 0, 1);
  const saleable = rawRate * qualityGate;
  state.resources.boardsProduced += saleable;
  state.resources.boardsScrapped += rawRate - saleable;
  // Corporate "live invoicing pilot program" — the one initiative that
  // accidentally works (spec §6.1)
  state.resources.cash += saleable * P.BOARD_PRICE;
}

function degrade(state) {
  for (const id of BALANCE.CHAIN) {
    const m = state.plant.machines[id];
    if (m.status !== 'RUNNING' && m.status !== 'DEGRADED') continue;

    let wear = BALANCE.MACHINES[id].wear;
    if (m.status === 'DEGRADED') wear *= BALANCE.BREAKDOWN.DEGRADED_WEAR_MOD;
    if (id === 'SANDER' && state.meta.tick < state.flags.sanderWearBoostUntil) {
      wear *= BALANCE.TOD.SANDER_WEAR_BOOST; // Tod's wet fiber, chewing the belt
    }
    if (id === 'PRESS' && state.meta.tick < state.flags.pressWearPausedUntil) {
      wear = 0; // C-Crew is "covering" it. (They are adjusting the settings.)
    }
    m.health = Math.max(0, m.health - wear);

    if (m.health <= 0) {
      breakMachine(state, m);
    } else if (m.health < BALANCE.DEGRADED_AT && m.status === 'RUNNING') {
      m.status = 'DEGRADED';
      m.flavor = DEGRADED_FLAVOR[id];
      pushTicker(state, {
        speaker: 'PLANT', severity: 'WARN',
        text: `${BALANCE.MACHINES[id].label} is DEGRADED — currently ${m.flavor}.`,
      });
    }
  }
}

function rollBreakdowns(state) {
  const chris = state.npcs.chris;
  const daveBoost = state.meta.tick < state.npcs.dave.boostUntil;
  for (const id of BALANCE.CHAIN) {
    const m = state.plant.machines[id];
    if (m.status !== 'RUNNING' && m.status !== 'DEGRADED') continue;

    let p = BALANCE.BREAKDOWN.BASE
      * (2.0 - m.health / 100)
      * (m.status === 'DEGRADED' ? BALANCE.BREAKDOWN.DEGRADED_MOD : 1)
      * BALANCE.BREAKDOWN.DIFF[state.meta.difficulty];
    if (chris.status === 'ON_SITE' && adjacentMachines(chris.target).includes(id)) {
      p *= BALANCE.BREAKDOWN.CHRIS_AURA; // he borrows their parts. he does not log this.
    }
    if (daveBoost) p *= BALANCE.BREAKDOWN.DAVE_BOOST; // forum torque specs

    if (chance(state, p)) breakMachine(state, m);
  }
}

export function breakMachine(state, m) {
  m.status = 'DOWN';
  m.health = 0;
  m.repairEta = null;
  m.flavor = 'down';
  state.stats.breakdowns++;
  const dmg = m.id === 'PRESS' ? BALANCE.STRESS.BREAKDOWN_PRESS : BALANCE.STRESS.BREAKDOWN;
  addBP(state, 'STRESS_BREAKDOWN', dmg);
  pushTicker(state, { channel: 'ALARM', speaker: 'PLANT', severity: 'CRIT', text: pick(state, BREAKDOWN_LINES[m.id]) });
}

function driftQuality(state) {
  let delta = -BALANCE.PRODUCTION.QUALITY_DRIFT; // natural entropy
  if (state.flags.contaminated) delta -= BALANCE.PRODUCTION.CONTAMINATION_DRIFT;
  if (state.meta.tick < state.npcs.dave.boostUntil) delta += BALANCE.DAVE.BOOST_QUALITY;
  addQuality(state, delta);
}

function accumulateGlue(state) {
  const g = BALANCE.GLUE;
  let delta = g.BASELINE; // entropy, but sticky
  const b = state.plant.machines.BLENDER.status;
  if (b === 'DOWN' || b === 'CHRISED') delta += g.BLENDER_DOWN;
  if (state.events.active.some(e => e.kind === 'DRIP')) delta += g.DRIP_PER_TICK;
  addGlue(state, delta);

  // Escalation ticker series (spec §14.4) — each fires exactly once
  const milestones = [
    [70, 'housekeeping note: the floor near the blender is now "tacky." like a dance floor. a bad one.', 'WARN', 'RADIO'],
    [80, 'a forklift is parked by the blender. the forklift has been parked by the blender for a while. the forklift may now BE part of the blender.', 'WARN', 'RADIO'],
    [90, 'the door to the resin room opens at a new angle. the angle is "partially."', 'CRIT', 'ALARM'],
    [95, 'maintenance requests everyone stop describing the plant as "one big board." it is, at present, accurate, and morale-sensitive.', 'CRIT', 'ALARM'],
  ];
  for (const [threshold, text, severity, channel] of milestones) {
    if (state.plant.gluePileup >= threshold && !state.flags.glueWarningsSent[threshold]) {
      state.flags.glueWarningsSent[threshold] = true;
      pushTicker(state, { channel, speaker: 'PLANT', severity, text });
    }
  }
}
