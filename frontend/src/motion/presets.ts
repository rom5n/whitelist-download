import type { Transition, Variants } from 'motion/react';

/**
 * One character of movement across the app: soft springs, no bounce on large elements.
 * - snappy: small reactions (indicators, icons, chips), settles in ~200ms
 * - gentle: larger elements (panels, list items), settles in ~350ms
 */
export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 },
  gentle: { type: 'spring', stiffness: 300, damping: 32, mass: 1 },
} satisfies Record<string, Transition>;

/** Short fades for things that only appear or disappear */
export const fade = { duration: 0.18, ease: [0.22, 1, 0.36, 1] } satisfies Transition;

/** Small elements that pop in (badges, status icons) */
export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1 },
};

/** List items that are added or removed: they rise in and collapse sideways out */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: -6 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: 16, transition: fade },
};
