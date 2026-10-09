/**
 * Every feature switch in the app, in one list. Admins turn them on or off on /admin/features;
 * the setting lives in feature_flags (a row for everyone, or one per group; the group's wins).
 * With no setting at all, the feature's default here applies.
 *
 * Parent consent is separate and always wins: a switch can never turn AI on for a child whose
 * parent said no (the AI gateway checks consent on every call).
 *
 * Adding a feature: add it here with a default, add its name and description to messages
 * (adminFeatures.items.<key>), and check it with isEnabled(). A switch only needed for a rollout
 * gets a `note` saying when to remove it.
 */
export const FEATURES = {
  ai: {
    /** Global only: one master switch, not per group. */
    scope: "global",
    default: true,
    note: "Emergency pause for every AI call (Spark and progress-card drafts).",
  },
  bloom_v2: {
    scope: "group",
    default: false,
    note: "Rollout: adaptive Spark (checks, gaps, difficulty, anchors). Remove once every group has it.",
  },
} as const satisfies Record<string, { scope: "global" | "group"; default: boolean; note: string }>;

export type FeatureKey = keyof typeof FEATURES;

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

export const isFeatureKey = (key: string): key is FeatureKey => key in FEATURES;
