// Advanced automation power tools:
// 1. dismiss_overlays: Auto-detect and dismiss cookie consent and modal overlays
// 2. extract_data: Deep structured web scraper with direct file export
// 3. site_memory: Persistent site knowledge and domain preferences
import type { AgentTool } from './tools';

export const DISMISS_OVERLAYS_TOOL: AgentTool = {
  name: 'dismiss_overlays',
  source: 'agent',
  group: 'acting',
  description:
    'Automatically detect and dismiss cookie consent banners, GDPR notices, promotional overlays, and blocking popups (clicks "Accept All", "Agree", "موافق", "قبول الكل", "إغلاق", or close button).',
  parameters: {
    type: 'object',
    properties: {
      tabId: { type: 'number', description: 'Tab ID (defaults to active tab)' },
    },
    additionalProperties: false,
  },
};

export const EXTRACT_DATA_TOOL: AgentTool = {
  name: 'extract_data',
  source: 'agent',
  group: 'reading',
  description:
    'Extract structured data (tables, product listings, prices, flight comparisons, or search results) from the page as JSON, CSV or Markdown, and optionally save as a file in Downloads.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Description of data to extract, e.g. "all products with titles and prices"' },
      format: { type: 'string', enum: ['json', 'csv', 'markdown'], description: 'Desired output format (defaults to json)' },
      saveToFile: { type: 'string', description: 'Optional filename to save directly in Downloads, e.g. "products.csv"' },
    },
    required: ['query'],
    additionalProperties: false,
  },
};

export const SITE_MEMORY_TOOL: AgentTool = {
  name: 'site_memory',
  source: 'agent',
  group: 'working',
  description:
    'Remember or recall domain-specific user preferences, navigation shortcuts, or credentials/site notes across conversations.',
  parameters: {
    type: 'object',
    properties: {
      site: { type: 'string', description: 'The domain or site name, e.g. "amazon.eg" or "booking.com"' },
      action: { type: 'string', enum: ['save', 'get', 'clear'], description: 'Action to perform' },
      notes: { type: 'string', description: 'The preferences or knowledge to remember for this site' },
    },
    required: ['site', 'action'],
    additionalProperties: false,
  },
};

export const TUTORIAL_SCREENSHOT_TOOL: AgentTool = {
  name: 'tutorial_screenshot',
  source: 'agent',
  group: 'reading',
  description:
    'Capture an annotated screenshot of the current page or a specific highlighted element for tutorials and explanations. Automatically saves the PNG screenshot to Downloads and returns the image for the guide.',
  parameters: {
    type: 'object',
    properties: {
      stepTitle: { type: 'string', description: 'Title or description of the tutorial step (e.g. "Step 1: Click the search input")' },
      highlightRef: { type: 'string', description: 'Optional ref (e.g. "a12") to highlight or crop to the specific element being explained' },
      filename: { type: 'string', description: 'Optional filename for the screenshot, e.g. "step1-search.png"' },
      drawLabels: { type: 'boolean', description: 'Whether to overlay visual labels over interactive buttons and controls' },
    },
    required: ['stepTitle'],
    additionalProperties: false,
  },
};

export const CLARIFY_INTENT_TOOL: AgentTool = {
  name: 'clarify_intent',
  source: 'agent',
  group: 'working',
  description:
    'Ask the user 3 to 4 smart multiple-choice questions formatted as prompt refinement choices before executing complex workflows, ensuring you understand their exact preferences perfectly.',
  parameters: {
    type: 'object',
    properties: {
      promptSummary: { type: 'string', description: 'Summary of the user request being clarified' },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'The question in Arabic or user language' },
            options: { type: 'array', items: { type: 'string' }, description: 'Multiple-choice options for the user to choose from' },
          },
          required: ['question', 'options'],
        },
        description: '3 to 4 multiple-choice questions',
      },
    },
    required: ['questions'],
    additionalProperties: false,
  },
};

export const RECORD_VIDEO_TUTORIAL_TOOL: AgentTool = {
  name: 'record_video_tutorial',
  source: 'agent',
  group: 'working',
  description:
    'Create, highlight, narrate in Arabic, and record an interactive video tutorial or live walkthrough on the current web page (e.g. Odoo modules, forms, settings) with element spotlight focus, step pointer badges, spoken Arabic voice narration (Text-to-Speech), lower-third subtitle banners, and automatic video download.',
  parameters: {
    type: 'object',
    properties: {
      tutorialTitle: {
        type: 'string',
        description: 'Title of the tutorial in Arabic, e.g. "شرح مديول الجداول الزمنية في أودو"',
      },
      steps: {
        type: 'array',
        description: 'Sequence of tutorial steps with Arabic narration and target elements',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Brief title for this step in Arabic' },
            narration: { type: 'string', description: 'The exact spoken Arabic explanation for this step' },
            selector: { type: 'string', description: 'CSS selector or text match (e.g. ".o_menu_toggle", "text:المشاريع", "button.btn-primary") of the element to highlight' },
            action: { type: 'string', enum: ['highlight', 'click', 'type', 'wait'], description: 'Action to perform on the target element' },
            actionValue: { type: 'string', description: 'Text to type if action is "type"' },
            pauseSeconds: { type: 'number', description: 'Seconds to pause for explanation/narration (default: 4)' },
          },
          required: ['title', 'narration'],
        },
      },
      enableVoice: {
        type: 'boolean',
        description: 'Whether to speak narration aloud using Arabic Text-To-Speech (default: true)',
      },
      enableSubtitles: {
        type: 'boolean',
        description: 'Whether to render the floating lower-third subtitle banner (default: true)',
      },
      recordVideo: {
        type: 'boolean',
        description: 'Whether to record the tab screen as a downloadable video (default: true)',
      },
      videoFilename: {
        type: 'string',
        description: 'Optional filename for the recorded video (e.g. "odoo-timesheets-tutorial.webm")',
      },
    },
    required: ['tutorialTitle', 'steps'],
    additionalProperties: false,
  },
};

export const POWER_TOOLS: AgentTool[] = [
  DISMISS_OVERLAYS_TOOL,
  EXTRACT_DATA_TOOL,
  SITE_MEMORY_TOOL,
  TUTORIAL_SCREENSHOT_TOOL,
  CLARIFY_INTENT_TOOL,
  RECORD_VIDEO_TUTORIAL_TOOL,
];
