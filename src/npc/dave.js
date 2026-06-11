// DAVE — Conspiracy Millwright. High-Variance Capability (spec §8.4).
// He genuinely fixes things. The price is paid in a different currency:
// you have to talk to him, and the conversation has a state vector.

import { BALANCE } from '../balance.js';
import { chance, pick } from '../rng.js';
import { pushTicker, addBP, setHealth, openChoice } from '../util.js';
import { THEORIES } from '../content/theories.js';

const DAVE_DEPLOY_LINES = [
  `Birds aren't real and neither is this work order, but the machine sure is broke. Twelve minutes.`,
  `On my way. If I'm not back in twelve minutes, check under the Denver airport. That's where they keep us.`,
  `Twelve minutes. Don't drink the breakroom water while I'm gone — fluoride calcifies the exact part of your brain that notices this stuff.`,
  `Heading over. The moon's been ringing like a bell all night. That means a bearing's a fake somewhere. I know where.`,
  `Twelve minutes. And no, before you ask, we never went to the moon. Unrelated to the repair. Probably.`,
  `Going now. Keep the thermostat where it is. If corporate turns it down tonight, the reptile thing is real and we'll finally know.`,
  `Twelve minutes. I'm filming the repair. Not for you. For the timeline that's watching.`,
  `On it. Third failure this month, and there are four mattress stores out by the highway. I'm just putting those two facts in one sentence.`,
  `Twelve minutes. Finland called about this part. Finland isn't real, so sit with the question of who actually called.`,
  `Heading in. If the sky looks milky tomorrow that's 'them' spraying — unrelated to the machine, very related to your headache.`,
  `Twelve minutes. The dinosaurs were a hoax but this bearing is genuinely a hundred years old, and I can only prove one of those.`,
  `Going. Don't let day shift near my toolbox. Half of them blink sideways and I've stopped pretending I didn't clock it.`,
];

const DAVE_FIX_LINES = [
  `Fixed. Torqued to real specs — not the manual's. The manual's written by the same people who told you Australia exists.`,
  `Running. Found a feather in the housing. Birds aren't real, so that's a drone part, so I bagged it. You're welcome.`,
  `Online. Same failure as last timeline, before they fired up that collider in Switzerland. In the good timeline it never broke. Fixed it in both, to be safe.`,
  `Done. The old bearing rang like the moon when I pulled it. Hollow. Swapped it for one that's honest about being solid.`,
  `Back up. The part number isn't in any catalog. 'They' issue parts that aren't supposed to be traceable. I traced it anyway.`,
  `Fixed. Photos before and after. If this dies again in 73 days, that's not wear, that's a schedule, and this time I'll have the receipts.`,
  `Running. I'd tell you what was wrong but it touches on the Denver airport and you've got a target to hit. Later. Bring coffee.`,
  `Online. Whoever 'fixed' this last left it loose on purpose. Same energy as faking a moon landing — sloppy, because they assume nobody measures.`,
  `Done. Good as new — 'new' being a concept the mattress-store people invented to move product, but you get the idea.`,
  `Back up. Vibration's gone. So's the headache I get on the chemtrail days. Correlation isn't nothing, Spencer.`,
  `Fixed. It's Berenstain, by the way. Not Berenstein. The machine remembers it the old way too. We both slid timelines. Anyway, it runs.`,
  `Running. Old part's in my truck with the others. One day I lay them all out in a row and the pattern scares somebody. Probably me.`,
];

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
    text: `Dave is on the ${BALANCE.MACHINES[machineId].label}. "${pick(state, DAVE_DEPLOY_LINES)}"`,
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
      pushTicker(state, { speaker: 'DAVE', text: `${BALANCE.MACHINES[m.id].label}: ${pick(state, DAVE_FIX_LINES)}` });
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
            "Dave. The machine is just old. That's the whole conspiracy.",
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
