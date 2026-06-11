// Game lifecycle: boot, loop, speed control, the pause tax, input lag,
// the un-dismissable pun toast, and localStorage persistence.

import { BALANCE } from './balance.js';
import { createInitialState } from './state.js';
import { tickGame } from './engine/tick.js';
import { bpZone } from './engine/bp.js';
import { buildMachineGrid, buildCrew, buildActors, render, renderEnd } from './ui/hmi.js';
import { startTour } from './ui/tour.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'mdf-sim-save-v1';
const SOUND_KEY = 'mdf-sim-sound';

let state = null;
let pendingActions = [];
let timer = null;
let speed = 1;
let paused = false;
let pauseStartedAt = 0;
let punShownForTick = -1;
let soundOn = (typeof localStorage !== 'undefined' && localStorage.getItem(SOUND_KEY)) !== 'off';

// ----------------------------------------------------------------- loop ---
function startLoop() {
  stopLoop();
  const interval = 1000 / (BALANCE.TICKS_PER_SECOND * speed);
  timer = setInterval(step, interval);
}
function stopLoop() { if (timer) clearInterval(timer); timer = null; }

let frame = 0;
function step() {
  if (!state || paused || state.meta.gameOver) return;
  // While a transmission waits, the world runs at 1/3 speed so you can
  // actually read what these people are saying to you (queued answers
  // still go through immediately).
  frame++;
  if (state.events.pendingChoice && pendingActions.length === 0
    && frame % BALANCE.UI.CHOICE_DILATION !== 0) return;
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

// --------------------------------------------------------- intro tone ---
// The Ranger Board MDF shift-start jingle plays over a CRT boot splash while
// the plant is frozen, then the shift begins. Clock-in is a real user gesture,
// so playback is never autoplay-blocked. Robust to no-audio environments
// (tests): if play() doesn't return a real promise, we resolve immediately.
function playIntro(onDone) {
  const splash = $('intro-splash');
  const audio = $('intro-audio');
  if (!soundOn || !splash || !audio) { onDone(); return; }

  let done = false;
  let timeout = null;
  const finish = () => {
    if (done) return;
    done = true;
    if (timeout) clearTimeout(timeout);
    window.removeEventListener('keydown', onKey);
    splash.classList.add('fading');
    setTimeout(() => splash.classList.add('hidden'), 500);
    try { audio.pause(); } catch { /* no audio backend */ }
    onDone();
  };
  const onKey = () => finish();

  splash.classList.remove('hidden', 'fading');
  splash.onclick = finish;
  window.addEventListener('keydown', onKey);
  audio.onended = finish;

  try {
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      // Real browser: hold the splash until the tone finishes; bail on error.
      p.catch(() => finish());
      timeout = setTimeout(finish, 25000); // safety net if 'ended' never fires
    } else {
      // No real media backend (e.g. headless test): don't hang the shift.
      finish();
    }
  } catch {
    finish();
  }
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

function updateSoundBtn() {
  const b = $('btn-sound');
  if (!b) return;
  b.textContent = `♪ INTRO TONE: ${soundOn ? 'ON' : 'OFF'}`;
  b.classList.toggle('on', soundOn);
}

function wire() {
  buildMachineGrid((npc, machineId) => {
    const btn = document.querySelector(`#m-${machineId} button[data-npc="${npc}"]`);
    act({ type: 'DEPLOY', npc, machineId }, btn);
  });
  buildCrew();
  buildActors();

  const simple = [
    ['btn-fiber', 'BUY_FIBER'], ['btn-rush', 'RUSH_FIBER'], ['btn-resin', 'BUY_RESIN'],
    ['btn-calibrate', 'CALIBRATE'], ['btn-cleanup', 'CLEANUP'], ['btn-purge', 'PURGE'],
    ['btn-coffee', 'COFFEE'], ['btn-scream', 'SCREAM'],
    ['btn-rate-up', 'RATE_UP'], ['btn-rate-down', 'RATE_DOWN'],
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
    // The plant powers on to the shift tone; freeze it until the jingle ends.
    setPausedSafe(true);
    playIntro(() => setPausedSafe(false));
  });
  $('btn-start-tour').addEventListener('click', () => {
    const seed = parseInt($('seed-input').value, 10) || Math.floor(Date.now() % 2147483647);
    newGame(seed, $('difficulty-input').value);
    // Shift tone, then orientation — both over a frozen clock. No pause tax
    // either; even Kevin respects orientation. ESPECIALLY Kevin.
    setPausedSafe(true);
    playIntro(() => startTour(() => setPausedSafe(false)));
  });
  $('btn-sound').addEventListener('click', () => {
    soundOn = !soundOn;
    try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch { /* private mode */ }
    updateSoundBtn();
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
    $('brief-target').textContent = `${BALANCE.TARGETS[e.target.value]} msf`;
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.addEventListener('beforeunload', saveGame);

  // boot
  $('seed-input').value = Math.floor(Date.now() % 2147483647);
  updateSoundBtn();
  if (loadGame()) $('btn-resume').classList.remove('hidden');
}

wire();
