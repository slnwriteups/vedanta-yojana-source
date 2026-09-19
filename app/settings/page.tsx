import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
import { SettingsControls } from "@/components/SettingsControls";
import { SocialButton } from "@/components/SocialButton";
import { ReleasesButton } from "@/components/ReleasesButton";
import { LocalizedPageHeading } from "@/components/shared/LocalizedPageHeading";
import { LocalizedText } from "@/components/shared/LocalizedText";

export const metadata: Metadata = {
  title: "Settings",
  description: "Language, appearance, and text-size preferences for Vedanta Yojana.",
  alternates: { canonical: siteUrl("/settings") },
};

const INSTAGRAM_URL = "https://www.instagram.com/vedantayojana/";
const RELEASES_URL = "https://github.com/slnwriteups/vedanta-yojana-releases/releases";

/**
 * Matches mobile's Settings tab: the same SettingsControls, plus a
 * "Connect" section with an Instagram link (mobile's
 * mobile/app/(tabs)/settings.tsx + components/SocialButton.tsx) --
 * previously entirely absent on web. The "Releases" section is
 * web-only (mobile can't usefully link to its own APK download from
 * inside itself) -- it's the discovery path for someone who found the
 * app on the web and wants the Android APK: Settings -> Releases ->
 * GitHub Releases.
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
      <div className="space-y-2">
        <LocalizedText stringKey="settingsReleasesLabel" as="span" className="eyebrow" />
        <div>
          <ReleasesButton url={RELEASES_URL} />
        </div>
      </div>
    </div>
  );
}
