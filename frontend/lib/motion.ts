import type { Transition, Variants } from "framer-motion";

/**
 * Shared easing/timing so every screen feels like the same product. Two
 * curves only: `easeOut` for things entering (fast start, gentle stop) and
 * `spring` for anything that should feel touchable (cards, panels, toggles).
 */
export const easeOut: Transition = { duration: 0.5, ease: [0.16, 1, 0.3, 1] };
export const easeOutFast: Transition = { duration: 0.28, ease: [0.16, 1, 0.3, 1] };
export const spring: Transition = { type: "spring", stiffness: 300, damping: 28 };
export const springSnappy: Transition = { type: "spring", stiffness: 420, damping: 32 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: easeOut },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: spring },
};

/** For side panels (AI Tutor chat, mobile drawers). */
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 32 },
  show: { opacity: 1, x: 0, transition: spring },
  exit: { opacity: 0, x: 32, transition: easeOutFast },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -32 },
  show: { opacity: 1, x: 0, transition: spring },
  exit: { opacity: 0, x: -32, transition: easeOutFast },
};

/** Parent wrapper — stagger children entrance by `staggerChildren`. */
export function staggerContainer(staggerChildren = 0.08, delayChildren = 0): Variants {
  return {
    hidden: {},
    show: {
      transition: { staggerChildren, delayChildren },
    },
  };
}

/** Question-to-question / step-to-step transitions (questionnaire, wizards). */
export const stepSlide: Variants = {
  enter: (direction: 1 | -1) => ({ opacity: 0, x: direction * 24 }),
  center: { opacity: 1, x: 0, transition: easeOut },
  exit: (direction: 1 | -1) => ({ opacity: 0, x: direction * -24, transition: easeOutFast }),
};

/** Full-page route transitions. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: easeOut },
  exit: { opacity: 0, y: -8, transition: easeOutFast },
};

/** Tactile press feedback for option cards / buttons that should feel physical. */
export const tapScale = { scale: 0.97 };
export const hoverLift = { y: -4, transition: springSnappy };

export const reduceMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
