// Web Speech API & Chrome TTS Provider
// High reliability free fallback with dialect awareness (Saudi, Egyptian, MSA, English).
import type { ArabicDialect } from '../types';

export interface WebSpeechVoice {
  name: string;
  lang: string;
  isSaudi: boolean;
  isEgyptian: boolean;
  isArabic: boolean;
}

export async function getAvailableWebSpeechVoices(): Promise<WebSpeechVoice[]> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return resolve([]);
    }

    const check = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const mapped = voices.map(v => {
          const lang = (v.lang || '').toLowerCase().replace('_', '-');
          const name = (v.name || '').toLowerCase();
          const isSaudi = lang === 'ar-sa' || name.includes('naayf') || name.includes('hamed') || name.includes('zari') || name.includes('saudi');
          const isEgyptian = lang === 'ar-eg' || name.includes('egypt') || name.includes('hoda') || name.includes('shakir');
          const isArabic = lang.startsWith('ar') || name.includes('arabic') || name.includes('عربي');
          return { name: v.name, lang: v.lang, isSaudi, isEgyptian, isArabic };
        });
        return resolve(mapped);
      }
      return null;
    };

    if (check()) return;

    const handler = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      check();
    };

    window.speechSynthesis.addEventListener('voiceschanged', handler);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve([]);
    }, 1500);
  });
}

/**
 * Finds the best voice matching the specified dialect.
 */
export function pickBestWebSpeechVoice(
  voices: SpeechSynthesisVoice[],
  dialect: ArabicDialect,
  preferredName?: string,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  if (preferredName) {
    const found = voices.find(v => v.name === preferredName);
    if (found) return found;
  }

  if (dialect === 'saudi') {
    const saudi = voices.find(v => {
      const l = (v.lang || '').toLowerCase().replace('_', '-');
      const n = (v.name || '').toLowerCase();
      return l === 'ar-sa' || n.includes('naayf') || n.includes('hamed') || n.includes('zari') || n.includes('saudi');
    });
    if (saudi) return saudi;
  } else if (dialect === 'egyptian') {
    const eg = voices.find(v => {
      const l = (v.lang || '').toLowerCase().replace('_', '-');
      const n = (v.name || '').toLowerCase();
      return l === 'ar-eg' || n.includes('egypt') || n.includes('hoda') || n.includes('shakir');
    });
    if (eg) return eg;
  } else if (dialect === 'english') {
    const en = voices.find(v => {
      const l = (v.lang || '').toLowerCase();
      return l.startsWith('en') && (l.includes('us') || l.includes('gb'));
    });
    if (en) return en;
  }

  // Generic Arabic fallback
  const anyAr = voices.find(v => (v.lang || '').toLowerCase().startsWith('ar') || v.name.toLowerCase().includes('arabic'));
  if (anyAr) return anyAr;

  return voices[0] || null;
}

/**
 * Speak text using window.speechSynthesis and return exact duration in milliseconds.
 */
export async function speakViaWebSpeech(
  text: string,
  options: {
    dialect: ArabicDialect;
    preferredVoiceName?: string;
    rate?: number;
  },
): Promise<{ durationMs: number; error?: string }> {
  const { dialect, preferredVoiceName, rate = 0.88 } = options;

  if (typeof window === 'undefined' || !window.speechSynthesis) {
    // If running in background worker without window, use chrome.tts
    if (typeof chrome !== 'undefined' && chrome.tts) {
      return new Promise(resolve => {
        const start = Date.now();
        chrome.tts.stop();
        chrome.tts.speak(text, {
          lang: dialect === 'english' ? 'en-US' : 'ar-SA',
          rate,
          onEvent: e => {
            if (e.type === 'end' || e.type === 'error' || e.type === 'interrupted') {
              resolve({ durationMs: Math.max(2500, Date.now() - start) });
            }
          },
        });
        setTimeout(() => resolve({ durationMs: Math.max(3000, text.length * 120) }), Math.max(5000, text.length * 150));
      });
    }
    return { durationMs: Math.max(2500, text.length * 100), error: 'Speech synthesis unavailable' };
  }

  return new Promise(resolve => {
    try {
      window.speechSynthesis.cancel();

      setTimeout(() => {
        try {
          const voices = window.speechSynthesis.getVoices();
          const voice = pickBestWebSpeechVoice(voices, dialect, preferredVoiceName);
          const utter = new SpeechSynthesisUtterance(text);

          if (voice) {
            utter.voice = voice;
            utter.lang = voice.lang || (dialect === 'english' ? 'en-US' : 'ar-SA');
          } else {
            utter.lang = dialect === 'english' ? 'en-US' : 'ar-SA';
          }

          utter.rate = rate;
          utter.pitch = 1.0;

          const start = Date.now();
          let resolved = false;

          const finish = () => {
            if (!resolved) {
              resolved = true;
              resolve({ durationMs: Math.max(2500, Date.now() - start) });
            }
          };

          utter.onend = finish;
          utter.onerror = finish;

          const maxMs = Math.max(4000, text.length * 160);
          setTimeout(finish, maxMs);

          window.speechSynthesis.speak(utter);
        } catch (e) {
          resolve({ durationMs: Math.max(2500, text.length * 100), error: String(e) });
        }
      }, 80);
    } catch (e) {
      resolve({ durationMs: Math.max(2500, text.length * 100), error: String(e) });
    }
  });
}
