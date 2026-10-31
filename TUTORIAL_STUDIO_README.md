# استوديو الشروحات التفاعلية | Tutorial Studio for Nanobrowser

> **استوديو الشروحات التعليمية المصورة فائق الذكاء داخل متصفح كروم**
> **Production-grade AI Tutorial Studio for Odoo 17+ and Modern Web Apps**

---

## 🇸🇦 دليل الاستخدام والتشغيل بالعربية

### 1. ما هو استوديو الشروحات (Tutorial Studio)؟
ميزة مدمجة احترافية داخل إضافة المتصفح تتيح تحويل أي فكرة أو شاشة إلى **فيديو تعليمي عالي الجودة (1080p MP4)** بصوت ذكاء اصطناعي فائق الواقعية (يدعم اللهجة السعودية والخليجية، المصرية، والفصحى)، مع مؤشر فأرة بشري متحرك بسلاسة، وأسهم توضيحية موجهة، وتسليط ضوء (Spotlight)، وشريط ترجمة عربي بتصميم زجاجي، وتصدير كامل بضغطة زر.

### 2. طريقة التثبيت في متصفح كروم (Load Unpacked)
1. افتح متصفح Google Chrome واذهب إلى الرابط:
   ```
   chrome://extensions/
   ```
2. فعّل **وضع المطور (Developer mode)** من الزاوية العلوية اليمنى.
3. انقر على زر **تحميل حزمة غير مضغوطة (Load unpacked)**.
4. اختر مجلد الإضافة المترجم:
   ```
   D:\اضافة جوجل كروم\nanobrowser\dist
   ```
5. ستظهر إضافة **Nanobrowser**، اضغط على أيقونة الإضافة في شريط الأدوات لتثبيتها (Pin) وفتح الشريط الجانبي (Side Panel).

---

### 3. كيفية تشغيل استوديو الشروحات
يمكنك الدخول للاستوديو بطريقتين:
- **الطريقة المباشرة**: اضغط على أيقونة الكاميرا/الاستوديو `🎬` الموجودة في الشريط العلوي للإضافة.
- **عبر الأوامر الطبيعية**: اكتب في صندوق المحادثة أي أمر مثل:
  - `اشرح مديول المبيعات وكيفية عمل عرض سعر`
  - `شرح موديول الإجازات Time Off`
  - `start explaining the sales module`
  - أو الأمر المختصر: `/studio` أو `/tutorial`

---

### 4. أقسام الاستوديو الخمسة

1. **قسم الأوامر والتخطيط (Command)**:
   - اكتب ما تريد شرحه أو اختر من النماذج الجاهزة لـ Odoo (المبيعات، الإجازات، المشتريات).
   - اختر اللهجة المناسبة: **سعودية/خليجية (يا هلا والله، الحين، ودنا)**، **مصرية**، **عربية فصحى**، أو **إنجليزية**.
   - اضغط **"توليد خطة الدرس الذكية"** ليقوم الذكاء الاصطناعي بفحص الصفحة وصياغة الخطوات مع شرح "لماذا نستخدم هذا الخيار؟".

2. **محرر الخطوات (Plan Editor)**:
   - مراجعة كاملة لجميع الخطوات والنصوص المنطوقة.
   - إمكانية تعديل الشرح، إعادة ترتيب الخطوات لأعلى أو لأسفل، أو حذف أي خطوة.
   - تحديد نمط التحديد البصري لكل خطوة: سهم موجه، صندوق نيون، دائرة، أو تسليط ضوء مع تعتيم باقي الشاشة.

3. **لوحة التسجيل الحي (Recording)**:
   - زر **"بدء التسجيل والشرح الحي"** مع عد تنازلي (3-2-1) للإعداد.
   - حركة فأرة تفاعلية بنقاط Bezier ونبضات النقر.
   - شريط ترجمة متحرك في الأسفل بالخط العربي الواضح.
   - إمكانية الإيقاف المؤقت أو الإنهاء في أي وقت.

4. **إعدادات الصوت والذكاء الاصطناعي (Voice Settings)**:
   - **المزود الأساسي (ElevenLabs)**: ضع مفتاح API الخاص بك واختر Voice ID المناسب (مثل الأصوات الخليجية أو العربية).
   - **التبديل التلقائي الذكي**: في حال نفاد الرصيد أو حدوث خطأ من ElevenLabs (401/402/429)، يقوم النظام بالتحويل الفوري للـ Web Speech API دون أن يتوقف التسجيل.
   - زر **"تجربة واستماع الصوت"** للتأكد من جودة النطق قبل التسجيل.

5. **التصدير (Export)**:
   - تصدير فيديو نهائي بصيغة **MP4 (H.264 + AAC)** بدقة 1080p عالية ومعدل بت 8 Mbps+.
   - خيار تحميل بصيغة **WebM** احتياطية.
   - تصدير ملف الترجمة **SRT Subtitles** متزامن بالمللي ثانية.
   - تصدير ملف الخطة **JSON** لحفظ السيناريو وإعادة استخدامه.

---

### 5. تجربة السيناريو العملي (Odoo Demo Sandbox)
تم تضمين صفحة اختبارية كاملة لمحاكاة Odoo 17 في:
```
D:\اضافة جوجل كروم\nanobrowser\fixtures\odoo-demo.html
```
- افتح هذا الملف في المتصفح.
- افتح الشريط الجانبي للإضافة واضغط على `🎬`.
- ستتعرف الإضافة تلقائياً على عناصر Odoo (القائمة العلوية، أزرار الطلبات، بطاقات الكانبان، نموذج عرض السعر الجديد).
- اضغط "بدء التسجيل والتنفيذ" وشاهد المؤشر والأسهم والشرح الصوتي يعمل بدقة تامة.

---

## 🇬🇧 English Quick Start & Technical Reference

### 1. Architecture Overview
- **Command-to-Plan Engine**: Leverages DOM inspection and nanobrowser's AI turn runner to produce a typed `TutorialPlan` (`TutorialStep[]`).
- **Human-like Automation**: Bezier curve cursor interpolator, ripple effects, natural typing cadence, and Demo Mode safety barrier (prevents dangerous submits/deletes).
- **Visual Overlays**: In-page broadcast canvas/SVG system rendering directional arrows, spotlight masks, numbered badges, and RTL Arabic glassmorphic subtitle bar.
- **Dual TTS Engine**: Primary ElevenLabs API (cached in-memory, WebAudio duration measurement, automatic 401/402/429 fallback) + fallback browser `speechSynthesis`/`chrome.tts`.
- **MediaRecorder & MP4 Muxer**: Audio/video mixing through WebAudio `MediaStreamDestination` into 1080p @ 30fps MP4 (via local `mp4-muxer`) and `.srt` subtitles.

### 2. Loading the Extension
1. Navigate to `chrome://extensions/`.
2. Toggle **Developer mode** (top right).
3. Click **Load unpacked** and select `D:\اضافة جوجل كروم\nanobrowser\dist`.
4. Open Chrome's Side Panel to access Nanobrowser and the Tutorial Studio.

### 3. Key Files Structure
```text
src/tutorial-studio/
├── types.ts              # Core TypeScript interfaces (TutorialPlan, Step, Settings)
├── settings.ts           # Persistent storage & dialect configurations
├── planner.ts            # DOM inspector & LLM plan generator
├── cursor-overlay.ts     # Presenter mouse physics, typing & demo safety
├── annotations.ts        # SVG arrows, spotlight, badges & subtitles
├── recorder.ts           # Tab capture & WebAudio stream mixer
├── exporter.ts           # MP4 muxer, WebM fallback & SRT generator
├── runner.ts             # Master execution coordinator
├── tts/
│   ├── elevenlabs.ts     # ElevenLabs integration & quota detection
│   ├── webspeech.ts      # Web Speech / Chrome TTS fallback
│   └── index.ts          # Unified audio pipeline
└── ui/
    └── TutorialStudioPanel.tsx # 5-tab Side Panel UI (Arabic RTL / English)
```

### 4. Known Considerations
- **Chrome Screen Capture Permissions**: Tab capture requires standard browser user confirmation via the recording prompt.
- **ElevenLabs API Keys**: Keys are stored securely in `chrome.storage.local` and never hardcoded or transmitted elsewhere.
