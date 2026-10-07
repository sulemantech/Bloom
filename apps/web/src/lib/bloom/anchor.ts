// ---------------------------------------------------------------------------
// Anchors: what real need a learning path serves (roadmap 2.5.4)
// ---------------------------------------------------------------------------
// Spark is a guide for the course, not a separate chatbot, so every path serves something concrete:
// a course activity, the project problem or the current programme step. Code decides which needs
// are on offer and in what order; Spark may only pick one of them for a suggestion, and the server
// checks that the anchor it receives is still one of the options (see pickAnchor).

export type AnchorKind = "activity" | "project" | "stage" | "interest";

export type Anchor = {
  /** Stable id within the options: "activity:<id>", "project", "stage:<key>" or "interest". */
  key: string;
  kind: AnchorKind;
  /** What the path helps with, in the student's words ("Talk to 3 people"); empty for interest. */
  label: string;
  activityId: string | null;
  week: number | null;
  /** The activity is late, or the mentor sent it back for changes: it comes first. */
  urgent: "overdue" | "needs_changes" | null;
  /** A short reminder of what the need asks for, so Spark can plan towards it. */
  brief: string;
};

export type AnchorSource = {
  /** The student's activities for their age group, with their status (lib/programme activityStatus). */
  activities: { id: string; title: string; week: number; status: string; instructions: string }[];
  /** Programme week, 0 before the start; null when the group has no start date. */
  week: number | null;
  project: { title: string | null; problem: string | null } | null;
  stage: { key: string; name: string; summary: string } | null;
};

/** Course activities offered at most, so the choice stays short. */
export const MAX_ACTIVITY_ANCHORS = 3;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const URGENCY = { needs_changes: 0, overdue: 1 } as const;

/**
 * The needs a new path can serve, most pressing first:
 * 1. activities sent back for changes, then overdue ones (oldest week first);
 * 2. this week's open activities;
 * 3. the project problem (or title, before the problem is written);
 * 4. the current programme step.
 * Without a group there is nothing to anchor to, so the student's own interest is the only option.
 */
export function anchorOptions({ activities, week, project, stage }: AnchorSource): Anchor[] {
  const thisWeek = Math.max(week ?? 1, 1);
  const urgent = activities
    .filter((a) => a.status === "needs_changes" || a.status === "overdue")
    .sort((a, b) => URGENCY[a.status as keyof typeof URGENCY] - URGENCY[b.status as keyof typeof URGENCY] || a.week - b.week);
  const current = activities.filter((a) => a.status === "todo" && a.week <= thisWeek);
  const options: Anchor[] = [...urgent, ...current].slice(0, MAX_ACTIVITY_ANCHORS).map((a) => ({
    key: `activity:${a.id}`,
    kind: "activity",
    label: clip(a.title, 200),
    activityId: a.id,
    week: a.week,
    urgent: a.status === "needs_changes" || a.status === "overdue" ? a.status : null,
    brief: clip(a.instructions, 500),
  }));

  const problem = project?.problem?.trim() || project?.title?.trim();
  if (problem) {
    options.push({ key: "project", kind: "project", label: clip(problem, 200), activityId: null, week: null, urgent: null, brief: "" });
  }
  if (stage?.name) {
    options.push({ key: `stage:${stage.key}`, kind: "stage", label: stage.name, activityId: null, week: null, urgent: null, brief: clip(stage.summary, 300) });
  }
  if (!options.length) {
    options.push({ key: "interest", kind: "interest", label: "", activityId: null, week: null, urgent: null, brief: "" });
  }
  return options;
}

/**
 * The anchor for a key the browser or Spark sent: only one of the current options is accepted,
 * anything else (missing, stale or made up) falls back to the most pressing need.
 */
export function pickAnchor(options: readonly Anchor[], key: string | null | undefined): Anchor {
  return options.find((o) => o.key === key) ?? options[0];
}

/** What the database stores for a path's anchor (create_bloom_path p_anchor). */
export const anchorRecord = (anchor: Anchor) => ({
  kind: anchor.kind,
  label: anchor.label,
  activity_id: anchor.activityId,
  week: anchor.week,
});

/** What Spark is told the path is for, so the plan and every step serve it. */
export function anchorBrief(anchor: Pick<Anchor, "kind" | "label" | "week" | "urgent" | "brief">): string {
  switch (anchor.kind) {
    case "activity":
      return `This path must help the student do their course activity "${anchor.label}" (week ${anchor.week}${
        anchor.urgent === "overdue" ? ", overdue" : anchor.urgent === "needs_changes" ? ", their mentor asked for changes" : ""
      }).${anchor.brief ? ` The activity asks: ${anchor.brief}` : ""} The hands-on steps should produce something they can use for it.`;
    case "project":
      return `This path must help the student with their project problem: "${anchor.label}". The hands-on steps should move that project forward.`;
    case "stage":
      return `This path must help the student with the current programme step, ${anchor.label}.${anchor.brief ? ` ${anchor.brief}` : ""}`;
    default:
      return "The student is following their own curiosity (they are not in a group yet).";
  }
}
