// Colour themes are the house list in font.js (standard 24); this app only maps
// a reader's old theme onto the nearest house one, once, then forgets it.
export const OLD_TO_HOUSE = { midnight: 'midnight', arcade: 'synthwave', terminal: 'terminal', pastel: 'pastel', vaporwave: 'synthwave', graphite: 'slate', wasteland: 'ember' };

// Returns true when the old setting has been dealt with and can be deleted.
export function migrateTheme(saved, appFont) {
  if (!saved) return false;
  if (!appFont) return false; // font.js didn't load: try again next launch
  if (OLD_TO_HOUSE[saved] && appFont.theme() === 'system') appFont.setTheme(OLD_TO_HOUSE[saved]);
  return true;
}
