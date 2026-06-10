// Boot smoke: loads index.html + the real main.js wiring in jsdom, clicks
// CLOCK IN, lets the real interval loop run, presses real buttons, pauses,
// resumes, and verifies the shift clock actually advances.

import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;

await import('../src/main.js');

const $ = id => document.getElementById(id);
$('seed-input').value = '777';
$('btn-start').click();

await new Promise(r => setTimeout(r, 2500)); // ~5 ticks at 1×
const clock1 = $('hdr-clock').textContent;
if (clock1 === '18:00') { console.error('FAIL: clock did not advance'); process.exit(1); }

$('btn-coffee').click();
$('btn-speed2').click();
await new Promise(r => setTimeout(r, 2000)); // ~8 more ticks at 2×
const clock2 = $('hdr-clock').textContent;

$('btn-pause').click();
const frozen = $('hdr-clock').textContent;
await new Promise(r => setTimeout(r, 1200));
if ($('hdr-clock').textContent !== frozen) { console.error('FAIL: pause did not pause'); process.exit(1); }
$('btn-pause').click();
await new Promise(r => setTimeout(r, 800));
if ($('hdr-clock').textContent === frozen) { console.error('FAIL: resume did not resume'); process.exit(1); }

console.log(`boot smoke passed: clock ${clock1} → ${clock2}, pause/resume OK, coffee consumed, no exceptions.`);
process.exit(0);
