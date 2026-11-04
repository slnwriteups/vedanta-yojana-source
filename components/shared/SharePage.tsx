"use client";

import { useEffect, useRef, useState } from "react";

/** Small, reader-initiated sharing controls; no external widget scripts. */
export function SharePage({ title, url }: { title: string; url: string }) {
  const [absoluteUrl, setAbsoluteUrl] = useState(url);
  const [canShare, setCanShare] = useState(false);
  const [status, setStatus] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAbsoluteUrl(new URL(url, window.location.origin).href);
    setCanShare(typeof navigator.share === "function");
  }, [url]);

  useEffect(() => {
    if (manualCopy) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [manualCopy]);

  async function copyLink() {
    setStatus("");
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setManualCopy(false);
      setStatus("Link copied");
    } catch {
      setManualCopy(true);
      setStatus("Select and copy the link below.");
    }
  }

  async function share() {
    setBusy(true);
    setStatus("");
    try {
      await navigator.share({ title, url: absoluteUrl });
    } catch (error) {
      // Cancelling the share sheet is not an error for the reader.
      if (!(error instanceof Error && error.name === "AbortError")) {
        await copyLink();
      }
    } finally {
      setBusy(false);
    }
  }

  const buttonClass = "inline-flex items-center rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

  return (
    <div lang="en" className="space-y-3 border-t border-[var(--border)] pt-5">
      <div role="group" aria-label="Share this page" className="flex flex-wrap items-center gap-2">
        {canShare ? (
          <button type="button" onClick={share} disabled={busy} className={buttonClass}>
            Share
          </button>
        ) : null}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${title}\n${absoluteUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass}
        >
          WhatsApp<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <button type="button" onClick={copyLink} className={buttonClass}>Copy link</button>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-[var(--muted)]">{status}</p>
      {manualCopy ? (
        <label className="block text-sm">
          Page link
          <input
            ref={inputRef}
            value={absoluteUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 block w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          />
        </label>
      ) : null}
    </div>
  );
}
