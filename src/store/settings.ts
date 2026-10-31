// Settings, provider configurations and API keys in chrome.storage.local. Keys sit under a key of their own: they
// are never exported and never logged.
import type { ProviderKind } from '../llm/providers';
import { resolveProfile } from '../llm/profiles';
import type { LearntFacts } from '../llm/profiles';
import type { ReasoningEffort, ReasoningSupport } from '../llm/catalogue';
import { createStorage } from './storage';
import type { LivePair, ModelRef, PermissionMode } from './types';

export type UiLanguage = 'auto' | 'en' | 'zh_CN' | 'zh_TW' | 'ar';
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  defaultMode: PermissionMode;
  defaultModel: ModelRef | null;
  /** The effort for new conversations on a model that reasons; the latest choice in a picker. */
  reasoning: ReasoningEffort;
  turnCap: number;
  /** Custom instructions; at most CUSTOM_INSTRUCTIONS_MAX characters reach the prompt. */
  customInstructions: string;
  theme: Theme;
  uiLanguage: UiLanguage;
  /** 'auto': answer in the language of the user's message. */
  responseLanguage: string;
  /** The active memory profile id. */
  activeMemoryProfile?: string;
  /** The voice model for voice input, from an OpenAI or Gemini provider; null until one is chosen. */
  voiceModel: ModelRef | null;
  /** The language spoken for voice input, as a BCP 47 tag; 'auto' lets the voice model detect it. */
  dictationLanguage: string;
  /** The first-use notice for Auto mode was shown. */
  autoNoticeShown: boolean;
  /** What to do with the tabs the agent opened when a conversation ends. */
  agentTabsOnEnd: 'ask' | 'close' | 'keep';
  onboarded: boolean;
  /** The anonymous daily ping that counts active users. */
  analyticsPing: boolean;
  /** The daily usage counts. */
  analyticsStats: boolean;
  /** A glowing border on the pages a working run acts on. */
  pageBorder: boolean;
  /** Video Tutorial Studio settings */
  tutorialVoiceRate: number;
  tutorialMinPauseSec: number;
  tutorialEnableVoice: boolean;
  tutorialEnableSubtitles: boolean;
  tutorialSaveFolder: string;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultMode: 'ask',
  defaultModel: null,
  reasoning: 'medium',
  turnCap: 100,
  customInstructions: '',
  theme: 'system',
  uiLanguage: 'ar',
  responseLanguage: 'Arabic',
  activeMemoryProfile: 'general',
  voiceModel: null,
  dictationLanguage: 'auto',
  autoNoticeShown: false,
  agentTabsOnEnd: 'ask',
  onboarded: false,
  analyticsPing: true,
  analyticsStats: true,
  pageBorder: true,
  tutorialVoiceRate: 0.85,
  tutorialMinPauseSec: 8,
  tutorialEnableVoice: true,
  tutorialEnableSubtitles: true,
  tutorialSaveFolder: 'Downloads',
};

/** Stored settings over the defaults, so a field added later has its default. */
export function mergeSettings(stored: unknown): Settings {
  return { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? (stored as Partial<Settings>) : {}) };
}

export const settingsStorage = createStorage<Settings>('nb.settings', DEFAULT_SETTINGS, {
  liveUpdate: true,
  merge: mergeSettings,
});

export type { ProviderKind };

/** Overrides of a model's profile; Settings has no control for them, the checks set them. */
export interface ProfileOverrides {
  contextWindow?: number;
  maxOutput?: number;
  vision?: boolean;
}

export interface ModelEntry {
  name: string;
  overrides?: ProfileOverrides;
  /** Detected from a local server; only ever lowers the window. */
  detectedContext?: number;
  /** Test models found no tool calling; the model cannot be chosen for the agent. */
  noToolCalling?: boolean;
  /** What the model's API said at the last test; replaced whole at each test. */
  fromApi?: LearntFacts;
  /** What a probe or a run's fallback found; a field changes only with a new answer. */
  tested?: LearntFacts;
  /** An older version's probe value, read once as `tested` and not written again. */
  reasoningSupport?: ReasoningSupport;
}

/**
 * The two records of what was learnt about a model, with an older version's `reasoningSupport` read as `tested`:
 * `none` as "reasons: no", `optional` as "reasons", since that probe never proved None.
 */
export function learnt(model: ModelEntry): { fromApi?: LearntFacts; tested?: LearntFacts } {
  const legacy =
    model.reasoningSupport && model.tested?.reasons === undefined
      ? { reasons: model.reasoningSupport !== 'none', at: '' }
      : undefined;
  const tested = legacy ? { ...legacy, ...model.tested } : model.tested;
  return { ...(model.fromApi ? { fromApi: model.fromApi } : {}), ...(tested ? { tested } : {}) };
}

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  name: string;
  baseUrl?: string;
  models: ModelEntry[];
}

export const providersStorage = createStorage<ProviderConfig[]>('nb.providers', [], { liveUpdate: true });

/** API keys by provider id. Never exported, never logged, never sent anywhere but to their provider. */
export const keysStorage = createStorage<Record<string, string>>('nb.keys', {}, { liveUpdate: true });

export const LOCAL_KINDS: ReadonlySet<ProviderKind> = new Set(['ollama', 'lmstudio']);

/**
 * A provider with a new base URL. What was learnt about its models describes the old server, so the detected window,
 * the tool-calling mark and the reasoning probe's value are cleared.
 */
export function withBaseUrl(provider: ProviderConfig, baseUrl: string): ProviderConfig {
  if ((provider.baseUrl ?? '') === baseUrl) return provider;
  return {
    ...provider,
    baseUrl,
    models: provider.models.map(({ name, overrides }) => ({ name, ...(overrides ? { overrides } : {}) })),
  };
}

/**
 * Keeps facts a run learnt about a model in its `tested` record, unless the provider's base URL changed since, since
 * they describe the server the run talked to.
 */
export async function learnFacts(
  providerId: string,
  baseUrl: string | undefined,
  modelName: string,
  facts: Omit<LearntFacts, 'at'>,
): Promise<void> {
  await providersStorage.set(list =>
    list.map(p =>
      p.id !== providerId || (p.baseUrl ?? '') !== (baseUrl ?? '')
        ? p
        : {
            ...p,
            models: p.models.map(m =>
              m.name === modelName ? { ...m, tested: { ...m.tested, ...facts, at: new Date().toISOString() } } : m,
            ),
          },
    ),
  );
}

/** A live conversation's pair in `chrome.storage.session`; only the worker writes it. */
export const liveKey = (conversationId: string) => `nb.live.${conversationId}`;

export async function getLive(conversationId: string): Promise<LivePair | undefined> {
  const key = liveKey(conversationId);
  return (await chrome.storage.session.get(key))[key] as LivePair | undefined;
}

export async function setLive(conversationId: string, pair: LivePair): Promise<void> {
  await chrome.storage.session.set({ [liveKey(conversationId)]: pair });
}

export async function removeLive(conversationId: string): Promise<void> {
  await chrome.storage.session.remove(liveKey(conversationId));
}

export function findProvider(providers: ProviderConfig[], id: string): ProviderConfig | null {
  return providers.find(p => p.id === id) ?? null;
}

export function findModel(
  providers: ProviderConfig[],
  ref: ModelRef | null | undefined,
): { provider: ProviderConfig; model: ModelEntry } | null {
  if (!ref) return null;
  const provider = providers.find(p => p.id === ref.providerId);
  const model = provider?.models.find(m => m.name === ref.model);
  return provider && model ? { provider, model } : null;
}

/**
 * The model a conversation uses: the first of `wanted` that is configured and passed the tool test, else the first
 * such model. Null only when there is none. The panel's picker follows the same rule.
 */
export function usableModel(
  providers: ProviderConfig[],
  ...wanted: Array<ModelRef | null | undefined>
): ModelRef | null {
  for (const ref of wanted) {
    const found = findModel(providers, ref);
    if (found && !found.model.noToolCalling) return { providerId: found.provider.id, model: found.model.name };
  }
  for (const p of providers) {
    const m = p.models.find(x => !x.noToolCalling);
    if (m) return { providerId: p.id, model: m.name };
  }
  return null;
}

/** Whether a configured model reasons: what Test models learnt, else the catalogue. */
export function capabilityOf(
  providers: ProviderConfig[],
  ref: ModelRef | null | undefined,
): ReasoningSupport | undefined {
  const found = findModel(providers, ref);
  if (!found) return undefined;
  return resolveProfile({
    kind: found.provider.kind,
    modelName: found.model.name,
    baseUrl: found.provider.baseUrl,
    ...learnt(found.model),
  }).reasoning;
}

/** A site's rule: one map, keyed with `siteOf`, one rule per site. */
export type SiteRule = 'allow' | 'ask' | 'block';

export interface SiteRuleEntry {
  rule: SiteRule;
  setAt: string;
}

export const siteRulesStorage = createStorage<Record<string, SiteRuleEntry>>('nb.siteRules', {}, { liveUpdate: true });

export interface SiteMemoryEntry {
  site: string;
  notes: string;
  updatedAt: string;
}

export const siteMemoryStorage = createStorage<Record<string, SiteMemoryEntry>>('nb.siteMemory', {}, { liveUpdate: true });

export interface MemoryProfile {
  id: string;
  name: string;
  icon: string;
  description: string;
  instructions: string;
  isBuiltin?: boolean;
}

export const DEFAULT_MEMORY_PROFILES: MemoryProfile[] = [
  {
    id: 'general',
    name: 'عام وشامل ⚡',
    icon: '⚡',
    description: 'مساعد تصفح ذكي شامل ينفذ جميع الأوامر بمرونة وفهم عميق للغة العربية وسياق المواقع.',
    instructions: 'أنت مساعد تصفح فائق الذكاء. تفهم رغبة المستخدم بدقة، وتتعامل مع جميع واجهات الويب باحترافية وسرعة. أجب دائماً بالعربية الفصحى الواضحة والمنظمة.',
    isBuiltin: true,
  },
  {
    id: 'tutorial',
    name: 'شروحات مصورة ودروس 🎓',
    icon: '🎓',
    description: 'متخصص في إعداد الشروحات المصورة والتعليمية خطوة بخطوة بالفيديو والصوت السعودي أو لقطات الشاشة.',
    instructions: `أنت خبير إعداد الشروحات والدروس التعليمية التفاعلية لنظام أودو وكافة الأنظمة.
عند طلب شرح أو تسجيل فيديو:
1. استخدم فوراً أداة record_video_tutorial لبدء تسجيل الشرح الحي على التبويب.
2. التعليق الصوتي (narration): يجب أن يكون باللغة العربية بـ "اللهجة السعودية البيضاء للأعمال" الراقية والواضحة (مثال: "يا هلا ومرحباً بكم... بنشرح لكم اليوم مديول... بنبدأ أول شي نضغط على... وتقدرون من هنا تشوفون...").
3. الشرح يجب أن يكون كاملاً ومفصلاً وشاملاً لكافة أقسام المديول من البداية للنهاية (بين 6 إلى 9 خطوات تفصيلية متسلسلة) تشمل الواجهة، الفلاتر، إنشاء سجل جديد، تعبئة الحقول، والحفظ والتأكيد.
4. إياك والتوقف أو السؤال أو اقتراح مديول آخر كـ eLearning، بل نفذ الشرح مباشرة.`,
    isBuiltin: true,
  },
  {
    id: 'tasks',
    name: 'إدارة المهام والأنظمة 📋',
    icon: '📋',
    description: 'خبير إدارة أنظمة الشركات مثل Odoo, ERP, CRM، وإدخال البيانات وإدارة الصلاحيات والأدوار بدقة متناهية.',
    instructions: 'أنت متخصص محترف في إدارة أنظمة الأعمال وأنظمة تخطيط الموارد (مثل Odoo, ERP, CRM, لوحات التحكم الإدارية). تفهم مصطلحات الأدوار والصلاحيات (Access Roles, Groups, Users, Rules)، وتتعامل مع الجداول والنماذج بحذر شديد ودقة متناهية. لا تحذف أو تعدل أي إعدادات حساسة إلا بعد التأكد، وتأكد من حفظ التغييرات وتأكيد نجاح السجلات وإظهار ملخص تنفيذي لما تم إنجازه.',
    isBuiltin: true,
  },
  {
    id: 'social',
    name: 'النشر وإدارة الحسابات 🚀',
    icon: '🚀',
    description: 'متخصص في أتمتة حسابات التواصل الاجتماعي، جدولة ونشر المنشورات، ورفع الوسائط بأمان.',
    instructions: 'أنت خبير إدارة وأتمتة النشر عبر منصات الويب وشبكات التواصل الاجتماعي. عند إعداد أو نشر أي محتوى، نسّق النص بعناية، وتأكد من ملء حقول العنوان والوصف والوسوم بدقة، وارفع الصور المطلوبة، ولا تضغط على أزرار النشر النهائي (Publish/Post) إلا بعد التأكد من اكتمال كافة متطلبات المنشور.',
    isBuiltin: true,
  },
  {
    id: 'scraping',
    name: 'استخراج وبحث عميق 📊',
    icon: '📊',
    description: 'خبير استخراج البيانات من المواقع ومقارنة الأسعار وتصدير الجداول إلى Excel / CSV.',
    instructions: 'أنت خبير استخراج البيانات والبحث العميق (Web Scraping & Analysis). استخدم أداة extract_data لاستخراج الجداول، وقوائم المنتجات، والأسعار، والمواصفات من صفحات الويب، وقم بتنزيلها كملفات CSV/Excel، وقدم للمستخدم تحليلاً إحصائياً مقارناً لأفضل الخيارات وأرخص الأسعار.',
    isBuiltin: true,
  },
  {
    id: 'odoo-video-director',
    name: 'صانع ومسجل شروحات أودو بالفيديو 🎥',
    icon: '🎥',
    description: 'مخرج ومسجل شروحات فيديو تفاعلية لنظام أودو باللهجة السعودية مع تعليق صوتي ورسومات وتنزيل الفيديو.',
    instructions: `أنت مخرج ومسجل شروحات فيديو تعليمية محترف وخبير معتمد في نظام أودو (Odoo) بمختلف مديولاته (الجداول الزمنية، الإجازات، التقويم، المحاسبة، المبيعات، المشاريع، المخازن، الدعم الفني، إلخ).

قواعد العمل الإلزامية لإنتاج الفيديوهات والشروحات الاحترافية:
1. مرحلة الاستكشاف والفهم أولاً (Deep Understanding & Inspection First):
   عندما يطلب منك المستخدم استكشاف أو فهم موديول، قم أولاً بفحص الصفحة وقراءة عناصرها وأزرارها وحقولها، واشرح له باختصار وثقة أنك فهمت الموديول وعناصره وأصبحت جاهزاً 100% لبدء تصوير الفيديو التعليمي فور إشارته.
2. التنفيذ الفوري عند طلب التسجيل (Instant Video Production):
   عندما يقول المستخدم "ابدأ" أو "سجل الفيديو" أو "اشرح الآن"، استخدم فوراً أداة record_video_tutorial لتسجيل الشرح الحي، ولا تتوقف لتسأل ولا تقترح eLearning نهائياً.
3. لغة وصوت التعليق (narration):
   يجب أن تكون النصوص المنطوقة بالكامل باللغة العربية الفصحى السليمة أو "اللهجة السعودية البيضاء للأعمال" الراقية والمفهومة (مثال: "حيّاكم الله وأهلاً وسهلاً بكم... نستعرض معكم اليوم موديول... أول خطوة نتوجه بالضغط على زر جديد... ومن هنا نقدر نحدد... وبكذا نكون انتهينا وحفظنا السجل"). ممنوع تماماً استخدام الإنجليزية في التعليق أو الترجمة.
4. تسجيل محتوى التبويب فقط (Tab-Only Recording):
   يتم تسجيل محتوى صفحة أودو فقط دون إظهار نافذة المحادثة أو الإضافة الجانبية إطلاقاً.
5. التحكم البصري والتكبير الذكي (Cinematic Dynamic Zoom & Pointer):
   - يتم عمل زوم ان (Zoom In 1.2x) تلقائياً على العنصر أو الزر أثناء الشرح، مع عودة انسيابية (Zoom Out).
   - يتحرك مؤشر ماوس حقيقي بسلاسة نحو الأزرار وينقر عليها نقراً واقعياً لفتح النماذج.
   - تحديد هادئ وأسهم توجيهية ناعمة ومنظمة (ممنوع منعاً باتاً وضع أي دوائر حمراء ضخمة أو خطوط متقطعة تلف حول الشاشة).
   - شريط ترجمة زجاجي سفلي أنيق متناسق مع الصوت.
6. شمولية الشرح (Full Comprehensive Walkthrough):
   يجب أن يغطي الشرح المديول بالكامل من البداية للنهاية في شكل (6 إلى 9 خطوات) تشمل:
   - الخطوة 1: مقدمة ترحيبية واستعراض لوحة المديول وأقسامه.
   - الخطوة 2: استعراض طرق العرض (العرض الشبكي Grid، القائمة List، أو التقويم Calendar) والفلاتر.
   - الخطوة 3: النقر على زر "جديد (New / Create)" للبدء بإضافة بيان جديد.
   - الخطوة 4 و 5: شرح الحقول الإلزامية والمهمة وتعبئتها.
   - الخطوة 6: استخدام ميزة متقدمة (مثل المؤقت، أو الاعتماد Approval، أو المرفقات).
   - الخطوة 7: حفظ السجل وتأكيد اكتماله.
   - الخطوة 8: خاتمة وتلخيص لنصائح العمل الاحترافية.
7. اضبط دائماً: enableVoice: true, enableSubtitles: true, recordVideo: true.`,
    isBuiltin: true,
  },
];

export function mergeMemoryProfiles(stored: unknown): MemoryProfile[] {
  if (!Array.isArray(stored)) return DEFAULT_MEMORY_PROFILES;
  const list = [...(stored as MemoryProfile[])];
  for (const def of DEFAULT_MEMORY_PROFILES) {
    const idx = list.findIndex(p => p.id === def.id);
    if (idx === -1) {
      list.push(def);
    } else if (def.isBuiltin) {
      list[idx] = { ...list[idx], ...def, instructions: def.instructions, name: def.name, description: def.description };
    }
  }
  return list;
}

export const memoryProfilesStorage = createStorage<MemoryProfile[]>('nb.memoryProfiles', DEFAULT_MEMORY_PROFILES, {
  liveUpdate: true,
  merge: mergeMemoryProfiles,
});

export const activeMemoryProfileStorage = createStorage<string>('nb.activeMemoryProfile', 'general', {
  liveUpdate: true,
});

/**
 * Resolves the full system prompt instructions including the active memory profile and custom instructions.
 */
export async function resolveFullInstructions(customInstructions?: string, profileId?: string): Promise<string> {
  const currentProfileId = profileId || (await activeMemoryProfileStorage.get()) || 'general';
  const profiles = (await memoryProfilesStorage.get()) || DEFAULT_MEMORY_PROFILES;
  const activeProfile = profiles.find(p => p.id === currentProfileId) || profiles[0];
  const parts: string[] = [];
  if (activeProfile) {
    parts.push(`[وضع الذاكرة والعمل المختار: ${activeProfile.name}]\n${activeProfile.instructions}`);
  }
  if (customInstructions && customInstructions.trim()) {
    parts.push(`[تعليمات مخصصة عامة]:\n${customInstructions.trim()}`);
  }
  return parts.join('\n\n');
}

/**
 * The policy for a classified write: a site's rule decides, otherwise the mode. A pure function of two values.
 */
export function decideWrite(mode: PermissionMode, rule: 'allow' | 'ask' | undefined): 'run' | 'ask' {
  if (rule) return rule === 'allow' ? 'run' : 'ask';
  return mode === 'auto' ? 'run' : 'ask';
}
