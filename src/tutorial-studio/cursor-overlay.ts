// Human-like Presenter Cursor & Safe DOM Automation
// Injected into the target tab: draws smooth Bezier-curved cursor movements,
// click ripples, handles fallback selectors, Demo Mode safety, and sensitive data blurring.
import type { ActionSpec } from './types';

export interface CursorState {
  x: number;
  y: number;
}

const CURSOR_ID = '__nb_presenter_cursor';
const BLUR_STYLE_ID = '__nb_blur_sensitive_style';

/**
 * Ensures the fake mouse cursor element exists on the page.
 */
export function ensurePresenterCursor(): HTMLElement {
  let cursor = document.getElementById(CURSOR_ID);
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = CURSOR_ID;
    cursor.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 24px;
      height: 24px;
      pointer-events: none;
      z-index: 2147483646;
      transition: transform 0.65s cubic-bezier(0.25, 1, 0.5, 1);
      transform: translate3d(50vw, 50vh, 0);
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));
    `;

    cursor.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.5 3.5L18.5 13.5L12 14.5L9.5 20.5L5.5 3.5Z" fill="#3B82F6" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    `;

    document.documentElement.appendChild(cursor);
  }
  return cursor;
}

/**
 * Smoothly move the presenter cursor to target coordinates using Bezier timing.
 */
export async function moveCursorTo(x: number, y: number, durationMs = 650): Promise<void> {
  const cursor = ensurePresenterCursor();
  cursor.style.transition = `transform ${durationMs}ms cubic-bezier(0.25, 1, 0.5, 1)`;
  cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  return new Promise(r => setTimeout(r, durationMs));
}

/**
 * Trigger an animated click ripple at the current cursor position.
 */
export function triggerClickRipple(x: number, y: number): void {
  const ripple = document.createElement('div');
  ripple.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    width: 44px;
    height: 44px;
    margin-left: -22px;
    margin-top: -22px;
    border-radius: 50%;
    border: 3px solid #60A5FA;
    background: rgba(59, 130, 246, 0.25);
    pointer-events: none;
    z-index: 2147483647;
    animation: __nb_ripple_anim 0.75s ease-out forwards;
  `;

  // Inject keyframe style if not present
  if (!document.getElementById('__nb_ripple_style')) {
    const s = document.createElement('style');
    s.id = '__nb_ripple_style';
    s.textContent = `
      @keyframes __nb_ripple_anim {
        0% { transform: scale(0.2); opacity: 1; }
        100% { transform: scale(2.2); opacity: 0; }
      }
    `;
    document.documentElement.appendChild(s);
  }

  document.documentElement.appendChild(ripple);
  setTimeout(() => ripple.remove(), 800);
}

/**
 * Toggle blurring of sensitive data fields (passwords, emails, salaries, phone numbers).
 */
export function toggleSensitiveDataBlur(enable: boolean): void {
  let styleEl = document.getElementById(BLUR_STYLE_ID);
  if (enable) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = BLUR_STYLE_ID;
      styleEl.textContent = `
        input[type="password"],
        input[type="email"],
        input[name*="salary" i],
        input[name*="amount" i],
        input[name*="phone" i],
        input[name*="card" i],
        .o_field_monetary,
        .o_field_phone,
        .o_field_email {
          filter: blur(5px) !important;
          transition: filter 0.3s ease;
        }
      `;
      document.documentElement.appendChild(styleEl);
    }
  } else {
    styleEl?.remove();
  }
}

/**
 * Locate element using resilient multi-tier fallback matching.
 */
export function findElementWithFallbacks(selector?: string): HTMLElement | null {
  if (!selector?.trim()) return null;

  // 1. Check for text: prefix
  if (selector.startsWith('text:')) {
    const raw = selector.slice(5).trim().toLowerCase();
    const candidates = Array.from(
      document.querySelectorAll(
        'button, a, span, .o_app, .dropdown-item, .breadcrumb-item, .btn, [role="button"], [role="menuitem"], [role="tab"], h1, h2, h3, h4, th, td'
      )
    );
    for (const el of candidates) {
      const text = (el as HTMLElement).innerText?.trim().toLowerCase() || el.getAttribute('aria-label')?.toLowerCase() || '';
      if (text && (text === raw || text.includes(raw))) {
        return el as HTMLElement;
      }
    }
    return null;
  }

  // 2. Direct CSS selector
  try {
    const el = document.querySelector(selector);
    if (el) return el as HTMLElement;
  } catch {}

  // 3. Fallback: partial match on aria-label, title, placeholder, data-menu-xmlid
  try {
    const clean = selector.replace(/[#.[\]]/g, '');
    const partial = document.querySelector(
      `[aria-label*="${clean}" i], [title*="${clean}" i], [placeholder*="${clean}" i], [data-menu-xmlid*="${clean}" i]`
    );
    if (partial) return partial as HTMLElement;
  } catch {}

  return null;
}

/**
 * Checks if an action is potentially destructive.
 */
export function isDestructiveAction(textOrSelector: string): boolean {
  const dangerousWords = ['delete', 'remove', 'drop', 'unlink', 'حذف', 'إلغاء نهائي', 'مسح'];
  const lower = textOrSelector.toLowerCase();
  return dangerousWords.some(w => lower.includes(w));
}

/**
 * Human-like execution of DOM actions with Demo Mode guard.
 */
export async function executeHumanLikeAction(
  action: ActionSpec,
  options: { demoMode?: boolean } = {},
): Promise<{ success: boolean; skippedReason?: string }> {
  const { demoMode = true } = options;

  if (action.type === 'wait') {
    await new Promise(r => setTimeout(r, 1500));
    return { success: true };
  }

  if (action.type === 'scroll') {
    window.scrollBy({ top: 350, behavior: 'smooth' });
    await new Promise(r => setTimeout(r, 800));
    return { success: true };
  }

  const target = findElementWithFallbacks(action.selector);
  if (!target) {
    return { success: false, skippedReason: `Element not found: ${action.selector}` };
  }

  // Safety Demo Mode Check
  const elementDescription = target.innerText || target.getAttribute('aria-label') || action.selector || '';
  if (demoMode && !action.allow_write && isDestructiveAction(elementDescription)) {
    console.warn(`[Tutorial Studio Demo Mode] Blocked destructive action on: ${elementDescription}`);
    return { success: false, skippedReason: 'Demo Mode: Blocked destructive action' };
  }

  // Scroll smoothly to target element
  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  await new Promise(r => setTimeout(r, 500));

  const rect = target.getBoundingClientRect();
  const targetX = rect.left + rect.width / 2;
  const targetY = rect.top + rect.height / 2;

  // Move presenter cursor
  await moveCursorTo(targetX, targetY);

  if (action.type === 'hover') {
    target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await new Promise(r => setTimeout(r, 600));
    return { success: true };
  }

  if (action.type === 'click') {
    triggerClickRipple(targetX, targetY);
    await new Promise(r => setTimeout(r, 200));

    // Demo Mode safety check for submit/save
    if (demoMode && !action.allow_write && (elementDescription.includes('Save') || elementDescription.includes('حفظ'))) {
      // In demo mode, click visual without committing real form save if preferred
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      return { success: true };
    }

    target.click();
    await new Promise(r => setTimeout(r, 600));
    return { success: true };
  }

  if (action.type === 'type' && action.value) {
    triggerClickRipple(targetX, targetY);
    target.focus();
    await new Promise(r => setTimeout(r, 200));

    // Simulate human typing with variable inter-key delays
    const inputEl = target as HTMLInputElement;
    if ('value' in inputEl) {
      inputEl.value = '';
      for (const char of action.value) {
        inputEl.value += char;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 40 + Math.random() * 50));
      }
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await new Promise(r => setTimeout(r, 500));
    return { success: true };
  }

  return { success: true };
}

/**
 * Remove cursor and clean up overlay elements.
 */
export function removePresenterCursor(): void {
  document.getElementById(CURSOR_ID)?.remove();
  document.getElementById('__nb_ripple_style')?.remove();
  document.getElementById(BLUR_STYLE_ID)?.remove();
}
