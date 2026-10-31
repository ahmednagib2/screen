// Unified TTS Coordinator
// Priority 1: ElevenLabs API (User key, high fidelity)
// Priority 2: Web Speech API / Chrome TTS (free, reliable, neural voices on Edge/Chrome)
// Priority 3: Google Translate TTS (last-resort fallback, unofficial endpoint)
import { synthesizeFreeArabicSpeech, playFreeArabicAudio } from './freetts';
import { synthesizeElevenLabsSpeech } from './elevenlabs';
import { speakViaWebSpeech } from './webspeech';
import type { SynthesizedAudioClip, TutorialStep, VoiceSettings } from '../types';

export interface PreSynthesizeResult {
  clips: Map<string, SynthesizedAudioClip>;
  fallbackNotice?: string;
  hasErrors: boolean;
}

export function normalizeArabicText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\bOdoo\b/gi, 'أودو')
    .replace(/\bERP\b/gi, 'إي آر بي')
    .replace(/\bAPI\b/gi, 'إيه بي آي')
    .replace(/\bID\b/gi, 'آي دي')
    .replace(/\bURL\b/gi, 'يو آر إل')
    .replace(/\bCSV\b/gi, 'سي إس في')
    .replace(/\bPDF\b/gi, 'بي دي إف')
    .replace(/\bOK\b/gi, 'حسناً')
    .replace(/\bClick\b/gi, 'اضغط')
    .trim();
}

export async function preSynthesizeTutorialAudio(
  steps: TutorialStep[],
  settings: VoiceSettings,
  onProgress?: (index: number, total: number) => void
): Promise<PreSynthesizeResult> {
  const clips = new Map<string, SynthesizedAudioClip>();
  let fallbackNotice: string | undefined;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const cleanText = normalizeArabicText(step.narration_text);
    onProgress?.(i + 1, steps.length);
    if (settings.provider === 'elevenlabs' && settings.elevenLabsApiKey?.trim()) {
      try {
        const voiceId = settings.customVoiceId?.trim() || settings.elevenLabsVoiceId;
        const res = await synthesizeElevenLabsSpeech(cleanText, {
          apiKey: settings.elevenLabsApiKey,
          voiceId,
          model: settings.elevenLabsModel,
          stability: settings.stability,
          similarityBoost: settings.similarityBoost,
        });
        if (res.audioBuffer && !res.error) {
          const url = res.audioBlob ? URL.createObjectURL(res.audioBlob) : undefined;
          clips.set(step.id, { stepId: step.id, audioBuffer: res.audioBuffer, audioUrl: url, durationMs: res.durationMs, provider: 'elevenlabs' });
          continue;
        }
        fallbackNotice = `تنبيه: تم التحويل للصوت المجاني بسبب (${res.error || 'خطأ في ElevenLabs'}).`;
      } catch (err) {
        fallbackNotice = `تنبيه: تم التحويل للصوت المجاني (${String(err)}).`;
      }
    }
    try {
      const webSpeechResult = await speakViaWebSpeech(cleanText, { dialect: settings.dialect, preferredVoiceName: settings.webSpeechVoiceName });
      clips.set(step.id, { stepId: step.id, audioBuffer: null, durationMs: webSpeechResult.durationMs, provider: 'webspeech', error: fallbackNotice });
      continue;
    } catch (webSpeechErr) {
      console.warn('Web Speech TTS failed, falling back to Google Translate TTS:', webSpeechErr);
    }
    try {
      const langCode = settings.dialect === 'saudi' ? 'ar-SA' : 'ar';
      const freeRes = await synthesizeFreeArabicSpeech(cleanText, langCode);
      const blob = new Blob([freeRes.audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      clips.set(step.id, { stepId: step.id, audioBuffer: freeRes.audioBuffer, audioUrl, durationMs: freeRes.durationMs, provider: 'free_arabic', error: fallbackNotice });
      continue;
    } catch (freeErr) {
      console.warn('Google Translate TTS also failed:', freeErr);
    }
    const wordCount = cleanText.trim().split(/\s+/).length;
    const estimatedDurationMs = Math.max(3500, Math.round((wordCount / 2.2) * 1000) + 1200);
    clips.set(step.id, { stepId: step.id, audioBuffer: null, durationMs: estimatedDurationMs, provider: 'webspeech', error: fallbackNotice || 'تعذر توليد الصوت، سيتم استخدام مدة تقديرية فقط.' });
  }
  return { clips, fallbackNotice, hasErrors: false };
}

export async function playStepNarration(
  step: TutorialStep,
  clip: SynthesizedAudioClip | undefined,
  settings: VoiceSettings
): Promise<{ durationMs: number }> {
  const cleanText = normalizeArabicText(step.narration_text);
  if (clip?.audioUrl) {
    return new Promise(resolve => {
      const audio = new Audio(clip.audioUrl);
      audio.onended = () => resolve({ durationMs: clip.durationMs });
      audio.onerror = () => {
        void speakViaWebSpeech(cleanText, { dialect: settings.dialect, preferredVoiceName: settings.webSpeechVoiceName }).then(resolve);
      };
      void audio.play().catch(() => {
        void speakViaWebSpeech(cleanText, { dialect: settings.dialect, preferredVoiceName: settings.webSpeechVoiceName }).then(resolve);
      });
    });
  }
  return speakViaWebSpeech(cleanText, { dialect: settings.dialect, preferredVoiceName: settings.webSpeechVoiceName });
}
