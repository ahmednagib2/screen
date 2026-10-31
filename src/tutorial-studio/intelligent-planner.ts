// Tutorial Studio: Intelligent AI Planner & Assistant
// Performs deep page inspection via the active LLM, comprehensive module
// understanding, and high-quality Arabic narration planning.

import type { ArabicDialect, TutorialPlan, TutorialStep, DetailedModuleAnalysis } from './types';
import { keysStorage, providersStorage, settingsStorage, usableModel, findModel } from '@src/store/settings';
import { createModel } from '@src/llm/providers';
import { streamTurn } from '@src/llm/stream';
import type { PageInspectionSummary } from './planner';

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model reply');
  return JSON.parse(raw.slice(start, end + 1));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function performComprehensiveUnderstanding(summary: PageInspectionSummary): Promise<DetailedModuleAnalysis> {
  const providers = (await providersStorage.get()) || [];
  const settings = (await settingsStorage.get()) || {};
  const activeModelRef = usableModel(providers, settings.defaultModel);

  const fallback: DetailedModuleAnalysis = {
    title: summary.title,
    url: summary.url,
    isOdoo: summary.isOdoo,
    odooVersion: summary.odooVersion,
    detectedModuleName: summary.detectedModuleName,
    moduleCategory: 'other',
    confidence: 0.5,
    humanOverview: summary.teacherOverview,
    keyComponents: summary.apps.map(a => ({ name: a.name, type: 'module' as const, description: a.name, importance: 'important' as const })),
    typicalFlows: [],
    tutorialReadiness: { score: 60, ready: true, missingElements: [], recommendedApproach: 'key-features' },
  };

  if (!activeModelRef) return fallback;
  const modelEntry = findModel(providers, activeModelRef);
  if (!modelEntry) return fallback;

  const chat = createModel({ kind: modelEntry.kind, modelName: modelEntry.modelName });

  const system = `أنت خبير في Odoo وتطبيقات الويب. حلّل ملخص الصفحة المُعطى وأعد كائن JSON فقط (بدون أي نص إضافي) بالشكل التالي:
{"title": string, "detectedModuleName": string, "moduleCategory": "sales"|"accounting"|"hr"|"inventory"|"projects"|"settings"|"other", "confidence": number, "humanOverview": string, "keyComponents": [{"name": string, "type": "module"|"button"|"field"|"view"|"menu", "description": string, "importance": "critical"|"important"|"optional"}], "typicalFlows": [{"name": string, "description": string, "steps": string[]}], "tutorialReadiness": {"score": number, "ready": boolean, "missingElements": string[], "recommendedApproach": "full-walkthrough"|"key-features"|"specific-task"}}
اكتب كل النصوص بالعربية الفصحى الواضحة.`;

  const userContent = JSON.stringify(summary, null, 2);
  const result = await streamTurn({ chat, system, messages: [{ role: 'user', content: userContent }], maxOutputTokens: 2000 });

  if (result.finish === 'error' || !result.text) return fallback;

  try {
    const parsed = extractJson(result.text);
    if (!isRecord(parsed)) return fallback;
    return {
      ...fallback,
      title: typeof parsed.title === 'string' ? parsed.title : fallback.title,
      detectedModuleName: typeof parsed.detectedModuleName === 'string' ? parsed.detectedModuleName : fallback.detectedModuleName,
      moduleCategory: (typeof parsed.moduleCategory === 'string' ? parsed.moduleCategory : 'other') as DetailedModuleAnalysis['moduleCategory'],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      humanOverview: typeof parsed.humanOverview === 'string' ? parsed.humanOverview : fallback.humanOverview,
      keyComponents: Array.isArray(parsed.keyComponents) ? parsed.keyComponents.filter(isRecord).map(c => ({ name: String(c.name ?? ''), type: (typeof c.type === 'string' ? c.type : 'module') as DetailedModuleAnalysis['keyComponents'][number]['type'], description: String(c.description ?? ''), importance: (typeof c.importance === 'string' ? c.importance : 'important') as DetailedModuleAnalysis['keyComponents'][number]['importance'] })) : fallback.keyComponents,
      typicalFlows: Array.isArray(parsed.typicalFlows) ? parsed.typicalFlows.filter(isRecord).map(f => ({ name: String(f.name ?? ''), description: String(f.description ?? ''), steps: Array.isArray(f.steps) ? f.steps.map(String) : [] })) : fallback.typicalFlows,
      tutorialReadiness: isRecord(parsed.tutorialReadiness) ? { score: typeof parsed.tutorialReadiness.score === 'number' ? parsed.tutorialReadiness.score : 80, ready: parsed.tutorialReadiness.ready !== false, missingElements: Array.isArray(parsed.tutorialReadiness.missingElements) ? parsed.tutorialReadiness.missingElements.map(String) : [], recommendedApproach: (typeof parsed.tutorialReadiness.recommendedApproach === 'string' ? parsed.tutorialReadiness.recommendedApproach : 'full-walkthrough') as DetailedModuleAnalysis['tutorialReadiness']['recommendedApproach'] } : fallback.tutorialReadiness,
    };
  } catch {
    return fallback;
  }
}

export function generateIntelligentSummary(analysis: DetailedModuleAnalysis): string {
  const readiness = analysis.tutorialReadiness.ready ? "جاهز تماماً لإنشاء شرح احترافي" : "يحتاج بعض التجهيزات";
  return `لقد قمت بفحص ${analysis.detectedModuleName} بعناية.\n\nما فهمته كإنسان: ${analysis.humanOverview}\n\nلقد رصدت ${analysis.keyComponents.length} عناصر رئيسية و ${analysis.typicalFlows.length} تدفقات عمل نموذجية.\n\nأنا ${readiness} الآن. هل تود البدء بإنشاء شرح فيديو بصوت وصورة مع العلامات والأسهم؟`;
}

export async function generateIntelligentPlan(
  command: string,
  analysis: DetailedModuleAnalysis,
  summary: PageInspectionSummary,
  dialect: ArabicDialect = 'saudi'
): Promise<TutorialPlan> {
  const plan: TutorialPlan = { id: `plan-${Date.now()}`, command, appName: analysis.detectedModuleName, dialect, createdAt: new Date().toISOString(), steps: [] };

  const providers = (await providersStorage.get()) || [];
  const settings = (await settingsStorage.get()) || {};
  const activeModelRef = usableModel(providers, settings.defaultModel);
  const modelEntry = activeModelRef ? findModel(providers, activeModelRef) : undefined;

  if (modelEntry) {
    const chat = createModel({ kind: modelEntry.kind, modelName: modelEntry.modelName });
    const system = `أنت مدرب Odoo محترف. بناءً على تحليل الموديول المُعطى، أنشئ خطة شرح تفاعلية بالعربية الفصحى.
أعد كائن JSON فقط بالشكل:
{"steps": [{"id": string, "title": string, "narration_text": string, "caption_text": string, "action": {"type": "click"|"type"|"scroll"|"hover"|"navigate"|"wait", "selector": string, "value": string}, "highlight": {"selector": string, "style": "arrow"|"box"|"circle"|"spotlight", "arrow_direction": "up"|"down"|"left"|"right"|"auto"}, "zoom": {"selector": string, "scale": number}, "duration_hint_ms": number}]}
اجعل كل خطوة قصيرة وواضحة، واربطها بعنصر حقيقي من الصفحة عبر selector.`;

    const userContent = JSON.stringify({ command, analysis, summary }, null, 2);
    const result = await streamTurn({ chat, system, messages: [{ role: 'user', content: userContent }], maxOutputTokens: 4000 });

    if (result.text) {
      try {
        const parsed = extractJson(result.text);
        if (isRecord(parsed) && Array.isArray(parsed.steps)) {
          plan.steps = parsed.steps.filter(isRecord).map(s => ({
            id: String(s.id ?? `step-${Date.now()}-${Math.random()}`),
            title: String(s.title ?? ''),
            narration_text: String(s.narration_text ?? ''),
            caption_text: String(s.caption_text ?? ''),
            action: isRecord(s.action) ? { type: (typeof s.action.type === 'string' ? s.action.type : 'wait') as TutorialStep['action']['type'], selector: typeof s.action.selector === 'string' ? s.action.selector : undefined, value: typeof s.action.value === 'string' ? s.action.value : undefined } : { type: 'wait' as const },
            highlight: isRecord(s.highlight) ? { selector: typeof s.highlight.selector === 'string' ? s.highlight.selector : undefined, style: (typeof s.highlight.style === 'string' ? s.highlight.style : 'spotlight') as TutorialStep['highlight']['style'], arrow_direction: (typeof s.highlight.arrow_direction === 'string' ? s.highlight.arrow_direction : 'auto') as TutorialStep['highlight']['arrow_direction'] } : { style: 'spotlight' as const },
            zoom: isRecord(s.zoom) ? { selector: typeof s.zoom.selector === 'string' ? s.zoom.selector : undefined, scale: typeof s.zoom.scale === 'number' ? s.zoom.scale : undefined } : undefined,
            duration_hint_ms: typeof s.duration_hint_ms === 'number' ? s.duration_hint_ms : undefined,
          }));
        }
      } catch {
        // fall through to intro step
      }
    }
  }

  if (plan.steps.length === 0) {
    plan.steps.push({
      id: 'intro_intelligent',
      title: 'مرحباً بك! أنا مساعدك الذكي',
      narration_text: `أهلاً بك. لقد قمت بفحص ${analysis.detectedModuleName} وفهمت محتوياته. أنا جاهز الآن لشرح الخطوات لك بشكل تفصيلي واحترافي.`,
      caption_text: `فهم الموديول: ${analysis.detectedModuleName}`,
      action: { type: 'wait' },
      highlight: { style: 'spotlight', selector: 'body' },
      duration_hint_ms: 6000
    });
  }

  return plan;
}
