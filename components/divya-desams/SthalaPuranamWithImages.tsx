import type { PublicImageEntry } from "@/lib/public-content";
import type { LanguageCode } from "@/lib/preferences";
import {
  extractSpecialNote,
  isListItemLine,
  looksLikeSubheading,
  specialNoteListItemSpan,
  splitIntoReadableParagraphs,
} from "@/content-lib/text-format";
import { ImageLightboxGrid } from "@/components/shared/ImageLightboxGrid";
import { SpecialNote } from "@/components/shared/SpecialNote";

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
 * A chunk that looksLikeSubheading() renders bold, same as
 * LongFormSection -- this component was missing that check entirely
 * until it was found that every record with an after-Sthala-Puranam
 * image (17 records) silently lost subheading emphasis on genuine
 * section labels ("Svāmi Nam Āzhwār", numbered temple-form lists, etc.)
 * purely because it took this rendering path instead of LongFormSection.
 * Images with no
 * anchor (or whose anchor isn't present on this record) render as a
 * trailing group after the whole text -- identical to the pre-existing
 * "after Sthala Puranam" behavior, so this is purely additive.
 */

export interface ResolvedImage {
  image: PublicImageEntry;
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
    <ImageLightboxGrid
      images={images.map(({ image, href }) => ({
        id: image.assetId,
        href,
        alt: image.alt ?? "",
        altStatus: image.altStatus,
      }))}
    />
  );
}

/**
 * `images` are pre-resolved (uuid -> public URL already looked up) by
 * the caller rather than resolved here, so this component has no
 * `node:fs` dependency and can render inside a client component (needed
 * so `text` can react to a client-side language preference) -- see
 * lib/image-file.ts's resolveImageHref, called server-side in
 * app/divya-desams/[slug]/page.tsx before this component ever mounts.
 * `heading` is passed in already localized (LocalizedDivyaDesamContent.tsx
 * translates ui-strings.ts's `sthalaPuranamHeading`, the same key
 * mobile's [slug].tsx screen uses) rather than looked up here.
 */
export function SthalaPuranamWithImages({
  text,
  images,
  heading,
  language,
}: {
  text: string;
  images: ResolvedImage[];
  heading: string;
  language: LanguageCode | null;
}) {
  const segments = buildSegments(text, images);

  // See mobile/components/SthalaPuranamWithImages.tsx's identical
  // `carryingNote` for the full "why": an image's placementAnchor can
  // land mid-note, splitting one continuous special note into two
  // segments around the image. specialNoteListItemSpan() always
  // consumes to the end of whatever paragraph array it's given, so a
  // note found here that runs to this segment's last paragraph should
  // keep rendering as the same callout in the very next TEXT segment,
  // rather than that segment's first paragraph (now with no leading
  // "*") falling back to an unstyled plain paragraph.
  let carryingNote = false;

  return (
    <section aria-labelledby="sthala-puranam-heading" className="max-w-2xl space-y-4">
      <h2 id="sthala-puranam-heading" className="section-heading">
        {heading}
      </h2>
      <div className="space-y-5">
        {segments.map((segment) => {
          if (segment.text === undefined) {
            return (
              <div key={segment.key} className="max-w-none">
                <ImageRow images={segment.images ?? []} />
              </div>
            );
          }

          const segmentParagraphs = splitIntoReadableParagraphs(segment.text);
          const nodes: React.ReactNode[] = [];
          for (let i = 0; i < segmentParagraphs.length; i++) {
            const paragraph = segmentParagraphs[i];
            const specialNote = extractSpecialNote(paragraph);
            const isContinuation = specialNote === null && i === 0 && carryingNote;
            if (specialNote !== null || isContinuation) {
              const span = specialNoteListItemSpan(segmentParagraphs, i);
              const items = segmentParagraphs.slice(i + 1, i + 1 + span);
              nodes.push(
                <SpecialNote
                  key={`${segment.key}-${i}`}
                  text={specialNote ?? paragraph}
                  items={items}
                  language={language}
                  showLabel={!isContinuation}
                />
              );
              i += span;
              carryingNote = true;
              continue;
            }
            carryingNote = false;
            nodes.push(
              <p
                key={`${segment.key}-${i}`}
                className={
                  "prose-body whitespace-pre-line" +
                  (looksLikeSubheading(paragraph) && !isListItemLine(paragraph) ? " mt-2 font-bold" : "")
                }
              >
                {paragraph}
              </p>
            );
          }
          return nodes;
        })}
      </div>
    </section>
  );
}
