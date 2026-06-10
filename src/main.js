// Game lifecycle: boot, loop, speed control, the pause tax, input lag,
// the un-dismissable pun toast, and localStorage persistence.

import { BALANCE } from './balance.js';
import { createInitialState } from './state.js';
import { tickGame } from './engine/tick.js';
import { bpZone } from './engine/bp.js';
import { buildMachineGrid, buildCrew, render, renderEnd } from './ui/hmi.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'mdf-sim-save-v1';

let state = null;
let pendingActions = [];
let timer = null;
let speed = 1;
let paused = false;
let pauseStartedAt = 0;
let punShownForTick = -1;

// ----------------------------------------------------------------- loop ---
function startLoop() {
  stopLoop();
  const interval = 1000 / (BALANCE.TICKS_PER_SECOND * speed);
  timer = setInterval(step, interval);
}
function stopLoop() { if (timer) clearInterval(timer); timer = null; }

function step() {
  if (!state || paused || state.meta.gameOver) return;
  const actions = pendingActions;
  pendingActions = [];
  tickGame(state, actions);
  render(state);
  maybeShowPun();
  if (state.meta.gameOver) {
    stopLoop();
    localStorage.removeItem(SAVE_KEY);
    renderEnd(state);
  }
}

// Queue a player action for the next engine tick (spec §2 step 5).
// In AMBER+ zones, hands shake: 0.5s artificial input lag (spec §7.5).
function act(action, sourceBtn) {
  if (!state || state.meta.gameOver) return;
  const zone = bpZone(state.spencer.bp);
  if (zone !== 'GREEN' && sourceBtn) {
    sourceBtn.classList.add('lagging');
    setTimeout(() => {
      sourceBtn.classList.remove('lagging');
      pendingActions.push(action);
    }, 500);
  } else {
    pendingActions.push(action);
  }
}

// ------------------------------------------------------------- pun toast ---
function maybeShowPun() {
  const pun = state.events.lastPun;
  if (!pun || pun.tick === punShownForTick) return;
  punShownForTick = pun.tick;
  $('pun-text').textContent = pun.text;
  $('pun-toast').classList.remove('hidden');
  // 4 seconds. CANNOT be dismissed early. The un-skippable pun IS the mechanic.
  setTimeout(() => $('pun-toast').classList.add('hidden'), 4000);
}

// ------------------------------------------------------------ pause tax ---
function setPaused(p) {
  if (!state || state.meta.gameOver) return;
  paused = p;
  $('btn-pause').classList.toggle('on', p);
  if (p) {
    pauseStartedAt = Date.now();
    saveGame();
    setTimeout(() => {
      if (paused && Date.now() - pauseStartedAt >= 10000) $('pause-kevin').classList.remove('hidden');
    }, 10000);
  } else {
    $('pause-kevin').classList.add('hidden');
    if (Date.now() - pauseStartedAt > 10000) {
      // Hiding from the game summons the game's worst part (spec §4)
      state.npcs.kevin.ambushBoostTicks = BALANCE.KEVIN.PAUSE_AMBUSH_TICKS;
    }
  }
}

// ----------------------------------------------------------- persistence ---
function saveGame() {
  if (state && !state.meta.gameOver) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}
function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  return raw ? JSON.parse(raw) : null;
}

// --------------------------------------------------------------- wiring ---
function newGame(seed, difficulty) {
  state = createInitialState(seed, difficulty);
  pendingActions = [];
  punShownForTick = -1;
  $('start-overlay').classList.add('hidden');
  $('end-overlay').classList.add('hidden');
  setPausedSafe(false);
  render(state);
  startLoop();
}
function setPausedSafe(p) { paused = p; $('btn-pause').classList.toggle('on', p); }

function wire() {
  buildMachineGrid((npc, machineId) => {
    const btn = document.querySelector(`#m-${machineId} button[data-npc="${npc}"]`);
    act({ type: 'DEPLOY', npc, machineId }, btn);
  });
  buildCrew();

  const simple = [
    ['btn-fiber', 'BUY_FIBER'], ['btn-rush', 'RUSH_FIBER'], ['btn-resin', 'BUY_RESIN'],
    ['btn-calibrate', 'CALIBRATE'], ['btn-cleanup', 'CLEANUP'], ['btn-purge', 'PURGE'],
    ['btn-coffee', 'COFFEE'], ['btn-scream', 'SCREAM'],
  ];
  for (const [id, type] of simple) {
    $(id).addEventListener('click', e => act({ type }, e.currentTarget));
  }
  $('choice-0').addEventListener('click', e => act({ type: 'CHOICE', optionIndex: 0 }, e.currentTarget));
  $('choice-1').addEventListener('click', e => act({ type: 'CHOICE', optionIndex: 1 }, e.currentTarget));

  $('btn-speed1').addEventListener('click', () => { speed = 1; $('btn-speed1').classList.add('on'); $('btn-speed2').classList.remove('on'); startLoop(); });
  $('btn-speed2').addEventListener('click', () => { speed = 2; $('btn-speed2').classList.add('on'); $('btn-speed1').classList.remove('on'); startLoop(); });
  $('btn-pause').addEventListener('click', () => setPaused(!paused));

  $('btn-start').addEventListener('click', () => {
    const seed = parseInt($('seed-input').value, 10) || Math.floor(Date.now() % 2147483647);
    newGame(seed, $('difficulty-input').value);
  });
  $('btn-resume').addEventListener('click', () => {
    const saved = loadGame();
    if (!saved) return;
    state = saved;
    pendingActions = [];
    punShownForTick = state.events.lastPun ? state.events.lastPun.tick : -1;
    $('start-overlay').classList.add('hidden');
    setPausedSafe(false);
    render(state);
    startLoop();
  });
  $('btn-again').addEventListener('click', () => newGame(Math.floor(Date.now() % 2147483647), state.meta.difficulty));
  $('btn-retry').addEventListener('click', () => newGame(state.meta.seed, state.meta.difficulty));

  $('difficulty-input').addEventListener('change', e => {
    $('brief-target').textContent = `${BALANCE.TARGETS[e.target.value]} m³`;
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.addEventListener('beforeunload', saveGame);

  // boot
  $('seed-input').value = Math.floor(Date.now() % 2147483647);
  if (loadGame()) $('btn-resume').classList.remove('hidden');
}

wire();
