export type BlogPlatform = "wordpress" | "wix";

/** One post as recovered from a source platform, before anything is written to disk. */
export interface ImportedPost {
  platform: BlogPlatform;
  /** The platform's own identifier (WordPress post ID, Wix post URL). */
  sourceId: string;
  sourceUrl: string | null;
  title: string;
  slug: string;
  /** The platform's publication state ("publish", "draft", "private", ...). */
  sourceStatus: string;
  /** ISO 8601, or null when the source does not say. */
  publishedAt: string | null;
  modifiedAt: string | null;
  author: string | null;
  categories: string[];
  tags: string[];
  excerpt: string | null;
  coverImageUrl: string | null;
  /** The post body exactly as the platform supplied it. */
  html: string;
}

/** Where a post sits in the slow move from the archive into the app. */
export type MigrationStatus = "archived" | "in-review" | "migrated" | "skipped";

export interface ArchivedImage {
  originalUrl: string;
  /** Path relative to the post's folder, or null if the download failed / was disabled. */
  file: string | null;
  error?: string;
}

export interface ArchivedPost {
  platform: BlogPlatform;
  sourceId: string;
  sourceUrl: string | null;
  title: string;
  slug: string;
  sourceStatus: string;
  publishedAt: string | null;
  modifiedAt: string | null;
  author: string | null;
  categories: string[];
  tags: string[];
  excerpt: string | null;
  coverImage: ArchivedImage | null;
  images: ArchivedImage[];
  wordCount: number;
  files: { markdown: string; html: string };
  migration: {
    status: MigrationStatus;
    /** Free-text note for the person doing the migration; preserved across re-imports. */
    notes: string;
  };
}
