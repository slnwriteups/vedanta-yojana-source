import type { Metadata } from "next";
import { siteUrl } from "@/lib/site";
import { SettingsControls } from "@/components/SettingsControls";

export const metadata: Metadata = {
  title: "Settings",
  description: "Language, appearance, and text-size preferences for Vedanta Yojana.",
  alternates: { canonical: siteUrl("/settings") },
};

export default function SettingsPage() {
  return (
    <div className="max-w-sm space-y-6">
      <h1 className="page-title">Settings</h1>
      <SettingsControls />
    </div>
  );
}
