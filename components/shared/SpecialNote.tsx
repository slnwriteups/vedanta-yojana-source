import { translateUi } from "@/lib/ui-strings";
import type { LanguageCode } from "@/lib/preferences";

/**
 * A source-flagged "did you know" aside about a kshethram -- see
 * extractSpecialNote() (content-lib/text-format.ts) for the marker
 * convention and why it exists. Rendered as a bordered, tinted callout
 * (mirroring the chapter table-of-contents box's own
 * `rounded-md border border-[var(--border)] p-4` -- see
 * components/library/LocalizedChapterBody.tsx) with a small translated
 * label, matching mobile's identical treatment (Section.tsx,
 * SthalaPuranamWithImages.tsx, and the two Divya Desam screens' own
 * template-field/shrine rendering).
 */
export function SpecialNote({ text, language }: { text: string; language: LanguageCode | null }) {
  return (
    <div className="max-w-2xl space-y-1 rounded-md border border-[var(--border)] bg-[var(--surface-alt)] p-4">
      <p className="text-xs font-semibold tracking-wide text-[var(--accent)] uppercase">
        {translateUi("specialNoteLabel", language)}
      </p>
      <p className="prose-body">{text}</p>
    </div>
  );
}
