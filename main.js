/**
 * Main Interactive Controller for Iwan's Portfolio
 * - Book-style stepped pixel page-turn animation where the actual outgoing
 *   white paper sheet (with its title, rules, grid, and grey placeholders) curls
 *   and flips upward from the bottom-right dog-ear corner to the top clip
 * - Locked constant board dimensions so the clipboard never resizes across flips
 * - Single full-page radial spotlight masking the isometric grid & environment props
 * - Yolk sprite state machine (idle + blink, walk, run) & straight-line section travel
 * - Reusable typewriter speech bubble with pagination & aria-live announcements
 * - Hero timed onboarding sequence with user-action cancellation
 * - Debug overlay toggle ("O" key) for assets/board_target.png alignment
 */

/* ==========================================================================
   TUNABLE CONSTANTS
   ========================================================================== */
const HERO_LINE_1 = 'PORTO';
const HERO_LINE_2 = 'FOLIO’S';

const SELECTED_WORKS_TITLE = 'Selected works';
const SELECTED_WORKS_SUBTITLE =
  "A few of the projects I've done over the past 5 years. I picked the ones that show my craft as a designer and problem solver.";

const COLORS = {
  background: '#FDFDFA',
  text: '#111111',
  accent: '#1F5FFF',
  gridLine: '#D4D4CE'
};

// Book-Style Stepped Pixel Page-Flip Choreography
const FLIP_FRAME_COUNT = 9; // Number of discrete pixel-art page-turn poses
const ACCESSORY_DROP_OUT_MS = 110; // t=0..110ms old note & polaroid drop out
const ACCESSORY_DROP_OUT_STAGGER_MS = 35; // stagger between note and polaroid exit
const PAPER_FLIP_DELAY_MS = 50; // t=50ms page starts lifting from bottom-right fold
const PAPER_FLIP_DURATION_MS = 560; // t=50..610ms stepped pixel book-turn duration
const ACCESSORY_DROP_IN_MS = 180; // t=610..790ms new note & polaroid drop in
const ACCESSORY_DROP_IN_STAGGER_MS = 70; // stagger between new note and polaroid entry
const REDUCED_MOTION_CROSSFADE_MS = 200; // 200ms crossfade when prefers-reduced-motion is active

// Spotlight Mask Radius (centered on Yolk's ground point)
const SPOT_RADIUS_DESKTOP_PX = 400;
const SPOT_RADIUS_MOBILE_PX = 220;
const MOBILE_BREAKPOINT_PX = 768;

// Yolk Sprite Sheet Definitions (all sheets face LEFT; mirrored in code to face right)
const YOLK_SCALE_DESKTOP = 3;
const YOLK_SCALE_MOBILE = 2;

function getYolkScale() {
  return window.innerWidth <= MOBILE_BREAKPOINT_PX
    ? YOLK_SCALE_MOBILE
    : YOLK_SCALE_DESKTOP;
}

const YOLK_SPRITES = {
  idle: {
    src: 'assets/yolk_idle_sheet_transparent_1x.png',
    cellW: 36,
    cellH: 53,
    cols: 4,
    rows: 2,
    anchorX: 17,
    anchorY: 52,
    frameMs: 500
  },
  walk: {
    src: 'assets/yolk_walk_wide_sheet_transparent_1x.png',
    cellW: 40,
    cellH: 55,
    cols: 8,
    rows: 1,
    anchorX: 19,
    anchorY: 53,
    frameMs: 110
  },
  run: {
    src: 'assets/yolk_run_sheet_transparent_1x.png',
    cellW: 48,
    cellH: 56,
    cols: 8,
    rows: 1,
    anchorX: 24,
    anchorY: 54,
    frameMs: 75
  }
};

// Yolk Blink, Section Hysteresis & Travel Kinematics
const BLINK_MIN_INTERVAL_MS = 3000;
const BLINK_MAX_INTERVAL_MS = 6000;
const BLINK_DURATION_MS = 130;

const SECTION_HYSTERESIS_RATIO = 0.12;
const YOLK_RUN_SPEED_PX_S = 1100;
const YOLK_ACCEL_MS = 150;
const YOLK_DECEL_MS = 250;
const YOLK_TRAVEL_MIN_MS = 400;
const YOLK_TRAVEL_MAX_MS = 1400;
const WALK_SWITCH_DISTANCE_PX = 120;
const OFFSCREEN_ENTRY_MARGIN_PX = 120;

const FOLLOW_TIME_CONSTANT_MS = 150;
const ARRIVAL_THRESHOLD_PX = 2;
const IDLE_SETTLE_MS = 100;

// Speech Bubble & Onboarding Timings
const TYPEWRITER_CHAR_MS = 30;
const WORKS_BUBBLE_DELAY_MS = 1000;
const HERO_STEP_1_DELAY_MS = 1000;
const HERO_BUBBLE_VISIBLE_MS = 20000;
const HERO_BETWEEN_BUBBLES_MS = 10000;
const HERO_AUTO_SCROLL_DURATION_MS = 1800;

// Hero Bubble Sequence Messages
const HERO_BUBBLE_MESSAGES = [
  "Hello there, my name is Yolk. I'm your assistant, here to help explain things. Lets scroll to my selected work to start ",
  "Well, let's go.",
  'Any minute now…',
  "I'll do it for you."
];

/* ==========================================================================
   ASSET FALLBACK HANDLER (tries data-alt-src only; transparent pixel if absent)
   ========================================================================== */
const TRANSPARENT_PIXEL_URI =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function handleBrokenImage(img) {
  if (!(img instanceof HTMLImageElement)) return;
  const altSrc = img.dataset.altSrc;
  if (altSrc && !img.dataset.triedAlt) {
    img.dataset.triedAlt = '1';
    img.src = altSrc;
    return;
  }
  if (!img.dataset.triedBlank) {
    img.dataset.triedBlank = '1';
    img.src = TRANSPARENT_PIXEL_URI;
  }
}

window.addEventListener(
  'error',
  (event) => {
    handleBrokenImage(event.target);
  },
  true
);

document.querySelectorAll('img').forEach((img) => {
  if (img.complete && img.naturalWidth === 0) {
    handleBrokenImage(img);
  }
});

/* ==========================================================================
   PIXEL-ART BOOK-STYLE PAGE-FLIP FRAME RENDERER (Full Solid White Paper)
   ========================================================================== */
function drawPixelLine(ctx, x0, y0, x1, y1, color, thickness = 3) {
  let ix0 = Math.round(x0);
  let iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);
  const dx = Math.abs(ix1 - ix0);
  const dy = Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx - dy;

  ctx.fillStyle = color;
  while (true) {
    ctx.fillRect(ix0, iy0, thickness, thickness);
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      ix0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      iy0 += sy;
    }
  }
}

function drawPixelQuadCurve(ctx, p0, p1, p2, color, thickness = 1) {
  const steps = 42;
  let prev = p0;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
    const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
    drawPixelLine(ctx, prev.x, prev.y, x, y, color, thickness);
    prev = { x, y };
  }
}

function fillPixelPolygon(ctx, points, fillColor) {
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  points.forEach((pt, idx) => {
    const rx = Math.round(pt.x);
    const ry = Math.round(pt.y);
    if (idx === 0) ctx.moveTo(rx, ry);
    else ctx.lineTo(rx, ry);
  });
  ctx.closePath();
  ctx.fill();
}

function strokePixelPolygon(ctx, points, strokeColor, thickness = 1) {
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    drawPixelLine(ctx, a.x, a.y, b.x, b.y, strokeColor, thickness);
  }
}

function renderBookFlipPixelFrame(canvas, stepIndex, totalSteps) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);

  // Exact 1:1 match to .paper-slot inside the 148% x 140% .paper-flip-canvas wrapper
  const px = Math.round(cw * (0.24 / 1.48));
  const py = Math.round(ch * (0.20 / 1.40));
  const pw = Math.round(cw * (1.0 / 1.48));
  const ph = Math.round(ch * (1.0 / 1.40));

  // Adjust these two values to tune the animated paper look:
  const outlineThickness = 2; // 1 = thin (~2px on screen), 2 = medium (~4px), 3 = thick (~6px)
  const cornerRadius = 4;     // 4 logical px ≈ 8px on screen

  const t = totalSteps > 1 ? stepIndex / (totalSteps - 1) : 1;

  const ink = '#111111';
  const placeholderGrey = '#BEBEBA';
  const paperWhite = '#FFFFFF';
  const paperBack = '#ECECE6';
  const paperFoldShadow = '#D4D4CE';

  if (t <= 0.55) {
    const u = t / 0.55;
    const peelX = px + pw * (1 - 0.84 * u);
    const peelY = py + ph * (1 - 0.86 * u);

    const rTL = cornerRadius;
    const rTR = Math.min(cornerRadius, Math.max(0, Math.round(peelY - py)));
    const rBL = Math.min(cornerRadius, Math.max(0, Math.round(peelX - px)));

    const frontPoly = [
      { x: px, y: py + rTL },
      { x: px + 1, y: py + 1 },
      { x: px + rTL, y: py },
      { x: px + pw - rTR, y: py }
    ];

    if (rTR >= 2) frontPoly.push({ x: px + pw - 1, y: py + 1 });
    if (rTR >= 1) frontPoly.push({ x: px + pw, y: py + rTR });

    if (u <= 0.001) {
      frontPoly.push({ x: px + pw, y: py + ph - cornerRadius });
      frontPoly.push({ x: px + pw - 1, y: py + ph - 1 });
      frontPoly.push({ x: px + pw - cornerRadius, y: py + ph });
    } else {
      frontPoly.push({ x: px + pw, y: peelY });
      frontPoly.push({ x: peelX, y: py + ph });
    }

    if (rBL >= 1) frontPoly.push({ x: px + rBL, y: py + ph });
    if (rBL >= 2) frontPoly.push({ x: px + 1, y: py + ph - 1 });
    frontPoly.push({ x: px, y: py + ph - rBL });

    ctx.save();
    ctx.beginPath();
    frontPoly.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(Math.round(pt.x), Math.round(pt.y));
      else ctx.lineTo(Math.round(pt.x), Math.round(pt.y));
    });
    ctx.closePath();
    ctx.clip();

    // Solid white outgoing paper fill + crisp rules + grey text placeholders + graph grid + grey box
    ctx.fillStyle = paperWhite;
    ctx.fillRect(px, py, pw, ph);

    const ruleTopY = py + Math.round(ph * 0.192);
    const ruleBotY = py + Math.round(ph * 0.266);
    const ruleLeftX = px + Math.round(pw * 0.14);
    const ruleW = Math.round(pw * 0.72);

    // Grey placeholder bars for project title, years, and project code
    ctx.fillStyle = placeholderGrey;
    ctx.fillRect(px + Math.round(pw * 0.22), py + Math.round(ph * 0.142), Math.round(pw * 0.56), 7);
    ctx.fillRect(px + Math.round(pw * 0.34), py + Math.round(ph * 0.243), Math.round(pw * 0.32), 3);
    ctx.fillRect(px + Math.round(pw * 0.82), py + Math.round(ph * 0.318), Math.round(pw * 0.12), 3);

    // Two crisp horizontal rules
    ctx.fillStyle = ink;
    ctx.fillRect(ruleLeftX, ruleTopY, ruleW, 1);
    ctx.fillRect(ruleLeftX, ruleBotY, ruleW, 1);

    // Graph-paper grid panel
    const gx = px + Math.round(pw * 0.05);
    const gy = py + Math.round(ph * 0.382);
    const gw = Math.round(pw * 0.90);
    const gh = Math.round(ph * 0.55);
    ctx.strokeStyle = '#D4D4CE';
    ctx.lineWidth = 1;
    ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);

    ctx.fillStyle = '#EBEBE6';
    for (let x = gx + 5; x < gx + gw; x += 5) {
      ctx.fillRect(x, gy, 1, gh);
    }
    for (let y = gy + 5; y < gy + gh; y += 5) {
      ctx.fillRect(gx, y, gw, 1);
    }

    // Main grey showcase placeholder box
    const boxX = gx + Math.round(gw * 0.05);
    const boxY = gy + Math.round(gh * 0.08);
    const boxW = Math.round(gw * 0.90);
    const boxH = Math.round(gh * 0.64);
    ctx.fillStyle = '#C9C9C7';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Grey Case Study pill placeholder inside bottom of grid
    const pillW = Math.round(gw * 0.38);
    const pillH = Math.max(6, Math.round(gh * 0.11));
    ctx.fillStyle = placeholderGrey;
    ctx.fillRect(gx + Math.round((gw - pillW) * 0.5), gy + gh - pillH - Math.round(gh * 0.06), pillW, pillH);

    ctx.restore();

    // Outline of main sheet
    strokePixelPolygon(ctx, frontPoly, ink, outlineThickness);

    // Lifted curling flap turning upward toward top-left
    const tipX = px + pw * (0.86 - 0.94 * u);
    const tipY = py + ph * (0.84 - 0.96 * u);
    const foldTop = { x: px + pw, y: peelY };
    const foldBot = { x: peelX, y: py + ph };
    const midCtrl = {
      x: (foldTop.x + tipX) * 0.5 + 14 * u,
      y: (foldBot.y + tipY) * 0.5 + 16 * u
    };

    fillPixelPolygon(
      ctx,
      [
        { x: foldTop.x - 1, y: foldTop.y + 2 },
        { x: tipX - 1, y: tipY + 2 },
        { x: foldBot.x - 1, y: foldBot.y + 2 }
      ],
      paperFoldShadow
    );

    fillPixelPolygon(ctx, [foldTop, { x: tipX, y: tipY }, foldBot], paperBack);

    drawPixelQuadCurve(ctx, foldTop, midCtrl, { x: tipX, y: tipY }, ink, outlineThickness);
    drawPixelQuadCurve(
      ctx,
      { x: tipX, y: tipY },
      { x: (tipX + foldBot.x) * 0.5 - 6 * u, y: (tipY + foldBot.y) * 0.5 + 8 * u },
      foldBot,
      ink,
      outlineThickness
    );
    drawPixelLine(ctx, foldTop.x, foldTop.y, foldBot.x, foldBot.y, ink, outlineThickness);
  } else {
    const v = (t - 0.55) / 0.45;
    const topLeft = { x: px + 2 * v, y: py - 6 * v };
    const topRight = { x: px + pw - 8 * v, y: py - 14 * v };

    const sweepY = py + ph * (0.24 - 0.46 * v);
    const botLeft = { x: px - 10 * (1 - v) - 4 * v, y: sweepY + 8 * (1 - v) };
    const botRight = { x: px + pw * (0.35 + 0.52 * v), y: sweepY - 12 * v };

    const topLeftStart = { x: topLeft.x, y: topLeft.y + cornerRadius };
    const topLeftBevel = { x: topLeft.x + 1, y: topLeft.y + 1 };
    const topLeftEnd = { x: topLeft.x + cornerRadius, y: topLeft.y };

    const topRightStart = { x: topRight.x - cornerRadius, y: topRight.y };
    const topRightBevel = { x: topRight.x - 1, y: topRight.y + 1 };
    const topRightEnd = { x: topRight.x, y: topRight.y + cornerRadius };

    const shadowOffset = Math.max(1, Math.round(3 * (1 - v)));
    fillPixelPolygon(
      ctx,
      [
        { x: topLeftStart.x, y: topLeftStart.y + shadowOffset },
        { x: topLeftBevel.x, y: topLeftBevel.y + shadowOffset },
        { x: topLeftEnd.x, y: topLeftEnd.y + shadowOffset },
        { x: topRightStart.x, y: topRightStart.y + shadowOffset },
        { x: topRightBevel.x, y: topRightBevel.y + shadowOffset },
        { x: topRightEnd.x, y: topRightEnd.y + shadowOffset },
        { x: botRight.x, y: botRight.y + shadowOffset },
        { x: botLeft.x, y: botLeft.y + shadowOffset }
      ],
      paperFoldShadow
    );

    const pageFill = v < 0.5 ? paperWhite : paperFoldShadow;
    fillPixelPolygon(
      ctx,
      [
        topLeftStart,
        topLeftBevel,
        topLeftEnd,
        topRightStart,
        topRightBevel,
        topRightEnd,
        botRight,
        botLeft
      ],
      pageFill
    );

    drawPixelLine(ctx, topLeftStart.x, topLeftStart.y, topLeftBevel.x, topLeftBevel.y, ink, outlineThickness);
    drawPixelLine(ctx, topLeftBevel.x, topLeftBevel.y, topLeftEnd.x, topLeftEnd.y, ink, outlineThickness);
    drawPixelLine(ctx, topLeftEnd.x, topLeftEnd.y, topRightStart.x, topRightStart.y, ink, outlineThickness);
    drawPixelLine(ctx, topRightStart.x, topRightStart.y, topRightBevel.x, topRightBevel.y, ink, outlineThickness);
    drawPixelLine(ctx, topRightBevel.x, topRightBevel.y, topRightEnd.x, topRightEnd.y, ink, outlineThickness);
    drawPixelLine(ctx, botLeft.x, botLeft.y, botRight.x, botRight.y, ink, outlineThickness);

    const leftCtrl = {
      x: (topLeftStart.x + botLeft.x) * 0.5 - 11 * (1 - v * 0.5),
      y: (topLeftStart.y + botLeft.y) * 0.5
    };
    const rightCtrl = {
      x: (topRightEnd.x + botRight.x) * 0.5 - 13 * (1 - v * 0.5),
      y: (topRightEnd.y + botRight.y) * 0.5
    };
    drawPixelQuadCurve(ctx, topLeftStart, leftCtrl, botLeft, ink, outlineThickness);
    drawPixelQuadCurve(ctx, topRightEnd, rightCtrl, botRight, ink, outlineThickness);
  }
}
/* ==========================================================================
   INITIALIZATION & REDUCED MOTION CHECK
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = prefersReducedMotionQuery.matches;

  prefersReducedMotionQuery.addEventListener('change', (event) => {
    reducedMotion = event.matches;
    if (reducedMotion) {
      cancelHeroSequence();
      stopAutoScroll();
    }
  });

  const heroLine1El = document.getElementById('hero-line-1');
  const heroLine2El = document.getElementById('hero-line-2');
  const worksHeadingEl = document.getElementById('works-heading');
  const worksSubtitleEl = document.getElementById('works-subtitle');

  if (heroLine1El) heroLine1El.textContent = HERO_LINE_1;
  if (heroLine2El) heroLine2El.textContent = HERO_LINE_2;
  if (worksHeadingEl) worksHeadingEl.textContent = SELECTED_WORKS_TITLE;
  if (worksSubtitleEl) worksSubtitleEl.textContent = SELECTED_WORKS_SUBTITLE;

  const pageShell = document.getElementById('page-shell');

  function updateResponsiveScales() {
    const scale = getYolkScale();
    document.documentElement.style.setProperty('--yolk-scale', String(scale));
    document.documentElement.style.setProperty('--prop-scale', String(scale));

    const radius =
      window.innerWidth <= MOBILE_BREAKPOINT_PX
        ? SPOT_RADIUS_MOBILE_PX
        : SPOT_RADIUS_DESKTOP_PX;
    pageShell.style.setProperty('--spot-radius', `${radius}px`);
  }

  updateResponsiveScales();

  /* ========================================================================
     1. POSITION MASKED ENVIRONMENT PROPS RELATIVE TO STAGE BOXES
     ======================================================================== */
  const heroStageEl = document.getElementById('hero-stage');
  const worksYolkStageEl = document.getElementById('works-yolk-stage');
  const propElements = Array.from(document.querySelectorAll('#spotlight-props .pixel-prop'));

  function layoutSpotlightProps() {
    const shellRect = pageShell.getBoundingClientRect();
    const stageRects = {
      hero: heroStageEl ? heroStageEl.getBoundingClientRect() : null,
      works: worksYolkStageEl ? worksYolkStageEl.getBoundingClientRect() : null
    };

    propElements.forEach((propEl) => {
      const stageKey = propEl.getAttribute('data-stage');
      const rx = parseFloat(propEl.getAttribute('data-rx') || '0.5');
      const ry = parseFloat(propEl.getAttribute('data-ry') || '0.5');
      const stageRect = stageRects[stageKey];
      if (!stageRect) return;

      const leftPx = stageRect.left - shellRect.left + stageRect.width * rx;
      const topPx = stageRect.top - shellRect.top + stageRect.height * ry;
      propEl.style.left = `${Math.round(leftPx)}px`;
      propEl.style.top = `${Math.round(topPx)}px`;
    });
  }

  layoutSpotlightProps();

  /* ========================================================================
     2. REUSABLE SPEECH BUBBLE COMPONENT (Typewriter + Pagination)
     ======================================================================== */
  const bubbleEl = document.getElementById('speech-bubble');
  const bubbleTextEl = document.getElementById('speech-bubble-text');
  const bubbleControlsEl = document.getElementById('speech-bubble-controls');
  const bubblePrevBtn = document.getElementById('bubble-prev-btn');
  const bubbleNextBtn = document.getElementById('bubble-next-btn');

  let bubblePages = [];
  let bubblePageIndex = 0;
  let bubbleOwner = null;
  let bubbleVisible = false;
  let isBubbleTyping = false;
  let typewriterTimer = null;
  let worksBubbleDelayTimer = null;

  function clearBubbleTimers() {
    if (typewriterTimer) {
      window.clearInterval(typewriterTimer);
      typewriterTimer = null;
    }
    isBubbleTyping = false;
    if (worksBubbleDelayTimer) {
      window.clearTimeout(worksBubbleDelayTimer);
      worksBubbleDelayTimer = null;
    }
  }

  function positionBubbleAboveYolk(yolkX, yolkY) {
    if (!bubbleVisible || !bubbleEl) return;
    const scale = getYolkScale();
    const shellRect = pageShell.getBoundingClientRect();
    const bubbleWidth = bubbleEl.offsetWidth || 304;
    const bubbleHeight = bubbleEl.offsetHeight || 130;

    let left = Math.round(yolkX - bubbleWidth * 0.56);
    const minLeft = 18;
    const maxLeft = Math.max(minLeft, shellRect.width - bubbleWidth - 18);
    left = Math.max(minLeft, Math.min(maxLeft, left));

    const top = Math.round(yolkY - YOLK_SPRITES.idle.cellH * scale - bubbleHeight - 16);
    bubbleEl.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  function updateBubbleControls() {
    if (bubblePages.length > 1) {
      bubbleControlsEl.hidden = false;
      bubblePrevBtn.disabled = bubblePageIndex === 0;
      bubbleNextBtn.disabled = !isBubbleTyping && bubblePageIndex >= bubblePages.length - 1;
    } else {
      bubbleControlsEl.hidden = true;
    }
  }

  function finishBubbleTyping() {
    if (!isBubbleTyping || !bubblePages.length) return;
    if (typewriterTimer) {
      window.clearInterval(typewriterTimer);
      typewriterTimer = null;
    }
    isBubbleTyping = false;
    bubbleTextEl.textContent = bubblePages[bubblePageIndex];
    positionBubbleAboveYolk(yolkState.x, yolkState.y);
    updateBubbleControls();
  }

  function renderBubblePage(pageIdx) {
    if (!bubblePages.length) return;
    bubblePageIndex = Math.max(0, Math.min(bubblePages.length - 1, pageIdx));
    const fullText = bubblePages[bubblePageIndex];

    if (typewriterTimer) {
      window.clearInterval(typewriterTimer);
      typewriterTimer = null;
    }

    if (reducedMotion) {
      isBubbleTyping = false;
      updateBubbleControls();
      bubbleTextEl.textContent = fullText;
      positionBubbleAboveYolk(yolkState.x, yolkState.y);
      return;
    }

    isBubbleTyping = true;
    updateBubbleControls();
    bubbleTextEl.textContent = '';
    let charIndex = 0;
    positionBubbleAboveYolk(yolkState.x, yolkState.y);

    typewriterTimer = window.setInterval(() => {
      charIndex += 1;
      bubbleTextEl.textContent = fullText.slice(0, charIndex);
      positionBubbleAboveYolk(yolkState.x, yolkState.y);

      if (charIndex >= fullText.length) {
        window.clearInterval(typewriterTimer);
        typewriterTimer = null;
        isBubbleTyping = false;
        updateBubbleControls();
      }
    }, TYPEWRITER_CHAR_MS);
  }

  function showBubble({ pages, owner, startPage = 0 }) {
    if (!pages || !pages.length) return;
    bubbleOwner = owner;
    bubblePages = pages;
    bubbleVisible = true;
    bubbleEl.hidden = false;
    renderBubblePage(startPage);
  }

  function hideBubble() {
    clearBubbleTimers();
    isBubbleTyping = false;
    bubbleVisible = false;
    bubbleOwner = null;
    bubbleEl.hidden = true;
  }

  bubblePrevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (bubblePageIndex > 0) {
      currentProjectBubblePage = bubblePageIndex - 1;
      renderBubblePage(bubblePageIndex - 1);
    }
  });

  bubbleNextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isBubbleTyping) {
      finishBubbleTyping();
      return;
    }
    if (bubblePageIndex < bubblePages.length - 1) {
      currentProjectBubblePage = bubblePageIndex + 1;
      renderBubblePage(bubblePageIndex + 1);
    }
  });

  /* ========================================================================
     3. YOLK ANIMATION, HYSTERESIS & STRAIGHT-LINE SECTION TRAVEL
     ======================================================================== */
  const yolkActorEl = document.getElementById('yolk-actor');
  const yolkSpriteEl = document.getElementById('yolk-sprite');

  const sectionAnchors = [
    { id: 'hero', sectionEl: document.getElementById('hero'), anchorEl: document.getElementById('anchor-hero') },
    { id: 'works', sectionEl: document.getElementById('works'), anchorEl: document.getElementById('anchor-works') },
    { id: 'about', sectionEl: document.getElementById('about'), anchorEl: document.getElementById('anchor-about') }
  ];

  const yolkState = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    activeSection: 'hero',
    targetOverride: null,
    travel: null,
    animState: 'idle',
    facingRight: false,
    frameIndex: 0,
    frameElapsedMs: 0,
    atTargetMs: IDLE_SETTLE_MS,
    isBlinking: false,
    blinkTimerMs: 0,
    nextBlinkDelayMs: randomBlinkInterval(),
    forceWalk: false,
    initialized: false
  };

  function randomBlinkInterval() {
    return (
      BLINK_MIN_INTERVAL_MS +
      Math.random() * (BLINK_MAX_INTERVAL_MS - BLINK_MIN_INTERVAL_MS)
    );
  }

  function getAnchorPagePosition(anchorEl) {
    const shellRect = pageShell.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    return {
      x: anchorRect.left - shellRect.left + anchorRect.width / 2,
      y: anchorRect.top - shellRect.top + anchorRect.height / 2
    };
  }

  function getSectionEntryById(id) {
    return sectionAnchors.find((entry) => entry.id === id) || sectionAnchors[0];
  }

  function resolveActiveSectionWithHysteresis() {
    const viewportCenterY = window.innerHeight * 0.5;
    const hysteresisPx = window.innerHeight * SECTION_HYSTERESIS_RATIO;

    const currentEntry = getSectionEntryById(yolkState.activeSection);
    const currentRect = currentEntry.sectionEl.getBoundingClientRect();
    const currentCenterY = currentRect.top + currentRect.height * 0.5;
    const currentDistance = Math.abs(currentCenterY - viewportCenterY);

    let bestEntry = currentEntry;
    let bestDistance = currentDistance;

    for (const entry of sectionAnchors) {
      const rect = entry.sectionEl.getBoundingClientRect();
      const centerY = rect.top + rect.height * 0.5;
      const dist = Math.abs(centerY - viewportCenterY);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestEntry = entry;
      }
    }

    if (
      bestEntry.id !== currentEntry.id &&
      currentDistance - bestDistance > hysteresisPx
    ) {
      return bestEntry;
    }

    return currentEntry;
  }

  function startTravelToTarget(targetX, targetY) {
    let startX = yolkState.x;
    let startY = yolkState.y;

    const vpTop = window.scrollY;
    const vpBottom = window.scrollY + window.innerHeight;
    const dyTotal = targetY - startY;

    if (startY < vpTop - window.innerHeight && Math.abs(dyTotal) > 1) {
      const entryY = vpTop - OFFSCREEN_ENTRY_MARGIN_PX;
      const t = Math.max(0, Math.min(1, (entryY - startY) / dyTotal));
      startX = startX + (targetX - startX) * t;
      startY = entryY;
      yolkState.x = startX;
      yolkState.y = startY;
    } else if (startY > vpBottom + window.innerHeight && Math.abs(dyTotal) > 1) {
      const entryY = vpBottom + OFFSCREEN_ENTRY_MARGIN_PX;
      const t = Math.max(0, Math.min(1, (entryY - startY) / dyTotal));
      startX = startX + (targetX - startX) * t;
      startY = entryY;
      yolkState.x = startX;
      yolkState.y = startY;
    }

    const distance = Math.hypot(targetX - startX, targetY - startY);
    if (distance <= ARRIVAL_THRESHOLD_PX) {
      yolkState.travel = null;
      return;
    }

    const tAccel = YOLK_ACCEL_MS / 1000;
    const tDecel = YOLK_DECEL_MS / 1000;
    const rawDuration = distance / YOLK_RUN_SPEED_PX_S + (tAccel + tDecel) * 0.5;
    const durationSec = Math.max(
      YOLK_TRAVEL_MIN_MS / 1000,
      Math.min(YOLK_TRAVEL_MAX_MS / 1000, rawDuration)
    );
    const effectivePlateauTime = Math.max(0.05, durationSec - (tAccel + tDecel) * 0.5);
    const peakSpeed = distance / effectivePlateauTime;

    yolkState.travel = {
      startX,
      startY,
      endX: targetX,
      endY: targetY,
      distance,
      durationSec,
      peakSpeed,
      elapsedSec: 0
    };
    yolkState.atTargetMs = 0;
  }

  function evaluateTrapezoidalProgress(travel, dtSec) {
    travel.elapsedSec = Math.min(travel.durationSec, travel.elapsedSec + dtSec);
    const t = travel.elapsedSec;
    const T = travel.durationSec;
    const tAccel = YOLK_ACCEL_MS / 1000;
    const tDecel = YOLK_DECEL_MS / 1000;
    const vPeak = travel.peakSpeed;

    let s = 0;
    if (t < tAccel) {
      s = 0.5 * (vPeak / tAccel) * t * t;
    } else if (t < T - tDecel) {
      s = 0.5 * vPeak * tAccel + vPeak * (t - tAccel);
    } else {
      const rem = Math.max(0, T - t);
      s = travel.distance - 0.5 * (vPeak / tDecel) * rem * rem;
    }

    const fraction = travel.distance > 0 ? Math.max(0, Math.min(1, s / travel.distance)) : 1;
    const done = travel.elapsedSec >= T;
    return { fraction, done };
  }

  function applyYolkSpriteFrame() {
    const scale = getYolkScale();
    const spec = YOLK_SPRITES[yolkState.animState];
    const scaledW = spec.cellW * scale;
    const scaledH = spec.cellH * scale;
    const sheetW = spec.cellW * spec.cols * scale;
    const sheetH = spec.cellH * spec.rows * scale;

    let col = yolkState.frameIndex % spec.cols;
    let row = 0;

    if (yolkState.animState === 'idle') {
      const breathCol = yolkState.frameIndex % 4;
      if (yolkState.isBlinking) {
        row = 1;
        col = breathCol === 0 || breathCol === 3 ? 0 : 1;
      } else {
        row = 0;
        col = breathCol;
      }
    }

    const bgPosX = -(col * scaledW);
    const bgPosY = -(row * scaledH);

    yolkSpriteEl.style.width = `${scaledW}px`;
    yolkSpriteEl.style.height = `${scaledH}px`;
    yolkSpriteEl.style.backgroundImage = `url("${spec.src}")`;
    yolkSpriteEl.style.backgroundSize = `${sheetW}px ${sheetH}px`;
    yolkSpriteEl.style.backgroundPosition = `${bgPosX}px ${bgPosY}px`;
    yolkSpriteEl.classList.toggle('is-facing-right', yolkState.facingRight);

    const anchorOffsetX = yolkState.facingRight
      ? (spec.cellW - spec.anchorX) * scale
      : spec.anchorX * scale;
    const anchorOffsetY = spec.anchorY * scale;

    const drawX = Math.round(yolkState.x - anchorOffsetX);
    const drawY = Math.round(yolkState.y - anchorOffsetY);
    yolkActorEl.style.transform = `translate3d(${drawX}px, ${drawY}px, 0)`;

    pageShell.style.setProperty('--yolk-x', `${yolkState.x.toFixed(1)}px`);
    pageShell.style.setProperty('--yolk-y', `${yolkState.y.toFixed(1)}px`);

    if (bubbleVisible) {
      positionBubbleAboveYolk(yolkState.x, yolkState.y);
    }
  }

  function onYolkArrivedAtTarget() {
    yolkState.facingRight = yolkState.activeSection === 'works';

    if (yolkState.activeSection === 'works') {
      if (worksBubbleDelayTimer) {
        window.clearTimeout(worksBubbleDelayTimer);
      }
      worksBubbleDelayTimer = window.setTimeout(() => {
        if (yolkState.animState === 'idle' && yolkState.activeSection === 'works') {
          const project = window.PROJECTS[currentProjectIndex];
          showBubble({
            pages: project.bubblePages,
            owner: 'works',
            startPage: currentProjectBubblePage
          });
        }
      }, WORKS_BUBBLE_DELAY_MS);
    }
  }

  function onYolkStartedMoving() {
    if (worksBubbleDelayTimer) {
      window.clearTimeout(worksBubbleDelayTimer);
      worksBubbleDelayTimer = null;
    }
    if (bubbleVisible) {
      hideBubble();
    }
  }

  let lastFrameTime = performance.now();

  function tick(now) {
    const dtMs = Math.min(64, now - lastFrameTime);
    const dtSec = dtMs / 1000;
    lastFrameTime = now;

    let targetSectionId;
    let targetPos;

    if (yolkState.targetOverride) {
      targetSectionId = yolkState.targetOverride.sectionId;
      targetPos = {
        x: yolkState.targetOverride.x,
        y: yolkState.targetOverride.y
      };
    } else {
      const activeEntry = resolveActiveSectionWithHysteresis();
      targetSectionId = activeEntry.id;
      targetPos = getAnchorPagePosition(activeEntry.anchorEl);
    }

    const sectionChanged = targetSectionId !== yolkState.activeSection;
    yolkState.activeSection = targetSectionId;
    yolkState.targetX = targetPos.x;
    yolkState.targetY = targetPos.y;

    if (!yolkState.initialized) {
      yolkState.x = yolkState.targetX;
      yolkState.y = yolkState.targetY;
      yolkState.facingRight = yolkState.activeSection === 'works';
      yolkState.initialized = true;
      applyYolkSpriteFrame();
      if (yolkState.activeSection === 'works') {
        onYolkArrivedAtTarget();
      }
    }

    if (reducedMotion) {
      yolkState.travel = null;
      yolkState.x = yolkState.targetX;
      yolkState.y = yolkState.targetY;
      yolkState.facingRight = yolkState.activeSection === 'works';
      if (yolkState.animState !== 'idle') {
        yolkState.animState = 'idle';
        yolkState.frameIndex = 0;
        yolkState.frameElapsedMs = 0;
        onYolkArrivedAtTarget();
      }
    } else {
      if (sectionChanged) {
        startTravelToTarget(yolkState.targetX, yolkState.targetY);
      }

      if (yolkState.travel) {
        yolkState.travel.endX = yolkState.targetX;
        yolkState.travel.endY = yolkState.targetY;

        const { fraction, done } = evaluateTrapezoidalProgress(yolkState.travel, dtSec);
        yolkState.x =
          yolkState.travel.startX +
          (yolkState.travel.endX - yolkState.travel.startX) * fraction;
        yolkState.y =
          yolkState.travel.startY +
          (yolkState.travel.endY - yolkState.travel.startY) * fraction;

        if (done) {
          yolkState.travel = null;
        }
      }

      const dx = yolkState.targetX - yolkState.x;
      const dy = yolkState.targetY - yolkState.y;
      const remainingDist = Math.hypot(dx, dy);

      if (remainingDist > ARRIVAL_THRESHOLD_PX || yolkState.travel) {
        if (!yolkState.travel) {
          const alpha = 1 - Math.exp(-dtMs / FOLLOW_TIME_CONSTANT_MS);
          yolkState.x += dx * alpha;
          yolkState.y += dy * alpha;
        }

        yolkState.atTargetMs = 0;

        if (Math.abs(dx) > 0.5) {
          yolkState.facingRight = dx > 0;
        }

        const nextState =
          !yolkState.forceWalk && remainingDist > WALK_SWITCH_DISTANCE_PX
            ? 'run'
            : 'walk';

        if (yolkState.animState === 'idle') {
          onYolkStartedMoving();
        }
        if (yolkState.animState !== nextState) {
          yolkState.animState = nextState;
          yolkState.frameIndex = 0;
          yolkState.frameElapsedMs = 0;
        }
      } else {
        yolkState.x = yolkState.targetX;
        yolkState.y = yolkState.targetY;
        yolkState.atTargetMs += dtMs;

        if (yolkState.atTargetMs >= IDLE_SETTLE_MS && yolkState.animState !== 'idle') {
          yolkState.animState = 'idle';
          yolkState.frameIndex = 0;
          yolkState.frameElapsedMs = 0;
          onYolkArrivedAtTarget();
        }
      }
    }

    const activeSpec = YOLK_SPRITES[yolkState.animState];
    yolkState.frameElapsedMs += dtMs;
    if (yolkState.frameElapsedMs >= activeSpec.frameMs) {
      const stepCount = Math.floor(yolkState.frameElapsedMs / activeSpec.frameMs);
      yolkState.frameElapsedMs %= activeSpec.frameMs;
      const totalFrames = yolkState.animState === 'idle' ? 4 : activeSpec.cols;
      yolkState.frameIndex = (yolkState.frameIndex + stepCount) % totalFrames;
    }

    if (yolkState.animState === 'idle') {
      yolkState.blinkTimerMs += dtMs;
      if (!yolkState.isBlinking && yolkState.blinkTimerMs >= yolkState.nextBlinkDelayMs) {
        yolkState.isBlinking = true;
        yolkState.blinkTimerMs = 0;
      } else if (yolkState.isBlinking && yolkState.blinkTimerMs >= BLINK_DURATION_MS) {
        yolkState.isBlinking = false;
        yolkState.blinkTimerMs = 0;
        yolkState.nextBlinkDelayMs = randomBlinkInterval();
      }
    } else {
      yolkState.isBlinking = false;
      yolkState.blinkTimerMs = 0;
    }

    applyYolkSpriteFrame();
    window.requestAnimationFrame(tick);
  }

  /* ========================================================================
     4. HERO TIMED BUBBLE SEQUENCE & AUTO-SCROLL TO #WORKS
     ======================================================================== */
  let heroSequenceCancelled = false;
  let heroTimers = [];
  let autoScrollRaf = null;
  let isProgrammaticScroll = false;

  function clearHeroTimers() {
    heroTimers.forEach((id) => window.clearTimeout(id));
    heroTimers = [];
  }

  function stopAutoScroll() {
    if (autoScrollRaf) {
      window.cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
    isProgrammaticScroll = false;
    yolkState.forceWalk = false;
    yolkState.targetOverride = null;
  }

  function cancelHeroSequence() {
    if (heroSequenceCancelled) return;
    heroSequenceCancelled = true;
    clearHeroTimers();
    if (bubbleOwner === 'hero') {
      hideBubble();
    }
  }

  function markUserInteracted() {
    cancelHeroSequence();
    stopAutoScroll();
  }

  function smoothScrollToElement(targetEl, durationMs, { leadWithYolk = false } = {}) {
    if (!targetEl) return;
    stopAutoScroll();

    const startY = window.scrollY;
    const targetRect = targetEl.getBoundingClientRect();
    const endY = Math.max(0, startY + targetRect.top);

    if (reducedMotion || durationMs <= 0) {
      window.scrollTo(0, endY);
      return;
    }

    isProgrammaticScroll = true;
    if (leadWithYolk) {
      yolkState.forceWalk = true;
      const worksAnchor = getAnchorPagePosition(sectionAnchors[1].anchorEl);
      yolkState.targetOverride = {
        sectionId: 'works',
        x: worksAnchor.x,
        y: worksAnchor.y
      };
    }

    const startTime = performance.now();

    function easeInOutQuad(t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function step(now) {
      if (!isProgrammaticScroll) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeInOutQuad(progress);

      if (leadWithYolk && yolkState.targetOverride) {
        const worksAnchor = getAnchorPagePosition(sectionAnchors[1].anchorEl);
        yolkState.targetOverride.x = worksAnchor.x;
        yolkState.targetOverride.y = worksAnchor.y;
      }

      window.scrollTo(0, startY + (endY - startY) * eased);

      if (progress < 1) {
        autoScrollRaf = window.requestAnimationFrame(step);
      } else {
        isProgrammaticScroll = false;
        yolkState.forceWalk = false;
        yolkState.targetOverride = null;
        autoScrollRaf = null;
      }
    }

    autoScrollRaf = window.requestAnimationFrame(step);
  }

  function startHeroOnboardingSequence() {
    if (reducedMotion || heroSequenceCancelled) return;

    const step1Time = HERO_STEP_1_DELAY_MS;
    const step2Time = step1Time + HERO_BUBBLE_VISIBLE_MS + HERO_BETWEEN_BUBBLES_MS;
    const step3Time = step2Time + HERO_BUBBLE_VISIBLE_MS + HERO_BETWEEN_BUBBLES_MS;
    const step4Time = step3Time + HERO_BUBBLE_VISIBLE_MS + HERO_BETWEEN_BUBBLES_MS;

    const scheduleHeroBubble = (delayMs, message, onAfterShow = null) => {
      const showId = window.setTimeout(() => {
        if (heroSequenceCancelled || yolkState.activeSection !== 'hero') return;
        showBubble({ pages: [message], owner: 'hero' });

        if (onAfterShow) {
          onAfterShow();
        }

        const hideId = window.setTimeout(() => {
          if (bubbleOwner === 'hero') {
            hideBubble();
          }
        }, HERO_BUBBLE_VISIBLE_MS);
        heroTimers.push(hideId);
      }, delayMs);
      heroTimers.push(showId);
    };

    scheduleHeroBubble(step1Time, HERO_BUBBLE_MESSAGES[0]);
    scheduleHeroBubble(step2Time, HERO_BUBBLE_MESSAGES[1]);
    scheduleHeroBubble(step3Time, HERO_BUBBLE_MESSAGES[2]);
    scheduleHeroBubble(step4Time, HERO_BUBBLE_MESSAGES[3], () => {
      const walkStartId = window.setTimeout(() => {
        if (heroSequenceCancelled || reducedMotion) return;
        hideBubble();
        smoothScrollToElement(document.getElementById('works'), HERO_AUTO_SCROLL_DURATION_MS, {
          leadWithYolk: true
        });
      }, 1300);
      heroTimers.push(walkStartId);
    });
  }

  window.addEventListener('wheel', markUserInteracted, { passive: true });
  window.addEventListener('touchstart', markUserInteracted, { passive: true });
  window.addEventListener('keydown', markUserInteracted);
  window.addEventListener(
    'scroll',
    () => {
      if (!isProgrammaticScroll) {
        cancelHeroSequence();
      }
    },
    { passive: true }
  );

  /* ========================================================================
     5. NAVIGATION, MOBILE MENU & DEBUG TARGET OVERLAY ("O" KEY)
     ======================================================================== */
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNavDrawer = document.getElementById('mobile-nav-drawer');
  const boardTargetOverlay = document.getElementById('board-target-overlay');

  function setMobileMenuOpen(isOpen) {
    mobileMenuBtn.setAttribute('aria-expanded', String(isOpen));
    mobileNavDrawer.hidden = !isOpen;
  }

  mobileMenuBtn.addEventListener('click', () => {
    markUserInteracted();
    const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
    setMobileMenuOpen(!isExpanded);
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = event.target && event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if ((event.key === 'o' || event.key === 'O') && boardTargetOverlay) {
      boardTargetOverlay.hidden = !boardTargetOverlay.hidden;
    }
  });

  document.querySelectorAll('[data-scroll-target]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('data-scroll-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        event.preventDefault();
        markUserInteracted();
        setMobileMenuOpen(false);
        smoothScrollToElement(targetEl, 700);
      }
    });
  });

  document.getElementById('hero-cta-btn').addEventListener('click', () => {
    markUserInteracted();
    smoothScrollToElement(document.getElementById('works'), 750);
  });

  /* ========================================================================
     6. SELECTED WORKS: BOOK-STYLE STEPPED PIXEL PAGE TURN
     ======================================================================== */
  const projects = Array.isArray(window.PROJECTS) ? window.PROJECTS : [];
  let currentProjectIndex = 0;
  let currentProjectBubblePage = 0;
  let isPageTurning = false;

  const paperStackEl = document.getElementById('paper-stack');
  const projectLiveStatusEl = document.getElementById('project-live-status');
  const projectRoleListEl = document.getElementById('project-role-list');
  const projectPolaroidSlotEl = document.getElementById('project-polaroid-slot');
  const stickyNoteEl = document.getElementById('project-sticky-note');
  const polaroidCardEl = document.getElementById('project-polaroid');

  const projectPrevBtn = document.getElementById('project-prev-btn');
  const projectNextBtn = document.getElementById('project-next-btn');
  const projectSegmentsEl = document.getElementById('project-segments');

  paperStackEl.style.setProperty('--flip-duration', `${PAPER_FLIP_DURATION_MS}ms`);

  function getSegmentPosition(idx, total) {
    if (idx === 0) return 'start';
    if (total > 1 && idx === total - 1) return 'end';
    return 'mid';
  }

  function renderSlotImage(slotEl, imageSrc, altText) {
    slotEl.innerHTML = '';
    if (imageSrc) {
      const img = document.createElement('img');
      img.src = imageSrc;
      img.alt = altText;
      slotEl.appendChild(img);
    }
  }

  function createPaperSheetElement(project, { isInteractive = true } = {}) {
    const sheet = document.createElement('article');
    sheet.className = 'paper';

    const ruleTop = document.createElement('span');
    ruleTop.className = 'paper__rule paper__rule--top';
    ruleTop.setAttribute('aria-hidden', 'true');

    const ruleBottom = document.createElement('span');
    ruleBottom.className = 'paper__rule paper__rule--bottom';
    ruleBottom.setAttribute('aria-hidden', 'true');

    const liveOverlay = document.createElement('div');
    liveOverlay.className = 'paper-live-overlay';

    const titleEl = document.createElement('h3');
    titleEl.className = 'paper-title';
    titleEl.textContent = project.title;

    const yearsEl = document.createElement('div');
    yearsEl.className = 'paper-years';
    yearsEl.textContent = project.years;

    const codeEl = document.createElement('span');
    codeEl.className = 'paper-code';
    codeEl.textContent = project.code;

    const gridPanelEl = document.createElement('div');
    gridPanelEl.className = 'paper-grid-panel';

    const mainSlotEl = document.createElement('div');
    mainSlotEl.className = 'paper-main-slot';
    renderSlotImage(mainSlotEl, project.mainImage, `${project.title} main showcase`);

    const caseStudyBtn = document.createElement(project.caseStudyUrl ? 'a' : 'button');
    caseStudyBtn.className = 'paper-case-study-btn';
    if (project.caseStudyUrl) {
      caseStudyBtn.href = project.caseStudyUrl;
    } else {
      caseStudyBtn.type = 'button';
    }
    caseStudyBtn.textContent = '▶ Case Study';

    gridPanelEl.appendChild(mainSlotEl);
    gridPanelEl.appendChild(caseStudyBtn);
    liveOverlay.appendChild(titleEl);
    liveOverlay.appendChild(yearsEl);
    liveOverlay.appendChild(codeEl);
    liveOverlay.appendChild(gridPanelEl);

    const foldBtn = document.createElement('button');
    foldBtn.type = 'button';
    foldBtn.className = 'paper-fold-btn';
    foldBtn.setAttribute('aria-label', 'Flip to next project');

    const hasMultiple = projects.length > 1;
    foldBtn.disabled = !hasMultiple || !isInteractive;
    foldBtn.setAttribute('aria-disabled', String(foldBtn.disabled));

    if (isInteractive) {
      foldBtn.addEventListener('click', () => {
        triggerNextProjectFlip();
      });
    }

    const revealShade = document.createElement('div');
    revealShade.className = 'paper__reveal-shade';
    revealShade.setAttribute('aria-hidden', 'true');

    sheet.appendChild(ruleTop);
    sheet.appendChild(ruleBottom);
    sheet.appendChild(liveOverlay);
    sheet.appendChild(foldBtn);
    sheet.appendChild(revealShade);

    return sheet;
  }

  function buildSegmentIndicators() {
    projectSegmentsEl.innerHTML = '';
    projects.forEach((proj, idx) => {
      const isActive = idx === currentProjectIndex;
      const pos = getSegmentPosition(idx, projects.length);
      const seg = document.createElement('img');
      seg.className = 'rail-segment' + (isActive ? ' is-active' : '');
      seg.src = `assets/rail_segment_${pos}_${isActive ? 'active' : 'inactive'}.svg`;
      seg.alt = '';
      seg.setAttribute('aria-hidden', 'true');
      projectSegmentsEl.appendChild(seg);
    });
  }

  function updateProjectNavStates(targetIndex = currentProjectIndex) {
    const hasMultiple = projects.length > 1;
    const isFirst = targetIndex <= 0;

    projectPrevBtn.disabled = isPageTurning || isFirst;
    projectNextBtn.disabled = isPageTurning || !hasMultiple;

    paperStackEl.querySelectorAll('.paper-fold-btn').forEach((btn) => {
      const disabled = isPageTurning || !hasMultiple;
      btn.disabled = disabled;
      btn.setAttribute('aria-disabled', String(disabled));
    });

    const segments = projectSegmentsEl.querySelectorAll('.rail-segment');
    segments.forEach((seg, idx) => {
      const isActive = idx === targetIndex;
      const pos = getSegmentPosition(idx, projects.length);
      seg.classList.toggle('is-active', isActive);
      seg.src = `assets/rail_segment_${pos}_${isActive ? 'active' : 'inactive'}.svg`;
    });
  }

  function updateAccessoriesContent(project) {
    projectRoleListEl.innerHTML = '';
    (project.roleNote || []).forEach((roleItem) => {
      const li = document.createElement('li');
      li.textContent = roleItem;
      projectRoleListEl.appendChild(li);
    });

    renderSlotImage(
      projectPolaroidSlotEl,
      project.polaroidImage,
      `${project.title} detail snapshot`
    );
  }

  function announceProjectChange(project) {
    if (projectLiveStatusEl && project) {
      projectLiveStatusEl.textContent = `Project ${currentProjectIndex + 1} of ${projects.length}: ${project.title}, ${project.years}`;
    }
  }

  function renderInitialProject(index) {
    const project = projects[index];
    if (!project) return;

    currentProjectIndex = index;
    currentProjectBubblePage = 0;

    paperStackEl.innerHTML = '';
    const sheet = createPaperSheetElement(project, { isInteractive: true });
    sheet.classList.add('paper--current');
    paperStackEl.appendChild(sheet);

    updateAccessoriesContent(project);
    updateProjectNavStates(index);
    announceProjectChange(project);

    if (yolkState.activeSection === 'works' && yolkState.animState === 'idle') {
      showBubble({
        pages: project.bubblePages,
        owner: 'works',
        startPage: 0
      });
    }
  }

  function turnBookPageToProject(nextIndex, direction) {
    if (
      isPageTurning ||
      nextIndex < 0 ||
      nextIndex >= projects.length ||
      nextIndex === currentProjectIndex
    ) {
      return;
    }

    markUserInteracted();
    isPageTurning = true;

    const nextProject = projects[nextIndex];

    updateProjectNavStates(nextIndex);

    if (worksBubbleDelayTimer) {
      window.clearTimeout(worksBubbleDelayTimer);
      worksBubbleDelayTimer = null;
    }
    if (bubbleVisible) {
      hideBubble();
    }

    if (reducedMotion) {
      const currentSheet = paperStackEl.querySelector('.paper--current');
      const nextSheet = createPaperSheetElement(nextProject, { isInteractive: false });
      nextSheet.classList.add('paper--underlay', 'paper--crossfade-in');
      paperStackEl.insertBefore(nextSheet, currentSheet);

      updateAccessoriesContent(nextProject);

      window.requestAnimationFrame(() => {
        if (currentSheet) currentSheet.classList.add('paper--crossfade-out');
        nextSheet.classList.add('is-active');
      });

      window.setTimeout(() => {
        currentProjectIndex = nextIndex;
        currentProjectBubblePage = 0;
        isPageTurning = false;

        const freshSheet = createPaperSheetElement(nextProject, { isInteractive: true });
        freshSheet.classList.add('paper--current');
        paperStackEl.innerHTML = '';
        paperStackEl.appendChild(freshSheet);

        updateProjectNavStates(nextIndex);
        announceProjectChange(nextProject);

        if (yolkState.activeSection === 'works') {
          showBubble({
            pages: nextProject.bubblePages,
            owner: 'works',
            startPage: 0
          });
        }
      }, REDUCED_MOTION_CROSSFADE_MS);
      return;
    }

    stickyNoteEl.classList.remove('is-pre-enter', 'is-dropping-in');
    polaroidCardEl.classList.remove('is-pre-enter', 'is-dropping-in');

    stickyNoteEl.classList.add('is-dropping-out');
    window.setTimeout(() => {
      polaroidCardEl.classList.add('is-dropping-out');
    }, ACCESSORY_DROP_OUT_STAGGER_MS);

    window.setTimeout(() => {
      const revealedSheet = createPaperSheetElement(nextProject, { isInteractive: false });
      revealedSheet.classList.add('paper--current', 'paper--flipping-under');

      const revealShadeEl = revealedSheet.querySelector('.paper__reveal-shade');
      if (revealShadeEl) {
        revealShadeEl.classList.add(
          direction === 'next' ? 'is-fading-out' : 'is-fading-in'
        );
      }

      const flipCanvas = document.createElement('canvas');
      flipCanvas.className = 'paper-flip-canvas';
      const slotRect = paperStackEl.getBoundingClientRect();
      const slotAspect = slotRect.width > 0 ? slotRect.height / slotRect.width : 1.275;
      flipCanvas.width = 222; // 1.48 * 150px paper grid
      flipCanvas.height = Math.round(150 * slotAspect * 1.40);
      flipCanvas.setAttribute('aria-hidden', 'true');

      paperStackEl.innerHTML = '';
      paperStackEl.appendChild(revealedSheet);
      paperStackEl.appendChild(flipCanvas);

      const frameIntervalMs = Math.max(
        24,
        Math.floor(PAPER_FLIP_DURATION_MS / FLIP_FRAME_COUNT)
      );
      let frameIdx = 0;

      const drawCurrentStep = () => {
        const visualStep =
          direction === 'next' ? frameIdx : FLIP_FRAME_COUNT - 1 - frameIdx;
        renderBookFlipPixelFrame(flipCanvas, visualStep, FLIP_FRAME_COUNT);
      };

      drawCurrentStep();

      const flipTimer = window.setInterval(() => {
        frameIdx += 1;
        if (frameIdx >= FLIP_FRAME_COUNT) {
          window.clearInterval(flipTimer);
          flipCanvas.remove();

          const finalSheet = createPaperSheetElement(nextProject, {
            isInteractive: true
          });
          finalSheet.classList.add('paper--current');
          paperStackEl.innerHTML = '';
          paperStackEl.appendChild(finalSheet);

          currentProjectIndex = nextIndex;
          currentProjectBubblePage = 0;

          updateAccessoriesContent(nextProject);
          stickyNoteEl.classList.remove('is-dropping-out');
          polaroidCardEl.classList.remove('is-dropping-out');
          stickyNoteEl.classList.add('is-pre-enter');
          polaroidCardEl.classList.add('is-pre-enter');

          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              stickyNoteEl.classList.remove('is-pre-enter');
              stickyNoteEl.classList.add('is-dropping-in');

              window.setTimeout(() => {
                polaroidCardEl.classList.remove('is-pre-enter');
                polaroidCardEl.classList.add('is-dropping-in');
              }, ACCESSORY_DROP_IN_STAGGER_MS);
            });
          });

          const tailDurationMs =
            ACCESSORY_DROP_IN_STAGGER_MS + ACCESSORY_DROP_IN_MS;

          window.setTimeout(() => {
            stickyNoteEl.classList.remove('is-dropping-in');
            polaroidCardEl.classList.remove('is-dropping-in');

            isPageTurning = false;
            updateProjectNavStates(nextIndex);
            announceProjectChange(nextProject);

            if (yolkState.activeSection === 'works' && yolkState.animState === 'idle') {
              showBubble({
                pages: nextProject.bubblePages,
                owner: 'works',
                startPage: 0
              });
            }
          }, tailDurationMs);
          return;
        }

        drawCurrentStep();
      }, frameIntervalMs);
    }, PAPER_FLIP_DELAY_MS);
  }

  function triggerNextProjectFlip() {
    if (isPageTurning || projects.length <= 1) return;
    const nextIndex = (currentProjectIndex + 1) % projects.length;
    turnBookPageToProject(nextIndex, 'next');
  }

  function triggerPrevProjectFlip() {
    if (isPageTurning || currentProjectIndex <= 0) return;
    turnBookPageToProject(currentProjectIndex - 1, 'prev');
  }

  projectNextBtn.addEventListener('click', () => {
    triggerNextProjectFlip();
  });

  projectPrevBtn.addEventListener('click', () => {
    triggerPrevProjectFlip();
  });

  document.getElementById('works').addEventListener('keydown', (event) => {
    if (isPageTurning) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      triggerNextProjectFlip();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      triggerPrevProjectFlip();
    }
  });

  /* ========================================================================
     7. STARTUP & RESIZE HANDLING
     ======================================================================== */
  buildSegmentIndicators();
  renderInitialProject(0);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      updateResponsiveScales();
      layoutSpotlightProps();
      const activeEntry = getSectionEntryById(yolkState.activeSection);
      const targetPos = getAnchorPagePosition(activeEntry.anchorEl);
      yolkState.targetX = targetPos.x;
      yolkState.targetY = targetPos.y;
      if (yolkState.animState === 'idle' && !yolkState.travel) {
        yolkState.x = targetPos.x;
        yolkState.y = targetPos.y;
        applyYolkSpriteFrame();
      }
    }, 100);
  });

  window.requestAnimationFrame(tick);
  startHeroOnboardingSequence();
});