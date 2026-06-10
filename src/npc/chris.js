// CHRIS — Maintenance Superintendent. Confident Incompetence (spec §8.2).
// The free repair option that is never free. His confidence only goes up.
// Outcomes do not affect this. That is the entire characterization.

import { BALANCE } from '../balance.js';
import { rand, pick } from '../rng.js';
import {
  pushTicker, addBP, addGlue, addQuality, setHealth, adjacentMachines,
} from '../util.js';

export function deployChris(state, machineId) {
  const c = state.npcs.chris;
  const m = state.plant.machines[machineId];
  c.status = 'EN_ROUTE';
  c.target = machineId;
  // 3 ticks of walking + 40 × (1 + roll(0..0.5)) ticks of "helping"
  c.etaTicks = BALANCE.CHRIS.EN_ROUTE_TICKS
    + Math.round(BALANCE.CHRIS.BASE_REPAIR_TICKS * (1 + rand(state) * 0.5));
  m.status = 'REPAIRING';
  m.assignedNpc = 'chris';
  m.repairEta = c.etaTicks;
  state.stats.chrisDeployments++;
  pushTicker(state, {
    speaker: 'CHRIS',
    text: `Chris has been deployed to the ${BALANCE.MACHINES[machineId].label}. Cost: $0*. He says it "sounds like a five-minute job." ETA: not five minutes.`,
  });
}

export function tickChris(state) {
  const c = state.npcs.chris;

  if (c.status === 'EXPLAINING') {
    c.etaTicks--;
    if (c.etaTicks <= 0) {
      c.status = 'AVAILABLE';
      pushTicker(state, { speaker: 'CHRIS', text: 'The whiteboard session has concluded. Root cause was identified as "the machine."' });
    }
    return;
  }
  if (c.status !== 'EN_ROUTE' && c.status !== 'ON_SITE') return;

  const m = state.plant.machines[c.target];
  c.etaTicks--;
  m.repairEta = Math.max(0, c.etaTicks);

  if (c.status === 'EN_ROUTE') {
    c.walkTicks = (c.walkTicks ?? BALANCE.CHRIS.EN_ROUTE_TICKS) - 1;
    if (c.walkTicks <= 0) {
      c.status = 'ON_SITE';
      c.walkTicks = null;
      pushTicker(state, { speaker: 'CHRIS', text: `Chris is on site. A panel has been opened. It was not the relevant panel, but momentum has been established.` });
    }
  } else {
    // Ambient dread while Chris is "helping" (spec §7.2)
    addBP(state, 'STRESS_CHRIS_HELPING', BALANCE.CHRIS.AURA_BP);
  }

  if (c.etaTicks <= 0) resolveIntervention(state);
}

function resolveIntervention(state) {
  const c = state.npcs.chris;
  const m = state.plant.machines[c.target];
  const roll = rand(state);
  const O = BALANCE.CHRIS.OUTCOMES;

  m.assignedNpc = null;
  m.repairEta = null;
  addGlue(state, BALANCE.CHRIS.GLUE_PER_INTERVENTION); // he doesn't clean up. cleanup is "a culture problem."

  if (roll < O.FIXED) {
    m.status = 'RUNNING';
    setHealth(state, m, BALANCE.CHRIS.FIXED_HEALTH);
    addBP(state, 'RELIEF_SMALL_VICTORY', -BALANCE.BP.SMALL_VICTORY);
    pushTicker(state, { speaker: 'CHRIS', text: `${BALANCE.MACHINES[m.id].label} is back. "Good enough is the enemy of done, and I've beaten them both."` });
  } else if (roll < O.FIXED + O.FIXEDISH) {
    m.status = 'DEGRADED';
    setHealth(state, m, BALANCE.CHRIS.FIXEDISH_HEALTH);
    m.throughputMod = Math.max(0.5, m.throughputMod - BALANCE.CHRIS.FIXEDISH_TP_LOSS);
    pushTicker(state, { speaker: 'CHRIS', severity: 'WARN', text: `${BALANCE.MACHINES[m.id].label} is running. Differently. "She's got a new personality now." The personality is worse.` });
  } else if (roll < O.FIXED + O.FIXEDISH + O.SECONDARY) {
    // Secondary failure: the target lives, a neighbor pays (spec §8.2)
    m.status = 'RUNNING';
    setHealth(state, m, BALANCE.CHRIS.SECONDARY_HEALTH);
    const victimId = pick(state, adjacentMachines(m.id));
    chrisify(state, victimId);
    addBP(state, 'STRESS_CHRISED', BALANCE.STRESS.CHRISED);
    state.stats.chrisSecondaryFailures++;
    pushTicker(state, {
      speaker: 'CHRIS', severity: 'CRIT',
      text: `${BALANCE.MACHINES[m.id].label} fixed. However, the ${BALANCE.MACHINES[victimId].label} has experienced a disassembly event. "In fairness, that valve was a design flaw waiting to happen."`,
    });
  } else {
    // Catastrofix: the target is now worse, and so is the truth
    chrisify(state, m.id);
    addQuality(state, -BALANCE.CHRIS.CATASTROFIX_QUALITY);
    addBP(state, 'STRESS_CHRISED', BALANCE.STRESS.CHRISED);
    c.status = 'EXPLAINING';
    c.etaTicks = BALANCE.CHRIS.EXPLAINING_TICKS;
    c.target = null;
    bumpConfidence(state);
    pushTicker(state, {
      speaker: 'CHRIS', severity: 'CRIT',
      text: `The repair has become a different, larger repair. Chris has begun a whiteboard session on why this proves his original diagnosis. Attendance was described as "encouraged."`,
    });
    return;
  }
  c.status = 'AVAILABLE';
  c.target = null;
  bumpConfidence(state);
}

function bumpConfidence(state) {
  const c = state.npcs.chris;
  const before = c.confidenceLevel;
  c.confidenceLevel = Math.min(100, c.confidenceLevel + BALANCE.CHRIS.CONFIDENCE_PER_OUTCOME);
  // Acceptance test 5: confidence is monotonically non-decreasing
  state.stats.minChrisConfidenceDelta = Math.min(
    state.stats.minChrisConfidenceDelta, c.confidenceLevel - before
  );
}

// A machine taken DOWN by Chris specifically. Repair cost ×1.5; flavor mandatory.
export function chrisify(state, machineId) {
  const m = state.plant.machines[machineId];
  // If someone was mid-repair on the victim, they are interrupted.
  if (m.assignedNpc === 'dave') {
    const d = state.npcs.dave;
    d.status = 'AVAILABLE';
    d.target = null;
    pushTicker(state, { speaker: 'DAVE', severity: 'WARN', text: `Dave, mid-repair: "He did that ON PURPOSE. Or worse — by accident. 'They' love guys like him."` });
  }
  m.status = 'CHRISED';
  m.health = 0;
  m.assignedNpc = null;
  m.repairEta = null;
  m.flavor = 'chrised';
}
