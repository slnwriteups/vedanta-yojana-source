import type { ImageEntry } from "@/content-lib/schemas";
import { splitIntoReadableParagraphs } from "@/content-lib/text-format";

/**
 * Renders Sthala Puranam interleaved with the images the source itself
 * placed alongside specific sub-sections of it (Phase 6E-C follow-up:
 * "the positioning of the pictures is still not happening correctly").
 * A coarser "before/after the whole text" split still left every
 * "after" image in one undifferentiated cluster for records with
 * several named sub-shrines/legends (e.g. Singavelkundram/Ahobilam's
 * nine Narasimha forms, Tirudwarkai's Beyt/Dakor/Shrinathji
 * sub-temples). Each image's `placementAnchor` (content-lib/schemas/
 * shared.ts) is a real line copied verbatim from this same
 * `sthalaPuranam` string -- this component finds that exact line and
 * inserts the image immediately after it, splitting that one paragraph
 * into two <p> elements around the insertion point (every other
 * paragraph renders exactly as LongFormSection already does: one
 * whitespace-pre-line <p> per `\n{2,}`-separated chunk, further split at
 * sentence boundaries by splitIntoReadableParagraphs when a chunk is
 * still too long to read comfortably -- see content-lib/text-format.ts).
 * Images with no
 * anchor (or whose anchor isn't present on this record) render as a
 * trailing group after the whole text -- identical to the pre-existing
 * "after Sthala Puranam" behavior, so this is purely additive.
 */

export interface ResolvedImage {
  image: ImageEntry;
  href: string;
}

interface Segment {
  key: string;
  text?: string;
  images?: ResolvedImage[];
}

function buildSegments(text: string, images: ResolvedImage[]): Segment[] {
  const paragraphs = text.split(/\n{2,}/);
  const segments: Segment[] = [];
  const usedAssetIds = new Set<string>();

  paragraphs.forEach((paragraph, pIdx) => {
    const lines = paragraph.split("\n");
    let bufferStart = 0;
    lines.forEach((line, lIdx) => {
      const trimmed = line.trim();
      const matched = images.filter(
        ({ image }) => image.placementAnchor === trimmed && !usedAssetIds.has(image.assetId)
      );
      if (matched.length === 0) return;

      const chunk = lines.slice(bufferStart, lIdx + 1).join("\n");
      segments.push({ key: `p${pIdx}-t${bufferStart}`, text: chunk });
      segments.push({ key: `p${pIdx}-img${lIdx}`, images: matched });
      matched.forEach(({ image }) => usedAssetIds.add(image.assetId));
      bufferStart = lIdx + 1;
    });
    if (bufferStart < lines.length) {
      segments.push({ key: `p${pIdx}-tail`, text: lines.slice(bufferStart).join("\n") });
    }
  });

  const trailing = images.filter(({ image }) => !usedAssetIds.has(image.assetId));
  if (trailing.length > 0) {
    segments.push({ key: "trailing", images: trailing });
  }
  return segments;
}

function ImageRow({ images }: { images: ResolvedImage[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {images.map(({ image, href }) => (
        <img
          key={image.assetId}
          src={href}
          alt={image.alt ?? ""}
          data-alt-status={image.altStatus}
          loading="lazy"
          className="aspect-square w-full rounded-md border border-[var(--border)] object-cover"
        />
      ))}
    </div>
  );
}

/**
 * `images` are pre-resolved (uuid -> public URL already looked up) by
 * the caller rather than resolved here, so this component has no
 * `node:fs` dependency and can render inside a client component (needed
 * so `text` can react to a client-side language preference) -- see
 * lib/image-file.ts's resolveImageHref, called server-side in
 * app/divya-desams/[slug]/page.tsx before this component ever mounts.
 */
export function SthalaPuranamWithImages({ text, images }: { text: string; images: ResolvedImage[] }) {
  const segments = buildSegments(text, images);

  return (
    <section aria-labelledby="sthala-puranam-heading" className="max-w-2xl space-y-4">
      <h2 id="sthala-puranam-heading" className="section-heading">
        Sthala Puranam
      </h2>
      <div className="space-y-5">
        {segments.map((segment) =>
          segment.text !== undefined ? (
            splitIntoReadableParagraphs(segment.text).map((paragraph, i) => (
              <p key={`${segment.key}-${i}`} className="prose-body whitespace-pre-line">
                {paragraph}
              </p>
            ))
          ) : (
            <div key={segment.key} className="max-w-none">
              <ImageRow images={segment.images ?? []} />
            </div>
          )
        )}
      </div>
    </section>
  );
}
