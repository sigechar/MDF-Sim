// Headless balance harness (spec §15.2 #7).
// Usage: node sim/headless.js [--runs N] [--bot optimal|naive] [--seed S] [--verbose]

import { createInitialState } from '../src/state.js';
import { tickGame } from '../src/engine/tick.js';
import { BALANCE } from '../src/balance.js';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}
const RUNS = parseInt(arg('runs', '200'), 10);
const BOT = arg('bot', 'optimal');
const BASE_SEED = parseInt(arg('seed', '1000'), 10);
const VERBOSE = args.includes('--verbose');

// ----------------------------------------------------------------- bots ---
// Bots inspect state and emit actions, exactly like a player would.

function naiveBot(state) {
  // "always Chris, always agree, always trade" — the cautionary tale
  const actions = [];
  if (state.events.pendingChoice) actions.push({ type: 'CHOICE', optionIndex: 0 });
  if (state.npcs.chris.status === 'AVAILABLE') {
    const broken = Object.values(state.plant.machines).find(m => m.status === 'DOWN' || m.status === 'CHRISED');
    if (broken) actions.push({ type: 'DEPLOY', npc: 'chris', machineId: broken.id });
  }
  if (state.resources.woodFiber < 10) actions.push({ type: 'BUY_FIBER' });
  if (state.resources.resin < 1) actions.push({ type: 'BUY_RESIN' });
  return actions;
}

function optimalBot(state) {
  const actions = [];
  const R = state.resources;
  const machinesDown = BALANCE.CHAIN
    .map(id => state.plant.machines[id])
    .filter(m => m.status === 'DOWN' || m.status === 'CHRISED');

  // choices: decline Tod, pay the dispute, manage Dave's trust, pay for leaks
  const c = state.events.pendingChoice;
  if (c) {
    let idx = 1;
    if (c.kind === 'TOD_TRADE') idx = 1;
    else if (c.kind === 'TOD_DISPUTE') idx = 0;
    else if (c.kind === 'DAVE_MONOLOGUE') {
      // disagree only when it won't trigger a strike
      idx = state.npcs.dave.trustInSpencer - BALANCE.DAVE.DISAGREE_TRUST >= BALANCE.DAVE.STRIKE_BELOW_TRUST ? 1 : 0;
    } else if (c.kind === 'RESIN_LEAK') idx = 0;
    else if (c.kind === 'VENDOR_CALL') idx = 0;
    else if (c.kind === 'CHRIS_VOLUNTEERS') idx = 0; // +3 BP is the cheapest repair Chris offers
    actions.push({ type: 'CHOICE', optionIndex: idx });
  }

  // repairs: Terry for the press and chrised wrecks, Dave for the rest, never Chris
  if (machinesDown.length > 0) {
    const priority = [...machinesDown].sort((a, b) =>
      (b.id === 'PRESS' ? 1 : 0) - (a.id === 'PRESS' ? 1 : 0));
    const target = priority[0];
    const terry = state.npcs.terry;
    const dave = state.npcs.dave;
    const wantTerry = target.id === 'PRESS' || target.status === 'CHRISED' || machinesDown.length >= 2;
    if (terry.status === 'AVAILABLE' && wantTerry && R.cash > 2000) {
      actions.push({ type: 'DEPLOY', npc: 'terry', machineId: target.id });
    } else if (dave.status === 'AVAILABLE' && R.cash > 1500) {
      actions.push({ type: 'DEPLOY', npc: 'dave', machineId: target.id });
    } else if (terry.status === 'AVAILABLE' && R.cash > 2000) {
      actions.push({ type: 'DEPLOY', npc: 'terry', machineId: target.id });
    }
  }

  // logistics
  if (R.woodFiber < 30 && R.cash > 8000) actions.push({ type: 'BUY_FIBER' });
  if (R.woodFiber < 8 && R.cash > 8000) actions.push({ type: 'RUSH_FIBER' });
  if (R.resin < 4 && R.cash > 9000) actions.push({ type: 'BUY_RESIN' });

  // plant care
  if (state.flags.contaminated && R.cash > 3000) actions.push({ type: 'PURGE' });
  if (state.plant.quality < 62 && R.cash > 3000) actions.push({ type: 'CALIBRATE' });
  if (state.plant.gluePileup > 55 && R.cash > 4000) actions.push({ type: 'CLEANUP' });

  // self care, such as it is
  const bp = state.spencer.bp;
  if (bp > 165 && state.spencer.caffeine < 2) actions.push({ type: 'COFFEE' });
  if (bp > 185 && state.spencer.screamCooldown === 0) actions.push({ type: 'SCREAM' });

  return actions;
}

const BOTS = { optimal: optimalBot, naive: naiveBot };

// ------------------------------------------------------------------ run ---
export function runShift(seed, botName, difficulty = 'SHIFT_LEADER') {
  const bot = BOTS[botName];
  const state = createInitialState(seed, difficulty);
  let guard = 0;
  while (!state.meta.gameOver && guard++ < BALANCE.TICKS_PER_SHIFT + 10) {
    tickGame(state, bot(state));
  }
  return state;
}

function main() {
  const endings = {};
  let wins = 0;
  let totalBoards = 0;
  let redTicks = 0;
  let cowardiceViolations = 0;
  let confidenceViolations = 0;

  for (let i = 0; i < RUNS; i++) {
    const s = runShift(BASE_SEED + i, BOT);
    const id = s.meta.gameOver.endingId;
    endings[id] = (endings[id] || 0) + 1;
    if (s.meta.gameOver.win) {
      wins++;
      redTicks += s.stats.ticksInRed / s.meta.tick;
    }
    totalBoards += s.resources.boardsProduced;
    cowardiceViolations += s.stats.kevinCowardiceViolations;
    if (s.stats.minChrisConfidenceDelta < 0) confidenceViolations++;
    if (VERBOSE) {
      console.log(`seed ${BASE_SEED + i}: ${id} | boards ${s.resources.boardsProduced.toFixed(0)} | cash ${s.resources.cash.toFixed(0)} | peakBP ${s.stats.peakBP.toFixed(0)} | glue ${s.plant.gluePileup.toFixed(0)} | puns ${s.stats.punsEndured}`);
    }
  }

  console.log(`\n=== MDF-SIM headless harness ===`);
  console.log(`bot: ${BOT} | runs: ${RUNS} | base seed: ${BASE_SEED}`);
  console.log(`win rate: ${((wins / RUNS) * 100).toFixed(1)}%`);
  console.log(`avg boards: ${(totalBoards / RUNS).toFixed(1)} msf (target ${BALANCE.TARGETS.SHIFT_LEADER})`);
  if (wins > 0) console.log(`avg time-in-RED on wins: ${((redTicks / wins) * 100).toFixed(1)}%`);
  console.log(`loss-vector histogram:`, endings);
  console.log(`kevin cowardice violations (must be 0): ${cowardiceViolations}`);
  console.log(`chris confidence violations (must be 0): ${confidenceViolations}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
