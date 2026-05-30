// Menu/UI themes — each is a set of CSS custom properties applied to :root.
// style.css ships the "midnight" values; applyTheme() overrides them inline.

export const THEMES = {
  midnight: {
    label: 'Midnight (default)',
    vars: { '--bg': '#0b0d14', '--bg2': '#12151f', '--card': '#171b27', '--card2': '#1e2333', '--line': '#2a3042', '--text': '#e6e9f0', '--dim': '#8a93a8', '--accent': '#4cc2ff', '--accent2': '#ff5db1' }
  },
  arcade: {
    label: 'Arcade',
    vars: { '--bg': '#1a0030', '--bg2': '#26004a', '--card': '#2e0a55', '--card2': '#3a1366', '--line': '#5a2a8a', '--text': '#fff0ff', '--dim': '#c79be0', '--accent': '#ffd400', '--accent2': '#ff2fb0' }
  },
  terminal: {
    label: 'CRT Terminal',
    vars: { '--bg': '#030803', '--bg2': '#061006', '--card': '#06140a', '--card2': '#0a1d0e', '--line': '#1d3a22', '--text': '#9dffb0', '--dim': '#4f8f5e', '--accent': '#39ff14', '--accent2': '#7CFC00' }
  },
  pastel: {
    label: 'Pastel',
    vars: { '--bg': '#f3eef7', '--bg2': '#ffffff', '--card': '#ffffff', '--card2': '#f1ecf6', '--line': '#dcd2e6', '--text': '#33293d', '--dim': '#8a7d97', '--accent': '#7a5cff', '--accent2': '#ff7eb3' }
  },
  vaporwave: {
    label: 'Vaporwave',
    vars: { '--bg': '#1b0033', '--bg2': '#2a0a4a', '--card': '#321055', '--card2': '#3e1668', '--line': '#6a2fa0', '--text': '#f6e9ff', '--dim': '#c9a9ec', '--accent': '#00e5ff', '--accent2': '#ff2fb0' }
  },
  graphite: {
    label: 'Graphite',
    vars: { '--bg': '#141414', '--bg2': '#1c1c1c', '--card': '#202020', '--card2': '#2a2a2a', '--line': '#3a3a3a', '--text': '#ececec', '--dim': '#9a9a9a', '--accent': '#ff8c00', '--accent2': '#00bcd4' }
  },
  wasteland: {
    label: 'Wasteland',
    vars: { '--bg': '#1b1407', '--bg2': '#241a0a', '--card': '#2c220f', '--card2': '#382c15', '--line': '#574326', '--text': '#f0e2c4', '--dim': '#a8946a', '--accent': '#e8743b', '--accent2': '#d4b106' }
  }
};

export const DEFAULT_THEME = 'midnight';

export function themeList() {
  return Object.entries(THEMES).map(([id, t]) => ({ value: id, label: t.label }));
}

export function applyTheme(id) {
  const t = THEMES[id] || THEMES[DEFAULT_THEME];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(k, v);
  document.body && (document.body.dataset.theme = id);
}
