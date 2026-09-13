"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { translateUi } from "@/lib/ui-strings";

export interface LightboxImage {
  id: string;
  href: string;
  alt: string;
  altStatus?: string;
}

/**
 * Web port of mobile's ContentImage.tsx + ImageViewerModal.tsx: tapping
 * any thumbnail opens a full-screen view, dismissed by clicking/tapping
 * anywhere, with the same "Tap anywhere to close" hint text. Previously
 * missing entirely on web -- RecordImages.tsx and
 * divya-desams/SthalaPuranamWithImages.tsx rendered plain, non-
 * interactive <img> grids with no way to view a photo full-size.
 *
 * `images` arrive pre-resolved (uuid -> public URL already looked up by
 * the server-rendered caller) so this stays a plain client component
 * with no node:fs dependency, same split as RecordImages/
 * SthalaPuranamWithImages already use for their `language`-reactive
 * text.
 */
export function ImageLightboxGrid({ images, className }: { images: LightboxImage[]; className?: string }) {
  const { language } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex !== null ? images[openIndex] : undefined;

  return (
    <>
      <div className={className ?? "grid grid-cols-2 gap-3 sm:grid-cols-3"}>
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            aria-label={image.alt || translateUi("viewImageFullScreen", language)}
            className="block"
          >
            <img
              src={image.href}
              alt={image.alt}
              data-alt-status={image.altStatus}
              loading="lazy"
              className="aspect-square w-full rounded-md border border-[var(--border)] object-cover"
            />
          </button>
        ))}
      </div>

      {open ? (
        <button
          type="button"
          onClick={() => setOpenIndex(null)}
          aria-label={translateUi("closeImage", language)}
          className="fixed inset-0 z-50 flex h-dvh w-screen flex-col items-center justify-center gap-4 bg-[var(--overlay)] p-4"
        >
          <img src={open.href} alt={open.alt} className="max-h-[70vh] max-w-[92vw] object-contain" />
          <span className="text-sm text-[var(--background)] opacity-80">
            {translateUi("tapAnywhereToClose", language)}
          </span>
        </button>
      ) : null}
    </>
  );
}
