// ElevenLabs TTS Client
// Secure API integration with quota/error detection and audio caching.

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
}

export interface SynthesisResult {
  audioBuffer: ArrayBuffer | null;
  audioBlob: Blob | null;
  durationMs: number;
  error?: string;
  errorCode?: number;
}

// In-memory audio cache for the current session: key is hash(text + voiceId)
const audioCache = new Map<string, { buffer: ArrayBuffer; durationMs: number }>();

function computeCacheKey(text: string, voiceId: string, model: string): string {
  return `${voiceId}:${model}:${text.trim()}`;
}

/**
 * Fetch available voices from ElevenLabs account.
 */
export async function getElevenLabsVoices(apiKey: string): Promise<{ ok: boolean; voices: ElevenLabsVoice[]; error?: string }> {
  if (!apiKey?.trim()) {
    return { ok: false, voices: [], error: 'مفتاح ElevenLabs API غير محدد' };
  }

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey.trim(),
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401) return { ok: false, voices: [], error: 'مفتاح API غير صالح (401 Unauthorized)' };
      if (res.status === 402) return { ok: false, voices: [], error: 'تم استهلاك رصيد حساب ElevenLabs بالكامل (402 Quota Exceeded)' };
      if (res.status === 429) return { ok: false, voices: [], error: 'تم تجاوز حد الطلبات مؤقتاً (429 Rate Limited)' };
      return { ok: false, voices: [], error: `خطأ في ElevenLabs: ${res.status} ${res.statusText}` };
    }

    const data = (await res.json()) as { voices?: ElevenLabsVoice[] };
    return { ok: true, voices: data.voices || [] };
  } catch (err) {
    return { ok: false, voices: [], error: `تعذر الاتصال بـ ElevenLabs: ${String(err)}` };
  }
}

/**
 * Synthesizes text to speech with ElevenLabs.
 * Automatically caches audio and measures duration in milliseconds.
 */
export async function synthesizeElevenLabsSpeech(
  text: string,
  options: {
    apiKey: string;
    voiceId: string;
    model?: string;
    stability?: number;
    similarityBoost?: number;
  },
): Promise<SynthesisResult> {
  const { apiKey, voiceId, model = 'eleven_multilingual_v2', stability = 0.5, similarityBoost = 0.75 } = options;

  if (!apiKey?.trim()) {
    return { audioBuffer: null, audioBlob: null, durationMs: 0, error: 'مفتاح ElevenLabs API فارغ', errorCode: 401 };
  }

  const cacheKey = computeCacheKey(text, voiceId, model);
  if (audioCache.has(cacheKey)) {
    const cached = audioCache.get(cacheKey)!;
    const blob = new Blob([cached.buffer], { type: 'audio/mpeg' });
    return { audioBuffer: cached.buffer, audioBlob: blob, durationMs: cached.durationMs };
  }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey.trim(),
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      let msg = `ElevenLabs error ${res.status}`;
      if (res.status === 401) msg = 'مفتاح ElevenLabs API غير صالح (401)';
      else if (res.status === 402) msg = 'نفد رصيد ElevenLabs المتاح لهذا الحساب (402 Quota)';
      else if (res.status === 429) msg = 'تجاوز حد الطلبات في ElevenLabs (429 Rate Limit)';
      return { audioBuffer: null, audioBlob: null, durationMs: 0, error: msg, errorCode: res.status };
    }

    const arrayBuffer = await res.arrayBuffer();

    // Measure exact duration using Web Audio AudioContext
    let durationMs = Math.max(3000, text.length * 90);
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      durationMs = Math.round(decoded.duration * 1000);
      await audioCtx.close().catch(() => undefined);
    } catch {
      // Fallback duration estimate based on word count
      const wordCount = text.trim().split(/\s+/).length;
      durationMs = Math.max(2500, Math.round((wordCount / 2.5) * 1000));
    }

    audioCache.set(cacheKey, { buffer: arrayBuffer, durationMs });
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });

    return { audioBuffer: arrayBuffer, audioBlob: blob, durationMs };
  } catch (err) {
    return { audioBuffer: null, audioBlob: null, durationMs: 0, error: `فشل الاتصال بـ ElevenLabs: ${String(err)}` };
  }
}

/**
 * Play an audio buffer through the speakers for preview/testing.
 */
export async function playAudioBuffer(buffer: ArrayBuffer): Promise<void> {
  const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(buffer.slice(0));
  const source = audioCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(audioCtx.destination);
  source.start(0);

  return new Promise(resolve => {
    source.onended = () => {
      void audioCtx.close().catch(() => undefined);
      resolve();
    };
  });
}
