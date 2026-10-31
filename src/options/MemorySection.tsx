import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  DEFAULT_MEMORY_PROFILES,
  memoryProfilesStorage,
  activeMemoryProfileStorage,
  settingsStorage,
  siteMemoryStorage,
} from '@src/store/settings';
import type { MemoryProfile, SiteMemoryEntry } from '@src/store/settings';
import { CUSTOM_INSTRUCTIONS_MAX } from '@src/store/types';
import { useStorage } from '@src/ui/hooks';
import { t } from '@src/ui/i18n';
import { Button, Input, Notice } from '@src/ui/components';
import { SettingsCard } from './SettingsCard';
import { CheckIcon, PlusIcon, TrashIcon } from '@src/ui/icons';

function MemoryProfilesManager() {
  const profiles = useStorage(memoryProfilesStorage, DEFAULT_MEMORY_PROFILES);
  const activeId = useStorage(activeMemoryProfileStorage, 'general');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInstructions, setEditInstructions] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileIcon, setNewProfileIcon] = useState('✨');
  const [newProfileDesc, setNewProfileDesc] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const startEdit = (p: MemoryProfile) => {
    setEditingId(p.id);
    setEditInstructions(p.instructions);
  };

  const saveEdit = (id: string) => {
    void memoryProfilesStorage.set(list =>
      list.map(p => (p.id === id ? { ...p, instructions: editInstructions } : p)),
    );
    setEditingId(null);
  };

  const addProfile = () => {
    if (!newProfileName.trim()) return;
    const newP: MemoryProfile = {
      id: `custom_${Date.now()}`,
      name: newProfileName.trim(),
      icon: newProfileIcon.trim() || '✨',
      description: newProfileDesc.trim() || 'وضع مخصص',
      instructions: 'أنت مساعد ذكي مخصص...',
      isBuiltin: false,
    };
    void memoryProfilesStorage.set(list => [...list, newP]);
    setNewProfileName('');
    setNewProfileDesc('');
    setShowAdd(false);
  };

  const removeProfile = (id: string) => {
    void memoryProfilesStorage.set(list => list.filter(p => p.id !== id));
    if (activeId === id) void activeMemoryProfileStorage.set('general');
  };

  return (
    <SettingsCard
      title="أوضاع الذاكرة والشخصيات (Memory Profiles)"
      description="اختر وضع الذاكرة التلقائي لكل جلسة عمل، أو قم بتعديل تعليمات كل وضع لتناسب أسلوبك."
      className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {profiles.map(p => {
          const isActive = p.id === activeId;
          const isEditing = p.id === editingId;
          return (
            <div
              key={p.id}
              className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                isActive
                  ? 'border-nb-accent bg-nb-accent/5 ring-1 ring-nb-accent/30'
                  : 'border-nb-border bg-nb-bg hover:border-nb-accent/40'
              }`}>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{p.icon}</span>
                    <span className="font-semibold text-nb-fg text-sm">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-nb-accent text-white'
                          : 'bg-nb-surface text-nb-muted hover:bg-nb-accent/20 hover:text-nb-fg'
                      }`}
                      onClick={() => void activeMemoryProfileStorage.set(p.id)}>
                      {isActive ? 'الوضع النشط ✓' : 'تفعيل'}
                    </button>
                    {!p.isBuiltin ? (
                      <button
                        type="button"
                        aria-label="حذف الوضع"
                        className="rounded p-1 text-nb-muted hover:text-red-500"
                        onClick={() => removeProfile(p.id)}>
                        <TrashIcon size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-nb-muted leading-relaxed">{p.description}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-nb-border/60">
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editInstructions}
                      rows={4}
                      className="w-full rounded-lg border border-nb-border bg-nb-surface/50 p-2 text-xs leading-relaxed focus:border-nb-accent focus:outline-none"
                      onChange={e => setEditInstructions(e.target.value)}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" onClick={() => setEditingId(null)}>
                        إلغاء
                      </Button>
                      <Button onClick={() => saveEdit(p.id)}>حفظ التعليمات</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-nb-link hover:underline"
                    onClick={() => startEdit(p)}>
                    تعديل تعليمات البرومبت الخاصة بهذا الوضع ✏️
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd ? (
        <div className="mt-2 flex flex-col gap-3 rounded-xl border border-nb-border bg-nb-surface/30 p-3.5">
          <div className="font-medium text-xs text-nb-fg">إضافة وضع ذاكرة وشخصية جديدة</div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newProfileIcon}
              className="w-14 text-center"
              placeholder="الأيقونة"
              onChange={e => setNewProfileIcon(e.target.value)}
            />
            <Input
              value={newProfileName}
              className="flex-1 min-w-[150px]"
              placeholder="اسم الوضع (مثلاً: أتمتة البريد 📧)"
              onChange={e => setNewProfileName(e.target.value)}
            />
          </div>
          <Input
            value={newProfileDesc}
            placeholder="وصف مختصر للوضع..."
            onChange={e => setNewProfileDesc(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAdd(false)}>
              إلغاء
            </Button>
            <Button onClick={addProfile}>إضافة الوضع</Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" className="self-start mt-1 flex items-center gap-1.5" onClick={() => setShowAdd(true)}>
          <PlusIcon size={14} />
          إضافة وضع مخصص جديد
        </Button>
      )}
    </SettingsCard>
  );
}

function CustomInstructions() {
  const settings = useStorage(settingsStorage, DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const value = draft ?? settings.customInstructions;
  const save = (text: string) => {
    clearTimeout(timer.current);
    void settingsStorage.set(s => ({ ...s, customInstructions: text })).then(() => setSaved(true));
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <SettingsCard
      title="التعليمات والبرومبت المخصص الشامل (General Custom Prompt)"
      description="تعليمات إضافية وقواعد عامة تطبق على جميع المحادثات وتدمج مع وضع الذاكرة النشط. (سعة ضخمة تصل إلى 50,000 حرف)."
      className="flex flex-col gap-2">
      <textarea
        aria-label="التعليمات المخصصة والبرومبت"
        value={value}
        rows={8}
        maxLength={CUSTOM_INSTRUCTIONS_MAX}
        placeholder="اكتب هنا أي تعليمات إضافية عامة تفضل أن يلتزم بها الوكيل دائماً..."
        className="rounded-lg border border-nb-border bg-nb-bg px-3.5 py-2.5 text-[15px] leading-relaxed focus:border-nb-accent focus:outline-none focus:ring-2 focus:ring-nb-accent/25"
        onChange={e => {
          const text = e.target.value;
          setDraft(text);
          setSaved(false);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => save(text), 600);
        }}
        onBlur={() => draft !== null && draft !== settings.customInstructions && save(draft)}
      />
      <div className="flex items-center justify-between text-xs text-nb-muted">
        <span>
          {value.length.toLocaleString()} / {CUSTOM_INSTRUCTIONS_MAX.toLocaleString()} حرف
        </span>
        {saved && draft !== null && draft === settings.customInstructions ? (
          <span className="text-nb-accent font-medium">تم الحفظ التلقائي بنجاح ✓</span>
        ) : null}
      </div>
    </SettingsCard>
  );
}

function SiteMemoryManager() {
  const memory = useStorage(siteMemoryStorage, {});
  const sites = Object.values(memory);

  const remove = (site: string) => {
    void siteMemoryStorage.set(m => {
      const { [site]: _removed, ...rest } = m;
      return rest;
    });
  };

  const clearAll = () => {
    void siteMemoryStorage.set({});
  };

  return (
    <SettingsCard
      title="ذاكرة المواقع المحفوظة (Site Memory)"
      description="المعلومات والتفضيلات والخطوات التي حفظها الوكيل تلقائياً لكل موقع زرته."
      className="flex flex-col gap-3">
      {sites.length === 0 ? (
        <p className="text-xs text-nb-muted py-2">لا توجد مواقع في الذاكرة بعد. سيحفظ الوكيل تلقائياً تفضيلات المواقع أثناء التصفح.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-xs text-nb-muted mb-1">
            <span>{sites.length} موقع محفوظ</span>
            <button type="button" className="text-red-500 hover:underline" onClick={clearAll}>
              مسح ذاكرة كافة المواقع
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto flex flex-col gap-1.5 divide-y divide-nb-border/40">
            {sites.map(entry => (
              <div key={entry.site} className="flex items-start justify-between gap-3 pt-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs font-semibold text-nb-fg">{entry.site}</span>
                  <span className="text-xs text-nb-muted">{entry.notes}</span>
                </div>
                <button
                  type="button"
                  aria-label="حذف"
                  className="rounded p-1 text-nb-muted hover:text-red-500"
                  onClick={() => remove(entry.site)}>
                  <TrashIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </SettingsCard>
  );
}

export function MemorySection() {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="sr-only">الذاكرة والبرومبت</h2>
      <MemoryProfilesManager />
      <CustomInstructions />
      <SiteMemoryManager />
    </div>
  );
}
