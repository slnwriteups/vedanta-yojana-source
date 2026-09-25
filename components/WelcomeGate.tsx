"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Restores the legacy SAP Build app's real launch screen (page.Page1,
 * "Welcome to Vedanta Yojana") -- title, Sanskrit tagline, the Vedanta
 * Desikan invocation image, and the Ācārya Taniyan ("Rāmānuja
 * Dayāpatram") audio. Recovered from the frozen source-extraction
 * snapshot's page-content data (text/image) and a Cloudinary URL the
 * user supplied directly from the original app's own embedded HTML
 * (audio) -- not fabricated.
 *
 * Shown once per browser SESSION, not once ever -- sessionStorage (not
 * localStorage) clears itself when the tab/browser closes, mirroring
 * the mobile app's "shows again on every fresh launch, not just once
 * per install" behavior, per explicit direction. Renders `children`
 * untouched everywhere except the one-time overlay on top of them, so
 * there is no dependency on which page happens to be first.
 *
 * Listening is optional (web only -- mobile/components/WelcomeScreen.tsx
 * is unchanged): Begin leads to a choice between Listen and Continue,
 * nothing plays until Listen is pressed, and Skip is available for the
 * whole of playback. Flow: "welcome" -> Begin -> "choice" -> Continue
 * (enter) or Listen -> "playing" -> Skip or the clip ending (enter).
 */

const SEEN_KEY = "vy-welcome-seen";
/**
 * Absolute worst-case wait before listen() gives up and enters the site
 * regardless of the audio's own state -- covers a stalled/slow
 * connection, a playback error, or any other case where the "ended"
 * event never fires. Comfortably above the real clip's own ~17.5s
 * duration (confirmed via `afinfo public/audio/vy-welcome.mp3`) so it
 * never cuts a normal, successful playback short; only ever kicks in
 * when something has actually gone wrong. Never strand the visitor on
 * the welcome screen waiting for audio that isn't coming.
 */
const AUDIO_FALLBACK_TIMEOUT_MS = 25000;

type Phase = "welcome" | "choice" | "playing";

export function WelcomeGate({
  children,
  imageHref,
  audioHref,
}: {
  children: React.ReactNode;
  imageHref: string | null;
  audioHref: string;
}) {
  const [showWelcome, setShowWelcome] = useState(false);
  const [phase, setPhase] = useState<Phase>("welcome");
  const audioRef = useRef<HTMLAudioElement>(null);
  // Refs, not state: rapid repeated taps can land before a re-render, so
  // the one-shot guards must be synchronous.
  const listeningRef = useRef(false);
  const enteredRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!window.sessionStorage.getItem(SEEN_KEY)) {
      setShowWelcome(true);
    }
  }, []);

  // Never leave the taniyan playing behind an unmounted gate.
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
      audio?.pause();
    };
  }, []);

  /** Stops any playback and reveals the site -- runs at most once. */
  function enterSite() {
    if (enteredRef.current) return;
    enteredRef.current = true;
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.removeEventListener("ended", enterSite);
      audio.removeEventListener("error", enterSite);
      audio.pause();
      audio.currentTime = 0;
    }
    window.sessionStorage.setItem(SEEN_KEY, "1");
    setShowWelcome(false);
  }

  function begin() {
    setPhase("choice");
  }

  function listen() {
    if (listeningRef.current || enteredRef.current) return;
    listeningRef.current = true;
    const audio = audioRef.current;
    if (!audio) {
      enterSite();
      return;
    }
    setPhase("playing");
    audio.addEventListener("ended", enterSite, { once: true });
    audio.addEventListener("error", enterSite, { once: true });
    fallbackTimerRef.current = window.setTimeout(enterSite, AUDIO_FALLBACK_TIMEOUT_MS);
    // Called directly from the Listen click -- a genuine user gesture, so
    // the browser's autoplay policy allows it. If playback is refused
    // anyway, don't strand the visitor: go straight in.
    audio.play().catch(enterSite);
  }

  const secondaryButton =
    "rounded-md border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--accent)]";
  const primaryButton =
    "rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition-opacity hover:opacity-90";

  return (
    <>
      {children}
      {/*
       * preload="auto" only buffers the file so Listen starts promptly;
       * nothing plays until listen() is called from the Listen button.
       */}
      <audio ref={audioRef} src={audioHref} preload="auto" />
      {showWelcome ? (
        // Explicit h-dvh (dynamic viewport height), not just inset-0's
        // implicit sizing -- on mobile Safari a `fixed` element's height
        // from `inset-0` alone can be computed against the LARGE
        // viewport (address bar hidden) even while the bar is actually
        // showing, so centered content sits higher than the real
        // visible center and can require a scroll to see the bottom.
        // `dvh` tracks the actual visible viewport as the browser
        // chrome shows/hides, keeping the image/heading/button block
        // genuinely centered on a real phone.
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-heading"
          className="fixed inset-0 z-[100] flex h-dvh w-screen flex-col items-center justify-center gap-6 overflow-y-auto bg-[var(--background)] px-6 py-10 text-center"
        >
          {imageHref ? (
            <img
              src={imageHref}
              alt="Swami Vedanta Desikan, with the invocation verse in Sanskrit"
              className="h-auto max-h-[45vh] w-auto max-w-full"
            />
          ) : null}
          <div className="space-y-2">
            <h1 id="welcome-heading" className="text-2xl font-semibold text-[var(--foreground)]">
              Welcome to Vedanta Yojana
            </h1>
            <p className="text-sm text-[var(--muted)]">Yatra Jñānam Pravahati</p>
          </div>
          {phase === "welcome" ? (
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={begin} className={primaryButton}>
                Begin
              </button>
              {/*
               * Matches mobile/components/WelcomeScreen.tsx: "Begin" is the
               * button's own legible label (Sanskrit transliteration isn't
               * immediately readable on first launch), and the original
               * primary label, "Jñānayātrām Pravartaya", is kept as a caption
               * underneath rather than removed, so the screen keeps its
               * Sanskrit invocation without making the one interactive
               * control on the screen ambiguous.
               */}
              <p className="text-xs text-[var(--muted)]">Jñānayātrām Pravartaya</p>
            </div>
          ) : phase === "choice" ? (
            <div className="flex flex-col items-center gap-4">
              <div className="space-y-1">
                <p className="text-sm text-[var(--foreground)]">Would you like to listen to the Ācārya Taniyan?</p>
                <p className="text-sm italic text-[var(--muted)]">Rāmānuja Dayāpatram</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={listen} className={primaryButton} autoFocus>
                  <span aria-hidden="true">🔊 </span>Listen
                </button>
                <button type="button" onClick={enterSite} className={secondaryButton}>
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm italic text-[var(--muted)]" role="status">
                <span aria-hidden="true">🔊 </span>Rāmānuja Dayāpatram
              </p>
              <button type="button" onClick={enterSite} className={secondaryButton} autoFocus>
                Skip <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
