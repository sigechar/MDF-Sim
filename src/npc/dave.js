// DAVE — Conspiracy Millwright. High-Variance Capability (spec §8.4).
// He genuinely fixes things. The price is paid in a different currency:
// you have to talk to him, and the conversation has a state vector.

import { BALANCE } from '../balance.js';
import { chance, pick } from '../rng.js';
import { pushTicker, addBP, setHealth, openChoice } from '../util.js';
import { THEORIES } from '../content/theories.js';

export function deployDave(state, machineId) {
  const d = state.npcs.dave;
  const m = state.plant.machines[machineId];
  d.status = 'WORKING';
  d.target = machineId;
  d.etaTicks = BALANCE.DAVE.REPAIR_TICKS;
  m.status = 'REPAIRING';
  m.assignedNpc = 'dave';
  m.repairEta = d.etaTicks;
  pushTicker(state, {
    speaker: 'DAVE',
    text: `Dave is on the ${BALANCE.MACHINES[machineId].label}. "Twelve minutes. Don't let anyone 'they' sent near my toolbox."`,
  });
}

export function tickDave(state) {
  const d = state.npcs.dave;

  if (d.status === 'ON_STRIKE') {
    d.strikeTicksRemaining--;
    if (d.strikeTicksRemaining <= 0) {
      d.status = 'AVAILABLE';
      pushTicker(state, { speaker: 'DAVE', text: `Dave has de-barricaded the tool crib. "Perimeter's verified. No thanks to 'them.' Or you."` });
    }
    return;
  }

  if (d.status === 'WORKING') {
    const m = state.plant.machines[d.target];
    d.etaTicks--;
    m.repairEta = Math.max(0, d.etaTicks);
    if (d.etaTicks <= 0) {
      m.status = 'RUNNING';
      setHealth(state, m, BALANCE.DAVE.REPAIR_HEALTH);
      m.assignedNpc = null;
      m.repairEta = null;
      m.flavor = 'nominal';
      state.stats.daveFixes++;
      addBP(state, 'RELIEF_SMALL_VICTORY', -BALANCE.BP.SMALL_VICTORY);
      pushTicker(state, { speaker: 'DAVE', text: `${BALANCE.MACHINES[m.id].label} is fixed. Properly. With torque specs "they" don't want published.` });
      d.target = null;

      if (chance(state, BALANCE.DAVE.MONOLOGUE_P)) {
        d.status = 'MONOLOGUING';
        addBP(state, 'STRESS_DAVE_LECTURE', BALANCE.STRESS.DAVE_LECTURE); // before you even answer
        const theory = pick(state, THEORIES);
        openChoice(state, {
          id: `dave_${state.meta.tick}`,
          kind: 'DAVE_MONOLOGUE',
          source: 'dave',
          requiresAuthority: false,
          prompt: `DAVE (gripping wrench, eyes bright): "${theory}"`,
          options: [
            'You know what Dave, that explains a lot.',
            "Dave. The bearings are just old.",
          ],
          timerTicks: BALANCE.DAVE.MONOLOGUE_TIMER,
          timeoutOption: 1, // silence is violence, per Dave
        });
      } else {
        d.status = 'AVAILABLE';
      }
    }
  }
}

export function resolveMonologue(state, optionIndex) {
  const d = state.npcs.dave;
  if (optionIndex === 0) {
    // AGREE: short-term-optimal, soul-eroding (spec §8.4)
    d.trustInSpencer = Math.min(100, d.trustInSpencer + BALANCE.DAVE.AGREE_TRUST);
    addBP(state, 'STRESS_DAVE_AGREE', BALANCE.STRESS.DAVE_AGREE); // you heard yourself say it
    d.boostUntil = state.meta.tick + BALANCE.DAVE.BOOST_TICKS;
    d.theoriesEndorsedByManagement++; // permanent record
    d.status = 'AVAILABLE';
    pushTicker(state, {
      speaker: 'DAVE', severity: 'WARN',
      text: `Dave nods slowly and starts re-torquing everything "they" loosened. Line output is up. The torque specs are from a forum.`,
    });
  } else {
    // DISAGREE: integrity has a price and the price is sometimes a strike
    d.trustInSpencer = Math.max(0, d.trustInSpencer - BALANCE.DAVE.DISAGREE_TRUST);
    if (d.trustInSpencer < BALANCE.DAVE.STRIKE_BELOW_TRUST) {
      d.status = 'ON_STRIKE';
      d.strikeTicksRemaining = BALANCE.DAVE.STRIKE_TICKS;
      pushTicker(state, {
        speaker: 'PLANT', severity: 'CRIT',
        text: `Dave has barricaded the tool crib "until the perimeter is verified." He has taken his personal multimeter. He does not trust the plant's multimeters. He has never trusted the plant's multimeters.`,
      });
      if (chance(state, BALANCE.DAVE.STRIKE_SABOTAGE_P)) {
        const running = Object.values(state.plant.machines).filter(m => m.status === 'RUNNING');
        if (running.length > 0) {
          const m = pick(state, running);
          m.status = 'DOWN';
          m.health = 0;
          m.flavor = 'protected from tampering';
          addBP(state, 'STRESS_BREAKDOWN', BALANCE.STRESS.BREAKDOWN);
          state.stats.breakdowns++;
          pushTicker(state, {
            speaker: 'DAVE', severity: 'CRIT',
            text: `On his way out, Dave "secured" the ${BALANCE.MACHINES[m.id].label}. It is now protected from tampering. And from working.`,
          });
        }
      }
    } else {
      d.status = 'AVAILABLE';
      d.sulkUntil = state.meta.tick + 30;
      addBP(state, 'RELIEF_INTEGRITY', -BALANCE.DAVE.DISAGREE_RELIEF); // mild integrity dividend
      pushTicker(state, { speaker: 'DAVE', text: `Dave looks at you the way "they" trained you to look at him. He returns to work. Sulking. Audibly.` });
    }
  }
}
