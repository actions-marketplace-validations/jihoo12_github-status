// Stroke icons drawn on a 24x24 grid.
const ICONS = {
  star: `<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>`,
  commit: `<circle cx="12" cy="12" r="4"/><path d="M2 12h6M16 12h6"/>`,
  pr: `<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5v7M18 15.5V10a4 4 0 0 0-4-4h-2.5M13.5 3.5L11 6l2.5 2.5"/>`,
  issue: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/>`,
  review: `<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>`,
  followers: `<circle cx="12" cy="8" r="4"/><path d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>`,
  repo: `<path d="M19 16V3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21H19v-5H7.5A2.5 2.5 0 0 0 5 18.5"/>`,
  network: `<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M10.8 7.2L6.2 15.8M13.2 7.2l4.6 8.6M7.5 18h9"/>`,
};

/** Icon `name` drawn `size` px square with its top-left corner at (x, y). */
export function icon(name, { x, y, size, stroke, strokeWidth = 2, opacity = 1 }) {
  const scale = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}">${ICONS[name]}</g>`;
}
