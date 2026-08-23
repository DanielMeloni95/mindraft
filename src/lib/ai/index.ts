import "server-only";

import { getAiConfig } from "@/lib/env";
import { costOf, PLANS } from "@/lib/domain/plans";
import type { Supabase } from "@/lib/supabase/server";
import type { EntityType, PlanTier } from "@/types/database";

import type { AiContext } from "./context";
import { MockAiProvider } from "./mock";
import { OpenAiProvider } from "./openai";
import { buildPrompt } from "./prompts";
import { AiError, type AiProvider } from "./provider";
import { AI_SCHEMAS, type AiFeature, type AiResultOf } from "./schemas";

export { AiError } from "./provider";
export { AI_ERROR_MESSAGES } from "./provider";
export type { AiFeature } from "./schemas";

let provider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (provider) return provider;
  const config = getAiConfig();
  provider =
    config.provider === "openai" && config.apiKey
      ? new OpenAiProvider({
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          timeoutMs: config.timeoutMs,
        })
      : new MockAiProvider();
  return provider;
}

/** Exposed to the UI so it can say which engine produced a proposal. */
export function describeProvider(): { name: string; isMock: boolean } {
  const p = getAiProvider();
  return { name: p.name, isMock: p.name === "mock" };
}

export type AiRunOutcome<F extends AiFeature> = {
  runId: string;
  data: AiResultOf<F>;
  provider: string;
  creditsCharged: number;
};

/**
 * Runs one AI feature end to end:
 * meter credits → log the run → call the provider → validate → record.
 *
 * The credit charge happens first and atomically (charge_ai_credits),
 * so a burst of parallel requests cannot overshoot the plan. If the
 * provider then fails, the run is marked failed and the caller gets a
 * typed error — no partial writes anywhere.
 */
export async function runAiFeature<F extends AiFeature>(
  supabase: Supabase,
  params: {
    feature: F;
    workspaceId: string;
    userId: string;
    plan: PlanTier;
    context: AiContext;
    entityType?: EntityType;
    entityId?: string;
    temperature?: number;
  },
): Promise<AiRunOutcome<F>> {
  const { feature, workspaceId, userId, plan, context } = params;
  const cost = costOf(feature);
  const limit = PLANS[plan].limits.aiCreditsPerMonth;

  const { error: creditError } = await supabase.rpc("charge_ai_credits", {
    p_workspace_id: workspaceId,
    p_amount: cost,
    p_feature: feature,
    p_monthly_limit: limit,
  });

  if (creditError) {
    throw new AiError(
      creditError.message.includes("limit reached") ? "limit_reached" : "provider_error",
      creditError.message,
    );
  }

  const engine = getAiProvider();
  const startedAt = Date.now();

  const { data: run, error: runError } = await supabase
    .from("ai_runs")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      feature,
      provider: engine.name,
      model: engine.model,
      status: "running",
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      credits_charged: cost,
    })
    .select("id")
    .single();

  if (runError || !run) {
    throw new AiError("provider_error", "Impossibile registrare l'esecuzione AI");
  }

  try {
    const { system, user } = buildPrompt(feature, context);
    const result = await engine.generate({
      feature,
      schema: AI_SCHEMAS[feature],
      schemaName: feature,
      system,
      user,
      temperature: params.temperature,
    });

    await supabase
      .from("ai_runs")
      .update({
        status: "succeeded",
        duration_ms: Date.now() - startedAt,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
      })
      .eq("id", run.id);

    return {
      runId: run.id,
      data: result.data as AiResultOf<F>,
      provider: result.provider,
      creditsCharged: cost,
    };
  } catch (error) {
    const aiError =
      error instanceof AiError
        ? error
        : new AiError("provider_error", "Errore imprevisto durante l'esecuzione AI");

    await supabase
      .from("ai_runs")
      .update({
        status: "failed",
        duration_ms: Date.now() - startedAt,
        error_code: aiError.code,
        // Message only — prompts and completions are never persisted.
        error_message: aiError.message.slice(0, 500),
      })
      .eq("id", run.id);

    throw aiError;
  }
}
