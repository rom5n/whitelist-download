import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface FadeScrollProps {
  children: ReactNode;
  className?: string;
}

/** Tolerance for sub-pixel scroll positions */
const EDGE_EPSILON = 2;

/**
 * Scrollable area whose top/bottom edges fade out only when there is hidden content in that direction.
 * The fade is a CSS mask (see .fade-scroll), so nothing is re-laid out while scrolling.
 */
export default function FadeScroll({ children, className = '' }: FadeScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.scrollTop > EDGE_EPSILON;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - EDGE_EPSILON;
    setEdges(prev => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Content or container size changes (items added/removed, window resize) change what's hidden
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    const mutations = new MutationObserver(() => {
      for (const child of Array.from(el.children)) observer.observe(child);
      measure();
    });
    mutations.observe(el, { childList: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [measure]);

  return (
    <div
      ref={ref}
      onScroll={measure}
      data-fade-top={edges.top}
      data-fade-bottom={edges.bottom}
      className={`fade-scroll ${className}`}
    >
      {children}
    </div>
  );
}
