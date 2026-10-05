import { describe, expect, it } from "vitest";
import { formatDetails, parseDetails } from "./details";

describe("formatDetails", () => {
  it("writes labelled plain text, numbering the steps itself", () => {
    expect(
      formatDetails({
        intro: "Good ideas start with problems.",
        example: "Forgetting homework.",
        youNeed: "A notebook",
        minutes: 20,
        steps: ["1. Carry a notebook.", "Step 2: Write down annoyances.", ""],
        tip: "Don't judge ideas yet.",
      }),
    ).toBe(
      "Good ideas start with problems.\n\nExample: Forgetting homework.\nYou need: A notebook\nTime: about 20 minutes\n\n1. Carry a notebook.\n2. Write down annoyances.\n\nTip: Don't judge ideas yet.",
    );
  });

  it("leaves out empty parts", () => {
    expect(formatDetails({ intro: "Think.", steps: ["Write."], example: " ", tip: null, minutes: 0 })).toBe("Think.\n\n1. Write.");
  });
});

describe("parseDetails", () => {
  it("round-trips what formatDetails writes", () => {
    const text = formatDetails({ intro: "Why.", example: "E.", youNeed: "Pen", minutes: 15, steps: ["A.", "B."], tip: "T." });
    expect(parseDetails(text)).toEqual([
      { type: "text", text: "Why." },
      { type: "example", text: "E." },
      { type: "need", text: "Pen" },
      { type: "time", text: "about 15 minutes" },
      { type: "steps", items: ["A.", "B."] },
      { type: "tip", text: "T." },
    ]);
  });

  it("splits older one-paragraph steps into a list", () => {
    const old =
      "Good ideas start with problems. Steps: 1) Carry a notebook. 2) Write down every annoyance. 3) Aim for 10 problems.";
    expect(parseDetails(old)).toEqual([
      { type: "text", text: "Good ideas start with problems." },
      { type: "steps", items: ["Carry a notebook.", "Write down every annoyance.", "Aim for 10 problems."] },
    ]);
  });

  it("leaves numbers that are not a sequence of steps alone", () => {
    const text = "Give each problem a score from 1 to 3. Pick the top 2) best ones.";
    expect(parseDetails(text)).toEqual([{ type: "text", text }]);
  });

  it("keeps plain paragraphs and bullet lists", () => {
    expect(parseDetails("First paragraph.\n\nSecond one\ncontinues here.\n- one\n- two")).toEqual([
      { type: "text", text: "First paragraph." },
      { type: "text", text: "Second one continues here." },
      { type: "steps", items: ["one", "two"] },
    ]);
  });

  it("reads an Ask Bloom answer with steps and a next step", () => {
    expect(parseDetails("A business sells something.\n\n1. Pick a problem.\n2. Ask people.\n\nNext step: List 3 problems.")).toEqual([
      { type: "text", text: "A business sells something." },
      { type: "steps", items: ["Pick a problem.", "Ask people."] },
      { type: "next", text: "List 3 problems." },
    ]);
  });

  it("is empty for empty text", () => {
    expect(parseDetails("  \n ")).toEqual([]);
  });
});
