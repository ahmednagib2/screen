// Tutorial Studio: In-Page Orchestrator
// Injected and executed DIRECTLY inside the target tab webpage DOM.
// Drives the human presenter cursor, dynamic zoom, spotlight, SVG arrow, step badges,
// realistic button clicking, form opening, and Arabic glassmorphism caption bar.

export interface InPageStepSpec {
  stepIndex: number;
  totalSteps: number;
  title: string;
  narrationText: string;
  captionText: string;
  appName: string;
  action: {
    type: 'click' | 'type' | 'scroll' | 'hover' | 'navigate' | 'wait';
    selector?: string;
    value?: string;
    allow_write?: boolean;
  };
  highlight: {
    selector?: string;
    style: 'arrow' | 'box' | 'circle' | 'spotlight';
    arrow_direction?: 'up' | 'down' | 'left' | 'right' | 'auto';
  };
  zoom?: {
    scale?: number;
  };
  demoMode: boolean;
}

/**
 * Self-contained in-page execution function invoked via chrome.scripting.executeScript.
 * Runs in the target webpage's execution context.
 */
export function inPageExecuteStep(spec: InPageStepSpec): Promise<{ ok: boolean; error?: string }> {
  return new Promise(async resolve => {
    try {
      const ROOT_ID = '__nb_studio_inpage_root';
      const CURSOR_ID = '__nb_studio_inpage_cursor';

      // 1. Ensure container & styles exist in the tab
      let root = document.getElementById(ROOT_ID);
      if (!root) {
        // Clean up any lingering elements from previous runs
        ['__nb_ts_root', '__nb_annotations_root', '__nb_ts_styles', '__nb_annotations_styles'].forEach(id => {
          document.getElementById(id)?.remove();
        });

        root = document.createElement('div');
        root.id = ROOT_ID;
        root.style.cssText =
          'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483640; display: block; font-family: "Cairo", "Segoe UI", system-ui, sans-serif;';

        const style = document.createElement('style');
        style.id = '__nb_studio_styles';
        style.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap');

          /* ── Presenter Cursor ── */
          #__nb_studio_inpage_cursor {
            position: fixed;
            top: 0;
            left: 0;
            width: 32px;
            height: 32px;
            pointer-events: none;
            z-index: 2147483647;
            transition: transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
            transform: translate3d(50vw, 50vh, 0);
            filter: drop-shadow(0 4px 10px rgba(0,0,0,0.6));
          }

          /* ── Click Ripple ── */
          .__nb_click_ripple {
            position: fixed;
            pointer-events: none;
            border-radius: 50%;
            border: 3.5px solid #3B82F6;
            animation: __nb_ripple_anim 0.75s ease-out forwards;
            z-index: 2147483646;
          }
          @keyframes __nb_ripple_anim {
            0% { width: 0; height: 0; opacity: 1; transform: translate(-50%, -50%) scale(0.2); }
            100% { width: 100px; height: 100px; opacity: 0; transform: translate(-50%, -50%) scale(1); }
          }

          /* ── Spotlight Box ── */
          #__nb_spotlight {
            position: fixed;
            pointer-events: none;
            border: 2.5px solid #3B82F6;
            border-radius: 8px;
            box-shadow: 0 0 16px rgba(59, 130, 246, 0.6), inset 0 0 8px rgba(59, 130, 246, 0.25);
            transition: all 0.45s cubic-bezier(0.22, 1, 0.36, 1);
            z-index: 2147483641;
            display: none;
          }

          /* ── Neon Box ── */
          #__nb_neon_box {
            position: fixed;
            pointer-events: none;
            border: 2.5px solid #10B981;
            border-radius: 8px;
            box-shadow: 0 0 16px rgba(16, 185, 129, 0.6), inset 0 0 8px rgba(16, 185, 129, 0.25);
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

          /* ── Bottom Caption Bar ── */
          #__nb_caption_bar {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            width: 82%;
            max-width: 880px;
            background: rgba(10, 16, 32, 0.92);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 14px;
            padding: 10px 20px;
            color: #FFFFFF;
            direction: rtl;
            text-align: right;
            box-shadow: 0 12px 35px rgba(0,0,0,0.55);
            z-index: 2147483645;
            transition: all 0.4s ease;
          }
        `;
        document.documentElement.appendChild(style);

        root.innerHTML = `
          <div id="__nb_spotlight"></div>
          <div id="__nb_neon_box"></div>
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
          <div id="__nb_caption_bar">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 4px;">
              <span id="__nb_caption_step_badge" style="background: linear-gradient(135deg, #2563EB, #7C3AED); color: #FFFFFF; font-weight: 800; font-size: 11px; padding: 2px 10px; border-radius: 20px;"></span>
              <span id="__nb_caption_step_title" style="font-size: 13px; font-weight: 700; color: #93C5FD;"></span>
            </div>
            <div id="__nb_caption_text" style="font-size: 16px; font-weight: 700; line-height: 1.5; color: #FFFFFF; text-shadow: 0 1px 3px rgba(0,0,0,0.8);"></div>
          </div>
          <div id="__nb_studio_inpage_cursor">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.5 3.5L18.5 13.5L12 14.5L9.5 20.5L5.5 3.5Z" fill="#2563EB" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"/>
            </svg>
          </div>
        `;
        document.documentElement.appendChild(root);
      }

      // Smoothly reset zoom back to 1 before measuring next element position
      if (document.body.style.transform && document.body.style.transform !== 'scale(1)') {
        document.body.style.transition = 'transform 0.35s ease';
        document.body.style.transform = 'scale(1)';
        await new Promise(r => setTimeout(r, 350));
      }

      // 2. Intelligent element finder with Odoo framework recognition
      const findTarget = (rawSelector?: string): HTMLElement | null => {
        if (!rawSelector) return null;
        const parts = rawSelector.split(',').map(s => s.trim());

        for (const p of parts) {
          if (p.startsWith('text:')) {
            const query = p.slice(5).trim().toLowerCase();
            const candidates = Array.from(
              document.querySelectorAll<HTMLElement>(
                'button, .btn, a, .o_nav_entry, .o_kanban_record, th, td, label, div[role="button"], span, input, select'
              )
            );

            // Priority 1: Action buttons / interactive elements with exact match
            const exactBtn = candidates.find(c => {
              const txt = (c.innerText || c.textContent || c.getAttribute('title') || c.getAttribute('aria-label') || '').trim().toLowerCase();
              const isClickable = c.tagName === 'BUTTON' || c.classList.contains('btn') || c.getAttribute('role') === 'button' || c.tagName === 'A';
              return isClickable && (txt === query || txt.startsWith(query)) && c.offsetWidth > 0 && c.offsetHeight > 0;
            });
            if (exactBtn) return exactBtn;

            // Priority 2: Any element with exact match
            const exactAny = candidates.find(c => {
              const txt = (c.innerText || c.textContent || c.getAttribute('title') || '').trim().toLowerCase();
              return txt === query && c.offsetWidth > 0 && c.offsetHeight > 0;
            });
            if (exactAny) return exactAny;

            // Priority 3: Substring match
            const partial = candidates.find(c => {
              const txt = (c.innerText || c.textContent || c.getAttribute('title') || '').trim().toLowerCase();
              return txt.includes(query) && c.offsetWidth > 0 && c.offsetHeight > 0;
            });
            if (partial) return partial;
          } else {
            try {
              const el = document.querySelector<HTMLElement>(p);
              if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
            } catch {}
          }
        }

        // Automatic Odoo Button Fallback (New / جديد / Create)
        const lowerAll = rawSelector.toLowerCase();
        if (lowerAll.includes('new') || lowerAll.includes('جديد') || lowerAll.includes('create') || lowerAll.includes('add')) {
          const odooNewSelectors = [
            'button.o-kanban-button-new',
            'button.o_list_button_add',
            'button.o_form_button_create',
            'button[data-hotkey="c"]',
            '.o_control_panel_actions button.btn-primary',
            '.o_control_panel button.btn-primary',
            '.o_control_panel_actions button',
            '.o_control_panel button',
            'button.btn-primary',
          ];
          for (const sel of odooNewSelectors) {
            const el = document.querySelector<HTMLElement>(sel);
            if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
          }
        }

        return null;
      };

      // Intelligent retry loop: wait up to 2.5s for dynamic elements (SPA / Odoo OWL rendering)
      let targetEl = findTarget(spec.action.selector) || findTarget(spec.highlight.selector);
      if (!targetEl && (spec.action.selector || spec.highlight.selector)) {
        const startWait = Date.now();
        while (!targetEl && Date.now() - startWait < 2500) {
          await new Promise(r => setTimeout(r, 200));
          targetEl = findTarget(spec.action.selector) || findTarget(spec.highlight.selector);
        }
      }

      // Fallback for "New" action if specific selector missed
      if (!targetEl && (spec.title.toLowerCase().includes('new') || spec.title.includes('جديد') || spec.title.includes('إنشاء'))) {
        targetEl = document.querySelector<HTMLElement>(
          'button.o-kanban-button-new, button.o_list_button_add, button[data-hotkey="c"], .o_control_panel_actions button, .o_control_panel button.btn-primary, button.btn-primary'
        );
      }

      // Fallback for "type" action if form field missed
      if (!targetEl && spec.action.type === 'type') {
        targetEl = document.querySelector<HTMLElement>(
          '.o_form_view input:not([type="hidden"]), .o_form_sheet input:not([type="hidden"]), input[name="name"], input.o_input, input[type="text"]'
        );
      }

      // Semantic Odoo Fallback (Project, Task, Timer, Date, Spent, etc.)
      if (!targetEl) {
        const tLower = (spec.title + ' ' + (spec.action.selector || '') + ' ' + (spec.highlight.selector || '')).toLowerCase();
        if (tLower.includes('project') || tLower.includes('مشروع')) {
          targetEl = document.querySelector<HTMLElement>(
            'th[data-name*="project"], td[name*="project"], [name*="project_id"], td.o_data_cell:nth-child(2), table.o_list_table tbody tr:first-child td:nth-child(2), .o_field_widget[name="project_id"], label[for*="project"]'
          );
        } else if (tLower.includes('task') || tLower.includes('مهمة') || tLower.includes('مهمه')) {
          targetEl = document.querySelector<HTMLElement>(
            'th[data-name*="task"], td[name*="task"], [name*="task_id"], td.o_data_cell:nth-child(3), table.o_list_table tbody tr:first-child td:nth-child(3), .o_field_widget[name="task_id"], label[for*="task"]'
          );
        } else if (tLower.includes('start') || tLower.includes('بدء') || tLower.includes('مؤقت') || tLower.includes('timer')) {
          targetEl = document.querySelector<HTMLElement>(
            '.o_timesheet_timer_btn, button:has(.fa-play), button.btn-secondary, .o_timer_button'
          );
        } else if (tLower.includes('date') || tLower.includes('تاريخ')) {
          targetEl = document.querySelector<HTMLElement>(
            'th[data-name*="date"], td[name*="date"], td.o_data_cell:first-child, [name*="date"]'
          );
        } else if (tLower.includes('spent') || tLower.includes('ساعات') || tLower.includes('وقت') || tLower.includes('time')) {
          targetEl = document.querySelector<HTMLElement>(
            'th[data-name*="unit_amount"], td[name*="unit_amount"], [name*="unit_amount"]'
          );
        }
      }

      // Ultimate fallback: First visible table row or primary button or header (never leave targetEl null!)
      if (!targetEl) {
        targetEl = document.querySelector<HTMLElement>(
          'table.o_list_table tbody tr:first-child td:nth-child(2), table.o_list_table tbody tr:first-child, .o_kanban_record:first-child, .o_control_panel_actions button, button.btn-primary, th.o_column_sortable'
        );
      }

      // 3. UI References
      const spotlight = document.getElementById('__nb_spotlight')!;
      const neonBox = document.getElementById('__nb_neon_box')!;
      const targetBadge = document.getElementById('__nb_target_step_badge');
      const badgeNum = document.getElementById('__nb_badge_num');
      const badgeAction = document.getElementById('__nb_badge_action');
      const badgePointer = document.getElementById('__nb_badge_pointer');
      const captionBadge = document.getElementById('__nb_caption_step_badge');
      const captionTitle = document.getElementById('__nb_caption_step_title');
      const captionText = document.getElementById('__nb_caption_text')!;
      const cursor = document.getElementById(CURSOR_ID)!;

      // Update Subtitle Caption Bar cleanly without duplication
      if (captionBadge) captionBadge.textContent = `الخطوة ${spec.stepIndex + 1} من ${spec.totalSteps}`;
      if (captionTitle) captionTitle.textContent = `${spec.appName} • ${spec.title}`;
      captionText.textContent = spec.captionText || spec.narrationText;

      let targetX = window.innerWidth / 2;
      let targetY = window.innerHeight / 2;

      const isLargeContainer =
        targetEl && (targetEl.offsetWidth > window.innerWidth * 0.55 || targetEl.offsetHeight > window.innerHeight * 0.55);

      if (targetEl && !isLargeContainer) {
        // Specific interactive button or input field
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        await new Promise(r => setTimeout(r, 400));

        const rect = targetEl.getBoundingClientRect();
        targetX = Math.round(rect.left + rect.width / 2);
        targetY = Math.round(rect.top + rect.height / 2);

        // B. Dynamic Zoom centered on button
        const scale = spec.zoom?.scale || 1.2;
        const originX = Math.round(window.scrollX + rect.left + rect.width / 2);
        const originY = Math.round(window.scrollY + rect.top + rect.height / 2);
        document.body.style.transformOrigin = `${originX}px ${originY}px`;
        document.body.style.transition = 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)';
        document.body.style.transform = `scale(${scale})`;

        // C. Position Spotlight or Neon Box cleanly around button
        const pad = 6;
        const boxStyle = {
          left: `${Math.max(4, rect.left - pad)}px`,
          top: `${Math.max(4, rect.top - pad)}px`,
          width: `${rect.width + pad * 2}px`,
          height: `${rect.height + pad * 2}px`,
          display: 'block',
        };

        if (spec.highlight.style === 'box') {
          Object.assign(neonBox.style, boxStyle);
          spotlight.style.display = 'none';
        } else {
          Object.assign(spotlight.style, boxStyle);
          neonBox.style.display = 'none';
        }

        // D. Position Target Step Badge & Accurate Directional Arrow directly on the element
        if (targetBadge && badgeNum && badgeAction) {
          targetBadge.style.display = 'flex';
          badgeNum.textContent = `الخطوة ${spec.stepIndex + 1}`;

          let label = spec.title || '';
          if (spec.action?.type === 'click' && !label.includes('نقر') && !label.includes('الضغط')) {
            label = `نقر على: ${label}`;
          } else if (spec.action?.type === 'type' && !label.includes('كتابة') && !label.includes('إدخال')) {
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
      } else if (targetEl && isLargeContainer) {
        // Broad overview of the whole table / view
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        spotlight.style.display = 'none';
        neonBox.style.display = 'none';
        if (targetBadge) targetBadge.style.display = 'none';

        document.body.style.transition = 'transform 0.5s ease';
        document.body.style.transform = 'scale(1)';

        const rect = targetEl.getBoundingClientRect();
        targetX = Math.min(window.innerWidth - 120, Math.max(80, rect.left + 150));
        targetY = Math.min(window.innerHeight - 150, Math.max(120, rect.top + 80));
      } else {
        // Reset zoom if no specific element
        document.body.style.transition = 'transform 0.5s ease';
        document.body.style.transform = 'scale(1)';
        spotlight.style.display = 'none';
        neonBox.style.display = 'none';
        if (targetBadge) targetBadge.style.display = 'none';
      }

      // 4. Move Presenter Cursor smoothly to target
      cursor.style.transition = 'transform 0.75s cubic-bezier(0.22, 1, 0.36, 1)';
      cursor.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      await new Promise(r => setTimeout(r, 750));

      // 5. Trigger Click Ripple Animation
      const ripple = document.createElement('div');
      ripple.className = '__nb_click_ripple';
      ripple.style.left = `${targetX}px`;
      ripple.style.top = `${targetY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 800);

      // 6. Perform Realistic Action (Clicking & Opening New Form / Typing)
      const shouldClick =
        spec.action.type === 'click' ||
        (targetEl &&
          (spec.title.includes('نضغط') ||
            spec.title.includes('اضغط') ||
            spec.title.includes('فتح') ||
            spec.narrationText.includes('نضغط') ||
            spec.title.toLowerCase().includes('click') ||
            spec.title.toLowerCase().includes('new') ||
            (spec.action.selector || '').toLowerCase().includes('new') ||
            (spec.action.selector || '').toLowerCase().includes('جديد')));

      if (targetEl && shouldClick) {
        // Complete realistic pointer + mouse dispatch for modern frameworks (Odoo OWL)
        targetEl.focus();
        const eventOpts: MouseEventInit = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: targetX,
          clientY: targetY,
          button: 0,
          buttons: 1,
        };

        try {
          targetEl.dispatchEvent(new PointerEvent('pointerdown', { ...eventOpts, isPrimary: true, pointerId: 1 }));
        } catch {}
        try {
          targetEl.dispatchEvent(new MouseEvent('mousedown', eventOpts));
        } catch {}
        try {
          targetEl.dispatchEvent(new PointerEvent('pointerup', { ...eventOpts, isPrimary: true, pointerId: 1 }));
        } catch {}
        try {
          targetEl.dispatchEvent(new MouseEvent('mouseup', { ...eventOpts, button: 0, buttons: 0 }));
        } catch {}
        try {
          targetEl.dispatchEvent(new MouseEvent('click', eventOpts));
        } catch {}
        try {
          targetEl.click();
        } catch {}

        if (
          targetEl.parentElement &&
          (targetEl.parentElement.tagName === 'BUTTON' || targetEl.parentElement.getAttribute('role') === 'button')
        ) {
          try {
            targetEl.parentElement.click();
          } catch {}
        }

        // Generous pause to allow Odoo OWL to fetch records and transition views / open form
        await new Promise(r => setTimeout(r, 900));
      } else if (targetEl && spec.action.type === 'type') {
        const input =
          targetEl instanceof HTMLInputElement || targetEl instanceof HTMLTextAreaElement
            ? targetEl
            : targetEl.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');

        if (input) {
          input.focus();
          input.click();

          const textToType = spec.action.value || 'مهمة عمل جديدة ومتابعة الطلب';
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
            await new Promise(r => setTimeout(r, 45));
          }
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      } else if (spec.action.type === 'scroll') {
        window.scrollBy({ top: 320, behavior: 'smooth' });
        await new Promise(r => setTimeout(r, 600));
        window.scrollBy({ top: -320, behavior: 'smooth' });
      }

      resolve({ ok: true });
    } catch (err) {
      console.warn('inPageExecuteStep error:', err);
      resolve({ ok: false, error: String(err) });
    }
  });
}

/**
 * Clean up all in-page studio artifacts, zoom transforms, and cursor.
 */
export function inPageTeardown(): void {
  document.body.style.transition = 'transform 0.5s ease';
  document.body.style.transform = 'scale(1)';
  [
    '__nb_studio_inpage_root',
    '__nb_studio_styles',
    '__nb_ts_root',
    '__nb_ts_styles',
    '__nb_annotations_root',
    '__nb_annotations_styles',
  ].forEach(id => document.getElementById(id)?.remove());
}
