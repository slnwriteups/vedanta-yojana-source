import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
import { SettingsControls } from "@/components/SettingsControls";
import { SocialButton } from "@/components/SocialButton";
import { LocalizedPageHeading } from "@/components/shared/LocalizedPageHeading";
import { LocalizedText } from "@/components/shared/LocalizedText";

export const metadata: Metadata = {
  title: "Settings",
  description: "Language, appearance, and text-size preferences for Vedanta Yojana.",
  alternates: { canonical: siteUrl("/settings") },
};

const INSTAGRAM_URL = "https://www.instagram.com/vedantayojana/";

/**
 * Matches mobile's Settings tab: the same SettingsControls, plus a
 * "Connect" section with an Instagram link (mobile's
 * mobile/app/(tabs)/settings.tsx + components/SocialButton.tsx) --
 * previously entirely absent on web. The GitHub Releases link (the
 * Android APK discovery path) now lives in the header as "Install App"
 * (components/SiteHeader.tsx) rather than here.
 */
export default function SettingsPage() {
  return (
    <div className="max-w-sm space-y-6">
      <LocalizedPageHeading stringKey="tabSettings" />
      <SettingsControls />
      <div className="space-y-2">
        <LocalizedText stringKey="settingsConnectLabel" as="span" className="eyebrow" />
        <div>
          <SocialButton icon="instagram" label="Instagram" url={INSTAGRAM_URL} />
        </div>
      </div>
    </div>
  );
}
