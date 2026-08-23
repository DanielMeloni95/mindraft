import OpenAI from "openai";
import type { z } from "zod";

import { safeJsonParse } from "@/lib/utils";
import { AiError, type AiProvider, type AiRequest, type AiResponse } from "./provider";

/**
 * OpenAI-compatible provider. Talks JSON mode and validates the answer
 * with the same Zod schema the rest of the app uses, so a model that
 * drifts produces a clean error instead of corrupt data.
 *
 * Any endpoint that implements the OpenAI chat-completions API works:
 * set OPENAI_BASE_URL.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  readonly model: string;
  private readonly client: OpenAI;
  private readonly timeoutMs: number;

  constructor(options: {
    apiKey: string;
    model: string;
    baseUrl?: string | null;
    timeoutMs?: number;
  }) {
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 45_000;
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseUrl ?? undefined,
      maxRetries: 0, // retries are handled here, with a budget
    });
  }

  async generate<TSchema extends z.ZodTypeAny>(
    request: AiRequest<TSchema>,
  ): Promise<AiResponse<z.infer<TSchema>>> {
    let lastIssue = "";

    // One controlled retry: the second attempt gets the validation error
    // back so the model can correct itself. No exponential storm.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const completion = await this.client.chat.completions.create(
          {
            model: this.model,
            temperature: request.temperature ?? 0.3,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  attempt === 0
                    ? request.system
                    : `${request.system}\n\nIl tentativo precedente non rispettava lo schema: ${lastIssue}. Correggi e rispondi solo con JSON valido.`,
              },
              { role: "user", content: request.user },
            ],
          },
          { signal: request.signal ?? controller.signal },
        );

        const content = completion.choices[0]?.message?.content ?? "";
        const json = safeJsonParse(content);
        if (json === null) {
          lastIssue = "la risposta non era JSON";
          continue;
        }

        const parsed = request.schema.safeParse(json);
        if (!parsed.success) {
          lastIssue = parsed.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
          continue;
        }

        return {
          data: parsed.data,
          provider: this.name,
          model: this.model,
          inputTokens: completion.usage?.prompt_tokens ?? null,
          outputTokens: completion.usage?.completion_tokens ?? null,
        };
      } catch (error) {
        if (controller.signal.aborted) {
          throw new AiError("timeout", "Timeout della richiesta AI", true);
        }
        if (error instanceof OpenAI.APIError) {
          if (error.status === 429) {
            throw new AiError("rate_limited", "Rate limit del provider AI", true);
          }
          throw new AiError("provider_error", `Errore del provider (${error.status})`, error.status >= 500);
        }
        throw new AiError("provider_error", "Errore imprevisto del provider AI");
      } finally {
        clearTimeout(timer);
      }
    }

    throw new AiError("invalid_output", `Output non conforme allo schema: ${lastIssue}`);
  }
}
