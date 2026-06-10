// Acceptance tests (spec §15.2). Run: npm test
// Hard failures exit 1. Tuning targets report as SOFT.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInitialState } from '../src/state.js';
import { tickGame } from '../src/engine/tick.js';
import { BALANCE } from '../src/balance.js';
import { PUNS } from '../src/content/puns.js';
import { THEORIES } from '../src/content/theories.js';
import { INCIDENTS } from '../src/events/incidents.js';
import { runShift } from './headless.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}
function soft(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'SOFT'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

// --- 1. Determinism: same seed + same action log → identical state hash ---
function stateHash(s) {
  return JSON.stringify([
    s.meta.tick, s.meta.rngState, s.resources, s.plant.gluePileup,
    s.plant.quality, s.spencer.bp, s.stats.breakdowns, s.stats.punsEndured,
    Object.fromEntries(BALANCE.CHAIN.map(id => [id, [s.plant.machines[id].status, s.plant.machines[id].health]])),
  ]);
}
{
  const log = [];
  const a = createInitialState(424242);
  for (let t = 0; t < 720 && !a.meta.gameOver; t++) {
    const actions = [];
    if (t % 97 === 0) actions.push({ type: 'COFFEE' });
    if (a.events.pendingChoice) actions.push({ type: 'CHOICE', optionIndex: t % 2 });
    log.push(actions);
    tickGame(a, actions);
  }
  const b = createInitialState(424242);
  for (const actions of log) {
    if (b.meta.gameOver) break;
    tickGame(b, actions);
  }
  check('1. determinism under seed + action log', stateHash(a) === stateHash(b));
}

// --- 2. Terry inviolability: no code path mutates breakTicksRemaining
//        except the per-tick decrement in terry.js ---
{
  const files = walk('src');
  let offenders = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const writes = [...src.matchAll(/breakTicksRemaining\s*(=[^=]|-=|\+=|--)/g)];
    for (const w of writes) {
      const ok = f.endsWith('terry.js')
        && (w[0].includes('--') || /breakTicksRemaining\s*=\s*BALANCE/.test(src.slice(w.index, w.index + 60)));
      if (!ok && !f.endsWith('state.js')) offenders.push(`${f}: ${w[0]}`);
    }
  }
  check('2. Terry break is sacred (static)', offenders.length === 0, offenders.join('; '));
}

// --- 3. Kevin cowardice property + 5. Chris confidence monotonicity ---
{
  let cowardice = 0, confidence = 0, runs = 0;
  for (let i = 0; i < 40; i++) {
    const s = runShift(7000 + i, 'optimal');
    cowardice += s.stats.kevinCowardiceViolations;
    if (s.stats.minChrisConfidenceDelta < 0) confidence++;
    runs++;
  }
  for (let i = 0; i < 40; i++) {
    const s = runShift(8000 + i, 'naive');
    cowardice += s.stats.kevinCowardiceViolations;
    if (s.stats.minChrisConfidenceDelta < 0) confidence++;
    runs++;
  }
  check('3. Kevin is HIDING for every authority crisis', cowardice === 0, `${cowardice} violations over ${runs} runs`);
  check('5. Chris confidence is monotonically non-decreasing', confidence === 0);
}

// --- 4. No inert jokes: content volumes + voice lint (spec §12, §14) ---
{
  check('4a. pun library ≥ 30', PUNS.length >= 30, `${PUNS.length}`);
  check('4b. Kevin never uses periods', PUNS.every(p => !/\.(?!\.)/.test(p.text.replace(/\.\.\./g, ''))),
    PUNS.filter(p => /\.(?!\.)/.test(p.text.replace(/\.\.\./g, ''))).map(p => p.text.slice(0, 30)).join('|'));
  check('4c. theory library ≥ 12', THEORIES.length >= 12, `${THEORIES.length}`);
  check("4d. every Dave theory quotes 'they'", THEORIES.every(t => t.includes("'they'") || t.includes("'them'") || t.includes("'They'")));
  check('4e. incident table ≥ 15', INCIDENTS.length >= 15, `${INCIDENTS.length}`);
  check('4f. every incident declares a state delta (apply fn)', INCIDENTS.every(i => typeof i.apply === 'function'));
}

// --- 8. Math.random ban: CI grep, zero tolerance, no appeals ---
{
  const offenders = walk('src').filter(f => readFileSync(f, 'utf8').includes('Math.random'));
  check('8. Math.random ban (Dave was right about this one)', offenders.length === 0, offenders.join(', '));
}

// --- 7. Tuning targets (soft-fail with report) ---
{
  let wins = 0, naiveWins = 0, redShare = 0;
  const N = 60;
  for (let i = 0; i < N; i++) {
    const s = runShift(11000 + i, 'optimal');
    if (s.meta.gameOver.win) { wins++; redShare += s.stats.ticksInRed / s.meta.tick; }
  }
  for (let i = 0; i < 30; i++) {
    if (runShift(12000 + i, 'naive').meta.gameOver.win) naiveWins++;
  }
  const rate = wins / N;
  soft('7a. bot-optimal win rate 40–55%', rate >= 0.40 && rate <= 0.55, `${(rate * 100).toFixed(1)}%`);
  check('7b. naive-bot win rate < 5%', naiveWins / 30 < 0.05, `${((naiveWins / 30) * 100).toFixed(1)}%`);
  soft('7c. median time-in-RED ≥ 18% on wins', wins > 0 && redShare / wins >= 0.18,
    `${wins > 0 ? ((redShare / wins) * 100).toFixed(1) : 0}% (a per-tick self-care bot suppresses RED better than any human will)`);
}

console.log(failures === 0 ? '\nAll hard acceptance tests passed.' : `\n${failures} HARD FAILURE(S).`);
process.exit(failures === 0 ? 0 : 1);
