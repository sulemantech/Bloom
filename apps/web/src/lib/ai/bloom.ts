import "server-only";
import { z } from "zod";
import type { CheckQuestion, CheckReview, StepWriterInput } from "@/lib/bloom/adaptive";
import type { Anchor } from "@/lib/bloom/anchor";
import { CHECK_COUNT, maxRechecks, type Gap } from "@/lib/bloom/gaps";
import type { Difficulty, LearnerState } from "@/lib/bloom/learner";
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
  /**
   * What the student understands and struggles with, how hard steps should be and what they need
   * next. Decided by code from their check answers and feelings (lib/bloom/learner), not by Spark.
   */
  learner?: LearnerState;
};

const BLOOM_SYSTEM = `You are Spark, the learning guide inside Youth Idea Lab, an 8-week live online course where students aged 12-18 explore, choose a real problem, build a project and present it at Demo Day. Explorers are 12-14, Builders are 15-18.

You help one student learn what they need for their own project and curiosity. Match the student's age group: short sentences and concrete everyday examples for Explorers; more depth and real tools for Builders. Be warm, encouraging and practical. Prefer doing over reading: small tasks the student can finish in 15-45 minutes with free tools, pen and paper or a phone.

Safety: keep everything age-appropriate. Never ask for or include personal data, contact details, or links to sign-up sites. Never suggest meeting strangers, sharing personal information online, spending money, or anything dangerous. If a question is about wellbeing, safety or something a trusted adult should handle, kindly suggest talking to their parent or mentor.`;

/** Every Bloom call is the student's own request, checked against their "bloom_ai" consent. */
const asStudent = (studentId: string) => ({ studentId, actorId: studentId, consent: "bloom_ai" as const });

/** Suggestions, each tied to one of the needs code offered (lib/bloom/anchor); the enum keeps Spark to them. */
const suggestionsSchema = (anchorKeys: [string, ...string[]]) =>
  z.object({
    suggestions: z
      .array(
        z.object({
          title: z.string().describe("Short, inviting name for the learning path, under 60 characters"),
          goal: z.string().describe("One sentence: what the student will be able to do afterwards"),
          why: z.string().describe("One sentence on how it helps with the need it serves"),
          anchor: z.enum(anchorKeys).describe("The key of the need this path serves"),
        }),
      )
      .describe("Exactly 3 suggestions"),
  });

export type BloomSuggestion = z.infer<ReturnType<typeof suggestionsSchema>>["suggestions"][number];

/** How a need is shown to Spark when it suggests paths. */
const describeAnchor = (a: Anchor) =>
  a.kind === "activity"
    ? `course activity "${a.label}", week ${a.week}${a.urgent === "overdue" ? " (overdue)" : a.urgent === "needs_changes" ? " (mentor asked for changes)" : ""}`
    : a.kind === "project"
      ? `their project problem: "${a.label}"`
      : a.kind === "stage"
        ? `the current programme step, ${a.label}`
        : "their own curiosity (not in a group yet)";

/**
 * Three personalised learning paths for where the student is right now, each serving one of
 * `anchors` (most pressing first). The server still checks each anchor it gets back (pickAnchor).
 */
export async function suggestBloomPaths(
  studentId: string,
  context: BloomContext,
  interest: string,
  anchors: readonly Anchor[],
): Promise<AiResult<BloomSuggestion[]>> {
  const keys = anchors.map((a) => a.key);
  const result = await generateStructured(
    {
      ...asStudent(studentId),
      capability: "bloom_suggest",
      system: BLOOM_SYSTEM,
      maxTokens: 8000,
      user: `Suggest exactly 3 learning paths for this student, each different. Do not repeat their earlier paths.

Spark is the guide for their course, so every path must serve one of these needs (give its key as "anchor"). They are listed most pressing first: the first suggestion serves the first need, and together the three cover the most pressing needs you can usefully help with.
${anchors.map((a) => `- ${a.key}: ${describeAnchor(a)}${a.brief ? `. ${a.brief}` : ""}`).join("\n")}

Student context:
${JSON.stringify(context, null, 2)}
${interest ? `\nThe student says they are curious about: ${interest}. Connect it to one of the needs above where you can.` : ""}`,
    },
    suggestionsSchema(keys.length ? [keys[0], ...keys.slice(1)] : ["interest"]),
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


const ChecksField = z
  .array(
    z.object({
      kind: z.enum(["apply", "judge"]).describe('"apply": use the idea in a new everyday situation. "judge": compare, choose or explain why'),
      question: z.string().describe("One short question the student can answer in 1-3 sentences, without looking anything up"),
      idea: z
        .string()
        .describe('2-4 words naming the one idea this question tests, e.g. "habit triggers". Reuse the exact name from learner.understands or learner.strugglesWith when it is the same idea'),
      recheck: z.boolean().describe("True when this question checks an open gap again (use the gap's exact idea name)"),
    }),
  )
  .describe("Check-your-understanding questions for this step, in order");

const checkRules = (depth: keyof typeof CHECK_COUNT) => `Check your understanding: end the step with exactly ${CHECK_COUNT[depth]} short questions about its main idea. At least one is "apply" (use the idea in a new, everyday situation) and one is "judge" (compare, choose or explain why). The student answers in their own words, so ask for thinking, not memorised facts. Never ask about personal details, family or private life. Don't include the answers. Name the idea each question tests, reusing the exact names already in the student's learner state for the same idea, so their progress on it adds up.`;

const ReviewField = z
  .array(
    z.object({
      verdict: z
        .enum(["nailed", "nearly", "not_yet"])
        .describe('"nailed": shows they understand, even if the wording is rough. "nearly": partly right or missing one piece. "not_yet": wrong, or left blank'),
      feedback: z.string().describe("1-2 warm sentences to the student about their answer: what they got right first, then what to add or rethink"),
      keyIdea: z.string().describe("One sentence with the idea a good answer shows, in plain words"),
    }),
  )
  .nullable()
  .describe('Only when lastStep.understandingChecks has at least one answer: one review per question, in the same order. Otherwise null');

/**
 * The difficulty code decided for this step (lib/bloom/learner preferredDifficulty), as an instruction
 * with measurable meanings, so whether Spark followed it can be checked (see stepShape).
 */
const DIFFICULTY_RULES: Record<Difficulty, string> = {
  easier:
    "EASIER. At most 1 new idea. 3-4 small actions. 10-20 minutes. Start with a fresh everyday example, give fill-in patterns for anything the student writes, and keep sentences extra short.",
  same: "THE SAME as the last step. 1-2 new ideas. 3-5 actions. 15-30 minutes.",
  harder:
    "HARDER. 1-2 new ideas, at least one applied to a new or less familiar situation. 4-6 actions, the last one a stretch the student designs or decides themselves. 20-40 minutes. Fewer fill-in patterns.",
};

const difficultyRule = (level: Difficulty) =>
  `Difficulty for this step (decided from the student's recent feelings and answers; follow it exactly): ${DIFFICULTY_RULES[level]}`;

/** Tells Spark which gaps to re-check; lib/bloom/gaps enforces it on the result. */
const recheckRules = (depth: keyof typeof CHECK_COUNT, gaps: readonly Gap[]) => `Re-checking gaps: a gap is an idea the student has not shown they understand yet. Re-check up to ${maxRechecks(depth)} gaps in this step: first any idea whose answer you mark "nearly" or "not_yet" in your review, then these open gaps, in order: ${gaps.length ? gaps.map((g) => `"${g.idea}"`).join(", ") : "(none)"}. For each, write one check question with recheck = true and the gap's exact idea name, asking about it in a new way (a new situation, not the same question again). Re-check questions come first; the remaining questions (at least one) check this step's new idea with recheck = false. Teach a gap's idea again briefly in the step before re-checking it.`;

const REVIEW_RULES = `Reviewing answers: be kind and specific, like a good mentor. Start with what is right. Never mock or use the word "wrong"; say what to add or think about instead. Judge understanding, not spelling or grammar. A blank answer is "not_yet": give the key idea without blame.`;

/** Normalised review, in question order (blank answers keep their verdict; the page shows "Not answered"). */
const toReview = (review: z.infer<typeof ReviewField>, count: number): CheckReview[] | null =>
  review && review.length
    ? review.slice(0, count).map((r) => ({ verdict: r.verdict, feedback: r.feedback.trim().slice(0, 600), key_idea: r.keyIdea.trim().slice(0, 400) }))
    : null;

const toChecks = (checks: z.infer<typeof ChecksField>, depth: keyof typeof CHECK_COUNT): CheckQuestion[] =>
  checks
    .map((c) => ({ kind: c.kind, question: c.question.trim().slice(0, 300), idea: c.idea.trim().slice(0, 80), recheck: c.recheck }))
    .filter((c) => c.question)
    .slice(0, CHECK_COUNT[depth]);

const OutlineSchema = z.object({
  summary: PlanSchema.shape.summary,
  first: StepSchema.extend({ checks: ChecksField }).describe("Step 1, written in full"),
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
  tasks: {
    kind: "learn" | "do" | "reflect";
    title: string;
    details: string;
    planned_only: boolean;
    check_questions?: CheckQuestion[];
    /** Difficulty code decided for a step written now (outline planning only). */
    difficulty?: Difficulty;
  }[];
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
  /** `serves`: what the path is for (lib/bloom/anchor anchorBrief), so every step works towards it. */
  path: { title: string; goal: string; depth: keyof typeof TASK_COUNT; serves: string },
  { outline = false, difficulty = "same" }: { outline?: boolean; difficulty?: Difficulty } = {},
): Promise<AiResult<BloomPlan>> {
  const count = TASK_COUNT[path.depth];
  const brief = `Create a learning path called "${path.title}".
The student's goal: ${path.goal || "(not given — infer a sensible one from the title)"}
What this path is for: ${path.serves}
Depth: ${DEPTH_TEACHING[path.depth]}

Plan exactly ${count} tasks in a sensible order: start with a "learn" task that explains the core idea simply, include at least one hands-on "do" task that produces something for what this path is for, and finish with a "reflect" task asking what they learned and how they will use it.

${TEACHING_RULES}

Student context:
${JSON.stringify(context, null, 2)}`;

  const call = { ...asStudent(studentId), capability: "bloom_plan" as const, system: BLOOM_SYSTEM, maxTokens: 8000 };

  if (outline) {
    const result = await generateStructured(
      {
        ...call,
        user: `${brief}

Write only step 1 in full. For the other ${Number(count) - 1} steps give just a title and a one-sentence aim: each will be written when the student gets there, adapted to how the earlier steps went.

For step 1: ${difficultyRule(difficulty)}

${checkRules(path.depth)}`,
      },
      OutlineSchema,
    );
    if (!result.ok) return result;
    const { summary, first, later } = result.data;
    const { checks, ...firstStep } = first;
    return {
      ok: true,
      data: {
        summary,
        tasks: [
          {
            kind: first.kind,
            title: first.title,
            details: writeStep(firstStep),
            planned_only: false,
            // A new path has no gaps of its own: re-checks are decided by code (lib/bloom/gaps), never here.
            check_questions: toChecks(checks, path.depth).map((c) => ({ ...c, recheck: false })),
            difficulty,
          },
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
  checks: ChecksField,
  review: ReviewField,
});

export type WrittenStep = {
  /** Measurable shape of the step, to check it against the difficulty asked for. */
  shape: { actions: number; minutes: number | null };
  title: string;
  details: string;
  adaptation: string | null;
  check_questions: CheckQuestion[];
  /** Review of the last step's answers (in its question order), or null if none were answered. */
  review: CheckReview[] | null;
};

/**
 * Writes the next outline step from how the last one went: its feeling (too easy / just right /
 * too hard), the student's note, the questions they asked and their answers to its checks, which
 * Spark reviews in the same call.
 */
export async function writeBloomStep(
  studentId: string,
  context: BloomContext,
  depth: keyof typeof TASK_COUNT,
  input: StepWriterInput,
  /** Gaps already known to be open in this path (lib/bloom/gaps); code verifies the re-checks afterwards. */
  openGaps: readonly Gap[] = [],
  /** Difficulty decided by code (lib/bloom/learner); Spark is told to follow it. */
  difficulty: Difficulty = "same",
): Promise<AiResult<WrittenStep>> {
  const result = await generateStructured(
    {
      ...asStudent(studentId),
      capability: "bloom_step",
      system: BLOOM_SYSTEM,
      maxTokens: 6000,
      user: `Write step ${input.stepToWrite.step} of this student's learning path in full. It is a "${input.stepToWrite.kind}" step.
Depth: ${DEPTH_TEACHING[depth]}

Adapt it to how the last step went ("lastStep", the one the student just finished, which may be an earlier step they went back to):
- A note or question showing confusion: re-explain the confusing idea first with a new analogy.
- How much to simplify or stretch is already decided: see "Difficulty for this step" below.
- Answer anything still unclear from their note and questions, briefly, before moving on.
- Follow where their note says they want to go next when it still fits the path's goal.
- Look at earlier notes too: anything still unclear from an earlier note should be cleared up.
- Their answers to the last step's checks ("understandingChecks") are stronger evidence than how it felt: if an answer is "nearly" or "not_yet", briefly re-teach that idea in this step before building on it; if they nailed everything, move on confidently.
- Use the learner state in the student context: build on ideas in "understands" without re-teaching them, and where an idea in "strugglesWith" belongs in this step, explain it again in a new way.
Keep to the step's planned aim unless the student clearly needs something else first, and keep the step useful for what the path is for ("path.serves" in "Path so far").

${difficultyRule(difficulty)}

${TEACHING_RULES}

${checkRules(depth)}

${recheckRules(depth, openGaps)}

${REVIEW_RULES}

Path so far:
${JSON.stringify(input, null, 2)}

Student context:
${JSON.stringify(context, null, 2)}`,
    },
    WrittenStepSchema,
  );
  if (!result.ok) return result;
  const { title, adaptation, checks, review, ...parts } = result.data;
  const answered = input.lastStep?.understandingChecks ?? [];
  return {
    ok: true,
    data: {
      shape: { actions: parts.steps.filter((s) => s.trim()).length, minutes: clampMinutes(parts.minutes) },
      title: title.trim().slice(0, 160) || input.stepToWrite.title,
      details: writeStep(parts),
      adaptation: adaptation?.trim().slice(0, 500) || null,
      check_questions: toChecks(checks, depth),
      review: answered.some((c) => c.answer) ? toReview(review, answered.length) : null,
    },
  };
}

/**
 * Reviews a step's check answers on their own, when finishing it doesn't lead to a new step being
 * written (e.g. the last step of a path).
 */
export async function reviewBloomAnswers(
  studentId: string,
  context: BloomContext,
  step: { path: string; title: string; details: string; checks: { question: string; answer: string | null }[] },
): Promise<AiResult<CheckReview[]>> {
  const result = await generateStructured(
    {
      ...asStudent(studentId),
      capability: "bloom_review",
      system: BLOOM_SYSTEM,
      maxTokens: 3000,
      user: `Review this student's answers to the check-your-understanding questions at the end of a step.

${REVIEW_RULES}

Learning path: ${step.path}
Step: ${step.title}
${step.details}

Questions and answers (null = left blank):
${JSON.stringify(step.checks, null, 2)}

Student context:
${JSON.stringify(context, null, 2)}`,
    },
    z.object({ review: ReviewField.unwrap().describe("One review per question, in the same order") }),
  );
  if (!result.ok) return result;
  return { ok: true, data: toReview(result.data.review, step.checks.length) ?? [] };
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
