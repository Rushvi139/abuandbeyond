import { describe, expect, it } from "vitest";
import { rememberable, searchWords } from "./stays-search";

describe("searchWords", () => {
  it("drops words every hotel has", () => {
    expect(searchWords("Hotel Hill Top")).toEqual(["hill", "top"]);
  });
  it("keeps them when they are all that was typed", () => {
    expect(searchWords("hotel")).toEqual(["hotel"]);
  });
  it("ignores accents and punctuation", () => {
    expect(searchWords("Café-Rosé")).toEqual(["cafe", "rose"]);
  });
  it("needs two letters to search", () => {
    expect(searchWords("h")).toEqual([]);
  });
});

describe("rememberable (shown to later guests, so strict)", () => {
  it("keeps real hotel names", () => {
    expect(rememberable("Hotel Sunrise Palace")).toBe(true);
    expect(rememberable("Shree Ganesh Homestay")).toBe(true);
  });
  it("refuses room numbers, phone numbers and junk", () => {
    expect(rememberable("Room 204")).toBe(false);
    expect(rememberable("9876543210")).toBe(false);
    expect(rememberable("ab")).toBe(false);
    expect(rememberable("12 B")).toBe(false);
  });
});
