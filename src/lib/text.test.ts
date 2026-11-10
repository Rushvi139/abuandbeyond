import { describe, expect, it } from "vitest";
import { sentenceCase, titleCase } from "./text";

describe("titleCase", () => {
  it.each([
    ["PESTO AND SUNDRIED TOMATO", "Pesto and Sundried Tomato"],
    ["peri peri fries", "Peri Peri Fries"],
    ["L&T CLASSIC", "L&T Classic"],
    ["chicken l&t classic", "Chicken L&T Classic"],
    ["  pizza   al   FUNGI ", "Pizza al Fungi"],
    ["the big burger", "The Big Burger"],
    ["mac 'n' cheese", "Mac 'n' Cheese"],
    ["BBQ chicken", "BBQ Chicken"],
    ["chef's special", "Chef's Special"],
    ["4 cheese pizza", "4 Cheese Pizza"],
    ["laffa rolls", "Laffa Rolls"],
    ["", ""],
  ])("%s -> %s", (a, b) => expect(titleCase(a)).toBe(b));
  it("handles null", () => expect(titleCase(null)).toBe(""));
});

describe("sentenceCase", () => {
  it("lowers shouting, capitalises sentences", () => {
    expect(sentenceCase("MUSHROOM IN WHITE SAUCE")).toBe("Mushroom in white sauce");
    expect(sentenceCase("fresh lettuce. with a slice of tomato")).toBe("Fresh lettuce. With a slice of tomato");
    expect(sentenceCase("choose: salted or peri peri")).toBe("Choose: salted or peri peri");
  });
});
