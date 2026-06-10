// Single source of truth for every tunable number in the simulation.
// No magic numbers may live anywhere else (spec §13).

export const BALANCE = {
  TICKS_PER_SHIFT: 720,
  TICKS_PER_SECOND: 1,        // 1 in-game minute per real second at 1×

  UI: {
    CHOICE_DILATION: 3,       // engine runs at 1/3 speed while a transmission waits
    TICKER_LINES: 6,
  },

  START: { cash: 25_000, fiber: 80, resin: 12, bp: 118, quality: 85 },
  CAPS: { fiber: 200, resin: 30, bp: 240, bpFloor: 60 },

  PRODUCTION: {
    BASE_RATE: 0.55,        // m³ per tick, theoretical
    FIBER_PER_M3: 0.72,     // tonnes
    RESIN_PER_M3: 0.085,    // tonnes
    BOARD_PRICE: 310,       // USD per saleable m³
    QUALITY_DRIFT: 0.04,    // per tick, natural entropy
    CONTAMINATION_DRIFT: 0.35, // per tick while Tod's wet fiber is in the system
  },

  TARGETS: { TRAINEE: 180, SHIFT_LEADER: 240, CORPORATE_TARGETS: 300 },

  BREAKDOWN: {
    BASE: 0.0017,
    DEGRADED_MOD: 2.5,
    CHRIS_AURA: 1.8,
    DAVE_BOOST: 1.6,
    DIFF: { TRAINEE: 0.7, SHIFT_LEADER: 1.0, CORPORATE_TARGETS: 1.3 },
    DEGRADED_WEAR_MOD: 1.5,
  },

  MACHINES: {
    // wear: health lost per tick while RUNNING; weight: uptime contribution;
    // degradedTp: throughput factor while DEGRADED
    REFINER: { wear: 0.030, weight: 0.20, degradedTp: 0.65, label: 'REFINER' },
    BLENDER: { wear: 0.025, weight: 0.15, degradedTp: 0.70, label: 'BLENDER' },
    FORMER:  { wear: 0.020, weight: 0.15, degradedTp: 0.75, label: 'FORMING LINE' },
    PRESS:   { wear: 0.045, weight: 0.25, degradedTp: 0.55, label: 'HOT PRESS' },
    COOLER:  { wear: 0.015, weight: 0.10, degradedTp: 0.80, label: 'BOARD COOLER' },
    SANDER:  { wear: 0.025, weight: 0.15, degradedTp: 0.70, label: 'SANDER/SAW' },
  },
  CHAIN: ['REFINER', 'BLENDER', 'FORMER', 'PRESS', 'COOLER', 'SANDER'],
  DEGRADED_AT: 40,         // health below this → DEGRADED

  KEVIN: {
    APPROACH_P: 0.011,
    APPROACH_TICKS: 3,
    PUN_BP: 4,
    WOOD_PUN_BP: 6,
    PUN_COOLDOWN: [45, 90],
    ABSENTEE_MULT: 1.5,
    HIDING_BP_PER_TICK: 0.30,
    HIDE_EXIT_CALM_TICKS: 12,
    MANDATORY_FUN_TICK: 360,
    MANDATORY_FUN_TICKS: 10,
    PAUSE_AMBUSH_BONUS: 0.15,  // extra approach probability after a long pause
    PAUSE_AMBUSH_TICKS: 5,
  },

  CHRIS: {
    COST: 0,                 // * the asterisk is doing a lot of work
    EN_ROUTE_TICKS: 3,
    BASE_REPAIR_TICKS: 40,   // × (1 + roll(0..0.5))
    AURA_BP: 0.20,
    EXPLAINING_TICKS: 6,
    OUTCOMES: { FIXED: 0.45, FIXEDISH: 0.25, SECONDARY: 0.22, CATASTROFIX: 0.08 },
    FIXED_HEALTH: 55,
    FIXEDISH_HEALTH: 35,
    FIXEDISH_TP_LOSS: 0.05,
    SECONDARY_HEALTH: 50,
    CATASTROFIX_QUALITY: 8,
    CHRISED_COST_MULT: 1.5,
    CONFIDENCE_START: 95,
    CONFIDENCE_PER_OUTCOME: 2, // outcomes do not affect this. that is the joke.
    GLUE_PER_INTERVENTION: 0.5,
  },

  TERRY: {
    COST: 600,
    STAMINA_PER_FIX: 22,
    PASSIVE_DRAIN: 0.03,
    BREAK_AT: 30,
    BREAK_TICKS: 45,
    BREAK_REGEN_TO: 75,
    BREAKS_BEFORE_CLOCKOUT: 2,
  },

  DAVE: {
    COST: 400,
    REPAIR_TICKS: 12,
    REPAIR_HEALTH: 85,
    MONOLOGUE_P: 0.65,
    MONOLOGUE_TIMER: 15,
    TRUST_START: 50,
    AGREE_TRUST: 15,
    AGREE_BP: 6,
    BOOST_TICKS: 60,
    BOOST_RATE: 1.20,
    BOOST_QUALITY: 0.05,
    DISAGREE_TRUST: 20,
    DISAGREE_RELIEF: 1,
    STRIKE_BELOW_TRUST: 25,
    STRIKE_TICKS: 90,
    STRIKE_SABOTAGE_P: 0.30,
  },

  TOD: {
    PITCH_INTERVAL: [70, 110],
    PITCH_TIMER: 20,
    DECLINE_ACCEL: 15,       // rejection energizes him
    GRUDGE_DEFECT_BONUS: 0.10,
    DEFECT_DELAY: [15, 40],
    DISPUTE_TICK: 500,
    DISPUTE_FIBER: 10,
    DISPUTE_CASH: 2500,
    DISPUTE_REFUSE_BP: 10,
    PURGE_COST: 1500,
    SANDER_WEAR_BOOST: 3,
    SANDER_WEAR_TICKS: 30,
  },

  GLUE: {
    BASELINE: 0.020,
    BLENDER_DOWN: 0.15,
    LEAK_AMOUNT: 2.0,
    DRIP_PER_TICK: 0.05,
    CLEANUP_AMOUNT: 25,
    CLEANUP_COST: 1_200,
    CLEANUP_SANDER_PAUSE: 10,
    WARN_AT: 70,
    DOOM_AT: 100,
  },

  BP: {
    AMBER: 140, RED: 170, CRITICAL: 200, DEATH: 240,
    HOMEOSTASIS: 0.05,
    COFFEE_RELIEF: 10,
    CAFFEINE_DECAY_TICKS: 90,
    CAFFEINE_JITTER_AT: 3,
    CAFFEINE_STRESS_MULT: 1.25,
    SCREAM_RELIEF: 15,
    SCREAM_COOLDOWN: 5,
    SCREAM_KEVIN_HEARS_P: 0.20,
    QUIET_TICKS: 10,
    QUIET_RELIEF: 3,
    SMALL_VICTORY: 4,
    TERRY_VICTORY: 8,
    INVOLUNTARY_SCREAM_P: 0.015,
    RED_TIMER_MULT: 0.75,
    ALLCAPS_P: 0.10,
  },

  STRESS: {
    BREAKDOWN: 8, BREAKDOWN_PRESS: 12,
    KEVIN_HIDING: 0.30,
    CHRIS_HELPING: 0.20, CHRISED: 10,
    DAVE_LECTURE: 3, DAVE_AGREE: 6,
    TOD_PITCH: 2, TOD_BURNED: 14, TOD_REFUSED_RELIEF: 2,
    STARVED: 0.5,
    ALARM_AMBIENT: 0.15,
    CORPORATE_PACE: 5, CORPORATE_NO_SUBJECT: 15,
  },

  ECONOMY: {
    FIBER_BUY: { amount: 25, cost: 4_500, delay: 5, escalateAfter: 4, escalation: 1.10 },
    RUSH_MULT: 1.5,
    RESIN_BUY: { amount: 6, cost: 7_200 },
    CALIBRATE: { cost: 800, qualityGain: 12, formerPause: 3 },
    BANKRUPT_AT: -5_000,
    MERCH_ARM_TICKS: 60,
    MERCH_RESIN_FLOOR: 2,
  },

  EVENTS: {
    INCIDENT_P: 0.007,
    LATE_SHIFT_RAMP: 0.6,    // p scales by (1 + tick/720 × this)
    CHOICE_QUEUE_MAX: 2,
    PACE_GRACE: 0.8,
    PACE_FAILS_FOR_SILENCE: 5,
    PRESS_THERMAL_GRACE: 30,
    PRESS_THERMAL_CAP: 70,
    INSPECTION_FINE_PER_GLUE: 40,
    LEAK_RESIN_LOSS: 1.5,
    LEAK_CLEANUP_COST: 900,
  },
};
