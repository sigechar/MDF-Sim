// Orientation tour: the walkthrough nobody gave Spencer on HIS first night.
// Runs over a paused game. Pointer + description per section, then you're on
// your own, which is also how the actual job works.

const $ = id => document.getElementById(id);

const STEPS = [
  {
    sel: '#hdr-clock', title: 'THE SHIFT CLOCK',
    copy: '18:00 to 06:00. Twelve hours. The clock is the only thing in this plant guaranteed to keep running, and it is not on your side.',
  },
  {
    sel: '#pace-wrap', title: 'THE NUMBER',
    copy: 'Corporate wants this many cubic meters of board by morning. Cyan bar: what you\'ve made. Amber notch: where you SHOULD be by now. When cyan trails amber, corporate sends emails. The emails raise your blood pressure. This is called "alignment."',
  },
  {
    sel: '#hdr-cash', title: 'THE BUDGET',
    copy: 'Repairs, fiber, resin, fines, and one (1) cleanup crew all come out of this. Below –$5,000, accounts payable starts paying the resin vendor in lanyards, and the shift ends. Badly.',
  },
  {
    sel: '#machine-grid', title: 'THE LINE',
    copy: 'Six machines in a row. Fiber goes in the left end, saleable board comes out the right end, and everything in between is negotiable. When one goes DOWN, everything after it starves. Lamps: green is fine, amber is complaining, red is a career development opportunity.',
  },
  {
    sel: '#m-REFINER .m-deploy', title: 'WHO YOU CALL',
    copy: 'When a machine is down, pick your fighter. TERRY: $600, instant, perfect — and finite. DAVE: $400, twelve minutes, excellent work, 65% chance of a conversation afterward. CHRIS: $0*. The asterisk has its own incident file.',
  },
  {
    sel: '#goo-label', title: 'GLUE PILEUP',
    copy: 'Resin reaches the floor faster than anyone cleans it. At 100% the plant becomes one solid object and you become a museum exhibit. The cleanup crew costs $1,200 and is worth approximately $1,199 of that.',
  },
  {
    sel: '#kevin-office', title: 'THE FLOOR (AND KEVIN\'S OFFICE)',
    copy: 'Those little people are your coworkers. Watch where they walk — it matters. Kevin\'s light is the truth: light on, Kevin is contained. Light off, there is a crisis somewhere, Kevin has evaporated, and his share of it routes to you at 1.5×.',
  },
  {
    sel: '#panel-c', title: 'YOUR BLOOD PRESSURE',
    copy: 'The only gauge in here corporate doesn\'t track. GREEN: fine. AMBER: your hands shake — buttons take half a second. RED: everything bad happens 25% faster. 240: you walk into the tree line. Coffee helps. Three coffees does not. The locker is soundproof. Mostly.',
  },
  {
    sel: '#panel-d', title: 'THE ROSTER',
    copy: 'Live status on all five of them. The little bars matter: Terry\'s is stamina, Dave\'s is trust. When Terry\'s hits 30 he takes a 45-minute break that no force in this universe can shorten. Plan around it. Everyone else does.',
  },
  {
    sel: '#panel-e', title: 'SUPPLIES',
    copy: 'Fiber feeds the line, resin glues it together. QUALITY decides how much of your board actually counts — CALIBRATE buys some back. HOUSEKEEPING is the glue pileup again, because it earned two gauges.',
  },
  {
    sel: '#panel-f', title: 'THE RADIO',
    copy: 'Everything anyone says, breaks, or sells shows up here. Read it. It is the only coworker that tells you the truth, and the only one that won\'t interrupt you.',
  },
  {
    sel: null, title: 'INCOMING TRANSMISSIONS',
    copy: 'People will corner you with a timer and two buttons. The timer is them, standing there, waiting. Silence counts as an answer, and it is usually the wrong one. That\'s the whole orientation. The day shift left you a note. It says "good luck." The "luck" is underlined twice.',
  },
];

let idx = 0;
let onDone = null;

export function startTour(done) {
  onDone = done;
  idx = 0;
  $('tour-overlay').classList.remove('hidden');
  $('tour-next').onclick = () => { idx++; idx >= STEPS.length ? finish() : show(); };
  $('tour-skip').onclick = finish;
  show();
}

function show() {
  const s = STEPS[idx];
  const hl = $('tour-highlight');
  const card = $('tour-card');
  $('tour-title').textContent = s.title;
  $('tour-copy').textContent = s.copy;
  $('tour-progress').textContent = `${idx + 1} / ${STEPS.length}`;
  $('tour-next').textContent = idx === STEPS.length - 1 ? 'CLOCK IN ▸' : 'NEXT ▸';

  const vw = window.innerWidth, vh = window.innerHeight;
  if (s.sel) {
    const r = document.querySelector(s.sel).getBoundingClientRect();
    hl.classList.remove('noring');
    hl.style.left = `${r.left - 5}px`;
    hl.style.top = `${r.top - 5}px`;
    hl.style.width = `${r.width + 10}px`;
    hl.style.height = `${r.height + 10}px`;
    const ch = card.offsetHeight || 160;
    const cw = card.offsetWidth || 420;
    let top = r.bottom + 14;
    if (top + ch > vh - 8) top = Math.max(8, r.top - ch - 14);
    let left = Math.min(Math.max(8, r.left), vw - cw - 8);
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  } else {
    hl.classList.add('noring');
    hl.style.left = `${vw / 2}px`;
    hl.style.top = `${vh / 2}px`;
    hl.style.width = '0px';
    hl.style.height = '0px';
    card.style.left = `${(vw - (card.offsetWidth || 420)) / 2}px`;
    card.style.top = `${vh * 0.32}px`;
  }
}

function finish() {
  $('tour-overlay').classList.add('hidden');
  if (onDone) onDone();
  onDone = null;
}
