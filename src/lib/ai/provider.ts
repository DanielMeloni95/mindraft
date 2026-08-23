import type { z } from "zod";

import type { AiFeature } from "./schemas";

export type AiRequest<TSchema extends z.ZodTypeAny> = {
  feature: AiFeature;
  schema: TSchema;
  schemaName: string;
  system: string;
  user: string;
  temperature?: number;
  signal?: AbortSignal;
};

export type AiResponse<T> = {
  data: T;
  provider: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
};

export interface AiProvider {
  readonly name: string;
  readonly model: string | null;
  /** Returns structured, schema-valid data or throws AiError. */
  generate<TSchema extends z.ZodTypeAny>(
    request: AiRequest<TSchema>,
  ): Promise<AiResponse<z.infer<TSchema>>>;
}

export type AiErrorCode =
  | "timeout"
  | "rate_limited"
  | "invalid_output"
  | "provider_error"
  | "not_configured"
  | "limit_reached";

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;

  constructor(code: AiErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.retryable = retryable;
  }
}

/** User-facing copy. Technical detail stays in the logs. */
export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  timeout: "L'assistente ci ha messo troppo. Riprova: nulla è stato modificato.",
  rate_limited: "Troppe richieste ravvicinate. Riprova tra qualche secondo.",
  invalid_output:
    "La risposta non era nel formato atteso, quindi non è stata applicata.",
  provider_error: "Il servizio AI non ha risposto. Nulla è stato modificato.",
  not_configured: "Nessun provider AI configurato.",
  limit_reached: "Hai raggiunto il limite di crediti AI del piano.",
};
