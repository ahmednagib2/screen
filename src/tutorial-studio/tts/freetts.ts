// Tutorial Studio: 100% Free Arabic Neural TTS Engine
// Uses Google's Neural TTS for natural Arabic speech synthesis.
// Requires NO API KEY, completely free, returns true MP3 audio buffers,
// and routes audio directly into the WebAudio video recorder destination.

const freeAudioCache = new Map<string, ArrayBuffer>();

/**
 * Split long Arabic text into natural speech chunks (up to 180 characters)
 * splitting on punctuation (، . ! ؟) or whitespace.
 */
export function splitArabicTextIntoChunks(text: string, maxLength = 180): string[] {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= maxLength) return [cleaned];

  const chunks: string[] = [];
  const sentences = cleaned.split(/([،.!?؟\n]+)/);
  let currentChunk = '';

  for (let i = 0; i < sentences.length; i++) {
    const part = sentences[i];
    if (!part) continue;

    if ((currentChunk + part).length <= maxLength) {
      currentChunk += part;
    } else {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      // If single sentence part is longer than maxLength, split by words
      if (part.length > maxLength) {
        const words = part.split(' ');
        let wordChunk = '';
        for (const word of words) {
          if ((wordChunk + ' ' + word).length <= maxLength) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) chunks.push(wordChunk);
            wordChunk = word;
          }
        }
        currentChunk = wordChunk;
      } else {
        currentChunk = part;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * Fetch a single MP3 audio chunk from Google Translate TTS.
 */
async function fetchGoogleTtsChunk(text: string, lang = 'ar'): Promise<ArrayBuffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(
    lang
  )}&client=tw-ob&q=${encodeURIComponent(text)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'audio/mpeg, audio/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Free TTS fetch failed with HTTP ${response.status}`);
  }

  return response.arrayBuffer();
}

/**
 * Combine multiple MP3 ArrayBuffers into a single continuous ArrayBuffer.
 */
function concatenateArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((acc, b) => acc + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    result.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return result.buffer;
}

/**
 * Synthesize complete Arabic speech for a narration step.
 * Returns the raw MP3 ArrayBuffer and the exact duration in milliseconds.
 */
export async function synthesizeFreeArabicSpeech(
  text: string,
  lang = 'ar'
): Promise<{ audioBuffer: ArrayBuffer; durationMs: number }> {
  const cacheKey = `${lang}:${text.trim()}`;
  const cached = freeAudioCache.get(cacheKey);

  let rawBuffer: ArrayBuffer;

  if (cached) {
    rawBuffer = cached;
  } else {
    const chunks = splitArabicTextIntoChunks(text);
    const audioChunks: ArrayBuffer[] = [];

    for (const chunk of chunks) {
      const buf = await fetchGoogleTtsChunk(chunk, lang);
      audioChunks.push(buf);
    }

    rawBuffer = concatenateArrayBuffers(audioChunks);
    freeAudioCache.set(cacheKey, rawBuffer);
  }

  // Decode via WebAudio to calculate exact playback duration
  let durationMs = 5000;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const decoded = await ctx.decodeAudioData(rawBuffer.slice(0));
    durationMs = Math.max(2500, Math.ceil(decoded.duration * 1000) + 400);
    void ctx.close().catch(() => undefined);
  } catch {
    // Estimate fallback duration based on Arabic word count (~150 words per minute)
    const wordCount = text.split(/\s+/).length;
    durationMs = Math.max(3000, Math.round((wordCount / 2.2) * 1000));
  }

  return { audioBuffer: rawBuffer, durationMs };
}

/**
 * Play the synthesized MP3 buffer live to speakers and route it
 * directly to the WebAudio MediaStreamDestination so it is recorded in the video.
 */
export async function playFreeArabicAudio(
  audioBuffer: ArrayBuffer,
  audioDestination?: MediaStreamAudioDestinationNode,
  externalAudioContext?: AudioContext
): Promise<void> {
  const ctx =
    externalAudioContext ||
    new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  const decoded = await ctx.decodeAudioData(audioBuffer.slice(0));
  const source = ctx.createBufferSource();
  source.buffer = decoded;

  // 1. Play live to speakers
  source.connect(ctx.destination);

  // 2. Mix into video recorder audio destination if active
  if (audioDestination) {
    source.connect(audioDestination);
  }

  source.start(0);

  return new Promise(resolve => {
    source.onended = () => {
      if (!externalAudioContext) {
        void ctx.close().catch(() => undefined);
      }
      resolve();
    };
  });
}
