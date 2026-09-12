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
/**
 * Absolute worst-case wait before begin() gives up and navigates away
 * regardless of the audio's own state -- covers a stalled/slow
 * connection, a playback error, or any other case where the "ended"
 * event never fires. Comfortably above the real clip's own ~17.5s
 * duration (confirmed via `afinfo public/audio/vy-welcome.mp3`) so it
 * never cuts a normal, successful playback short; only ever kicks in
 * when something has actually gone wrong. Never strand the visitor on
 * the welcome screen waiting for audio that isn't coming.
 */
const AUDIO_FALLBACK_TIMEOUT_MS = 25000;

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
  const [dismissing, setDismissing] = useState(false);
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
    if (dismissing) return;
    setDismissing(true);
    window.sessionStorage.setItem(SEEN_KEY, "1");
    const audio = audioRef.current;
    if (!audio) {
      setShowWelcome(false);
      return;
    }

    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      setShowWelcome(false);
    }

    // Wait for the clip to actually finish ("ended") before navigating
    // away -- the welcome screen is meant to play the chime out in
    // full, not cut it short the instant "Begin" is tapped.
    audio.addEventListener("ended", dismiss, { once: true });
    // If playback never starts or never finishes for some other reason
    // (blocked, a network/decoding error, a stalled connection), don't
    // strand the visitor here indefinitely.
    audio.addEventListener("error", dismiss, { once: true });
    window.setTimeout(dismiss, AUDIO_FALLBACK_TIMEOUT_MS);

    // A real click/tap is a genuine user gesture, so this play() call
    // (unlike the mount-time attempt above) is NOT blocked by the
    // browser's autoplay policy. If it was already playing from the
    // mount-time attempt succeeding, this is a harmless no-op.
    audio.play().catch(dismiss);
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
              disabled={dismissing}
              className="rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--surface)] transition-opacity hover:opacity-90 disabled:opacity-70"
            >
              {/* Visible feedback for the ~17s wait while the chime plays
                  out in full -- otherwise a silently disabled button for
                  that long reads as stuck rather than intentional. */}
              {dismissing ? "Playing…" : "Begin"}
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
