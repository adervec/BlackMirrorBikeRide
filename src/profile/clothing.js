// Clothing system. A rich-ish default wardrobe per slot, plus pre-assembled
// outfits that can be applied to a rider in one click. Clothing has NO speed
// impact (purely cosmetic) — physics only ever uses the player's biometrics.

export const CLOTHING = {
  helmet: {
    label: 'Helmet',
    items: {
      none:    { label: 'None' },
      road:    { label: 'Road Helmet' },
      aero:    { label: 'Aero Helmet' },
      tt:      { label: 'TT Helmet' },
      mtb:     { label: 'MTB / Trail' },
      leather: { label: 'Retro Leather' }
    }
  },
  hat: {
    label: 'Hat',
    items: {
      none:    { label: 'None' },
      cap:     { label: 'Cycling Cap' },
      beanie:  { label: 'Beanie' },
      cowboy:  { label: 'Cowboy Hat' },
      tophat:  { label: 'Top Hat' },
      viking:  { label: 'Viking Helm' }
    }
  },
  jersey: {
    label: 'Jersey',
    items: {
      classic:  { label: 'Classic' },
      team:     { label: 'Pro Team' },
      retro:    { label: 'Retro Wool' },
      rainbow:  { label: 'Rainbow Bands' },
      flannel:  { label: 'Flannel' },
      hawaiian: { label: 'Hawaiian' }
    }
  },
  gilet: {
    label: 'Gilet / Vest',
    items: {
      none:   { label: 'None' },
      wind:   { label: 'Windproof' },
      hiviz:  { label: 'Hi-Viz' },
      puffer: { label: 'Puffer' }
    }
  },
  gloves: {
    label: 'Gloves',
    items: {
      none:  { label: 'None' },
      short: { label: 'Short-Finger' },
      long:  { label: 'Full-Finger' },
      mitts: { label: 'Track Mitts' }
    }
  },
  shorts: {
    label: 'Shorts',
    items: {
      bib:   { label: 'Bib Shorts' },
      baggy: { label: 'Baggy MTB' },
      jorts: { label: 'Jorts' },
      tights:{ label: 'Long Tights' }
    }
  },
  socks: {
    label: 'Socks',
    items: {
      none:    { label: 'None' },
      ankle:   { label: 'Ankle' },
      tall:    { label: 'Tall' },
      wool:    { label: 'Wool' },
      rainbow: { label: 'Rainbow' }
    }
  },
  shoes: {
    label: 'Shoes',
    items: {
      road:     { label: 'Road Cleats' },
      mtb:      { label: 'MTB Shoes' },
      sneakers: { label: 'Sneakers' },
      boots:    { label: 'Boots' },
      sandals:  { label: 'Sandals (+socks)' }
    }
  }
};

export function defaultClothing() {
  return {
    helmet: { item: 'road', color: '#e8e8e8' },
    hat:    { item: 'none', color: '#222222' },
    jersey: { item: 'classic', color: '#1e6fd0', accent: '#ffffff', pattern: 'stripes' },
    gilet:  { item: 'none', color: '#ffd24a' },
    gloves: { item: 'short', color: '#111418' },
    shorts: { item: 'bib', color: '#11141b' },
    socks:  { item: 'tall', color: '#ffffff' },
    shoes:  { item: 'road', color: '#dddddd' }
  };
}

export const JERSEY_PATTERNS = { solid: 'Solid', stripes: 'Stripes', blocks: 'Colour Blocks', dots: 'Polka Dots' };

// Pre-assembled outfits (cosmetic only).
export const OUTFITS = {
  'classic-roadie': {
    label: 'Classic Roadie',
    clothing: {
      helmet: { item: 'road', color: '#ffffff' }, hat: { item: 'none', color: '#222' },
      jersey: { item: 'classic', color: '#1457b0', accent: '#ffffff', pattern: 'stripes' },
      gilet: { item: 'none', color: '#ffd24a' }, gloves: { item: 'short', color: '#111' },
      shorts: { item: 'bib', color: '#111' }, socks: { item: 'tall', color: '#fff' }, shoes: { item: 'road', color: '#eee' }
    }
  },
  'pro-team': {
    label: 'Pro Team',
    clothing: {
      helmet: { item: 'aero', color: '#101418' }, hat: { item: 'none', color: '#222' },
      jersey: { item: 'team', color: '#e10600', accent: '#101418', pattern: 'blocks' },
      gilet: { item: 'none', color: '#fff' }, gloves: { item: 'short', color: '#101418' },
      shorts: { item: 'bib', color: '#101418' }, socks: { item: 'tall', color: '#e10600' }, shoes: { item: 'road', color: '#fff' }
    }
  },
  'mad-max': {
    label: 'Wasteland',
    clothing: {
      helmet: { item: 'none', color: '#444' }, hat: { item: 'viking', color: '#6b5840' },
      jersey: { item: 'flannel', color: '#7a3b2e', accent: '#3a2a22', pattern: 'blocks' },
      gilet: { item: 'puffer', color: '#3a3a3a' }, gloves: { item: 'long', color: '#2a2018' },
      shorts: { item: 'baggy', color: '#2e2820' }, socks: { item: 'wool', color: '#6b5840' }, shoes: { item: 'boots', color: '#3a2a1a' }
    }
  },
  'sunday-casual': {
    label: 'Sunday Casual',
    clothing: {
      helmet: { item: 'none', color: '#444' }, hat: { item: 'cap', color: '#2a7' },
      jersey: { item: 'hawaiian', color: '#13b3a0', accent: '#ff7', pattern: 'dots' },
      gilet: { item: 'none', color: '#fff' }, gloves: { item: 'none', color: '#111' },
      shorts: { item: 'jorts', color: '#5a6b8a' }, socks: { item: 'ankle', color: '#fff' }, shoes: { item: 'sneakers', color: '#eee' }
    }
  }
};

export function applyOutfit(outfitId) {
  const o = OUTFITS[outfitId];
  return o ? structuredClone(o.clothing) : defaultClothing();
}

export const clothingItemList = (slot) =>
  Object.entries(CLOTHING[slot].items).map(([value, v]) => ({ value, label: v.label }));
