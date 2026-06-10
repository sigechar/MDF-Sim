// HMI render layer (spec §11). Pure render of GameState — the dashboard can
// never disagree with the engine because it never stores its own truth.

import { BALANCE } from '../balance.js';
import { clockString, money } from '../util.js';
import { bpZone } from '../engine/bp.js';
import { fiberPrice, rushFiberPrice, resinPrice } from '../engine/economy.js';
import { ENDINGS } from '../engine/winloss.js';
import { SPRITES } from './sprites.js';

const $ = id => document.getElementById(id);

// Anchor points (% of #schematic) for standing "at" a machine, and the rooms
// people retreat to when they are not, strictly speaking, helping.
const MACHINE_POS = {
  REFINER: { l: 10, t: 14 }, BLENDER: { l: 43, t: 14 }, FORMER: { l: 76, t: 14 },
  PRESS: { l: 10, t: 60 }, COOLER: { l: 43, t: 60 }, SANDER: { l: 76, t: 60 },
};
const ROOM = {
  office: { l: 86, t: 10 },     // Kevin's. The light is the truth.
  breakroom: { l: 7, t: 12 },   // Terry's. Protected by state law / federal law / Terry's law.
  shop: { l: 6, t: 72 },        // where Chris and Terry stage from
  crib: { l: 88, t: 70 },       // Dave's. Perimeter status: contested.
  door: { l: 48, t: 74 },       // Tod materializes here
};
const mpos = (id, slot = 0) => ({ l: MACHINE_POS[id].l + slot * 6, t: MACHINE_POS[id].t + 14 });

export function buildMachineGrid(onDeploy) {
  const grid = $('machine-grid');
  grid.innerHTML = '';
  BALANCE.CHAIN.forEach((id, i) => {
    const div = document.createElement('div');
    div.className = `machine d${i}`;
    div.id = `m-${id}`;
    div.innerHTML = `
      <div class="m-head"><span class="m-name">M${i + 1} ${BALANCE.MACHINES[id].label}</span><span class="lamp"></span></div>
      <div class="hbar"><div class="hfill" style="width:100%"></div></div>
      <div class="m-status">RUNNING</div>
      <div class="m-flavor"></div>
      <div class="m-deploy">
        <button data-npc="terry" data-m="${id}" title="Terry: instant, $600">TERRY</button>
        <button data-npc="dave" data-m="${id}" title="Dave: 12 min, $400, conversation risk">DAVE</button>
        <button data-npc="chris" data-m="${id}" title="Chris: $0* — the asterisk is doing a lot of work">CHRIS $0*</button>
      </div>
      ${i < 5 ? '<span class="flow">▶</span>' : ''}
      <span class="m-chip hidden"></span>`;
    grid.appendChild(div);
    div.querySelectorAll('.m-deploy button').forEach(btn => {
      btn.addEventListener('click', () => onDeploy(btn.dataset.npc, btn.dataset.m));
    });
  });
}

export function buildActors() {
  const layer = $('floor-actors');
  if (!layer) return;
  layer.innerHTML = '';
  for (const [id, home] of [
    ['chris', ROOM.shop], ['terry', { l: ROOM.shop.l + 7, t: ROOM.shop.t }],
    ['dave', ROOM.crib], ['tod', ROOM.door], ['kevin', ROOM.office],
  ]) {
    const div = document.createElement('div');
    div.className = 'actor';
    div.id = `actor-${id}`;
    div.style.left = `${home.l}%`;
    div.style.top = `${home.t}%`;
    div.innerHTML = `<span class="a-bubble hidden"></span>${SPRITES[id]}<span class="a-name">${id.toUpperCase()}</span>`;
    layer.appendChild(div);
  }
}

export function render(state) {
  const R = state.resources;
  const target = BALANCE.TARGETS[state.meta.difficulty];

  // header
  $('hdr-clock').textContent = clockString(state.meta.shiftClock);
  $('hdr-cash').textContent = money(R.cash);
  $('hdr-cash').style.color = R.cash < 5000 ? 'var(--red)' : '';
  $('hdr-seed').textContent = `SEED ${state.meta.seed}`;
  const pace = Math.min(100, (R.boardsProduced / target) * 100);
  $('pace-fill').style.width = `${pace}%`;
  $('pace-mark').style.left = `${Math.min(100, (state.meta.shiftClock / BALANCE.TICKS_PER_SHIFT) * 100)}%`;
  $('pace-label').textContent = `${R.boardsProduced.toFixed(0)} / ${target} m³`;

  // klaxon
  const highs = state.plant.alarms.filter(a => a.severity === 'HIGH').length;
  $('klaxon-strip').className = highs > 0 ? 'alarm' : '';

  // machines
  BALANCE.CHAIN.forEach(id => {
    const m = state.plant.machines[id];
    const el = $(`m-${id}`);
    el.className = el.className.replace(/s-\w+/g, '').trim() + ` s-${m.status}`;
    el.querySelector('.hfill').style.width = `${m.health}%`;
    const st = el.querySelector('.m-status');
    st.textContent = m.status === 'REPAIRING' && m.repairEta != null
      ? `REPAIRING — ETA ${m.repairEta}m` : m.status;
    el.querySelector('.m-flavor').textContent =
      (m.status === 'DEGRADED' || m.status === 'DOWN' || m.status === 'CHRISED') ? m.flavor : '';
    const chip = el.querySelector('.m-chip');
    if (m.assignedNpc) { chip.textContent = m.assignedNpc.toUpperCase(); chip.classList.remove('hidden'); }
    else chip.classList.add('hidden');
    const deployable = m.status === 'DOWN' || m.status === 'CHRISED';
    el.querySelectorAll('.m-deploy button').forEach(btn => {
      const npc = state.npcs[btn.dataset.npc];
      btn.disabled = !deployable || npc.status !== 'AVAILABLE'
        || state.meta.tick < state.flags.deploymentsLockedUntil;
      if (btn.dataset.npc === 'terry') {
        const c = m.status === 'CHRISED' ? BALANCE.TERRY.COST * 1.5 : BALANCE.TERRY.COST;
        btn.textContent = `TERRY $${c}`;
      } else if (btn.dataset.npc === 'dave') {
        const c = m.status === 'CHRISED' ? BALANCE.DAVE.COST * 1.5 : BALANCE.DAVE.COST;
        btn.textContent = `DAVE $${c}`;
      }
    });
  });

  $('uptime-label').textContent = `UPTIME ${state.plant.uptime}%`;
  $('goo').style.height = `${Math.min(100, state.plant.gluePileup)}%`;
  $('goo-pct').textContent = state.plant.gluePileup.toFixed(0);

  renderActors(state);
  renderSpencer(state);
  renderCrew(state);
  renderResources(state);
  renderTicker(state);
  renderChoice(state);
}

function placeActor(id, pos, { bubble = null, gone = false } = {}) {
  const el = $(`actor-${id}`);
  if (!el) return;
  el.style.left = `${pos.l}%`;
  el.style.top = `${pos.t}%`;
  el.style.opacity = gone ? '0' : '1';
  const b = el.querySelector('.a-bubble');
  if (bubble) { b.textContent = bubble; b.classList.remove('hidden'); }
  else b.classList.add('hidden');
}

function renderActors(state) {
  const tick = state.meta.tick;
  const N = state.npcs;

  // KEVIN — the light is on when he's contained; off when you need him most
  const k = N.kevin;
  $('office-light').classList.toggle('off', k.status === 'HIDING');
  if (k.status === 'HIDING') placeActor('kevin', ROOM.office, { gone: true });
  else if (k.status === 'APPROACHING') placeActor('kevin', { l: 90, t: 38 }, { bubble: 'incoming. has a new one.' });
  else if (k.status === 'MANDATORY_FUN') placeActor('kevin', { l: 46, t: 38 }, { bubble: 'MANDATORY MORALE' });
  else {
    const roam = BALANCE.CHAIN[Math.floor(tick / 25) % 6];
    placeActor('kevin', mpos(roam, 2), { bubble: k.ambushBoostTicks > 0 ? 'looking for you' : null });
  }

  // CHRIS — walks to the machine; the walk is the safest part
  const c = N.chris;
  if (c.status === 'EN_ROUTE' || c.status === 'ON_SITE') {
    placeActor('chris', mpos(c.target, 1), { bubble: c.status === 'ON_SITE' ? 'has opened a panel' : null });
  } else if (c.status === 'EXPLAINING') placeActor('chris', { l: 46, t: 50 }, { bubble: 'whiteboard session' });
  else placeActor('chris', ROOM.shop);

  // TERRY — shop, machine (briefly; he's instant), break room, or gone
  const t = N.terry;
  if (t.status === 'ON_BREAK') placeActor('terry', ROOM.breakroom, { bubble: `on break — ${t.breakTicksRemaining}m. no.` });
  else if (t.status === 'CLOCKED_OUT') placeActor('terry', ROOM.door, { gone: true });
  else placeActor('terry', { l: ROOM.shop.l + 7, t: ROOM.shop.t });

  // DAVE — tool crib unless working, monologuing, or striking
  const d = N.dave;
  if (d.status === 'WORKING' && d.target) placeActor('dave', mpos(d.target, 0));
  else if (d.status === 'MONOLOGUING') placeActor('dave', { l: 70, t: 44 }, { bubble: 'gripping wrench, eyes bright' });
  else if (d.status === 'ON_STRIKE') placeActor('dave', ROOM.crib, { bubble: 'ON STRIKE. perimeter unverified.' });
  else placeActor('dave', ROOM.crib, { bubble: tick < d.sulkUntil ? 'sulking (audibly)' : null });

  // TOD — paces the yard door like a shark that learned about quarterly targets
  const pc = state.events.pendingChoice;
  if (pc && pc.source === 'tod') placeActor('tod', { l: ROOM.door.l + 7, t: ROOM.door.t - 5 }, { bubble: 'heyyy' });
  else placeActor('tod', { l: 48 + 17 * Math.sin(tick / 12), t: 76 }, { bubble: N.tod.grudge ? 'remembers' : null });
}

function renderSpencer(state) {
  const sp = state.spencer;
  const zone = bpZone(sp.bp);
  document.body.className = `zone-${zone}`;
  $('bp-value').textContent = sp.bp.toFixed(0);
  const pct = ((sp.bp - 60) / (240 - 60)) * 100;
  const fill = $('bp-fill');
  fill.style.width = `${pct}%`;
  fill.style.background = zone === 'GREEN' ? 'var(--green)' : zone === 'AMBER' ? 'var(--amber)' : 'var(--red)';
  $('bp-trend').textContent = sp.bpTrend > 0.05 ? '▲' : sp.bpTrend < -0.05 ? '▼' : '→';
  $('bp-trend').style.color = sp.bpTrend > 0.05 ? 'var(--red)' : sp.bpTrend < -0.05 ? 'var(--green)' : 'var(--dim)';
  const chipEl = $('bp-zone-chip');
  chipEl.textContent = zone;
  chipEl.className = `chip ${zone === 'CRITICAL' ? 'critical' : zone.toLowerCase()}`;
  $('caffeine-pips').textContent = '●'.repeat(Math.min(3, sp.caffeine)) + '○'.repeat(Math.max(0, 3 - sp.caffeine))
    + (sp.caffeine >= 3 ? ' (vibrating)' : '');
  $('btn-scream').disabled = sp.screamCooldown > 0;
}

const CREW_META = {
  kevin: { name: 'KEVIN', role: 'MDF SUPERINTENDENT' },
  chris: { name: 'CHRIS', role: 'MAINT. SUPERINTENDENT' },
  terry: { name: 'TERRY', role: 'STAR MILLWRIGHT' },
  dave: { name: 'DAVE', role: 'MILLWRIGHT (VIGILANT)' },
  tod: { name: 'TOD', role: 'SHIFT LEADER, C-CREW' },
};

export function buildCrew() {
  const crew = $('crew');
  crew.innerHTML = '';
  for (const id of Object.keys(CREW_META)) {
    const div = document.createElement('div');
    div.className = 'card';
    div.id = `card-${id}`;
    div.innerHTML = `
      <div><span class="c-name">${CREW_META[id].name}</span><span class="c-role">${CREW_META[id].role}</span></div>
      <div><span class="c-status"></span><span class="c-stat"></span></div>
      <div class="minibar hidden"><div class="minifill"></div></div>`;
    crew.appendChild(div);
  }
}

function renderCrew(state) {
  const N = state.npcs;
  const set = (id, status, cls, stat, barPct) => {
    const card = $(`card-${id}`);
    const s = card.querySelector('.c-status');
    s.textContent = status; s.className = `c-status ${cls || ''}`;
    card.querySelector('.c-stat').textContent = stat;
    const bar = card.querySelector('.minibar');
    if (barPct == null) bar.classList.add('hidden');
    else { bar.classList.remove('hidden'); bar.querySelector('.minifill').style.width = `${barPct}%`; }
  };

  const k = N.kevin;
  set('kevin',
    k.status === 'HIDING' ? 'HIDING' : k.status === 'MANDATORY_FUN' ? 'MORALE PIZZA' : k.status,
    k.status === 'HIDING' ? 'bad' : '',
    `puns delivered: ${k.punsDeliveredThisShift}`, null);

  const c = N.chris;
  set('chris',
    c.status === 'ON_SITE' ? `ON ${c.target}` : c.status === 'EN_ROUTE' ? `EN ROUTE → ${c.target}` : c.status,
    c.status === 'AVAILABLE' ? '' : 'warn',
    `confidence: ${c.confidenceLevel}% (only goes up)`, null);

  const t = N.terry;
  set('terry',
    t.status === 'ON_BREAK' ? `ON BREAK (${t.breakTicksRemaining}m — un-bypassable)`
      : t.status === 'CLOCKED_OUT' ? 'GONE HOME. quote: "No."' : t.status,
    t.status === 'AVAILABLE' ? '' : t.status === 'CLOCKED_OUT' ? 'bad' : 'warn',
    `stamina · fixes: ${t.fixesThisShift}`, t.stamina);

  const d = N.dave;
  set('dave',
    d.status === 'ON_STRIKE' ? `ON STRIKE (${d.strikeTicksRemaining}m, perimeter unverified)`
      : d.status === 'MONOLOGUING' ? 'MONOLOGUING (answer him)'
      : state.meta.tick < d.sulkUntil ? 'AVAILABLE (sulking audibly)'
      : d.status + (state.meta.tick < d.boostUntil ? ' (+20% forum torque)' : ''),
    d.status === 'ON_STRIKE' ? 'bad' : d.status === 'MONOLOGUING' ? 'warn' : '',
    `trust: ${d.trustInSpencer} · theories endorsed: ${d.theoriesEndorsedByManagement}`, d.trustInSpencer);

  const tod = N.tod;
  const eta = Math.max(0, tod.nextPitchTick - state.meta.tick);
  set('tod', tod.grudge ? 'REMEMBERS THE DISPUTE' : 'CIRCLING', tod.grudge ? 'warn' : '',
    `next "deal" ETA ~${eta}m · pitches: ${tod.pitchesMade}`, null);
}

function renderResources(state) {
  const R = state.resources;
  $('fiber-fill').style.width = `${(R.woodFiber / BALANCE.CAPS.fiber) * 100}%`;
  $('fiber-val').textContent = `${R.woodFiber.toFixed(0)}t`;
  $('resin-fill').style.width = `${(R.resin / BALANCE.CAPS.resin) * 100}%`;
  $('resin-val').textContent = `${R.resin.toFixed(1)}t`;
  $('quality-fill').style.width = `${state.plant.quality}%`;
  $('quality-fill').className = `fill ${state.plant.quality > 60 ? 'green' : 'amber'}`;
  $('quality-val').textContent = state.plant.quality.toFixed(0);
  $('glue-fill').style.width = `${state.plant.gluePileup}%`;
  $('glue-val').textContent = `${state.plant.gluePileup.toFixed(0)}%`;
  $('fiber-price').textContent = money(fiberPrice(state));
  $('rush-price').textContent = money(rushFiberPrice(state));
  $('resin-price').textContent = money(resinPrice(state));
  $('btn-fiber').disabled = R.cash < fiberPrice(state) || R.woodFiber >= BALANCE.CAPS.fiber;
  $('btn-rush').disabled = R.cash < rushFiberPrice(state) || R.woodFiber >= BALANCE.CAPS.fiber;
  $('btn-resin').disabled = R.cash < resinPrice(state) || R.resin >= BALANCE.CAPS.resin;
  $('btn-calibrate').disabled = R.cash < BALANCE.ECONOMY.CALIBRATE.cost;
  $('btn-cleanup').disabled = R.cash < BALANCE.GLUE.CLEANUP_COST;
  $('btn-purge').classList.toggle('hidden', !state.flags.contaminated);
  $('btn-purge').disabled = R.cash < BALANCE.TOD.PURGE_COST;
}

let lastTickerLen = -1;
function renderTicker(state) {
  if (state.events.log.length === lastTickerLen) return;
  lastTickerLen = state.events.log.length;
  const lines = state.events.log.slice(-BALANCE.UI.TICKER_LINES);
  $('ticker').innerHTML = lines.map(l => {
    const who = l.speaker ? ` ${l.speaker}:` : '';
    return `<div class="tline sev-${l.severity} ch-${l.channel}"><span class="tstamp">[${clockString(l.tick)}] ${l.channel}${who}</span> ${escapeHtml(l.text)}</div>`;
  }).join('');
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderChoice(state) {
  const c = state.events.pendingChoice;
  const modal = $('choice-modal');
  if (!c) { modal.classList.add('hidden'); return; }
  modal.classList.remove('hidden');
  $('choice-prompt').textContent = c.prompt;
  $('choice-0').textContent = c.options[0];
  $('choice-1').textContent = c.options[1];
  $('choice-squelch-fill').style.width = `${(c.timer / c.timerTicks) * 100}%`;
}

// --------------------------------------------------------------- endings ---
export function renderEnd(state) {
  const over = state.meta.gameOver;
  const ending = ENDINGS[over.endingId];
  $('end-title').textContent = ending.title;
  $('end-copy').textContent = ending.copy;
  $('end-grade').textContent = over.win ? `SHIFT GRADE: ${over.grade}` : 'SHIFT GRADE: N/A (see above)';
  const s = state.stats;
  const rows = [
    ['Board produced', `${state.resources.boardsProduced.toFixed(1)} m³`],
    ['Board scrapped', `${state.resources.boardsScrapped.toFixed(1)} m³`],
    ['Final cash', money(state.resources.cash)],
    ['Peak blood pressure', s.peakBP.toFixed(0)],
    ['Puns endured', `${s.punsEndured} (${s.woodPunsEndured} wood-related)`],
    ['Theories endorsed by management', state.npcs.dave.theoriesEndorsedByManagement],
    ['Tod deals: declined / burned / survived', `${s.tradesDeclined} / ${s.scamsBurned} / ${s.scamsSurvived}`],
    ['Terry fixes', s.terryFixes],
    ['Chris deployments (secondary failures)', `${s.chrisDeployments} (${s.chrisSecondaryFailures})`],
    ['Coffees / locker screams', `${s.coffees} / ${s.screams}${s.involuntaryScreams ? ` (${s.involuntaryScreams} involuntary)` : ''}`],
    ['Breakdowns', s.breakdowns],
    ['Fines paid', money(s.finesPaid)],
  ];
  $('end-stats').innerHTML = rows.map(([k, v]) => `<span class="k">${k}</span><span>${v}</span>`).join('');
  $('end-dayshift').textContent = over.win
    ? `Day shift arrives. First words: "What is THAT by the blender?" (glue pileup at handover: ${state.plant.gluePileup.toFixed(0)}%.)`
    : `Glue pileup at time of incident: ${state.plant.gluePileup.toFixed(0)}%. Someone will have to explain that. It will not be Kevin.`;
  $('end-overlay').classList.remove('hidden');
}
