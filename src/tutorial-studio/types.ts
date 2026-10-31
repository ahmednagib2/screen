// Tutorial Studio: Type definitions and core data models
// Supports Odoo 17+ and generic web applications.

export type ActionType = 'click' | 'type' | 'scroll' | 'hover' | 'navigate' | 'wait';
export type HighlightStyle = 'arrow' | 'box' | 'circle' | 'spotlight';
export type ArrowDirection = 'up' | 'down' | 'left' | 'right' | 'auto';
export type ArabicDialect = 'saudi' | 'egyptian' | 'msa' | 'english' | 'custom';
export type TtsProvider = 'free_arabic' | 'elevenlabs' | 'webspeech';

export interface ActionSpec {
  type: ActionType;
  selector?: string;
  value?: string;
  allow_write?: boolean;
}

export interface HighlightSpec {
  selector?: string;
  style: HighlightStyle;
  arrow_direction?: ArrowDirection;
}

export interface ZoomSpec {
  selector?: string;
  scale?: number; // e.g. 1.25 or 1.5
}

export interface TutorialStep {
  id: string;
  title: string;
  narration_text: string;
  caption_text: string;
  action: ActionSpec;
  highlight: HighlightSpec;
  zoom?: ZoomSpec;
  duration_hint_ms?: number;
}

export interface TutorialPlan {
  id: string;
  command: string;
  appName: string;
  dialect: ArabicDialect;
  createdAt: string;
  steps: TutorialStep[];
}

export interface VoiceSettings {
  provider: TtsProvider;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsModel: string;
  stability: number;
  similarityBoost: number;
  dialect: ArabicDialect;
  customVoiceId: string;
  webSpeechVoiceName: string;
}

export interface RecordingSettings {
  resolution: '1080p' | '720p';
  frameRate: 30 | 60;
  bitrateMbps: number;
  countdownSec: number;
  demoMode: boolean;
  blurSensitive: boolean;
}

export interface ExportSettings {
  format: 'mp4' | 'webm';
  includeCaptionsBurnIn: boolean;
  exportSrt: boolean;
  saveJsonPlan: boolean;
}

export interface TutorialStudioSettings {
  voice: VoiceSettings;
  recording: RecordingSettings;
  export: ExportSettings;
}

export interface SynthesizedAudioClip {
  stepId: string;
  audioBuffer: ArrayBuffer | null;
  audioUrl?: string;
  durationMs: number;
  provider: TtsProvider;
  error?: string;
}

export interface ExecutionProgress {
  currentStepIndex: number;
  totalSteps: number;
  currentStepId: string;
  status: 'idle' | 'planning' | 'countdown' | 'recording' | 'paused' | 'stopped' | 'exporting' | 'completed' | 'error';
  elapsedMs: number;
  activeError?: string;
}

export interface DetailedModuleAnalysis {
  title: string;
  url: string;
  isOdoo: boolean;
  odooVersion?: string;
  detectedModuleName: string;
  moduleCategory: "sales" | "accounting" | "hr" | "inventory" | "projects" | "settings" | "other";
  confidence: number;
  humanOverview: string;
  keyComponents: Array<{
    name: string;
    type: "module" | "button" | "field" | "view" | "menu";
    description: string;
    importance: "critical" | "important" | "optional";
  }>;
  typicalFlows: Array<{
    name: string;
    description: string;
    steps: string[];
  }>;
  tutorialReadiness: {
    score: number;
    ready: boolean;
    missingElements: string[];
    recommendedApproach: "full-walkthrough" | "key-features" | "specific-task";
  };
}
