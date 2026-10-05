import "server-only";
import { generateText, type AiResult } from "./gateway";

/** AI draft of a weekly progress card. A mentor always edits and approves it before a parent sees it. */
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

export function draftProgressCard(
  input: DraftProgressCardInput,
  who: { studentId: string; mentorId: string },
): Promise<AiResult<string>> {
  return generateText({
    capability: "progress_card",
    studentId: who.studentId,
    actorId: who.mentorId,
    consent: "ai",
    system: SYSTEM,
    user: `Draft the progress card from this week's record:\n\n${JSON.stringify(input, null, 2)}`,
    maxTokens: 4000,
  });
}
