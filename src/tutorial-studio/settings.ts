// Tutorial Studio: Settings & Storage Manager
// Stored securely in chrome.storage.local, never logged or exposed.
import type { ArabicDialect, TutorialStudioSettings, VoiceSettings } from './types';

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  provider: 'free_arabic',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel / default multilingual
  elevenLabsModel: 'eleven_multilingual_v2',
  stability: 0.5,
  similarityBoost: 0.75,
  dialect: 'msa',
  customVoiceId: '',
  webSpeechVoiceName: '',
};

export const DEFAULT_TUTORIAL_SETTINGS: TutorialStudioSettings = {
  voice: DEFAULT_VOICE_SETTINGS,
  recording: {
    resolution: '1080p',
    frameRate: 30,
    bitrateMbps: 8,
    countdownSec: 3,
    demoMode: true,
    blurSensitive: false,
  },
  export: {
    format: 'mp4',
    includeCaptionsBurnIn: true,
    exportSrt: false,
    saveJsonPlan: false,
  },
};

const STORAGE_KEY = 'nb.tutorialStudio.settings';

export const DIALECT_PRESETS: Record<ArabicDialect, { nameAr: string; nameEn: string; promptGuide: string }> = {
  msa: {
    nameAr: 'اللغة العربية الفصحى (رسمية ونقية - فصحى متقنة)',
    nameEn: 'Modern Standard Arabic (MSA)',
    promptGuide:
      'اكتب الشرح باللغة العربية الفصحى السليمة الخالية تماماً من العامية، بلغة تدريبية رسمية راقية وواضحة (مثل: مرحباً بكم. نستعرض معكم اليوم موديول... نبدأ أولاً بالضغط على زر جديد... يتيح لنا هذا النموذج إدخال البيانات وتحديث السجلات تلقائياً).',
  },
  saudi: {
    nameAr: 'العربية (اللهجة السعودية البيضاء للأعمال)',
    nameEn: 'Arabic (Saudi Business Dialect)',
    promptGuide:
      'اكتب الشرح باللغة العربية بأسلوب سعودي راقٍ ومهني للأعمال (مثل: حيّاكم الله وأهلاً وسهلاً بكم، نستعرض معكم اليوم موديول... نبدأ بالتوجه والضغط على زر جديد... ونقدر نتابع السجلات بكل سهولة وبكذا تكون اكتملت الخطوة).',
  },
  egyptian: {
    nameAr: 'العربية (اللهجة المصرية)',
    nameEn: 'Arabic (Egyptian Dialect)',
    promptGuide:
      'اكتب الشرح باللغة العربية باللهجة المصرية المحترفة والواضحة (مثل: أهلاً بحضراتكم، هنشرح دلوقتي إزاي نستخدم... هنبدأ أول حاجة بالضغط على... ومن هنا نقدر نتابع... وبكده نكون خلصنا الخطوة دي ببساطة). اشرح ليه بنعمل الخطوة دي وفايدتها في الشغل.',
  },
  english: {
    nameAr: 'الإنجليزية (English)',
    nameEn: 'English',
    promptGuide:
      'Write the narration in friendly, clear, professional English. Explain WHY each feature is used (e.g. "Welcome everyone! Today we will walk through the... Let us start by clicking on... This allows us to track... and just like that, we have completed this step.").',
  },
  custom: {
    nameAr: 'مخصص (Custom)',
    nameEn: 'Custom Dialect',
    promptGuide:
      'اكتب الشرح باللغة والأسلوب المطلوب بوضوح واشرح أسباب استخدام كل خاصية.',
  },
};

export async function getTutorialStudioSettings(): Promise<TutorialStudioSettings> {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    const stored = res[STORAGE_KEY] as Partial<TutorialStudioSettings> | undefined;
    if (!stored) return DEFAULT_TUTORIAL_SETTINGS;
    return {
      voice: { ...DEFAULT_TUTORIAL_SETTINGS.voice, ...(stored.voice || {}) },
      recording: { ...DEFAULT_TUTORIAL_SETTINGS.recording, ...(stored.recording || {}) },
      export: { ...DEFAULT_TUTORIAL_SETTINGS.export, ...(stored.export || {}) },
    };
  } catch {
    return DEFAULT_TUTORIAL_SETTINGS;
  }
}

export async function saveTutorialStudioSettings(settings: TutorialStudioSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}
