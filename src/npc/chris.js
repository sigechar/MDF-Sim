// CHRIS — Maintenance Superintendent. Confident Incompetence (spec §8.2).
// The free repair option that is never free. His confidence only goes up.
// Outcomes do not affect this. That is the entire characterization.
//
// Where is Chris when nothing is broken? Candy Crush. Where is Chris when
// something IS broken? Candy Crush, en route to the wrong panel. His level
// counter and his confidence share one property: they only go up.

import { BALANCE } from '../balance.js';
import { rand, chance, pick } from '../rng.js';
import {
  pushTicker, addBP, addGlue, addQuality, setHealth, adjacentMachines,
} from '../util.js';

const DEPLOY_LINES = [
  label => `Chris has been deployed to the ${label}. Cost: $0*. He says it "sounds like a five-minute job." ETA: not five minutes.`,
  label => `Chris is heading to the ${label}. He has brought the wrong toolbox with total conviction.`,
  label => `Chris is en route to the ${label}. He diagnosed it from the shop, by ear, over the sound of Candy Crush.`,
  label => `Chris accepts the ${label} assignment. "I've seen this before." He has. He caused it. Different plant, same Chris.`,
  label => `Chris is walking to the ${label}, watching a YouTube repair video for a different machine. "Same principles."`,
];

const MIDLEVEL_LINES = [
  (label, lvl) => `Chris has been paged about the ${label}. Chris is two moves from clearing the jelly on level ${lvl}. Chris will finish the level.`,
  (label, lvl) => `Chris acknowledges the ${label}. "One sec." The sec is a boss level. Level ${lvl} does not pause for industry.`,
  (label, lvl) => `The ${label} page reached Chris mid-combo on level ${lvl}. He gave the radio a thumbs-up it could not see.`,
];

const ONSITE_LINES = [
  'Chris is on site. A panel has been opened. It was not the relevant panel, but momentum has been established.',
  'Chris is on site. He has identified the problem as "in there somewhere," gesturing at the entire machine.',
  'Chris is on site. He is reading the wiring diagram upside down and calling it "a fresh perspective."',
  'Chris is on site. He asked the machine "who did this to you." The machine did not answer. He nodded anyway.',
];

const CANDY_PAUSE_LINES = [
  lvl => `Repair paused. Chris is one life away from level ${lvl}. "This is also problem-solving," he says, from the floor, sitting on the part.`,
  lvl => `Chris has stopped mid-repair to harvest his daily Candy Crush bonus. The bolt can wait. The bonus cannot. Level ${lvl} awaits.`,
];

const FIXED_LINES = [
  label => `${label} is back. "Good enough is the enemy of done, and I've beaten them both."`,
  label => `${label} is running. Chris doesn't know which of the things he did was the one that worked, and he is at peace with that.`,
  label => `${label} fixed. Chris took a photo of it "for his records." His records are a camera roll of Candy Crush victories and one machine.`,
];

const FIXEDISH_LINES = [
  label => `${label} is running. Differently. "She's got a new personality now." The personality is worse.`,
  label => `${label} is technically running. Three bolts are left over. Chris pocketed them "for later." There is no later for bolts.`,
  label => `${label} runs, with a new noise. Chris has named the noise. The noise is named Gary. Gary is load-bearing now.`,
];

const SECONDARY_LINES = [
  (label, victim) => `${label} fixed. However, the ${victim} has experienced a disassembly event. "In fairness, that valve was a design flaw waiting to happen."`,
  (label, victim) => `${label} fixed. The ${victim} immediately stopped, in what Chris is calling "solidarity." Machines do not have solidarity. They have Chris.`,
  (label, victim) => `${label} fixed. Unrelated — and Chris stresses, UNRELATED — the ${victim} needs "a quick look" now. It needed nothing an hour ago.`,
];

const CATASTROFIX_LINES = [
  label => `The ${label} repair has become a different, larger repair. Chris has begun a whiteboard session on why this proves his original diagnosis. Attendance was described as "encouraged."`,
  label => `The ${label} is worse now. Chris called it "a known issue," which is true, in that he is known, and he is the issue. Whiteboard session convening.`,
  label => `The ${label} has stopped in a new way that impressed even Dave. Chris is drawing a fishbone diagram. The fish is also wrong.`,
];

const WHITEBOARD_LINES = [
  'The whiteboard session has concluded. Root cause was identified as "the machine."',
  'The whiteboard session has concluded. The diagram was a circle with an arrow pointing at the circle.',
  'The whiteboard session has concluded. Action item: "monitor." Assigned to: everyone. Due: ongoing.',
];

export function deployChris(state, machineId) {
  const c = state.npcs.chris;
  const m = state.plant.machines[machineId];
  const label = BALANCE.MACHINES[machineId].label;
  c.status = 'EN_ROUTE';
  c.target = machineId;
  c.candyPauses = 0;
  // 3 ticks of walking + 40 × (1 + roll(0..0.5)) ticks of "helping"
  c.etaTicks = BALANCE.CHRIS.EN_ROUTE_TICKS
    + Math.round(BALANCE.CHRIS.BASE_REPAIR_TICKS * (1 + rand(state) * 0.5));
  state.stats.chrisDeployments++;
  // Was he mid-level when you called? (He was. The roll decides if it matters.)
  if (chance(state, BALANCE.CHRIS.CANDY.MID_LEVEL_P)) {
    c.etaTicks += BALANCE.CHRIS.CANDY.MID_LEVEL_DELAY;
    pushTicker(state, { speaker: 'CHRIS', text: pick(state, MIDLEVEL_LINES)(label, c.candyLevel ?? BALANCE.CHRIS.CANDY.START_LEVEL) });
  } else {
    pushTicker(state, { speaker: 'CHRIS', text: pick(state, DEPLOY_LINES)(label) });
  }
  m.status = 'REPAIRING';
  m.assignedNpc = 'chris';
  m.repairEta = c.etaTicks;
}

export function tickChris(state) {
  const c = state.npcs.chris;
  const CANDY = BALANCE.CHRIS.CANDY;

  if (c.status === 'EXPLAINING') {
    c.etaTicks--;
    if (c.etaTicks <= 0) {
      c.status = 'AVAILABLE';
      pushTicker(state, { speaker: 'CHRIS', text: pick(state, WHITEBOARD_LINES) });
    }
    return;
  }

  if (c.status === 'AVAILABLE') {
    // Idle Chris grinds Candy Crush in the shop. The counter, like his
    // confidence, is monotonically non-decreasing. Unlike the plant.
    if (state.meta.tick > 0 && state.meta.tick % CANDY.LEVEL_TICKS === 0) {
      c.candyLevel = (c.candyLevel ?? CANDY.START_LEVEL) + 1;
      if (c.candyLevel % CANDY.MILESTONE === 0) {
        pushTicker(state, { speaker: 'CHRIS', text: `Chris has cleared Candy Crush level ${c.candyLevel}. He announced it to the shop. The shop was empty. He announced it again.` });
      }
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
      pushTicker(state, { speaker: 'CHRIS', text: pick(state, ONSITE_LINES) });
    }
  } else {
    // Ambient dread while Chris is "helping" (spec §7.2)
    addBP(state, 'STRESS_CHRIS_HELPING', BALANCE.CHRIS.AURA_BP);
    // The phone is in the breast pocket. The phone is winning.
    if ((c.candyPauses ?? 0) < CANDY.PAUSE_MAX && chance(state, CANDY.PAUSE_P)) {
      c.candyPauses = (c.candyPauses ?? 0) + 1;
      c.candyLevel = (c.candyLevel ?? CANDY.START_LEVEL) + 1;
      c.etaTicks += CANDY.PAUSE_DELAY;
      m.repairEta = c.etaTicks;
      pushTicker(state, { speaker: 'CHRIS', severity: 'WARN', text: pick(state, CANDY_PAUSE_LINES)(c.candyLevel) });
    }
  }

  if (c.etaTicks <= 0) resolveIntervention(state);
}

function resolveIntervention(state) {
  const c = state.npcs.chris;
  const m = state.plant.machines[c.target];
  const label = BALANCE.MACHINES[m.id].label;
  const roll = rand(state);
  const O = BALANCE.CHRIS.OUTCOMES;

  m.assignedNpc = null;
  m.repairEta = null;
  addGlue(state, BALANCE.CHRIS.GLUE_PER_INTERVENTION); // he doesn't clean up. cleanup is "a culture problem."

  if (roll < O.FIXED) {
    m.status = 'RUNNING';
    setHealth(state, m, BALANCE.CHRIS.FIXED_HEALTH);
    addBP(state, 'RELIEF_SMALL_VICTORY', -BALANCE.BP.SMALL_VICTORY);
    pushTicker(state, { speaker: 'CHRIS', text: pick(state, FIXED_LINES)(label) });
  } else if (roll < O.FIXED + O.FIXEDISH) {
    m.status = 'DEGRADED';
    setHealth(state, m, BALANCE.CHRIS.FIXEDISH_HEALTH);
    m.throughputMod = Math.max(0.5, m.throughputMod - BALANCE.CHRIS.FIXEDISH_TP_LOSS);
    pushTicker(state, { speaker: 'CHRIS', severity: 'WARN', text: pick(state, FIXEDISH_LINES)(label) });
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
      text: pick(state, SECONDARY_LINES)(label, BALANCE.MACHINES[victimId].label),
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
      text: pick(state, CATASTROFIX_LINES)(label),
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
