import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AiProvider, ReplyGenerationRequest, requireApiKey } from "./ai-provider.interface";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/** Default provider. Uses fetch directly rather than the SDK — one HTTP call
 *  with a documented shape is easier to read than an extra dependency. */
@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  readonly model = "gpt-4o-mini";

  constructor(private readonly apiKey: string) {}

  async generateReply(request: ReplyGenerationRequest): Promise<string> {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireApiKey(this.apiKey, "OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 300,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: buildReviewMessage(request) },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new ServiceUnavailableException(`OpenAI request failed (${response.status}): ${detail}`);
    }

    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = body.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new ServiceUnavailableException("OpenAI returned an empty reply");
    }
    return reply;
  }
}

export function buildReviewMessage(request: ReplyGenerationRequest): string {
  return [
    `Reviewer name: ${request.reviewerName}`,
    `Star rating: ${request.rating} out of 5`,
    `Review: ${request.reviewText || "(no written comment)"}`,
    "",
    "Write the reply now. Output only the reply text.",
  ].join("\n");
}
