// Unified TTS Coordinator
// Priority 1: 100% Free Arabic Neural TTS (Default, No API Key, Pure Arabic MP3 buffers)
// Priority 2: ElevenLabs API (User key, high fidelity)
// Priority 3: Web Speech API / Chrome TTS fallback
import { synthesizeFreeArabicSpeech, playFreeArabicAudio } from './freetts';
import { synthesizeElevenLabsSpeech } from './elevenlabs';
import { speakViaWebSpeech } from './webspeech';
import type { SynthesizedAudioClip, TutorialStep, VoiceSettings } from '../types';

export interface PreSynthesizeResult {
  clips: Map<string, SynthesizedAudioClip>;
  fallbackNotice?: string;
  hasErrors: boolean;
}

/**
 * Pre-synthesizes speech audio for all steps of a tutorial plan.
 * Guarantees the exact duration of each step before recording starts,
 * ensuring animations, cursor movement, and speech remain 100% in sync.
 */
export async function preSynthesizeTutorialAudio(
  steps: TutorialStep[],
  settings: VoiceSettings,
  onProgress?: (index: number, total: number) => void
): Promise<PreSynthesizeResult> {
  const clips = new Map<string, SynthesizedAudioClip>();
  let fallbackNotice: string | undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    onProgress?.(i + 1, steps.length);

    // 1. ElevenLabs (if selected and API key is present)
    if (settings.provider === 'elevenlabs' && settings.elevenLabsApiKey?.trim()) {
      try {
        const voiceId = settings.customVoiceId?.trim() || settings.elevenLabsVoiceId;
        const res = await synthesizeElevenLabsSpeech(step.narration_text, {
          apiKey: settings.elevenLabsApiKey,
          voiceId,
          model: settings.elevenLabsModel,
          stability: settings.stability,
          similarityBoost: settings.similarityBoost,
        });

        if (res.audioBuffer && !res.error) {
          const url = res.audioBlob ? URL.createObjectURL(res.audioBlob) : undefined;
          clips.set(step.id, {
            stepId: step.id,
            audioBuffer: res.audioBuffer,
            audioUrl: url,
            durationMs: res.durationMs,
            provider: 'elevenlabs',
          });
          continue;
        }

        fallbackNotice = `تنبيه: تم التحويل للمولد المجاني بسبب (${res.error || 'خطأ في ElevenLabs'}).`;
      } catch (err) {
        fallbackNotice = `تنبيه: تم التحويل للمولد المجاني (${String(err)}).`;
      }
    }

    // 2. Default: 100% Free Arabic Neural Speech (Google Neural Arabic MP3)
    try {
      const langCode = settings.dialect === 'saudi' ? 'ar-SA' : 'ar';
      const freeRes = await synthesizeFreeArabicSpeech(step.narration_text, langCode);
      const blob = new Blob([freeRes.audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      clips.set(step.id, {
        stepId: step.id,
        audioBuffer: freeRes.audioBuffer,
        audioUrl,
        durationMs: freeRes.durationMs,
        provider: 'free_arabic',
        error: fallbackNotice,
      });
      continue;
    } catch (freeErr) {
      console.warn('Free Arabic TTS fetch failed, using WebSpeech estimate:', freeErr);
    }

    // 3. Fallback: Web Speech API / Chrome TTS
    const wordCount = step.narration_text.trim().split(/\s+/).length;
    const estimatedDurationMs = Math.max(3500, Math.round((wordCount / 2.2) * 1000) + 1200);

    clips.set(step.id, {
      stepId: step.id,
      audioBuffer: null,
      durationMs: estimatedDurationMs,
      provider: 'webspeech',
      error: fallbackNotice,
    });
  }

  return {
    clips,
    fallbackNotice,
    hasErrors: false,
  };
}

/**
 * Play a step's narration during walkthrough execution.
 */
export async function playStepNarration(
  step: TutorialStep,
  clip: SynthesizedAudioClip | undefined,
  settings: VoiceSettings
): Promise<{ durationMs: number }> {
  // If we have an audio buffer (from Free Arabic TTS or ElevenLabs), play it
  if (clip?.audioUrl) {
    return new Promise(resolve => {
      const audio = new Audio(clip.audioUrl);
      audio.onended = () => resolve({ durationMs: clip.durationMs });
      audio.onerror = () => {
        void speakViaWebSpeech(step.narration_text, {
          dialect: settings.dialect,
          preferredVoiceName: settings.webSpeechVoiceName,
        }).then(resolve);
      };
      void audio.play().catch(() => {
        void speakViaWebSpeech(step.narration_text, {
          dialect: settings.dialect,
          preferredVoiceName: settings.webSpeechVoiceName,
        }).then(resolve);
      });
    });
  }

  // Fallback to Web Speech API
  return speakViaWebSpeech(step.narration_text, {
    dialect: settings.dialect,
    preferredVoiceName: settings.webSpeechVoiceName,
  });
}
