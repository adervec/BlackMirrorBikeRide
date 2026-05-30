// Decals: glyph badges that can be applied as a VEHICLE spray and/or a rider
// TATTOO. A few wholesome, unremovable defaults ship in. Users can add their own
// (glyph + colour + which kinds are allowed). Decals have NO speed impact.
//
// Library lives in state (state.decals) so customs persist; these are the seeds.

export function defaultDecalLibrary() {
  return [
    { id: 'd-smiley', label: 'Smiley',  glyph: '☺', color: '#ffd24a', kinds: ['vehicle', 'tattoo'], removable: false },
    { id: 'd-heart',  label: 'Heart',   glyph: '♥', color: '#ff5d8a', kinds: ['vehicle', 'tattoo'], removable: false },
    { id: 'd-star',   label: 'Star',    glyph: '★', color: '#7fd0ff', kinds: ['vehicle', 'tattoo'], removable: false },
    { id: 'd-flower', label: 'Flower',  glyph: '✿', color: '#9be86b', kinds: ['vehicle', 'tattoo'], removable: false },
    { id: 'd-peace',  label: 'Peace',   glyph: '☮', color: '#ffffff', kinds: ['vehicle', 'tattoo'], removable: false },
    { id: 'd-leaf',   label: 'Leaf',    glyph: '🍁', color: '#e8743b', kinds: ['vehicle', 'tattoo'], removable: false }
  ];
}

let _id = 0;
export function makeDecal({ label = 'Custom Decal', glyph = '✦', color = '#ffffff', kinds = ['vehicle', 'tattoo'] }) {
  return { id: `d-custom-${Date.now().toString(36)}-${(_id++).toString(36)}`, label, glyph, color, kinds, removable: true };
}

export function findDecal(library, id) {
  return (library || []).find((d) => d.id === id) || null;
}
