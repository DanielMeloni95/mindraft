import { ZodError, type ZodType } from "zod";

/**
 * Every server action returns this. No thrown errors reach the client,
 * so the UI can always show a recoverable state instead of the Next.js
 * error overlay, and field-level messages travel with the result.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail<T = never>(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

export function parseInput<T>(
  schema: ZodType<T>,
  input: unknown,
): { ok: true; data: T } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ||= []).push(issue.message);
  }

  return {
    ok: false,
    result: fail("Controlla i campi evidenziati.", fieldErrors),
  };
}

/** Wraps a handler so unexpected failures become a readable message. */
export async function guard<T>(
  handler: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ZodError) {
      return fail("Dati non validi.");
    }
    // NEXT_REDIRECT and friends must keep bubbling.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_")
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Errore imprevisto";
    if (process.env.NODE_ENV !== "test") {
      console.error("[action]", message);
    }
    return fail(message);
  }
}
