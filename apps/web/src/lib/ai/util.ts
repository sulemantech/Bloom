import { createHash } from "node:crypto";

/** Stable fingerprint of what was sent, so repeated calls show up in ai_runs without storing the text. */
export function inputHash(system: string, user: string): string {
  return createHash("sha256").update(JSON.stringify([system, user])).digest("hex").slice(0, 32);
}

/** The text blocks of a model response, joined. */
export function joinText(content: readonly { type: string; text?: string }[]): string {
  return content
    .flatMap((block) => (block.type === "text" && block.text ? [block.text] : []))
    .join("\n")
    .trim();
}

/** Start of the rolling 24-hour window for daily limits. */
export function dayWindowStart(now = new Date()): string {
  return new Date(now.getTime() - 24 * 3_600_000).toISOString();
}

/** BLOOM_AI_DAILY_LIMIT, or the default when unset or not a positive whole number. */
export function dailyLimitFrom(value: string | undefined, fallback = 60): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
