// Tutorial Studio: Screen & Tab Recorder
// 1080p @ 30fps, 8 Mbps bitrate, audio mixing with MediaStreamDestination,
// Start/Pause/Resume/Stop controls, and 3-2-1 visual countdown.
// Prioritizes capturing ONLY the webpage content (excluding extension/sidepanel)
// and records directly to MP4 container.

export interface ActiveRecording {
  mediaRecorder: MediaRecorder;
  rawStream?: MediaStream;
  combinedStream: MediaStream;
  recordedChunks: Blob[];
  audioContext: AudioContext;
  audioDestination: MediaStreamAudioDestinationNode;
  mimeType: string;
}

let activeRecording: ActiveRecording | null = null;

/**
 * Forcibly stops and cleans up any active recording, media streams, and audio context.
 * Prevents Chrome's "Cannot capture a tab with an active stream" error.
 */
export function forceCleanupRecording(): void {
  if (activeRecording) {
    try {
      if (activeRecording.rawStream) {
        activeRecording.rawStream.getTracks().forEach(t => {
          try {
            t.stop();
          } catch {}
        });
      }
      activeRecording.combinedStream.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {}
      });
      if (activeRecording.mediaRecorder.state !== 'inactive') {
        try {
          activeRecording.mediaRecorder.stop();
        } catch {}
      }
      void activeRecording.audioContext.close().catch(() => undefined);
    } catch (err) {
      console.warn('forceCleanupRecording error:', err);
    }
    activeRecording = null;
  }
}

/**
 * Renders a full-screen 3-2-1 countdown overlay in the tab before recording starts.
 */
export async function showCountdownOverlay(seconds = 3): Promise<void> {
  const COUNTDOWN_ID = '__nb_countdown_overlay';
  document.getElementById(COUNTDOWN_ID)?.remove();

  const overlay = document.createElement('div');
  overlay.id = COUNTDOWN_ID;
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(5, 10, 25, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    pointer-events: none;
    font-family: 'Cairo', system-ui, sans-serif;
  `;

  const numEl = document.createElement('div');
  numEl.style.cssText = `
    font-size: 110px;
    font-weight: 900;
    color: #60A5FA;
    text-shadow: 0 0 30px rgba(96, 165, 250, 0.8);
    transition: transform 0.4s ease, opacity 0.4s ease;
  `;

  const labelEl = document.createElement('div');
  labelEl.style.cssText = 'font-size: 20px; font-weight: 700; color: #E2E8F0; margin-top: 12px;';
  labelEl.textContent = '🎥 استعد... سيبدأ تسجيل الشرح الآن لصفحة الويب';

  overlay.appendChild(numEl);
  overlay.appendChild(labelEl);
  document.documentElement.appendChild(overlay);

  for (let count = seconds; count > 0; count--) {
    numEl.textContent = String(count);
    numEl.style.transform = 'scale(1.3)';
    numEl.style.opacity = '1';
    await new Promise(r => setTimeout(r, 200));
    numEl.style.transform = 'scale(1.0)';
    await new Promise(r => setTimeout(r, 800));
  }

  overlay.remove();
}

/**
 * Initializes screen recording of the active tab.
 * Prompts user for tab share or connects to tab capture stream.
 * Specifically excludes extension UI / side panel from the recording.
 */
export async function startScreenRecording(options: {
  resolution?: '1080p' | '720p';
  frameRate?: number;
  bitrateMbps?: number;
  targetTabId?: number;
}): Promise<{ ok: boolean; error?: string }> {
  // Always clean up any previously hanging recording or streams first
  forceCleanupRecording();

  const { resolution = '1080p', frameRate = 30, bitrateMbps = 8, targetTabId } = options;
  const height = resolution === '1080p' ? 1080 : 720;
  const width = resolution === '1080p' ? 1920 : 1280;

  try {
    let stream: MediaStream | null = null;

    // Strategy 1: Chrome Extension Tab Capture (captures purely the webpage tab, zero side panel)
    try {
      if (typeof chrome !== 'undefined' && chrome.tabCapture?.getMediaStreamId) {
        let activeTabId = targetTabId;
        if (!activeTabId && chrome.tabs?.query) {
          const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          activeTabId = activeTab?.id;
        }

        if (activeTabId) {
          const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: activeTabId });
          if (streamId) {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'tab',
                  chromeMediaSourceId: streamId,
                },
              },
              video: {
                mandatory: {
                  chromeMediaSource: 'tab',
                  chromeMediaSourceId: streamId,
                  maxWidth: width,
                  maxHeight: height,
                  maxFrameRate: frameRate,
                },
              },
            } as unknown as MediaStreamConstraints);
          }
        }
      }
    } catch (tabCaptureErr) {
      console.warn('Tab capture via getMediaStreamId fell back:', tabCaptureErr);
    }

    // Strategy 2: getDisplayMedia with current tab priority
    if (!stream) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        return { ok: false, error: 'المتصفح لا يدعم تسجيل الشاشة عبر getDisplayMedia' };
      }

      try {
        const displayOptions: Record<string, unknown> = {
          video: {
            displaySurface: 'browser',
            width: { ideal: width },
            height: { ideal: height },
            frameRate: { ideal: frameRate },
          },
          audio: true,
          preferCurrentTab: true,
        };

        stream = await navigator.mediaDevices.getDisplayMedia(
          displayOptions as unknown as DisplayMediaStreamOptions
        );
      } catch (advancedErr) {
        console.warn('Advanced displayMedia failed, trying standard fallback:', advancedErr);
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: width },
            height: { ideal: height },
            frameRate: { ideal: frameRate },
          },
          audio: true,
        });
      }
    }

    if (!stream) {
      return { ok: false, error: 'تم إلغاء مشاركة التبويب' };
    }

    // Set up WebAudio pipeline to mix tab audio + synthetic speech narration
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioCtxClass();
    const audioDestination = audioContext.createMediaStreamDestination();

    // Route tab audio into the destination if present
    if (stream.getAudioTracks().length > 0) {
      try {
        const tabAudioSource = audioContext.createMediaStreamSource(stream);
        tabAudioSource.connect(audioDestination);
      } catch (audioErr) {
        console.warn('Could not connect tab audio to destination:', audioErr);
      }
    }

    // Combine video track + mixed audio track
    const combinedStream = new MediaStream([
      ...stream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks(),
    ]);

    // Choose preferred container/codec - Prioritize native MP4!
    const supportedTypes = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    const mimeType = supportedTypes.find(t => MediaRecorder.isTypeSupported(t)) || 'video/mp4';

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: bitrateMbps * 1_000_000,
    });

    const recordedChunks: Blob[] = [];
    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.start(500); // 500ms time slice

    activeRecording = {
      mediaRecorder,
      rawStream: stream,
      combinedStream,
      recordedChunks,
      audioContext,
      audioDestination,
      mimeType,
    };

    return { ok: true };
  } catch (err) {
    forceCleanupRecording();
    return { ok: false, error: `فشل بدء تسجيل الشاشة: ${String(err)}` };
  }
}

/**
 * Mix an audio buffer (e.g. from Free Arabic TTS or ElevenLabs) into the ongoing screen recording stream
 * AND play it through speakers simultaneously so the user hears it live.
 */
export async function injectAudioBufferIntoRecording(audioBuffer: ArrayBuffer): Promise<void> {
  if (!activeRecording) return;

  try {
    const { audioContext, audioDestination } = activeRecording;
    const decoded = await audioContext.decodeAudioData(audioBuffer.slice(0));
    const source = audioContext.createBufferSource();
    source.buffer = decoded;

    // Connect to recorder stream destination (burns audio into video)
    source.connect(audioDestination);
    // Connect to computer speakers so user hears live narration
    source.connect(audioContext.destination);

    source.start(0);

    return new Promise(resolve => {
      source.onended = () => resolve();
    });
  } catch (err) {
    console.warn('Failed to mix audio into recording:', err);
  }
}

/**
 * Pause the active recording.
 */
export function pauseRecording(): boolean {
  if (activeRecording && activeRecording.mediaRecorder.state === 'recording') {
    activeRecording.mediaRecorder.pause();
    return true;
  }
  return false;
}

/**
 * Resume the active recording.
 */
export function resumeRecording(): boolean {
  if (activeRecording && activeRecording.mediaRecorder.state === 'paused') {
    activeRecording.mediaRecorder.resume();
    return true;
  }
  return false;
}

/**
 * Stop the active recording and return the accumulated video Blob.
 */
export async function stopScreenRecording(): Promise<Blob | null> {
  if (!activeRecording) return null;

  const { mediaRecorder, rawStream, combinedStream, recordedChunks, audioContext, mimeType } = activeRecording;

  const cleanup = () => {
    try {
      if (rawStream) {
        rawStream.getTracks().forEach(t => {
          try {
            t.stop();
          } catch {}
        });
      }
    } catch {}
    try {
      combinedStream.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {}
      });
    } catch {}
    void audioContext.close().catch(() => undefined);
    activeRecording = null;
  };

  return new Promise(resolve => {
    mediaRecorder.onstop = () => {
      const finalMime = mediaRecorder.mimeType || mimeType || 'video/mp4';
      const blob = new Blob(recordedChunks, { type: finalMime });
      cleanup();
      resolve(blob);
    };

    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      const finalMime = mediaRecorder.mimeType || mimeType || 'video/mp4';
      const blob = new Blob(recordedChunks, { type: finalMime });
      cleanup();
      resolve(blob);
    }
  });
}

/**
 * Returns whether recording is currently in progress.
 */
export function isRecordingActive(): boolean {
  return activeRecording !== null && activeRecording.mediaRecorder.state !== 'inactive';
}
