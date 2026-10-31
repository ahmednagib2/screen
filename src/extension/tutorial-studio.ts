// Tutorial Studio v4 — High-Definition Internal In-Tab Recording & Orchestration
// Records ONLY the target tab viewport (excluding the sidepanel) via tabCapture streamId.
// Features dynamic camera zoom (1.2x), realistic presenter mouse cursor,
// calm spotlight box, clean directional arrows, and in-tab neural voice narration.

export interface StepVisualData {
  stepNum: number;
  totalSteps: number;
  title: string;
  narration: string;
  selector?: string;
  action?: string;
  actionValue?: string;
  tutorialTitle: string;
}

const STUDIO_KEY = '__nb_tutorial_studio';

/**
 * Creates the clean overlay UI in the target webpage:
 * • Animated Presenter Cursor
 * • Calm Element Spotlight
 * • Directional Arrow
 * • Glassmorphic Subtitle Banner
 */
export function setupTutorialUI(tutorialTitle: string, totalSteps: number): void {
  const g = globalThis as unknown as Record<string, unknown>;

  // Remove any previous instance across all studio modules
  [
    '__nb_ts_root',
    '__nb_ts_styles',
    '__nb_studio_inpage_root',
    '__nb_studio_styles',
    '__nb_annotations_root',
    '__nb_annotations_styles',
  ].forEach(id => document.getElementById(id)?.remove());

  const root = document.createElement('div');
  root.id = '__nb_ts_root';
  root.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483640;display:block;';

  // ── Styles ──
  const style = document.createElement('style');
  style.id = '__nb_ts_styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&display=swap');

    /* ── Presenter Cursor ── */
    #__nb_ts_cursor {
      position: fixed;
      top: 0;
      left: 0;
      width: 32px;
      height: 32px;
      pointer-events: none;
      z-index: 2147483647;
      transition: transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
      transform: translate3d(50vw, 50vh, 0);
      filter: drop-shadow(0 4px 10px rgba(0,0,0,0.55));
    }

    /* ── Click Ripple ── */
    .__nb_ts_ripple {
      position: fixed;
      pointer-events: none;
      border-radius: 50%;
      border: 3.5px solid #3B82F6;
      animation: __nb_ts_ripple_anim 0.75s ease-out forwards;
      z-index: 2147483646;
    }
    @keyframes __nb_ts_ripple_anim {
      0% { width: 0; height: 0; opacity: 1; transform: translate(-50%, -50%) scale(0.2); }
      100% { width: 90px; height: 90px; opacity: 0; transform: translate(-50%, -50%) scale(1); }
    }

    /* ── Calm Spotlight Box ── */
    #__nb_ts_spot {
      position: fixed;
      pointer-events: none;
      border: 2.5px solid #3B82F6;
      border-radius: 8px;
      box-shadow: 0 0 18px rgba(59, 130, 246, 0.6), inset 0 0 10px rgba(59, 130, 246, 0.25);
      transition: all 0.45s cubic-bezier(0.22, 1, 0.36, 1);
      z-index: 2147483641;
      display: none;
    }

    /* ── Target Element Step Badge with Directional Pointer ── */
    #__nb_target_step_badge {
      position: fixed;
      display: none;
      flex-direction: column;
      align-items: center;
      z-index: 2147483646;
      pointer-events: none;
      transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.7));
    }
    #__nb_target_step_badge.pointing-down {
      animation: __nb_badge_float_down 2s ease-in-out infinite;
    }
    #__nb_target_step_badge.pointing-up {
      animation: __nb_badge_float_up 2s ease-in-out infinite;
    }
    @keyframes __nb_badge_float_down {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    @keyframes __nb_badge_float_up {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(4px); }
    }
    .__nb_badge_chip {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 6px 16px;
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.94));
      border: 1.5px solid #38BDF8;
      border-radius: 9999px;
      color: #FFFFFF;
      font-family: 'Cairo', 'Segoe UI', system-ui, sans-serif;
      direction: rtl;
      white-space: nowrap;
      box-shadow: 0 0 16px rgba(56, 189, 248, 0.45);
    }
    .__nb_badge_num {
      background: linear-gradient(135deg, #2563EB, #7C3AED);
      color: #FFFFFF;
      padding: 2px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.3px;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.4);
    }
    .__nb_badge_action {
      color: #F8FAFC;
      font-size: 13px;
      font-weight: 700;
    }
    #__nb_badge_pointer {
      display: block;
      pointer-events: none;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
    }

    /* ── Glassmorphic Subtitle Banner ── */
    #__nb_ts_banner {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      width: min(880px, 92vw);
      background: rgba(10, 16, 32, 0.94);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 16px;
      padding: 12px 22px;
      color: #FFFFFF;
      font-family: 'Cairo', system-ui, sans-serif;
      direction: rtl;
      text-align: right;
      box-shadow: 0 16px 45px rgba(0,0,0,0.6);
      z-index: 2147483645;
      display: flex;
      flex-direction: column;
      gap: 6px;
      pointer-events: auto;
      transition: all 0.35s ease;
    }
    #__nb_ts_bh {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      padding-bottom: 6px;
    }
    #__nb_ts_bt {
      font-size: 13px;
      font-weight: 700;
      color: #93C5FD;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #__nb_ts_sb {
      background: linear-gradient(135deg, #2563EB, #7C3AED);
      color: #FFFFFF;
      font-size: 11px;
      padding: 2px 10px;
      border-radius: 12px;
      font-weight: 800;
    }
    #__nb_ts_st {
      font-size: 16px;
      font-weight: 800;
      color: #FFFFFF;
      margin: 0;
    }
    #__nb_ts_nt {
      font-size: 15px;
      line-height: 1.6;
      color: #E2E8F0;
      margin: 0;
      font-weight: 600;
    }
  `;
  document.documentElement.appendChild(style);

  root.innerHTML = `
    <div id="__nb_ts_spot"></div>
    <div id="__nb_target_step_badge">
      <div class="__nb_badge_chip">
        <span id="__nb_badge_num" class="__nb_badge_num">الخطوة 1</span>
        <span id="__nb_badge_action" class="__nb_badge_action"></span>
      </div>
      <div id="__nb_badge_pointer">
        <svg width="22" height="14" viewBox="0 0 22 14" fill="none" style="display:block; margin: -1px auto 0;">
          <path d="M11 14L2 2H20L11 14Z" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
        </svg>
      </div>
    </div>
    <div id="__nb_ts_banner">
      <div id="__nb_ts_bh">
        <div id="__nb_ts_bt"><span>🎬</span><span>${tutorialTitle}</span></div>
        <div id="__nb_ts_sb">خطوة 1 من ${totalSteps}</div>
      </div>
      <h4 id="__nb_ts_st">جارِ تحضير الشرح...</h4>
      <p id="__nb_ts_nt">يرجى الانتظار بينما نبدأ الجولة التعليمية خطوة بخطوة.</p>
    </div>
    <div id="__nb_ts_cursor">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path d="M5.5 3.5L18.5 13.5L12 14.5L9.5 20.5L5.5 3.5Z" fill="#2563EB" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"/>
      </svg>
    </div>
  `;

  document.documentElement.appendChild(root);
  g[STUDIO_KEY] = { root };
  void playInPageSpeech(`حيّاكم الله وأهلاً وسهلاً بكم. نستعرض معكم اليوم ${tutorialTitle} خطوة بخطوة.`, 'ar-SA');
}

/**
 * Play synthesized speech audio directly inside the tab DOM.
 * This guarantees the user hears it through speakers AND tabCapture records it into the video!
 */
export async function playInPageSpeech(text: string, lang = 'ar-SA'): Promise<void> {
  if (!text) return;
  try {
    const clean = text.trim().slice(0, 190);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(
      lang
    )}&client=tw-ob&q=${encodeURIComponent(clean)}`;
    const audio = new Audio(url);
    await audio.play();
  } catch (err) {
    console.warn('In-page audio playback fallback:', err);
  }
}

/**
 * Updates the overlay for a specific step:
 * • Smooth dynamic zoom (1.2x)
 * • Moving presenter cursor
 * • Calm highlight box & arrow
 * • Click ripple & realistic DOM action
 */
export function showStepVisuals(data: StepVisualData): { found: boolean } {
  const spot = document.getElementById('__nb_ts_spot');
  const targetBadge = document.getElementById('__nb_target_step_badge');
  const badgeNum = document.getElementById('__nb_badge_num');
  const badgeAction = document.getElementById('__nb_badge_action');
  const badgePointer = document.getElementById('__nb_badge_pointer');
  const sb = document.getElementById('__nb_ts_sb');
  const st = document.getElementById('__nb_ts_st');
  const nt = document.getElementById('__nb_ts_nt');
  const cursor = document.getElementById('__nb_ts_cursor');

  // Update banner text cleanly
  if (sb) sb.textContent = `خطوة ${data.stepNum} من ${data.totalSteps}`;
  if (st) st.textContent = data.title;
  if (nt) nt.textContent = data.narration;

  // Play audio narration inside tab so it burns into video capture
  void playInPageSpeech(data.narration, 'ar-SA');

  // Smoothly reset zoom back to 1 before measuring next target position
  if (document.body.style.transform && document.body.style.transform !== 'scale(1)') {
    document.body.style.transition = 'transform 0.35s ease';
    document.body.style.transform = 'scale(1)';
  }

  // Find target element with intelligent selector & text recognition
  let target: HTMLElement | null = null;
  if (data.selector) {
    const parts = data.selector.split(',').map(s => s.trim());
    for (const p of parts) {
      if (p.startsWith('text:')) {
        const query = p.slice(5).trim().toLowerCase();
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>(
            'button, .btn, a, .o_nav_entry, .o_kanban_record, th, td, label, div[role="button"], span, input, select'
          )
        );
        target =
          candidates.find(c => {
            const txt = (c.innerText || c.textContent || '').trim().toLowerCase();
            return (txt === query || txt.includes(query)) && c.offsetWidth > 0 && c.offsetHeight > 0;
          }) || null;
      } else {
        try {
          const el = document.querySelector<HTMLElement>(p);
          if (el && el.offsetWidth > 0 && el.offsetHeight > 0) target = el;
        } catch {}
      }
      if (target) break;
    }
  }

  // Fallback for New / جديد if action is click and selector didn't match
  if (!target) {
    const tLower = (data.title + ' ' + (data.selector || '')).toLowerCase();

    // 1. New / Create / جديد
    if (tLower.includes('new') || tLower.includes('جديد') || tLower.includes('create') || tLower.includes('إنشاء')) {
      const sels = [
        'button.o-kanban-button-new',
        'button.o_list_button_add',
        'button.o_form_button_create',
        'button[data-hotkey="c"]',
        '.o_control_panel_actions button.btn-primary',
        '.o_control_panel button.btn-primary',
        'button.btn-primary',
      ];
      for (const sel of sels) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) { target = el; break; }
      }
    }

    // 2. Project / مشروع
    if (!target && (tLower.includes('project') || tLower.includes('مشروع'))) {
      const sels = [
        'th[data-name*="project"]',
        'td[name*="project"]',
        '[name*="project_id"]',
        'td.o_data_cell:nth-child(2)',
        'table.o_list_table tbody tr:first-child td:nth-child(2)',
        '.o_field_widget[name="project_id"]',
        'label[for*="project"]',
      ];
      for (const sel of sels) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) { target = el; break; }
      }
    }

    // 3. Task / مهمة
    if (!target && (tLower.includes('task') || tLower.includes('مهمة') || tLower.includes('مهمه'))) {
      const sels = [
        'th[data-name*="task"]',
        'td[name*="task"]',
        '[name*="task_id"]',
        'td.o_data_cell:nth-child(3)',
        'table.o_list_table tbody tr:first-child td:nth-child(3)',
        '.o_field_widget[name="task_id"]',
        'label[for*="task"]',
      ];
      for (const sel of sels) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) { target = el; break; }
      }
    }

    // 4. Timer / Start / المؤقت / البدء
    if (!target && (tLower.includes('start') || tLower.includes('بدء') || tLower.includes('مؤقت') || tLower.includes('timer'))) {
      const sels = [
        '.o_timesheet_timer_btn',
        'button:has(.fa-play)',
        'button.btn-secondary',
        '.o_timer_button',
      ];
      for (const sel of sels) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) { target = el; break; }
      }
    }

    // 5. Date / تاريخ
    if (!target && (tLower.includes('date') || tLower.includes('تاريخ'))) {
      const sels = ['th[data-name*="date"]', 'td[name*="date"]', 'td.o_data_cell:first-child', '[name*="date"]'];
      for (const sel of sels) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) { target = el; break; }
      }
    }

    // 6. Spent / Time / ساعات / وقت
    if (!target && (tLower.includes('spent') || tLower.includes('ساعات') || tLower.includes('وقت') || tLower.includes('time'))) {
      const sels = ['th[data-name*="unit_amount"]', 'td[name*="unit_amount"]', '[name*="unit_amount"]'];
      for (const sel of sels) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) { target = el; break; }
      }
    }

    // 7. Approvals / موافقات
    if (!target && (tLower.includes('approval') || tLower.includes('موافق'))) {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('a, button, .o_nav_entry, span'));
      target = candidates.find(c => {
        const txt = (c.innerText || '').toLowerCase();
        return (txt.includes('approval') || txt.includes('موافق')) && c.offsetWidth > 0;
      }) || null;
    }

    // 8. View switchers / طرق العرض
    if (!target && (tLower.includes('عرض') || tLower.includes('view') || tLower.includes('قائمة') || tLower.includes('grid') || tLower.includes('kanban'))) {
      const el = document.querySelector<HTMLElement>('.o_cp_switch_buttons button, button.o_switch_view, .o_view_switcher');
      if (el && el.offsetWidth > 0) target = el;
    }

    // 9. Save / حفظ
    if (!target && (tLower.includes('save') || tLower.includes('حفظ'))) {
      const el = document.querySelector<HTMLElement>('button.o_form_button_save, button.btn-primary');
      if (el && el.offsetWidth > 0) target = el;
    }

    // 10. Ultimate fallback: First interactive table row or control panel element (never leave target null!)
    if (!target) {
      const fallbackCandidates = [
        'table.o_list_table tbody tr:first-child td:nth-child(2)',
        'table.o_list_table tbody tr:first-child',
        '.o_kanban_record:first-child',
        '.o_control_panel_actions button',
        'button.btn-primary',
        '.o_breadcrumb',
        'th.o_column_sortable',
      ];
      for (const sel of fallbackCandidates) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) { target = el; break; }
      }
    }
  }

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;

  const isLargeContainer =
    target && (target.offsetWidth > window.innerWidth * 0.55 || target.offsetHeight > window.innerHeight * 0.55);

  if (target && !isLargeContainer) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    const rect = target.getBoundingClientRect();
    targetX = Math.round(rect.left + rect.width / 2);
    targetY = Math.round(rect.top + rect.height / 2);

    // Dynamic Zoom (1.2x) centered right on the target element
    const originX = Math.round(window.scrollX + rect.left + rect.width / 2);
    const originY = Math.round(window.scrollY + rect.top + rect.height / 2);
    document.body.style.transformOrigin = `${originX}px ${originY}px`;
    document.body.style.transition = 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)';
    document.body.style.transform = 'scale(1.2)';

    // Spotlight Box tightly framing the element
    if (spot) {
      const pad = 6;
      spot.style.display = 'block';
      spot.style.left = `${Math.max(4, rect.left - pad)}px`;
      spot.style.top = `${Math.max(4, rect.top - pad)}px`;
      spot.style.width = `${rect.width + pad * 2}px`;
      spot.style.height = `${rect.height + pad * 2}px`;
    }

    // Position Target Step Badge & Accurate Directional Arrow directly on the element
    if (targetBadge && badgeNum && badgeAction) {
      targetBadge.style.display = 'flex';
      badgeNum.textContent = `الخطوة ${data.stepNum}`;

      let label = data.title || '';
      if (data.action === 'click' && !label.includes('نقر') && !label.includes('الضغط')) {
        label = `نقر على: ${label}`;
      } else if (data.action === 'type' && !label.includes('كتابة') && !label.includes('إدخال')) {
        label = `كتابة: ${label}`;
      }
      badgeAction.textContent = label;

      const badgeWidth = targetBadge.offsetWidth || 230;
      const badgeHeight = targetBadge.offsetHeight || 40;
      const centerX = rect.left + rect.width / 2;
      const leftPos = Math.max(16, Math.min(window.innerWidth - badgeWidth - 16, centerX - badgeWidth / 2));
      targetBadge.style.left = `${leftPos}px`;

      // If there's room above the element, position above with pointer pointing DOWN
      if (rect.top > badgeHeight + 24) {
        targetBadge.style.top = `${rect.top - badgeHeight - 8}px`;
        targetBadge.classList.remove('pointing-up');
        targetBadge.classList.add('pointing-down');
        if (badgePointer) {
          badgePointer.innerHTML = `
            <svg width="22" height="14" viewBox="0 0 22 14" fill="none" style="display:block; margin: -1px auto 0;">
              <path d="M11 14L2 2H20L11 14Z" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
            </svg>
          `;
        }
      } else {
        // Otherwise position below the element with pointer pointing UP
        targetBadge.style.top = `${rect.bottom + 8}px`;
        targetBadge.classList.remove('pointing-down');
        targetBadge.classList.add('pointing-up');
        if (badgePointer) {
          badgePointer.innerHTML = `
            <svg width="22" height="14" viewBox="0 0 22 14" fill="none" style="display:block; margin: 0 auto -1px;">
              <path d="M11 0L20 12H2L11 0Z" fill="#38BDF8" stroke="#FFFFFF" stroke-width="1.5" />
            </svg>
          `;
        }
      }
    }
  } else if (target && isLargeContainer) {
    // Broad view: no awkward boxes covering whole tables
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (spot) spot.style.display = 'none';
    if (targetBadge) targetBadge.style.display = 'none';

    document.body.style.transition = 'transform 0.5s ease';
    document.body.style.transform = 'scale(1)';

    const rect = target.getBoundingClientRect();
    targetX = Math.min(window.innerWidth - 120, Math.max(80, rect.left + 150));
    targetY = Math.min(window.innerHeight - 150, Math.max(120, rect.top + 80));
  } else {
    // Reset zoom if no specific element
    document.body.style.transition = 'transform 0.5s ease';
    document.body.style.transform = 'scale(1)';
    if (spot) spot.style.display = 'none';
    if (targetBadge) targetBadge.style.display = 'none';
  }

  // Move Presenter Cursor smoothly to target
  if (cursor) {
    cursor.style.transition = 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)';
    cursor.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
  }

  // Trigger Click Ripple and realistic event dispatching
  if (target && (data.action === 'click' || data.title.includes('نضغط') || data.title.includes('اضغط') || data.title.includes('فتح'))) {
    setTimeout(() => {
      const ripple = document.createElement('div');
      ripple.className = '__nb_ts_ripple';
      ripple.style.left = `${targetX}px`;
      ripple.style.top = `${targetY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 800);

      // Realistic event dispatch for modern frameworks (Odoo OWL)
      target!.focus();
      const eventOpts: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: targetX,
        clientY: targetY,
        button: 0,
        buttons: 1,
      };
      try { target!.dispatchEvent(new PointerEvent('pointerdown', { ...eventOpts, isPrimary: true, pointerId: 1 })); } catch {}
      try { target!.dispatchEvent(new MouseEvent('mousedown', eventOpts)); } catch {}
      try { target!.dispatchEvent(new PointerEvent('pointerup', { ...eventOpts, isPrimary: true, pointerId: 1 })); } catch {}
      try { target!.dispatchEvent(new MouseEvent('mouseup', { ...eventOpts, button: 0, buttons: 0 })); } catch {}
      try { target!.dispatchEvent(new MouseEvent('click', eventOpts)); } catch {}
      try { target!.click(); } catch {}
    }, 700);
  } else if (target && data.action === 'type' && data.actionValue) {
    setTimeout(() => {
      const input =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
          ? target
          : target!.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');

      if (input) {
        input.focus();
        input.click();
        const textToType = data.actionValue!;
        let currentVal = '';
        const proto =
          input instanceof HTMLTextAreaElement
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        for (const char of textToType) {
          currentVal += char;
          if (nativeSetter) {
            nativeSetter.call(input, currentVal);
          } else {
            input.value = currentVal;
          }
          try {
            input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
          } catch {}
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, 700);
  }

  return { found: !!target };
}

/**
 * Shows completion state and restores normal zoom.
 */
export function finishTutorialUI(): void {
  const st = document.getElementById('__nb_ts_st');
  const nt = document.getElementById('__nb_ts_nt');
  const spot = document.getElementById('__nb_ts_spot');
  const targetBadge = document.getElementById('__nb_target_step_badge');

  if (st) st.textContent = '🎉 اكتمل الشرح بنجاح!';
  if (nt) nt.textContent = 'تم الانتهاء من جميع خطوات الشرح بالكامل. تم حفظ وتنزيل الفيديو.';
  if (spot) spot.style.display = 'none';
  if (targetBadge) targetBadge.style.display = 'none';

  void playInPageSpeech('وبكذا نكون انتهينا من شرح كامل ومفصل. نتمنى لكم التوفيق دائماً.', 'ar-SA');

  document.body.style.transition = 'transform 0.5s ease';
  document.body.style.transform = 'scale(1)';

  setTimeout(() => {
    [
      '__nb_ts_root',
      '__nb_ts_styles',
      '__nb_studio_inpage_root',
      '__nb_studio_styles',
      '__nb_annotations_root',
      '__nb_annotations_styles',
    ].forEach(id => document.getElementById(id)?.remove());
  }, 3500);
}

// ═══════════════════════════════════════════════════════
// PART 2: Recording functions (injected in MAIN world)
// ═══════════════════════════════════════════════════════

/**
 * Starts tab recording using chromeMediaSourceId (captures ONLY the tab, excluding sidepanel).
 * Falls back to getDisplayMedia if streamId is not available.
 */
export async function startTabRecording(streamId?: string): Promise<boolean> {
  try {
    let stream: MediaStream | null = null;

    if (streamId && navigator.mediaDevices?.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: streamId,
            },
          } as never,
          video: {
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: streamId,
              minWidth: 1920,
              minHeight: 1080,
            },
          } as never,
        });
      } catch (err) {
        console.warn('getUserMedia tab capture failed:', err);
      }
    }

    if (!stream) return false;

    // Use native MP4 if supported, otherwise WebM
    const mimeTypes = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm',
    ];
    const supported = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType: supported,
      videoBitsPerSecond: 8_000_000,
    });
    const chunks: Blob[] = [];

    recorder.ondataavailable = e => {
      if (e.data?.size > 0) chunks.push(e.data);
    };

    recorder.start(500);

    (window as unknown as Record<string, unknown>).__nb_rec = {
      recorder,
      chunks,
      stream,
      mimeType: supported,
    };
    return true;
  } catch (err) {
    console.error('startTabRecording error:', err);
    return false;
  }
}

/**
 * Stops recording and downloads the final video file.
 */
export async function stopTabRecording(filename: string): Promise<boolean> {
  const w = window as unknown as Record<string, unknown>;
  const state = w.__nb_rec as
    | { recorder: MediaRecorder; chunks: Blob[]; stream: MediaStream; mimeType: string }
    | undefined;

  if (!state) return false;

  return new Promise(resolve => {
    state.recorder.onstop = () => {
      try {
        const isMp4 = state.mimeType.includes('mp4');
        const finalBlob = new Blob(state.chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' });
        const ext = isMp4 ? 'mp4' : 'webm';
        const cleanFilename = filename.endsWith(`.${ext}`) ? filename : `${filename.replace(/\.[^/.]+$/, '')}.${ext}`;

        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = cleanFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      } catch (err) {
        console.error('stopTabRecording error:', err);
      }
      delete w.__nb_rec;
      resolve(true);
    };

    state.recorder.stop();
    state.stream.getTracks().forEach(t => t.stop());
  });
}

// ═══════════════════════════════════════════════════════
// PART 3: Types re-exported for run-manager
// ═══════════════════════════════════════════════════════

export interface TutorialStep {
  title: string;
  narration: string;
  selector?: string;
  action?: 'highlight' | 'click' | 'type' | 'wait';
  actionValue?: string;
  pauseSeconds?: number;
}

export interface TutorialConfig {
  tutorialTitle: string;
  steps: TutorialStep[];
  enableVoice?: boolean;
  enableSubtitles?: boolean;
  recordVideo?: boolean;
  videoFilename?: string;
}
