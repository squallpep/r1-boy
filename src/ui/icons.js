// Line-art SVG icons drawn in the phosphor color (stroke = currentColor).
const svg = (body, vb = '0 0 32 32', cls = 'ico') =>
  `<svg class="${cls}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

// Original mascot: a little robot rabbit giving a thumbs up.
export const mascot = (cls = 'mascot') => svg(`
  <g class="m-body">
    <rect x="33" y="3" width="10" height="34" rx="5" transform="rotate(-12 38 37)"/>
    <rect x="57" y="3" width="10" height="34" rx="5" transform="rotate(12 62 37)"/>
    <path d="M36 12 l1 18 M64 12 l-1 18" stroke-width="1" opacity=".6"/>
    <rect x="25" y="33" width="50" height="38" rx="15"/>
    <rect x="32" y="42" width="36" height="14" rx="7"/>
    <circle cx="42" cy="49" r="2.6" fill="currentColor"/>
    <path d="M55 49 q3 -3 6 0"/>
    <path d="M40 62 q10 7 20 0"/>
    <path d="M29 58 h3 M68 58 h3" opacity=".7"/>
    <path d="M50 71 v5"/>
    <rect x="35" y="76" width="30" height="29" rx="8"/>
    <rect x="42" y="82" width="16" height="9" rx="2"/>
    <circle cx="46" cy="98" r="2"/><circle cx="54" cy="98" r="2"/>
    <path d="M35 82 q-9 6 -11 16"/><circle cx="23" cy="100" r="3.5"/>
  </g>
  <g class="m-arm">
    <path d="M65 82 q10 -2 13 -11"/>
    <rect x="73" y="60" width="11" height="12" rx="3"/>
    <rect x="76.5" y="50" width="4.5" height="12" rx="2.2"/>
    <path d="M73 64 h11 M73 68 h11" stroke-width="1" opacity=".6"/>
  </g>
  <g class="m-legs">
    <path d="M42 105 v13 M58 105 v13"/>
    <path d="M36 120 h10 M54 120 h10"/>
  </g>`, '0 0 100 124', cls);

export const icons = {
  lamp: svg('<path d="M11 4h10l-2 8h-6z"/><rect x="12" y="12" width="8" height="14" rx="1"/><path d="M15 16h2M16 1v-0M8 3l2 2M24 3l-2 2"/>'),
  compass: svg('<circle cx="16" cy="16" r="12"/><path d="M16 7l3 9-3 9-3-9z"/><path d="M16 4v2M16 26v2M4 16h2M26 16h2"/>'),
  level: svg('<rect x="3" y="11" width="26" height="10" rx="5"/><circle cx="16" cy="16" r="3"/><path d="M11 11v10M21 11v10"/>'),
  timer: svg('<circle cx="16" cy="18" r="10"/><path d="M16 18v-6M16 18l4 3M13 4h6M16 4v4M25 9l2-2"/>'),
  geiger: svg('<circle cx="16" cy="16" r="3"/><path d="M16 13l-4-8a12 12 0 0 1 8 0zM18.6 17.5l9 .5a12 12 0 0 1-4 7zM13.4 17.5l-5 7.5a12 12 0 0 1-4-7z"/>'),
  radio: svg('<rect x="3" y="10" width="26" height="17" rx="2"/><circle cx="11" cy="19" r="4"/><path d="M18 15h8M18 19h8M18 23h5M8 10l14-7"/>'),
  tv: svg('<rect x="3" y="7" width="26" height="18" rx="3"/><path d="M11 2l5 5 5-5M10 29h12"/>'),
  plus: svg('<path d="M16 6v20M6 16h20"/>'),
  check: svg('<path d="M6 17l6 6 14-14"/>'),
  perk: svg('<circle cx="16" cy="13" r="9"/><path d="M11 20l-3 9 8-4 8 4-3-9"/><path d="M16 8l1.5 3 3.5.5-2.5 2.4.6 3.4-3.1-1.6-3.1 1.6.6-3.4L11 11.5l3.5-.5z"/>'),
  lock: svg('<rect x="8" y="14" width="16" height="13" rx="2"/><path d="M11 14v-4a5 5 0 0 1 10 0v4M16 19v3"/>'),
  gear: svg('<circle cx="16" cy="16" r="4"/><path d="M16 3v5M16 24v5M3 16h5M24 16h5M6.8 6.8l3.5 3.5M21.7 21.7l3.5 3.5M6.8 25.2l3.5-3.5M21.7 10.3l3.5-3.5"/>'),
  // Weather
  sun: svg('<circle cx="16" cy="16" r="6"/><path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M6 26l3-3M23 9l3-3"/>'),
  partly: svg('<circle cx="12" cy="11" r="5"/><path d="M12 2v2M3 11h2M5.6 4.6l1.4 1.4M18.4 4.6L17 6"/><path d="M10 26h14a5 5 0 0 0 0-10 7 7 0 0 0-13 2 4 4 0 0 0-1 8z"/>'),
  cloud: svg('<path d="M8 25h16a6 6 0 0 0 0-12 8 8 0 0 0-15 2 5 5 0 0 0-1 10z"/>'),
  fog: svg('<path d="M5 12h22M3 17h26M6 22h20M9 27h14"/>'),
  rain: svg('<path d="M8 19h16a6 6 0 0 0 0-12 8 8 0 0 0-15 2 5 5 0 0 0-1 10z"/><path d="M10 23l-2 5M16 23l-2 5M22 23l-2 5"/>'),
  snow: svg('<path d="M8 19h16a6 6 0 0 0 0-12 8 8 0 0 0-15 2 5 5 0 0 0-1 10z"/><path d="M10 24v4M8 26h4M17 24v4M15 26h4M24 24v4M22 26h4"/>'),
  storm: svg('<path d="M8 19h16a6 6 0 0 0 0-12 8 8 0 0 0-15 2 5 5 0 0 0-1 10z"/><path d="M17 19l-4 6h5l-3 6"/>'),
};
