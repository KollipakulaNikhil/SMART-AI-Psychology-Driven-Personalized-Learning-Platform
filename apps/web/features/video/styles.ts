/**
 * Ambient motion lives in CSS keyframes (not framer loops) so a single
 * `data-paused` attribute freezes the whole picture when the video pauses.
 */
export const EXPLAINER_CSS = `
.xv-root { container-type: inline-size; }
@keyframes xv-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4%) } }
@keyframes xv-drift { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(7%,5%) scale(1.18) } }
@keyframes xv-spin { to { transform: rotate(360deg) } }
@keyframes xv-spin-rev { to { transform: rotate(-360deg) } }
@keyframes xv-pulse { 0%,100% { opacity: .5; transform: scale(1) } 50% { opacity: 1; transform: scale(1.1) } }
@keyframes xv-blink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(.08) } }
@keyframes xv-talk { 0%,100% { transform: scaleY(.25) } 25% { transform: scaleY(1) } 50% { transform: scaleY(.4) } 75% { transform: scaleY(.9) } }
@keyframes xv-bob { 0%,100% { transform: translateY(0) rotate(-1.2deg) } 50% { transform: translateY(-2.5%) rotate(1.2deg) } }
@keyframes xv-wave { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-26deg) } 75% { transform: rotate(14deg) } }
@keyframes xv-march { to { stroke-dashoffset: -44 } }
@keyframes xv-confetti { 0% { transform: translateY(-15%) rotate(0); opacity: 1 } 100% { transform: translateY(125%) rotate(600deg); opacity: 0 } }
@keyframes xv-twinkle { 0%,100% { opacity: .15 } 50% { opacity: 1 } }
@keyframes xv-sheen { from { transform: translateX(-120%) } to { transform: translateX(220%) } }

.xv-float { animation: xv-float 6s ease-in-out infinite; }
.xv-drift { animation: xv-drift 14s ease-in-out infinite; }
.xv-spin { animation: xv-spin 24s linear infinite; }
.xv-spin-rev { animation: xv-spin-rev 24s linear infinite; }
.xv-pulse { animation: xv-pulse 2.4s ease-in-out infinite; }
.xv-blink { animation: xv-blink 4.6s infinite; transform-box: fill-box; transform-origin: center; }
.xv-bob { animation: xv-bob 3.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
.xv-wave { animation: xv-wave 1.1s ease-in-out infinite; transform-box: view-box; }
.xv-march { animation: xv-march 1.4s linear infinite; }
.xv-twinkle { animation: xv-twinkle 3s ease-in-out infinite; }
.xv-talk { animation: xv-talk .42s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }

.xv-root[data-paused="true"] *,
.xv-root[data-paused="true"] *::before { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) {
  .xv-root * { animation: none !important; }
}
`;
