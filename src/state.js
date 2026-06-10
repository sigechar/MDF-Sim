import { BALANCE } from './balance.js';
import { schedule } from './util.js';
import { randInt } from './rng.js';

export function createInitialState(seed, difficulty = 'SHIFT_LEADER') {
  const machines = {};
  // The day shift left things in a "condition." Healths are staggered so the
  // early shift has texture instead of a grace period.
  const startHealth = { REFINER: 82, BLENDER: 88, FORMER: 91, PRESS: 74, COOLER: 95, SANDER: 86 };
  for (const id of BALANCE.CHAIN) {
    machines[id] = {
      id,
      status: 'RUNNING',
      health: startHealth[id],
      throughputMod: 1.0,
      repairEta: null,
      assignedNpc: null,
      flavor: 'nominal',
    };
  }

  const state = {
    meta: {
      seed,
      rngState: seed >>> 0,
      tick: 0,
      shiftClock: 0,
      difficulty,
      gameOver: null,
    },
    resources: {
      cash: BALANCE.START.cash,
      woodFiber: BALANCE.START.fiber,
      resin: BALANCE.START.resin,
      boardsProduced: 0,
      boardsScrapped: 0,
    },
    plant: {
      uptime: 100,
      quality: BALANCE.START.quality,
      machines,
      alarms: [],
      gluePileup: 8, // the day shift "was going to get to it"
    },
    spencer: {
      bp: BALANCE.START.bp,
      bpTrend: 0,
      caffeine: 0,
      caffeineTimers: [],
      screamCooldown: 0,
      quietTicks: 0,
      breakdownWarnings: 0,
    },
    npcs: {
      kevin: {
        status: 'ROAMING', punCooldown: 20, approachTicks: 0, calmTicks: 0,
        funTicks: 0, punsDeliveredThisShift: 0, ambushBoostTicks: 0, punIndex: -1,
      },
      chris: {
        status: 'AVAILABLE', target: null, etaTicks: 0,
        confidenceLevel: BALANCE.CHRIS.CONFIDENCE_START,
      },
      terry: {
        status: 'AVAILABLE', stamina: 100, breakTicksRemaining: 0,
        breaksTaken: 0, fixesThisShift: 0,
      },
      dave: {
        status: 'AVAILABLE', target: null, etaTicks: 0,
        trustInSpencer: BALANCE.DAVE.TRUST_START,
        strikeTicksRemaining: 0, boostUntil: 0, sulkUntil: 0,
        theoriesEndorsedByManagement: 0,
      },
      tod: {
        nextPitchTick: randIntSeedless(seed, 40, 70),
        pitchesMade: 0, scamsExecuted: 0, scamsSurvived: 0, grudge: false,
      },
    },
    events: {
      active: [],
      pendingChoice: null,
      choiceQueue: [],
      scheduled: [],
      log: [],
      lastPun: null,
    },
    flags: {
      contaminated: false,
      sanderWearBoostUntil: 0,
      pressWearPausedUntil: 0,
      pressHealthCap: null,
      formerPausedUntil: 0,
      sanderPausedUntil: 0,
      deploymentsLockedUntil: 0,
      fiberPurchases: 0,
      resinDiscountNext: false,
      merchArmTicks: 0,
      necrosisTicks: 0,
      paceFailStreak: 0,
      noSubjectSent: false,
      glueWarningsSent: {},
      todDefectBonus: 0,
    },
    stats: {
      bpLedger: {},
      bpIntegral: 0,
      ticksInRed: 0,
      peakBP: BALANCE.START.bp,
      breakdowns: 0,
      punsEndured: 0,
      woodPunsEndured: 0,
      coffees: 0,
      screams: 0,
      involuntaryScreams: 0,
      chrisDeployments: 0,
      chrisSecondaryFailures: 0,
      terryFixes: 0,
      daveFixes: 0,
      tradesAccepted: 0,
      tradesDeclined: 0,
      scamsBurned: 0,
      scamsSurvived: 0,
      finesPaid: 0,
      kevinCowardiceViolations: 0, // acceptance test 3; must remain 0
      minChrisConfidenceDelta: 0,  // acceptance test 5; must remain ≥ 0
    },
  };

  // Fixed appointments on Spencer's calendar of suffering:
  schedule(state, BALANCE.KEVIN.MANDATORY_FUN_TICK, 'MANDATORY_FUN');
  schedule(state, BALANCE.TOD.DISPUTE_TICK + randInt(state, -20, 20), 'TOD_DISPUTE');

  return state;
}

// One pre-state random for Tod's first pitch (keeps main stream clean).
function randIntSeedless(seed, min, max) {
  let t = ((seed >>> 0) + 0x9E3779B9) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return min + Math.floor(r * (max - min + 1));
}
