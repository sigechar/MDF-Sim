// The INCIDENT table (spec §14.2). Hourly guaranteed roll + per-tick spawn.
// Invariant (§9.3): every incident emits ≥1 ticker line and ≥1 state delta.
// requiresAuthority incidents send Kevin into HIDING by their very existence,
// then charge the player the 1.5× absentee markup. This is the joke. It is
// also a load-bearing difficulty mechanic.

import { BALANCE } from '../balance.js';
import { pick, chance } from '../rng.js';
import {
  pushTicker, addBP, addGlue, addQuality, openChoice, kevinMarkup, money,
} from '../util.js';
import { breakMachine } from '../engine/production.js';
import { kevinFlee } from '../npc/kevin.js';

export const INCIDENTS = [
  {
    key: 'RESIN_LEAK', weight: 14, requiresAuthority: false,
    apply(state) {
      state.resources.resin = Math.max(0, state.resources.resin - BALANCE.EVENTS.LEAK_RESIN_LOSS);
      addGlue(state, BALANCE.GLUE.LEAK_AMOUNT);
      pushTicker(state, { channel: 'ALARM', speaker: 'PLANT', severity: 'WARN', text: 'RESIN LEAK by the dryers. 1.5 tonnes are exploring the floor. The floor is becoming a commitment.' });
      openChoice(state, {
        id: `leak_${state.meta.tick}`, kind: 'RESIN_LEAK', source: 'incident', requiresAuthority: false,
        prompt: `RADIO: Resin leak by the dryers. Cleanup crew is available for ${money(BALANCE.EVENTS.LEAK_CLEANUP_COST)}, or it can "keep" — which is what the last guy said, and the floor still remembers him.`,
        options: [`Pay cleanup crew (${money(BALANCE.EVENTS.LEAK_CLEANUP_COST)})`, "It'll keep"],
        timerTicks: 15, timeoutOption: 1,
      });
    },
  },
  {
    key: 'PRESS_THERMAL', weight: 8, requiresAuthority: true,
    apply(state) {
      kevinFlee(state); // the crisis exists, therefore Kevin does not
      const m = state.plant.machines.PRESS;
      if (m.status === 'RUNNING' || m.status === 'DEGRADED') breakMachine(state, m);
      state.events.active.push({
        kind: 'PRESS_THERMAL', requiresAuthority: true,
        ticksLeft: BALANCE.EVENTS.PRESS_THERMAL_GRACE,
      });
      kevinMarkup(state); // records that Kevin is (of course) already hiding
      pushTicker(state, { channel: 'ALARM', speaker: 'PLANT', severity: 'CRIT', text: 'PRESS THERMAL EVENT. Smoke is "within parameters" only if you keep redefining parameters. Kevin vanished mid-sentence; the sentence was a pun; small mercies.' });
    },
  },
  {
    key: 'SAFETY_INSPECTION', weight: 7, requiresAuthority: true,
    apply(state) {
      kevinFlee(state);
      const mult = kevinMarkup(state);
      const fine = Math.round(BALANCE.EVENTS.INSPECTION_FINE_PER_GLUE * state.plant.gluePileup * mult);
      state.resources.cash -= fine;
      state.stats.finesPaid += fine;
      addBP(state, 'STRESS_ALARM_AMBIENT', 5 * mult);
      state.events.active.push({ kind: 'INSPECTION', requiresAuthority: true, ticksLeft: 10 });
      pushTicker(state, { speaker: 'PLANT', severity: 'CRIT', text: `SAFETY INSPECTION. The inspector counted the glue directly into a fine: ${money(fine)} (×1.5 supervisor-absent surcharge, noted on a clipboard with visible joy).` });
    },
  },
  {
    key: 'FIBER_MOISTURE_SPIKE', weight: 10, requiresAuthority: false,
    apply(state) {
      addQuality(state, -6);
      pushTicker(state, { speaker: 'PLANT', severity: 'WARN', text: 'Moisture spike in the fiber silo. The boards coming off the line are best described as "ambitious sponges." Quality -6.' });
    },
  },
  {
    key: 'STEAM_VALVE_CHATTER', weight: 9, requiresAuthority: false,
    apply(state) {
      const m = state.plant.machines.REFINER;
      m.health = Math.max(1, m.health - 10);
      pushTicker(state, { speaker: 'PLANT', severity: 'WARN', text: 'Steam valve chatter at the refiner. It sounds like applause. It is not applause. Refiner health -10.' });
    },
  },
  {
    key: 'FORKLIFT_INCIDENT', weight: 8, requiresAuthority: false,
    apply(state) {
      state.resources.cash -= 700;
      addBP(state, 'STRESS_ALARM_AMBIENT', 3);
      pushTicker(state, { speaker: 'PLANT', severity: 'WARN', text: 'A forklift has "interacted" with the racking. The racking lost. $700. The driver has already filled out the form blaming the racking.' });
    },
  },
  {
    key: 'SANDER_BELT_SNAP', weight: 8, requiresAuthority: false,
    apply(state) {
      const m = state.plant.machines.SANDER;
      m.health = Math.max(1, m.health - 20);
      addQuality(state, -3);
      pushTicker(state, { speaker: 'PLANT', severity: 'WARN', text: 'Sander belt let go with the energy of a man quitting retail. Health -20, quality -3, morale unmeasured by policy.' });
    },
  },
  {
    key: 'NIGHT_AUDIT_EMAIL', weight: 8, requiresAuthority: false,
    apply(state) {
      addBP(state, 'STRESS_CORPORATE_PACE', 3);
      pushTicker(state, { channel: 'EMAIL', severity: 'WARN', text: 'CORPORATE: "Friendly reminder that Q3 self-evaluations are due. Please rate your resilience. Use the dropdown. The dropdown only goes to ‘thriving.’"' });
    },
  },
  {
    key: 'BREAKROOM_MICROWAVE', weight: 6, requiresAuthority: false,
    apply(state) {
      addBP(state, 'STRESS_ALARM_AMBIENT', 2);
      pushTicker(state, { speaker: 'PLANT', text: 'Someone microwaved fish in the breakroom. At 1 a.m. This is technically not your problem, which is why it is entirely your problem.' });
    },
  },
  {
    key: 'RAT_IN_MCC', weight: 6, requiresAuthority: false,
    apply(state) {
      const m = state.plant.machines[pick(state, BALANCE.CHAIN)];
      m.health = Math.max(1, m.health - 8);
      addBP(state, 'STRESS_ALARM_AMBIENT', 4);
      pushTicker(state, { speaker: 'PLANT', severity: 'WARN', text: `A rat has been sighted in the MCC room near the ${BALANCE.MACHINES[m.id].label} controls. Dave says it's "a trained rat." Health -8 either way.` });
    },
  },
  {
    key: 'RESIN_VENDOR_CALL', weight: 7, requiresAuthority: false,
    apply(state) {
      openChoice(state, {
        id: `vendor_${state.meta.tick}`, kind: 'VENDOR_CALL', source: 'incident', requiresAuthority: false,
        prompt: 'RADIO: The resin vendor is on line 2. He "just wants to talk." Vendors never just want to talk. But he might knock 10% off the next tote.',
        options: ['Take the call (+4 BP, 10% off next resin)', 'Let it ring (+1 BP, he WILL remember)'],
        timerTicks: 12, timeoutOption: 1,
      });
    },
  },
  {
    key: 'COOLER_JAM', weight: 8, requiresAuthority: false,
    apply(state) {
      const m = state.plant.machines.COOLER;
      if (m.status === 'RUNNING') {
        m.status = 'DEGRADED';
        m.health = Math.min(m.health, 35);
        m.flavor = 'sweating';
      } else {
        m.health = Math.max(1, m.health - 10);
      }
      pushTicker(state, { speaker: 'PLANT', severity: 'WARN', text: 'Star cooler jam. The boards are stacking up hot and angry, like a queue at a pharmacy.' });
    },
  },
  {
    key: 'DUST_COLLECTOR_ALARM', weight: 7, requiresAuthority: false,
    apply(state) {
      addGlue(state, 3);
      addBP(state, 'STRESS_ALARM_AMBIENT', 2);
      pushTicker(state, { channel: 'ALARM', speaker: 'PLANT', severity: 'WARN', text: 'Dust collector differential alarm. The dust is collecting somewhere. The somewhere is "generally."' });
    },
  },
  {
    key: 'YARD_FIND', weight: 6, requiresAuthority: false,
    apply(state) {
      state.resources.woodFiber = Math.min(BALANCE.CAPS.fiber, state.resources.woodFiber + 10);
      addQuality(state, -2);
      pushTicker(state, { speaker: 'PLANT', text: 'The yard found a pile of fiber behind the chip screen. Free 10 tonnes. Vintage unknown. Quality -2; provenance -everything.' });
    },
  },
  {
    key: 'KEVIN_NEWSLETTER', weight: 6, requiresAuthority: false,
    apply(state) {
      addBP(state, 'STRESS_PUN', 3);
      pushTicker(state, { channel: 'EMAIL', speaker: 'KEVIN', severity: 'WARN', text: 'KEVIN\'S KORNER (newsletter, unsolicited): "FUN FACT!! MDF stands for My Dear Friends... that\'s you guys!!!" It does not stand for that.' });
    },
  },
];

export function rollIncident(state) {
  const total = INCIDENTS.reduce((s, i) => s + i.weight, 0);
  let roll = state ? rollValue(state) * total : 0;
  for (const inc of INCIDENTS) {
    roll -= inc.weight;
    if (roll <= 0) { inc.apply(state); return inc; }
  }
  return null;
}

// tiny indirection so this file keeps a single rng touchpoint
import { rand } from '../rng.js';
function rollValue(state) { return rand(state); }

export function resolveIncidentChoice(state, choice, optionIndex) {
  switch (choice.kind) {
    case 'RESIN_LEAK': {
      if (optionIndex === 0 && state.resources.cash >= BALANCE.EVENTS.LEAK_CLEANUP_COST) {
        state.resources.cash -= BALANCE.EVENTS.LEAK_CLEANUP_COST;
        pushTicker(state, { speaker: 'PLANT', text: 'Cleanup crew dispatched to the leak. The floor is a floor again. For now.' });
      } else {
        state.events.active.push({ kind: 'DRIP', requiresAuthority: false, ticksLeft: 60 });
        pushTicker(state, { speaker: 'PLANT', severity: 'WARN', text: 'The leak will "keep." The leak is keeping. +glue per minute until someone with a budget feels something.' });
      }
      break;
    }
    case 'VENDOR_CALL': {
      if (optionIndex === 0) {
        addBP(state, 'STRESS_TOD_PITCH', 4);
        state.flags.resinDiscountNext = true;
        pushTicker(state, { speaker: 'PLANT', text: 'You took the vendor call. Twelve minutes about his boat. The next resin tote is 10% off. The boat is named "Resilience II."' });
      } else {
        addBP(state, 'STRESS_TOD_PITCH', 1);
        pushTicker(state, { speaker: 'PLANT', text: 'You let it ring. Somewhere, a man looks at his boat and feels nothing.' });
      }
      break;
    }
  }
}
