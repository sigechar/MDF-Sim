// Terminal state evaluation, in priority order (spec §10).
// Failure is funnier than success, but success must be possible.

import { BALANCE } from '../balance.js';
import { computeUptime } from '../util.js';

export const ENDINGS = {
  WIN_SHIFT_SURVIVED: {
    title: 'SHIFT SURVIVED',
    copy: 'Dawn over the parking lot. Your hands are still vibrating slightly. The day shift arrives and immediately complains about housekeeping. You made board. You made target. You made it.',
  },
  LOSS_GLUED_SHUT: {
    title: 'THE PLANT IS NOW ONE OBJECT',
    copy: "The plant has achieved structural unity. The doors, the press, and two forklifts are now a single object. Corporate has rebranded it 'vertical integration.' A plaque is being made. You are on the plaque. It is not a good plaque.",
  },
  LOSS_BANKRUPT_MERCH: {
    title: 'PAYMENT IN MERCHANDISE',
    copy: "Accounts payable has begun offering the resin vendor 'payment in company merchandise.' The vendor has been mailed 400 lanyards and a polo. The vendor's lawyer has been mailed a kazoo. Chemical deliveries are suspended indefinitely. So are you.",
  },
  LOSS_BREAKDOWN: {
    title: 'SPENCER HAS LEFT THE FACILITY',
    copy: 'Spencer set down the radio gently, which was somehow worse than throwing it. Security footage shows him walking directly into the tree line behind the wood yard, posture excellent, gone. Kevin emerged eleven minutes later and asked if anyone wanted to hear something hilarious about plywood.',
  },
  LOSS_CHAIN_NECROSIS: {
    title: 'THE PLANT IS, LEGALLY SPEAKING, A MUSEUM',
    copy: 'Every machine is down. The plant is, legally speaking, a museum. Chris has scheduled a lessons-learned meeting and listed himself as both presenter and lesson.',
  },
  LOSS_TARGET_MISSED: {
    title: 'SHIFT ENDED. TARGET DID NOT.',
    copy: "06:00. The plant survived. The number did not. Corporate's final email contains only a calendar invite titled 'Alignment.' There is no agenda. There is no end time. Tod's crew hit THEIR number, somehow, and he wants you to know he's 'here if you ever want to talk strategy.'",
  },
};

export function runWinLoss(state) {
  if (state.meta.gameOver) return;
  const uptime = computeUptime(state);

  // necrosis counter: every machine down for 90 consecutive ticks
  if (uptime === 0) state.flags.necrosisTicks++;
  else state.flags.necrosisTicks = 0;

  const target = BALANCE.TARGETS[state.meta.difficulty];

  // 10.1 — victory first, as is right and proper
  if (state.meta.shiftClock >= BALANCE.TICKS_PER_SHIFT) {
    if (state.resources.boardsProduced >= target && state.resources.cash > 0) {
      end(state, 'WIN_SHIFT_SURVIVED');
    } else {
      end(state, state.resources.cash <= 0 ? 'LOSS_BANKRUPT_MERCH' : 'LOSS_TARGET_MISSED');
    }
    return;
  }
  // 10.2 — defeat vectors
  if (state.plant.gluePileup >= BALANCE.GLUE.DOOM_AT) return end(state, 'LOSS_GLUED_SHUT');
  if (state.resources.cash <= BALANCE.ECONOMY.BANKRUPT_AT
    || state.flags.merchArmTicks >= BALANCE.ECONOMY.MERCH_ARM_TICKS) {
    return end(state, 'LOSS_BANKRUPT_MERCH');
  }
  if (state.spencer.bp >= BALANCE.BP.DEATH) return end(state, 'LOSS_BREAKDOWN');
  if (state.flags.necrosisTicks >= 90) return end(state, 'LOSS_CHAIN_NECROSIS');
}

function end(state, endingId) {
  state.meta.gameOver = {
    endingId,
    win: endingId === 'WIN_SHIFT_SURVIVED',
    tick: state.meta.tick,
    grade: endingId === 'WIN_SHIFT_SURVIVED' ? computeGrade(state) : null,
  };
}

// Grade A–D from: BP integral, scrap ratio, theories endorsed, scams burned.
// Winning should still hurt; the grade says how much it showed.
function computeGrade(state) {
  const avgBP = state.stats.bpIntegral / Math.max(1, state.meta.tick);
  const totalBoards = state.resources.boardsProduced + state.resources.boardsScrapped;
  const scrapRatio = totalBoards > 0 ? state.resources.boardsScrapped / totalBoards : 0;
  let score = 100;
  score -= Math.max(0, (avgBP - 120) * 0.6);          // composure
  score -= scrapRatio * 60;                            // craftsmanship
  score -= state.npcs.dave.theoriesEndorsedByManagement * 4; // dignity
  score -= state.stats.scamsBurned * 5;                // judgment (Tod-related)
  score -= state.stats.chrisSecondaryFailures * 3;     // knowing better
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}
