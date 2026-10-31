// Tutorial Studio: AI Planner & Instructor Engine
// Inspects active tab DOM and synthesizes structured, high-quality Tutorial Plans.
import type { ArabicDialect, TutorialPlan, TutorialStep } from './types';
import { DIALECT_PRESETS } from './settings';
import { keysStorage, providersStorage, settingsStorage, usableModel, findModel } from '@src/store/settings';
import { createModel } from '@src/llm/providers';
import { streamTurn } from '@src/llm/stream';

export interface PageInspectionSummary {
  title: string;
  url: string;
  isOdoo: boolean;
  odooVersion?: string;
  detectedModuleName: string;
  teacherOverview: string;
  apps: Array<{ name: string; selector: string; xmlid?: string }>;
  actionButtons: Array<{ text: string; selector: string }>;
  breadcrumbs: string[];
  viewSwitchers: string[];
  fields: Array<{ name: string; label: string; selector: string }>;
}

/**
 * Injected into active tab to inspect visible interactive elements and Odoo structure.
 */
export function inspectPageDOM(): PageInspectionSummary {
  const url = window.location.href;
  const title = document.title;
  const isOdoo = !!(
    document.querySelector('.o_web_client, .o_action_manager, .o_navbar, .o_main_navbar') ||
    document.body.classList.contains('o_web_client') ||
    url.includes('/web') ||
    url.includes('/odoo')
  );

  // Detect Odoo version if available in window.odoo
  let odooVersion: string | undefined;
  try {
    const odoo = (window as unknown as { odoo?: { info?: { server_version?: string } } }).odoo;
    if (odoo?.info?.server_version) odooVersion = odoo.info.server_version;
  } catch {}

  // Apps / Menus
  const apps: Array<{ name: string; selector: string; xmlid?: string }> = [];
  const appElements = document.querySelectorAll(
    '.o_app, .o_menu_entry_lvl_1, .o_nav_entry, [data-menu-xmlid], .o_navbar_apps_menu .dropdown-item, .o_main_navbar .dropdown-item'
  );
  for (const el of Array.from(appElements).slice(0, 30)) {
    const text = (el as HTMLElement).innerText?.trim() || el.getAttribute('aria-label') || '';
    const xmlid = el.getAttribute('data-menu-xmlid') || undefined;
    if (text) {
      const selector = xmlid ? `[data-menu-xmlid="${xmlid}"]` : `text:${text}`;
      apps.push({ name: text, selector, xmlid });
    }
  }

  // Buttons in control panel or top bar
  const actionButtons: Array<{ text: string; selector: string }> = [];
  const buttons = document.querySelectorAll(
    '.o_control_panel button, .o_form_statusbar button, button.btn-primary, button.o_list_button_add, button.o_form_button_save, .btn'
  );
  for (const b of Array.from(buttons).slice(0, 25)) {
    const text = (b as HTMLElement).innerText?.trim() || b.getAttribute('title') || b.getAttribute('aria-label') || '';
    if (text && text.length < 30) {
      const cls = Array.from(b.classList).join('.');
      const selector = cls ? `button.${cls.replace(/\s+/g, '.')}` : `text:${text}`;
      actionButtons.push({ text, selector });
    }
  }

  // Breadcrumbs
  const breadcrumbs: string[] = [];
  document.querySelectorAll('.breadcrumb-item, .o_breadcrumb .active').forEach(b => {
    const t = (b as HTMLElement).innerText?.trim();
    if (t) breadcrumbs.push(t);
  });

  // View Switchers (kanban, list, calendar, pivot, graph)
  const viewSwitchers: string[] = [];
  document.querySelectorAll('[class*="o_cp_switch_"], button.o_switch_view').forEach(s => {
    const t =
      s.getAttribute('data-tooltip') ||
      s.getAttribute('title') ||
      s.getAttribute('aria-label') ||
      (s as HTMLElement).innerText?.trim();
    if (t) viewSwitchers.push(t);
  });

  // Fields and Labels
  const fields: Array<{ name: string; label: string; selector: string }> = [];
  document.querySelectorAll('.o_field_widget, [name]').forEach(f => {
    const name = f.getAttribute('name');
    if (name && fields.length < 20) {
      const label = document.querySelector(`label[for="${name}"], label[for*="${name}"]`)?.textContent?.trim() || name;
      fields.push({ name, label, selector: `[name="${name}"]` });
    }
  });

  // Detect Module Name
  const lowerAll = (url + ' ' + title + ' ' + breadcrumbs.join(' ')).toLowerCase();
  let detectedModuleName = 'نظام أودو (Odoo Web)';
  let teacherOverview = 'تم فحص الصفحة والتعرف على العناصر التفاعلية والأزرار الرئيسية.';

  if (
    lowerAll.includes('support') ||
    lowerAll.includes('helpdesk') ||
    lowerAll.includes('ticket') ||
    lowerAll.includes('دعم') ||
    lowerAll.includes('تذاكر') ||
    lowerAll.includes('بلاغ') ||
    lowerAll.includes('صيانة')
  ) {
    detectedModuleName = 'موديول الدعم الفني والتذاكر (IT Support / Helpdesk)';
    teacherOverview =
      'تم فحص موديول الدعم الفني والتذاكر بنجاح: تم التعرف على لوحة كانبان لمراحل المعالجة، زر إنشاء تذكرة جديدة (New)، وحقول تفاصيل العطل وتعيين الفنيين.';
  } else if (lowerAll.includes('time off') || lowerAll.includes('leave') || lowerAll.includes('إجاز') || lowerAll.includes('اجاز')) {
    detectedModuleName = 'موديول الإجازات والغياب (Time Off / Leaves)';
    teacherOverview =
      'تم فحص واستكشاف موديول الإجازات بنجاح: تم التعرف على لوحة مؤشرات الأرصدة (السنوية والمرضية)، سجل "إجازاتي"، زر تقديم طلب جديد، وقسم الموافقات الإدارية.';
  } else if (lowerAll.includes('sale') || lowerAll.includes('مبيع') || lowerAll.includes('quotation')) {
    detectedModuleName = 'موديول المبيعات (Odoo Sales)';
    teacherOverview =
      'تم استكشاف موديول المبيعات بنجاح: تم التعرف على قائمة عروض الأسعار، بطاقات الكانبان، زر إنشاء عرض سعر جديد، ونموذج إدخال المنتجات والضرائب.';
  } else if (lowerAll.includes('invoice') || lowerAll.includes('فاتور') || lowerAll.includes('account')) {
    detectedModuleName = 'موديول الفواتير والحسابات (Invoicing & Accounting)';
    teacherOverview =
      'تم استكشاف موديول الحسابات بنجاح: تم التعرف على قيود اليومية، فواتير العملاء والموردين، وزر تسجيل الدفعات النقدية والبنكية.';
  } else if (breadcrumbs.length > 0) {
    detectedModuleName = breadcrumbs[0];
    teacherOverview = `تم التعرف على قسم ${breadcrumbs.join(' > ')}، وتم فحص ${actionButtons.length} زر إجراء و${fields.length} حقل إدخال.`;
  }

  return {
    title,
    url,
    isOdoo,
    odooVersion,
    detectedModuleName,
    teacherOverview,
    apps,
    actionButtons,
    breadcrumbs,
    viewSwitchers,
    fields,
  };
}

/**
 * Generate built-in high-quality plan templates for common Odoo scenarios.
 */
export function getOdooBlueprintPlan(moduleKeyword: string, dialect: ArabicDialect = 'saudi'): TutorialPlan {
  const norm = moduleKeyword.toLowerCase();

  // 1. Odoo IT Support / Helpdesk Blueprint
  if (
    norm.includes('support') ||
    norm.includes('helpdesk') ||
    norm.includes('ticket') ||
    norm.includes('دعم') ||
    norm.includes('تذاكر') ||
    norm.includes('بلاغ') ||
    norm.includes('صيانة')
  ) {
    const isSaudi = dialect === 'saudi';
    return {
      id: `plan-${Date.now()}`,
      command: moduleKeyword,
      appName: 'Odoo IT Support (الدعم الفني والتذاكر)',
      dialect,
      createdAt: new Date().toISOString(),
      steps: [
        {
          id: 'sup1',
          title: 'الترحيب واستعراض لوحة التذاكر (Kanban)',
          narration_text: isSaudi
            ? 'حيّاكم الله وأهلاً وسهلاً بكم. نستعرض معكم اليوم موديول الدعم الفني وتذاكر المساعدة في نظام أودو. من هذه الشاشة نقدر نتابع كافة بلاغات المستخدمين ومراحل المعالجة خطوة بخطوة.'
            : 'مرحباً بكم. نستعرض معكم اليوم موديول الدعم الفني وتذاكر المساعدة في نظام أودو. من خلال هذه الشاشة نتابع كافة بلاغات المستخدمين ومراحل المعالجة بدقة متناهية.',
          caption_text: 'مرحباً بكم. نظرة عامة على لوحة تذاكر الدعم الفني ومراحل المعالجة.',
          action: { type: 'scroll' },
          highlight: { selector: '.o_kanban_view, .o_content, .o_kanban_renderer', style: 'box', arrow_direction: 'down' },
          zoom: { scale: 1.05 },
          duration_hint_ms: 8500,
        },
        {
          id: 'sup2',
          title: 'الضغط على زر New لفتح تذكرة جديدة',
          narration_text: isSaudi
            ? 'لإنشاء بلاغ أو تذكرة جديدة، نتوجه بالماوس مباشرة ونضغط على زر جديد New أعلى الشاشة لفتح نموذج التذكرة.'
            : 'لإنشاء تذكرة دعم فني جديدة، نتوجه بالمؤشر مباشرة ونضغط على زر جديد أعلى الشاشة لفتح النموذج المخصص.',
          caption_text: 'الضغط على زر جديد (New) لفتح نموذج إدخال تذكرة دعم فني جديدة.',
          action: { type: 'click', selector: 'button.o-kanban-button-new, button.o_list_button_add, button[data-hotkey="c"], .o_control_panel button.btn-primary, text:New, text:جديد' },
          highlight: { selector: 'button.o-kanban-button-new, button.o_list_button_add, button[data-hotkey="c"], .o_control_panel button.btn-primary, text:New, text:جديد', style: 'spotlight', arrow_direction: 'down' },
          zoom: { scale: 1.2 },
          duration_hint_ms: 7500,
        },
        {
          id: 'sup3',
          title: 'كتابة موضوع التذكرة والمشكلة',
          narration_text: isSaudi
            ? 'هنا في حقل الموضوع، نسجل وصفاً دقيقاً للمشكلة التقنية، مثل عطل في الشبكة وتوقف الطابعة.'
            : 'في حقل الموضوع، نقوم بإدخال وصف دقيق للمشكلة التقنية، مثل انقطاع الاتصال بالطابعة المركزية.',
          caption_text: 'إدخال موضوع التذكرة وعنوان البلاغ بدقة.',
          action: { type: 'type', selector: 'input[name="name"], .o_form_view input[type="text"], input.o_input, div[name="name"] input, input[placeholder*="Subject"], input[placeholder*="Ticket"]', value: 'عطل في الشبكة وتوقف الطابعة المركزية' },
          highlight: { selector: 'input[name="name"], .o_form_view input[type="text"], div[name="name"]', style: 'box', arrow_direction: 'right' },
          zoom: { scale: 1.2 },
          duration_hint_ms: 8500,
        },
        {
          id: 'sup4',
          title: 'تحديد العميل ودرجة الأولوية',
          narration_text: isSaudi
            ? 'ومن هذه الحقول نحدد اسم العميل ونرفع درجة الأولوية للتذكرة لضمان سرعة الاستجابة.'
            : 'ثم نقوم بتحديد جهة الاتصال ودرجة أولوية التذكرة لضمان سرعة المعالجة وفق مستوى الخدمة.',
          caption_text: 'تحديد جهة الاتصال ودرجة أولوية التذكرة وتعيين المهندس المسؤول.',
          action: { type: 'hover', selector: 'div[name="partner_id"], div[name="priority"], .o_priority, div[name="user_id"]' },
          highlight: { selector: 'div[name="partner_id"], div[name="priority"], .o_priority', style: 'spotlight', arrow_direction: 'left' },
          zoom: { scale: 1.2 },
          duration_hint_ms: 8000,
        },
        {
          id: 'sup5',
          title: 'كتابة تفاصيل البلاغ والتشخيص الأولي',
          narration_text: isSaudi
            ? 'في مساحة الوصف نوضح كافة التفاصيل التقنية وخطوات الفحص الأولية لتسهيل مهمة مهندس الدعم.'
            : 'وفي مساحة الوصف، نسجل الشرح الفني وخطوات الفحص الأولية لتسهيل مهمة مهندس الدعم.',
          caption_text: 'كتابة الشرح التفصيلي للمشكلة والتشخيص الفني.',
          action: { type: 'type', selector: 'div[name="description"], textarea, .note-editable, div[name="description"] p', value: 'تم فحص كابلات الشبكة وجهاز التوجيه، ويرجى فحص إعدادات الـ IP والسيرفر.' },
          highlight: { selector: 'div[name="description"], textarea, .note-editable', style: 'box', arrow_direction: 'down' },
          zoom: { scale: 1.15 },
          duration_hint_ms: 8500,
        },
        {
          id: 'sup6',
          title: 'حفظ التذكرة ومتابعة مراحل الحل',
          narration_text: isSaudi
            ? 'وأخيراً نضغط حفظ لتسجيل التذكرة في النظام، ونقدر نتابع انتقالها بين مراحل جاري الحل وحتى الإغلاق بنجاح.'
            : 'وأخيراً نضغط على حفظ لتسجيل التذكرة في النظام ونقلها إلى فريق العمل المختص حتى إغلاق البلاغ بنجاح.',
          caption_text: 'حفظ التذكرة ونقلها إلى مرحلة التنفيذ والمعالجة.',
          action: { type: 'click', selector: 'button.o_form_button_save, button[data-hotkey="s"], text:حفظ, text:Save, .o_form_status_indicator' },
          highlight: { selector: 'button.o_form_button_save, button[data-hotkey="s"], text:حفظ, text:Save', style: 'circle', arrow_direction: 'down' },
          zoom: { scale: 1.2 },
          duration_hint_ms: 7500,
        },
      ],
    };
  }

  // 2. Odoo Time Off / Leaves Blueprint
  if (
    norm.includes('time off') ||
    norm.includes('إجاز') ||
    norm.includes('اجاز') ||
    norm.includes('leave') ||
    norm.includes('غياب') ||
    norm.includes('عطل')
  ) {
    return {
      id: `plan-${Date.now()}`,
      command: moduleKeyword,
      appName: 'Odoo Time Off (موديول الإجازات)',
      dialect,
      createdAt: new Date().toISOString(),
      steps: [
        {
          id: 'to1',
          title: 'الترحيب والتعريف بموديول الإجازات (Time Off)',
          narration_text:
            'يا أهلاً ومرحباً بكم. بنشرح لكم اليوم موديول الإجازات Time Off في نظام أودو، وهو النظام الأساسي المعتمد لتقديم ومتابعة طلبات الإجازات ومراجعة الأرصدة المستحقة بكل سهولة وسرعة.',
          caption_text: 'الترحيب والتعريف بموديول الإجازات (Time Off) وأهميته للموظف والشركة.',
          action: { type: 'hover', selector: '[data-menu-xmlid*="holiday"], text:الإجازات, text:Time Off' },
          highlight: { selector: '[data-menu-xmlid*="holiday"], text:الإجازات, text:Time Off', style: 'spotlight', arrow_direction: 'down' },
          zoom: { scale: 1.15 },
          duration_hint_ms: 8500,
        },
        {
          id: 'to2',
          title: 'لوحة القيادة واستعراض رصيد الإجازات المتاح',
          narration_text:
            'أول ما نفتح الموديول، تظهر لنا لوحة القيادة وفيها بطاقات الأرصدة المتبقية، مثل الإجازة السنوية، والمرضية، والاضطرارية، وتوضح الأيام المستحقة والمتبقية بالتفصيل.',
          caption_text: 'استعراض لوحة القيادة (Dashboard) وأرصدة الإجازات المتبقية لكل موظف.',
          action: { type: 'scroll' },
          highlight: { selector: '.o_timeoff_card, .o_kanban_view, .o_content', style: 'box', arrow_direction: 'right' },
          duration_hint_ms: 8000,
        },
        {
          id: 'to3',
          title: 'استعراض قسم "إجازاتي" ومتابعة الحالات',
          narration_text:
            'من هنا نقدر ندخل على قسم إجازاتي علشان نشوف كافة الطلبات اللي قدمناها سابقاً وحالتها، سواء كانت معتمدة باللون الأخضر، أو قيد المراجعة، أو مرفوضة.',
          caption_text: 'استعراض طلبات الإجازة السابقة في قسم (My Time Off) ومتابعة حالاتها.',
          action: { type: 'hover', selector: 'text:إجازاتي, text:My Time Off, .o_nav_entry' },
          highlight: { selector: 'text:إجازاتي, text:My Time Off, .o_nav_entry', style: 'spotlight', arrow_direction: 'right' },
          duration_hint_ms: 7500,
        },
        {
          id: 'to4',
          title: 'إنشاء وتقديم طلب إجازة جديد',
          narration_text:
            'لتقديم طلب إجازة جديد، نضغط على زر جديد أو طلب إجازة أعلى الصفحة لفتح النموذج وتحديد نوع الإجازة وتاريخ البداية والنهاية.',
          caption_text: 'الضغط على زر جديد (New) لفتح نموذج طلب الإجازة واختيار نوعها.',
          action: { type: 'click', selector: 'button.o_list_button_add, text:جديد, text:New, text:طلب إجازة' },
          highlight: { selector: 'button.o_list_button_add, text:جديد, text:New, text:طلب إجازة', style: 'arrow', arrow_direction: 'down' },
          duration_hint_ms: 8000,
        },
        {
          id: 'to5',
          title: 'تحديد فترة الإجازة وحساب الأيام وسبب الطلب',
          narration_text:
            'نحدد تاريخ البداية والنهاية، وأودو بيحسب عدد أيام العمل تلقائياً بدون العطلات الأسبوعية، ونقدر نكتب سبب الإجازة ونضغط على إرسال.',
          caption_text: 'تحديد فترة الإجازة وكتابة السبب وإرسال الطلب للاعتماد.',
          action: { type: 'hover', selector: '[name="request_date_from"], [name="holiday_status_id"], div.o_form_sheet' },
          highlight: { selector: '[name="request_date_from"], [name="holiday_status_id"], div.o_form_sheet', style: 'box', arrow_direction: 'left' },
          duration_hint_ms: 8500,
        },
        {
          id: 'to6',
          title: 'إدارة وموافقات الإدارة والمسؤولين (Approvals)',
          narration_text:
            'بعد إرسال الطلب، ينتقل تلقائياً للمدير المباشر في قسم الموافقات علشان يقدر يعتمد الطلب بضغطة زر أو يرفضه، وفور الاعتماد يتم تحديث الرصيد آلياً.',
          caption_text: 'شاشة الموافقات (Approvals) لاعتماد طلبات الموظفين وتحديث الأرصدة تلقائياً.',
          action: { type: 'hover', selector: 'button[name="action_approve"], text:Approve, text:موافقة, text:All Time Off' },
          highlight: { selector: 'button[name="action_approve"], text:Approve, text:موافقة, text:All Time Off', style: 'circle', arrow_direction: 'down' },
          duration_hint_ms: 8500,
        },
      ],
    };
  }

  // 2. Odoo Sales Blueprint
  if (norm.includes('sale') || norm.includes('مبيع') || norm.includes('عرض سعر') || norm.includes('quotation')) {
    const isSaudi = dialect === 'saudi';
    return {
      id: `plan-${Date.now()}`,
      command: moduleKeyword,
      appName: 'Odoo Sales (المبيعات)',
      dialect,
      createdAt: new Date().toISOString(),
      steps: [
        {
          id: 's1',
          title: 'الترحيب وفتح مديول المبيعات',
          narration_text: isSaudi
            ? 'حيّاكم الله وأهلاً وسهلاً بكم. نستعرض معكم اليوم موديول المبيعات في نظام أودو لمتابعة عروض الأسعار وأوامر البيع بكل سرعة وسهولة. نبدأ بالدخول إلى شاشة المبيعات.'
            : 'مرحباً بكم. نستعرض معكم اليوم موديول المبيعات في نظام أودو، لإدارة ومتابعة عروض الأسعار وأوامر البيع بكفاءة متكاملة. نبدأ بالدخول إلى قائمة المبيعات.',
          caption_text: 'مرحباً بكم. استعراض موديول المبيعات لمتابعة دورة المبيعات والطلبات.',
          action: { type: 'click', selector: '[data-menu-xmlid*="sale"], text:المبيعات, text:Sales' },
          highlight: { selector: '[data-menu-xmlid*="sale"], text:المبيعات, text:Sales', style: 'spotlight', arrow_direction: 'down' },
          zoom: { scale: 1.05 },
          duration_hint_ms: 8000,
        },
        {
          id: 's2',
          title: 'استعراض قائمة عروض الأسعار والطلبات',
          narration_text: isSaudi
            ? 'هنا تظهر لنا شاشة عروض الأسعار القائمة، ونقدر نتابع حالة كل عرض، واسم العميل، والقيمة الإجمالية بكل وضوح.'
            : 'تظهر أمامنا قائمة عروض الأسعار الجارية، ومن هنا يمكن متابعة حالة كل طلب، واسم العميل، والقيمة الإجمالية بوضوح.',
          caption_text: 'استعراض عروض الأسعار، مبالغ الفواتير، وحالة كل طلب مبيعات.',
          action: { type: 'scroll' },
          highlight: { selector: '.o_list_table, .o_kanban_view, .o_content', style: 'box', arrow_direction: 'right' },
          duration_hint_ms: 7000,
        },
        {
          id: 's3',
          title: 'إنشاء عرض سعر جديد',
          narration_text: isSaudi
            ? 'لإنشاء عرض سعر لعميل جديد، نتوجه بالماوس ونضغط على زر جديد أعلى الشاشة لفتح نموذج أمر المبيعات.'
            : 'ولإنشاء عرض سعر لعميل جديد، نتوجه بالمؤشر ونضغط على زر جديد أعلى الشاشة لفتح النموذج المخصص.',
          caption_text: 'الضغط على زر جديد (New) لبدء إنشاء عرض سعر لعميل.',
          action: { type: 'click', selector: 'button.o_list_button_add, button.o-kanban-button-new, button[data-hotkey="c"], text:جديد, text:New' },
          highlight: { selector: 'button.o_list_button_add, button.o-kanban-button-new, button[data-hotkey="c"], text:جديد, text:New', style: 'arrow', arrow_direction: 'down' },
          zoom: { scale: 1.2 },
          duration_hint_ms: 7000,
        },
        {
          id: 's4',
          title: 'تحديد العميل وتاريخ العرض',
          narration_text: isSaudi
            ? 'في هذا الحقل نحدد اسم العميل، والبرنامج يعبي بيانات التواصل وعنوان الفاتورة والشحن تلقائياً.'
            : 'نقوم هنا باختيار العميل وتاريخ صلاحية العرض، وسيقوم النظام بتعبئة بيانات الاتصال وعنوان الفاتورة آلياً.',
          caption_text: 'اختيار اسم العميل وتاريخ صلاحية عرض السعر.',
          action: { type: 'hover', selector: 'div[name="partner_id"], [name="partner_id"]' },
          highlight: { selector: 'div[name="partner_id"], [name="partner_id"]', style: 'spotlight', arrow_direction: 'right' },
          zoom: { scale: 1.2 },
          duration_hint_ms: 7500,
        },
        {
          id: 's5',
          title: 'إضافة المنتجات والكميات والأسعار',
          narration_text: isSaudi
            ? 'ومن جدول بنود الطلب، نضغط إضافة منتج ونحدد الصنف والكمية، وأودو يحسب الضرائب والإجمالي تلقائياً.'
            : 'ومن جدول بنود الطلب، نضغط على إضافة منتج لتحديد الأصناف والكميات، حيث يقوم أودو باحتساب الضرائب والإجمالي تلقائياً.',
          caption_text: 'إضافة سطور المنتجات، الكميات، الأسعار، وحساب الضريبة آلياً.',
          action: { type: 'click', selector: 'text:إضافة منتج, text:Add a product' },
          highlight: { selector: 'div[name="order_line"], text:إضافة منتج, text:Add a product', style: 'box', arrow_direction: 'left' },
          zoom: { scale: 1.15 },
          duration_hint_ms: 8000,
        },
        {
          id: 's6',
          title: 'تأكيد العرض وتحويله لأمر بيع رسمي',
          narration_text: isSaudi
            ? 'بعد مراجعة البنود، نضغط على تأكيد لاعتماد العرض وتحويله لأمر بيع رسمي وتحديث المخزون بنجاح.'
            : 'وأخيراً نضغط على تأكيد لاعتماد عرض السعر وتحويله إلى أمر بيع رسمي وتحديث المخزون بنجاح.',
          caption_text: 'الضغط على تأكيد (Confirm) لتحويل عرض السعر إلى أمر بيع رسمي.',
          action: { type: 'hover', selector: 'button[name="action_confirm"], text:تأكيد, text:Confirm' },
          highlight: { selector: 'button[name="action_confirm"], text:تأكيد, text:Confirm', style: 'circle', arrow_direction: 'down' },
          zoom: { scale: 1.2 },
          duration_hint_ms: 8000,
        },
      ],
    };
  }

  // 3. Default Timesheets Blueprint
  const isSaudi = dialect === 'saudi';
  return {
    id: `plan-${Date.now()}`,
    command: moduleKeyword,
    appName: 'Odoo Timesheets (الجداول الزمنية)',
    dialect,
    createdAt: new Date().toISOString(),
    steps: [
      {
        id: 't1',
        title: 'الترحيب وفتح مديول الجداول الزمنية',
        narration_text: isSaudi
          ? 'حيّاكم الله وأهلاً وسهلاً بكم. نستعرض معكم اليوم موديول الجداول الزمنية في أودو لمتابعة ساعات العمل على المشاريع وقياس الإنتاجية بدقة.'
          : 'مرحباً بكم. نستعرض معكم اليوم موديول الجداول الزمنية في نظام أودو، لمتابعة ساعات العمل على المشاريع وإدارة إنتاجية الفريق بدقة.',
        caption_text: 'مرحباً بكم. فتح مديول الجداول الزمنية (Timesheets) لتسجيل ساعات العمل.',
        action: { type: 'click', selector: '[data-menu-xmlid*="timesheet"], text:الجداول الزمنية, text:Timesheets' },
        highlight: { selector: '[data-menu-xmlid*="timesheet"], text:الجداول الزمنية, text:Timesheets', style: 'spotlight', arrow_direction: 'down' },
        duration_hint_ms: 8500,
      },
      {
        id: 't2',
        title: 'استعراض طرق العرض والفلترة',
        narration_text: isSaudi
          ? 'تقدرون تستعرضون الساعات بطريقة العرض الأسبوعي أو اليومي أو كجدول قائمة لتسهيل المتابعة والمراجعة.'
          : 'يمكن استعراض الساعات بطريقة العرض الأسبوعي أو اليومي أو كجدول قائمة لتسهيل المراجعة والمتابعة الدورية.',
        caption_text: 'التبديل بين طرق العرض (اليوم، الأسبوع، الشهر، أو القائمة).',
        action: { type: 'hover', selector: '.o_cp_switch_buttons, button.o_switch_view' },
        highlight: { selector: '.o_cp_switch_buttons, button.o_switch_view', style: 'arrow', arrow_direction: 'right' },
        duration_hint_ms: 7500,
      },
      {
        id: 't3',
        title: 'إضافة سجل وقت جديد',
        narration_text: isSaudi
          ? 'لتسجيل مهمة عمل جديدة، نضغط على زر جديد أعلى الصفحة لنبدأ بتسجيل الوقت وتفاصيل الإنجاز.'
          : 'لتسجيل مهمة عمل جديدة، نتوجه بالمؤشر ونضغط على زر جديد أعلى الصفحة للبدء بتسجيل الوقت والتفاصيل.',
        caption_text: 'الضغط على زر جديد (New) لإضافة بند وقت جديد للمشروع.',
        action: { type: 'click', selector: 'button.o_list_button_add, button.o-kanban-button-new, button[data-hotkey="c"], text:جديد, text:New' },
        highlight: { selector: 'button.o_list_button_add, button.o-kanban-button-new, button[data-hotkey="c"], text:جديد, text:New', style: 'spotlight', arrow_direction: 'down' },
        duration_hint_ms: 7000,
      },
      {
        id: 't4',
        title: 'اختيار المشروع والمهمة',
        narration_text: isSaudi
          ? 'من هنا نحدد المشروع والمهمة الفرعية لمساعدة الإدارة في معرفة التكلفة بدقة.'
          : 'نقوم هنا باختيار المشروع والمهمة الفرعية، مما يتيح للإدارة احتساب التكلفة والربحية بدقة.',
        caption_text: 'تحديد المشروع (Project) والمهمة (Task) الخاصة بالعمل.',
        action: { type: 'hover', selector: 'div[name="project_id"], [name="project_id"]' },
        highlight: { selector: 'div[name="project_id"], [name="project_id"]', style: 'box', arrow_direction: 'left' },
        duration_hint_ms: 8000,
      },
      {
        id: 't5',
        title: 'تسجيل الساعات المنجزة والوصف',
        narration_text: isSaudi
          ? 'نسجل هنا عدد الساعات المستغرقة مع وصف مختصر للإنجاز، ثم نضغط حفظ وبكذا ينتهي التسجيل بنجاح.'
          : 'نقوم بإدخال عدد الساعات المنجزة مع وصف مختصر، ثم نضغط على حفظ لتسجيل البند في النظام بنجاح.',
        caption_text: 'إدخال الساعات المستغرقة ووصف الإنجاز وحفظ السجل.',
        action: { type: 'hover', selector: 'div[name="unit_amount"], input[name="unit_amount"], text:حفظ' },
        highlight: { selector: 'div[name="unit_amount"], input[name="unit_amount"]', style: 'circle', arrow_direction: 'down' },
        duration_hint_ms: 8000,
      },
    ],
  };
}

/**
 * Generate a custom AI tutorial plan using the configured LLM and the page inspection summary.
 */
export async function generateTutorialPlan(
  command: string,
  summary: PageInspectionSummary,
  dialect: ArabicDialect = 'saudi',
): Promise<TutorialPlan> {
  const providers = (await providersStorage.get()) || [];
  const settings = (await settingsStorage.get()) || {};
  const activeModelRef = usableModel(providers, settings.defaultModel);

  if (!activeModelRef) {
    // No LLM configured or offline: return domain-intelligent blueprint
    return getOdooBlueprintPlan(command || summary.detectedModuleName, dialect);
  }

  const modelEntry = findModel(providers, activeModelRef);
  if (!modelEntry) return getOdooBlueprintPlan(command || summary.detectedModuleName, dialect);

  const dialectInfo = DIALECT_PRESETS[dialect] || DIALECT_PRESETS.saudi;

  const systemPrompt = `You are a Senior Tutorial Choreographer and Video Director for Enterprise Web Applications (especially Odoo).
Your job is to generate a structured, highly realistic, friendly, and complete step-by-step Tutorial Plan in JSON format based on the user request and the active webpage inspection.

Instructions:
1. Act as a master instructor (الأستاذ): Explain WHY each feature is used, how data flows, and what the business outcome is.
2. Dialect requirement: ${dialectInfo.promptGuide}
3. The response must be STRICTLY valid JSON conforming to the following structure:
{
  "appName": "string",
  "steps": [
    {
      "id": "step_1",
      "title": "Short title in Arabic",
      "narration_text": "Spoken explanation in chosen dialect explaining WHY and HOW",
      "caption_text": "Concise subtitle for the bottom bar",
      "action": {
        "type": "click" | "type" | "scroll" | "hover" | "navigate" | "wait",
        "selector": "CSS selector or text:Label",
        "value": "text to type if type action"
      },
      "highlight": {
        "selector": "CSS selector or text:Label",
        "style": "arrow" | "box" | "circle" | "spotlight",
        "arrow_direction": "up" | "down" | "left" | "right"
      },
      "zoom": { "scale": 1.15 },
      "duration_hint_ms": 7000
    }
  ]
}

No markdown code fences or conversational text outside the JSON.`;

  const userPrompt = `Request: "${command}"
Page title: ${summary.title}
Page URL: ${summary.url}
Detected Module: ${summary.detectedModuleName}
Teacher Overview: ${summary.teacherOverview}
Breadcrumbs: ${summary.breadcrumbs.join(' > ')}
Available buttons: ${summary.actionButtons.map(b => b.text).slice(0, 15).join(', ')}
Visible fields: ${summary.fields.map(f => f.label).slice(0, 10).join(', ')}`;

  try {
    const apiKeys = (await keysStorage.get()) || {};
    const chat = createModel({
      kind: modelEntry.provider.kind,
      modelName: modelEntry.model.name,
      apiKey: apiKeys[modelEntry.provider.id] || '',
      baseUrl: modelEntry.provider.baseUrl,
      maxOutputTokens: 2048,
    });

    const turn = await streamTurn({
      chat,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      reasoning: 'none',
      retry: { attempts: 1, baseMs: 0, maxMs: 0 },
    });

    const replyText = turn.text?.trim() || '';
    if (!replyText) {
      return getOdooBlueprintPlan(command || summary.detectedModuleName, dialect);
    }

    // Extract JSON block if surrounded by markdown fences
    const jsonMatch = replyText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, replyText];
    const cleanJson = (jsonMatch[1] || replyText).trim();
    const parsed = JSON.parse(cleanJson);

    return {
      id: `plan-${Date.now()}`,
      command,
      appName: parsed.appName || summary.detectedModuleName,
      dialect,
      createdAt: new Date().toISOString(),
      steps: (parsed.steps || []).map((s: any, idx: number) => ({
        id: s.id || `s_${idx + 1}`,
        title: s.title || `خطوة ${idx + 1}`,
        narration_text: s.narration_text || s.title || '',
        caption_text: s.caption_text || s.narration_text || '',
        action: s.action || { type: 'hover' },
        highlight: s.highlight || { style: 'spotlight' },
        zoom: s.zoom,
        duration_hint_ms: s.duration_hint_ms || 7000,
      })),
    };
  } catch (err) {
    console.warn('LLM plan generation failed, using intelligent blueprint:', err);
    return getOdooBlueprintPlan(command || summary.detectedModuleName, dialect);
  }
}
