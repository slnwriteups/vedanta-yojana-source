import { siteUrl } from "@/lib/site";

/**
 * Placeholder for a URL that has moved (a renamed book, see
 * content-lib/book-slug-aliases.ts). The site is a static export on GitHub
 * Pages, which cannot send HTTP redirects, and next/navigation's redirect()
 * only redirects after JavaScript runs. A meta refresh works without
 * JavaScript and search engines treat it as a redirect; React hoists the
 * <meta> into <head>. The link is for anyone whose browser ignores it.
 */
export function MovedPage({ path }: { path: string }) {
  const href = siteUrl(path);
  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=${href}`} />
      <p>
        This page has moved to <a href={href}>{href}</a>.
      </p>
    </>
  );
}
