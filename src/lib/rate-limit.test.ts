import { describe, expect, it, vi } from "vitest";
import { clientIp, rateLimit, rateLimitClear } from "./rate-limit";

const key = () => `t-${Math.random().toString(36).slice(2)}`;

describe("rateLimit", () => {
  it("allows up to the limit, then refuses", () => {
    const k = key();
    for (let i = 0; i < 5; i++) expect(rateLimit(k, 5, 60_000).ok, `try ${i + 1}`).toBe(true);
    expect(rateLimit(k, 5, 60_000).ok).toBe(false);
  });

  it("says how long to wait", () => {
    const k = key();
    for (let i = 0; i < 3; i++) rateLimit(k, 3, 60_000);
    const r = rateLimit(k, 3, 60_000);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
    expect(r.retryAfter).toBeLessThanOrEqual(60);
  });

  it("opens again once the window passes", () => {
    const k = key();
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 3; i++) rateLimit(k, 3, 1000);
      expect(rateLimit(k, 3, 1000).ok).toBe(false);
      vi.advanceTimersByTime(1001);
      expect(rateLimit(k, 3, 1000).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("forgets a key on success, so typos don't lock a guest out", () => {
    const k = key();
    for (let i = 0; i < 4; i++) rateLimit(k, 5, 60_000);
    rateLimitClear(k);
    for (let i = 0; i < 5; i++) expect(rateLimit(k, 5, 60_000).ok).toBe(true);
  });

  it("counts each key on its own", () => {
    const a = key();
    const b = key();
    for (let i = 0; i < 5; i++) rateLimit(a, 5, 60_000);
    expect(rateLimit(a, 5, 60_000).ok).toBe(false);
    expect(rateLimit(b, 5, 60_000).ok).toBe(true);
  });
});

describe("clientIp", () => {
  const req = (h: Record<string, string>) => new Request("https://x.test", { headers: h });

  it("takes the client from the left of x-forwarded-for, not the proxy", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2" }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("does not throw when there is no header to read", () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});
