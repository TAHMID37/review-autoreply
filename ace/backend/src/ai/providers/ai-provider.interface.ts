/** What the AI is asked to write a reply to. */
export interface ReplyGenerationRequest {
  systemPrompt: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
}

/**
 * Every AI vendor is used through this one interface, so switching providers
 * (or adding a new one) is a new file plus an env var — the review pipeline
 * never mentions a vendor by name.
 */
export interface AiProvider {
  /** Short identifier stored on the reply row for auditing, e.g. "openai". */
  readonly name: string;
  /** The specific model used, stored alongside the reply. */
  readonly model: string;
  generateReply(request: ReplyGenerationRequest): Promise<string>;
}

/**
 * Raised at generation time rather than at startup, so a missing key never
 * stops the rest of the app from running. The message names the exact env
 * var to set.
 */
export function requireApiKey(key: string, envVarName: string): string {
  if (!key.trim()) {
    throw new Error(`Cannot generate a reply: ${envVarName} is not set in .env`);
  }
  return key;
}

/** DI token — AiProvider is an interface, which has no runtime value to inject. */
export const AI_PROVIDER = Symbol("AI_PROVIDER");
