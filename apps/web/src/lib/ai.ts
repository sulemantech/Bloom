import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

/**
 * Single entry point for AI features, so the provider can change without touching the app.
 * Progress-card drafts (a mentor always edits and approves) and Bloom, the student's learning guide.
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

export type AiFailure = "notConfigured" | "refused" | "rateLimited" | "failed";
export type DraftResult = { ok: true; text: string } | { ok: false; reason: AiFailure };

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

// ---------------------------------------------------------------------------
// Bloom: the student's personal learning guide
// ---------------------------------------------------------------------------

/** What Bloom knows about a student. No names, usernames or contact details are sent. */
export type BloomContext = {
  ageGroup: "explorer" | "builder" | null;
  /** Current programme step (Explore, Choose, Build, Present) and week, when the student is in a group. */
  step: string | null;
  week: number | null;
  project: { area: string; title: string | null; problem: string | null; status: string } | null;
  /** Titles of earlier learning paths, so suggestions build on them instead of repeating. */
  previousPaths: string[];
};

const BLOOM_SYSTEM = `You are Bloom, the learning guide inside Youth Idea Lab, an 8-week live online course where students aged 12-18 explore, choose a real problem, build a project and present it at Demo Day. Explorers are 12-14, Builders are 15-18.

You help one student learn what they need for their own project and curiosity. Match the student's age group: short sentences and concrete everyday examples for Explorers; more depth and real tools for Builders. Be warm, encouraging and practical. Prefer doing over reading: small tasks the student can finish in 15-45 minutes with free tools, pen and paper or a phone.

Safety: keep everything age-appropriate. Never ask for or include personal data, contact details, or links to sign-up sites. Never suggest meeting strangers, sharing personal information online, spending money, or anything dangerous. If a question is about wellbeing, safety or something a trusted adult should handle, kindly suggest talking to their parent or mentor.`;

type StructuredResult<T> = { ok: true; data: T } | { ok: false; reason: AiFailure };

async function structured<T extends z.ZodType>(schema: T, prompt: string): Promise<StructuredResult<z.infer<T>>> {
  if (!aiConfigured()) return { ok: false, reason: "notConfigured" };
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system: BLOOM_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    return response.parsed_output ? { ok: true, data: response.parsed_output } : { ok: false, reason: "failed" };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "rateLimited" };
    if (error instanceof Anthropic.APIError) console.error(`Bloom AI failed (${error.status}):`, error.message);
    else console.error("Bloom AI failed:", error);
    return { ok: false, reason: "failed" };
  }
}

const SuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        title: z.string().describe("Short, inviting name for the learning path, under 60 characters"),
        goal: z.string().describe("One sentence: what the student will be able to do afterwards"),
        why: z.string().describe("One sentence linking it to their project or current step"),
      }),
    )
    .describe("Exactly 3 suggestions"),
});

export type BloomSuggestion = z.infer<typeof SuggestionsSchema>["suggestions"][number];

/** Three personalised learning paths for where the student is right now. */
export async function suggestBloomPaths(context: BloomContext, interest: string) {
  const result = await structured(
    SuggestionsSchema,
    `Suggest exactly 3 learning paths for this student, each different (e.g. one skill for their project, one thinking skill for their current step, one stretch idea). Do not repeat their earlier paths.

Student context:
${JSON.stringify(context, null, 2)}
${interest ? `\nThe student says they are curious about: ${interest}` : ""}`,
  );
  return result.ok ? { ok: true as const, suggestions: result.data.suggestions.slice(0, 3) } : result;
}

const PlanSchema = z.object({
  summary: z.string().describe("2-3 sentences, addressed to the student, on what this path covers and why it helps them"),
  tasks: z.array(
    z.object({
      kind: z.enum(["learn", "do", "reflect"]),
      title: z.string().describe("Short action title, under 70 characters"),
      details: z
        .string()
        .describe("What to do and how, as a short explanation plus clear steps. Plain text, 60-180 words, no markdown headings"),
    }),
  ),
});

export type BloomPlan = z.infer<typeof PlanSchema>;

const TASK_COUNT = { quick: "3", standard: "5", deep: "7" } as const;

/** A step-by-step learning path: a summary plus tasks mixing learning, doing and reflecting. */
export async function planBloomPath(
  context: BloomContext,
  path: { title: string; goal: string; depth: keyof typeof TASK_COUNT },
) {
  return structured(
    PlanSchema,
    `Create a learning path called "${path.title}".
The student's goal: ${path.goal || "(not given — infer a sensible one from the title)"}

Write exactly ${TASK_COUNT[path.depth]} tasks in a sensible order: start with a "learn" task that explains the core idea simply, include at least one hands-on "do" task that moves their own project forward when possible, and finish with a "reflect" task asking what they learned and how they will use it.

Student context:
${JSON.stringify(context, null, 2)}`,
  );
}

/** Bloom answers a student's question about a path or task. Plain text, short. */
export async function askBloom(
  context: BloomContext,
  topic: { path: string; task: string | null; taskDetails: string | null },
  question: string,
): Promise<DraftResult> {
  if (!aiConfigured()) return { ok: false, reason: "notConfigured" };
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: `${BLOOM_SYSTEM}

Answer the student's question in at most 150 words of plain text (no markdown headings or tables). Explain with a simple example, then suggest one small next step. If the question is off-topic, answer briefly if it is harmless and guide them back to their path. Don't just hand over finished work for a task — help them think it through.`,
      messages: [
        {
          role: "user",
          content: `Learning path: ${topic.path}${topic.task ? `\nCurrent task: ${topic.task}\n${topic.taskDetails ?? ""}` : ""}

Student context:
${JSON.stringify(context, null, 2)}

The student asks: ${question}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .trim();
    return text ? { ok: true, text } : { ok: false, reason: "failed" };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, reason: "rateLimited" };
    if (error instanceof Anthropic.APIError) console.error(`Bloom answer failed (${error.status}):`, error.message);
    else console.error("Bloom answer failed:", error);
    return { ok: false, reason: "failed" };
  }
}
