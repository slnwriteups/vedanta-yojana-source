import { loadBooks, loadChapters, loadDivyaDesams, loadKnowledge } from "./loader.ts";
import type { SearchDocument, SearchField } from "../../content-lib/search/types.ts";

/**
 * Phase 6B -- the mobile search corpus builder. Mirrors
 * content-lib/search/corpus.ts's buildSearchCorpus() field-for-field, but
 * calls the MOBILE loader (./loader.ts, Metro-bundled) instead of the
 * Node-fs-backed web loader (../../content-lib/loader/index.ts). Not
 * reused directly because the web version is hard-wired to the web
 * loader's import; everything downstream (searchContent, rankSearchResults,
 * createExcerpt, searchCorpus) is untouched and reused directly from
 * ../../content-lib/search/ -- only the one I/O boundary is re-pointed.
 *
 * Phase 6D, Step 2 (offline content architecture): unlike the web corpus
 * builder, this one now CACHES its result at module scope, the same
 * disclosed deviation content-lib/loader.ts already makes for the same
 * reason -- the manifest is build-time-bundled and immutable at runtime,
 * so re-walking ~163 already-parsed records into ~170 SearchDocuments on
 * every Search-tab visit would only cost CPU/battery for an identical
 * result. Safe specifically because nothing in this app can mutate
 * content at runtime (no editing UI exists).
 */

let corpusCache: SearchDocument[] | null = null;

function field(name: string, tier: SearchField["tier"], text: string | undefined | null): SearchField[] {
  return text ? [{ name, tier, text }] : [];
}

export function buildMobileSearchCorpus(): SearchDocument[] {
  if (corpusCache) return corpusCache;

  const documents: SearchDocument[] = [];

  for (const dd of loadDivyaDesams()) {
    const fields: SearchField[] = [
      ...field("displayName", "title", dd.displayName),
      ...field("moolavar", "strong", dd.templeInformation.moolavar),
      ...field("thayaar", "strong", dd.templeInformation.thayaar),
      ...field("vimanam", "strong", dd.templeInformation.vimanam),
      ...field("theertham", "strong", dd.templeInformation.theertham),
      ...field("travelNote", "strong", dd.templeInformation.travelNote),
      ...dd.shrines.flatMap((shrine) => [
        ...field("shrineLabel", "strong", shrine.label),
        ...field("shrineName", "strong", shrine.name),
        ...field("shrineMoolavar", "strong", shrine.templeInformation?.moolavar),
        ...field("shrineThayaar", "strong", shrine.templeInformation?.thayaar),
        ...field("shrineVimanam", "strong", shrine.templeInformation?.vimanam),
        ...field("shrineTheertham", "strong", shrine.templeInformation?.theertham),
        ...field("shrineSthalaPuranam", "body", shrine.sthalaPuranam),
        ...field("shrineAzhwarPasuram", "body", shrine.azhwarPasuram),
      ]),
      ...field("sthalaPuranam", "body", dd.sthalaPuranam),
      ...field("azhwarPasuram", "body", dd.azhwarPasuram),
    ];
    documents.push({
      type: "divya-desam",
      title: dd.displayName,
      href: `/divya-desams/${dd.slug}`,
      status: dd.status,
      needsReview: dd.migration.needsReview,
      sourceOrder: dd.sourceOrder,
      fields,
    });
  }

  for (const book of loadBooks()) {
    const bookFields: SearchField[] = [
      ...field("title", "title", book.title),
      ...field("author", "strong", book.author),
      ...field("description", "strong", book.description),
    ];
    documents.push({
      type: "book",
      title: book.title,
      href: `/library/${book.slug}`,
      status: book.status,
      needsReview: book.migration.needsReview,
      sourceOrder: 0,
      fields: bookFields,
    });

    for (const chapter of loadChapters(book.slug)) {
      const chapterFields: SearchField[] = [
        ...field("title", "title", chapter.title),
        ...field("parentBookTitle", "strong", book.title),
        ...field("body", "body", chapter.body),
      ];
      documents.push({
        type: "chapter",
        title: chapter.title,
        href: `/library/${book.slug}/${chapter.slug}`,
        parentTitle: book.title,
        status: chapter.status,
        needsReview: chapter.migration.needsReview,
        sourceOrder: chapter.order,
        fields: chapterFields,
      });
    }
  }

  for (const record of loadKnowledge()) {
    const fields: SearchField[] = [
      ...field("title", "title", record.title),
      ...field("contentType", "strong", record.contentType),
      ...field("body", "body", record.body),
    ];
    documents.push({
      type: "knowledge",
      title: record.title,
      href: `/divya-desams/${record.slug}`,
      status: record.status,
      needsReview: record.migration.needsReview,
      sourceOrder: 0,
      fields,
    });
  }

  corpusCache = documents;
  return documents;
}
