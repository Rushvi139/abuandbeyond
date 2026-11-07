"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Subscribes to an SSE stream and refreshes the server-rendered page on each event. */
export function useLiveRefresh(url: string) {
  const router = useRouter();
  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      es = new EventSource(url);
      es.addEventListener("order", () => router.refresh());
      es.onerror = () => {
        es?.close();
        retry = setTimeout(connect, 3000);
      };
    };
    connect();
    const poll = setInterval(() => router.refresh(), 30000); // belt and braces
    return () => {
      es?.close();
      if (retry) clearTimeout(retry);
      clearInterval(poll);
    };
  }, [url, router]);
}
