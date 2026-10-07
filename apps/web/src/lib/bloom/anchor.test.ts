import { describe, expect, it } from "vitest";
import { anchorBrief, anchorOptions, anchorRecord, pickAnchor, type AnchorSource } from "./anchor";

const activity = (id: string, week: number, status: string) => ({ id, title: `Activity ${id}`, week, status, instructions: `Do ${id}` });

const source = (overrides: Partial<AnchorSource> = {}): AnchorSource => ({
  activities: [],
  week: 3,
  project: { title: "Clean Canteen", problem: "Plastic waste at school" },
  stage: { key: "explore", name: "Explore", summary: "Find problems worth solving" },
  ...overrides,
});

describe("anchorOptions", () => {
  it("puts work sent back for changes first, then overdue work (oldest first), then this week's", () => {
    const keys = anchorOptions(
      source({
        activities: [activity("this-week", 3, "todo"), activity("late-2", 2, "overdue"), activity("late-1", 1, "overdue"), activity("fix", 2, "needs_changes")],
      }),
    ).map((o) => o.key);
    expect(keys).toEqual(["activity:fix", "activity:late-1", "activity:late-2", "project", "stage:explore"]);
  });

  it("offers at most three activities, and never finished, submitted or future ones", () => {
    const options = anchorOptions(
      source({
        activities: [
          activity("done", 1, "done"),
          activity("waiting", 2, "submitted"),
          activity("a", 3, "todo"),
          activity("b", 3, "todo"),
          activity("c", 3, "todo"),
          activity("d", 3, "todo"),
          activity("next-week", 4, "todo"),
        ],
      }),
    );
    expect(options.filter((o) => o.kind === "activity").map((o) => o.activityId)).toEqual(["a", "b", "c"]);
  });

  it("marks why an activity is urgent", () => {
    const [fix, late] = anchorOptions(source({ activities: [activity("late", 1, "overdue"), activity("fix", 2, "needs_changes")] }));
    expect([fix.urgent, late.urgent]).toEqual(["needs_changes", "overdue"]);
  });

  it("uses the project problem, or its title before the problem is written", () => {
    expect(anchorOptions(source()).find((o) => o.kind === "project")?.label).toBe("Plastic waste at school");
    expect(anchorOptions(source({ project: { title: "Clean Canteen", problem: " " } })).find((o) => o.kind === "project")?.label).toBe("Clean Canteen");
    expect(anchorOptions(source({ project: { title: null, problem: null } })).some((o) => o.kind === "project")).toBe(false);
  });

  it("treats week 1 as this week before the course starts", () => {
    expect(anchorOptions(source({ week: 0, activities: [activity("first", 1, "todo")] }))[0].key).toBe("activity:first");
  });

  it("falls back to the student's interest only when there is no course to anchor to", () => {
    expect(anchorOptions({ activities: [], week: null, project: null, stage: null }).map((o) => o.key)).toEqual(["interest"]);
    expect(anchorOptions(source()).some((o) => o.kind === "interest")).toBe(false);
  });
});

describe("pickAnchor", () => {
  const options = anchorOptions(source({ activities: [activity("late", 1, "overdue")] }));

  it("accepts one of the current options", () => {
    expect(pickAnchor(options, "project").kind).toBe("project");
  });

  it("falls back to the most pressing need for a missing, stale or made-up key", () => {
    for (const key of [null, "", "activity:gone", "interest"]) expect(pickAnchor(options, key).key).toBe("activity:late");
  });
});

describe("anchorRecord and anchorBrief", () => {
  const [late] = anchorOptions(source({ activities: [activity("late", 2, "overdue")] }));

  it("stores what the database needs", () => {
    expect(anchorRecord(late)).toEqual({ kind: "activity", label: "Activity late", activity_id: "late", week: 2 });
  });

  it("tells Spark what the path is for, including why it is urgent", () => {
    expect(anchorBrief(late)).toContain('course activity "Activity late" (week 2, overdue). The activity asks: Do late');
  });
});
