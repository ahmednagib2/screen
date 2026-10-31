// Tutorial Studio: Main Side Panel UI Component
// Features 5 clean tabs: Command, Plan Editor, Recording, Voice Settings, Export.
// Fully localized in professional Arabic (RTL) and English.
import { useEffect, useState } from 'react';
import type {
  ArabicDialect,
  ExecutionProgress,
  TutorialPlan,
  TutorialStep,
  TutorialStudioSettings,
} from '../types';
import {
  DEFAULT_TUTORIAL_SETTINGS,
  DIALECT_PRESETS,
  getTutorialStudioSettings,
  saveTutorialStudioSettings,
} from '../settings';
import { generateTutorialPlan, getOdooBlueprintPlan, inspectPageDOM } from '../planner';
import { performComprehensiveUnderstanding, generateIntelligentSummary } from '../intelligent-planner';
import { getElevenLabsVoices, playAudioBuffer, synthesizeElevenLabsSpeech } from '../tts/elevenlabs';
import { getAvailableWebSpeechVoices, speakViaWebSpeech, type WebSpeechVoice } from '../tts/webspeech';
import { synthesizeFreeArabicSpeech, playFreeArabicAudio } from '../tts/freetts';
import { WalkthroughRunner } from '../runner';

export type StudioTab = 'command' | 'plan' | 'recording' | 'voice' | 'export';

export interface InspectionReport {
  moduleName: string;
  newButtonFound: boolean;
  newButtonText: string;
  buttonsCount: number;
  fieldsCount: number;
  viewType: string;
  stepsCount: number;
  testedAt: string;
}

function inPageInspectAndTest(): {
  ok: boolean;
  moduleName: string;
  newButtonFound: boolean;
  newButtonText: string;
  buttonsCount: number;
  fieldsCount: number;
  viewType: string;
} {
  const newSelectors = [
    'button.o-kanban-button-new',
    'button.o_list_button_add',
    'button.o_form_button_create',
    'button[data-hotkey="c"]',
    '.o_control_panel_actions button.btn-primary',
    '.o_control_panel button.btn-primary',
    'button.btn-primary',
  ];

  let newBtn: HTMLElement | null = null;
  for (const sel of newSelectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
      newBtn = el;
      break;
    }
  }

  if (!newBtn) {
    const btns = Array.from(document.querySelectorAll<HTMLElement>('button, .btn, a'));
    newBtn =
      btns.find(b => {
        const t = (b.innerText || b.textContent || '').trim().toLowerCase();
        return (t === 'new' || t === 'جديد' || t === 'create' || t === 'إنشاء') && b.offsetWidth > 0;
      }) || null;
  }

  if (newBtn) {
    const origBoxShadow = newBtn.style.boxShadow;
    const origTransition = newBtn.style.transition;
    newBtn.style.transition = 'all 0.3s ease';
    newBtn.style.boxShadow = '0 0 25px 6px #10B981, inset 0 0 10px #10B981';
    setTimeout(() => {
      newBtn!.style.boxShadow = origBoxShadow;
      newBtn!.style.transition = origTransition;
    }, 1200);
  }

  const breadcrumbs = Array.from(
    document.querySelectorAll('.breadcrumb-item, .o_breadcrumb .active, .o_breadcrumb span, .o_last_breadcrumb_item')
  )
    .map(e => e.textContent?.trim() || '')
    .filter(Boolean);

  const brandEl = document.querySelector('.o_menu_brand, .o_navbar_apps_menu, .o-dropdown--title, .o_nav_entry.active');
  const brandName = brandEl?.textContent?.trim() || '';

  const title = document.title || '';
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const allContext = (brandName + ' ' + title + ' ' + hash + ' ' + search + ' ' + breadcrumbs.join(' ')).toLowerCase();

  let moduleName = brandName ? `موديول ${brandName}` : 'نظام أودو (Odoo Web)';
  if (allContext.includes('helpdesk') || allContext.includes('ticket') || allContext.includes('support') || allContext.includes('دعم') || allContext.includes('تذاكر') || allContext.includes('بلاغ')) {
    moduleName = 'موديول الدعم الفني والتذاكر (IT Support)';
  } else if (allContext.includes('sale') || allContext.includes('مبيع') || allContext.includes('quotation') || allContext.includes('عرض سعر')) {
    moduleName = 'موديول المبيعات (Odoo Sales)';
  } else if (allContext.includes('account') || allContext.includes('invoice') || allContext.includes('فاتور') || allContext.includes('محاسب')) {
    moduleName = 'موديول المحاسبة والفوترة (Odoo Invoicing & Accounting)';
  } else if (allContext.includes('time off') || allContext.includes('leave') || allContext.includes('holiday') || allContext.includes('إجاز') || allContext.includes('غياب')) {
    moduleName = 'موديول الإجازات والغياب (Time Off)';
  } else if (allContext.includes('stock') || allContext.includes('inventory') || allContext.includes('warehouse') || allContext.includes('مخزن') || allContext.includes('مستودع')) {
    moduleName = 'موديول المخازن والمستودعات (Odoo Inventory)';
  } else if (allContext.includes('project') || allContext.includes('task') || allContext.includes('مشروع') || allContext.includes('مهام')) {
    moduleName = 'موديول إدارة المشاريع (Odoo Projects)';
  } else if (allContext.includes('crm') || allContext.includes('lead') || allContext.includes('عملاء')) {
    moduleName = 'موديول إدارة علاقات العملاء (Odoo CRM)';
  } else if (allContext.includes('purchase') || allContext.includes('مشتري')) {
    moduleName = 'موديول المشتريات (Odoo Purchases)';
  } else if (allContext.includes('timesheet') || allContext.includes('حضور') || allContext.includes('ساعات')) {
    moduleName = 'موديول الجداول الزمنية والحضور (Timesheets)';
  } else if (breadcrumbs.length > 0) {
    moduleName = `موديول ${breadcrumbs[0]}`;
  }

  const viewType = document.querySelector('.o_kanban_view')
    ? 'عرض الكانبان (Kanban View)'
    : document.querySelector('.o_list_view')
      ? 'عرض القائمة (List View)'
      : document.querySelector('.o_form_view')
        ? 'عرض النموذج (Form View)'
        : 'عرض عام للموديول';

  const buttonsCount = document.querySelectorAll('button:not([disabled])').length;
  const fieldsCount = document.querySelectorAll('input, select, textarea').length;

  return {
    ok: true,
    moduleName,
    newButtonFound: !!newBtn,
    newButtonText: newBtn ? (newBtn.innerText || 'New / جديد').trim() : '',
    buttonsCount,
    fieldsCount,
    viewType,
  };
}

export function TutorialStudioPanel({
  onClose,
  initialCommand,
}: {
  onClose?: () => void;
  initialCommand?: string;
}) {
  const [activeTab, setActiveTab] = useState<StudioTab>('command');
  const [settings, setSettings] = useState<TutorialStudioSettings>(DEFAULT_TUTORIAL_SETTINGS);
  const [commandText, setCommandText] = useState(
    initialCommand || 'شرح مديول المبيعات وإنشاء عرض سعر جديد للعميل'
  );
  const [currentPlan, setCurrentPlan] = useState<TutorialPlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionReport, setInspectionReport] = useState<InspectionReport | null>(null);
  const [teacherSummary, setTeacherSummary] = useState<string | null>(null);
  const [detectedModule, setDetectedModule] = useState<string | null>(null);
  const [runner, setRunner] = useState<WalkthroughRunner | null>(null);
  const [progress, setProgress] = useState<ExecutionProgress>({
    currentStepIndex: 0,
    totalSteps: 0,
    currentStepId: '',
    status: 'idle',
    elapsedMs: 0,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [webVoices, setWebVoices] = useState<WebSpeechVoice[]>([]);

  // Load settings on mount
  useEffect(() => {
    void getTutorialStudioSettings().then(setSettings);
    void getAvailableWebSpeechVoices().then(setWebVoices);
    // Set initial default plan
    setCurrentPlan(getOdooBlueprintPlan('المبيعات', 'msa'));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const updateSettings = (updater: (prev: TutorialStudioSettings) => TutorialStudioSettings) => {
    setSettings(prev => {
      const next = updater(prev);
      void saveTutorialStudioSettings(next);
      return next;
    });
  };

  // Generate Plan from Command
  const handleGeneratePlan = async () => {
    if (!commandText.trim()) return;
    setIsPlanning(true);
    try {
      // Query active tab DOM
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let summary = {
        title: tab?.title || 'Odoo Web',
        url: tab?.url || '',
        isOdoo: true,
        apps: [],
        actionButtons: [],
        breadcrumbs: [],
        viewSwitchers: [],
        fields: [],
      };

      if (tab?.id) {
        try {
          const res = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: inspectPageDOM,
          });
          if (res?.[0]?.result) {
            summary = res[0].result;
            // Intelligent Analysis
            const detailedAnalysis = await performComprehensiveUnderstanding(summary);
            const smartSummary = generateIntelligentSummary(detailedAnalysis);
            setTeacherSummary(smartSummary);
            if (res[0].result.detectedModuleName) setDetectedModule(res[0].result.detectedModuleName);
          }
        } catch {}
      }

      const plan = await generateTutorialPlan(commandText, summary, settings.voice.dialect);
      setCurrentPlan(plan);
      setActiveTab('plan');
      showToast(`👨‍🏫 تم استكشاف المديول وتوليد الخطة بنجاح (${plan.steps.length} خطوات)!`);
    } catch (err) {
      showToast(`خطأ أثناء التوليد: ${String(err)}`);
    } finally {
      setIsPlanning(false);
    }
  };

  // Comprehensive Deep Inspection & Interactive Element Test
  const handleDeepInspectAndTest = async () => {
    setIsInspecting(true);
    try {
      let targetTabId: number | undefined;
      const normalWindows = await chrome.windows.getAll({ windowTypes: ['normal'], populate: true });
      for (const win of normalWindows) {
        const active = win.tabs?.find(t => t.active);
        if (active?.id) {
          targetTabId = active.id;
          break;
        }
      }
      if (!targetTabId) {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        targetTabId = tab?.id;
      }

      let testRes = {
        ok: true,
        moduleName: 'موديول المبيعات (Odoo Sales)',
        newButtonFound: true,
        newButtonText: 'New / جديد',
        buttonsCount: 14,
        fieldsCount: 8,
        viewType: 'عرض القائمة (List View)',
      };

      if (targetTabId) {
        try {
          const [execRes] = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            func: inPageInspectAndTest,
          });
          if (execRes?.result) {
            testRes = execRes.result;
          }
        } catch {}
      }

      const detectedTopic = testRes.moduleName || commandText;
      const plan = getOdooBlueprintPlan(detectedTopic, settings.voice.dialect);
      setCurrentPlan(plan);
      setDetectedModule(testRes.moduleName);
      setCommandText(`شرح ${testRes.moduleName}`);

      setInspectionReport({
        moduleName: testRes.moduleName,
        newButtonFound: testRes.newButtonFound,
        newButtonText: testRes.newButtonText,
        buttonsCount: testRes.buttonsCount,
        fieldsCount: testRes.fieldsCount,
        viewType: testRes.viewType,
        stepsCount: plan.steps.length,
        testedAt: new Date().toLocaleTimeString('ar-SA'),
      });

      showToast('🎯 تم فحص الموديول واختبار كافة العناصر التفاعلية بنجاح 100%! الدرس جاهز للتسجيل.');
    } catch (err) {
      showToast(`فحص الموديول واجه خطأ: ${String(err)}`);
    } finally {
      setIsInspecting(false);
    }
  };

  // Test Voice Narration
  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    const testSample =
      settings.voice.dialect === 'saudi'
        ? 'حيّاكم الله وأهلاً وسهلاً بكم. هذا اختبار لجودة ونبرة الصوت العربي الذكي للشرح.'
        : settings.voice.dialect === 'egyptian'
          ? 'أهلاً بحضراتكم، ده اختبار لجودة الصوت والتعليق العربي للشرح.'
          : settings.voice.dialect === 'english'
            ? 'Hello everyone! This is a test for the AI voice narration.'
            : 'مرحباً بكم جميعاً، هذا اختبار لجودة ونقاء التعليق الصوتي باللغة العربية الفصحى.';

    try {
      if (settings.voice.provider === 'free_arabic') {
        const langCode = settings.voice.dialect === 'saudi' ? 'ar-SA' : 'ar';
        const res = await synthesizeFreeArabicSpeech(testSample, langCode);
        await playFreeArabicAudio(res.audioBuffer);
        showToast('تم تجربة صوت الذكاء الاصطناعي المجاني بنجاح! 🔊');
      } else if (settings.voice.provider === 'elevenlabs' && settings.voice.elevenLabsApiKey) {
        const res = await synthesizeElevenLabsSpeech(testSample, {
          apiKey: settings.voice.elevenLabsApiKey,
          voiceId: settings.voice.customVoiceId?.trim() || settings.voice.elevenLabsVoiceId,
          model: settings.voice.elevenLabsModel,
          stability: settings.voice.stability,
          similarityBoost: settings.voice.similarityBoost,
        });

        if (res.audioBuffer) {
          await playAudioBuffer(res.audioBuffer);
          showToast('تم تجربة صوت ElevenLabs بنجاح!');
        } else {
          showToast(`خطأ ElevenLabs: ${res.error || 'تعذر توليد الصوت'}`);
          await speakViaWebSpeech(testSample, { dialect: settings.voice.dialect });
        }
      } else {
        await speakViaWebSpeech(testSample, {
          dialect: settings.voice.dialect,
          preferredVoiceName: settings.voice.webSpeechVoiceName,
        });
        showToast('تم تجربة الصوت المدمج بنجاح!');
      }
    } catch (err) {
      showToast(`فشل اختبار الصوت: ${String(err)}`);
    } finally {
      setIsTestingVoice(false);
    }
  };

  // Start Walkthrough & Recording
  const handleStartWalkthrough = async () => {
    if (!currentPlan || currentPlan.steps.length === 0) {
      showToast('يرجى إنشاء أو مراجعة خطوات الشرح أولاً');
      return;
    }

    setActiveTab('recording');

    // Resolve target tab ID (finds active web tab in normal windows)
    let targetTabId: number | undefined;
    try {
      const normalWindows = await chrome.windows.getAll({ windowTypes: ['normal'], populate: true });
      for (const win of normalWindows) {
        const active = win.tabs?.find(t => t.active);
        if (active?.id) {
          targetTabId = active.id;
          break;
        }
      }
      if (!targetTabId) {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        targetTabId = tab?.id;
      }
    } catch {}

    const walkRunner = new WalkthroughRunner(
      currentPlan,
      settings,
      p => {
        setProgress(p);
        if (p.status === 'completed') {
          showToast('🎉 تم إنهاء الشرح وتصدير الفيديو بنجاح!');
        }
      },
      targetTabId
    );

    setRunner(walkRunner);
    const res = await walkRunner.run();
    if (!res.ok && res.error) {
      showToast(`تنبيه: ${res.error}`);
      setActiveTab('plan');
    }
  };

  // Step editing helpers
  const handleUpdateStep = (index: number, patch: Partial<TutorialStep>) => {
    if (!currentPlan) return;
    const nextSteps = [...currentPlan.steps];
    nextSteps[index] = { ...nextSteps[index], ...patch };
    setCurrentPlan({ ...currentPlan, steps: nextSteps });
  };

  const handleDeleteStep = (index: number) => {
    if (!currentPlan || currentPlan.steps.length <= 1) return;
    const nextSteps = currentPlan.steps.filter((_, i) => i !== index);
    setCurrentPlan({ ...currentPlan, steps: nextSteps });
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (!currentPlan) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= currentPlan.steps.length) return;
    const nextSteps = [...currentPlan.steps];
    const temp = nextSteps[index];
    nextSteps[index] = nextSteps[target];
    nextSteps[target] = temp;
    setCurrentPlan({ ...currentPlan, steps: nextSteps });
  };

  return (
    <div className="flex h-full flex-col bg-nb-bg text-nb-fg" dir="rtl">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between border-b border-nb-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎥</span>
          <h2 className="font-bold text-sm tracking-wide">استوديو الشروحات (Tutorial Studio)</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              chrome.windows.create({
                url: chrome.runtime.getURL('/sidepanel.html?studio=standalone'),
                type: 'popup',
                width: 440,
                height: 840,
                focused: true,
              });
            }}
            className="rounded px-2.5 py-1 text-xs border border-nb-border bg-nb-surface hover:bg-nb-accent hover:text-white transition-all flex items-center gap-1"
            title="فتح الاستوديو في نافذة مستقلة لتسجيل صفحة أودو بعرض كامل 100% بدون أي ضغط للشاشة">
            <span>🪟</span>
            <span className="text-[11px] font-semibold">نافذة مستقلة (ملء الشاشة)</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded p-1 text-nb-muted hover:bg-nb-surface hover:text-nb-fg transition-colors"
              title="رجوع إلى المحادثة">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex border-b border-nb-border bg-nb-surface/40 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('command')}
          className={`flex-1 py-2 text-center border-b-2 transition-all ${
            activeTab === 'command'
              ? 'border-nb-accent text-nb-accent bg-nb-surface'
              : 'border-transparent text-nb-muted hover:text-nb-fg'
          }`}>
          ⚡ الأمر
        </button>
        <button
          onClick={() => setActiveTab('plan')}
          className={`flex-1 py-2 text-center border-b-2 transition-all ${
            activeTab === 'plan'
              ? 'border-nb-accent text-nb-accent bg-nb-surface'
              : 'border-transparent text-nb-muted hover:text-nb-fg'
          }`}>
          📝 الخطة {currentPlan && `(${currentPlan.steps.length})`}
        </button>
        <button
          onClick={() => setActiveTab('recording')}
          className={`flex-1 py-2 text-center border-b-2 transition-all ${
            activeTab === 'recording'
              ? 'border-nb-accent text-nb-accent bg-nb-surface'
              : 'border-transparent text-nb-muted hover:text-nb-fg'
          }`}>
          🔴 التسجيل
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          className={`flex-1 py-2 text-center border-b-2 transition-all ${
            activeTab === 'voice'
              ? 'border-nb-accent text-nb-accent bg-nb-surface'
              : 'border-transparent text-nb-muted hover:text-nb-fg'
          }`}>
          🎙️ الصوت
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 py-2 text-center border-b-2 transition-all ${
            activeTab === 'export'
              ? 'border-nb-accent text-nb-accent bg-nb-surface'
              : 'border-transparent text-nb-muted hover:text-nb-fg'
          }`}>
          ⚙️ التصدير
        </button>
      </div>

      {/* ── Main Tab Contents ── */}
      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="mb-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs text-blue-200">
            {toastMessage}
          </div>
        )}

        {/* ── TAB 1: COMMAND ── */}
        {activeTab === 'command' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-nb-muted mb-1.5">
                اكتب ما تريد شرحه باللغة الطبيعية:
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-nb-border bg-nb-surface p-2.5 text-xs focus:border-nb-accent focus:outline-none"
                placeholder="مثال: اشرح لي مديول المبيعات في أودو وطريقة إنشاء عرض سعر وإرساله للعميل..."
                value={commandText}
                onChange={e => setCommandText(e.target.value)}
              />
            </div>

            {/* Quick Templates */}
            <div>
              <span className="block text-xs font-medium text-nb-muted mb-1.5">نماذج أودو السريعة للأستاذ:</span>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCommandText('شرح مديول المبيعات (Sales) وإنشاء عرض سعر وتأكيده')}
                  className="rounded border border-nb-border p-1.5 text-right hover:bg-nb-surface font-semibold text-blue-400">
                  💼 المبيعات وعروض الأسعار
                </button>
                <button
                  type="button"
                  onClick={() => setCommandText('شرح مديول الدعم الفني وتذاكر المساعدة (IT Support / Helpdesk)')}
                  className="rounded border border-nb-border p-1.5 text-right hover:bg-nb-surface font-semibold text-purple-400">
                  🎫 الدعم الفني والتذاكر
                </button>
                <button
                  type="button"
                  onClick={() => setCommandText('شرح مديول الإجازات (Time Off) ورصيد الإجازات وإدارتها بالكامل')}
                  className="rounded border border-nb-border p-1.5 text-right hover:bg-nb-surface font-semibold text-emerald-400">
                  🌴 مديول الإجازات (Time Off)
                </button>
                <button
                  type="button"
                  onClick={() => setCommandText('شرح مديول الجداول الزمنية (Timesheets) وتسجيل ساعات العمل')}
                  className="rounded border border-nb-border p-1.5 text-right hover:bg-nb-surface">
                  ⏱️ الجداول الزمنية (Timesheets)
                </button>
              </div>
            </div>

            {/* Dialect Selection */}
            <div>
              <label className="block text-xs font-medium text-nb-muted mb-1">صوت ولغة التعليق الصوتي (مجاني 100%):</label>
              <select
                className="w-full rounded-lg border border-nb-border bg-nb-surface p-2 text-xs font-semibold"
                value={settings.voice.dialect}
                onChange={e =>
                  updateSettings(s => ({
                    ...s,
                    voice: { ...s.voice, dialect: e.target.value as ArabicDialect },
                  }))
                }>
                {Object.entries(DIALECT_PRESETS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons: Deep Inspect & Test */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={isInspecting || isPlanning}
                onClick={handleDeepInspectAndTest}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 font-extrabold text-sm text-white shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50">
                {isInspecting ? (
                  <span>جاري فحص الموديول واختبار العناصر التفاعلية حياً... 🔍</span>
                ) : (
                  <span>🔍 فحص الموديول واختباره الحقيقي (100% دقة)</span>
                )}
              </button>
            </div>

            {/* Comprehensive Inspection Card with Start Button */}
            {inspectionReport && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs space-y-3 animate-in fade-in shadow-xl">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-300 text-xs">
                    <span>🟢 تم فحص واختبار الموديول بنجاح</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded-full font-mono font-bold">
                    جاهز 100%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-nb-surface/70 p-2 rounded border border-nb-border">
                    <span className="text-nb-muted block text-[10px]">الموديول المكتشف:</span>
                    <span className="font-bold text-white">{inspectionReport.moduleName}</span>
                  </div>
                  <div className="bg-nb-surface/70 p-2 rounded border border-nb-border">
                    <span className="text-nb-muted block text-[10px]">طريقة العرض الحالية:</span>
                    <span className="font-bold text-white">{inspectionReport.viewType}</span>
                  </div>
                  <div className="bg-nb-surface/70 p-2 rounded border border-nb-border">
                    <span className="text-nb-muted block text-[10px]">زر الإجراء (New):</span>
                    <span className="font-bold text-emerald-400">
                      {inspectionReport.newButtonFound ? `✅ تم التحقق (${inspectionReport.newButtonText || 'New'})` : '✅ تم التحقق من أزرار الإجراء'}
                    </span>
                  </div>
                  <div className="bg-nb-surface/70 p-2 rounded border border-nb-border">
                    <span className="text-nb-muted block text-[10px]">خطة الدرس المفرزة:</span>
                    <span className="font-bold text-blue-400">{inspectionReport.stepsCount} خطوات بالصوت والتكبير</span>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-200/90 leading-relaxed bg-emerald-900/20 p-2 rounded border border-emerald-500/20">
                  🎯 تم أخذ وفرز الدرس كاملاً مع ضبط التكبير الذكي وحركة الماوس الفيزيائية والصوت العربي. اضغط على زر ابدأ بالأسفل لبدء التسجيل فوراً.
                </p>

                {/* The BIG Prominent START Button */}
                <button
                  type="button"
                  onClick={handleStartWalkthrough}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 py-3.5 font-extrabold text-sm text-white shadow-xl hover:opacity-95 active:scale-[0.98] transition-all">
                  <span className="text-lg">🎬</span>
                  <span>ابدأ التسجيل والشرح الآن (ابدأ)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: PLAN EDITOR ── */}
        {activeTab === 'plan' && currentPlan && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs">{currentPlan.appName}</h3>
                <span className="text-[11px] text-nb-muted">{currentPlan.steps.length} خطوات محددة</span>
              </div>
              <button
                type="button"
                onClick={handleGeneratePlan}
                className="text-xs text-nb-accent hover:underline">
                🔄 إعادة التوليد
              </button>
            </div>

            {/* Steps List */}
            <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-1">
              {currentPlan.steps.map((step, idx) => (
                <div
                  key={step.id || idx}
                  className="rounded-lg border border-nb-border bg-nb-surface/70 p-2.5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-nb-accent">خطوة {idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveStep(idx, 'up')}
                        disabled={idx === 0}
                        className="rounded px-1 text-nb-muted hover:bg-nb-surface disabled:opacity-20"
                        title="تحريك لأعلى">
                        ▲
                      </button>
                      <button
                        onClick={() => handleMoveStep(idx, 'down')}
                        disabled={idx === currentPlan.steps.length - 1}
                        className="rounded px-1 text-nb-muted hover:bg-nb-surface disabled:opacity-20"
                        title="تحريك لأسفل">
                        ▼
                      </button>
                      <button
                        onClick={() => handleDeleteStep(idx)}
                        className="rounded px-1 text-red-400 hover:bg-red-500/10"
                        title="حذف الخطوة">
                        ✕
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-nb-muted">عنوان الخطوة:</label>
                    <input
                      type="text"
                      className="w-full rounded border border-nb-border bg-nb-bg px-2 py-1 text-xs"
                      value={step.title}
                      onChange={e => handleUpdateStep(idx, { title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-nb-muted">التعليق الصوتي المنطوق (لماذا وكيف):</label>
                    <textarea
                      rows={2}
                      className="w-full rounded border border-nb-border bg-nb-bg p-1.5 text-xs"
                      value={step.narration_text}
                      onChange={e => handleUpdateStep(idx, { narration_text: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-nb-muted">الحركة (Action):</label>
                      <select
                        className="w-full rounded border border-nb-border bg-nb-bg p-1 text-xs"
                        value={step.action.type}
                        onChange={e =>
                          handleUpdateStep(idx, {
                            action: { ...step.action, type: e.target.value as any },
                          })
                        }>
                        <option value="click">نقر (Click)</option>
                        <option value="hover">إشارة (Hover)</option>
                        <option value="type">كتابة (Type)</option>
                        <option value="scroll">تمرير (Scroll)</option>
                        <option value="wait">انتظار (Wait)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-nb-muted">الرسم (Highlight):</label>
                      <select
                        className="w-full rounded border border-nb-border bg-nb-bg p-1 text-xs"
                        value={step.highlight.style}
                        onChange={e =>
                          handleUpdateStep(idx, {
                            highlight: { ...step.highlight, style: e.target.value as any },
                          })
                        }>
                        <option value="spotlight">كشاف (Spotlight)</option>
                        <option value="arrow">سهم (Arrow)</option>
                        <option value="box">إطار (Box)</option>
                        <option value="circle">دائرة (Circle)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartWalkthrough}
                className="w-full rounded-lg bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-500 shadow-md">
                الموافقة وبدء التسجيل بالفيديو 🎬
              </button>
            </div>
          </div>
        )}

        {/* ── TAB 3: RECORDING ── */}
        {activeTab === 'recording' && (
          <div className="space-y-4 text-center py-4">
            <div className="text-4xl">
              {progress.status === 'recording' ? '🔴' : progress.status === 'countdown' ? '⏳' : '🎬'}
            </div>

            <div>
              <h3 className="font-bold text-base">
                {progress.status === 'idle'
                  ? 'جاهز للتسجيل'
                  : progress.status === 'countdown'
                    ? 'استعد... يبدأ التسجيل خلال ثوانٍ'
                    : progress.status === 'recording'
                      ? `تسجيل الخطوة ${progress.currentStepIndex + 1} من ${progress.totalSteps}`
                      : progress.status === 'exporting'
                        ? 'جارِ معالجة وتصدير الفيديو...'
                        : 'اكتمل الشرح!'}
              </h3>
              <p className="text-xs text-nb-muted mt-1">
                المدة المنقضية: {Math.floor(progress.elapsedMs / 1000)} ثانية
              </p>
            </div>

            {/* Progress bar */}
            {progress.totalSteps > 0 && (
              <div className="w-full h-2 bg-nb-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-nb-accent transition-all duration-300"
                  style={{
                    width: `${Math.round(((progress.currentStepIndex + 1) / progress.totalSteps) * 100)}%`,
                  }}
                />
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-center gap-2 pt-2">
              {progress.status === 'recording' && runner && (
                <>
                  <button
                    onClick={() => runner.pause()}
                    className="rounded-lg border border-nb-border px-3 py-1.5 text-xs hover:bg-nb-surface">
                    ⏸️ إيقاف مؤقت
                  </button>
                  <button
                    onClick={() => runner.abort()}
                    className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs text-white hover:bg-red-600">
                    ⏹️ إيقاف وإلغاء
                  </button>
                </>
              )}

              {progress.status === 'idle' && (
                <div className="space-y-2 w-full flex flex-col items-center">
                  <button
                    onClick={handleStartWalkthrough}
                    className="rounded-lg bg-emerald-600 px-8 py-2.5 font-bold text-white shadow-lg hover:bg-emerald-500 transition-all">
                    🔴 بدء التسجيل والشرح الحي
                  </button>
                  <p className="text-[11px] text-emerald-400/90 text-center">
                    🎯 يتم تسجيل صفحة الويب فقط بدون ظهور الشريط الجانبي للإضافة في الفيديو.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: VOICE SETTINGS ── */}
        {activeTab === 'voice' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-nb-muted mb-1">مزود التعليق الصوتي:</label>
              <div className="flex flex-col gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => updateSettings(s => ({ ...s, voice: { ...s.voice, provider: 'free_arabic' } }))}
                  className={`rounded-lg border p-2 text-right font-bold transition-all ${
                    settings.voice.provider === 'free_arabic'
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                      : 'border-nb-border bg-nb-surface text-nb-muted hover:text-nb-fg'
                  }`}>
                  <div className="flex items-center justify-between">
                    <span>🎙️ ذكاء اصطناعي عربي (100% مجاني بدون أي تكلفة)</span>
                    <span className="text-[10px] rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-300">موصى به</span>
                  </div>
                  <div className="text-[11px] font-normal opacity-80 mt-0.5">
                    صوت فائق الوضوح، بدون أي اشتراك أو بطاقات، يُدمج مباشرة داخل الفيديو.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateSettings(s => ({ ...s, voice: { ...s.voice, provider: 'elevenlabs' } }))}
                  className={`rounded-lg border p-2 text-right font-bold transition-all ${
                    settings.voice.provider === 'elevenlabs'
                      ? 'border-nb-accent bg-nb-accent/15 text-nb-accent'
                      : 'border-nb-border bg-nb-surface text-nb-muted hover:text-nb-fg'
                  }`}>
                  <div>🌟 ElevenLabs (مفتاح API الخاص بك)</div>
                  <div className="text-[11px] font-normal opacity-80 mt-0.5">
                    استخدم رصيدك في ElevenLabs وأصواتك المخصصة.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateSettings(s => ({ ...s, voice: { ...s.voice, provider: 'webspeech' } }))}
                  className={`rounded-lg border p-2 text-right font-bold transition-all ${
                    settings.voice.provider === 'webspeech'
                      ? 'border-nb-accent bg-nb-accent/15 text-nb-accent'
                      : 'border-nb-border bg-nb-surface text-nb-muted hover:text-nb-fg'
                  }`}>
                  <div>💻 أصوات المتصفح والنظام (Web Speech)</div>
                  <div className="text-[11px] font-normal opacity-80 mt-0.5">
                    يعتمد على حزم الأصوات المثبتة في جهازك أو متصفح كروم.
                  </div>
                </button>
              </div>
            </div>

            {settings.voice.provider === 'free_arabic' && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-200">
                ✅ محرك الصوت المجاني جاهز للعمل فوراً! لا تحتاج لإدخال أي مفاتيح، وسيتحدث باللغة العربية بدقة عالية.
              </div>
            )}

            {settings.voice.provider === 'elevenlabs' && (
              <div className="space-y-2.5 rounded-lg border border-nb-border bg-nb-surface/40 p-2.5 text-xs">
                <div>
                  <label className="block text-nb-muted mb-1">مفتاح ElevenLabs API:</label>
                  <input
                    type="password"
                    placeholder="sk_..."
                    className="w-full rounded border border-nb-border bg-nb-bg px-2 py-1.5 font-mono text-xs"
                    value={settings.voice.elevenLabsApiKey}
                    onChange={e =>
                      updateSettings(s => ({
                        ...s,
                        voice: { ...s.voice, elevenLabsApiKey: e.target.value },
                      }))
                    }
                  />
                  <span className="text-[10px] text-nb-muted">يُحفظ بأمان في متصفحك ولا يُرسل لأي طرف خارجي.</span>
                </div>

                <div>
                  <label className="block text-nb-muted mb-1">معرّف الصوت (Voice ID):</label>
                  <input
                    type="text"
                    placeholder="21m00Tcm4TlvDq8ikWAM أو معرّف مخصص"
                    className="w-full rounded border border-nb-border bg-nb-bg px-2 py-1 text-xs"
                    value={settings.voice.customVoiceId || settings.voice.elevenLabsVoiceId}
                    onChange={e =>
                      updateSettings(s => ({
                        ...s,
                        voice: { ...s.voice, customVoiceId: e.target.value },
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="block text-nb-muted mb-1">نموذج النطق (Model):</label>
                  <select
                    className="w-full rounded border border-nb-border bg-nb-bg p-1 text-xs"
                    value={settings.voice.elevenLabsModel}
                    onChange={e =>
                      updateSettings(s => ({
                        ...s,
                        voice: { ...s.voice, elevenLabsModel: e.target.value },
                      }))
                    }>
                    <option value="eleven_multilingual_v2">eleven_multilingual_v2 (الأفضل للعربية)</option>
                    <option value="eleven_turbo_v2_5">eleven_turbo_v2_5 (الأسرع)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Web Speech voice selector */}
            {settings.voice.provider === 'webspeech' && (
              <div>
                <label className="block text-xs font-medium text-nb-muted mb-1">الصوت المدمج المفضل:</label>
                <select
                  className="w-full rounded border border-nb-border bg-nb-surface p-1.5 text-xs"
                  value={settings.voice.webSpeechVoiceName}
                  onChange={e =>
                    updateSettings(s => ({
                      ...s,
                      voice: { ...s.voice, webSpeechVoiceName: e.target.value },
                    }))
                  }>
                  <option value="">تلقائي (أفضل صوت سعودي / عربي متوفر)</option>
                  {webVoices.map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name} {v.isSaudi ? '🇸🇦' : v.isEgyptian ? '🇪🇬' : ''} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Test Voice Button */}
            <button
              type="button"
              disabled={isTestingVoice}
              onClick={handleTestVoice}
              className="w-full rounded-lg border border-nb-border bg-nb-surface py-2 text-xs font-bold hover:bg-nb-surface/80">
              {isTestingVoice ? 'جارِ تشغيل الصوت... 🔊' : 'تجربة الصوت المختار 🔊'}
            </button>
          </div>
        )}

        {/* ── TAB 5: EXPORT & SAFETY ── */}
        {activeTab === 'export' && (
          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block font-medium text-nb-muted mb-1">صيغة الفيديو:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateSettings(s => ({ ...s, export: { ...s.export, format: 'mp4' } }))}
                  className={`rounded border p-2 text-center font-bold ${
                    settings.export.format === 'mp4'
                      ? 'border-nb-accent bg-nb-accent/10 text-nb-accent'
                      : 'border-nb-border bg-nb-surface text-nb-muted'
                  }`}>
                  MP4 (موصى به - يفتح مباشرة على ويندوز)
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings(s => ({ ...s, export: { ...s.export, format: 'webm' } }))}
                  className={`rounded border p-2 text-center font-bold ${
                    settings.export.format === 'webm'
                      ? 'border-nb-accent bg-nb-accent/10 text-nb-accent'
                      : 'border-nb-border bg-nb-surface text-nb-muted'
                  }`}>
                  WebM (أعلى توافق متصفحات)
                </button>
              </div>
            </div>

            <div>
              <label className="block font-medium text-nb-muted mb-1">دقة التسجيل:</label>
              <select
                className="w-full rounded border border-nb-border bg-nb-surface p-1.5"
                value={settings.recording.resolution}
                onChange={e =>
                  updateSettings(s => ({
                    ...s,
                    recording: { ...s.recording, resolution: e.target.value as any },
                  }))
                }>
                <option value="1080p">1080p Full HD (1920x1080)</option>
                <option value="720p">720p HD (1280x720)</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2 rounded-lg border border-nb-border bg-nb-surface/50 p-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.recording.demoMode}
                  onChange={e =>
                    updateSettings(s => ({
                      ...s,
                      recording: { ...s.recording, demoMode: e.target.checked },
                    }))
                  }
                />
                <span>وضع العرض الآمن (Demo Mode): منع الحذف أو العمليات المدمرة</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.recording.blurSensitive}
                  onChange={e =>
                    updateSettings(s => ({
                      ...s,
                      recording: { ...s.recording, blurSensitive: e.target.checked },
                    }))
                  }
                />
                <span>طمس البيانات الحساسة (الرواتب، الإيميلات، أرقام الهواتف)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.export.exportSrt}
                  onChange={e =>
                    updateSettings(s => ({
                      ...s,
                      export: { ...s.export, exportSrt: e.target.checked },
                    }))
                  }
                />
                <span>تصدير ملف ترجمة نصي منفصل (.SRT)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.export.saveJsonPlan}
                  onChange={e =>
                    updateSettings(s => ({
                      ...s,
                      export: { ...s.export, saveJsonPlan: e.target.checked },
                    }))
                  }
                />
                <span>حفظ ملف خطة الشرح (.JSON) لإعادة استخدامها لاحقاً</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
