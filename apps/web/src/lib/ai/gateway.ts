import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { dailyLimitFrom, dayWindowStart, inputHash, joinText } from "./util";

/**
 * The one way the app talks to the model. Every call is checked (configured, parental consent,
 * the student's daily Bloom limit) and logged to ai_runs with the model that answered, tokens,
 * latency and outcome — never the prompt or answer text.
 */
const MODEL = "claude-opus-5-5";

export type AiCapability = "progress_card" | "bloom_suggest" | "bloom_plan" | "bloom_step" | "bloom_ask";
export type AiFailure = "notConfigured" | "noConsent" | "dailyLimit" | "refused" | "rateLimited" | "failed";
export type AiResult<T> = { ok: true; data: T } | { ok: false; reason: AiFailure };

type Outcome = Database["public"]["Tables"]["ai_runs"]["Insert"]["outcome"];

export type AiCall = {
  capability: AiCapability;
  /** The student the call is about; consent and the daily limit are theirs. */
  studentId: string;
  /** Who asked: the student, or the mentor drafting a card. */
  actorId: string;
  consent: Database["public"]["Enums"]["consent_type"];
  system: string;
  user: string;
  maxTokens: number;
};

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Student-facing capabilities share one daily budget per student. */
const LIMITED: ReadonlySet<AiCapability> = new Set(["bloom_suggest", "bloom_plan", "bloom_step", "bloom_ask"]);

export async function generateText(call: AiCall): Promise<AiResult<string>> {
  return run(call, async (client) => {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: call.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: call.system,
      messages: [{ role: "user", content: call.user }],
    });
    const text = joinText(response.content);
    return { response, data: text || null };
  });
}

export async function generateStructured<T extends z.ZodType>(call: AiCall, schema: T): Promise<AiResult<z.infer<T>>> {
  return run(call, async (client) => {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: call.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system: call.system,
      messages: [{ role: "user", content: call.user }],
    });
    return { response, data: response.parsed_output ?? null };
  });
}

type Response = { model: string; stop_reason: string | null; usage: { input_tokens: number; output_tokens: number } };

async function run<T>(
  call: AiCall,
  execute: (client: Anthropic) => Promise<{ response: Response; data: T | null }>,
): Promise<AiResult<T>> {
  if (!aiConfigured()) return { ok: false, reason: "notConfigured" };

  const admin = createAdminClient();
  const hash = inputHash(call.system, call.user);
  const log = (outcome: Outcome, extra: Partial<Database["public"]["Tables"]["ai_runs"]["Insert"]> = {}) =>
    admin
      .from("ai_runs")
      .insert({ capability: call.capability, student_id: call.studentId, actor_id: call.actorId, input_hash: hash, outcome, ...extra })
      .then(({ error }) => {
        // Logging must never break the feature itself.
        if (error) console.error("ai_runs insert failed:", error.message);
      });

  const { data: consented } = await admin.rpc("has_active_consent", { p_student: call.studentId, p_type: call.consent });
  if (!consented) {
    await log("no_consent");
    return { ok: false, reason: "noConsent" };
  }

  if (LIMITED.has(call.capability)) {
    const { count } = await admin
      .from("ai_runs")
      .select("id", { count: "exact", head: true })
      .eq("student_id", call.studentId)
      .in("capability", [...LIMITED])
      .in("outcome", ["ok", "refused", "failed", "rate_limited"])
      .gte("created_at", dayWindowStart());
    if ((count ?? 0) >= dailyLimitFrom(process.env.BLOOM_AI_DAILY_LIMIT)) {
      await log("limited");
      return { ok: false, reason: "dailyLimit" };
    }
  }

  const started = Date.now();
  try {
    const { response, data } = await execute(new Anthropic());
    const usage = {
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      latency_ms: Date.now() - started,
    };
    if (response.stop_reason === "refusal") {
      await log("refused", usage);
      return { ok: false, reason: "refused" };
    }
    if (data === null) {
      await log("failed", usage);
      return { ok: false, reason: "failed" };
    }
    await log("ok", usage);
    return { ok: true, data };
  } catch (error) {
    const latency_ms = Date.now() - started;
    if (error instanceof Anthropic.RateLimitError) {
      await log("rate_limited", { latency_ms });
      return { ok: false, reason: "rateLimited" };
    }
    if (error instanceof Anthropic.APIError) console.error(`AI ${call.capability} failed (${error.status}):`, error.message);
    else console.error(`AI ${call.capability} failed:`, error);
    await log("failed", { latency_ms });
    return { ok: false, reason: "failed" };
  }
}
