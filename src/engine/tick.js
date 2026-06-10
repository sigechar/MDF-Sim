// The game loop orchestrator (spec §2). Fixed subsystem order, every tick.

import { deriveAlarms, computeUptime } from '../util.js';
import { runProduction } from './production.js';
import { runEconomy } from './economy.js';
import { runSpencer } from './bp.js';
import { runWinLoss } from './winloss.js';
import { tickKevin } from '../npc/kevin.js';
import { tickChris } from '../npc/chris.js';
import { tickTerry } from '../npc/terry.js';
import { tickDave } from '../npc/dave.js';
import { tickTod } from '../npc/tod.js';
import {
  processScheduled, tickActiveEvents, tickChoices, spawnIncidents, processActions,
} from '../events/engine.js';

export function tickGame(state, actions = []) {
  if (state.meta.gameOver) return state;

  // 1. CLOCK — advance; fire scheduled timers
  state.meta.tick++;
  state.meta.shiftClock++;
  processScheduled(state);

  // 2–3. PRODUCTION + DEGRADATION
  runProduction(state);
  deriveAlarms(state);

  // 4. NPC FSMs — weather systems with names
  tickKevin(state);
  tickChris(state);
  tickTerry(state);
  tickDave(state);
  tickTod(state);

  // 5. EVENT ENGINE — player choices first, then the world's
  processActions(state, actions);
  tickActiveEvents(state);
  spawnIncidents(state);
  tickChoices(state);

  // 6. ECONOMY
  runEconomy(state);

  // 7. SPENCER — all dysfunction terminates here
  deriveAlarms(state);
  runSpencer(state);

  // 8. WIN/LOSS
  computeUptime(state);
  runWinLoss(state);

  return state;
}
