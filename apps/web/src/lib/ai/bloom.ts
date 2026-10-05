import "server-only";
import { z } from "zod";
import { formatDetails } from "@/lib/bloom/details";
import { generateStructured, generateText, type AiResult } from "./gateway";

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

const BLOOM_SYSTEM = `You are Spark, the learning guide inside Youth Idea Lab, an 8-week live online course where students aged 12-18 explore, choose a real problem, build a project and present it at Demo Day. Explorers are 12-14, Builders are 15-18.

You help one student learn what they need for their own project and curiosity. Match the student's age group: short sentences and concrete everyday examples for Explorers; more depth and real tools for Builders. Be warm, encouraging and practical. Prefer doing over reading: small tasks the student can finish in 15-45 minutes with free tools, pen and paper or a phone.

Safety: keep everything age-appropriate. Never ask for or include personal data, contact details, or links to sign-up sites. Never suggest meeting strangers, sharing personal information online, spending money, or anything dangerous. If a question is about wellbeing, safety or something a trusted adult should handle, kindly suggest talking to their parent or mentor.`;

/** Every Bloom call is the student's own request, checked against their "bloom_ai" consent. */
const asStudent = (studentId: string) => ({ studentId, actorId: studentId, consent: "bloom_ai" as const });

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
export async function suggestBloomPaths(studentId: string, context: BloomContext, interest: string): Promise<AiResult<BloomSuggestion[]>> {
  const result = await generateStructured(
    {
      ...asStudent(studentId),
      capability: "bloom_suggest",
      system: BLOOM_SYSTEM,
      maxTokens: 8000,
      user: `Suggest exactly 3 learning paths for this student, each different (e.g. one skill for their project, one thinking skill for their current step, one stretch idea). Do not repeat their earlier paths.

Student context:
${JSON.stringify(context, null, 2)}
${interest ? `\nThe student says they are curious about: ${interest}` : ""}`,
    },
    SuggestionsSchema,
  );
  return result.ok ? { ok: true, data: result.data.suggestions.slice(0, 3) } : result;
}

const PlanSchema = z.object({
  summary: z.string().describe("2-3 short sentences, addressed to the student, on what this path covers and why it helps them"),
  tasks: z.array(
    z.object({
      kind: z.enum(["learn", "do", "reflect"]),
      title: z.string().describe("Short action title, under 60 characters"),
      intro: z.string().describe("1-2 short sentences: what the student will do and why it matters. For a learn task, explain the idea simply"),
      example: z.string().nullable().describe("One concrete, everyday example in one sentence, or null if it adds nothing"),
      youNeed: z.string().nullable().describe('What to have ready, as a short comma-separated list (e.g. "A notebook, a pen"), or null if nothing'),
      minutes: z.number().int().describe("Realistic time in minutes, between 10 and 45"),
      steps: z
        .array(z.string())
        .describe("3-6 steps in order. Each is one clear action that starts with a verb, at most 20 words, no numbering"),
      tip: z.string().nullable().describe("One short, encouraging tip, or null"),
    }),
  ),
});

/** A planned path, with each step's instructions already formatted for storage (see lib/bloom/details). */
export type BloomPlan = { summary: string; tasks: { kind: "learn" | "do" | "reflect"; title: string; details: string }[] };

const TASK_COUNT = { quick: "3", standard: "5", deep: "7" } as const;

/** A step-by-step learning path: a summary plus tasks mixing learning, doing and reflecting. */
export async function planBloomPath(
  studentId: string,
  context: BloomContext,
  path: { title: string; goal: string; depth: keyof typeof TASK_COUNT },
): Promise<AiResult<BloomPlan>> {
  const result = await generateStructured(
    {
      ...asStudent(studentId),
      capability: "bloom_plan",
      system: BLOOM_SYSTEM,
      maxTokens: 8000,
      user: `Create a learning path called "${path.title}".
The student's goal: ${path.goal || "(not given — infer a sensible one from the title)"}

Write exactly ${TASK_COUNT[path.depth]} tasks in a sensible order: start with a "learn" task that explains the core idea simply, include at least one hands-on "do" task that moves their own project forward when possible, and finish with a "reflect" task asking what they learned and how they will use it.

The student reads this on a phone, and a parent may read it too. Keep every part short and easy to scan: plain words, one idea per sentence, no jargon without a quick explanation, no markdown. Where the student fills something in, show the pattern with blanks, like "Many ___ have trouble with ___."

Student context:
${JSON.stringify(context, null, 2)}`,
    },
    PlanSchema,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      summary: result.data.summary,
      tasks: result.data.tasks.map(({ kind, title, steps, ...parts }) => ({
        kind,
        title,
        details: formatDetails({ ...parts, steps: steps.slice(0, 8), minutes: clampMinutes(parts.minutes) }),
      })),
    },
  };
}

const clampMinutes = (n: number) => (Number.isFinite(n) && n > 0 ? Math.min(Math.max(Math.round(n), 5), 90) : null);

/** Bloom answers a student's question about a path or task. Plain text, short. */
export function askBloom(
  studentId: string,
  context: BloomContext,
  topic: { path: string; task: string | null; taskDetails: string | null },
  question: string,
): Promise<AiResult<string>> {
  return generateText({
    ...asStudent(studentId),
    capability: "bloom_ask",
    maxTokens: 4000,
    system: `${BLOOM_SYSTEM}

Answer the student's question in at most 150 words of plain text (no markdown: no headings, bold, tables or bullets with symbols). Write short paragraphs of 1-3 sentences separated by a blank line. Explain with a simple example. If you give steps, put each on its own line as "1. ...", "2. ...". End with one small next step on its own line starting with "Next step: ". If the question is off-topic, answer briefly if it is harmless and guide them back to their path. Don't just hand over finished work for a task — help them think it through.`,
    user: `Learning path: ${topic.path}${topic.task ? `\nCurrent task: ${topic.task}\n${topic.taskDetails ?? ""}` : ""}

Student context:
${JSON.stringify(context, null, 2)}

The student asks: ${question}`,
  });
}
