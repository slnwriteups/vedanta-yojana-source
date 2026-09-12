"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Restores the legacy SAP Build app's real launch screen (page.Page1,
 * "Welcome to Vedanta Yojana") -- title, Sanskrit tagline, the Vedanta
 * Desikan invocation image, and the ambient audio the original page
 * autoplayed on load. Recovered from the frozen source-extraction
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
 */

const SEEN_KEY = "vy-welcome-seen";

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
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!window.sessionStorage.getItem(SEEN_KEY)) {
      setShowWelcome(true);
    }
  }, []);

  useEffect(() => {
    if (!showWelcome) return;
    // Autoplay-with-sound is blocked by most browsers absent a prior
    // user gesture -- expected on first paint, not an error to surface.
    // If blocked, the button below is still a real user gesture that
    // can start it.
    audioRef.current?.play().catch(() => {});
  }, [showWelcome]);

  function begin() {
    window.sessionStorage.setItem(SEEN_KEY, "1");
    // A real click/tap is a genuine user gesture, so this play() call
    // (unlike the mount-time attempt above) is NOT blocked by the
    // browser's autoplay policy -- this is the actual, working fallback
    // the comment above already described, not just the mount attempt.
    // Left playing (not paused) so it's audible over the transition into
    // the app rather than being silenced the instant it could finally
    // start.
    void audioRef.current?.play().catch(() => {});
    setShowWelcome(false);
  }

  return (
    <>
      {children}
      {/*
       * Rendered unconditionally (not just while the overlay below is
       * shown) so the element stays mounted -- and therefore actually
       * keeps playing -- once begin() starts it and dismisses the
       * overlay. Unmounting an <audio> element stops it instantly, which
       * would have silently defeated the whole "let it play over the
       * transition" fix if this lived inside the `showWelcome`-only
       * block below.
       */}
      <audio ref={audioRef} src={audioHref} preload="auto" />
      {showWelcome ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-heading"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-[var(--background)] px-6 py-10 text-center"
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
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={begin}
              className="rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition-opacity hover:opacity-90"
            >
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
        </div>
      ) : null}
    </>
  );
}
