import type { ImageEntry } from "@/content-lib/schemas";
import { resolveImageHref } from "@/lib/image-file";
import { ImageLightboxGrid } from "@/components/shared/ImageLightboxGrid";

/**
 * Renders images[] as static files under public/images/, resolved from
 * sourceAssetUuid to a real filename at build time by resolveImageHref
 * (see lib/image-file.ts) -- nothing is copied, renamed, or re-encoded.
 * This replaced the Phase 5K runtime route (app/images/[uuid]/route.ts)
 * during the GitHub Pages migration, which removed the Node.js runtime a
 * route handler needs. Originally
 * Phase 5K's DivyaDesamImages; relocated to components/shared/ and renamed
 * in Phase 5L since it is not Divya-Desam-specific -- Chapters and
 * Knowledge records use the exact same ImageEntry shape. Behavior
 * unchanged.
 *
 * Every migrated image currently has alt: null and altStatus:
 * "needs-review" (no human has confirmed real alt text yet). That is NOT
 * the same as "decorative" -- but since no meaningful alt text exists to
 * render, the only accessibility-safe, non-fabricating choice available
 * today is an empty alt (a technically correct, purely-decorative
 * treatment). The underlying altStatus is preserved as a data attribute
 * rather than discarded, so a later editorial-review phase (5N) can still
 * find these images. This is a presentation compromise, not an editorial
 * judgment that the images are actually decorative.
 */
/**
 * No "Images" heading: mobile's ContentImage.tsx deliberately dropped it
 * ("it rendered at the exact same weight as real section headings...
 * implying equal informational content where there was none; a gallery
 * of real photos doesn't need a label saying 'Images' any more than
 * body text needs one saying 'Text'") -- matched here for the same
 * reason.
 */
export function RecordImages({ images }: { images: ImageEntry[] }) {
  // An image whose UUID has no matching file is dropped rather than
  // rendered with a src that is certain to 404. Resolution happens here,
  // during the static pre-render, so a missing asset is visible at build
  // time instead of as a broken image in someone's browser.
  const resolved = images.flatMap((image) => {
    const href = resolveImageHref(image.sourceAssetUuid);
    return href ? [{ image, href }] : [];
  });

  if (resolved.length === 0) return null;

  return (
    <ImageLightboxGrid
      images={resolved.map(({ image, href }) => ({
        id: image.assetId,
        href,
        alt: image.alt ?? "",
        altStatus: image.altStatus,
      }))}
    />
  );
}
