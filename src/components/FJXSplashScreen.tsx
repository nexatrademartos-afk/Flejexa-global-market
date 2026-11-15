
import { useEffect, useState } from "react";

type FJXSplashScreenProps = {
  isAppReady?: boolean;
};

const STORAGE_KEY = "flejexa-fjx-intro-play-count-v2";
const MAX_PLAYS = 1;

const styles = `
.fjx-splash {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #000;
  opacity: 1;
  visibility: visible;
  transition: opacity 500ms ease, visibility 500ms ease;
}

.fjx-splash--exit {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.fjx-stage {
  position: relative;
  width: min(94vw, 760px);
  aspect-ratio: 1536 / 1350;
  isolation: isolate;
}

.fjx-piece,
.fjx-complete {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.fjx-piece {
  opacity: 0;
  will-change: transform, opacity;
}

/* F enters from the left */
.fjx-f {
  clip-path: polygon(
    14% 31%, 48% 31%, 48% 48%, 26% 48%,
    26% 57%, 45% 57%, 45% 72%, 26% 72%,
    26% 82%, 14% 82%
  );
  animation: fjx-from-left 950ms cubic-bezier(.16,1,.3,1) 100ms forwards;
}

/* J rises from below */
.fjx-j {
  clip-path: polygon(
    30% 31%, 60% 31%, 60% 75%, 54% 84%,
    42% 84%, 32% 79%, 30% 66%, 41% 66%,
    43% 73%, 50% 73%, 50% 47%, 30% 47%
  );
  animation: fjx-from-bottom 950ms cubic-bezier(.16,1,.3,1) 250ms forwards;
}

/* X enters from the right */
.fjx-x {
  clip-path: polygon(
    56% 34%, 95% 34%, 99% 80%,
    79% 80%, 68% 62%, 56% 49%
  );
  animation: fjx-from-right 950ms cubic-bezier(.16,1,.3,1) 350ms forwards;
}

/* Globe descends from above */
.fjx-globe {
  clip-path: polygon(
    45% 0%, 90% 0%, 90% 51%,
    75% 56%, 64% 46%, 52% 40%, 45% 33%
  );
  animation: fjx-from-top 950ms cubic-bezier(.16,1,.3,1) 500ms forwards;
}

/* Orbital ring sweeps into position */
.fjx-orbit {
  clip-path: polygon(
    0% 30%, 100% 30%, 100% 70%,
    0% 92%
  );
  animation: fjx-orbit-in 1100ms cubic-bezier(.16,1,.3,1) 650ms forwards;
}

.fjx-complete {
  opacity: 0;
  transform: scale(.94);
  animation: fjx-final-reveal 750ms cubic-bezier(.16,1,.3,1) 1650ms forwards;
  will-change: transform, opacity;
}

.fjx-flash {
  position: absolute;
  inset: -20%;
  z-index: 5;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(
    110deg,
    transparent 38%,
    rgba(255,255,255,.05) 44%,
    rgba(255,211,77,.9) 50%,
    rgba(255,255,255,.35) 53%,
    transparent 61%
  );
  transform: translateX(-120%);
  animation: fjx-shine 850ms ease-out 1950ms forwards;
}

.fjx-tagline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -7%;
  color: #D6AD45;
  text-align: center;
  font-family: Arial, sans-serif;
  font-size: clamp(10px, 2.1vw, 15px);
  font-weight: 600;
  letter-spacing: .25em;
  opacity: 0;
  animation: fjx-tagline-in 500ms ease 2150ms forwards;
}

@keyframes fjx-from-left {
  from { opacity: 0; transform: translateX(-110vw) rotate(-8deg); }
  to { opacity: 1; transform: translateX(0) rotate(0); }
}

@keyframes fjx-from-right {
  from { opacity: 0; transform: translateX(110vw) rotate(8deg); }
  to { opacity: 1; transform: translateX(0) rotate(0); }
}

@keyframes fjx-from-top {
  from { opacity: 0; transform: translateY(-100vh) scale(.65); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes fjx-from-bottom {
  from { opacity: 0; transform: translateY(90vh) scale(.65); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes fjx-orbit-in {
  from { opacity: 0; transform: translate(-75vw, 45vh) rotate(-25deg); }
  to { opacity: 1; transform: translate(0, 0) rotate(0); }
}

@keyframes fjx-final-reveal {
  0% { opacity: 0; transform: scale(.94); }
  70% { opacity: 1; transform: scale(1.025); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes fjx-shine {
  0% { opacity: 0; transform: translateX(-120%); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateX(120%); }
}

@keyframes fjx-tagline-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 480px) {
  .fjx-stage {
    width: 98vw;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fjx-piece,
  .fjx-complete,
  .fjx-flash,
  .fjx-tagline {
    animation-duration: 1ms !important;
    animation-delay: 0ms !important;
  }
}
`;

export default function FJXSplashScreen({
  isAppReady = true,
}: FJXSplashScreenProps) {
  const [visible, setVisible] = useState(false);
  const [animationFinished, setAnimationFinished] = useState(false);
  const [exiting, setExiting] = useState(false);

    useEffect(() => {
    let playCount = 0;

    try {
      playCount = Number(localStorage.getItem(STORAGE_KEY) || "0");
    } catch {
      // If persistent storage is unavailable, do not block the website.
      return;
    }

    if (!Number.isFinite(playCount) || playCount >= MAX_PLAYS) {
      return;
    }

    // Record this appearance so it cannot play more than twice.
    try {
      localStorage.setItem(
        STORAGE_KEY,
        String(playCount + 1)
      );
    } catch {
      return;
    }

    setVisible(true);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const timer = window.setTimeout(
      () => setAnimationFinished(true),
      reducedMotion ? 350 : 2600
    );

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible || !animationFinished || !isAppReady) {
      return;
    }

    setExiting(true);

    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // The splash still works without session storage.
    }

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 550);

    return () => window.clearTimeout(timer);
  }, [visible, animationFinished, isAppReady]);

  if (!visible) return null;

  const logo = "/images/fjx-logo.png";

  return (
    <>
      <style>{styles}</style>

      <div
        className={`fjx-splash ${
          exiting ? "fjx-splash--exit" : ""
        }`}
        role="status"
        aria-label="Loading FleJexa Global Mart"
        aria-live="polite"
      >
        <div className="fjx-stage">

          <img
            src={logo}
            className="fjx-piece fjx-f"
            alt=""
            aria-hidden="true"
          />

          <img
            src={logo}
            className="fjx-piece fjx-j"
            alt=""
            aria-hidden="true"
          />

          <img
            src={logo}
            className="fjx-piece fjx-x"
            alt=""
            aria-hidden="true"
          />

          <img
            src={logo}
            className="fjx-piece fjx-globe"
            alt=""
            aria-hidden="true"
          />

          <img
            src={logo}
            className="fjx-piece fjx-orbit"
            alt=""
            aria-hidden="true"
          />

          <img
            src={logo}
            className="fjx-complete"
            alt="FJX FleJexa Global Mart"
          />

          <div className="fjx-flash" />

          <div className="fjx-tagline">
            FLEJEXA GLOBAL MART
          </div>

        </div>
      </div>
    </>
  );
}
