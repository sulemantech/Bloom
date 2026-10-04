import type { ReactNode } from "react";
import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

export type Tone = "lime" | "cyan" | "violet" | "coral" | "sun" | "neutral";

// Brand colour as a 15% tint, with the theme's readable text colour on top.
const TONE_CLASSES: Record<Tone, string> = {
  lime: "bg-lime/15 text-success",
  cyan: "bg-cyan/15 text-info",
  violet: "bg-violet/15 text-ai",
  coral: "bg-coral/15 text-danger",
  sun: "bg-sun/15 text-warning",
  neutral: "bg-soft/10 text-muted",
};

// Colour-coding shared with the website. Badges always carry their label, so colour is never
// the only signal (step "Present" and an error are both coral, but read differently).
export const STEP_TONE: Record<string, Tone> = {
  explore: "lime",
  choose: "cyan",
  build: "violet",
  present: "coral",
};

export const AGE_GROUP_TONE: Record<Enums["age_group"], Tone> = {
  explorer: "lime",
  builder: "cyan",
};

export const AREA_TONE: Record<Enums["project_area"], Tone> = {
  technology: "cyan",
  design: "violet",
  business: "sun",
  social_impact: "coral",
  undecided: "neutral",
};

export const SUBMISSION_TONE: Record<Enums["submission_status"], Tone> = {
  submitted: "sun",
  needs_changes: "coral",
  done: "lime",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Marks AI-written content until a mentor approves it: label, icon and dashed border, not just colour. */
export function AiDraft({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ai/50 bg-violet/10 p-4">
      <p className="label-caps mb-2 text-ai">
        <span aria-hidden="true">✦ </span>
        {label}
      </p>
      {children}
    </div>
  );
}
