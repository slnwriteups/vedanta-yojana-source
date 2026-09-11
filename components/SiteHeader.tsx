"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useT } from "@/lib/ui-strings";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/**
 * Site header -- Phase 5J core shell, re-skinned to match the mobile
 * app's bottom tab bar: the same designer-supplied gold icon artwork
 * (mobile/assets/icons/, copied verbatim into public/nav-icons/) next
 * to each label, same five destinations (Home/Divya Desams/Library/
 * Search/Settings), same localized labels (lib/ui-strings.ts's tabX
 * keys) -- laid out as a top nav bar rather than mobile's fixed bottom
 * bar, which is a native-app convention with no direct web equivalent;
 * "About" is web-only chrome mobile has no tab for, so it keeps a
 * plain English label.
 *
 * A client component (not the Phase 5B server-rendered stub) so the
 * current route can be indicated (`usePathname`) and a mobile menu can be
 * toggled. Basic navigation itself needs no JavaScript: every link below
 * is a real `next/link` anchor and works identically with JS disabled --
 * only the active-route highlight and the mobile disclosure are
 * client-side enhancements, isolated to this one component.
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const NAV_LINKS = [
  { href: "/", key: "tabHome" as const, icon: "navigation-icons_home.png" },
  { href: "/divya-desams", key: "tabDivyaDesams" as const, icon: "divya-desams.png" },
  { href: "/library", key: "tabLibrary" as const, icon: "navigation-icons_library.png" },
  { href: "/search", key: "tabSearch" as const, icon: "navigation-icons_search.png" },
  { href: "/settings", key: "tabSettings" as const, icon: "navigation-icons_settings.png" },
];

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useT();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--background)]">
      <div className="site-container flex items-center justify-between gap-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Vedanta Yojana
        </Link>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-3 py-2 text-sm sm:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
          <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
        </button>

        <div className="hidden items-center gap-6 sm:flex">
          <nav aria-label="Primary">
            <ul role="list" className="flex flex-wrap items-center gap-5 text-sm">
              {NAV_LINKS.map((link) => {
                const active = isActiveRoute(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-1.5 ${
                        active ? "font-semibold text-[var(--accent)]" : "hover:underline"
                      }`}
                    >
                      <img
                        src={`${BASE_PATH}/nav-icons/${link.icon}`}
                        alt=""
                        aria-hidden="true"
                        className="h-5 w-5 object-contain"
                        style={{ opacity: active ? 1 : 0.6 }}
                      />
                      {t(link.key)}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link href="/about" aria-current={isActiveRoute(pathname, "/about") ? "page" : undefined} className={isActiveRoute(pathname, "/about") ? "font-semibold text-[var(--accent)]" : "hover:underline"}>
                  About
                </Link>
              </li>
            </ul>
          </nav>
          <LanguageSwitcher />
        </div>
      </div>

      <nav
        id="mobile-navigation"
        aria-label="Primary"
        className={`site-container border-t border-[var(--border)] pt-4 pb-4 sm:hidden ${menuOpen ? "block" : "hidden"}`}
      >
        <ul role="list" className="flex flex-col gap-1 text-sm">
          {[...NAV_LINKS, { href: "/about", key: null, icon: null }].map((link) => {
            const active = isActiveRoute(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-md px-2 py-2 ${
                    active ? "font-semibold text-[var(--accent)]" : "hover:underline"
                  }`}
                >
                  {link.icon ? (
                    <img
                      src={`${BASE_PATH}/nav-icons/${link.icon}`}
                      alt=""
                      aria-hidden="true"
                      className="h-5 w-5 object-contain"
                      style={{ opacity: active ? 1 : 0.6 }}
                    />
                  ) : null}
                  {link.key ? t(link.key) : "About"}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <LanguageSwitcher />
        </div>
      </nav>
    </header>
  );
}
