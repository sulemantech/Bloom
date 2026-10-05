/**
 * Step instructions are stored as plain, labelled text (readable anywhere, no markup) and shown as
 * structured blocks: paragraphs, a numbered list and labelled boxes. Pure, so it is unit tested.
 *
 *   What you'll do and why.
 *
 *   Example: …
 *   You need: …
 *   Time: about 20 minutes
 *
 *   1. First action
 *   2. Next action
 *
 *   Tip: …
 */

export type DetailsBlock =
  | { type: "text"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "example" | "need" | "time" | "tip" | "next"; text: string };

export type StepParts = {
  intro: string;
  example?: string | null;
  youNeed?: string | null;
  minutes?: number | null;
  steps: string[];
  tip?: string | null;
};

const LABELS: Record<Exclude<DetailsBlock["type"], "text" | "steps">, RegExp> = {
  example: /^(?:example|for example)\s*:\s*/i,
  need: /^(?:you need|you'll need|you will need|materials)\s*:\s*/i,
  time: /^time\s*:\s*/i,
  tip: /^tip\s*:\s*/i,
  next: /^next step\s*:\s*/i,
};

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
/** Drop numbering the model may have added itself ("1. ", "Step 2: "). */
const bare = (s: string) => clean(s).replace(/^(?:step\s*)?\d+\s*[.):-]\s*/i, "");

/** The stored text for a planned step. */
export function formatDetails(parts: StepParts): string {
  const steps = parts.steps.map(bare).filter(Boolean);
  const facts = [
    clean(parts.example) && `Example: ${clean(parts.example)}`,
    clean(parts.youNeed) && `You need: ${clean(parts.youNeed)}`,
    parts.minutes && parts.minutes > 0 ? `Time: about ${Math.round(parts.minutes)} minutes` : "",
  ].filter(Boolean);
  return [
    clean(parts.intro),
    facts.join("\n"),
    steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    clean(parts.tip) && `Tip: ${clean(parts.tip)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Inline numbered steps in older text ("Steps: 1) Do this. 2) Then that."), split into a lead-in
 * and the items. Numbers must run 1, 2, 3… in order, so "score from 1 to 3" is left alone.
 */
function splitInlineSteps(text: string): { lead: string; items: string[] } | null {
  const starts: { at: number; len: number }[] = [];
  let from = 0;
  for (let n = 1; ; n++) {
    const match = new RegExp(`(?:^|\\s)(${n}\\)\\s)`).exec(text.slice(from));
    if (!match) break;
    const at = from + match.index + match[0].length - match[1].length;
    starts.push({ at, len: match[1].length });
    from = at + match[1].length;
  }
  if (starts.length < 2) return null;
  const items = starts.map((s, i) => text.slice(s.at + s.len, starts[i + 1]?.at ?? text.length).trim());
  const lead = text.slice(0, starts[0].at).trim().replace(/\s*steps?\s*:?\s*$/i, "").trim();
  return { lead, items: items.filter(Boolean) };
}

/** Structured blocks for any step text: newly planned (labelled lines) or older (one paragraph). */
export function parseDetails(text: string): DetailsBlock[] {
  const blocks: DetailsBlock[] = [];
  const pushText = (t: string) => {
    const inline = splitInlineSteps(t);
    if (!inline) return t && blocks.push({ type: "text", text: t });
    if (inline.lead) blocks.push({ type: "text", text: inline.lead });
    blocks.push({ type: "steps", items: inline.items });
  };

  for (const chunk of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    let paragraph: string[] = [];
    let steps: string[] = [];
    const flush = () => {
      if (paragraph.length) pushText(paragraph.join(" ").trim());
      if (steps.length) blocks.push({ type: "steps", items: steps });
      paragraph = [];
      steps = [];
    };

    for (const raw of chunk.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const step = /^(?:\d+[.)]|[-•*])\s+(.*)$/.exec(line);
      if (step) {
        if (paragraph.length) {
          pushText(paragraph.join(" ").trim());
          paragraph = [];
        }
        steps.push(step[1].trim());
        continue;
      }
      const label = (Object.keys(LABELS) as (keyof typeof LABELS)[]).find((k) => LABELS[k].test(line));
      if (label) {
        flush();
        blocks.push({ type: label, text: line.replace(LABELS[label], "") });
        continue;
      }
      if (steps.length) flush();
      paragraph.push(line);
    }
    flush();
  }
  return blocks;
}
