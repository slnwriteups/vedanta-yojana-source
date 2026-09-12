"use client";

import { useLanguage } from "@/lib/language-context";
import { translateUi } from "@/lib/ui-strings";

/**
 * Web port of mobile/components/SocialButton.tsx -- a single external
 * social-profile button, visually matching the pill-style buttons
 * elsewhere in Settings. Kept generic over icon/label/url rather than
 * hardcoded to Instagram, in case another profile is added later.
 * `icon` is a small inline SVG rather than an icon-library glyph (mobile
 * uses @expo/vector-icons' Ionicons) -- avoids adding an icon-library
 * dependency for a single glyph; the Instagram mark itself is the
 * standard simple outline, not a fabricated logo.
 */
export function SocialButton({
  icon,
  label,
  url,
}: {
  icon: "instagram";
  label: string;
  url: string;
}) {
  const { language } = useLanguage();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}${translateUi("opensInBrowserSuffix", language)}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-1.5 text-sm font-semibold text-[var(--accent)] hover:border-[var(--accent)]"
    >
      <InstagramGlyph />
      {label}
    </a>
  );

  function InstagramGlyph() {
    if (icon !== "instagram") return null;
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
}
