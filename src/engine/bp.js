// Spencer's per-tick physiology: homeostasis, caffeine decay, quiet minutes,
// ambient alarm dread, and the involuntary locker scream. Spec §7.

import { BALANCE } from '../balance.js';
import { chance } from '../rng.js';
import { pushTicker, addBP, highAlarmCount } from '../util.js';
import { kevinHearsScream } from '../npc/kevin.js';

export function runSpencer(state) {
  const sp = state.spencer;
  const B = BALANCE.BP;
  const bpBefore = sp.bp;

  // caffeine decay
  sp.caffeineTimers = sp.caffeineTimers.filter(t => t > state.meta.tick);
  sp.caffeine = sp.caffeineTimers.length;

  if (sp.screamCooldown > 0) sp.screamCooldown--;

  // ambient dread: stacking, per active HIGH alarm
  const highs = highAlarmCount(state);
  if (highs > 0) addBP(state, 'STRESS_ALARM_AMBIENT', BALANCE.STRESS.ALARM_AMBIENT * highs);

  // quiet minutes — rare by design
  if (state.plant.alarms.length === 0 && !state.events.pendingChoice) {
    sp.quietTicks++;
    if (sp.quietTicks >= B.QUIET_TICKS) {
      sp.quietTicks = 0;
      addBP(state, 'RELIEF_QUIET_MINUTE', -B.QUIET_RELIEF);
    }
  } else {
    sp.quietTicks = 0;
  }

  // homeostasis: the body wants to live; the plant disagrees
  if (highs === 0 && !state.events.pendingChoice && sp.caffeine < B.CAFFEINE_JITTER_AT) {
    sp.bp = Math.max(BALANCE.CAPS.bpFloor, sp.bp - B.HOMEOSTASIS);
  }

  // CRITICAL zone: involuntary scream (spec §7.5)
  if (sp.bp >= B.CRITICAL && chance(state, B.INVOLUNTARY_SCREAM_P)) {
    addBP(state, 'RELIEF_VENT', -B.SCREAM_RELIEF);
    sp.screamCooldown = B.SCREAM_COOLDOWN;
    state.stats.involuntaryScreams++;
    state.stats.screams++;
    pushTicker(state, { speaker: 'SPENCER', severity: 'CRIT', text: '[RADIO SILENCE]' });
    if (chance(state, B.SCREAM_KEVIN_HEARS_P * 2)) kevinHearsScream(state); // doubled when involuntary
  }

  // zone bookkeeping
  if (sp.bp >= B.CRITICAL && bpBefore < B.CRITICAL) sp.breakdownWarnings++;
  if (sp.bp >= B.RED) state.stats.ticksInRed++;
  state.stats.bpIntegral += sp.bp;
  state.stats.peakBP = Math.max(state.stats.peakBP, sp.bp);
  sp.bpTrend = sp.bpTrend * 0.9 + (sp.bp - bpBefore) * 0.1;
}

export function bpZone(bp) {
  const B = BALANCE.BP;
  if (bp >= B.CRITICAL) return 'CRITICAL';
  if (bp >= B.RED) return 'RED';
  if (bp >= B.AMBER) return 'AMBER';
  return 'GREEN';
}
