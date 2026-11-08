"use client";

import { useEffect } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Registers public/sw.js, which gives the website the app's Pasuram
 * mechanics: Pasurams a reader opens are kept for offline reading and
 * refreshed when Prapatti.com corrects them. Asks the service worker to
 * check for corrections whenever the site comes online -- on load and
 * when the connection comes back -- mirroring the app's
 * startCorrectionChecks() (the worker itself limits this to once a day).
 *
 * Production only: a service worker in `next dev` would serve stale
 * builds while developing.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    const askForCheck = () => {
      navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage({ type: "check-pasurams" })).catch(() => {});
    };

    navigator.serviceWorker
      .register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` })
      .then(askForCheck)
      .catch(() => {});

    window.addEventListener("online", askForCheck);
    return () => window.removeEventListener("online", askForCheck);
  }, []);

  return null;
}

/** Asks the service worker to keep a Pasuram for offline reading (no-op without one). */
export function keepPasuramForOffline(path: string): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.controller?.postMessage({ type: "keep-pasuram", path });
}
