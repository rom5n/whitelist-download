import { useCallback } from 'react';

/**
 * Returns a ref for a scroll container that marks where content is hidden: data-fade-start when it is
 * scrolled away from the start, data-fade-end when there is more below. The `scroll-fade` utility turns
 * them into soft edges, so the fade shows only where there is something to scroll to.
 */
export function useScrollFade<T extends HTMLElement>() {
  return useCallback((element: T | null) => {
    if (!element) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const { scrollTop, scrollHeight, clientHeight } = element;
      element.toggleAttribute('data-fade-start', scrollTop > 1);
      element.toggleAttribute('data-fade-end', scrollTop + clientHeight < scrollHeight - 1);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    element.addEventListener('scroll', schedule, { passive: true });
    // The content can grow or shrink without the container changing its size
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    const mutations = new MutationObserver(schedule);
    mutations.observe(element, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('scroll', schedule);
      resize.disconnect();
      mutations.disconnect();
    };
  }, []);
}
