import { describe, expect, it } from "vitest";
import { nextOpening } from "./hours";

// Times are written in IST (+05:30) so the test reads like the kitchen's clock.
const ist = (s: string) => new Date(`${s}+05:30`);
const istHHMM = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

describe("nextOpening (when a forced-open kitchen switches itself off)", () => {
  it("between lunch and dinner, it is 7 PM the same day", () => {
    const d = nextOpening(ist("2026-11-12T18:40:00"));
    expect(istHHMM(d)).toBe("19:00");
    expect(d.getTime() - ist("2026-11-12T18:40:00").getTime()).toBe(20 * 60_000);
  });
  it("after the late shift, it is noon the next day", () => {
    const d = nextOpening(ist("2026-11-13T03:00:00"));
    expect(d.toISOString()).toBe(ist("2026-11-13T12:00:00").toISOString());
  });
  it("in the morning, it is noon", () => {
    expect(istHHMM(nextOpening(ist("2026-11-13T09:15:00")))).toBe("12:00");
  });
});
