"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/ui-strings";
import { placeLabel, type ChosenPlace } from "@/content-lib/panchangam-place.ts";

type SearchPlaces = (text: string, limit?: number) => ChosenPlace[];

/**
 * Web twin of mobile/components/PanchangamPlacePicker.tsx: lets the
 * reader choose any city for the Panchangam, or go back to the browser's
 * own location. The search runs over the bundled place list in the
 * browser -- nothing typed here is sent anywhere. The list is a separate
 * chunk, loaded the first time the picker opens.
 */
export function PanchangamPlacePicker({
  current,
  onChoose,
  onClose,
}: {
  current: ChosenPlace | null;
  onChoose: (place: ChosenPlace | null) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchPlaces | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/content-lib/panchangam-places.ts").then((m) => {
      if (!cancelled) setSearch(() => m.searchPlaces);
    });
    inputRef.current?.focus();
    return () => {
      cancelled = true;
    };
  }, []);

  const results = search && query.trim().length >= 2 ? search(query, 30) : [];
  const showEmpty = Boolean(search) && query.trim().length >= 2 && results.length === 0;

  return (
    <div
      role="dialog"
      aria-label={t("panchangamChoosePlace")}
      className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[var(--foreground)]">{t("panchangamChoosePlace")}</p>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-[var(--accent)]">
          {t("panchangamClosePlaces")}
        </button>
      </div>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("panchangamPlaceSearchPlaceholder")}
        aria-label={t("panchangamPlaceSearchPlaceholder")}
        autoComplete="off"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
      />
      <button
        type="button"
        onClick={() => onChoose(null)}
        aria-pressed={current === null}
        className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-left text-sm font-semibold text-[var(--accent)]"
      >
        {current === null ? "✓ " : ""}
        {t("panchangamUseMyLocation")}
      </button>
      {results.length > 0 ? (
        <ul role="list" className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto">
          {results.map((place) => {
            const selected =
              current !== null &&
              current.name === place.name &&
              current.latitude === place.latitude &&
              current.longitude === place.longitude;
            return (
              <li key={`${place.name}|${place.region}|${place.country}|${place.latitude}|${place.longitude}`}>
                <button
                  type="button"
                  onClick={() => onChoose(place)}
                  aria-pressed={selected}
                  className="w-full py-2 text-left"
                >
                  <span className="block text-sm font-semibold text-[var(--foreground)]">
                    {selected ? "✓ " : ""}
                    {place.name}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">{placeLabel(place).slice(place.name.length + 2)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {showEmpty ? <p className="text-xs text-[var(--muted)]">{t("panchangamNoPlaces")}</p> : null}
      <p className="text-xs text-[var(--muted)]">{t("panchangamPlaceHint")}</p>
      <p className="text-[10px] text-[var(--muted)]">{t("panchangamPlacesCredit")}</p>
    </div>
  );
}
