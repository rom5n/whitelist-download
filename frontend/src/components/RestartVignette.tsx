import { createPortal } from 'react-dom';

/**
 * A soft orange glow along the edges of the browser window while a restart is required.
 * It is portaled to <body> and sits above everything (the header included) without catching clicks.
 * The window is rectangular, so the glow has no rounded corners; only its opacity is animated.
 */
export default function RestartVignette({ visible }: { visible: boolean }) {
  return createPortal(
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[100] transition-opacity duration-500 ease-in-out
                  shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--warn)_35%,transparent),inset_0_0_80px_0_color-mix(in_srgb,var(--warn)_22%,transparent)]
                  ${visible ? 'opacity-100 starting:opacity-0' : 'opacity-0'}`}
    />,
    document.body,
  );
}
