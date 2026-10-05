import { describe, expect, it } from "vitest";
import { dailyLimitFrom, dayWindowStart, inputHash, joinText } from "./util";

describe("inputHash", () => {
  it("is stable for the same input and never contains the text", () => {
    const hash = inputHash("system", "my secret idea");
    expect(hash).toBe(inputHash("system", "my secret idea"));
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).not.toContain("secret");
  });

  it("tells system and user text apart", () => {
    expect(inputHash("ab", "c")).not.toBe(inputHash("a", "bc"));
  });
});

describe("joinText", () => {
  it("joins text blocks and skips the rest", () => {
    expect(joinText([{ type: "text", text: " Hello" }, { type: "thinking" }, { type: "text", text: "world " }])).toBe("Hello\nworld");
  });

  it("is empty when there is no text", () => {
    expect(joinText([{ type: "thinking" }])).toBe("");
  });
});

describe("dayWindowStart", () => {
  it("is 24 hours before now", () => {
    expect(dayWindowStart(new Date("2026-10-05T12:00:00Z"))).toBe("2026-10-04T12:00:00.000Z");
  });
});

describe("dailyLimitFrom", () => {
  it("reads a positive whole number", () => {
    expect(dailyLimitFrom("25")).toBe(25);
  });

  it.each([undefined, "", "0", "-3", "2.5", "lots"])("falls back for %j", (value) => {
    expect(dailyLimitFrom(value)).toBe(60);
  });
});
