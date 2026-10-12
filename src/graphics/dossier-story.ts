// "Hồ sơ tư liệu" layouts for the storytelling templates (editorial versions in story.ts).
// Same beats as the editorial layouts (rankTimes, timelineTimes … from story.ts) so the SFX that
// soundCues() lays under them stay valid; everything else is redesigned for the paper desk:
// a ranking typed on an index card, a hand-ruled timeline with pinned slips, a notebook checklist,
// a typed quotation, a glued press clipping, a photocopy marked up in ink, a personnel folder.
// No rubber stamps here: a stamp's text would be a verdict the spec does not give.
//
// Element motion follows the paper idiom (stepped typing, ink drawn on, things dropped and taped);
// the camera only moves where the editorial layout does (document push), per the explainer rule
// "camera smooth, elements stepped".

import { HIGHLIGHT, UNDERLINE, hash, inkLoop, label, labelIn, markSvg, press, RUNTIME, smooth, tapeIn, typed, typeIn, writeIn, type DossierParts } from './dossier.ts';
import { docLayout, docmarkTimes, headlineTimes, markedWords, notePlace, profileTimes, rankTimes, stepsTimes, timelineTimes } from './story.ts';
import { esc, f2, wheel, type StorySpec } from './templates.ts';
import type { Theme } from './theme.ts';

const PRINT_RIGHT = { x: 1190, y: 250, w: 580, h: 420, rot: 2.6 };
const PAPER = '#fdfcf6';
const CARD_LINES = 'repeating-linear-gradient(transparent 0 46px,rgba(60,110,180,.2) 46px 48px)';
/** Torn edge for a clipping: deterministic jagged polygon around the box (percent units). */
const torn = (seed: number) => {
  const pts: string[] = [];
  const edge = (n: number, f: (u: number, j: number) => string) => {
    for (let i = 0; i <= n; i++) pts.push(f(i / n, hash(i, seed + pts.length) * 0.9));
  };
  edge(18, (u, j) => `${f2(u * 100)}% ${f2(0.6 + Math.abs(j))}%`);
  edge(14, (u, j) => `${f2(99.4 - Math.abs(j) * 0.8)}% ${f2(u * 100)}%`);
  edge(18, (u, j) => `${f2(100 - u * 100)}% ${f2(99.2 - Math.abs(j))}%`);
  edge(14, (u, j) => `${f2(0.6 + Math.abs(j) * 0.8)}% ${f2(100 - u * 100)}%`);
  return `polygon(${pts.join(',')})`;
};

export function buildDossierStory(spec: StorySpec, t: Theme, seconds: number): DossierParts {
  const c = t.colors;
  const hand = t.fonts.hand ?? t.fonts.body;
  const hasPrint = 'bg' in spec && !!(spec as { bg?: unknown }).bg;
  const base = { layout: 'left' as const, print: hasPrint ? PRINT_RIGHT : ('copy' as const) };
  /**
   * Yellow marker stretched into the box of the element it sits in. The round caps stretch with the box
   * (~13% of its width each side), so the stroke box is inset to end flush with the words.
   */
  const hlMark = (id: string) => markSvg(HIGHLIGHT, id, 'hlm', c.accentHi);
  const markCss = `.hlw{position:relative;display:inline-block}.hlt{position:relative;z-index:1}.hlm{position:absolute;left:9%;top:14%;width:82%;height:78%;z-index:0;overflow:visible}`;

  switch (spec.template) {
    // A ranking typed on a lined index card, #1 at the top. Rows are filled in from the bottom:
    // red handwritten rank, label pressed in, value typed; then #1 is highlighted and ringed in ink.
    case 'rank': {
      const n = spec.items.length;
      const T = rankTimes(n);
      const W = hasPrint ? 960 : 1340;
      const rowH = n <= 3 ? 116 : n <= 5 ? 96 : 80;
      const fs = n <= 3 ? 60 : n <= 5 ? 50 : 42;
      const numW = Math.round(rowH * 1.25);
      const rows = spec.items
        .map((it, i) => {
          const lbl = i === 0 ? `<span class="hlw">${hlMark('hm0')}<span class="hlt">${esc(it.label)}</span></span>` : esc(it.label);
          return `<div id="rr${i}" class="rr"><div class="rnw"><b id="rn${i}" class="rn">#${i + 1}</b>${i === 0 ? `<div id="lpb" class="ink" style="left:${f2(numW * 0.06)}px;top:${f2(-rowH * 0.06)}px"><svg width="${f2(numW * 0.98)}" height="${f2(rowH * 1.1)}" style="overflow:visible"><path id="lp" d="${inkLoop(numW * 0.98, rowH * 1.1, 4)}" fill="none" stroke="${c.accent}" stroke-width="7" stroke-linecap="round" opacity="0"/></svg></div>` : ''}</div>` +
            `<span id="rl${i}" class="rl disp">${lbl}</span>${it.value ? typed(`rv${i}`, it.value, 'rv') : ''}</div>`;
        })
        .join('');
      return {
        ...base,
        focus: [600, 520],
        body: `<div class="col" style="width:${W}px">${label(spec.kicker)}<div id="rkc" class="rkc"><i id="rt0" class="tape" style="left:-40px;top:-18px"></i><i id="rt1" class="tape" style="right:-40px;top:-18px"></i>${rows}</div>${typed('s', spec.sub)}</div>`,
        css: `.rkc{position:relative;width:100%;margin:46px 0 40px;padding:26px 36px 22px 0;background-color:#fbfaf4;background-image:linear-gradient(90deg,transparent 0 ${numW + 18}px,${c.accent}88 ${numW + 18}px ${numW + 21}px,transparent ${numW + 21}px),${CARD_LINES};box-shadow:0 22px 44px rgba(52,36,12,.3),0 2px 5px rgba(52,36,12,.22)}
.rr{display:flex;align-items:center;gap:40px;height:${rowH}px}.rnw{position:relative;flex:none;width:${numW}px;text-align:center}
.rn{display:inline-block;font-family:"${hand}";font-weight:400;font-size:${Math.round(rowH * 0.7)}px;line-height:1;color:${c.accent}}
.rl{flex:1;min-width:0;font-size:${fs}px;line-height:1.1;color:${c.text};white-space:nowrap}.rv{flex:none;font-size:30px;color:${c.text}}.rv::before{display:none}${markCss}`,
        js: [
          RUNTIME,
          labelIn(0.1),
          'tl.fromTo("#rkc", { opacity: 0, y: -50, rotation: -3 }, { opacity: 1, y: 0, rotation: -0.8, duration: 0.55, ease: "power3.out" }, 0.05);',
          tapeIn('#rt0', 0.35, -30),
          tapeIn('#rt1', 0.45, 28),
          ...spec.items.flatMap((it, i) => {
            const at = T.row(i);
            return [writeIn(`#rn${i}`, at, 0.3), press(`#rl${i}`, at + 0.1), ...(it.value ? [typeIn(`rv${i}`, at + 0.2, it.value)] : [])];
          }),
          `hs.draw("hm0", ${f2(T.crown)}, 0.5, 0.62);`,
          `hs.draw("lp", ${f2(T.crown + 0.15)}, 0.55, 1); hs.boil("#lpb", 31, 1.4, 0.4, 0);`,
          ...(n > 1 ? [`tl.to([${spec.items.slice(1).map((_, i) => `"#rr${i + 1}"`).join(', ')}], { opacity: 0.5, duration: 0.4, ease: "power2.out" }, ${f2(T.crown + 0.1)});`] : []),
          typeIn('s', T.done, spec.sub),
        ],
      };
    }

    // A line ruled by hand across the sheet; paper slips (red handwritten year, typed label) are
    // dropped and pinned above/below it as the pen passes, tied to the line with red thread.
    // The focus year gets an ink ring and the other slips step back.
    case 'timeline': {
      const n = spec.events.length;
      const T = timelineTimes(n);
      const X0 = 190;
      const W = 1540;
      const Y = 600;
      const slot = W / n;
      const xs = spec.events.map((_, i) => X0 + (i + 0.5) * slot);
      const f = spec.focus;
      const ys = n <= 4 ? 70 : 58;
      const ls = n <= 4 ? 26 : 23;
      // The ruled line wobbles slightly, as a pen held along a ruler does.
      const P: [number, number][] = Array.from({ length: 13 }, (_, k) => [X0 - 10 + ((W + 20) * k) / 12, Y + hash(k, 41) * 3]);
      const slips = spec.events
        .map((e, i) => {
          const up = i % 2 === 0;
          const w = Math.min(slot * 1.7, 470);
          const yr = `<b id="ty${i}" class="tyr">${esc(e.year)}</b>`;
          const loop = i === f ? (() => {
            const lw = [...e.year].length * ys * 0.46 + 70;
            const lh = ys * 1.7;
            return `<div id="flb" class="ink" style="left:50%;top:-6px;margin-left:${f2(-lw / 2)}px"><svg width="${f2(lw)}" height="${f2(lh)}" style="overflow:visible"><path id="fl" d="${inkLoop(lw, lh, 19)}" fill="none" stroke="${c.accent}" stroke-width="7" stroke-linecap="round" opacity="0"/></svg></div>`;
          })() : '';
          return `<div id="ts${i}" class="tsl" style="left:${f2(xs[i]! - w / 2)}px;width:${f2(w)}px;${up ? `bottom:${1080 - Y + 70}px` : `top:${Y + 70}px`}"><i class="pushpin" style="left:${f2(w / 2 - 17)}px;top:-16px"></i>${loop}${yr}<span class="tlb">${esc(e.label)}</span></div>`;
        })
        .join('');
      const threads = xs.map((x, i) => `<line id="th${i}" x1="${f2(x)}" y1="${f2(Y)}" x2="${f2(x + hash(i, 7) * 8)}" y2="${f2(i % 2 === 0 ? Y - 74 : Y + 74)}" pathLength="1" stroke="${c.accent}" stroke-width="3" stroke-dasharray="1" stroke-dashoffset="1"/><line id="tk${i}" x1="${f2(x)}" y1="${Y - 14}" x2="${f2(x + hash(i, 9) * 3)}" y2="${Y + 14}" stroke="${c.text}" stroke-width="5" stroke-linecap="round" opacity="0"/>`).join('');
      return {
        ...base,
        layout: 'center',
        print: 'copy',
        focus: [f !== undefined ? xs[f]! : 960, Y],
        body: `<svg class="full" width="1920" height="1080" viewBox="0 0 1920 1080"><path id="ax" d="${smooth(P)}" pathLength="1" fill="none" stroke="${c.text}" stroke-width="6" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"/>${threads}</svg>${slips}${label(spec.kicker, 'tl-k')}<div class="bl-s">${typed('s', spec.sub)}</div>`,
        css: `.full{position:absolute;inset:0;overflow:visible}.tsl{position:absolute;display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 18px 18px;background:${PAPER};box-shadow:0 10px 22px rgba(52,36,12,.25);text-align:center}
.tyr{position:relative;font-family:"${hand}";font-weight:400;font-size:${ys}px;line-height:1;color:${c.accent}}.tlb{font-family:"${t.fonts.body}";font-size:${ls}px;line-height:1.35;color:${c.text}}
.bl-s{position:absolute;left:180px;right:180px;bottom:64px}`,
        js: [
          RUNTIME,
          labelIn(0.1),
          `tl.fromTo("#ax", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: ${f2(T.draw)}, ease: "none" }, 0.3);`,
          ...spec.events.flatMap((_, i) => {
            const at = T.ev(i);
            return [
              `tl.set("#tk${i}", { opacity: 1 }, ${f2(at)});`,
              `tl.fromTo("#ts${i}", { opacity: 0, y: ${i % 2 === 0 ? -60 : 60}, rotation: ${f2(hash(i, 13) * 9)} }, { opacity: 1, y: 0, rotation: ${f2(hash(i, 17) * 2.2)}, duration: 0.36, ease: "power3.in" }, ${f2(at - 0.05)});`,
              `tl.to("#th${i}", { attr: { "stroke-dashoffset": 0 }, duration: 0.25, ease: "power1.out" }, ${f2(at + 0.25)});`,
            ];
          }),
          ...(f !== undefined
            ? [
                `tl.to([${spec.events.map((_, i) => i).filter((i) => i !== f).map((i) => `"#ts${i}"`).join(', ')}], { opacity: 0.5, duration: 0.4 }, ${f2(T.focus)});`,
                `tl.to("#ts${f}", { scale: 1.08, duration: 0.3, ease: "back.out(2)" }, ${f2(T.focus)});`,
                `hs.draw("fl", ${f2(T.focus + 0.1)}, 0.55, 1); hs.boil("#flb", 37, 1.4, 0.4, 0);`,
              ]
            : []),
          typeIn('s', T.done, spec.sub),
        ],
      };
    }

    // A notebook checklist: the whole list is there in pencil-grey first; each step is inked in as
    // it comes up, the one before gets a red tick in its box, the active step a highlighter stroke.
    case 'steps': {
      const n = spec.steps.length;
      const active = spec.active ?? n - 1;
      const T = stepsTimes(n, active);
      const W = hasPrint ? 960 : 1300;
      const rowH = n <= 3 ? 170 : n === 4 ? 140 : 118;
      const ts = n <= 3 ? 64 : n === 4 ? 56 : 48;
      const box = (i: number) => {
        const j = (k: number) => f2(hash(i * 7 + k, 29) * 2);
        return `<svg class="cbx" width="64" height="64" viewBox="0 0 64 64" style="overflow:visible"><path d="M6 ${8 + +j(1)} L${58 + +j(2)} 6 L58 ${58 + +j(3)} L${6 + +j(4)} 58 Z" fill="none" stroke="${c.text}" stroke-width="4" stroke-linejoin="round"/><path id="ck${i}" d="M12 34 L26 50 L60 -2" fill="none" stroke="${c.accent}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0"/></svg>`;
      };
      const rows = spec.steps
        .map((s, i) => `<div id="sr${i}" class="sr">${box(i)}<b class="snb">${i + 1}.</b><div class="stx"><div class="stt disp">${i === active ? `<span class="hlw">${hlMark('ha')}<span class="hlt">${esc(s.title)}</span></span>` : esc(s.title)}</div>${s.detail ? `<div class="std">${esc(s.detail)}</div>` : ''}</div></div>`)
        .join('');
      return {
        ...base,
        focus: [620, 540],
        body: `<div class="col" style="width:${W}px">${label(spec.kicker)}<div id="nb" class="nbk"><i class="pushpin" style="left:${W / 2 - 17}px;top:-16px"></i>${rows}</div>${typed('s', spec.sub)}</div>`,
        css: `.nbk{position:relative;width:100%;margin:42px 0 36px;padding:28px 40px 24px 30px;background-color:#fbfaf4;background-image:linear-gradient(90deg,transparent 0 118px,${c.accent}77 118px 121px,transparent 121px),${CARD_LINES};box-shadow:0 22px 44px rgba(52,36,12,.3),0 2px 5px rgba(52,36,12,.22)}
.sr{display:flex;align-items:center;gap:26px;height:${rowH}px;opacity:.32}.cbx{flex:none}.snb{flex:none;width:58px;font-family:"${hand}";font-weight:400;font-size:${Math.round(ts * 0.95)}px;line-height:1;color:${c.accent}}
.stx{display:flex;flex-direction:column;gap:8px;min-width:0}.stt{font-size:${ts}px;line-height:1.05;color:${c.text};transform-origin:0 60%}.std{font-family:"${t.fonts.body}";font-size:${n <= 3 ? 28 : 24}px;line-height:1.3;color:${c.textSub}}${markCss}`,
        js: [
          RUNTIME,
          labelIn(0.1),
          'tl.fromTo("#nb", { opacity: 0, y: 60, rotation: 2.5 }, { opacity: 1, y: 0, rotation: 0.6, duration: 0.6, ease: "power3.out" }, 0.05);',
          ...spec.steps.slice(0, active + 1).flatMap((_, i) => {
            const at = T.lit(i);
            return [
              `tl.to("#sr${i}", { opacity: 1, duration: 0.12, ease: "none" }, ${f2(at)});`,
              `tl.fromTo("#sr${i} .stt", { scale: 1.1 }, { scale: 1, duration: 0.3, ease: "power2.out", immediateRender: false }, ${f2(at)});`,
              ...(i > 0 ? [`hs.draw("ck${i - 1}", ${f2(at + 0.04)}, 0.28, 1);`, `tl.to("#sr${i - 1}", { opacity: 0.72, duration: 0.25 }, ${f2(at + 0.1)});`] : []),
            ];
          }),
          `hs.draw("ha", ${f2(T.lit(active) + 0.2)}, 0.5, 0.62);`,
          typeIn('s', T.done, spec.sub),
        ],
      };
    }

    // A typed quotation: big red quote marks written in by hand, the words struck one by one like a
    // typewriter, the stressed phrase highlighted, the speaker on label tape, a taped photo print.
    case 'quote': {
      const words = markedWords(spec.quote);
      const photo = !!spec.photo;
      const L = [...spec.quote.replace(/\*/g, '')].length;
      const size = (photo ? [66, 58, 48, 40] : [80, 66, 54, 44])[L <= 50 ? 0 : L <= 90 ? 1 : L <= 150 ? 2 : 3]!;
      let html = '';
      let g = 0;
      for (let i = 0; i < words.length; ) {
        const grp = words[i]!.group;
        if (grp < 0) {
          html += `${html ? ' ' : ''}<span id="w${i}" class="qw">${esc(words[i]!.word)}</span>`;
          i++;
          continue;
        }
        const run: string[] = [];
        for (; words[i]?.group === grp; i++) run.push(`<span id="w${i}" class="qw">${esc(words[i]!.word)}</span>`);
        html += `${html ? ' ' : ''}<span class="hlw">${hlMark(`hq${g++}`)}<span class="hlt">${run.join(' ')}</span></span>`;
      }
      const step = Math.min(0.06, 1.3 / words.length);
      const done = 0.45 + step * words.length + 0.3;
      const ext = spec.photo ? spec.photo.slice(spec.photo.lastIndexOf('.')).toLowerCase() : '';
      const W = photo ? 1020 : 1500;
      return {
        ...base,
        print: 'copy',
        focus: [photo ? 760 : 900, 520],
        body: `<div class="col" style="width:${W}px"><div id="qm" class="qmk">“</div><div class="qtx" style="font-size:${size}px">${html}</div>` +
          `<div class="qau"><div id="qa" class="dyw"><div class="dy">${esc(spec.author)}</div></div>${spec.role ? `<span id="qo" class="qro hand">${esc(spec.role)}</span>` : ''}</div></div>` +
          (photo
            ? `<div id="qpr" class="qpr"><div class="qpi"><img src="photo${ext}" alt="" /></div><i id="qt0" class="tape" style="left:-50px;top:-8px"></i><i id="qt1" class="tape" style="right:-50px;bottom:40px"></i></div>`
            : ''),
        css: `.qmk{font-family:"${hand}";font-size:260px;line-height:.7;height:120px;color:${c.accent};margin-left:-10px}
.qtx{font-family:"${t.fonts.body}";font-weight:700;line-height:1.38;color:${c.text};margin:22px 0 46px}.qw{opacity:0}${markCss}
.qau{display:flex;align-items:center;gap:30px;flex-wrap:wrap}.qro{font-size:44px;line-height:1.1;transform:rotate(-2deg)}
.qpr{position:absolute;left:1270px;top:230px;width:480px;height:600px;padding:18px 18px 80px;background:#f8f5ed;box-shadow:0 26px 50px rgba(52,36,12,.34),0 3px 6px rgba(52,36,12,.28)}.qpi{width:100%;height:100%;overflow:hidden}.qpi img{width:100%;height:100%;object-fit:cover;filter:grayscale(1) sepia(.25) contrast(1.08)}`,
        js: [
          RUNTIME,
          writeIn('#qm', 0.1, 0.4),
          'hs.boil("#qm", 43, 1.2, 0.5, 0);',
          ...(photo
            ? [
                'tl.fromTo("#qpr", { opacity: 0, y: -80, rotation: 9 }, { opacity: 1, y: 0, rotation: 3, duration: 0.65, ease: "power3.out" }, 0.15);',
                `tl.fromTo("#qpr img", { scale: 1.12 }, { scale: 1, duration: ${f2(seconds)}, ease: "none" }, 0);`,
                tapeIn('#qt0', 0.7, -35),
                tapeIn('#qt1', 0.8, -28),
              ]
            : []),
          ...words.map((_, i) => `tl.set("#w${i}", { opacity: 1 }, ${f2(0.45 + i * step)});`),
          ...Array.from({ length: g }, (_, k) => `hs.draw("hq${k}", ${f2(done + k * 0.2)}, 0.55, 0.62);`),
          `tl.fromTo("#qa", { clipPath: "inset(-40% 100% -40% -6%)", rotation: -1.4 }, { clipPath: "inset(-40% -6% -40% -6%)", rotation: -1.4, duration: 0.5, ease: "power2.out" }, ${f2(done + 0.2)});`,
          ...(spec.role ? [writeIn('#qo', done + 0.55, 0.6), 'hs.boil("#qo", 47, 1.2, 0.4, -2);'] : []),
        ],
      };
    }

    // A press clipping torn from the page lands on the desk and is taped down; the marked words get
    // a highlighter pass, one after another, and the date is underlined in red.
    case 'headline': {
      const words = markedWords(spec.headline);
      const L = [...spec.headline.replace(/\*/g, '')].length;
      const size = L <= 36 ? 104 : L <= 60 ? 88 : L <= 90 ? 74 : 62;
      let html = '';
      let g = 0;
      for (let i = 0; i < words.length; ) {
        const grp = words[i]!.group;
        if (grp < 0) {
          html += `${html ? ' ' : ''}${esc(words[i]!.word)}`;
          i++;
          continue;
        }
        const run: string[] = [];
        for (; words[i]?.group === grp; i++) run.push(esc(words[i]!.word));
        html += `${html ? ' ' : ''}<span class="hlw">${hlMark(`hh${g++}`)}<span class="hlt">${run.join(' ')}</span></span>`;
      }
      const lines = (col: number) => Array.from({ length: 8 }, (_, i) => `<i style="width:${92 - ((col * 5 + i * 11) % 4) * 7}%"></i>`).join('');
      return {
        ...base,
        layout: 'center',
        print: 'copy',
        focus: [960, 470],
        body: `<div id="cl" class="cpw"><div class="cpi"><div class="cm disp">${esc(spec.paper)}</div><div class="cdl"><span id="cdt">${esc(spec.date)}</span><span id="cdu" class="cdu">${markSvg(UNDERLINE, 'du', 'ulm', c.accent)}</span></div>` +
          `<div class="ch disp" style="font-size:${size}px">${html}</div>${spec.deck ? `<div class="ck">${esc(spec.deck)}</div>` : ''}<div class="cb">${[0, 1, 2].map((k) => `<div>${lines(k)}</div>`).join('')}</div></div>` +
          `<i id="ct0" class="tape" style="left:-60px;top:20px"></i><i id="ct1" class="tape" style="right:-60px;top:20px"></i><i id="ct2" class="tape" style="right:120px;bottom:-14px"></i></div>` +
          (spec.kicker ? label(spec.kicker, 'tl-k') : ''),
        css: `.cpw{position:absolute;left:400px;top:190px;width:1140px;height:800px}.cpi{position:absolute;inset:0;padding:46px 70px 0;background-color:#efe6cf;background-image:linear-gradient(170deg,rgba(255,255,255,.35),rgba(120,90,40,.08));clip-path:${torn(5)};filter:drop-shadow(0 18px 24px rgba(52,36,12,.3))}
.cm{font-size:74px;line-height:1;text-align:center;color:${c.text};padding-bottom:14px;border-bottom:5px double ${c.text}}
.cdl{position:relative;display:block;width:max-content;margin:12px auto 0;font-family:"${t.fonts.body}";font-size:24px;letter-spacing:3px;text-transform:uppercase;color:${c.textSub}}.cdu{position:absolute;left:-2%;bottom:-10px;width:104%;height:14px}.ulm{width:100%;height:100%;overflow:visible}
.ch{line-height:1.03;text-align:center;color:${c.text};margin:34px 0 20px}.ck{font-family:"${t.fonts.body}";font-size:28px;line-height:1.4;text-align:center;color:${c.textSub};padding:0 30px 22px;border-bottom:2px solid ${c.line}}
.cb{display:grid;grid-template-columns:1fr 1fr 1fr;gap:38px;padding-top:26px}.cb div{display:flex;flex-direction:column;gap:15px}.cb i{display:block;height:12px;background:rgba(28,26,22,.16)}${markCss}`,
        js: [
          RUNTIME,
          `tl.fromTo("#cl", { opacity: 0, scale: 1.25, rotation: -7 }, { opacity: 1, scale: 1, rotation: -2.2, duration: 0.42, ease: "power3.in" }, ${f2(headlineTimes.pageIn)});`,
          `tl.to("#world", { x: 5, y: -3, duration: 1 / 30, ease: "none" }, ${f2(headlineTimes.pageIn + 0.42)}); tl.to("#world", { x: -4, y: 2, duration: 1 / 30, ease: "none" }, ">"); tl.to("#world", { x: 0, y: 0, duration: 1 / 30, ease: "none" }, ">");`,
          tapeIn('#ct0', 0.65, -24),
          tapeIn('#ct1', 0.75, 22),
          tapeIn('#ct2', 0.85, -6),
          ...(spec.kicker ? [labelIn(0.9)] : []),
          ...Array.from({ length: g }, (_, k) => `hs.draw("hh${k}", ${f2(headlineTimes.mark(k))}, 0.45, 0.62);`),
          `hs.draw("du", ${f2(headlineTimes.mark(g) + 0.1)}, 0.4, 1); hs.boil("#cdu", 53, 1, 0.4, 0);`,
        ],
      };
    }

    // The document as a photocopy taped to the desk; the camera leans in (the sheet straightens as it
    // does) and the marks go on in ink: highlighter, red ring, red underline, black marker; notes are
    // handwritten in red beside them.
    case 'docmark': {
      const zoom = spec.zoom !== false;
      const T = docmarkTimes(zoom);
      const D = docLayout(spec, { x: 200, y: 160, w: 1520, h: 790 });
      const k = D.cam.k;
      const ext = spec.src.slice(spec.src.lastIndexOf('.')).toLowerCase();
      const marks = D.marks
        .map((m, i) => {
          const type = m.type ?? 'highlight';
          let shape: string;
          if (type === 'circle') {
            const w = m.w + 60;
            const h = m.h + 50;
            shape = `<div id="mb${i}" class="ink" style="left:${f2(m.x - 30)}px;top:${f2(m.y - 25)}px"><svg width="${f2(w)}" height="${f2(h)}" style="overflow:visible"><path id="mk${i}" d="${inkLoop(w, h, 60 + i)}" fill="none" stroke="${c.accent}" stroke-width="${f2(7 / k)}" stroke-linecap="round" opacity="0"/></svg></div>`;
          } else if (type === 'redact') {
            shape = `<i id="mk${i}" class="mrd" style="left:${f2(m.x - 4)}px;top:${f2(m.y)}px;width:${f2(m.w + 8)}px;height:${f2(m.h)}px"></i>`;
          } else {
            const M = type === 'underline' ? UNDERLINE : HIGHLIGHT;
            const top = type === 'underline' ? m.y + m.h - m.h * 0.15 : m.y - m.h * 0.2;
            const h = type === 'underline' ? Math.max(10 / k, m.h * 0.35) : m.h * 1.4;
            shape = `<div id="mb${i}" class="ink" style="left:${f2(m.x - m.w * 0.02)}px;top:${f2(top)}px;width:${f2(m.w * 1.04)}px;height:${f2(h)}px">${markSvg(M, `mk${i}`, 'mfill', type === 'underline' ? c.accent : c.accentHi)}</div>`;
          }
          const place = notePlace(type === 'circle' ? { x: m.x - 30, y: m.y - 25, w: m.w + 60, h: m.h + 50 } : m, D, [...(m.note ?? '')].length * 1.1, m.side);
          const note = m.note ? `<div id="mn${i}" class="mnh hand" style="${place};font-size:${f2(44 / k)}px">${esc(m.note)}</div>` : '';
          return shape + note;
        })
        .join('');
      return {
        ...base,
        layout: 'center',
        print: 'copy',
        focus: [960, 560],
        body: `<div id="cam" class="dcam"><div id="dp" class="dpr" style="left:${f2(D.left - 14)}px;top:${f2(D.top - 14)}px;width:${f2(D.dw + 28)}px;height:${f2(D.dh + 28)}px"><img src="doc${ext}" alt="" /><i id="dt0" class="tape" style="left:-50px;top:-14px"></i><i id="dt1" class="tape" style="right:-50px;top:-14px"></i></div>${marks}</div>` +
          (spec.kicker ? label(spec.kicker, 'tl-k') : '') +
          (spec.sub ? `<div class="dsl">${typed('s', spec.sub)}</div>` : ''),
        css: `.dcam{position:absolute;inset:0;transform-origin:0 0}.dpr{position:absolute;padding:14px;background:#f8f5ed;box-shadow:0 26px 50px rgba(52,36,12,.34),0 3px 6px rgba(52,36,12,.28)}.dpr img{width:100%;height:100%;display:block;filter:grayscale(.55) sepia(.18) contrast(1.12)}
.mfill{width:100%;height:100%;overflow:visible}.mrd{position:absolute;background:#1c1a16;transform-origin:left center;transform:scaleX(0);clip-path:polygon(0 8%,3% 0,97% 6%,100% 30%,99% 92%,96% 100%,2% 95%,0 60%)}
.mnh{position:absolute;white-space:nowrap;line-height:1;color:${c.accent};padding:.18em .4em .12em;background:#fbf3c4;box-shadow:0 .12em .3em rgba(52,36,12,.28)}
.tl-k{position:absolute;left:150px;top:70px}.dsl{position:absolute;left:150px;bottom:40px;opacity:0;padding:14px 26px 12px 44px;background:${PAPER};box-shadow:0 10px 24px rgba(52,36,12,.22)}`,
        js: [
          RUNTIME,
          'tl.fromTo("#dp", { opacity: 0, y: -50, rotation: 3.5 }, { opacity: 1, y: 0, rotation: 1.4, duration: 0.55, ease: "power3.out" }, 0);',
          tapeIn('#dt0', 0.45, -32),
          tapeIn('#dt1', 0.55, 30),
          ...(spec.kicker ? [labelIn(0.25)] : []),
          ...(zoom ? [`tl.fromTo("#cam", { x: 0, y: 0, scale: 1 }, { x: ${f2(D.cam.x)}, y: ${f2(D.cam.y)}, scale: ${k.toFixed(4)}, duration: 1.2, ease: "power2.inOut" }, ${f2(T.zoomAt)});`, `tl.to("#dp", { rotation: 0, duration: 1.2, ease: "power2.inOut" }, ${f2(T.zoomAt)});`] : []),
          ...D.marks.flatMap((m, i) => {
            const at = T.mark(i);
            const type = m.type ?? 'highlight';
            return [
              type === 'redact'
                ? `tl.to("#mk${i}", { scaleX: 1, duration: 0.42, ease: "steps(6)" }, ${f2(at)});`
                : `hs.draw("mk${i}", ${f2(at)}, ${type === 'circle' ? 0.55 : 0.45}, ${type === 'highlight' ? 0.6 : 1});`,
              ...(type === 'circle' ? [`hs.boil("#mb${i}", ${61 + i}, ${f2(1.4 / k)}, 0.3, 0);`] : []),
              ...(m.note ? [writeIn(`#mn${i}`, at + 0.3, 0.5)] : []),
            ];
          }),
          ...(spec.sub ? [`tl.fromTo(".dsl", { opacity: 0 }, { opacity: 1, duration: 0.25 }, ${f2(T.mark(D.marks.length - 1) + 0.5)});`, typeIn('s', T.mark(D.marks.length - 1) + 0.6, spec.sub)] : []),
        ],
      };
    }

    // A personnel folder: photo print pinned inside the cover, the name pressed in headline type,
    // life years rolling in red then ringed, the role typed, dated facts typed with handwritten years.
    case 'profile': {
      const nameL = [...spec.name].length;
      const ns = nameL <= 12 ? 120 : nameL <= 20 ? 96 : nameL <= 28 ? 78 : 64;
      const w = wheel(spec.years, 'py');
      const ext = spec.photo.slice(spec.photo.lastIndexOf('.')).toLowerCase();
      const facts = spec.facts ?? [];
      const ys = 84;
      const loopW = [...spec.years].length * ys * 0.46 + 60;
      const loopH = ys * 1.4;
      return {
        ...base,
        print: 'copy',
        focus: [760, 540],
        body: `<div id="fd" class="fold"><i class="ftab"></i></div><div id="pp" class="ppr"><div class="ppi"><img src="photo${ext}" alt="" /></div><i class="pushpin" style="left:200px;top:-14px"></i></div>` +
          `<div class="pcl"><div id="pn" class="pnm disp" style="font-size:${ns}px">${esc(spec.name)}</div>` +
          `<div class="pyw"><div id="py" class="pyr num">${w.html}</div><div id="ylb" class="ink" style="left:-30px;top:-12px"><svg width="${f2(loopW)}" height="${f2(loopH)}" style="overflow:visible"><path id="yl" d="${inkLoop(loopW, loopH, 71)}" fill="none" stroke="${c.accent}" stroke-width="7" stroke-linecap="round" opacity="0"/></svg></div></div>` +
          `${typed('pr', spec.role, 'pro')}` +
          (facts.length ? `<div class="pfs">${facts.map((fct, i) => `<div class="pft"><b id="fy${i}" class="hand">${esc(fct.year)}</b>${typed(`ft${i}`, fct.text, 'ftx')}</div>`).join('')}</div>` : '') +
          `</div>`,
        css: `.fold{position:absolute;left:120px;top:110px;width:1680px;height:900px;background:linear-gradient(170deg,#e2cd98,#d4bc82);box-shadow:0 26px 60px rgba(52,36,12,.35),inset 0 0 0 2px rgba(120,90,40,.25)}.ftab{position:absolute;left:60px;top:-46px;width:360px;height:52px;border-radius:14px 14px 0 0;background:#e2cd98}
.ppr{position:absolute;left:200px;top:190px;width:500px;height:660px;padding:18px 18px 70px;background:#f8f5ed;box-shadow:0 20px 40px rgba(52,36,12,.32)}.ppi{width:100%;height:100%;overflow:hidden}.ppi img{width:100%;height:100%;object-fit:cover;filter:grayscale(.85) sepia(.25) contrast(1.06)}
.pcl{position:absolute;left:800px;right:180px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.pnm{line-height:1.02;color:${c.text}}.pyw{position:relative;margin-top:26px}.pyr{display:flex;align-items:flex-end;font-size:${ys}px;line-height:1;color:${c.accent}}
.pro{font-size:30px;margin-top:30px;max-width:840px}.pfs{display:flex;flex-direction:column;gap:18px;margin-top:40px}.pft{display:flex;align-items:baseline;gap:26px}.pft b{flex:none;font-size:46px;line-height:1;color:${c.accent}}.ftx{font-size:27px}.ftx::before{display:none}`,
        js: [
          RUNTIME,
          'tl.fromTo("#fd", { opacity: 0, y: 120 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0);',
          'tl.fromTo("#pp", { opacity: 0, y: -90, rotation: -9 }, { opacity: 1, y: 0, rotation: -2.5, duration: 0.6, ease: "power3.out" }, 0.15);',
          `tl.fromTo("#pp img", { scale: 1.12 }, { scale: 1, duration: ${f2(seconds)}, ease: "none" }, 0);`,
          press('#pn', 0.45),
          'tl.fromTo("#py", { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.65);',
          ...w.js(profileTimes.roll.at, profileTimes.roll.dur),
          `hs.draw("yl", ${f2(profileTimes.roll.at + profileTimes.roll.dur + 0.1)}, 0.55, 1); hs.boil("#ylb", 73, 1.4, 0.4, 0);`,
          typeIn('pr', 1.0, spec.role),
          ...facts.flatMap((fct, i) => [writeIn(`#fy${i}`, profileTimes.fact(i), 0.3), typeIn(`ft${i}`, profileTimes.fact(i) + 0.15, fct.text)]),
        ],
      };
    }
  }
}
