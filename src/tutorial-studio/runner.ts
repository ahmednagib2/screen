// Tutorial Studio: Walkthrough Execution Runner
// Coordinates pre-synthesis, recording, human cursor animation, visual annotations,
// audio playback synchronization, dynamic zoom, and final video export.
import type {
  ExecutionProgress,
  TutorialPlan,
  TutorialStudioSettings,
} from './types';
import { preSynthesizeTutorialAudio, playStepNarration } from './tts';
import {
  injectAudioBufferIntoRecording,
  isRecordingActive,
  pauseRecording,
  resumeRecording,
  showCountdownOverlay,
  startScreenRecording,
  stopScreenRecording,
} from './recorder';
import { exportTutorialPackage } from './exporter';
import { inPageExecuteStep, inPageTeardown, type InPageStepSpec } from './in-page-orchestrator';

export class WalkthroughRunner {
  #plan: TutorialPlan;
  #settings: TutorialStudioSettings;
  #onProgress: (progress: ExecutionProgress) => void;
  #targetTabId?: number;
  #isAborted = false;
  #isPaused = false;
  #stepTimings: Array<{ stepId: string; startMs: number; durationMs: number }> = [];

  constructor(
    plan: TutorialPlan,
    settings: TutorialStudioSettings,
    onProgress: (progress: ExecutionProgress) => void,
    targetTabId?: number
  ) {
    this.#plan = plan;
    this.#settings = settings;
    this.#onProgress = onProgress;
    this.#targetTabId = targetTabId;
  }

  public pause(): void {
    this.#isPaused = true;
    pauseRecording();
  }

  public resume(): void {
    this.#isPaused = false;
    resumeRecording();
  }

  public abort(): void {
    this.#isAborted = true;
    if (this.#targetTabId) {
      void chrome.scripting.executeScript({
        target: { tabId: this.#targetTabId },
        func: inPageTeardown,
      }).catch(() => undefined);
    }
  }

  public async run(): Promise<{ ok: boolean; error?: string }> {
    this.#isAborted = false;
    this.#isPaused = false;
    this.#stepTimings = [];

    const totalSteps = this.#plan.steps.length;

    // Resolve target tab ID if not explicitly provided
    if (!this.#targetTabId) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        this.#targetTabId = tab?.id;
      } catch {}
    }

    // 1. Pre-synthesize all step audio clips to measure exact timing
    this.#onProgress({
      currentStepIndex: 0,
      totalSteps,
      currentStepId: '',
      status: 'planning',
      elapsedMs: 0,
    });

    const preSynth = await preSynthesizeTutorialAudio(
      this.#plan.steps,
      this.#settings.voice,
      (current, total) => {
        this.#onProgress({
          currentStepIndex: current,
          totalSteps: total,
          currentStepId: '',
          status: 'planning',
          elapsedMs: 0,
        });
      }
    );

    if (this.#isAborted) return { ok: false, error: 'تم إلغاء الشرح' };

    // 2. Visual 3-2-1 Countdown in target tab or studio
    this.#onProgress({
      currentStepIndex: 0,
      totalSteps,
      currentStepId: '',
      status: 'countdown',
      elapsedMs: 0,
    });

    if (this.#settings.recording.countdownSec > 0) {
      await showCountdownOverlay(this.#settings.recording.countdownSec);
    }

    if (this.#isAborted) {
      return { ok: false, error: 'تم إلغاء الشرح' };
    }

    // 3. Start Screen & Tab Recording
    const recRes = await startScreenRecording({
      resolution: this.#settings.recording.resolution,
      frameRate: this.#settings.recording.frameRate,
      bitrateMbps: this.#settings.recording.bitrateMbps,
      targetTabId: this.#targetTabId,
    });

    if (!recRes.ok) {
      this.#onProgress({
        currentStepIndex: 0,
        totalSteps,
        currentStepId: '',
        status: 'error',
        elapsedMs: 0,
        error: recRes.error || 'تعذر بدء تسجيل الشاشة',
      });
      return { ok: false, error: recRes.error || 'تعذر بدء تسجيل الشاشة' };
    }

    const recordStartTime = Date.now();

    // 4. Execute steps sequentially in the target tab's real DOM!
    for (let i = 0; i < totalSteps; i++) {
      if (this.#isAborted) break;

      while (this.#isPaused) {
        await new Promise(r => setTimeout(r, 200));
        if (this.#isAborted) break;
      }

      const step = this.#plan.steps[i];
      const clip = preSynth.clips.get(step.id);
      const stepStartTimeMs = Date.now() - recordStartTime;

      this.#onProgress({
        currentStepIndex: i,
        totalSteps,
        currentStepId: step.id,
        status: 'recording',
        elapsedMs: stepStartTimeMs,
      });

      // A. Build in-page step specification
      const inPageSpec: InPageStepSpec = {
        stepIndex: i,
        totalSteps,
        title: step.title,
        narrationText: step.narration_text,
        captionText: step.caption_text,
        appName: this.#plan.appName,
        action: step.action,
        highlight: step.highlight,
        zoom: step.zoom,
        demoMode: this.#settings.recording.demoMode,
      };

      // B. Execute in target tab: mouse cursor gliding, dynamic zoom, spotlight, SVG arrow, click ripple!
      const inPagePromise = this.#targetTabId
        ? chrome.scripting.executeScript({
            target: { tabId: this.#targetTabId },
            func: inPageExecuteStep,
            args: [inPageSpec],
          }).catch(err => {
            console.warn('In-page step execution error:', err);
            return null;
          })
        : Promise.resolve(null);

      // C. Start synchronized voice playback concurrently
      const audioPromise = clip?.audioBuffer
        ? injectAudioBufferIntoRecording(clip.audioBuffer).then(() => ({ durationMs: clip.durationMs }))
        : playStepNarration(step, clip, this.#settings.voice);

      // D. Wait for both in-page visuals and audio narration to finish
      const [audioResult] = await Promise.all([audioPromise, inPagePromise]);

      const stepDurationMs = Math.max(audioResult?.durationMs || 4000, clip?.durationMs || 4000, 3500);

      this.#stepTimings.push({
        stepId: step.id,
        startMs: stepStartTimeMs,
        durationMs: stepDurationMs,
      });

      // Brief buffer pause between steps so viewer can take in the visual outcome
      await new Promise(r => setTimeout(r, 1000));
    }

    // 5. Completion & Video Export
    await new Promise(r => setTimeout(r, 1500));

    this.#onProgress({
      currentStepIndex: totalSteps,
      totalSteps,
      currentStepId: '',
      status: 'exporting',
      elapsedMs: Date.now() - recordStartTime,
    });

    const videoBlob = await stopScreenRecording();

    // Clean up in-page overlays and restore zoom in target tab
    if (this.#targetTabId) {
      void chrome.scripting.executeScript({
        target: { tabId: this.#targetTabId },
        func: inPageTeardown,
      }).catch(() => undefined);
    }

    if (!videoBlob) {
      return { ok: false, error: 'لم يتم حفظ أي بيانات فيديو أثناء التسجيل' };
    }

    // Process export package (MP4/WebM + SRT + JSON Plan)
    const baseFilename = `tutorial-${this.#plan.appName.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')}-${Date.now()}`;
    await exportTutorialPackage({
      rawVideoBlob: videoBlob,
      plan: this.#plan,
      stepTimings: this.#stepTimings,
      format: this.#settings.export.format,
      exportSrt: this.#settings.export.exportSrt,
      saveJsonPlan: this.#settings.export.saveJsonPlan,
      baseFilename,
    });

    this.#onProgress({
      currentStepIndex: totalSteps,
      totalSteps,
      currentStepId: '',
      status: 'completed',
      elapsedMs: Date.now() - recordStartTime,
    });

    return { ok: true };
  }
}
