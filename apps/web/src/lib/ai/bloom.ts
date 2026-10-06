import "server-only";
import { z } from "zod";
import type { StepWriterInput } from "@/lib/bloom/adaptive";
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

const KIND = z.enum(["learn", "do", "reflect"]);

/** The written-out parts of one step; stored as plain labelled text by formatDetails. */
const StepFields = {
  intro: z.string().describe("1-2 short sentences: what the student will do and why it matters. For a learn task, explain the idea simply"),
  example: z.string().nullable().describe("One concrete, everyday example in one sentence, or null if it adds nothing"),
  youNeed: z.string().nullable().describe('What to have ready, as a short comma-separated list (e.g. "A notebook, a pen"), or null if nothing'),
  minutes: z.number().int().describe("Realistic time in minutes, between 10 and 45"),
  steps: z
    .array(z.string())
    .describe("3-6 steps in order. Each is one clear action that starts with a verb, at most 20 words, no numbering"),
  tip: z.string().nullable().describe("One short, encouraging tip, or null"),
};

const StepSchema = z.object({ kind: KIND, title: z.string().describe("Short action title, under 60 characters"), ...StepFields });

const PlanSchema = z.object({
  summary: z.string().describe("2-3 short sentences, addressed to the student, on what this path covers and why it helps them"),
  tasks: z.array(StepSchema),
});

const OutlineSchema = z.object({
  summary: PlanSchema.shape.summary,
  first: StepSchema.describe("Step 1, written in full"),
  later: z
    .array(
      z.object({
        kind: KIND,
        title: z.string().describe("Short action title, under 60 characters"),
        aim: z.string().describe("One short sentence, addressed to the student: what this step is for"),
      }),
    )
    .describe("Every step after the first, in order: title and aim only"),
});

/** A planned path, with each step's instructions already formatted for storage (see lib/bloom/details). */
export type BloomPlan = {
  summary: string;
  tasks: { kind: "learn" | "do" | "reflect"; title: string; details: string; planned_only: boolean }[];
};

const TASK_COUNT = { quick: "3", standard: "5", deep: "7" } as const;

/** How depth changes the teaching, not only the number of steps. */
const DEPTH_TEACHING = {
  quick: "Quick: only the core idea and the most common way to use it. No history, side topics or edge cases.",
  standard: "Standard: the core ideas, how they connect, typical uses and the most common mistakes to avoid.",
  deep: "Deep dive: why it works underneath, where it stops working, a counter-example, and how to use it in a different situation.",
} as const;

const TEACHING_RULES = `How to teach:
- Explain why something matters before what it is.
- Give every abstract idea an everyday analogy or a concrete situation the student knows.
- Introduce at most 1-2 new ideas per step; build on what earlier steps taught.
- The student reads this on a phone, and a parent may read it too. Keep every part short and easy to scan: plain words, one idea per sentence, no jargon without a quick explanation, no markdown. Where the student fills something in, show the pattern with blanks, like "Many ___ have trouble with ___."`;

const writeStep = ({ steps, ...parts }: Omit<z.infer<typeof StepSchema>, "kind" | "title">) =>
  formatDetails({ ...parts, steps: steps.slice(0, 8), minutes: clampMinutes(parts.minutes) });

/**
 * A step-by-step learning path: a summary plus tasks mixing learning, doing and reflecting.
 * With `outline`, only step 1 is written; later steps are titles and aims that writeBloomStep fills
 * in when the student gets there.
 */
export async function planBloomPath(
  studentId: string,
  context: BloomContext,
  path: { title: string; goal: string; depth: keyof typeof TASK_COUNT },
  { outline = false }: { outline?: boolean } = {},
): Promise<AiResult<BloomPlan>> {
  const count = TASK_COUNT[path.depth];
  const brief = `Create a learning path called "${path.title}".
The student's goal: ${path.goal || "(not given — infer a sensible one from the title)"}
Depth: ${DEPTH_TEACHING[path.depth]}

Plan exactly ${count} tasks in a sensible order: start with a "learn" task that explains the core idea simply, include at least one hands-on "do" task that moves their own project forward when possible, and finish with a "reflect" task asking what they learned and how they will use it.

${TEACHING_RULES}

Student context:
${JSON.stringify(context, null, 2)}`;

  const call = { ...asStudent(studentId), capability: "bloom_plan" as const, system: BLOOM_SYSTEM, maxTokens: 8000 };

  if (outline) {
    const result = await generateStructured(
      {
        ...call,
        user: `${brief}

Write only step 1 in full. For the other ${Number(count) - 1} steps give just a title and a one-sentence aim: each will be written when the student gets there, adapted to how the earlier steps went.`,
      },
      OutlineSchema,
    );
    if (!result.ok) return result;
    const { summary, first, later } = result.data;
    return {
      ok: true,
      data: {
        summary,
        tasks: [
          { kind: first.kind, title: first.title, details: writeStep(first), planned_only: false },
          ...later.map((s) => ({ kind: s.kind, title: s.title, details: s.aim, planned_only: true })),
        ],
      },
    };
  }

  const result = await generateStructured({ ...call, user: brief }, PlanSchema);
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      summary: result.data.summary,
      tasks: result.data.tasks.map(({ kind, title, ...parts }) => ({ kind, title, details: writeStep(parts), planned_only: false })),
    },
  };
}

const WrittenStepSchema = z.object({
  title: z.string().describe("Short action title, under 60 characters. Keep the planned title unless the step changed"),
  adaptation: z
    .string()
    .nullable()
    .describe(
      'One short sentence to the student on what you changed in this step because of their feedback, e.g. "You found the last step hard, so this one is smaller and starts with a new example." Null if their feedback changed nothing',
    ),
  ...StepFields,
});

/**
 * Writes the next outline step from how the last one went: its feeling (too easy / just right /
 * too hard), the student's note and the questions they asked.
 */
export async function writeBloomStep(
  studentId: string,
  context: BloomContext,
  depth: keyof typeof TASK_COUNT,
  input: StepWriterInput,
): Promise<AiResult<{ title: string; details: string; adaptation: string | null }>> {
  const result = await generateStructured(
    {
      ...asStudent(studentId),
      capability: "bloom_step",
      system: BLOOM_SYSTEM,
      maxTokens: 6000,
      user: `Write step ${input.stepToWrite.step} of this student's learning path in full. It is a "${input.stepToWrite.kind}" step.
Depth: ${DEPTH_TEACHING[depth]}

Adapt it to how the last step went ("lastStep", the one the student just finished, which may be an earlier step they went back to):
- "too_hard", or a note or question showing confusion: make this step simpler and smaller, re-explain the confusing idea first with a new analogy, and add more support.
- "too_easy": add more challenge or a stretch, and don't repeat what they already showed they know.
- Answer anything still unclear from their note and questions, briefly, before moving on.
- Follow where their note says they want to go next when it still fits the path's goal.
- Look at earlier feelings and notes too: two hard steps in a row need a gentler step even if the last felt fine, and anything still unclear from an earlier note should be cleared up.
Keep to the step's planned aim unless the student clearly needs something else first.

${TEACHING_RULES}

Path so far:
${JSON.stringify(input, null, 2)}

Student context:
${JSON.stringify(context, null, 2)}`,
    },
    WrittenStepSchema,
  );
  if (!result.ok) return result;
  const { title, adaptation, ...parts } = result.data;
  return {
    ok: true,
    data: {
      title: title.trim().slice(0, 160) || input.stepToWrite.title,
      details: writeStep(parts),
      adaptation: adaptation?.trim().slice(0, 500) || null,
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
