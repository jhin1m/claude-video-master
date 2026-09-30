// Visual theme for the graphic templates: fonts, kicker style, colour tokens, default ease.
// A project picks one with `"theme": "<id>"` in brief.json; without it `cvm graphics` uses DEFAULT_THEME.
// Font files live in templates/animatic/fonts (copied next to every composition).

export interface Theme {
  id: string;
  name: string;
  /**
   * Layout/motion family. Omitted = the editorial templates in templates.ts; `dossier` = paper
   * documentary look (dossier.ts) for the templates it covers, editorial layout for the rest.
   */
  style?: 'dossier';
  /** CSS family names; every family used must have its weights in `fontFaces`. `hand` = handwriting (dossier). */
  fonts: { display: string; body: string; numeric: string; hand?: string };
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

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
/** Paper: horizontal fibres (tiled), large soft blotches, burnt edges. Static, seeded. */
const PAPER = [
  svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><filter id='f'><feTurbulence type='fractalNoise' baseFrequency='0.9 0.04' numOctaves='2' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.36 0 0 0 0 0.27 0 0 0 0 0.14 0.55 0 0 0 -0.2'/></filter><rect width='600' height='600' filter='url(#f)'/></svg>`),
  svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.005' numOctaves='3' seed='11'/><feColorMatrix values='0 0 0 0 0.42 0 0 0 0 0.3 0 0 0 0 0.12 0.42 0 0 0 -0.14'/></filter><rect width='1920' height='1080' filter='url(#b)'/></svg>`),
  'radial-gradient(ellipse 118% 96% at 50% 46%,rgba(0,0,0,0) 56%,rgba(96,66,24,.32) 100%)',
].join(',');

/**
 * Hồ sơ tư liệu: the frame is a sheet of aged paper. Footage becomes a taped photo print (or a faint
 * photocopy), kickers are embossed label tape, numbers are headline type circled in red ink,
 * key words get a highlighter pass, sources are typed out like a footnote.
 */
const HO_SO: Theme = {
  id: 'ho-so',
  name: 'Hồ sơ tư liệu',
  style: 'dossier',
  fonts: { display: 'Anton', body: 'IBM Plex Mono', numeric: 'Anton', hand: 'Patrick Hand' },
  displayWeight: 800,
  baseline: { numeric: 0.0764, display: 0.0764 },
  grain: 0.09,
  fontFaces: [
    // Single-weight faces registered under both weights the shared CSS asks for.
    { family: 'Anton', file: 'Anton-Regular.ttf', weight: 700 },
    { family: 'Anton', file: 'Anton-Regular.ttf', weight: 800 },
    { family: 'IBM Plex Mono', file: 'IBMPlexMono-Regular.ttf', weight: 400 },
    { family: 'IBM Plex Mono', file: 'IBMPlexMono-SemiBold.ttf', weight: 700 },
    { family: 'Patrick Hand', file: 'PatrickHand-Regular.ttf', weight: 400 },
  ],
  kicker: { uppercase: true, letterSpacingPx: 5 },
  colors: {
    bg: '#e8dfca',
    bgGlow: '#f3ecdb',
    texture: PAPER,
    textureSize: '600px 600px,1920px 1080px,100% 100%',
    text: '#1c1a16',
    textSub: '#4a453b',
    textLabel: '#6d6657',
    accent: '#c0381f',
    accentHi: '#f4cd2c',
    onAccent: '#1c1a16',
    secondary: '#24509c',
    muted: '#b8ac93',
    line: '#8b8170',
    panel: 'rgba(248,244,234,.94)',
    scrim: 'rgba(232,223,202,.45)',
    glow: 'rgba(0,0,0,0)',
    stroke: 'rgba(0,0,0,0)',
    mapLand: '#d6cbb0',
    mapLandDim: '#e0d7c2',
    mapSea: '#efe8d7',
    mapBorder: '#9a8f78',
  },
  ease: 'power3.out',
};

export const THEMES: Record<string, Theme> = { [CLASSIC.id]: CLASSIC, [MUC_HO_PHACH.id]: MUC_HO_PHACH, [HO_SO.id]: HO_SO };
export const DEFAULT_THEME = MUC_HO_PHACH.id;

export function getTheme(id: string = DEFAULT_THEME): Theme {
  const t = THEMES[id];
  if (!t) throw new Error(`Theme "${id}" không tồn tại — chọn một trong ${Object.keys(THEMES).join(', ')}`);
  return t;
}
