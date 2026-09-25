import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig } from 'motion/react';
import { spring } from './presets';

const loadFeatures = () => import('./features').then(module => module.default);

/**
 * Motion is used only for what CSS can't do well: exit animations (AnimatePresence) and layout (FLIP) animations.
 * Its engine is loaded after the first render; `m` components render normally until it arrives.
 * reducedMotion="user" turns transform and layout animations off for people who ask the OS for less motion.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={spring.snappy}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
