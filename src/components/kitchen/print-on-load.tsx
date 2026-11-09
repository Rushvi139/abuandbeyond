"use client";

import { useEffect } from "react";

/** Fires the browser's print dialog once this ticket has rendered. */
export function PrintOnLoad() {
  useEffect(() => {
    // One frame, so fonts and layout have settled before the snapshot the
    // print pipeline takes; otherwise a thermal printer can get a blank sheet.
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, []);
  return null;
}
