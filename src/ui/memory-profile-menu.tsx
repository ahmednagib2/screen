import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_MEMORY_PROFILES,
  memoryProfilesStorage,
  activeMemoryProfileStorage,
} from '@src/store/settings';
import type { MemoryProfile } from '@src/store/settings';
import { useStorage } from './hooks';
import { CheckIcon, ChevronIcon } from './icons';

export function MemoryProfileMenu({ size = 'small' }: { size?: 'small' | 'large' }) {
  const large = size === 'large';
  const profiles = useStorage(memoryProfilesStorage, DEFAULT_MEMORY_PROFILES);
  const activeId = useStorage(activeMemoryProfileStorage, 'general');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const current = profiles.find(p => p.id === activeId) ?? profiles[0] ?? DEFAULT_MEMORY_PROFILES[0];

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const select = (id: string) => {
    void activeMemoryProfileStorage.set(id);
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        aria-label={`وضع الذاكرة والعمل: ${current.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`وضع الذاكرة والعمل الحالي: ${current.name}\n${current.description}`}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border border-nb-accent/40 bg-nb-accent/10 font-medium text-nb-accent hover:bg-nb-accent/15 ${
          large ? 'py-1.5 px-3 text-sm' : 'py-1 px-2.5 text-xs'
        } focus:outline-none focus-visible:ring-2 focus-visible:ring-nb-accent/40`}
        onClick={() => setOpen(o => !o)}>
        <span className="text-sm leading-none">{current.icon}</span>
        <span className="max-w-[110px] truncate">{current.name.split(' ')[0]}</span>
        <ChevronIcon size={large ? 14 : 12} className={`transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="أوضاع الذاكرة والعمل"
          tabIndex={-1}
          className={`absolute z-20 flex flex-col rounded-xl border border-nb-border bg-nb-bg p-1.5 shadow-pop ${
            large ? 'left-0 top-full mt-1 w-72 text-sm sm:left-auto sm:right-0' : 'bottom-9 left-0 sm:left-auto sm:right-0 w-72 text-xs'
          }`}>
          <div className="px-2 py-1 text-[11px] font-semibold text-nb-muted uppercase tracking-wider">
            أوضاع الذاكرة والشخصيات
          </div>
          {profiles.map(p => {
            const isSelected = p.id === activeId;
            return (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                className={`flex flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-start transition-colors hover:bg-nb-surface focus-visible:bg-nb-surface focus-visible:outline-none ${
                  isSelected ? 'bg-nb-surface/80 font-medium' : ''
                }`}
                onClick={() => select(p.id)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span>{p.icon}</span>
                    <span className="text-nb-fg">{p.name}</span>
                  </div>
                  {isSelected ? <CheckIcon size={14} className="shrink-0 text-nb-accent" /> : null}
                </div>
                <p className="text-[11px] leading-tight text-nb-muted line-clamp-2">{p.description}</p>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
