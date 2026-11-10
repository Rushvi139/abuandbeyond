import { describe, expect, it } from "vitest";
import { TEMPLATES, templateSubmissionText } from "./templates";

/**
 * These rules are Meta's, and breaking one means the template is rejected in
 * review — which we would find out days later, with the kitchen already live
 * and no messages going out. Cheaper to fail here.
 */
describe("whatsapp templates", () => {
  const all = Object.entries(TEMPLATES);

  it.each(all)("%s is registered under the name it is keyed by", (key, t) => {
    expect(t.name).toBe(key);
  });

  it.each(all)("%s is a utility template, not marketing", (_k, t) => {
    // An order update submitted as MARKETING is rejected, and marketing also
    // costs more per message and needs a separate opt-in.
    expect(t.category).toBe("UTILITY");
  });

  it.each(all)("%s does not start or end with a variable", (_k, t) => {
    expect(t.body.trim().startsWith("{{"), "Meta rejects a body starting with a variable").toBe(false);
    expect(t.body.trim().endsWith("}}"), "Meta rejects a body ending with a variable").toBe(false);
  });

  it.each(all)("%s has no two variables in a row", (_k, t) => {
    expect(/\{\{\d+\}\}\s*\{\{\d+\}\}/.test(t.body), "Meta rejects adjacent variables").toBe(false);
  });

  it.each(all)("%s numbers its variables 1..n with none missing", (_k, t) => {
    const used = [...t.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
    const unique = [...new Set(used)].sort((a, b) => a - b);
    expect(unique).toEqual(Array.from({ length: unique.length }, (_, i) => i + 1));
    expect(t.variables).toHaveLength(unique.length);
    expect(t.example).toHaveLength(unique.length);
  });

  it.each(all)("%s stays well inside the 1024-character body limit", (_k, t) => {
    expect(t.body.length).toBeLessThan(1024);
  });

  it("prints every template for submission", () => {
    const text = templateSubmissionText();
    for (const [, t] of all) expect(text).toContain(t.name);
  });
});
