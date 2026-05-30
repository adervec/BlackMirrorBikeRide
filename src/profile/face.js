// Face customization options — "Fallout 3 character creator" energy, but at our
// low-poly fidelity: discrete shape choices + colours that the avatar builder
// turns into chunky facial geometry.

export const FACE_SHAPES = {
  oval:   { label: 'Oval',   w: 1.0,  h: 1.0 },
  round:  { label: 'Round',  w: 1.12, h: 0.95 },
  square: { label: 'Square', w: 1.1,  h: 1.05 },
  long:   { label: 'Long',   w: 0.92, h: 1.18 },
  gaunt:  { label: 'Gaunt',  w: 0.85, h: 1.12 }
};

export const BROW_TYPES = {
  flat:    { label: 'Flat',    angle: 0.0,  thick: 0.7 },
  angled:  { label: 'Angled',  angle: 0.35, thick: 0.8 },
  raised:  { label: 'Raised',  angle: -0.3, thick: 0.7 },
  bushy:   { label: 'Bushy',   angle: 0.1,  thick: 1.3 }
};

export const NOSE_TYPES = {
  button:   { label: 'Button',   len: 0.7, w: 1.0 },
  straight: { label: 'Straight', len: 1.0, w: 0.9 },
  hawk:     { label: 'Aquiline', len: 1.2, w: 0.85 },
  broad:    { label: 'Broad',    len: 0.9, w: 1.3 }
};

export const MOUTH_TYPES = {
  neutral: { label: 'Neutral', curve: 0.0 },
  smile:   { label: 'Smile',   curve: 0.5 },
  smirk:   { label: 'Smirk',   curve: 0.25 },
  frown:   { label: 'Frown',   curve: -0.4 },
  grimace: { label: 'Grimace', curve: -0.1 }
};

export const FACIAL_HAIR = {
  none:     { label: 'Clean Shaven' },
  stubble:  { label: 'Stubble' },
  mustache: { label: 'Moustache' },
  goatee:   { label: 'Goatee' },
  beard:    { label: 'Full Beard' }
};

export const HAIR_STYLES = {
  bald:    { label: 'Bald' },
  short:   { label: 'Short' },
  mohawk:  { label: 'Mohawk' },
  long:    { label: 'Long' },
  topknot: { label: 'Top Knot' },
  afro:    { label: 'Afro' }
};

export function defaultFace() {
  return {
    skinTone: '#d8a07a',
    faceShape: 'oval',
    eyeColor: '#5a3a22',
    browType: 'flat',
    browColor: '#2c1c12',
    noseType: 'straight',
    mouthType: 'smile',
    facialHair: 'none',
    facialHairColor: '#2c1c12',
    hairStyle: 'short',
    hairColor: '#3a2a1a'
  };
}

const opts = (obj) => Object.entries(obj).map(([value, v]) => ({ value, label: v.label }));
export const faceOptionLists = {
  faceShape: opts(FACE_SHAPES),
  browType: opts(BROW_TYPES),
  noseType: opts(NOSE_TYPES),
  mouthType: opts(MOUTH_TYPES),
  facialHair: opts(FACIAL_HAIR),
  hairStyle: opts(HAIR_STYLES)
};
