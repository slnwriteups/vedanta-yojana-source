import type { ReactNode, RefObject } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { radius, spacing, typography, useTheme } from "../theme";
import { useReadingPreferences } from "../preferences-context.ts";
import { useLanguage } from "../language-context.ts";
import { translateUi } from "../ui-strings.ts";
import {
  extractSpecialNote,
  isListItemLine,
  isVerseLine,
  looksLikeSubheading,
  paragraphsForReading,
  specialNoteListItemSpan,
} from "../../content-lib/text-format.ts";

/**
 * Generic content section: an optional heading over either long-form
 * `text` (paragraph-preserving, mirroring the web app's
 * components/shared/LongFormSection.tsx: real blank-line breaks always
 * honored first, further split at existing sentence boundaries only when
 * a block is too long to read comfortably as one paragraph -- see
 * content-lib/text-format.ts; never rewrites, trims, or otherwise
 * touches the source prose) or arbitrary `children`. Renders nothing
 * when there is neither.
 *
 * Phase 6C reading-comfort pass: capped measure (layout.maxContentWidth,
 * applied by the screen, not here) plus a taller line-height
 * (typography.readingLineHeight) specifically for long-form paragraphs --
 * short "strong"-tier text elsewhere in the app doesn't use this.
 *
 * Phase 6D: paragraph font size now scales by the user's persisted
 * reading preference (content-lib/preferences.ts's FONT_SCALE_STEPS,
 * set from Home). The heading and the underlying text itself are
 * unaffected -- only the paragraph font size, never the content.
 *
 * UI/UX pass: paragraph text renders in the serif reading face
 * (theme.ts's readingFontFamily -- a system font, Georgia on iOS, no
 * new asset). Headings stay in the app's regular sans, matching the
 * common reading-app convention of a sans UI chrome around serif body
 * prose (Apple Books, Kindle) rather than one typeface everywhere.
 *
 * Device-testing pass: a chapter body's own internal sub-headings
 * (found reading real content on a physical device -- artha-panchakam's
 * "Meaning:"/"The Moksha Virodhi", JAYA's embedded "PART IV: ..."
 * section markers) previously rendered identically to a normal
 * paragraph, reading as one undifferentiated block of text. Each
 * paragraph is now checked against looksLikeSubheading() (content-lib/
 * text-format.ts) and, if it qualifies, rendered bold with extra top
 * spacing -- still the same serif reading face and font-scale, still
 * exactly the same text, just visually set apart from the surrounding
 * prose the way a real subsection break should read.
 *
 * Table-of-contents pass: `paragraphRefs`, if supplied, is populated
 * with a native ref for every rendered paragraph, keyed by that
 * paragraph's own index in paragraphsForReading(text) -- the same index
 * getTableOfContents() (content-lib/text-format.ts) reports for each
 * entry. The chapter screen owns the actual scroll (it owns the
 * ScrollView; Section deliberately doesn't), and uses
 * paragraphRefs.current[entry.paragraphIndex].measureLayout(...) to find
 * where to scroll to. Optional and additive -- a caller that never
 * passes it (e.g. any other Section usage) is completely unaffected.
 */
export function Section({
  heading,
  text,
  children,
  paragraphRefs,
}: {
  heading?: string;
  text?: string;
  children?: ReactNode;
  paragraphRefs?: RefObject<Record<number, Text | null>>;
}) {
  const theme = useTheme();
  const { preferences } = useReadingPreferences();
  const { language } = useLanguage();
  if (!text && !children) return null;

  return (
    <View style={styles.section} accessible={false}>
      {heading ? (
        <Text
          style={[styles.heading, { color: theme.colors.foreground }]}
          accessibilityRole="header"
        >
          {heading}
        </Text>
      ) : null}
      {text
        ? (() => {
            const paragraphs = paragraphsForReading(text);
            const nodes: ReactNode[] = [];
            for (let index = 0; index < paragraphs.length; index++) {
              const paragraph = paragraphs[index];
              const specialNote = extractSpecialNote(paragraph);
              if (specialNote !== null) {
                // Any list items immediately following the note (e.g.
                // sri-rangam's "...list of these kshethrams is as
                // follows:" then "1) Vanamamalai" .. "8) Muktinath",
                // each its own paragraph) belong inside the SAME callout
                // -- see specialNoteListItemSpan()'s doc comment.
                const span = specialNoteListItemSpan(paragraphs, index);
                const items = paragraphs.slice(index + 1, index + 1 + span);
                // No paragraphRefs entry here (unlike the plain-paragraph
                // branch below) -- a special note is always excluded from
                // getTableOfContents() (content-lib/text-format.ts), so
                // it's never a jump-scroll target that needs one.
                nodes.push(
                  <View
                    key={index}
                    style={[styles.specialNote, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt }]}
                  >
                    <Text style={[styles.specialNoteLabel, { color: theme.colors.accent }]}>
                      {translateUi("specialNoteLabel", language)}
                    </Text>
                    {[specialNote, ...items].map((line, lineIndex) => (
                      <Text
                        key={lineIndex}
                        style={[
                          styles.paragraph,
                          lineIndex > 0 && styles.specialNoteListItem,
                          {
                            color: theme.colors.foreground,
                            fontFamily: Platform.select(typography.readingFontFamily),
                            fontSize: typography.body * preferences.fontScale,
                            lineHeight: typography.body * preferences.fontScale * typography.readingLineHeight,
                          },
                        ]}
                      >
                        {line}
                      </Text>
                    ))}
                  </View>
                );
                index += span;
                continue;
              }
              const subheading =
                (looksLikeSubheading(paragraph) && !isListItemLine(paragraph)) ||
                isVerseLine(paragraphs, index);
              nodes.push(
                <Text
                  key={index}
                  ref={paragraphRefs ? (node) => { paragraphRefs.current[index] = node; } : undefined}
                  style={[
                    styles.paragraph,
                    subheading && styles.subheading,
                    {
                      color: theme.colors.foreground,
                      fontFamily: Platform.select(typography.readingFontFamily),
                      fontSize: typography.body * preferences.fontScale,
                      lineHeight: typography.body * preferences.fontScale * typography.readingLineHeight,
                    },
                  ]}
                >
                  {paragraph}
                </Text>
              );
            }
            return nodes;
          })()
        : children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    // Bumped from spacing.sm: at the previous 8px, a paragraph break
    // read as barely more than the line-height inside a paragraph --
    // too subtle to register as "chunked into paragraphs" the way a
    // real reading app looks.
    gap: spacing.md,
  },
  heading: {
    fontSize: typography.heading,
    fontWeight: "600",
  },
  paragraph: {
    fontSize: typography.body,
    lineHeight: typography.body * typography.readingLineHeight,
  },
  /** See looksLikeSubheading() in content-lib/text-format.ts for what qualifies and why. */
  subheading: {
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  /** See extractSpecialNote() in content-lib/text-format.ts for what qualifies and why. */
  specialNote: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  specialNoteLabel: {
    fontSize: typography.eyebrow,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  /** Any list items grouped into a special note (see specialNoteListItemSpan()) get a touch less top space than a full paragraph break would. */
  specialNoteListItem: {
    marginTop: spacing.xs,
  },
});
