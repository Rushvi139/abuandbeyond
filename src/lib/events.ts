import "server-only";
import { EventEmitter } from "node:events";
import { db } from "@/lib/db";

export type OrderEvent = { id: string; status: string; code: string };

// One Postgres LISTEN per server process, fanned out to SSE subscribers.
declare global {
  var __abEvents: EventEmitter | undefined;
  var __abListening: Promise<unknown> | undefined;
}

export function orderEvents(): EventEmitter {
  if (!globalThis.__abEvents) {
    const em = new EventEmitter();
    em.setMaxListeners(500);
    globalThis.__abEvents = em;
  }
  if (!globalThis.__abListening) {
    globalThis.__abListening = db()
      .listen("orders", (payload) => {
        try {
          globalThis.__abEvents!.emit("order", JSON.parse(payload) as OrderEvent);
        } catch {}
      })
      .catch((e) => {
        console.error("LISTEN orders failed", e);
        globalThis.__abListening = undefined;
      });
  }
  return globalThis.__abEvents;
}

/** Server-Sent Events stream of order changes, optionally filtered by order code. */
export function sseResponse(filter?: (e: OrderEvent) => boolean) {
  const em = orderEvents();
  const enc = new TextEncoder();
  let handler: ((e: OrderEvent) => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(`: connected\n\n`));
      handler = (e) => {
        if (filter && !filter(e)) return;
        controller.enqueue(enc.encode(`event: order\ndata: ${JSON.stringify(e)}\n\n`));
      };
      em.on("order", handler);
      ping = setInterval(() => controller.enqueue(enc.encode(`: ping\n\n`)), 25000);
    },
    cancel() {
      if (handler) em.off("order", handler);
      if (ping) clearInterval(ping);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
