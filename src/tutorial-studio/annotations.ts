// Tutorial Studio: Visual Annotations Engine
// Renders dynamic broadcast-quality SVG arrows, spotlights, numbered badges,
// and RTL Arabic caption bar directly into the page viewport for video recording.
import type { ArrowDirection, HighlightSpec, ZoomSpec } from './types';
import { findElementWithFallbacks } from './cursor-overlay';

export interface AnnotationTheme {
  primaryColor: string; // e.g. '#3B82F6'
  accentColor: string; // e.g. '#F59E0B'
  backdropColor: string; // e.g. 'rgba(5, 10, 25, 0.72)'
  fontSizePx: number; // e.g. 15
}

export const DEFAULT_THEME: AnnotationTheme = {
  primaryColor: '#3B82F6',
  accentColor: '#F59E0B',
  backdropColor: 'rgba(5, 10, 25, 0.72)',
  fontSizePx: 16,
};

const ROOT_ID = '__nb_annotations_root';
const ZOOM_WRAPPER_ID = '__nb_zoom_wrapper';

/**
 * Initializes the annotations overlay container.
 */
export function initAnnotationsOverlay(): HTMLElement {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.style.cssText = 'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483640; display: block;';

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap');

      /* ── Spotlight ── */
      #__nb_spotlight_box {
        position: fixed;
        pointer-events: none;
        border: 3.5px solid #3B82F6;
        border-radius: 12px;
        box-shadow: 0 0 0 9999px rgba(5, 10, 25, 0.72),
                    0 0 35px 8px rgba(59, 130, 246, 0.7),
                    inset 0 0 20px rgba(59, 130, 246, 0.25);
        transition: all 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        z-index: 2147483641;
        display: none;
      }
      #__nb_spotlight_box::after {
        content: '';
        position: absolute;
        inset: -6px;
        border-radius: 16px;
        border: 2px dashed rgba(167, 139, 250, 0.7);
        animation: __nb_rotate_dash 10s linear infinite;
      }
      @keyframes __nb_rotate_dash {
        to { transform: rotate(360deg); }
      }

      /* ── Highlight Box (Neon) ── */
      #__nb_neon_box {
        position: fixed;
        pointer-events: none;
        border: 3.5px solid #10B981;
        border-radius: 10px;
        box-shadow: 0 0 25px rgba(16, 185, 129, 0.75), inset 0 0 15px rgba(16, 185, 129, 0.3);
        transition: all 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        z-index: 2147483641;
        display: none;
      }

      /* ── Circle Highlight ── */
      #__nb_circle_highlight {
        position: fixed;
        pointer-events: none;
        border: 3.5px solid #EF4444;
        border-radius: 50%;
        box-shadow: 0 0 25px rgba(239, 68, 68, 0.6);
        transition: all 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        animation: __nb_pulse_circle 1.6s ease-in-out infinite alternate;
        z-index: 2147483641;
        display: none;
      }
      @keyframes __nb_pulse_circle {
        0% { transform: scale(1); box-shadow: 0 0 15px rgba(239, 68, 68, 0.5); }
        100% { transform: scale(1.06); box-shadow: 0 0 30px rgba(239, 68, 68, 0.85); }
      }

      /* ── Numbered Step Badge ── */
      #__nb_step_badge_icon {
        position: absolute;
        top: -24px;
        left: -24px;
        width: 46px;
        height: 46px;
        background: linear-gradient(135deg, #2563EB, #7C3AED);
        border: 3px solid #FFFFFF;
        border-radius: 50%;
        color: #FFFFFF;
        font-family: 'Cairo', 'IBM Plex Sans Arabic', sans-serif;
        font-size: 20px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 20px rgba(37, 99, 235, 0.7);
        animation: __nb_badge_bounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
        z-index: 2147483643;
      }
      @keyframes __nb_badge_bounce {
        0% { transform: scale(0); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }

      /* ── SVG Arrow ── */
      #__nb_arrow_svg_container {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 2147483642;
        display: none;
      }
      .__nb_arrow_path {
        stroke: #F59E0B;
        stroke-width: 4;
        fill: none;
        stroke-dasharray: 12 7;
        animation: __nb_dash_move 1s linear infinite;
        filter: drop-shadow(0 3px 8px rgba(245, 158, 11, 0.6));
      }
      @keyframes __nb_dash_move {
        to { stroke-dashoffset: -19; }
      }

      /* ── Subtitle Caption Bar ── */
      #__nb_caption_bar {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        width: min(880px, 92vw);
        background: rgba(10, 17, 35, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 20px;
        padding: 18px 26px;
        color: #FFFFFF;
        font-family: 'Cairo', 'IBM Plex Sans Arabic', system-ui, sans-serif;
        direction: rtl;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(59, 130, 246, 0.18);
        z-index: 2147483645;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: auto;
        transition: all 0.35s ease;
      }

      #__nb_caption_header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 8px;
      }
      #__nb_caption_title {
        font-size: 13.5px;
        font-weight: 700;
        color: #93C5FD;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #__nb_caption_step_pill {
        background: rgba(59, 130, 246, 0.22);
        border: 1px solid rgba(59, 130, 246, 0.5);
        color: #BFDBFE;
        font-size: 12px;
        padding: 3px 12px;
        border-radius: 12px;
        font-weight: 600;
      }
      #__nb_caption_headline {
        font-size: 19px;
        font-weight: 800;
        color: #FFFFFF;
        margin: 0;
      }
      #__nb_caption_body {
        font-size: 15.5px;
        line-height: 1.65;
        color: #E2E8F0;
        margin: 0;
        font-weight: 500;
      }
      #__nb_sound_wave_bars {
        display: flex;
        align-items: center;
        gap: 3px;
        height: 14px;
      }
      .__nb_wave_col {
        width: 3.5px;
        background: #60A5FA;
        border-radius: 2px;
        animation: __nb_wave_jump 0.8s infinite ease-in-out alternate;
      }
      .__nb_wave_col:nth-child(2) { animation-delay: 0.2s; height: 12px; }
      .__nb_wave_col:nth-child(3) { animation-delay: 0.4s; height: 16px; }
      .__nb_wave_col:nth-child(4) { animation-delay: 0.1s; height: 8px; }
      @keyframes __nb_wave_jump {
        0% { height: 4px; }
        100% { height: 14px; }
      }
    `;
    root.appendChild(style);

    // Spotlight Box
    const spot = document.createElement('div');
    spot.id = '__nb_spotlight_box';
    const badge = document.createElement('div');
    badge.id = '__nb_step_badge_icon';
    badge.textContent = '1';
    spot.appendChild(badge);
    root.appendChild(spot);

    // Neon Box
    const neon = document.createElement('div');
    neon.id = '__nb_neon_box';
    root.appendChild(neon);

    // Circle Highlight
    const circle = document.createElement('div');
    circle.id = '__nb_circle_highlight';
    root.appendChild(circle);

    // SVG Arrow
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = '__nb_arrow_svg_container';
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="__nb_arrow_head_marker" markerWidth="14" markerHeight="12" refX="12" refY="6" orient="auto">
        <polygon points="0 0, 14 6, 0 12" fill="#F59E0B" />
      </marker>
    `;
    svg.appendChild(defs);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.id = '__nb_arrow_dyn_path';
    path.classList.add('__nb_arrow_path');
    path.setAttribute('marker-end', 'url(#__nb_arrow_head_marker)');
    svg.appendChild(path);
    root.appendChild(svg);

    // Caption Bar
    const captionBar = document.createElement('div');
    captionBar.id = '__nb_caption_bar';
    captionBar.innerHTML = `
      <div id="__nb_caption_header">
        <div id="__nb_caption_title"><span>🎬</span><span id="__nb_app_title_text">استوديو الشروحات التفاعلي</span></div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div id="__nb_sound_wave_bars">
            <div class="__nb_wave_col"></div><div class="__nb_wave_col"></div><div class="__nb_wave_col"></div><div class="__nb_wave_col"></div>
          </div>
          <div id="__nb_caption_step_pill">خطوة 1 من 5</div>
        </div>
      </div>
      <h3 id="__nb_caption_headline">جارِ تحضير الشرح...</h3>
      <p id="__nb_caption_body">يرجى الانتظار بينما نبدأ الجولة التعليمية خطوة بخطوة.</p>
    `;
    root.appendChild(captionBar);

    document.documentElement.appendChild(root);
  }
  return root;
}

/**
 * Updates on-screen visual annotations for the current step.
 */
export function showStepAnnotations(options: {
  stepIndex: number;
  totalSteps: number;
  title: string;
  narration: string;
  captionText: string;
  appName: string;
  highlight: HighlightSpec;
  zoom?: ZoomSpec;
}): void {
  initAnnotationsOverlay();

  const spot = document.getElementById('__nb_spotlight_box');
  const neon = document.getElementById('__nb_neon_box');
  const circle = document.getElementById('__nb_circle_highlight');
  const svg = document.getElementById('__nb_arrow_svg_container');
  const path = document.getElementById('__nb_arrow_dyn_path');
  const badge = document.getElementById('__nb_step_badge_icon');
  const captionBar = document.getElementById('__nb_caption_bar');

  // Update text
  const headlineEl = document.getElementById('__nb_caption_headline');
  const bodyEl = document.getElementById('__nb_caption_body');
  const pillEl = document.getElementById('__nb_caption_step_pill');
  const appEl = document.getElementById('__nb_app_title_text');

  if (headlineEl) headlineEl.textContent = options.title;
  if (bodyEl) bodyEl.textContent = options.captionText || options.narration;
  if (pillEl) pillEl.textContent = `خطوة ${options.stepIndex + 1} من ${options.totalSteps}`;
  if (appEl) appEl.textContent = options.appName;

  if (badge) {
    badge.textContent = String(options.stepIndex + 1);
    badge.style.animation = 'none';
    void badge.offsetWidth;
    badge.style.animation = '__nb_badge_bounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
  }

  // Hide all highlight elements initially
  if (spot) spot.style.display = 'none';
  if (neon) neon.style.display = 'none';
  if (circle) circle.style.display = 'none';
  if (svg) svg.style.display = 'none';

  const target = findElementWithFallbacks(options.highlight.selector);
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const pad = 12;

  // Render chosen highlight style
  if (options.highlight.style === 'spotlight' && spot) {
    spot.style.display = 'block';
    spot.style.top = `${Math.max(4, rect.top - pad)}px`;
    spot.style.left = `${Math.max(4, rect.left - pad)}px`;
    spot.style.width = `${rect.width + pad * 2}px`;
    spot.style.height = `${rect.height + pad * 2}px`;
  } else if (options.highlight.style === 'box' && neon) {
    neon.style.display = 'block';
    neon.style.top = `${Math.max(4, rect.top - pad)}px`;
    neon.style.left = `${Math.max(4, rect.left - pad)}px`;
    neon.style.width = `${rect.width + pad * 2}px`;
    neon.style.height = `${rect.height + pad * 2}px`;
  } else if (options.highlight.style === 'circle' && circle) {
    const size = Math.max(rect.width, rect.height) + 28;
    circle.style.display = 'block';
    circle.style.width = `${size}px`;
    circle.style.height = `${size}px`;
    circle.style.left = `${rect.left + rect.width / 2 - size / 2}px`;
    circle.style.top = `${rect.top + rect.height / 2 - size / 2}px`;
  }

  // Draw Arrow if requested
  if ((options.highlight.style === 'arrow' || options.highlight.arrow_direction) && svg && path && captionBar) {
    const bannerRect = captionBar.getBoundingClientRect();
    const bx = bannerRect.left + bannerRect.width / 2;
    const by = bannerRect.top;
    const tx = rect.left + rect.width / 2;
    const ty = rect.top + rect.height / 2;

    // Curved Bezier calculation
    const mx = (bx + tx) / 2;
    const my = Math.min(by, ty) - 50;

    path.setAttribute('d', `M ${bx} ${by - 8} Q ${mx} ${my} ${tx} ${ty}`);
    svg.style.display = 'block';
  }

  // Handle Zoom if requested
  if (options.zoom?.scale && options.zoom.scale > 1) {
    applySmoothZoom(target, options.zoom.scale);
  }
}

/**
 * Applies a smooth pan and zoom onto the active target element.
 */
function applySmoothZoom(target: HTMLElement, scale: number): void {
  const rect = target.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  document.body.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
  document.body.style.transformOrigin = `${originX}px ${originY}px`;
  document.body.style.transform = `scale(${scale})`;

  // Reset zoom after step duration
  setTimeout(() => {
    document.body.style.transform = 'none';
  }, 4000);
}

/**
 * Displays completion state.
 */
export function showCompletionBanner(): void {
  const headline = document.getElementById('__nb_caption_headline');
  const body = document.getElementById('__nb_caption_body');
  const spot = document.getElementById('__nb_spotlight_box');
  const svg = document.getElementById('__nb_arrow_svg_container');

  if (headline) headline.textContent = '🎉 تم إكمال الشرح التعليمي بنجاح!';
  if (body) body.textContent = 'اكتملت جميع خطوات الشرح بالصوت والرسومات. يتم الآن حفظ وتصدير الفيديو بدقة عالية.';
  if (spot) spot.style.display = 'none';
  if (svg) svg.style.display = 'none';
}

/**
 * Cleanup annotations overlay from DOM.
 */
export function removeAnnotationsOverlay(): void {
  document.getElementById(ROOT_ID)?.remove();
  document.body.style.transform = 'none';
}
