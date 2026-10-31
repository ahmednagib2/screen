// Tutorial Studio: Exporter
// Handles real MP4 (H.264) transcoding via WebCodecs, WebM fallback,
// SRT subtitle files, and JSON plan exports.
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { TutorialPlan, TutorialStep } from './types';

export interface ExportOutputs {
  videoBlob: Blob;
  videoFilename: string;
  srtContent?: string;
  srtFilename?: string;
  planJson?: string;
  planFilename?: string;
}

export function formatSrtTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mmm = String(ms % 1000).padStart(3, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  const mm = String(Math.floor(totalSec / 60) % 60).padStart(2, '0');
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  return `${hh}:${mm}:${ss},${mmm}`;
}

export function generateSrtSubtitles(
  steps: TutorialStep[],
  stepTimings: Array<{ stepId: string; startMs: number; durationMs: number }>,
): string {
  const blocks: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const timing = stepTimings.find(t => t.stepId === step.id) || {
      startMs: i * 8000,
      durationMs: step.duration_hint_ms || 7000,
    };
    const start = formatSrtTimestamp(timing.startMs);
    const end = formatSrtTimestamp(timing.startMs + timing.durationMs);
    const text = step.caption_text || step.narration_text;
    blocks.push(`${i + 1}\n${start} --> ${end}\n${text}\n`);
  }
  return blocks.join('\n');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  downloadBlob(blob, filename);
}

interface TranscodeResult {
  blob: Blob;
  width: number;
  height: number;
}

export async function convertWebmToMp4(
  webmBlob: Blob,
  options: { width?: number; height?: number; fps?: number; bitrate?: number } = {},
): Promise<TranscodeResult> {
  const { width = 1920, height = 1080, fps = 30, bitrate = 8_000_000 } = options;
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs VideoEncoder is unavailable in this browser');
  }
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: 'avc', width, height }, fastStart: 'in-memory' });
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: err => { throw new Error(`Video encoding failed: ${String(err)}`); },
  });
  videoEncoder.configure({ codec: 'avc1.640028', width, height, bitrate, framerate: fps });
  const element = document.createElement('video');
  element.src = URL.createObjectURL(webmBlob);
  element.muted = true;
  element.playsInline = true;
  await new Promise<void>((resolve, reject) => {
    element.onloadedmetadata = () => resolve();
    element.onerror = () => reject(new Error('Failed to load source video for transcoding'));
  });
  await element.play();
  const durationUs = Math.round((element.duration || 0) * 1_000_000);
  const frameDurationUs = Math.round(1_000_000 / fps);
  let timestampUs = 0;
  while (timestampUs < durationUs && !element.ended) {
    const frame = new VideoFrame(element, { timestamp: timestampUs, duration: frameDurationUs });
    videoEncoder.encode(frame, { keyFrame: timestampUs === 0 });
    frame.close();
    timestampUs += frameDurationUs;
    await new Promise(r => requestAnimationFrame(() => r(null)));
  }
  await videoEncoder.flush();
  videoEncoder.close();
  URL.revokeObjectURL(element.src);
  muxer.finalize();
  const buffer = target.buffer;
  if (!buffer || buffer.byteLength < 100) throw new Error('MP4 muxing produced an empty container');
  return { blob: new Blob([buffer], { type: 'video/mp4' }), width, height };
}

export async function exportTutorialPackage(options: {
  rawVideoBlob: Blob;
  plan: TutorialPlan;
  stepTimings: Array<{ stepId: string; startMs: number; durationMs: number }>;
  format: 'mp4' | 'webm';
  exportSrt?: boolean;
  saveJsonPlan?: boolean;
  baseFilename?: string;
}): Promise<ExportOutputs> {
  const { rawVideoBlob, plan, stepTimings, format, exportSrt = false, saveJsonPlan = false, baseFilename = `odoo-tutorial-${Date.now()}` } = options;
  let finalBlob = rawVideoBlob;
  let ext = 'webm';
  if (format === 'mp4') {
    if (rawVideoBlob.type.includes('mp4')) {
      finalBlob = rawVideoBlob;
      ext = 'mp4';
    } else {
      try {
        const result = await convertWebmToMp4(rawVideoBlob, { width: 1920, height: 1080, fps: 30 });
        finalBlob = result.blob;
        ext = 'mp4';
      } catch (err) {
        console.warn('MP4 transcoding failed, exporting original WebM:', err);
        finalBlob = rawVideoBlob;
        ext = 'webm';
      }
    }
  }
  const videoFilename = `${baseFilename}.${ext}`;
  downloadBlob(finalBlob, videoFilename);
  let srtContent: string | undefined;
  let srtFilename: string | undefined;
  if (exportSrt) {
    srtContent = generateSrtSubtitles(plan.steps, stepTimings);
    srtFilename = `${baseFilename}.srt`;
    downloadTextFile(srtContent, srtFilename, 'text/srt');
  }
  let planJson: string | undefined;
  let planFilename: string | undefined;
  if (saveJsonPlan) {
    planJson = JSON.stringify(plan, null, 2);
    planFilename = `${baseFilename}-plan.json`;
    downloadTextFile(planJson, planFilename, 'application/json');
  }
  return { videoBlob: finalBlob, videoFilename, srtContent, srtFilename, planJson, planFilename };
}
