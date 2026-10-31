// The offscreen document: executes tab media recording, mixing Arabic neural speech
// into the video stream and playing it through computer speakers simultaneously.
const urls = new Set<string>();

let activeRecorder: MediaRecorder | null = null;
let activeStream: MediaStream | null = null;
let recordedChunks: Blob[] = [];
let currentFilename = 'odoo-tutorial.mp4';

let globalAudioCtx: AudioContext | null = null;
let activeAudioDestination: MediaStreamAudioDestinationNode | null = null;

function getOrCreateAudioContext(): AudioContext {
  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    globalAudioCtx = new AudioCtx();
  }
  if (globalAudioCtx.state === 'suspended') {
    void globalAudioCtx.resume();
  }
  return globalAudioCtx;
}

function splitTextIntoTtsChunks(text: string, maxLen = 175): string[] {
  if (text.length <= maxLen) return [text];
  const parts = text.split(/([.،!؟\n]+)/);
  const chunks: string[] = [];
  let current = '';
  for (const part of parts) {
    if (!part) continue;
    if ((current + part).length <= maxLen) {
      current += part;
    } else {
      if (current.trim()) chunks.push(current.trim());
      current = part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.target !== 'offscreen') return;

  if (message.type === 'blob-url') {
    const url = URL.createObjectURL(new Blob([message.content as string], { type: message.mimeType as string }));
    urls.add(url);
    reply({ url });
    return;
  }

  if (message.type === 'revoke') {
    URL.revokeObjectURL(message.url as string);
    urls.delete(message.url as string);
    reply({ held: urls.size });
    return;
  }

  // ── Tab Screen Recording ──
  if (message.type === 'start-tab-recording') {
    void (async () => {
      try {
        if (activeStream) {
          try {
            activeStream.getTracks().forEach(t => t.stop());
          } catch {}
          activeStream = null;
        }
        if (activeRecorder && activeRecorder.state !== 'inactive') {
          try {
            activeRecorder.stop();
          } catch {}
          activeRecorder = null;
        }
        recordedChunks = [];
        currentFilename = message.filename || `odoo-tutorial-${Date.now()}.mp4`;

        const tabStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: message.streamId,
            },
          } as never,
          video: {
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: message.streamId,
              minWidth: 1920,
              minHeight: 1080,
            },
          } as never,
        });

        const audioCtx = getOrCreateAudioContext();
        activeAudioDestination = audioCtx.createMediaStreamDestination();

        // Connect tab audio if present
        if (tabStream.getAudioTracks().length > 0) {
          try {
            const tabSource = audioCtx.createMediaStreamSource(tabStream);
            tabSource.connect(activeAudioDestination);
          } catch {}
        }

        const combinedStream = new MediaStream([
          ...tabStream.getVideoTracks(),
          ...activeAudioDestination.stream.getAudioTracks(),
        ]);

        activeStream = tabStream;

        const mimeTypes = [
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm',
        ];
        const supported = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

        const recorder = new MediaRecorder(combinedStream, {
          mimeType: supported,
          videoBitsPerSecond: 8_000_000,
        });

        recorder.ondataavailable = e => {
          if (e.data?.size > 0) recordedChunks.push(e.data);
        };

        recorder.start(500);
        activeRecorder = recorder;
        reply({ ok: true });
      } catch (err) {
        console.error('Offscreen start-tab-recording error:', err);
        reply({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  // ── Stop Recording ──
  if (message.type === 'stop-tab-recording') {
    if (!activeRecorder) {
      reply({ ok: false, error: 'No active recording found' });
      return;
    }

    activeRecorder.onstop = () => {
      try {
        const isMp4 = activeRecorder?.mimeType?.includes('mp4') || false;
        const finalBlob = new Blob(recordedChunks, { type: isMp4 ? 'video/mp4' : 'video/webm' });
        const ext = isMp4 ? 'mp4' : 'webm';
        const cleanFilename = currentFilename.endsWith(`.${ext}`)
          ? currentFilename
          : `${currentFilename.replace(/\.[^/.]+$/, '')}.${ext}`;

        const url = URL.createObjectURL(finalBlob);
        urls.add(url);

        const a = document.createElement('a');
        a.href = url;
        a.download = cleanFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => {
          URL.revokeObjectURL(url);
          urls.delete(url);
        }, 30_000);

        if (activeStream) {
          activeStream.getTracks().forEach(t => t.stop());
          activeStream = null;
        }
        activeRecorder = null;
        activeAudioDestination = null;
        reply({ ok: true, filename: cleanFilename, url });
      } catch (err) {
        console.error('Offscreen stop-tab-recording error:', err);
        reply({ ok: false, error: String(err) });
      }
    };

    activeRecorder.stop();
    return true;
  }

  // ── Speak Arabic Narration (Pure Saudi / MSA Neural Voice) ──
  if (message.type === 'speak-narration') {
    void (async () => {
      try {
        const text = (message.text || '').trim();
        if (!text) {
          reply({ ok: true });
          return;
        }

        const audioCtx = getOrCreateAudioContext();
        const chunks = splitTextIntoTtsChunks(text, 175);
        const rate = message.rate || 0.95;

        for (const chunk of chunks) {
          const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar-SA&client=tw-ob&q=${encodeURIComponent(chunk)}`;
          try {
            const resp = await fetch(url);
            const arrayBuf = await resp.arrayBuffer();
            const audioBuf = await audioCtx.decodeAudioData(arrayBuf);

            const source = audioCtx.createBufferSource();
            source.buffer = audioBuf;
            source.playbackRate.value = rate;

            // 1. Play out loud through computer speakers
            source.connect(audioCtx.destination);

            // 2. Mix into video recording stream if recording is active
            if (activeAudioDestination) {
              source.connect(activeAudioDestination);
            }

            source.start(0);

            await new Promise<void>(res => {
              source.onended = () => res();
              // Safety timeout in case onended doesn't fire
              const durMs = (audioBuf.duration * 1000) / rate + 600;
              setTimeout(res, Math.max(2500, durMs));
            });
          } catch (chunkErr) {
            console.warn('Offscreen speech chunk error:', chunkErr);
          }
        }

        reply({ ok: true });
      } catch (err) {
        console.warn('Offscreen speak-narration error:', err);
        reply({ ok: false, error: String(err) });
      }
    })();
    return true;
  }
});
