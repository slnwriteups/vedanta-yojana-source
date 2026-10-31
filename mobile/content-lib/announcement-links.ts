/** Only a link to this exact notice is an in-app reading action. */
export function isAnnouncementReadLink(href: string, id: string): boolean {
  try {
    const url = new URL(href, "https://vedantayojana.org");
    return url.origin === "https://vedantayojana.org" &&
      url.pathname.replace(/\/$/, "") === "/whats-new" &&
      decodeURIComponent(url.hash.slice(1)) === id;
  } catch {
    return false;
  }
}
