// Tiny vector coworkers for the plant floor. No emojis — honest pixels only.
// Each sprite is ~26×36 and carries one prop, because characterization is
// load-bearing even at 26 pixels wide.

const SKIN = '#d4a373';
const PANTS = '#2b2f36';
const VEST = '#ff8c1a';
const STRIPE = '#ffe14d';

function person({ hat, shirt = VEST, stripe = true, extras = '' }) {
  return `<svg viewBox="0 0 26 36" width="26" height="36" aria-hidden="true">
    <rect x="9" y="26" width="3.2" height="9" fill="${PANTS}"/>
    <rect x="14" y="26" width="3.2" height="9" fill="${PANTS}"/>
    <rect x="7" y="14" width="12" height="13" rx="2" fill="${shirt}"/>
    ${stripe ? `<rect x="7" y="19" width="12" height="2.2" fill="${STRIPE}"/>` : ''}
    <rect x="4" y="15" width="3" height="9" rx="1.5" fill="${shirt}"/>
    <rect x="19" y="15" width="3" height="9" rx="1.5" fill="${shirt}"/>
    <circle cx="13" cy="8.5" r="4.6" fill="${SKIN}"/>
    ${hat}${extras}
  </svg>`;
}

const hardHat = color => `<path d="M7.8 7.6 a5.2 5.2 0 0 1 10.4 0 z" fill="${color}"/>
  <rect x="6.6" y="7.2" width="12.8" height="1.8" rx="0.9" fill="${color}"/>`;

export const SPRITES = {
  // white hat, office shirt, tie, and a mug that says something about teamwork
  kevin: person({
    hat: hardHat('#e8e8e8'),
    shirt: '#b9c4cf', stripe: false,
    extras: `<path d="M13 14 l1.5 3 -1.5 5.5 -1.5 -5.5 z" fill="#8a2331"/>
      <rect x="1.6" y="20.5" width="4.6" height="4" rx="1" fill="#e8e8e8"/>
      <rect x="0.6" y="21.5" width="1.4" height="2" rx="0.7" fill="#e8e8e8"/>`,
  }),
  // red hat, supervisor blue, clipboard at 95% confidence
  chris: person({
    hat: hardHat('#d9362b'),
    shirt: '#3b6ea5', stripe: false,
    extras: `<g transform="rotate(8 21.5 23.5)">
      <rect x="18.6" y="20" width="6" height="7.4" rx="0.8" fill="#dfe3e8"/>
      <rect x="19.8" y="21.6" width="3.6" height="0.9" fill="#9aa4ae"/>
      <rect x="19.8" y="23.2" width="3.6" height="0.9" fill="#9aa4ae"/>
      <rect x="19.8" y="24.8" width="2.2" height="0.9" fill="#9aa4ae"/></g>`,
  }),
  // yellow hat, hi-vis, one wrench. it is enough.
  terry: person({
    hat: hardHat('#f2c500'),
    extras: `<g transform="rotate(16 21 17)">
      <rect x="20" y="13" width="2" height="9" rx="1" fill="#aab4be"/>
      <circle cx="21" cy="12.4" r="2" fill="none" stroke="#aab4be" stroke-width="1.5"/></g>`,
  }),
  // green hat with a personal antenna (don't ask — he'll tell you), and the
  // big red wrench, torqued to specs 'they' don't publish
  dave: person({
    hat: hardHat('#3f7d44') + `<line x1="13" y1="3.4" x2="13" y2="0.9" stroke="#cfd6dd" stroke-width="1"/>
      <circle cx="13" cy="0.9" r="0.9" fill="#cfd6dd"/>`,
    extras: `<g transform="rotate(-14 3.8 18)">
      <rect x="2.6" y="12.5" width="2.4" height="11.5" rx="1.2" fill="#c0392b"/>
      <path d="M1.6 11.2 l4.4 -1.2 0.8 2.4 -4.4 1.2 z" fill="#c0392b"/></g>`,
  }),
  // no hat. visitor hair, visitor badge, and the briefcase of deals
  tod: person({
    hat: `<path d="M8.2 7.4 a4.8 4.8 0 0 1 9.6 0 l-1.4 0.7 -2 -1.5 -2.4 1.5 -2.3 -1.3 z" fill="#5a4632"/>`,
    shirt: '#7d8a96', stripe: false,
    extras: `<path d="M11.3 14 l1.7 5 1.7 -5" fill="none" stroke="#c0392b" stroke-width="1.2"/>
      <rect x="12.1" y="19" width="1.8" height="2.4" rx="0.4" fill="#e8e8e8"/>
      <rect x="18.6" y="22" width="6.2" height="5" rx="1" fill="#6b4f2f"/>
      <rect x="20.8" y="20.8" width="1.8" height="1.4" rx="0.7" fill="none" stroke="#6b4f2f" stroke-width="1"/>`,
  }),
};
