import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Single entry point for AI features, so the provider can change without touching the app.
 * Phase 2: progress-card drafts (a mentor always edits and approves). Phase 3: student tutor.
 */
const MODEL = "claude-opus-5-5";

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type DraftProgressCardInput = {
  /** First name only: no surnames, usernames or parent details are sent. */
  studentFirstName: string;
  ageGroup: "explorer" | "builder" | null;
  week: number;
  totalWeeks: number;
  stepName: string;
  project: { area: string; title: string | null; problem: string | null; status: string } | null;
  activities: {
    title: string;
    status: string;
    submission: string | null;
    feedback: string[];
  }[];
};

const SYSTEM = `You help mentors at Youth Idea Lab, an 8-week live online course where students aged 12-18 explore, choose a real problem, build a project and present it at Demo Day.

Write a draft of the weekly progress card a mentor sends to a student's parent. The mentor will edit and approve it before the parent sees it.

Write in plain, warm English for a parent, in 80-140 words, as 2-3 short paragraphs with no headings, lists or emoji:
- what the student worked on and did well this week, using specifics from their work
- one thing to improve or practise, framed encouragingly
- what comes next and one way the parent can support at home

Only state what the provided work and mentor feedback support; never invent achievements, grades or behaviour. If the student submitted nothing this week, say so kindly and suggest how to catch up. Refer to the student by first name. Never include contact details, links or personal data beyond what is given.`;

export type DraftResult = { ok: true; text: string } | { ok: false; reason: "notConfigured" | "refused" | "rateLimited" | "failed" };

export async function draftProgressCard(input: DraftProgressCardInput): Promise<DraftResult> {
  if (!aiConfigured()) return { ok: false, reason: "notConfigured" };
  const client = new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: `Draft the progress card from this week's record:\n\n${JSON.stringify(input, null, 2)}` }],
    });

    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .trim();
    return text ? { ok: true, text } : { ok: false, reason: "failed" };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "rateLimited" };
    if (error instanceof Anthropic.APIError) console.error(`AI draft failed (${error.status}):`, error.message);
    else console.error("AI draft failed:", error);
    return { ok: false, reason: "failed" };
  }
}
