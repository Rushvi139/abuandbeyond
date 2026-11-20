"use client";

import { useEffect } from "react";
import { SOURCE_COOKIE, SOURCE_MAX_AGE_S, isSlug } from "@/lib/partners/source";

/** Keeps a partner QR's `?src=` for checkout. Renders nothing. */
export function RememberSource() {
  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get("src");
    if (isSlug(src)) document.cookie = `${SOURCE_COOKIE}=${src}; max-age=${SOURCE_MAX_AGE_S}; path=/; samesite=lax`;
  }, []);
  return null;
}
