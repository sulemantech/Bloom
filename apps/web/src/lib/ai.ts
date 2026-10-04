import "server-only";

/**
 * Single entry point for AI features, so the provider can change without touching the app.
 * Not used in the MVP. Phase 2: progress-card drafts (mentor approves). Phase 3: student tutor.
 */
export type DraftProgressCardInput = {
  studentFirstName: string;
  week: number;
  submissions: { activity: string; body: string; status: string }[];
  feedback: string[];
};

export async function draftProgressCard(input: DraftProgressCardInput): Promise<string> {
  void input;
  throw new Error("AI features are not enabled yet");
}
