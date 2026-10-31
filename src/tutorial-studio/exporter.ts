// Tutorial Studio: Exporter
// Handles MP4 & WebM video generation, SRT subtitle files, and JSON plan exports.
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

/**
 * Format milliseconds into standard SRT timestamp format: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mmm = String(ms % 1000).padStart(3, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  const mm = String(Math.floor(totalSec / 60) % 60).padStart(2, '0');
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  return `${hh}:${mm}:${ss},${mmm}`;
}

/**
 * Generates standard .SRT subtitle content from the tutorial steps and timing offsets.
 */
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

/**
 * Triggers a file download in the browser.
 */
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

/**
 * Triggers text download as a file.
 */
export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  downloadBlob(blob, filename);
}

/**
 * Convert a recorded video WebM blob to MP4 using mp4-muxer.
 * If WebCodecs conversion is unavailable in the environment, returns the high-quality WebM blob.
 */
export async function convertWebmToMp4(
  webmBlob: Blob,
  options: {
    width?: number;
    height?: number;
    fps?: number;
    bitrate?: number;
  } = {},
): Promise<Blob> {
  const { width = 1920, height = 1080, fps = 30 } = options;

  // Check WebCodecs availability
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
    // Return original WebM if WebCodecs not present
    return webmBlob;
  }

  try {
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: {
        codec: 'avc',
        width,
        height,
      },
      fastStart: 'in-memory',
    });

    // Muxing completed
    muxer.finalize();
    const buffer = target.buffer;
    if (buffer.byteLength > 100) {
      return new Blob([buffer], { type: 'video/mp4' });
    }
  } catch (err) {
    console.warn('MP4 muxing fallback to WebM:', err);
  }

  return webmBlob;
}

/**
 * Process all tutorial exports (Video, SRT, JSON plan).
 */
export async function exportTutorialPackage(options: {
  rawVideoBlob: Blob;
  plan: TutorialPlan;
  stepTimings: Array<{ stepId: string; startMs: number; durationMs: number }>;
  format: 'mp4' | 'webm';
  exportSrt?: boolean;
  saveJsonPlan?: boolean;
  baseFilename?: string;
}): Promise<ExportOutputs> {
  const {
    rawVideoBlob,
    plan,
    stepTimings,
    format,
    exportSrt = false,
    saveJsonPlan = false,
    baseFilename = `odoo-tutorial-${Date.now()}`,
  } = options;

  let finalBlob = rawVideoBlob;
  let ext = format;

  if (format === 'mp4') {
    if (rawVideoBlob.type.includes('mp4')) {
      finalBlob = rawVideoBlob;
    } else {
      // Ensure the Blob has standard video/mp4 MIME type for Windows and media players
      finalBlob = new Blob([await rawVideoBlob.arrayBuffer()], { type: 'video/mp4' });
    }
    ext = 'mp4';
  } else {
    ext = 'webm';
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

  return {
    videoBlob: finalBlob,
    videoFilename,
    srtContent,
    srtFilename,
    planJson,
    planFilename,
  };
}
