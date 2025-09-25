'use client';
import { useEffect, useRef } from 'react';

export default function FocusTrap({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current!;
    const els = container.querySelectorAll<HTMLElement>('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const first = els[0];
    const last = els[els.length - 1];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div ref={ref}>{children}</div>;
}