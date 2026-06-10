// DAVE — Conspiracy Millwright. High-Variance Capability (spec §8.4).
// He genuinely fixes things. The price is paid in a different currency:
// you have to talk to him, and the conversation has a state vector.

import { BALANCE } from '../balance.js';
import { chance, pick } from '../rng.js';
import { pushTicker, addBP, setHealth, openChoice } from '../util.js';
import { THEORIES } from '../content/theories.js';

const DAVE_DEPLOY_LINES = [
  `Birds aren't real. Neither is 'planned' maintenance. I'm on it — twelve minutes.`,
  `Twelve minutes. Don't touch my toolbox. The plant's torque wrenches report up.`,
  `The failure interval on this machine is not random. I have a spreadsheet. Twelve minutes.`,
  `This bearing didn't fail. It was *told* to fail. I know the difference. Twelve minutes.`,
  `The manufacturer's tolerances are written to produce exactly this failure at exactly this interval. I use my own numbers. Twelve minutes.`,
  `Every machine in this plant fails on schedule. Not 'a' schedule — THE schedule. I've mapped it. Twelve minutes.`,
  `The grease in that machine is third-party supply-chain grease. Factory-spec grease is a subscription model for downtime. Twelve minutes.`,
  `I'm photographing the housing before I open it. I photograph everything. Ask me why later. Actually don't — twelve minutes.`,
  `The chip pile birds stopped landing three weeks ago. They knew. I knew. Twelve minutes.`,
  `The 'approved vendor' components in this machine are sized to fail at exactly this interval. I have the originals. Twelve minutes.`,
  `I already know what I'll find in there. I always know. That's the tell. Twelve minutes.`,
  `Contrails were unusually heavy this morning. I logged it. Make of that what you will. Twelve minutes.`,
];

const DAVE_FIX_LINES = [
  `Fixed. Torqued to real specs. Not the brochure specs. Never the brochure specs.`,
  `Running. I found a bird band in the housing. I photographed it. I've seen this before.`,
  `Online. The wear pattern on that shaft is consistent with a 90-day induced failure cycle. I've logged it.`,
  `Fixed. The failed bearing has a serial number I've seen on three other machines. It's in my truck now.`,
  `Running. Replaced the approved-vendor part with my personal stock. You'll notice it lasts longer. Notice that.`,
  `Done. There was a GPS module zip-tied to the frame. I left it there. Let them think we haven't noticed.`,
  `Online. The lubrication was off-spec by precisely the margin that produces precisely this failure interval. Precision like that is not an accident.`,
  `Fixed. And I swept the area. The new safety poster 'they' put up last month faces directly at this machine. That is not interior design.`,
  `Running. The old part is in my truck. I'll tell you what I find when I take it apart. You will not be ready for it.`,
  `Back up. Third time this quarter. Every 73 days. You want to tell me 73 is random? 73 is a maintenance contract for someone who isn't us.`,
  `Fixed. I took photos of the housing before, during, and after. The drill marks from the last time someone was in here are not mine.`,
  `Online. Planned maintenance is a myth invented by the parts industry. What I just did is real maintenance. There's a difference.`,
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
