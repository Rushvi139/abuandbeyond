"use client";

import { useLiveRefresh } from "@/hooks/use-live";

export function LiveStatus({ code }: { code: string }) {
  useLiveRefresh(`/api/events/order/${code}`);
  return null;
}
