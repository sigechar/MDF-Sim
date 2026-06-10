// UI smoke test (not part of npm test; needs jsdom installed).
// Boots the real index.html in jsdom, clicks CLOCK IN, then drives the real
// engine + real render for full shifts, clicking real buttons along the way.
// Any render-path exception in any reachable game state fails this script.

import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;

const { createInitialState } = await import('../src/state.js');
const { tickGame } = await import('../src/engine/tick.js');
const { buildMachineGrid, buildCrew, render, renderEnd } = await import('../src/ui/hmi.js');
const { BALANCE } = await import('../src/balance.js');

let deployRequests = [];
buildMachineGrid((npc, machineId) => deployRequests.push({ type: 'DEPLOY', npc, machineId }));
buildCrew();

let renders = 0;
for (const seed of [11, 222, 3333, 44444]) {
  const state = createInitialState(seed, 'SHIFT_LEADER');
  let guard = 0;
  while (!state.meta.gameOver && guard++ < BALANCE.TICKS_PER_SHIFT + 5) {
    const actions = [...deployRequests];
    deployRequests = [];
    // poke the real buttons sometimes, like a stressed human would
    if (guard % 50 === 0) document.getElementById('btn-coffee').click();
    if (state.events.pendingChoice) actions.push({ type: 'CHOICE', optionIndex: guard % 2 });
    const down = BALANCE.CHAIN.find(id => ['DOWN', 'CHRISED'].includes(state.plant.machines[id].status));
    if (down && guard % 7 === 0) {
      const btn = document.querySelector(`#m-${down} button[data-npc="${guard % 2 ? 'terry' : 'dave'}"]`);
      if (btn && !btn.disabled) btn.click();
    }
    tickGame(state, actions);
    render(state);
    renders++;
  }
  renderEnd(state);
  console.log(`seed ${seed}: ${state.meta.gameOver.endingId} after ${state.meta.tick} ticks — rendered clean`);
}
console.log(`\nUI smoke test passed: ${renders} full renders, zero exceptions.`);
