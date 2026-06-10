// TOD — Peer Shift Leader, C-Crew. Predatory Low-Tier Salesmanship (spec §8.5).
// Every offer shows a real, attractive headline and conceals a defect that
// detonates later, when the causality is deniable. Tod's signature move.
// Voice rule (§12): every transmission opens with "heyyy".

import { BALANCE } from '../balance.js';
import { chance, randInt, pick } from '../rng.js';
import {
  pushTicker, addBP, addGlue, schedule, openChoice, clamp, money, kevinMarkup,
} from '../util.js';
import { kevinFlee } from './kevin.js';

const TRADES = [
  {
    key: 'WET_FIBER',
    headline: `heyyy buddy. C-Crew's got 20 tonnes of surplus fiber, half price — $1,800. It's good fiber. Don't smell it, just take it.`,
    accept: 'Deal.', decline: 'Hard pass, Tod.',
    cost: 1800, defectP: 0.55,
    available: (s) => s.resources.cash >= 1800 && s.resources.woodFiber <= BALANCE.CAPS.fiber - 5,
    apply(state) {
      state.resources.cash -= this.cost;
      state.resources.woodFiber = clamp(state.resources.woodFiber + 20, 0, BALANCE.CAPS.fiber);
      pushTicker(state, { speaker: 'TOD', text: 'heyyy, pleasure doing business. the moisture is normal. who said anything about moisture. bye.' });
    },
  },
  {
    key: 'BAD_RESIN',
    headline: `heyyy. Got a resin tote that fell off a truck*. 4 tonnes, $2,000. The asterisk is silent.`,
    accept: 'Deal.', decline: 'Hard pass, Tod.',
    cost: 2000, defectP: 0.50,
    available: (s) => s.resources.cash >= 2000 && s.resources.resin <= BALANCE.CAPS.resin - 1,
    apply(state) {
      state.resources.cash -= this.cost;
      state.resources.resin = clamp(state.resources.resin + 4, 0, BALANCE.CAPS.resin);
      pushTicker(state, { speaker: 'TOD', text: 'heyyy great. the tote is yours now. legally, spiritually, chemically. especially chemically.' });
    },
  },
  {
    key: 'BUY_BOARDS',
    headline: `heyyy Spencer. I'll buy 15 m³ off your count, cash now, $6,000. C-Crew's a little behind. This one's totally clean, I swear on Kevin.`,
    accept: 'Deal.', decline: 'Hard pass, Tod.',
    cost: 0, defectP: 0, // his only honest deal is the worst one: it sells your WIN metric
    available: (s) => s.resources.boardsProduced >= 15,
    apply(state) {
      state.resources.cash += 6000;
      state.resources.boardsProduced -= 15;
      pushTicker(state, { speaker: 'TOD', text: 'heyyy thanks. fifteen cubes off your count. it was the honest deal. that should worry you about the other ones.' });
    },
  },
  {
    key: 'COVER_PRESS',
    headline: `heyyy. C-Crew will "cover" your press for an hour. Zero wear. Free. We're basically family. Families adjust each other's settings.`,
    accept: 'Deal.', decline: 'Hard pass, Tod.',
    cost: 0, defectP: 0.40,
    available: (s) => s.plant.machines.PRESS.status === 'RUNNING',
    apply(state) {
      state.flags.pressWearPausedUntil = state.meta.tick + 60;
      const defect = chance(state, 0.40 + state.flags.todDefectBonus);
      schedule(state, state.meta.tick + 60, 'CCREW_HANDBACK', { defect });
      pushTicker(state, { speaker: 'TOD', text: 'heyyy, she\'s in good hands. C-Crew hands. ...I\'ll check back in an hour.' });
    },
    selfRollsDefect: true,
  },
];

export function tickTod(state) {
  const t = state.npcs.tod;
  if (state.meta.tick < t.nextPitchTick) return;
  if (state.events.pendingChoice?.source === 'tod'
    || state.events.choiceQueue.some(c => c.source === 'tod')) return;

  const pool = TRADES.filter(tr => tr.available(state));
  if (pool.length === 0) {
    t.nextPitchTick = state.meta.tick + 20; // he'll think of something
    return;
  }
  const trade = pick(state, pool);
  t.pitchesMade++;
  addBP(state, 'STRESS_TOD_PITCH', BALANCE.STRESS.TOD_PITCH); // his voice does this
  openChoice(state, {
    id: `tod_${state.meta.tick}`,
    kind: 'TOD_TRADE',
    source: 'tod',
    requiresAuthority: false,
    prompt: `TOD (C-CREW, over radio): "${trade.headline}"`,
    options: [trade.accept, trade.decline],
    timerTicks: BALANCE.TOD.PITCH_TIMER,
    timeoutOption: 1,
    tradeKey: trade.key,
  });
}

export function resolveTrade(state, choice, optionIndex) {
  const t = state.npcs.tod;
  const trade = TRADES.find(tr => tr.key === choice.tradeKey);
  const declined = optionIndex === 1;

  if (declined) {
    state.stats.tradesDeclined++;
    addBP(state, 'RELIEF_TOD_REFUSED', -BALANCE.STRESS.TOD_REFUSED_RELIEF); // self-respect dividend
    pushTicker(state, { speaker: 'TOD', text: 'heyyy no worries, no worries. your loss. probably. statistically.' });
    // Rejection energizes him (spec §8.5; load-bearing characterization)
    t.nextPitchTick = state.meta.tick
      + randInt(state, BALANCE.TOD.PITCH_INTERVAL[0], BALANCE.TOD.PITCH_INTERVAL[1])
      - BALANCE.TOD.DECLINE_ACCEL;
    return;
  }

  state.stats.tradesAccepted++;
  trade.apply.call(trade, state);
  if (!trade.selfRollsDefect && trade.defectP > 0) {
    if (chance(state, trade.defectP + state.flags.todDefectBonus)) {
      t.scamsExecuted++;
      schedule(
        state,
        state.meta.tick + randInt(state, BALANCE.TOD.DEFECT_DELAY[0], BALANCE.TOD.DEFECT_DELAY[1]),
        'TOD_DEFECT',
        { type: trade.key }
      );
    } else {
      t.scamsSurvived++;
      state.stats.scamsSurvived++;
    }
  }
  t.nextPitchTick = state.meta.tick
    + randInt(state, BALANCE.TOD.PITCH_INTERVAL[0], BALANCE.TOD.PITCH_INTERVAL[1]);
}

// Delayed payloads, detonated by the scheduler when the causality is deniable.
export function detonateDefect(state, type) {
  state.stats.scamsBurned++;
  addBP(state, 'STRESS_TOD_BURNED', BALANCE.STRESS.TOD_BURNED); // the betrayal premium
  switch (type) {
    case 'WET_FIBER': {
      state.flags.contaminated = true;
      state.flags.sanderWearBoostUntil = state.meta.tick + BALANCE.TOD.SANDER_WEAR_TICKS;
      pushTicker(state, {
        speaker: 'PLANT', severity: 'CRIT',
        text: `QUALITY ALARM: Tod's "surplus" fiber is wet and full of bark. The sander is eating itself. A PURGE ($${BALANCE.TOD.PURGE_COST.toLocaleString()}) is required. Tod's radio is suddenly "in a dead zone."`,
      });
      break;
    }
    case 'BAD_RESIN': {
      const b = state.plant.machines.BLENDER;
      if (b.status === 'RUNNING' || b.status === 'DEGRADED') {
        b.status = 'DOWN';
        b.health = 0;
        b.flavor = 'full of regret';
      }
      addGlue(state, 6);
      pushTicker(state, {
        speaker: 'PLANT', severity: 'CRIT',
        text: 'BLENDER DOWN. The tote did not fall off a truck. The tote was the truck\'s problem and now it is yours.',
      });
      break;
    }
  }
}

export function handbackPress(state, defect) {
  const m = state.plant.machines.PRESS;
  if (defect) {
    state.npcs.tod.scamsExecuted++;
    state.stats.scamsBurned++;
    m.health -= 30;
    addBP(state, 'STRESS_TOD_BURNED', BALANCE.STRESS.TOD_BURNED);
    if (m.health <= 0 && (m.status === 'RUNNING' || m.status === 'DEGRADED')) {
      m.status = 'DOWN';
      m.health = 0;
    }
    pushTicker(state, {
      speaker: 'TOD', severity: 'CRIT',
      text: 'heyyy, press is all yours again! the settings have been improved. by C-Crew. improved.',
    });
  } else {
    state.npcs.tod.scamsSurvived++;
    state.stats.scamsSurvived++;
    pushTicker(state, { speaker: 'TOD', text: 'heyyy, press handback complete. nothing happened. you sound disappointed. weird.' });
  }
}

// The Dispute (spec §8.5): requiresAuthority, therefore Kevin-free by definition.
export function spawnDispute(state) {
  kevinFlee(state); // this event is exactly the kind of thing Kevin is for, therefore he is gone
  state.events.active.push({ kind: 'TOD_DISPUTE_WINDOW', requiresAuthority: true, ticksLeft: 25 });
  openChoice(state, {
    id: `dispute_${state.meta.tick}`,
    kind: 'TOD_DISPUTE',
    source: 'tod',
    requiresAuthority: true,
    prompt: `TOD (in person, somehow already in your office): "heyyy. So. D-Crew owes C-Crew ten tonnes of fiber. From last month. The thing. You remember the thing. Kevin knows about it — oh, is Kevin not here? Huh."`,
    options: [
      `Pay him (10t fiber, or ${money(BALANCE.TOD.DISPUTE_CASH)} if short)`,
      'Refuse. There was no "thing."',
    ],
    timerTicks: BALANCE.TOD.PITCH_TIMER,
    timeoutOption: 1,
  });
  pushTicker(state, { speaker: 'PLANT', severity: 'WARN', text: 'Inter-crew dispute in progress. This is exactly the kind of thing superintendents are for.' });
}

export function resolveDispute(state, optionIndex) {
  state.events.active = state.events.active.filter(e => e.kind !== 'TOD_DISPUTE_WINDOW');
  if (optionIndex === 0) {
    if (state.resources.woodFiber >= BALANCE.TOD.DISPUTE_FIBER) {
      state.resources.woodFiber -= BALANCE.TOD.DISPUTE_FIBER;
      pushTicker(state, { speaker: 'TOD', text: 'heyyy, knew you\'d remember the thing. ten tonnes. pleasure. the thing never happened, by the way.' });
    } else {
      state.resources.cash -= BALANCE.TOD.DISPUTE_CASH;
      pushTicker(state, { speaker: 'TOD', text: `heyyy, cash works too. ${money(BALANCE.TOD.DISPUTE_CASH)} of make-it-go-away money. it has gone away. mostly.` });
    }
  } else {
    const mult = kevinMarkup(state); // Kevin is HIDING. The markup applies. Always.
    addBP(state, 'STRESS_TOD_PITCH', BALANCE.TOD.DISPUTE_REFUSE_BP * mult);
    state.npcs.tod.grudge = true;
    state.flags.todDefectBonus = BALANCE.TOD.GRUDGE_DEFECT_BONUS;
    pushTicker(state, {
      speaker: 'TOD', severity: 'WARN',
      text: 'heyyy. okay. okay okay okay. no, it\'s fine. it\'s totally fine. (Tod will remember this. His deals will not get safer.)',
    });
  }
}
