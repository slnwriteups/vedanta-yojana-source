"use client";

import { SocialButton } from "@/components/SocialButton";
import { useT } from "@/lib/ui-strings";

/**
 * Translates the "View Releases" label before handing off to
 * SocialButton, which only takes a plain string -- kept as its own
 * file (rather than inlined in the server-component Settings page)
 * since it needs useT(), which requires a client component.
 */
export function ReleasesButton({ url }: { url: string }) {
  const t = useT();
  return <SocialButton icon="releases" label={t("settingsReleasesLinkLabel")} url={url} />;
}
