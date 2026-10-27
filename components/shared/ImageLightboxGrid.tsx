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
export function ImageLightboxGrid({
  images,
  className,
  feature = false,
}: {
  images: LightboxImage[];
  className?: string;
  /**
   * Lead with the first image large (a record's top images): two images
   * sit side by side at 4:3; three or more put the first across two
   * columns and two rows, with the rest square beside and below it.
   */
  feature?: boolean;
}) {
  const { language } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex !== null ? images[openIndex] : undefined;

  return (
    <>
      <div className={className ?? featureGridClass(feature, images.length)}>
        {images.map((image, index) => {
          const lead = feature && index === 0;
          return (
            <button
              key={image.id}
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={image.alt || translateUi("viewImageFullScreen", language)}
              className={lead && images.length > 2 ? "col-span-2 row-span-2 block" : "block"}
            >
              <img
                src={image.href}
                alt={image.alt}
                data-alt-status={image.altStatus}
                loading={lead ? "eager" : "lazy"}
                className={`w-full rounded-md object-cover ${
                  feature && images.length <= 2 ? "aspect-[4/3]" : lead ? "aspect-square h-full" : "aspect-square"
                }`}
              />
            </button>
          );
        })}
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

function featureGridClass(feature: boolean, count: number): string {
  if (!feature) return "grid grid-cols-2 gap-3 sm:grid-cols-3";
  if (count === 1) return "grid grid-cols-1";
  if (count === 2) return "grid grid-cols-2 gap-3";
  return "grid grid-cols-2 gap-3 sm:grid-cols-4";
}
