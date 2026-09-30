// Visual theme for the graphic templates: fonts, kicker style, colour tokens, default ease.
// A project picks one with `"theme": "<id>"` in brief.json; without it `cvm graphics` uses DEFAULT_THEME.
// Font files live in templates/animatic/fonts (copied next to every composition).

export interface Theme {
  id: string;
  name: string;
  /** CSS family names; every family used must have its weights in `fontFaces`. */
  fonts: { display: string; body: string; numeric: string };
  /** Weight of headlines/big words (the face must be in `fontFaces`). */
  displayWeight: 700 | 800;
  fontFaces: { family: string; file: string; weight: 400 | 700 | 800 }[];
  /**
   * Distance from the bottom of a line-height:1 box to the text baseline, in em (from the font's
   * ascender/descender). Lets a rolling-digit number and its unit sit on one baseline.
   */
  baseline: { numeric: number; display: number };
  /** Opacity of a static film-grain layer (dithers gradient banding before H.264); 0 = none. */
  grain: number;
  kicker: { uppercase: boolean; letterSpacingPx: number };
  colors: {
    bg: string;
    /** Light spot of the radial background gradient. */
    bgGlow: string;
    /** Full-frame overlay (CSS background-image) or "none". */
    texture: string;
    textureSize?: string;
    text: string;
    textSub: string;
    textLabel: string;
    accent: string;
    accentHi: string;
    onAccent: string;
    secondary: string;
    /** Inactive fill (bars/columns that are not the point). */
    muted: string;
    /** Axes, neutral outlines. */
    line: string;
    /** Chip behind kicker/sub on maps and photos. */
    panel: string;
    /** Layer over blurred footage (any CSS background value). */
    scrim: string;
    /** drop-shadow colour for the highlighted element. */
    glow: string;
    /** Outline painted behind every glyph so text holds up over footage. */
    stroke: string;
    mapLand: string;
    mapLandDim: string;
    mapSea: string;
    mapBorder: string;
  };
  /** Ease of every reveal (GSAP ease string). */
  ease: string;
}

/** The look used up to 2026-09-29 (Barlow, orange + cyan, 80 px grid). */
const CLASSIC: Theme = {
  id: 'classic',
  name: 'Cổ điển',
  fonts: { display: 'Barlow', body: 'Barlow', numeric: 'Barlow' },
  displayWeight: 700,
  baseline: { numeric: 0.1, display: 0.1 },
  grain: 0,
  fontFaces: [
    { family: 'Barlow', file: 'Barlow-Regular.ttf', weight: 400 },
    { family: 'Barlow', file: 'Barlow-Bold.ttf', weight: 700 },
  ],
  kicker: { uppercase: true, letterSpacingPx: 6 },
  colors: {
    bg: '#0d1117',
    bgGlow: '#1b2433',
    texture: 'linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)',
    textureSize: '80px 80px',
    text: '#f1f3f5',
    textSub: '#adb5bd',
    textLabel: '#8391a7',
    accent: '#ff7a1a',
    accentHi: '#ffb347',
    onAccent: '#0d1117',
    secondary: '#4cc9f0',
    muted: '#34445c',
    line: '#46597a',
    panel: 'rgba(10,15,23,.75)',
    scrim: 'radial-gradient(ellipse at 50% 50%,rgba(13,17,23,.25) 0%,rgba(13,17,23,.8) 85%)',
    glow: 'rgba(255,122,26,.6)',
    stroke: 'rgba(8,11,17,.9)',
    mapLand: '#3b5378',
    mapLandDim: '#1a2331',
    mapSea: '#0a0f17',
    mapBorder: '#5a7399',
  },
  ease: 'power3.out',
};

/**
 * Ink navy + amber. On bg: text 16.6:1, textSub 10.3:1, accent 10.5:1; onAccent on accent 10.7:1.
 * Accent vs secondary ΔL* 25.6 (grayscale / red–green safe: amber–blue axis). Headlines and numbers
 * in Phudu ExtraBold (condensed caps, static instance of the variable font; no tabular figures — the
 * odometer sizes each column itself), everything else in Be Vietnam Pro.
 */
const MUC_HO_PHACH: Theme = {
  id: 'muc-ho-phach',
  name: 'Mực & Hổ phách',
  fonts: { display: 'Phudu', body: 'Be Vietnam Pro', numeric: 'Phudu' },
  displayWeight: 800,
  baseline: { numeric: 0.0875, display: 0.0875 },
  grain: 0.05,
  fontFaces: [
    { family: 'Be Vietnam Pro', file: 'BeVietnamPro-Regular.ttf', weight: 400 },
    { family: 'Be Vietnam Pro', file: 'BeVietnamPro-Bold.ttf', weight: 700 },
    { family: 'Be Vietnam Pro', file: 'BeVietnamPro-ExtraBold.ttf', weight: 800 },
    // One ExtraBold file serves both weights: `.num` asks for 700, `.disp` for 800.
    { family: 'Phudu', file: 'Phudu-ExtraBold.ttf', weight: 700 },
    { family: 'Phudu', file: 'Phudu-ExtraBold.ttf', weight: 800 },
  ],
  kicker: { uppercase: true, letterSpacingPx: 6 },
  colors: {
    bg: '#0e1320',
    bgGlow: '#22304d',
    texture: 'radial-gradient(ellipse 120% 90% at 50% 115%,rgba(0,0,0,.45) 0%,rgba(0,0,0,0) 60%)',
    text: '#f5f2eb',
    textSub: '#b9c2d2',
    textLabel: '#94a1b8',
    accent: '#ffb52e',
    accentHi: '#ffd27a',
    onAccent: '#171004',
    secondary: '#3a7af2',
    muted: '#3b4861',
    line: '#56657f',
    panel: 'rgba(10,15,26,.82)',
    scrim: 'rgba(8,11,18,.4)',
    glow: 'rgba(255,181,46,.45)',
    stroke: 'rgba(8,11,18,.9)',
    mapLand: '#26344f',
    mapLandDim: '#19233a',
    mapSea: '#0a1224',
    mapBorder: '#44567a',
  },
  ease: 'power3.out',
};

export const THEMES: Record<string, Theme> = { [CLASSIC.id]: CLASSIC, [MUC_HO_PHACH.id]: MUC_HO_PHACH };
export const DEFAULT_THEME = MUC_HO_PHACH.id;

export function getTheme(id: string = DEFAULT_THEME): Theme {
  const t = THEMES[id];
  if (!t) throw new Error(`Theme "${id}" không tồn tại — chọn một trong ${Object.keys(THEMES).join(', ')}`);
  return t;
}
